-- =============================================================
-- INMERSIA — Migración 040
-- Vista `subrayados_populares` + cierre de la RLS de subrayados
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA (#13 de la revisión pre-lanzamiento)
-- La migración 013 sustituyó la política de SELECT de
-- `subrayados_usuario` (que era `auth.uid() = user_id`, migración 011)
-- por `USING (true)`, para poder contar las frases más subrayadas de
-- un libro. Efecto colateral: cualquier usuario con sesión y la anon
-- key puede leer `user_id, libro_id, capitulo_num, texto_original` de
-- TODO el mundo — qué subraya cada persona y qué libros lee.
--
-- SOLUCIÓN
-- Mover la agregación a una vista, que es lo único que la app
-- necesitaba ver de los demás, y devolver la tabla a "solo mis filas".
-- La vista no expone `user_id`: un total de 1 dice "alguien subrayó
-- esto", no quién.
--
-- Los otros tres sitios que leen la tabla (Notebook.jsx,
-- useLectorData.js ×2) ya filtran por `.eq('user_id', …)`, así que no
-- les afecta el cierre.
--
-- security_invoker = false (a propósito, igual que `perfiles_publicos`
-- en la 038): la vista corre con los permisos de su dueño y por eso
-- puede agregar las filas de todos. El filtro de privacidad son las
-- columnas del SELECT, no la RLS. El linter de Supabase la marcará
-- como "SECURITY DEFINER view" — es esperado.
--
-- El scan usa `idx_subrayados_libro_con_parrafo` (migración 030), que
-- es parcial sobre exactamente este `WHERE parrafo_id IS NOT NULL`.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. VISTA AGREGADA
--    Una fila por (libro, párrafo) con cuántas PERSONAS distintas
--    lo subrayaron. `count(DISTINCT user_id)` y no `count(*)`:
--    subrayar dos veces el mismo párrafo no cuenta doble.
--    `texto`: cada quien selecciona un trozo distinto del párrafo,
--    así que se toma el más largo como representante (desempate por
--    orden alfabético para que el resultado sea estable).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.subrayados_populares AS
  SELECT
    libro_id,
    parrafo_id,
    (array_agg(texto_original ORDER BY length(texto_original) DESC, texto_original))[1]
      AS texto,
    count(DISTINCT user_id) AS total
  FROM public.subrayados_usuario
  WHERE parrafo_id IS NOT NULL
  GROUP BY libro_id, parrafo_id;
  -- Si algún día no se quiere publicar una frase que subrayó una sola
  -- persona, añadir aquí:  HAVING count(DISTINCT user_id) >= 2

ALTER VIEW public.subrayados_populares SET (security_invoker = false);

COMMENT ON VIEW public.subrayados_populares IS
  'Frases más subrayadas por libro para la ficha de Tienda. Agregado anónimo: nunca expone user_id. La tabla subrayados_usuario es privada por fila. Ver migración 040.';

-- Solo usuarios con sesión: la ficha de Tienda está detrás del login.
REVOKE ALL ON public.subrayados_populares FROM PUBLIC, anon;
GRANT SELECT ON public.subrayados_populares TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 2. CERRAR LA RLS — vuelve a la política original de la 011
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "subrayados_select" ON public.subrayados_usuario;

CREATE POLICY "subrayados_select"
  ON public.subrayados_usuario FOR SELECT TO authenticated
  USING (auth.uid() = user_id);


-- =============================================================
-- COMPROBACIÓN
--   -- Desde el SQL Editor auth.uid() es NULL, así que la tabla debe
--   -- verse vacía y la vista no:
--   SELECT count(*) FROM subrayados_usuario;    -- 0
--   SELECT count(*) FROM subrayados_populares;  -- > 0
--   SELECT texto, total FROM subrayados_populares
--     WHERE libro_id = '<uuid>' ORDER BY total DESC LIMIT 3;
--
--   -- Desde la app (ahí auth.uid() sí existe):
--   -- · el Cuaderno del Lector sigue mostrando tus subrayados
--   -- · la ficha de Tienda sigue mostrando "Frases más subrayadas"
-- =============================================================
