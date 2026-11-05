-- =============================================================
-- INMERSIA — Migración 085
-- El libro del aula llega solo y se asigna desde el panel
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 081–084.
--
-- PROBLEMA (decisiones de Juan, 3 nov 2026: «que sea antibobo»)
--   · El alumno tenía que ir a la Tienda a agregar el libro del aula; si
--     tenía 5 pendientes, el límite (076) no lo dejaba. El profe veía
--     «Sin empezar» sin saber por qué.
--   · Elegir libro y fecha meta estaba escondido en Comunidades.
--
-- SOLUCIÓN
--   1. bibliotecas_usuarios.de_aula: el libro llegó por un aula. Los libros
--      del aula no cuentan para el límite de 5 (adquirir_libro y la app).
--   2. Cuando un aula empieza una lectura (trigger sobre comunidad_lecturas),
--      el libro se agrega a la biblioteca de todos sus miembros. Si alguien
--      ya lo tenía, se marca de_aula y deja de contar para el límite.
--   3. Quien entra a un aula que ya tiene libro (canjear_codigo) lo recibe
--      en ese momento.
--   4. asignar_lectura(): el profe del aula o la administración eligen
--      libro y fecha meta desde el panel, en un paso.
--   Nadie puede quitar libros de su biblioteca (076), así que no se pierde.
--
-- Idempotente. Después: npm run esquema y commit del volcado.
-- =============================================================


-- ── 1. Libros que llegaron por un aula ───────────────────────
ALTER TABLE public.bibliotecas_usuarios
  ADD COLUMN IF NOT EXISTS de_aula boolean NOT NULL DEFAULT false;


-- ── 2. Dar el libro actual del aula (a todos, o a uno) ───────
CREATE OR REPLACE FUNCTION public._dar_libro_aula(p_aula uuid, p_user uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_libro uuid;
BEGIN
  SELECT cl.libro_id INTO v_libro
  FROM comunidad_lecturas cl JOIN comunidades co ON co.id = cl.comunidad_id
  WHERE cl.comunidad_id = p_aula AND cl.fin IS NULL AND co.colegio_id IS NOT NULL
  LIMIT 1;
  IF v_libro IS NULL THEN RETURN; END IF;

  INSERT INTO bibliotecas_usuarios (user_id, libro_id, leido, de_aula)
  SELECT m.user_id, v_libro, false, true
  FROM comunidad_miembros m
  WHERE m.comunidad_id = p_aula AND (p_user IS NULL OR m.user_id = p_user)
  ON CONFLICT (user_id, libro_id) DO UPDATE SET de_aula = true;
END;
$fn$;

REVOKE ALL ON FUNCTION public._dar_libro_aula(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Al empezar una lectura (la abre el trigger de la 054 al cambiar libro_id).
CREATE OR REPLACE FUNCTION public._lectura_aula_dar_libro()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM _dar_libro_aula(NEW.comunidad_id);
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_lectura_aula_dar_libro ON public.comunidad_lecturas;
CREATE TRIGGER trg_lectura_aula_dar_libro
  AFTER INSERT ON public.comunidad_lecturas
  FOR EACH ROW EXECUTE FUNCTION public._lectura_aula_dar_libro();

REVOKE ALL ON FUNCTION public._lectura_aula_dar_libro() FROM PUBLIC, anon, authenticated;

-- Las aulas que ya tienen lectura cuando corre esta migración.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT cl.comunidad_id FROM comunidad_lecturas cl
           JOIN comunidades co ON co.id = cl.comunidad_id
           WHERE cl.fin IS NULL AND co.colegio_id IS NOT NULL
  LOOP
    PERFORM _dar_libro_aula(r.comunidad_id);
  END LOOP;
END $$;


-- ── 3. Límite de pendientes: los libros del aula no cuentan ──
-- Igual que en la 076, salvo «AND NOT de_aula».
CREATE OR REPLACE FUNCTION public.adquirir_libro(p_libro_id uuid)
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
          WHERE user_id = v_uid AND libro_id <> v_manual AND NOT coalesce(leido, false) AND NOT de_aula) >= v_limite
  THEN
    RAISE EXCEPTION 'Ya tienes % lecturas pendientes.', v_limite
      USING ERRCODE = '42501', HINT = 'limite_pendientes';
  END IF;

  INSERT INTO bibliotecas_usuarios (user_id, libro_id, leido)
  VALUES (v_uid, p_libro_id, false);
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adquirir_libro(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.adquirir_libro(uuid) TO authenticated;


-- ── 4. canjear_codigo: igual que en la 082, y da el libro del aula ──
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
    PERFORM _dar_libro_aula(r.comunidad_id, uid);

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
  PERFORM _dar_libro_aula(v_comunidad, uid);

  RETURN jsonb_build_object('tipo', 'alumno', 'colegio_id', v_colegio, 'comunidad_id', v_comunidad);
END;
$fn$;

REVOKE ALL ON FUNCTION public.canjear_codigo(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canjear_codigo(text, text) TO authenticated;


-- ── 5. Asignar libro y fecha meta desde el panel ─────────────
-- El profe del aula o la administración. Si el libro cambia, el trigger
-- de la 054 cierra la lectura anterior y abre la nueva (y el de arriba se
-- la da a todos). Después se pone la fecha meta de la lectura actual.
CREATE OR REPLACE FUNCTION public.asignar_lectura(p_aula uuid, p_libro uuid, p_fecha_meta date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM comunidades WHERE id = p_aula AND colegio_id IS NOT NULL)
     OR NOT (es_admin_de_aula(p_aula) OR es_moderador(p_aula)) THEN
    RAISE EXCEPTION 'Solo el profesor del aula o la administración pueden asignar la lectura.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM libros WHERE id = p_libro AND visible) THEN
    RAISE EXCEPTION 'Ese libro no está en el catálogo.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;

  UPDATE comunidades SET libro_id = p_libro
  WHERE id = p_aula AND libro_id IS DISTINCT FROM p_libro;

  UPDATE comunidad_lecturas SET fecha_meta = p_fecha_meta
  WHERE comunidad_id = p_aula AND fin IS NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.asignar_lectura(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.asignar_lectura(uuid, uuid, date) TO authenticated;


-- =============================================================
-- COMPROBACIÓN
--   1. Profe: SELECT asignar_lectura('<aula>', '<libro>', '2026-12-01');
--      → todos los alumnos del aula tienen el libro, con de_aula = true:
--        SELECT user_id, de_aula FROM bibliotecas_usuarios WHERE libro_id = '<libro>';
--   2. Un alumno con 5 pendientes entra al aula → recibe el libro igual.
--   3. Ese alumno agrega otro libro desde la Tienda: el del aula no cuenta.
--   4. Un alumno (no profe) llama a asignar_lectura → 'Solo el profesor…'.
-- =============================================================
