-- =============================================================
-- INMERSIA — Migración 037
-- El usuario autenticado solo lee los libros que adquirió
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA
-- `capitulos_select` y `parrafos_select` estaban en USING (true) para
-- `authenticated`: cualquier usuario con sesión podía leer CUALQUIER
-- libro completo pidiéndolo a la API (o escribiendo /libro/<slug>),
-- saltándose la adquisición y el límite de lecturas pendientes.
-- Al rol `anon` sí lo limitaban capitulos_guest_preview /
-- parrafos_guest_preview a los 2 primeros capítulos.
--
-- SOLUCIÓN
-- Misma regla para todos: 2 capítulos de muestra, y el libro entero
-- solo si está en bibliotecas_usuarios. Los superusuarios pasan.
--
-- NO TOCA a los invitados: capitulos_guest_preview y
-- parrafos_guest_preview son políticas aparte, con TO anon, y siguen
-- exactamente igual (ver 000_politicas_actuales.sql).
--
-- Notas de rendimiento
--   · `(SELECT auth.uid())` en vez de `auth.uid()` a secas: envuelto en
--     un subselect Postgres lo evalúa UNA vez por consulta en lugar de
--     una vez por fila. Es la recomendación de Supabase para RLS.
--   · La comprobación de propiedad usa idx_bibliotecas_usuarios_user_libro
--     (user_id, libro_id), creado en 030_indexes_prelaunch.sql.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

-- ── capitulos ────────────────────────────────────────────────
DROP POLICY IF EXISTS "capitulos_select" ON public.capitulos;

CREATE POLICY "capitulos_select"
  ON public.capitulos FOR SELECT TO authenticated
  USING (
    -- 1) muestra: los 2 primeros capítulos de cualquier libro
    numero <= 2
    -- 2) el libro está en su biblioteca
    OR EXISTS (
      SELECT 1 FROM public.bibliotecas_usuarios bu
      WHERE bu.user_id = (SELECT auth.uid())
        AND bu.libro_id = capitulos.libro_id
    )
    -- 3) superusuario
    OR EXISTS (
      SELECT 1 FROM public.superusuarios s
      WHERE s.user_id = (SELECT auth.uid())
    )
  );

-- ── parrafos ─────────────────────────────────────────────────
-- parrafos tiene libro_id propio, así que la comprobación de propiedad
-- no necesita pasar por capitulos. El tramo de muestra sí, porque el
-- número de capítulo solo vive allí (parrafos.numero es el del párrafo).
DROP POLICY IF EXISTS "parrafos_select" ON public.parrafos;

CREATE POLICY "parrafos_select"
  ON public.parrafos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bibliotecas_usuarios bu
      WHERE bu.user_id = (SELECT auth.uid())
        AND bu.libro_id = parrafos.libro_id
    )
    OR EXISTS (
      SELECT 1 FROM public.superusuarios s
      WHERE s.user_id = (SELECT auth.uid())
    )
    -- misma forma que parrafos_guest_preview, que ya está probada en prod
    OR capitulo_id IN (
      SELECT c.id FROM public.capitulos c WHERE c.numero <= 2
    )
  );


-- =============================================================
-- COMPROBACIÓN (ejecutar después, con tu sesión de superusuario NO;
-- lo ideal es probarlo desde la app con una cuenta normal)
--
--   · Cuenta normal, libro NO adquirido → debe ver 2 capítulos:
--       SELECT count(*) FROM capitulos
--       WHERE libro_id = '<uuid de un libro que NO tenés>';
--     Esperado: 2
--
--   · Cuenta normal, libro SÍ adquirido → debe verlos todos:
--       SELECT count(*) FROM capitulos
--       WHERE libro_id = '<uuid de un libro que SÍ tenés>';
--     Esperado: el total real del libro
--
--   · Invitado (sin sesión) → sin cambios respecto de antes.
-- =============================================================
