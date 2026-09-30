-- =============================================================
-- INMERSIA — Migración 055
-- crear_comunidad(): comprobaciones explícitas en vez de depender
-- de la RLS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA
-- La versión de la 054 corría como el usuario (SECURITY INVOKER) y
-- delegaba el permiso en las políticas de `comunidades`. Al probarla
-- desde la app devolvió 42501 "new row violates row-level security
-- policy for table comunidades", con un creador válido. Una causa
-- conocida es que INSERT ... RETURNING obliga a que la fila nueva pase
-- también la política de LECTURA, y una comunidad recién creada todavía
-- no tiene miembros (el trigger que mete al creador es AFTER INSERT).
-- Con varias reglas encadenadas, un rechazo así además no dice cuál
-- falló.
--
-- SOLUCIÓN
-- La función corre con los permisos de su dueño (SECURITY DEFINER) y
-- comprueba ella misma, una por una y con su propio mensaje, lo que
-- antes hacía la política comunidades_insert:
--   · hay sesión (auth.uid() no es NULL)
--   · quien llama está en creadores_comunidad
-- El tope de 5 lo sigue imponiendo el trigger de la 051, y el código
-- repetido el UNIQUE de comunidad_codigos. Nada de eso depende de la RLS.
-- El creador_id NO es un parámetro: sale de auth.uid(), así que nadie
-- puede crear una comunidad a nombre de otro.
--
-- La política comunidades_insert se queda: sigue protegiendo un INSERT
-- directo contra la API.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

CREATE OR REPLACE FUNCTION public.crear_comunidad(
  p_nombre          text,
  p_descripcion     text        DEFAULT NULL,
  p_privada         boolean     DEFAULT false,
  p_codigo          text        DEFAULT NULL,
  p_libro_id        uuid        DEFAULT NULL,
  p_fecha_meta      date        DEFAULT NULL,
  p_encuentro_lugar text        DEFAULT NULL,
  p_encuentro_fecha timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid      uuid := auth.uid();
  v_id     uuid := gen_random_uuid();
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión para crear una comunidad.'
      USING ERRCODE = '42501', HINT = 'sin_sesion';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM creadores_comunidad WHERE user_id = uid) THEN
    RAISE EXCEPTION 'Tu cuenta no tiene permiso para crear comunidades.'
      USING ERRCODE = '42501', HINT = 'sin_permiso_creador';
  END IF;

  IF p_privada AND v_codigo !~ '^[A-Z0-9]{6,20}$' THEN
    RAISE EXCEPTION 'El código debe tener entre 6 y 20 letras o números.'
      USING ERRCODE = '22023', HINT = 'codigo_formato';
  END IF;

  -- Los triggers de 051/054 hacen el resto: meter al creador como
  -- moderador, generar un código, abrir la primera lectura y el tope.
  INSERT INTO comunidades (id, nombre, descripcion, privada, libro_id, creador_id)
  VALUES (v_id, btrim(p_nombre), nullif(btrim(coalesce(p_descripcion, '')), ''), p_privada, p_libro_id, uid);

  IF p_privada THEN
    BEGIN
      UPDATE comunidad_codigos SET codigo = v_codigo WHERE comunidad_id = v_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'Ese código ya lo usa otra comunidad. Prueba con otro.'
        USING ERRCODE = '23505', HINT = 'codigo_en_uso';
    END;
  END IF;

  IF p_libro_id IS NOT NULL THEN
    UPDATE comunidad_lecturas
    SET fecha_meta      = p_fecha_meta,
        encuentro_lugar = nullif(btrim(coalesce(p_encuentro_lugar, '')), ''),
        encuentro_fecha = p_encuentro_fecha
    WHERE comunidad_id = v_id AND fin IS NULL;
  END IF;

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.crear_comunidad(text, text, boolean, text, uuid, date, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_comunidad(text, text, boolean, text, uuid, date, text, timestamptz) TO authenticated;

-- =============================================================
-- COMPROBACIÓN
--   Desde la app: crear una pública y una privada.
--   Con una cuenta que NO esté en creadores_comunidad (llamando a la
--   función desde la API) → 'Tu cuenta no tiene permiso para crear
--   comunidades.'
-- =============================================================
