-- =============================================================
-- INMERSIA — Migración 103
-- Rincón del escritor, fase 1: cuenta de escritor, su libro y la cola
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ HACE (plan acordado con Juan, 13 nov 2026)
--   · escritores: quién tiene el modo escritor y su saldo de cupón. Por
--     ahora lo activa Juan a mano:
--       INSERT INTO escritores (user_id) VALUES ('<uuid del usuario>');
--   · libros.propietario_id: el dueño de un libro subido por un escritor.
--     Los libros de siempre lo tienen vacío y NO cambian en nada.
--   · Un libro de escritor sin publicar (visible = false) solo lo ve su
--     dueño (y el superusuario). Nadie puede añadirlo a su biblioteca.
--   · El navegador del escritor no escribe en las tablas del libro: todo
--     pasa por funciones que primero comprueban que el libro es suyo.
--   · trabajos: la cola que atiende el PC de Juan (worker_escritor.py, en
--     Documents). El worker solo hace conexiones salientes, con la clave
--     de servicio, y toma trabajos con tomar_trabajo().
--
-- QUIÉN LLAMA A QUÉ
--   Navegador (escritor):
--     · crear_libro_escritor(titulo, autor, es_ficcion, capitulos) → id
--       capitulos = [["párrafo", "párrafo", …], […], …] (uno por capítulo)
--     · borrar_libro_escritor(libro) → borra todo; deja un trabajo
--       «borrar» para que el PC limpie su carpeta de trabajo.
--     · pedir_trabajo(libro, tipo, parametros) → id del trabajo
--     · SELECT en escritores (lo suyo), libros, capitulos, trabajos (lo suyo)
--   Worker (service_role):
--     · tomar_trabajo() → el trabajo pendiente más antiguo, ya marcado
--       «en_proceso»; luego actualiza progreso/estado directamente.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Escritores
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.escritores (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  saldo_cupon numeric(8,2) NOT NULL DEFAULT 50 CHECK (saldo_cupon >= 0),
  creado      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.escritores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS escritores_select_propio ON public.escritores;
CREATE POLICY escritores_select_propio ON public.escritores
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- Nadie se da de alta ni se cambia el saldo desde el navegador.
REVOKE ALL ON public.escritores FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.escritores FROM authenticated;


-- ═════════════════════════════════════════════════════════════
-- 2. El libro tiene dueño
-- ═════════════════════════════════════════════════════════════
-- ON DELETE CASCADE: si el escritor borra su cuenta, su libro se va con
-- todo (todas las tablas que cuelgan de libros ya tienen CASCADE).
ALTER TABLE public.libros
  ADD COLUMN IF NOT EXISTS propietario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS libros_propietario_idx
  ON public.libros (propietario_id) WHERE propietario_id IS NOT NULL;


-- ═════════════════════════════════════════════════════════════
-- 3. Quién ve un libro de escritor
-- ═════════════════════════════════════════════════════════════
-- «propietario_id IS NULL» = los libros de siempre: se siguen viendo
-- exactamente igual que antes (incluidos el Manual y los ocultos).
DROP POLICY IF EXISTS libros_public_read ON public.libros;
CREATE POLICY libros_public_read ON public.libros
  FOR SELECT TO anon
  USING (visible OR propietario_id IS NULL);

DROP POLICY IF EXISTS libros_select ON public.libros;
CREATE POLICY libros_select ON public.libros
  FOR SELECT TO authenticated
  USING (
    visible
    OR propietario_id IS NULL
    OR propietario_id = (SELECT auth.uid())
    OR public.es_superusuario()
    OR EXISTS (SELECT 1 FROM public.bibliotecas_usuarios bu
               WHERE bu.user_id = (SELECT auth.uid()) AND bu.libro_id = libros.id)
  );

-- Capítulos y párrafos: lo de antes + el dueño del libro.
DROP POLICY IF EXISTS capitulos_select ON public.capitulos;
CREATE POLICY capitulos_select ON public.capitulos
  FOR SELECT TO authenticated
  USING (
    en_muestra
    OR EXISTS (SELECT 1 FROM public.bibliotecas_usuarios bu
               WHERE bu.user_id = (SELECT auth.uid()) AND bu.libro_id = capitulos.libro_id)
    OR EXISTS (SELECT 1 FROM public.superusuarios s WHERE s.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.libros l
               WHERE l.id = capitulos.libro_id AND l.propietario_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS parrafos_select ON public.parrafos;
CREATE POLICY parrafos_select ON public.parrafos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bibliotecas_usuarios bu
            WHERE bu.user_id = (SELECT auth.uid()) AND bu.libro_id = parrafos.libro_id)
    OR EXISTS (SELECT 1 FROM public.superusuarios s WHERE s.user_id = (SELECT auth.uid()))
    OR en_muestra
    OR EXISTS (SELECT 1 FROM public.libros l
               WHERE l.id = parrafos.libro_id AND l.propietario_id = (SELECT auth.uid()))
  );


-- ═════════════════════════════════════════════════════════════
-- 4. Nadie se añade un libro de escritor sin publicar
-- ═════════════════════════════════════════════════════════════
-- Igual que la 076, con un único cambio: el bloque «libro_invalido».
-- Sin él, quien conociera el id podría añadirlo a su biblioteca y leerlo.
CREATE OR REPLACE FUNCTION public.adquirir_libro(p_libro_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
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

  IF EXISTS (SELECT 1 FROM libros
             WHERE id = p_libro_id AND propietario_id IS NOT NULL
               AND NOT visible AND propietario_id <> v_uid) THEN
    RAISE EXCEPTION 'Ese libro no está en el catálogo.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
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


-- ═════════════════════════════════════════════════════════════
-- 4b. Un libro de escritor sin publicar no tiene muestra gratis
-- ═════════════════════════════════════════════════════════════
-- La muestra (los primeros ~10 min de lectura) la puede leer cualquiera,
-- incluso sin cuenta. Los triggers de parrafos la recalculan al insertar.
-- Igual que antes, con un único cambio: si el libro es de un escritor y
-- no está publicado, ningún párrafo es muestra. Al publicarlo (fase 6)
-- hay que volver a llamar a recalcular_muestra(ARRAY[libro]).
CREATE OR REPLACE FUNCTION public.recalcular_muestra(libro_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tope CONSTANT INTEGER := 2300;  -- 10 min × 230 palabras/min
BEGIN
  WITH orden AS (
    SELECT p.id,
           (l.propietario_id IS NULL OR l.visible) AS publico,
           sum(CASE WHEN p.tipo = 'separador' THEN 0 ELSE contar_palabras(p.contenido) END)
             OVER (PARTITION BY p.libro_id ORDER BY c.numero, p.numero, p.id
                   ROWS UNBOUNDED PRECEDING) AS acumulado,
           row_number() OVER (PARTITION BY p.libro_id ORDER BY c.numero, p.numero, p.id) AS fila
    FROM parrafos p
    JOIN capitulos c ON c.id = p.capitulo_id
    JOIN libros l ON l.id = p.libro_id
    WHERE p.libro_id = ANY(libro_ids)
  )
  UPDATE parrafos p
  SET en_muestra = (o.publico AND (o.acumulado <= tope OR o.fila = 1))
  FROM orden o
  WHERE p.id = o.id
    AND p.en_muestra IS DISTINCT FROM (o.publico AND (o.acumulado <= tope OR o.fila = 1));

  UPDATE capitulos c
  SET en_muestra = EXISTS (SELECT 1 FROM parrafos p WHERE p.capitulo_id = c.id AND p.en_muestra)
  WHERE c.libro_id = ANY(libro_ids)
    AND c.en_muestra IS DISTINCT FROM
        EXISTS (SELECT 1 FROM parrafos p WHERE p.capitulo_id = c.id AND p.en_muestra);
END $$;


-- ═════════════════════════════════════════════════════════════
-- 5. La cola de trabajos
-- ═════════════════════════════════════════════════════════════
-- libro_id sin clave foránea a propósito: el trabajo «borrar» tiene que
-- sobrevivir al libro. Al borrar un libro, el trigger del punto 7 quita
-- sus trabajos pendientes.
-- user_id vacío = trabajo interno (lo crea la base, no un escritor).
CREATE TABLE IF NOT EXISTS public.trabajos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id   uuid,
  tipo       text NOT NULL,
  estado     text NOT NULL DEFAULT 'pendiente',
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
  progreso   jsonb,
  resultado  jsonb,
  error      text,
  creado     timestamptz NOT NULL DEFAULT now(),
  empezado   timestamptz,
  terminado  timestamptz,
  CONSTRAINT trabajos_estado_check CHECK (estado IN ('pendiente', 'en_proceso', 'hecho', 'error'))
);

-- Los tipos que el worker sabe hacer. Cada fase añade los suyos aquí.
ALTER TABLE public.trabajos DROP CONSTRAINT IF EXISTS trabajos_tipo_check;
ALTER TABLE public.trabajos ADD CONSTRAINT trabajos_tipo_check
  CHECK (tipo IN ('prueba', 'borrar'));

CREATE INDEX IF NOT EXISTS trabajos_pendientes_idx ON public.trabajos (creado) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS trabajos_libro_idx ON public.trabajos (libro_id);
CREATE INDEX IF NOT EXISTS trabajos_user_idx ON public.trabajos (user_id);

ALTER TABLE public.trabajos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trabajos_select_propio ON public.trabajos;
CREATE POLICY trabajos_select_propio ON public.trabajos
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.trabajos FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.trabajos FROM authenticated;


-- ═════════════════════════════════════════════════════════════
-- 6. Funciones del escritor
-- ═════════════════════════════════════════════════════════════

-- Guarda un libro entero de una vez: libro + capítulos + párrafos.
-- El navegador ya leyó el .docx y el escritor confirmó los capítulos.
-- Todos los párrafos entran como 'texto' (igual que procesar_libro_solo hoy).
CREATE OR REPLACE FUNCTION public.crear_libro_escritor(
  p_titulo text, p_autor text, p_es_ficcion boolean, p_capitulos jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_titulo   text := btrim(coalesce(p_titulo, ''));
  v_autor    text := btrim(coalesce(p_autor, ''));
  v_libro    uuid;
  v_n_caps   int;
  v_n_parr   int;
  v_chars    bigint;
  v_palabras int;
  v_slug     text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM escritores WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Tu cuenta no tiene el modo escritor.' USING ERRCODE = '42501', HINT = 'no_escritor';
  END IF;

  IF length(v_titulo) NOT BETWEEN 1 AND 200 OR length(v_autor) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Falta el título o el nombre de autor.' USING ERRCODE = '22023', HINT = 'datos_libro';
  END IF;

  IF (SELECT count(*) FROM libros WHERE propietario_id = v_uid) >= 20 THEN
    RAISE EXCEPTION 'Ya tienes 20 libros en tu repisa.' USING ERRCODE = '42501', HINT = 'limite_libros';
  END IF;

  -- Forma: un array de capítulos, cada uno un array de párrafos (texto).
  IF jsonb_typeof(p_capitulos) <> 'array' THEN
    RAISE EXCEPTION 'Formato de capítulos inválido.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  v_n_caps := jsonb_array_length(p_capitulos);
  IF v_n_caps NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'El libro tiene que tener entre 1 y 500 capítulos.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_capitulos) c
             WHERE jsonb_typeof(c) <> 'array' OR jsonb_array_length(c) = 0
                OR EXISTS (SELECT 1 FROM jsonb_array_elements(c) p WHERE jsonb_typeof(p) <> 'string')) THEN
    RAISE EXCEPTION 'Formato de capítulos inválido.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  SELECT count(*), coalesce(sum(length(p #>> '{}')), 0)
    INTO v_n_parr, v_chars
    FROM jsonb_array_elements(p_capitulos) c, jsonb_array_elements(c) p;
  IF v_n_parr > 40000 OR v_chars > 6000000 THEN
    RAISE EXCEPTION 'El libro es demasiado largo para subirlo de una vez.' USING ERRCODE = '22023', HINT = 'demasiado_largo';
  END IF;

  -- Slug legible + un trozo al azar: único y sin chocar con el catálogo.
  v_slug := trim(both '-' from regexp_replace(lower(unaccent(v_titulo)), '[^a-z0-9]+', '-', 'g'));
  v_slug := left(coalesce(nullif(v_slug, ''), 'libro'), 60) || '-' || substr(md5(gen_random_uuid()::text), 1, 6);

  INSERT INTO libros (titulo, autor, es_ficcion, visible, propietario_id, slug)
  VALUES (v_titulo, v_autor, coalesce(p_es_ficcion, true), false, v_uid, v_slug)
  RETURNING id INTO v_libro;

  WITH caps AS (
    SELECT c.ord::int AS numero, c.parrafos
      FROM jsonb_array_elements(p_capitulos) WITH ORDINALITY AS c(parrafos, ord)
  ), ins_caps AS (
    INSERT INTO capitulos (libro_id, numero, titulo)
    SELECT v_libro, caps.numero, 'Capítulo ' || caps.numero
      FROM caps
    RETURNING id, numero
  )
  INSERT INTO parrafos (libro_id, capitulo_id, numero, contenido, tipo)
  SELECT v_libro, ic.id, p.ord::int, btrim(p.txt #>> '{}'), 'texto'
    FROM ins_caps ic
    JOIN caps ON caps.numero = ic.numero
    CROSS JOIN LATERAL jsonb_array_elements(caps.parrafos) WITH ORDINALITY AS p(txt, ord);

  -- capitulos.palabras la rellena el trigger de parrafos (recalcular_palabras_capitulos).
  SELECT coalesce(sum(palabras), 0) INTO v_palabras FROM capitulos WHERE libro_id = v_libro;
  UPDATE libros SET paginas = greatest(1, ceil(v_palabras / 250.0)::int) WHERE id = v_libro;

  RETURN v_libro;
END;
$fn$;


-- Borra un libro del escritor con todo lo que cuelga de él (CASCADE).
CREATE OR REPLACE FUNCTION public.borrar_libro_escritor(p_libro uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  DELETE FROM libros WHERE id = p_libro AND propietario_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ese libro no es tuyo o ya no existe.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;
END;
$fn$;


-- Pone un trabajo en la cola. Solo tipos que puede pedir el escritor, y
-- uno a la vez por tipo y libro.
CREATE OR REPLACE FUNCTION public.pedir_trabajo(p_libro uuid, p_tipo text, p_parametros jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM escritores WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Tu cuenta no tiene el modo escritor.' USING ERRCODE = '42501', HINT = 'no_escritor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM libros WHERE id = p_libro AND propietario_id = v_uid) THEN
    RAISE EXCEPTION 'Ese libro no es tuyo o ya no existe.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;
  -- Lo que puede pedir el escritor (los internos, como «borrar», no).
  IF p_tipo NOT IN ('prueba') THEN
    RAISE EXCEPTION 'Ese trabajo no existe.' USING ERRCODE = '22023', HINT = 'tipo_invalido';
  END IF;
  IF jsonb_typeof(coalesce(p_parametros, '{}'::jsonb)) <> 'object' OR length(coalesce(p_parametros, '{}'::jsonb)::text) > 10000 THEN
    RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pedir_trabajo:' || p_libro || ':' || p_tipo));
  IF EXISTS (SELECT 1 FROM trabajos WHERE libro_id = p_libro AND tipo = p_tipo
             AND estado IN ('pendiente', 'en_proceso')) THEN
    RAISE EXCEPTION 'Ya hay uno en marcha para este libro.' USING ERRCODE = '42501', HINT = 'trabajo_en_curso';
  END IF;

  INSERT INTO trabajos (user_id, libro_id, tipo, parametros)
  VALUES (v_uid, p_libro, p_tipo, coalesce(p_parametros, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;


-- El worker toma el trabajo pendiente más antiguo. SKIP LOCKED: si algún
-- día hay dos workers, no agarran el mismo.
CREATE OR REPLACE FUNCTION public.tomar_trabajo() RETURNS SETOF public.trabajos
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  UPDATE trabajos SET estado = 'en_proceso', empezado = now(), error = NULL
   WHERE id = (SELECT id FROM trabajos WHERE estado = 'pendiente'
               ORDER BY creado LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING *;
$fn$;

REVOKE ALL ON FUNCTION public.crear_libro_escritor(text, text, boolean, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.borrar_libro_escritor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pedir_trabajo(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tomar_trabajo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_libro_escritor(text, text, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.borrar_libro_escritor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pedir_trabajo(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tomar_trabajo() TO service_role;


-- ═════════════════════════════════════════════════════════════
-- 7. Al borrarse un libro de escritor, el PC limpia su carpeta
-- ═════════════════════════════════════════════════════════════
-- Vale para los dos caminos: borrar_libro_escritor y el borrado de la
-- cuenta (CASCADE). El trabajo «borrar» no guarda título ni nada del
-- libro: solo el id, que es el nombre de la carpeta en el PC.
CREATE OR REPLACE FUNCTION public._trabajo_borrar_libro() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  DELETE FROM trabajos WHERE libro_id = OLD.id AND estado = 'pendiente';
  INSERT INTO trabajos (user_id, libro_id, tipo) VALUES (NULL, OLD.id, 'borrar');
  RETURN OLD;
END;
$fn$;

REVOKE ALL ON FUNCTION public._trabajo_borrar_libro() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_trabajo_borrar_libro ON public.libros;
CREATE TRIGGER trg_trabajo_borrar_libro
  AFTER DELETE ON public.libros
  FOR EACH ROW WHEN (OLD.propietario_id IS NOT NULL)
  EXECUTE FUNCTION public._trabajo_borrar_libro();
