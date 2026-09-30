-- =============================================================
-- INMERSIA — Migración 058
-- Capa de comunidad en el lector: mensajitos que se borran al leerlos,
-- quién puede borrarlos y a quién se le pueden dejar
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- El lector muestra, sobre el libro, los comentarios de la comunidad
-- (por párrafo) y los mensajitos 1 a 1 (un listón en la página donde
-- se escribieron). Esta migración cierra tres cosas:
--
--   1. mensajitos.efimero: quien lo escribe puede marcar "Se borra
--      cuando lo lea". El cliente lo borra al CERRARLO (no al abrirlo),
--      para que dé tiempo a denunciarlo: la denuncia copia el texto.
--
--   2. Borrar un mensajito: solo quien lo RECIBE (o el superusuario).
--      Quien lo envía ya no puede: es un regalo, una vez dado no se
--      retira. El moderador tampoco (no los lee: son privados).
--      Si algo va mal, denuncia → lo revisa el superusuario.
--
--   3. puede_recibir_mensajitos(comunidad): a quién de la comunidad le
--      puedo dejar uno. Devuelve solo ids, nunca fechas de nacimiento.
--      Si quien pregunta tiene menos de 16, devuelve vacío.
--      Sin fecha de nacimiento cuenta como permitido (el campo es
--      obligatorio al registrarse; ver edad_permite_contacto, 051).
--
-- Los mensajitos no caducan: viven hasta que quien los recibe los
-- borra, hasta una denuncia o hasta que se borra la cuenta (CASCADE).
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================


-- ── 1. Se borra cuando lo lea ────────────────────────────────
ALTER TABLE public.mensajitos
  ADD COLUMN IF NOT EXISTS efimero boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mensajitos.efimero IS
  'Se borra cuando lo lea: el cliente del destinatario lo borra al cerrarlo. Ver migración 058.';


-- ── 2. Solo quien lo recibe lo borra ─────────────────────────
DROP POLICY IF EXISTS "mensajitos_delete" ON public.mensajitos;
CREATE POLICY "mensajitos_delete"
  ON public.mensajitos FOR DELETE TO authenticated
  USING (para_id = (SELECT auth.uid()) OR es_superusuario());


-- ── 3. A quién le puedo dejar un mensajito ───────────────────
CREATE OR REPLACE FUNCTION public.puede_recibir_mensajitos(p_comunidad uuid)
RETURNS TABLE (user_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT es_miembro(p_comunidad) THEN
    RAISE EXCEPTION 'Solo los miembros dejan mensajitos.' USING ERRCODE = '42501';
  END IF;

  -- Menor de 16: ni envía ni recibe. Vacío, sin explicar por qué.
  IF NOT edad_permite_contacto(auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.user_id
  FROM comunidad_miembros m
  WHERE m.comunidad_id = p_comunidad
    AND m.user_id <> auth.uid()
    AND edad_permite_contacto(m.user_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.puede_recibir_mensajitos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_recibir_mensajitos(uuid) TO authenticated;


-- =============================================================
-- COMPROBACIÓN (como postgres, en el SQL Editor)
--
--   -- la columna
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'mensajitos' AND column_name = 'efimero';
--
--   -- la política nueva (debe decir para_id ... OR es_superusuario())
--   SELECT policyname, qual FROM pg_policies
--   WHERE tablename = 'mensajitos' AND cmd = 'DELETE';
--
--   -- la función
--   SELECT proname FROM pg_proc WHERE proname = 'puede_recibir_mensajitos';
-- =============================================================
