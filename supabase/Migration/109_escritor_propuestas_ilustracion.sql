-- =============================================================
-- INMERSIA — Migración 109
-- Rincón del escritor, fase 3: las propuestas de ilustración son del autor
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 108.
--
-- QUÉ CAMBIA (pedido de Juan, 13 nov 2026)
--   · Antes, lo que se podía dibujar vivía solo en el resultado del análisis.
--     Ahora hay una lista por libro, ilustraciones_propuestas, que el autor
--     puede editar (descripción, nombre), vaciar o rellenar a mano, incluso
--     SIN pagar el análisis.
--   · El análisis (5 $) la rellena: importar_propuestas_analisis() reemplaza
--     las propuestas que vinieron del análisis; las que escribió el autor se
--     quedan.
--   · Al dibujar, el worker usa la lista: si una entrada no se tocó, el
--     prompt del análisis; si el autor la editó o la escribió, arma el prompt
--     con su descripción (y en las escenas, con la de los personajes y
--     lugares que se nombran). Así un cambio en un personaje llega a su
--     retrato y a sus escenas.
--   · «ilustraciones» pasa a pedirse como {estilo, items: [id de propuesta]}.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


CREATE TABLE IF NOT EXISTS public.ilustraciones_propuestas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libro_id      uuid NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  tipo          text NOT NULL,
  nombre        text,           -- personaje o lugar
  capitulo      int,            -- escena
  descripcion   text NOT NULL,  -- en español, la que ve y edita el autor
  rol           text,           -- protagonist | antagonist | supporting (del análisis)
  prompt        text,           -- el del análisis (inglés); se usa solo si no se editó
  estilo_prompt int,            -- índice de ART_STYLES con el que se escribió ese prompt
  editado       boolean NOT NULL DEFAULT false,
  origen        text NOT NULL DEFAULT 'autor',
  creado        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ilustraciones_propuestas_tipo_check CHECK (tipo IN ('personaje', 'lugar', 'escena')),
  CONSTRAINT ilustraciones_propuestas_origen_check CHECK (origen IN ('analisis', 'autor')),
  CONSTRAINT ilustraciones_propuestas_forma_check CHECK (
    (tipo IN ('personaje', 'lugar') AND nombre IS NOT NULL AND capitulo IS NULL)
    OR (tipo = 'escena' AND capitulo IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ilustraciones_propuestas_libro_idx ON public.ilustraciones_propuestas (libro_id, tipo);

ALTER TABLE public.ilustraciones_propuestas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ilustraciones_propuestas_select ON public.ilustraciones_propuestas;
CREATE POLICY ilustraciones_propuestas_select ON public.ilustraciones_propuestas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.libros l
                  WHERE l.id = ilustraciones_propuestas.libro_id AND l.propietario_id = (SELECT auth.uid())));
REVOKE ALL ON public.ilustraciones_propuestas FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ilustraciones_propuestas FROM authenticated;

-- De qué propuesta salió cada imagen (para «ya tienes una»).
ALTER TABLE public.imagenes_escritor
  ADD COLUMN IF NOT EXISTS propuesta_id uuid REFERENCES public.ilustraciones_propuestas(id) ON DELETE SET NULL;


-- ═════════════════════════════════════════════════════════════
-- Del resultado del análisis a la lista (lo llama el worker)
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.importar_propuestas_analisis(p_trabajo uuid) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  t trabajos%ROWTYPE;
  v_estilo int;
  n int;
BEGIN
  SELECT * INTO t FROM trabajos WHERE id = p_trabajo AND tipo = 'ilustraciones_analisis' AND resultado IS NOT NULL;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_estilo := (t.resultado ->> 'estilo')::int;

  DELETE FROM ilustraciones_propuestas WHERE libro_id = t.libro_id AND origen = 'analisis';

  INSERT INTO ilustraciones_propuestas (libro_id, tipo, nombre, descripcion, rol, prompt, estilo_prompt, origen)
  SELECT t.libro_id, 'personaje', left(p ->> 'nombre', 160), left(coalesce(p ->> 'descripcion', ''), 1000),
         left(p ->> 'rol', 40), p ->> 'prompt', v_estilo, 'analisis'
    FROM jsonb_array_elements(coalesce(t.resultado -> 'personajes', '[]')) p
   WHERE coalesce(p ->> 'nombre', '') <> '';

  INSERT INTO ilustraciones_propuestas (libro_id, tipo, nombre, descripcion, prompt, estilo_prompt, origen)
  SELECT t.libro_id, 'lugar', left(l ->> 'nombre', 160), left(coalesce(l ->> 'descripcion', ''), 1000),
         l ->> 'prompt', v_estilo, 'analisis'
    FROM jsonb_array_elements(coalesce(t.resultado -> 'lugares', '[]')) l
   WHERE coalesce(l ->> 'nombre', '') <> '';

  INSERT INTO ilustraciones_propuestas (libro_id, tipo, capitulo, descripcion, prompt, estilo_prompt, origen)
  SELECT t.libro_id, 'escena', (e ->> 'capitulo')::int, left(coalesce(e ->> 'descripcion', ''), 1000),
         e ->> 'prompt', v_estilo, 'analisis'
    FROM jsonb_array_elements(coalesce(t.resultado -> 'escenas', '[]')) e
   WHERE e ->> 'capitulo' ~ '^\d+$';

  SELECT count(*) INTO n FROM ilustraciones_propuestas WHERE libro_id = t.libro_id AND origen = 'analisis';
  RETURN n;
END;
$fn$;
REVOKE ALL ON FUNCTION public.importar_propuestas_analisis(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.importar_propuestas_analisis(uuid) TO service_role;

-- Análisis ya hechos antes de esta migración: a la lista.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT ON (libro_id) id, libro_id FROM trabajos
            WHERE tipo = 'ilustraciones_analisis' AND estado = 'hecho'
            ORDER BY libro_id, creado DESC LOOP
    IF NOT EXISTS (SELECT 1 FROM ilustraciones_propuestas WHERE libro_id = r.libro_id) THEN
      PERFORM importar_propuestas_analisis(r.id);
    END IF;
  END LOOP;
END $$;


-- ═════════════════════════════════════════════════════════════
-- Lo que llama el autor: crear/editar y quitar
-- ═════════════════════════════════════════════════════════════
-- p_id NULL = nueva. Al editar una que vino del análisis queda «editado»:
-- el worker ya no usará el prompt del análisis, sino lo que escribió el autor.
CREATE OR REPLACE FUNCTION public.guardar_propuesta_ilustracion(
  p_libro uuid, p_id uuid, p_tipo text, p_nombre text, p_capitulo int, p_descripcion text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_desc   text := btrim(coalesce(p_descripcion, ''));
  v_id     uuid;
  v_actual ilustraciones_propuestas%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM libros WHERE id = p_libro AND propietario_id = auth.uid() AND es_ficcion) THEN
    RAISE EXCEPTION 'Ese libro no es tuyo o ya no existe.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;
  IF p_tipo NOT IN ('personaje', 'lugar', 'escena') THEN
    RAISE EXCEPTION 'Tipo inválido.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF length(v_desc) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'Escribe una descripción (entre 3 y 1000 letras).' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF p_tipo IN ('personaje', 'lugar') AND (v_nombre IS NULL OR length(v_nombre) > 160) THEN
    RAISE EXCEPTION 'Ponle un nombre (máximo 160 letras).' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF p_tipo = 'escena' AND NOT EXISTS (SELECT 1 FROM capitulos WHERE libro_id = p_libro AND numero = p_capitulo) THEN
    RAISE EXCEPTION 'Elige un capítulo de tu libro.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  IF p_id IS NULL THEN
    IF (SELECT count(*) FROM ilustraciones_propuestas WHERE libro_id = p_libro) >= 200 THEN
      RAISE EXCEPTION 'Ya tienes 200 propuestas en este libro.' USING ERRCODE = '42501', HINT = 'formato';
    END IF;
    INSERT INTO ilustraciones_propuestas (libro_id, tipo, nombre, capitulo, descripcion, editado, origen)
    VALUES (p_libro, p_tipo,
            CASE WHEN p_tipo = 'escena' THEN NULL ELSE v_nombre END,
            CASE WHEN p_tipo = 'escena' THEN p_capitulo END,
            v_desc, true, 'autor')
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  SELECT * INTO v_actual FROM ilustraciones_propuestas WHERE id = p_id AND libro_id = p_libro;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa propuesta ya no está.' USING ERRCODE = 'P0002', HINT = 'formato';
  END IF;
  UPDATE ilustraciones_propuestas
     SET nombre = CASE WHEN tipo = 'escena' THEN NULL ELSE v_nombre END,
         capitulo = CASE WHEN tipo = 'escena' THEN p_capitulo END,
         descripcion = v_desc,
         editado = editado OR v_desc IS DISTINCT FROM v_actual.descripcion
                           OR (tipo <> 'escena' AND v_nombre IS DISTINCT FROM v_actual.nombre)
                           OR (tipo = 'escena' AND p_capitulo IS DISTINCT FROM v_actual.capitulo)
   WHERE id = p_id;
  RETURN p_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.borrar_propuesta_ilustracion(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  DELETE FROM ilustraciones_propuestas pr USING libros l
   WHERE pr.id = p_id AND l.id = pr.libro_id AND l.propietario_id = auth.uid();
END;
$fn$;

REVOKE ALL ON FUNCTION public.guardar_propuesta_ilustracion(uuid, uuid, text, text, int, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.borrar_propuesta_ilustracion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_propuesta_ilustracion(uuid, uuid, text, text, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.borrar_propuesta_ilustracion(uuid) TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- pedir_trabajo: igual que en la 108, con «ilustraciones» = {estilo, items}
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.pedir_trabajo(p_libro uuid, p_tipo text, p_parametros jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_id        uuid;
  v_params    jsonb := coalesce(p_parametros, '{}'::jsonb);
  v_precios   jsonb := precios_escritor();
  v_reservado numeric(8,2);
  v_max       int;
  v_caps      int;
  v_n         int;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM escritores WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Tu cuenta no tiene el modo escritor.' USING ERRCODE = '42501', HINT = 'no_escritor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM libros WHERE id = p_libro AND propietario_id = v_uid) THEN
    RAISE EXCEPTION 'Ese libro no es tuyo o ya no existe.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;
  IF p_tipo NOT IN ('prueba', 'sonido', 'portada', 'fondo', 'ilustraciones_analisis', 'ilustraciones', 'rehacer') THEN
    RAISE EXCEPTION 'Ese trabajo no existe.' USING ERRCODE = '22023', HINT = 'tipo_invalido';
  END IF;
  IF jsonb_typeof(v_params) <> 'object' OR length(v_params::text) > 10000 THEN
    RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pedir_trabajo:' || p_libro || ':' || p_tipo));
  IF EXISTS (SELECT 1 FROM trabajos WHERE libro_id = p_libro AND tipo = p_tipo
             AND estado IN ('pendiente', 'en_proceso')) THEN
    RAISE EXCEPTION 'Ya hay uno en marcha para este libro.' USING ERRCODE = '42501', HINT = 'trabajo_en_curso';
  END IF;

  IF p_tipo IN ('sonido', 'ilustraciones_analisis', 'ilustraciones', 'rehacer')
     AND NOT (SELECT es_ficcion FROM libros WHERE id = p_libro) THEN
    RAISE EXCEPTION 'Esto es para libros de ficción.' USING ERRCODE = '22023', HINT = 'no_ficcion';
  END IF;

  IF p_tipo = 'sonido' THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k NOT IN ('max_efectos', 'ambientes'))
       OR jsonb_typeof(v_params -> 'max_efectos') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_params -> 'ambientes') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_max := (v_params ->> 'max_efectos')::numeric::int;
    IF v_max::numeric <> (v_params ->> 'max_efectos')::numeric
       OR v_max NOT BETWEEN 1 AND (v_precios ->> 'sonido_max_efectos')::int THEN
      RAISE EXCEPTION 'El tope de efectos va de 1 a %.', v_precios ->> 'sonido_max_efectos'
        USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    SELECT count(*) INTO v_caps FROM capitulos WHERE libro_id = p_libro;
    v_reservado := (v_precios ->> 'sonido_analisis')::numeric
                 + v_caps * v_max * (v_precios ->> 'sonido_nuevo')::numeric;

  ELSIF p_tipo IN ('portada', 'fondo') THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k
                WHERE k NOT IN ('sujeto', 'color') OR (k = 'color' AND p_tipo = 'fondo'))
       OR jsonb_typeof(v_params -> 'sujeto') IS DISTINCT FROM 'string'
       OR length(btrim(v_params ->> 'sujeto')) NOT BETWEEN 3 AND 400
       OR (p_tipo = 'portada' AND coalesce(v_params ->> 'color', '') !~ '^#[0-9a-fA-F]{6}$') THEN
      RAISE EXCEPTION 'Cuéntanos qué quieres que salga (entre 3 y 400 letras).' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := (v_precios ->> p_tipo)::numeric;

  ELSIF p_tipo = 'ilustraciones_analisis' THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k <> 'estilo')
       OR jsonb_typeof(v_params -> 'estilo') IS DISTINCT FROM 'number'
       OR (v_params ->> 'estilo')::numeric NOT IN (0, 1, 2, 3, 4, 5, 6, 7, 8) THEN
      RAISE EXCEPTION 'Elige un estilo.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := (v_precios ->> 'ilustraciones_analisis')::numeric;

  ELSIF p_tipo = 'ilustraciones' THEN
    -- {estilo: 0–8, items: [id de ilustraciones_propuestas de este libro]}
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k NOT IN ('estilo', 'items'))
       OR jsonb_typeof(v_params -> 'estilo') IS DISTINCT FROM 'number'
       OR (v_params ->> 'estilo')::numeric NOT IN (0, 1, 2, 3, 4, 5, 6, 7, 8)
       OR jsonb_typeof(v_params -> 'items') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_n := jsonb_array_length(v_params -> 'items');
    IF v_n NOT BETWEEN 1 AND 80
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_params -> 'items') it
                   WHERE jsonb_typeof(it) <> 'string' OR (it #>> '{}') !~ '^[0-9a-f-]{36}$')
       OR (SELECT count(*) FROM ilustraciones_propuestas
            WHERE libro_id = p_libro
              AND id IN (SELECT (it #>> '{}')::uuid FROM jsonb_array_elements(v_params -> 'items') it)) <> v_n THEN
      RAISE EXCEPTION 'Marca entre 1 y 80 imágenes.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := v_n * (v_precios ->> 'ilustracion')::numeric;

  ELSIF p_tipo = 'rehacer' THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k <> 'imagen')
       OR coalesce(v_params ->> 'imagen', '') !~ '^[0-9a-f-]{36}$'
       OR NOT EXISTS (SELECT 1 FROM imagenes_escritor WHERE id = (v_params ->> 'imagen')::uuid AND libro_id = p_libro
                        AND estado = 'borrador' AND tipo IN ('personaje', 'lugar', 'escena') AND prompt IS NOT NULL) THEN
      RAISE EXCEPTION 'Esa imagen ya no se puede rehacer.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := (v_precios ->> 'rehacer')::numeric;
  END IF;

  IF v_reservado IS NOT NULL THEN
    UPDATE escritores SET saldo_cupon = saldo_cupon - v_reservado
     WHERE user_id = v_uid AND saldo_cupon >= v_reservado;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tu saldo no alcanza para esto.' USING ERRCODE = '42501', HINT = 'saldo_insuficiente';
    END IF;
  END IF;

  INSERT INTO trabajos (user_id, libro_id, tipo, parametros, reservado)
  VALUES (v_uid, p_libro, p_tipo, v_params, v_reservado)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;
