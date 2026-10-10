-- =============================================================
-- INMERSIA — Migración 074
-- La fecha de nacimiento se pone una sola vez; el apellido deja de ser público
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA
--   · `perfiles.fecha_nacimiento` (la que leen las reglas de edad de la
--     051) se podía cambiar por la API en cualquier momento. Y la política
--     `Perfil propio` (ALL) dejaba además BORRAR el propio perfil y volver
--     a crearlo con otra fecha. La app nunca borra perfiles: la cuenta se
--     borra con eliminar_mi_cuenta(), SECURITY DEFINER, que borra
--     auth.users y el perfil cae en cascada.
--   · `perfiles_publicos` deja a cualquier usuario con sesión listar el
--     nombre y el apellido de todos.
--
-- SOLUCIÓN (decisiones de Juan, 10 oct 2026)
--   1. Trigger BEFORE UPDATE: si la fecha ya tenía valor, el usuario no
--      puede cambiarla (HINT 'fecha_fija'). Si estaba vacía (Google, que
--      la pide CompletarCuenta) sí puede ponerla, una vez. Solo frena a
--      los roles de la API (authenticated/anon): desde el SQL Editor se
--      puede corregir a mano si alguien se equivocó al registrarse.
--   2. `Perfil propio` (ALL) se sustituye por una política de INSERT, que
--      es lo único que añadía: SELECT y UPDATE ya tienen la suya
--      (`Perfiles visibles por dueño`, `perfiles_update_propio`). Así
--      desaparece el DELETE. ensureProfile sigue pudiendo crear el perfil.
--   3. `perfiles_publicos` devuelve el apellido vacío (NULL). La columna
--      se queda para no romper el código que la pide: Foro, chat y capa de
--      comunidad ya montan el nombre con `apellido || ''`, así que pasan a
--      enseñar solo el nombre sin tocar nada. Quitar la columna del código
--      y de la vista cuando se toquen esos archivos.
--
-- QUÉ NO CAMBIA
--   · progreso_comunidad() sigue devolviendo el apellido: solo a miembros
--     de esa misma comunidad (grupo cerrado; en una escuela el docente lo
--     necesita). denuncias_para_revisar() es solo para moderadores.
--   · Cada uno sigue viendo y editando su propio nombre y apellido en el
--     Perfil (tabla `perfiles`, no la vista).
--   · La regla 16+ del chat se queda en la app (decisión de Juan).
--
-- Después de correrla: npm run esquema y commit del volcado.
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

-- ── 1. Fecha de nacimiento: una sola vez ─────────────────────
-- SECURITY INVOKER a propósito: necesita el current_user de quien llama.
CREATE OR REPLACE FUNCTION _trg_fecha_nacimiento_fija()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.fecha_nacimiento IS NOT NULL
     AND NEW.fecha_nacimiento IS DISTINCT FROM OLD.fecha_nacimiento
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'La fecha de nacimiento no se puede cambiar.'
      USING ERRCODE = '42501', HINT = 'fecha_fija';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION _trg_fecha_nacimiento_fija() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_fecha_nacimiento_fija ON perfiles;
CREATE TRIGGER trg_fecha_nacimiento_fija
  BEFORE UPDATE OF fecha_nacimiento ON perfiles
  FOR EACH ROW EXECUTE FUNCTION _trg_fecha_nacimiento_fija();


-- ── 2. Sin DELETE del propio perfil ──────────────────────────
DROP POLICY IF EXISTS "Perfil propio" ON perfiles;
DROP POLICY IF EXISTS perfiles_insert_propio ON perfiles;
CREATE POLICY perfiles_insert_propio ON perfiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);


-- ── 3. perfiles_publicos sin apellido ────────────────────────
CREATE OR REPLACE VIEW public.perfiles_publicos AS
  SELECT id, nombre, NULL::text AS apellido
  FROM public.perfiles;

ALTER VIEW public.perfiles_publicos SET (security_invoker = false);

COMMENT ON VIEW public.perfiles_publicos IS
  'Nombre público de cada usuario para Foro, reseñas y chat. Solo id/nombre; apellido siempre NULL desde la 074 (la columna queda por compatibilidad). El resto de perfiles sigue siendo privado. Ver migraciones 038 y 074.';
