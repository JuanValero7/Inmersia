-- =============================================================
-- INMERSIA — Migración 073
-- El perfil y el Manual del Explorador los crea la base al registrarse
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA
-- Hoy la fila de `perfiles` y el Manual en `bibliotecas_usuarios` los
-- crea el navegador (src/lib/ensureProfile.js) en cada SIGNED_IN. Si el
-- navegador no llega a hacerlo (pestaña cerrada, red caída, confirmación
-- de correo en otro dispositivo), la cuenta queda sin perfil hasta que
-- vuelva a entrar. Hay una cuenta de abril de 2026 en ese estado.
--
-- SOLUCIÓN
--   1. _crear_perfil(user_id, metadata): la misma lógica de nombres que
--      ensureProfile. Correo: `nombre`/`apellido`. Google: `given_name`/
--      `family_name`, o `full_name` partido (primera palabra = nombre).
--      `fecha_nacimiento` solo si es una fecha válida (Google no la trae;
--      la pide CompletarCuenta). `genero` solo si es uno de los valores
--      del CHECK (ya no se pide; cuentas antiguas).
--   2. _asignar_manual(user_id): mete el Manual en su biblioteca.
--   3. Trigger AFTER INSERT ON auth.users que llama a las dos, cada una
--      en su propio bloque EXCEPTION. Un error aquí NUNCA tumba el
--      registro (Supabase devolvería "Database error saving new user"):
--      queda un WARNING en los logs de Postgres y ensureProfile lo repara
--      en el siguiente inicio de sesión.
--   4. Relleno de las cuentas existentes sin perfil o sin Manual.
--
-- QUÉ NO CAMBIA
--   · ensureProfile.js se queda como red de seguridad: hace SELECT antes
--     de insertar, así que con el trigger simplemente no encuentra nada
--     que hacer. El onboarding sigue esperando su promesa.
--   · Las políticas de `perfiles` y `bibliotecas_usuarios`.
--   · Ambas inserciones son ON CONFLICT DO NOTHING: si el navegador gana
--     la carrera, no pasa nada.
--
-- Después de correrla: npm run esquema y commit del volcado.
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

-- ── 1. Perfil a partir de raw_user_meta_data ─────────────────
CREATE OR REPLACE FUNCTION _crear_perfil(p_user_id uuid, p_meta jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completo text   := btrim(coalesce(nullif(p_meta->>'full_name', ''), p_meta->>'name', ''));
  v_partes   text[] := regexp_split_to_array(v_completo, '\s+');
  v_fecha    date;
  v_genero   text   := p_meta->>'genero';
BEGIN
  BEGIN
    v_fecha := nullif(p_meta->>'fecha_nacimiento', '')::date;
  EXCEPTION WHEN others THEN
    v_fecha := NULL;
  END;

  IF v_genero NOT IN ('masculino', 'femenino', 'diverso') THEN
    v_genero := NULL;
  END IF;

  INSERT INTO perfiles (id, nombre, apellido, fecha_nacimiento, genero)
  VALUES (
    p_user_id,
    coalesce(nullif(p_meta->>'nombre', ''), nullif(p_meta->>'given_name', ''), v_partes[1], ''),
    coalesce(nullif(p_meta->>'apellido', ''), nullif(p_meta->>'family_name', ''),
             array_to_string(v_partes[2:], ' ')),
    v_fecha,
    v_genero
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;


-- ── 2. Manual del Explorador ─────────────────────────────────
-- El id es MANUAL_LIBRO_ID de src/lib/constants.js.
CREATE OR REPLACE FUNCTION _asignar_manual(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO bibliotecas_usuarios (user_id, libro_id, leido)
  VALUES (p_user_id, '00000000-0000-4000-8000-000000000001', false)
  ON CONFLICT (user_id, libro_id) DO NOTHING;
END;
$$;


-- ── 3. Trigger en auth.users ─────────────────────────────────
CREATE OR REPLACE FUNCTION _trg_perfil_al_registrarse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM _crear_perfil(NEW.id, coalesce(NEW.raw_user_meta_data, '{}'::jsonb));
  EXCEPTION WHEN others THEN
    RAISE WARNING '_crear_perfil(%): % %', NEW.id, SQLSTATE, SQLERRM;
  END;

  BEGIN
    PERFORM _asignar_manual(NEW.id);
  EXCEPTION WHEN others THEN
    RAISE WARNING '_asignar_manual(%): % %', NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_perfil_al_registrarse ON auth.users;
CREATE TRIGGER trg_perfil_al_registrarse
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION _trg_perfil_al_registrarse();

-- Nadie las llama por RPC: solo el trigger y el relleno de abajo.
REVOKE EXECUTE ON FUNCTION _crear_perfil(uuid, jsonb)     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION _asignar_manual(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION _trg_perfil_al_registrarse()   FROM PUBLIC, anon, authenticated;


-- ── 4. Relleno de cuentas existentes ─────────────────────────
SELECT _crear_perfil(u.id, coalesce(u.raw_user_meta_data, '{}'::jsonb))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM perfiles p WHERE p.id = u.id);

SELECT _asignar_manual(u.id)
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM bibliotecas_usuarios b
  WHERE b.user_id = u.id AND b.libro_id = '00000000-0000-4000-8000-000000000001'
);
