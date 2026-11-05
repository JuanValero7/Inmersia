-- =============================================================
-- INMERSIA — Migración 082
-- Al aula se entra con nombre y apellido (decisión de Juan, 3 nov 2026)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 081.
--
-- CAMBIO
--   · canjear_codigo(): con un código de aula, sin nombre_en_aula no se
--     entra (HINT 'falta_nombre_aula'). La app lo pide antes con dos
--     campos, nombre y apellido, rellenos con lo que tenga el perfil.
--     Si ya estaba dentro, vuelve a canjear para corregir su nombre.
--   · unirse_con_codigo() (la de la 051, que usa la app vieja) ya no
--     deja entrar a un aula: así nadie se cuela sin nombre por la API.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ── 1. unirse_con_codigo: igual que en la 051, salvo las aulas.
CREATE OR REPLACE FUNCTION public.unirse_con_codigo(p_codigo text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid uuid := auth.uid();
  v_comunidad uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.';
  END IF;

  SELECT comunidad_id INTO v_comunidad
  FROM comunidad_codigos
  WHERE codigo = upper(btrim(p_codigo));

  IF v_comunidad IS NULL THEN
    RAISE EXCEPTION 'El código no es válido.' USING ERRCODE = 'P0002', HINT = 'codigo_invalido';
  END IF;

  IF EXISTS (SELECT 1 FROM comunidades WHERE id = v_comunidad AND colegio_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Para entrar a un aula hacen falta tu nombre y apellido.'
      USING ERRCODE = 'P0001', HINT = 'falta_nombre_aula';
  END IF;

  -- Antes del INSERT: si ya estaba dentro, el trigger del tope no debe
  -- saltar por una comunidad que ya cuenta.
  IF NOT EXISTS (SELECT 1 FROM comunidad_miembros WHERE comunidad_id = v_comunidad AND user_id = uid) THEN
    INSERT INTO comunidad_miembros (comunidad_id, user_id, rol)
    VALUES (v_comunidad, uid, 'miembro');
  END IF;

  RETURN v_comunidad;
END;
$fn$;


-- ── 2. canjear_codigo: el aula entra por aquí y solo con nombre.
CREATE OR REPLACE FUNCTION public.canjear_codigo(p_codigo text, p_nombre_en_aula text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid         uuid := auth.uid();
  v_codigo    text := upper(btrim(p_codigo));
  v_nombre    text := nullif(btrim(regexp_replace(coalesce(p_nombre_en_aula, ''), '\s+', ' ', 'g')), '');
  r           colegio_codigos%ROWTYPE;
  v_comunidad uuid;
  v_colegio   uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.';
  END IF;

  -- Códigos del colegio (llevan guion).
  IF position('-' IN v_codigo) > 0 THEN
    SELECT * INTO r FROM colegio_codigos
    WHERE codigo = v_codigo AND (expira_at IS NULL OR expira_at > now());

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El código no es válido.' USING ERRCODE = 'P0002', HINT = 'codigo_invalido';
    END IF;

    IF r.tipo = 'admin' THEN
      INSERT INTO colegio_admins (colegio_id, user_id) VALUES (r.colegio_id, uid)
      ON CONFLICT DO NOTHING;
      DELETE FROM colegio_codigos WHERE codigo = v_codigo;   -- un solo uso
      RETURN jsonb_build_object('tipo', 'admin', 'colegio_id', r.colegio_id);
    END IF;

    -- Profesor: si ya estaba en el aula como alumno, pasa a moderador.
    INSERT INTO comunidad_miembros (comunidad_id, user_id, rol)
    VALUES (r.comunidad_id, uid, 'moderador')
    ON CONFLICT (comunidad_id, user_id) DO UPDATE SET rol = 'moderador';

    RETURN jsonb_build_object('tipo', 'profesor', 'colegio_id', r.colegio_id, 'comunidad_id', r.comunidad_id);
  END IF;

  -- ¿Aula o comunidad normal?
  SELECT cc.comunidad_id, co.colegio_id INTO v_comunidad, v_colegio
  FROM comunidad_codigos cc JOIN comunidades co ON co.id = cc.comunidad_id
  WHERE cc.codigo = v_codigo;

  IF v_comunidad IS NULL THEN
    RAISE EXCEPTION 'El código no es válido.' USING ERRCODE = 'P0002', HINT = 'codigo_invalido';
  END IF;

  IF v_colegio IS NULL THEN
    PERFORM unirse_con_codigo(v_codigo);
    RETURN jsonb_build_object('tipo', 'comunidad', 'colegio_id', NULL, 'comunidad_id', v_comunidad);
  END IF;

  -- Aula. La app avisa con el HINT y muestra los campos de nombre.
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'Para entrar a un aula hacen falta tu nombre y apellido.'
      USING ERRCODE = 'P0001', HINT = 'falta_nombre_aula';
  END IF;

  -- Si ya estaba (alumno o profe), solo se corrige el nombre; el rol no cambia.
  INSERT INTO comunidad_miembros (comunidad_id, user_id, rol, nombre_en_aula)
  VALUES (v_comunidad, uid, 'miembro', v_nombre)
  ON CONFLICT (comunidad_id, user_id) DO UPDATE SET nombre_en_aula = EXCLUDED.nombre_en_aula;

  RETURN jsonb_build_object('tipo', 'alumno', 'colegio_id', v_colegio, 'comunidad_id', v_comunidad);
END;
$fn$;

REVOKE ALL ON FUNCTION public.unirse_con_codigo(text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.canjear_codigo(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unirse_con_codigo(text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.canjear_codigo(text, text) TO authenticated;


-- =============================================================
-- COMPROBACIÓN
--   1. E: SELECT canjear_codigo('<código de aula>');
--      → 'Para entrar a un aula hacen falta tu nombre y apellido.'
--   2. E: SELECT unirse_con_codigo('<código de aula>');  → mismo error.
--   3. E: SELECT canjear_codigo('<código de aula>', 'Ana  Pérez ');
--      → tipo 'alumno'; en lista_colegio aparece «Ana Pérez».
--   4. Un club normal sigue entrando con unirse_con_codigo() y con
--      canjear_codigo() sin nombre.
-- =============================================================
