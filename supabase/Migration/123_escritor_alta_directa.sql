-- =============================================================
-- INMERSIA — Migración 123
-- Rincón del escritor: alta directa desde la landing, sin código
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere 120 y 121.
--
-- QUÉ HACE (Juan, 14 nov 2026)
--   · «Quiero ser escritor» ya no espera un código: con la sesión iniciada
--     (o recién creada), hacerme_escritor() activa el modo escritor al
--     momento, con saldo 0 $. El estudio le pide que escriba a Inmersia para
--     su cupón de bienvenida; ese cupón sigue siendo un código ESCR- que
--     crea Juan (121), y al canjearlo se SUMA al saldo.
--   · Queda anotado en solicitudes_escritor (ya atendida) para que Juan vea
--     quién entró: SELECT nombre, correo, creado FROM solicitudes_escritor
--     ORDER BY creado DESC;
--   · Con 0 $ solo se puede usar lo gratis (subir el libro, portada,
--     sonidos a mano, imágenes propias, editar). Nada que cueste dinero.
-- Idempotente. Después: npm run esquema y commit del volcado.
-- =============================================================

CREATE OR REPLACE FUNCTION public.hacerme_escritor()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_correo text;
  v_nombre text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tienes que entrar con tu cuenta.' USING ERRCODE = '42501', HINT = 'sin_sesion';
  END IF;

  INSERT INTO escritores (user_id, saldo_cupon) VALUES (v_uid, 0)
  ON CONFLICT (user_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'ya_era';
  END IF;

  SELECT lower(email) INTO v_correo FROM auth.users WHERE id = v_uid;
  SELECT nullif(btrim(coalesce(nombre, '') || ' ' || coalesce(apellido, '')), '')
    INTO v_nombre FROM perfiles WHERE id = v_uid;

  INSERT INTO solicitudes_escritor (nombre, correo, user_id, atendida)
  VALUES (left(coalesce(v_nombre, split_part(v_correo, '@', 1), 'Escritor'), 120),
          left(coalesce(v_correo, 'sin-correo@inmersia.io'), 254), v_uid, now());

  RETURN 'activado';
END;
$$;

REVOKE ALL ON FUNCTION public.hacerme_escritor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hacerme_escritor() TO authenticated;
