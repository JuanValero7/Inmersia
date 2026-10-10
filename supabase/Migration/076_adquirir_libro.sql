-- =============================================================
-- INMERSIA — Migración 076
-- Adquirir un libro solo con adquirir_libro(), que impone el límite
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA
-- El límite de 5 lecturas pendientes (sin contar el Manual; los
-- superusuarios no tienen) solo lo comprobaba el navegador. La política
-- de INSERT de `bibliotecas_usuarios` solo mira user_id, así que la API
-- dejaba añadir libros sin límite. Y la de UPDATE dejaba cambiar el
-- libro_id de una fila propia: otra forma de "adquirir" un libro.
--
-- SOLUCIÓN
--   1. adquirir_libro(p_libro_id) → boolean: true si lo añadió, false si
--      ya lo tenía. Si se pasa del límite, error con HINT
--      'limite_pendientes'. El Manual no cuenta ni tiene límite.
--   2. Sin política de INSERT: solo se adquiere por la función (y por el
--      trigger de la 073, que corre con permisos propios).
--   3. UPDATE solo de las columnas que la app cambia: leido y categoria_id.
--
-- QUÉ NO CAMBIA
--   · El rescate de la muestra (App.rescatarMuestra) sigue en el navegador:
--     si fallara, el libro ya está en la biblioteca y empieza desde el
--     principio. No hace falta una transacción para eso.
--   · No hay DELETE (decisión ya tomada: nadie quita libros).
--   · El navegador sigue comprobando el límite antes, para responder al
--     instante; la base es la que manda.
--
-- ORDEN DE DESPLIEGUE: esta migración y el código nuevo JUNTOS. El código
-- viejo inserta directo y, sin la política, fallaría al adquirir.
-- Después de correrla: npm run esquema y commit del volcado.
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

-- ── 1. adquirir_libro() ──────────────────────────────────────
CREATE OR REPLACE FUNCTION adquirir_libro(p_libro_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_manual constant uuid := '00000000-0000-4000-8000-000000000001';  -- MANUAL_LIBRO_ID
  -- LIMITE_PENDIENTES de src/hooks/useCompraLibro.js: si cambia uno, cambiar los dos.
  v_limite constant int := 5;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta una sesión.' USING ERRCODE = '42501', HINT = 'sin_sesion';
  END IF;

  -- Dos peticiones a la vez del mismo usuario no se cuelan las dos.
  PERFORM pg_advisory_xact_lock(hashtext('adquirir_libro:' || v_uid));

  IF EXISTS (SELECT 1 FROM bibliotecas_usuarios WHERE user_id = v_uid AND libro_id = p_libro_id) THEN
    RETURN false;
  END IF;

  IF p_libro_id <> v_manual
     AND NOT EXISTS (SELECT 1 FROM superusuarios WHERE user_id = v_uid)
     AND (SELECT count(*) FROM bibliotecas_usuarios
          WHERE user_id = v_uid AND libro_id <> v_manual AND NOT coalesce(leido, false)) >= v_limite
  THEN
    RAISE EXCEPTION 'Ya tienes % lecturas pendientes.', v_limite
      USING ERRCODE = '42501', HINT = 'limite_pendientes';
  END IF;

  INSERT INTO bibliotecas_usuarios (user_id, libro_id, leido)
  VALUES (v_uid, p_libro_id, false);
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION adquirir_libro(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION adquirir_libro(uuid) TO authenticated;


-- ── 2. Sin INSERT directo ────────────────────────────────────
DROP POLICY IF EXISTS "Usuarios añaden a su biblioteca" ON bibliotecas_usuarios;


-- ── 3. UPDATE solo de leido y categoria_id ───────────────────
REVOKE UPDATE ON bibliotecas_usuarios FROM anon, authenticated;
GRANT  UPDATE (leido, categoria_id) ON bibliotecas_usuarios TO authenticated;
