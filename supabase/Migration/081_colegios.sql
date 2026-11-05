-- =============================================================
-- INMERSIA — Migración 081
-- Colegios: cuenta colegio, administradores, aulas y profesores
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- MODELO (decisiones de Juan, 3 nov 2026)
--   · Juan crea el colegio con crear_colegio() desde el SQL Editor y
--     le pasa al colegio el código de administrador que devuelve.
--   · Administrador: canjea un código ADMIN-… (un solo uso, caduca).
--     Ve todas las aulas, crea y borra aulas, saca a cualquiera de un
--     aula, cambia códigos y suma o quita administradores. Siempre
--     queda al menos uno: no hace falta escribirle a soporte.
--   · Aula = comunidad privada con `colegio_id`. Solo la crea el
--     administrador (crear_aula). Tiene dos códigos:
--       – de alumnos (el de siempre, comunidad_codigos): entra como miembro.
--       – de profesor (PROF-…, colegio_codigos): entra como moderador.
--     Cambiar un código cierra la puerta; quien ya entró sigue dentro.
--     Para sacar a alguien está el botón de quitar, persona por persona.
--   · Profesor = moderador de un aula del colegio. No hay tabla de
--     profesores: se deduce de las aulas, así no hay nada que sincronizar.
--     Sin tope de profesores; ve solo sus aulas. Se cobra por alumno.
--   · Las aulas no cuentan para el tope de 5 comunidades, no heredan
--     moderador (un alumno nunca pasa a moderar el aula) y no se borran
--     solas si se vacían. El colegio nunca ve los clubes personales.
--   · Nombre en el aula: al entrar con el código del aula el alumno
--     puede dar su nombre tal como figura en la lista del colegio
--     (desde la 074 el registro solo pide el nombre, y tres «María»
--     no le sirven al profesor).
--
-- CÓDIGOS
--   Los del colegio llevan guion (ADMIN-XXXXXXXX, PROF-XXXXXXXX); los de
--   comunidad no pueden llevarlo (comunidad_codigos_formato), así que
--   nunca se confunden. canjear_codigo() acepta los tres tipos: la app
--   puede tener un solo campo «Tengo un código».
--
-- PRIVACIDAD
--   Esta migración solo da nombres y cantidades (la Lista). Los datos
--   de lectura del panel (Salón, Colegio) van en la siguiente, con la
--   regla de siempre: JAMÁS lo que el alumno escribe en privado.
--
-- RGPD
--   Todo cuelga de auth.users con ON DELETE CASCADE: eliminar_mi_cuenta()
--   (043) se lo lleva. Pendiente fuera del SQL: nombre_en_aula en
--   misDatos.js y en la política de privacidad (el colegio pasa a ser
--   responsable de los datos de sus alumnos; Inmersia, encargada).
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═════════════════════════════════════════════════════════════

-- estado: informativo por ahora (piloto gratis / cobrando / se fue).
CREATE TABLE IF NOT EXISTS public.colegios (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 120),
  pais       text        NOT NULL CHECK (char_length(btrim(pais)) BETWEEN 2 AND 60),
  ciudad     text        CHECK (ciudad IS NULL OR char_length(btrim(ciudad)) <= 80),
  estado     text        NOT NULL DEFAULT 'piloto' CHECK (estado IN ('piloto', 'activo', 'baja')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.colegio_admins (
  colegio_id uuid        NOT NULL REFERENCES public.colegios(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (colegio_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_colegio_admins_user
  ON public.colegio_admins (user_id);

-- Sin acceso directo desde la app: todo pasa por las funciones de la
-- sección 5, que deciden quién ve cada código.
CREATE TABLE IF NOT EXISTS public.colegio_codigos (
  codigo       text        PRIMARY KEY CHECK (codigo ~ '^(ADMIN|PROF)-[A-Z0-9]{8}$'),
  colegio_id   uuid        NOT NULL REFERENCES public.colegios(id) ON DELETE CASCADE,
  tipo         text        NOT NULL CHECK (tipo IN ('admin', 'profesor')),
  comunidad_id uuid        REFERENCES public.comunidades(id) ON DELETE CASCADE,
  expira_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((tipo = 'profesor') = (comunidad_id IS NOT NULL))
);

-- Un solo código de profesor vivo por aula.
CREATE UNIQUE INDEX IF NOT EXISTS uq_colegio_codigos_profesor
  ON public.colegio_codigos (comunidad_id) WHERE tipo = 'profesor';

-- Las aulas son comunidades con colegio.
ALTER TABLE public.comunidades
  ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS grado      text CHECK (grado   IS NULL OR char_length(btrim(grado))   BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS seccion    text CHECK (seccion IS NULL OR char_length(btrim(seccion)) BETWEEN 1 AND 20);

-- Un aula siempre es privada: si el profesor la hiciera pública, se
-- podría entrar sin código.
ALTER TABLE public.comunidades DROP CONSTRAINT IF EXISTS comunidades_aula_privada;
ALTER TABLE public.comunidades
  ADD CONSTRAINT comunidades_aula_privada CHECK (colegio_id IS NULL OR privada);

CREATE UNIQUE INDEX IF NOT EXISTS uq_comunidades_aula_nombre
  ON public.comunidades (colegio_id, nombre) WHERE colegio_id IS NOT NULL;

ALTER TABLE public.comunidad_miembros
  ADD COLUMN IF NOT EXISTS nombre_en_aula text
    CHECK (nombre_en_aula IS NULL OR char_length(btrim(nombre_en_aula)) BETWEEN 1 AND 80);


-- ═════════════════════════════════════════════════════════════
-- 2. Funciones auxiliares
-- ═════════════════════════════════════════════════════════════
-- SECURITY DEFINER por lo mismo que es_miembro() (051): las usan las
-- políticas y no deben entrar en recursión de RLS. Siempre auth.uid().

CREATE OR REPLACE FUNCTION public.es_admin_colegio(c uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM colegio_admins
    WHERE colegio_id = c AND user_id = auth.uid()
  );
$fn$;

-- ¿Soy administrador del colegio dueño de esta aula?
CREATE OR REPLACE FUNCTION public.es_admin_de_aula(a uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM comunidades co
    JOIN colegio_admins ca ON ca.colegio_id = co.colegio_id
    WHERE co.id = a AND ca.user_id = auth.uid()
  );
$fn$;

-- ¿Soy profesor (moderador de al menos un aula) de este colegio?
CREATE OR REPLACE FUNCTION public.es_profesor_colegio(c uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM comunidades co
    JOIN comunidad_miembros m ON m.comunidad_id = co.id
    WHERE co.colegio_id = c AND m.user_id = auth.uid() AND m.rol = 'moderador'
  );
$fn$;

CREATE OR REPLACE FUNCTION public._codigo_colegio(prefijo text)
RETURNS text
LANGUAGE sql VOLATILE
AS $fn$
  SELECT prefijo || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$fn$;

REVOKE ALL ON FUNCTION public.es_admin_colegio(uuid)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.es_admin_de_aula(uuid)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.es_profesor_colegio(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._codigo_colegio(text)     FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin_colegio(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin_de_aula(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_profesor_colegio(uuid) TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- 3. Triggers
-- ═════════════════════════════════════════════════════════════

-- ── 3a. Reemplaza el de la 051. Comunidad normal: igual que antes.
--        Aula: nadie entra al crearla (el administrador no es miembro)
--        y se generan sus dos códigos.
CREATE OR REPLACE FUNCTION public._comunidad_al_crear()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.colegio_id IS NULL THEN
    INSERT INTO comunidad_miembros (comunidad_id, user_id, rol)
    VALUES (NEW.id, NEW.creador_id, 'moderador');
  END IF;

  INSERT INTO comunidad_codigos (comunidad_id) VALUES (NEW.id);

  IF NEW.colegio_id IS NOT NULL THEN
    INSERT INTO colegio_codigos (codigo, colegio_id, tipo, comunidad_id)
    VALUES (_codigo_colegio('PROF'), NEW.colegio_id, 'profesor', NEW.id);
  END IF;
  RETURN NULL;
END;
$fn$;

-- ── 3b. Reemplaza el de la 051: las aulas no cuentan para el tope de
--        5, ni la que se entra ni las que uno ya tiene.
CREATE OR REPLACE FUNCTION public._comunidad_tope_miembro()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  TOPE_COMUNIDADES CONSTANT int := 5;
BEGIN
  IF EXISTS (SELECT 1 FROM comunidades WHERE id = NEW.comunidad_id AND colegio_id IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  IF (
    SELECT count(*) FROM comunidad_miembros m
    JOIN comunidades c ON c.id = m.comunidad_id
    WHERE m.user_id = NEW.user_id AND c.colegio_id IS NULL
  ) >= TOPE_COMUNIDADES THEN
    RAISE EXCEPTION 'Ya estás en % comunidades, el máximo permitido.', TOPE_COMUNIDADES
      USING ERRCODE = 'P0001', HINT = 'tope_comunidades';
  END IF;
  RETURN NEW;
END;
$fn$;

-- ── 3c. Reemplaza el de la 051: un aula no hereda moderador ni se
--        borra al vaciarse. La decide el administrador.
CREATE OR REPLACE FUNCTION public._comunidad_tras_baja()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  heredero uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM comunidades WHERE id = OLD.comunidad_id) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM comunidades WHERE id = OLD.comunidad_id AND colegio_id IS NOT NULL) THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM comunidad_miembros WHERE comunidad_id = OLD.comunidad_id) THEN
    DELETE FROM comunidades WHERE id = OLD.comunidad_id;
    RETURN NULL;
  END IF;

  IF OLD.rol = 'moderador' AND NOT EXISTS (
    SELECT 1 FROM comunidad_miembros
    WHERE comunidad_id = OLD.comunidad_id AND rol = 'moderador'
  ) THEN
    SELECT user_id INTO heredero
    FROM comunidad_miembros
    WHERE comunidad_id = OLD.comunidad_id
    ORDER BY unido_at, user_id
    LIMIT 1;

    UPDATE comunidad_miembros SET rol = 'moderador'
    WHERE comunidad_id = OLD.comunidad_id AND user_id = heredero;
  END IF;

  RETURN NULL;
END;
$fn$;

-- ── 3d. Siempre queda al menos un administrador.
--        Solo frena a la app (auth.uid() presente): desde el SQL Editor
--        Juan puede arreglar lo que haga falta. Tampoco frena el CASCADE
--        de borrar la cuenta (el usuario ya no está en auth.users) ni el
--        de borrar el colegio: ese es el único caso que llega a soporte.
CREATE OR REPLACE FUNCTION public._colegio_ultimo_admin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id)
     AND EXISTS (SELECT 1 FROM colegios WHERE id = OLD.colegio_id)
     AND NOT EXISTS (
       SELECT 1 FROM colegio_admins
       WHERE colegio_id = OLD.colegio_id AND user_id <> OLD.user_id
     ) THEN
    RAISE EXCEPTION 'El colegio tiene que quedar con al menos un administrador.'
      USING ERRCODE = 'P0001', HINT = 'ultimo_admin';
  END IF;
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_colegio_ultimo_admin ON public.colegio_admins;
CREATE TRIGGER trg_colegio_ultimo_admin
  BEFORE DELETE ON public.colegio_admins
  FOR EACH ROW EXECUTE FUNCTION public._colegio_ultimo_admin();

REVOKE ALL ON FUNCTION public._colegio_ultimo_admin() FROM PUBLIC, anon, authenticated;


-- ═════════════════════════════════════════════════════════════
-- 4. RLS
-- ═════════════════════════════════════════════════════════════
ALTER TABLE public.colegios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colegio_admins  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colegio_codigos ENABLE ROW LEVEL SECURITY;
-- colegio_codigos: sin políticas a propósito → la app no la toca.

-- ── colegios: lo ven sus administradores y sus profesores ───
DROP POLICY IF EXISTS "colegios_select" ON public.colegios;
CREATE POLICY "colegios_select"
  ON public.colegios FOR SELECT TO authenticated
  USING (es_admin_colegio(id) OR es_profesor_colegio(id) OR es_superusuario());

-- ── colegio_admins: se ven y se quitan entre administradores ─
--    Se entra solo canjeando un código (canjear_codigo).
DROP POLICY IF EXISTS "colegio_admins_select" ON public.colegio_admins;
CREATE POLICY "colegio_admins_select"
  ON public.colegio_admins FOR SELECT TO authenticated
  USING (es_admin_colegio(colegio_id) OR es_superusuario());

DROP POLICY IF EXISTS "colegio_admins_delete" ON public.colegio_admins;
CREATE POLICY "colegio_admins_delete"
  ON public.colegio_admins FOR DELETE TO authenticated
  USING (es_admin_colegio(colegio_id) OR es_superusuario());

-- ── comunidades: reemplazan las de la 051 ───────────────────
-- El administrador ve las aulas de su colegio sin ser miembro.
DROP POLICY IF EXISTS "comunidades_select" ON public.comunidades;
CREATE POLICY "comunidades_select"
  ON public.comunidades FOR SELECT TO authenticated
  USING (NOT privada OR es_miembro(id) OR es_admin_colegio(colegio_id) OR es_superusuario());

-- Las aulas solo se crean con crear_aula(): un creador de comunidades
-- no puede colar una en un colegio ajeno.
DROP POLICY IF EXISTS "comunidades_insert" ON public.comunidades;
CREATE POLICY "comunidades_insert"
  ON public.comunidades FOR INSERT TO authenticated
  WITH CHECK (
    creador_id = (SELECT auth.uid())
    AND colegio_id IS NULL
    AND EXISTS (SELECT 1 FROM public.creadores_comunidad cc WHERE cc.user_id = (SELECT auth.uid()))
  );

-- Un aula la borra el administrador, nunca el profesor.
DROP POLICY IF EXISTS "comunidades_delete" ON public.comunidades;
CREATE POLICY "comunidades_delete"
  ON public.comunidades FOR DELETE TO authenticated
  USING (
    (colegio_id IS NULL AND es_moderador(id))
    OR es_admin_colegio(colegio_id)
    OR es_superusuario()
  );

-- colegio_id, grado y seccion quedan fuera del GRANT UPDATE de la 051
-- (nombre, descripcion, privada, libro_id): el profesor no los cambia.

-- ── comunidad_miembros: el administrador ve y saca gente de sus aulas ──
-- El SELECT hace falta también para el DELETE: Postgres solo borra
-- filas que la política deja ver.
DROP POLICY IF EXISTS "comunidad_miembros_select" ON public.comunidad_miembros;
CREATE POLICY "comunidad_miembros_select"
  ON public.comunidad_miembros FOR SELECT TO authenticated
  USING (es_miembro(comunidad_id) OR es_admin_de_aula(comunidad_id) OR es_superusuario());

DROP POLICY IF EXISTS "comunidad_miembros_delete" ON public.comunidad_miembros;
CREATE POLICY "comunidad_miembros_delete"
  ON public.comunidad_miembros FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR es_moderador(comunidad_id)
    OR es_admin_de_aula(comunidad_id)
    OR es_superusuario()
  );


-- ═════════════════════════════════════════════════════════════
-- 5. Funciones
-- ═════════════════════════════════════════════════════════════

-- ── 5a. Crear un colegio (SOLO Juan, desde el SQL Editor).
--        Devuelve el código del primer administrador (30 días).
--          SELECT crear_colegio('Colegio San Agustín', 'Perú', 'Lima');
CREATE OR REPLACE FUNCTION public.crear_colegio(p_nombre text, p_pais text, p_ciudad text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_colegio uuid;
  v_codigo  text := _codigo_colegio('ADMIN');
BEGIN
  INSERT INTO colegios (nombre, pais, ciudad)
  VALUES (btrim(p_nombre), btrim(p_pais), nullif(btrim(p_ciudad), ''))
  RETURNING id INTO v_colegio;

  INSERT INTO colegio_codigos (codigo, colegio_id, tipo, expira_at)
  VALUES (v_codigo, v_colegio, 'admin', now() + interval '30 days');

  RETURN v_codigo;
END;
$fn$;

-- ── 5b. Canjear cualquier código: administrador, profesor o aula/comunidad.
--        p_nombre_en_aula: solo se usa al entrar a un aula como alumno.
--        Devuelve {tipo, colegio_id, comunidad_id}; tipo ∈
--        'admin' | 'profesor' | 'alumno' | 'comunidad'.
CREATE OR REPLACE FUNCTION public.canjear_codigo(p_codigo text, p_nombre_en_aula text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid         uuid := auth.uid();
  v_codigo    text := upper(btrim(p_codigo));
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

  -- Código de comunidad o de aula: el camino de siempre.
  v_comunidad := unirse_con_codigo(v_codigo);
  SELECT colegio_id INTO v_colegio FROM comunidades WHERE id = v_comunidad;

  IF v_colegio IS NOT NULL AND nullif(btrim(p_nombre_en_aula), '') IS NOT NULL THEN
    UPDATE comunidad_miembros SET nombre_en_aula = btrim(p_nombre_en_aula)
    WHERE comunidad_id = v_comunidad AND user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'tipo', CASE WHEN v_colegio IS NULL THEN 'comunidad' ELSE 'alumno' END,
    'colegio_id', v_colegio,
    'comunidad_id', v_comunidad
  );
END;
$fn$;

-- ── 5c. Invitar a otro administrador: código de un uso, 7 días.
CREATE OR REPLACE FUNCTION public.invitar_admin(p_colegio uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_codigo text := _codigo_colegio('ADMIN');
BEGIN
  IF NOT es_admin_colegio(p_colegio) THEN
    RAISE EXCEPTION 'Solo un administrador del colegio puede invitar a otro.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM colegio_codigos WHERE expira_at < now();

  INSERT INTO colegio_codigos (codigo, colegio_id, tipo, expira_at)
  VALUES (v_codigo, p_colegio, 'admin', now() + interval '7 days');

  RETURN v_codigo;
END;
$fn$;

-- ── 5d. Crear un aula (solo administrador). Nombre = «grado sección».
CREATE OR REPLACE FUNCTION public.crear_aula(p_colegio uuid, p_grado text, p_seccion text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_grado   text := btrim(p_grado);
  v_seccion text := nullif(btrim(p_seccion), '');
  v_nombre  text := btrim(concat_ws(' ', btrim(p_grado), nullif(btrim(p_seccion), '')));
  v_aula    uuid;
BEGIN
  IF NOT es_admin_colegio(p_colegio) THEN
    RAISE EXCEPTION 'Solo un administrador del colegio puede crear aulas.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM comunidades WHERE colegio_id = p_colegio AND nombre = v_nombre) THEN
    RAISE EXCEPTION 'Ya existe un aula «%».', v_nombre USING ERRCODE = 'P0001', HINT = 'aula_repetida';
  END IF;

  INSERT INTO comunidades (nombre, privada, creador_id, colegio_id, grado, seccion)
  VALUES (v_nombre, true, auth.uid(), p_colegio, v_grado, v_seccion)
  RETURNING id INTO v_aula;

  RETURN v_aula;
END;
$fn$;

-- ── 5e. Cambiar el código de alumnos. Reemplaza el de la 051: ahora
--        también puede el administrador del colegio.
CREATE OR REPLACE FUNCTION public.regenerar_codigo(p_comunidad uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_codigo text;
BEGIN
  IF NOT (es_moderador(p_comunidad) OR es_admin_de_aula(p_comunidad)) THEN
    RAISE EXCEPTION 'Solo el moderador puede cambiar el código.' USING ERRCODE = '42501';
  END IF;

  UPDATE comunidad_codigos
  SET codigo = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  WHERE comunidad_id = p_comunidad
  RETURNING codigo INTO v_codigo;

  RETURN v_codigo;
END;
$fn$;

-- ── 5f. Cambiar el código de profesor de un aula (solo administrador).
CREATE OR REPLACE FUNCTION public.regenerar_codigo_profesor(p_aula uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_codigo text;
BEGIN
  IF NOT es_admin_de_aula(p_aula) THEN
    RAISE EXCEPTION 'Solo un administrador del colegio puede cambiar este código.' USING ERRCODE = '42501';
  END IF;

  UPDATE colegio_codigos SET codigo = _codigo_colegio('PROF')
  WHERE comunidad_id = p_aula AND tipo = 'profesor'
  RETURNING codigo INTO v_codigo;

  RETURN v_codigo;
END;
$fn$;

-- ── 5g. Mis colegios: para saber si la app enseña el panel y con qué rol.
CREATE OR REPLACE FUNCTION public.mis_colegios()
RETURNS TABLE (colegio_id uuid, nombre text, rol text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT c.id, c.nombre, 'admin'
  FROM colegio_admins ca JOIN colegios c ON c.id = ca.colegio_id
  WHERE ca.user_id = auth.uid()
  UNION
  SELECT DISTINCT c.id, c.nombre, 'profesor'
  FROM comunidad_miembros m
  JOIN comunidades co ON co.id = m.comunidad_id
  JOIN colegios c     ON c.id = co.colegio_id
  WHERE m.user_id = auth.uid() AND m.rol = 'moderador'
    AND NOT EXISTS (
      SELECT 1 FROM colegio_admins ca
      WHERE ca.colegio_id = c.id AND ca.user_id = auth.uid()
    );
$fn$;

-- ── 5h. La Lista: aulas con sus códigos, profesores y alumnos.
--        Administrador: todas, con el código de profesor.
--        Profesor: solo las suyas, sin el código de profesor.
--        Nombres y fechas de entrada; nada de lo que escriben.
CREATE OR REPLACE FUNCTION public.lista_colegio(p_colegio uuid)
RETURNS TABLE (
  aula_id         uuid,
  nombre          text,
  grado           text,
  seccion         text,
  codigo_alumnos  text,
  codigo_profesor text,
  profesores      jsonb,
  alumnos         jsonb,
  total_alumnos   int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
DECLARE
  v_admin boolean := es_admin_colegio(p_colegio);
BEGIN
  IF NOT v_admin AND NOT es_profesor_colegio(p_colegio) THEN
    RAISE EXCEPTION 'Solo el colegio ve su lista.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    co.id,
    co.nombre::text,
    co.grado,
    co.seccion,
    cc.codigo,
    CASE WHEN v_admin THEN cp.codigo END,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
              'user_id', m.user_id,
              'nombre', coalesce(nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Profesor')
            ) ORDER BY m.unido_at), '[]'::jsonb)
     FROM comunidad_miembros m LEFT JOIN perfiles pf ON pf.id = m.user_id
     WHERE m.comunidad_id = co.id AND m.rol = 'moderador'),
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
              'user_id', m.user_id,
              'nombre', coalesce(m.nombre_en_aula, nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Lector'),
              'unido_at', m.unido_at
            ) ORDER BY coalesce(m.nombre_en_aula, pf.nombre)), '[]'::jsonb)
     FROM comunidad_miembros m LEFT JOIN perfiles pf ON pf.id = m.user_id
     WHERE m.comunidad_id = co.id AND m.rol = 'miembro'),
    (SELECT count(*)::int FROM comunidad_miembros m
     WHERE m.comunidad_id = co.id AND m.rol = 'miembro')
  FROM comunidades co
  LEFT JOIN comunidad_codigos cc ON cc.comunidad_id = co.id
  LEFT JOIN colegio_codigos  cp ON cp.comunidad_id = co.id AND cp.tipo = 'profesor'
  WHERE co.colegio_id = p_colegio
    AND (v_admin OR es_moderador(co.id))
  ORDER BY co.grado, co.seccion NULLS FIRST, co.nombre;
END;
$fn$;

-- ── 5i. Administradores del colegio, para la pantalla de ajustes.
CREATE OR REPLACE FUNCTION public.admins_colegio(p_colegio uuid)
RETURNS TABLE (user_id uuid, nombre text, soy_yo boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
BEGIN
  IF NOT es_admin_colegio(p_colegio) THEN
    RAISE EXCEPTION 'Solo los administradores ven esta lista.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT ca.user_id,
         coalesce(nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Administrador'),
         ca.user_id = auth.uid()
  FROM colegio_admins ca LEFT JOIN perfiles pf ON pf.id = ca.user_id
  WHERE ca.colegio_id = p_colegio
  ORDER BY ca.created_at;
END;
$fn$;

REVOKE ALL ON FUNCTION public.crear_colegio(text, text, text)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.canjear_codigo(text, text)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invitar_admin(uuid)                      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crear_aula(uuid, text, text)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerar_codigo(uuid)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerar_codigo_profesor(uuid)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mis_colegios()                           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lista_colegio(uuid)                      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admins_colegio(uuid)                     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canjear_codigo(text, text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.invitar_admin(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_aula(uuid, text, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerar_codigo(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerar_codigo_profesor(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_colegios()                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.lista_colegio(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admins_colegio(uuid)                  TO authenticated;


-- =============================================================
-- COMPROBACIÓN
--
--   0. (SQL Editor) SELECT crear_colegio('Colegio de Prueba', 'Perú', 'Lima');
--      Esperado: un código ADMIN-XXXXXXXX.
--
--   Con tres usuarios de prueba (A admin, P profesor, E alumno), desde
--   la app o con "Run as user":
--   1. A: SELECT canjear_codigo('ADMIN-…');  → tipo 'admin'.
--      Canjearlo otra vez (con otro usuario) → 'El código no es válido.'
--   2. A: SELECT crear_aula('<colegio>', '4.º', 'B');  → id del aula.
--      Repetirlo → 'Ya existe un aula «4.º B».'
--   3. A: SELECT * FROM lista_colegio('<colegio>');
--      → 4.º B con codigo_alumnos y codigo_profesor, sin nadie dentro.
--   4. P: SELECT canjear_codigo('PROF-…');  → tipo 'profesor'.
--      P: SELECT * FROM lista_colegio('<colegio>');  → solo 4.º B,
--      codigo_profesor vacío. P: SELECT * FROM mis_colegios(); → 'profesor'.
--   5. E: SELECT canjear_codigo('<código de alumnos>', 'Ana Pérez Rojas');
--      → tipo 'alumno'. En la lista: Ana Pérez Rojas, total_alumnos 1.
--      E: lista_colegio → 'Solo el colegio ve su lista.'
--   6. P: UPDATE comunidades SET privada = false WHERE id = '<aula>';
--      → viola comunidades_aula_privada.
--      P: DELETE FROM comunidades WHERE id = '<aula>';  → 0 filas.
--   7. P sale del aula: no hereda nadie (E sigue 'miembro') y el aula sigue.
--   8. A: DELETE FROM colegio_admins WHERE user_id = auth.uid();
--      → 'El colegio tiene que quedar con al menos un administrador.'
--   9. Tope: E en 5 comunidades normales puede entrar igual al aula.
--  10. Comunidades de antes: crear una normal sigue igual (moderador +
--      código), y el tope de 5 sigue saltando en la sexta.
-- =============================================================
