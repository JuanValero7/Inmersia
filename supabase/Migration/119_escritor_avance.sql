-- =============================================================
-- INMERSIA — Migración 119
-- Rincón del escritor: el avance de la tienda (5 escenas + música)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere 103–118.
--
-- QUÉ HACE (decisiones de Juan, 13 nov 2026)
--   · Pestaña «Avance de la tienda» en la Sala de imágenes. El avance es lo
--     que se ve en la ficha de la tienda (libro_reels): 5 escenas verticales
--     con título, subtexto y una música. Lo arma el worker con los scripts
--     de siempre (preview_analyze[_noficcion] + preview_generate[_noficcion]).
--   · GRATIS crearlo (trabajo «avance», con el estilo elegido de los 9).
--   · Textos editables gratis: guardar_texto_avance().
--   · Rehacer una imagen o la música: 0,25 $ (trabajo «avance_rehacer»).
--   · Los archivos van al bucket «escritores» (se le permite audio/mpeg);
--     al borrar o reemplazar una escena, sus archivos van solos a la cola
--     de borrado (trigger), también al borrar el libro entero.
--   · libro_reels deja de ser «visible para todos»: se lee si se puede leer
--     el libro (la política de libros decide). Para los libros de siempre
--     no cambia nada; el avance de un libro de escritor sin publicar ya no
--     se lee con solo saber su id.
-- Idempotente. Después: npm run esquema y commit del volcado.
-- =============================================================


-- ── 1. Precios ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.precios_escritor() RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $fn$
  SELECT '{"sonido_analisis": 5.00, "sonido_nuevo": 0.15, "sonido_max_efectos": 12,
           "portada": 0.00, "fondo": 1.00,
           "ilustracion": 0.50, "rehacer": 0.25, "ilustraciones_analisis": 5.00,
           "infografia": 0.50, "infografia_texto": 0.00, "cartelera": 5.00,
           "avance": 0.00, "avance_rehacer": 0.25,
           "juegos": [0, 3.00, 5.40, 7.80, 9.60, 12.00]}'::jsonb;
$fn$;


-- ── 2. Tipos de trabajo ───────────────────────────────────────
ALTER TABLE public.trabajos DROP CONSTRAINT IF EXISTS trabajos_tipo_check;
ALTER TABLE public.trabajos ADD CONSTRAINT trabajos_tipo_check
  CHECK (tipo IN ('prueba', 'borrar', 'sonido', 'portada', 'fondo',
                  'ilustraciones_analisis', 'ilustraciones', 'rehacer', 'infografias',
                  'infografia_texto', 'cartelera', 'avance', 'avance_rehacer'));


-- ── 3. Pedir trabajo (la de la 111 + avance y avance_rehacer) ──
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
  IF p_tipo NOT IN ('prueba', 'sonido', 'portada', 'fondo', 'ilustraciones_analisis', 'ilustraciones', 'rehacer',
                    'infografias', 'infografia_texto', 'cartelera', 'avance', 'avance_rehacer') THEN
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
  -- El avance entero y sus «rehacer» no se pisan (119).
  IF p_tipo IN ('avance', 'avance_rehacer') AND EXISTS (
       SELECT 1 FROM trabajos WHERE libro_id = p_libro AND tipo IN ('avance', 'avance_rehacer')
          AND estado IN ('pendiente', 'en_proceso')) THEN
    RAISE EXCEPTION 'Ya estamos trabajando en tu avance.' USING ERRCODE = '42501', HINT = 'trabajo_en_curso';
  END IF;

  IF p_tipo IN ('sonido', 'ilustraciones_analisis', 'ilustraciones', 'rehacer')
     AND NOT (SELECT es_ficcion FROM libros WHERE id = p_libro) THEN
    RAISE EXCEPTION 'Esto es para libros de ficción.' USING ERRCODE = '22023', HINT = 'no_ficcion';
  END IF;
  IF p_tipo IN ('infografias', 'infografia_texto') AND (SELECT es_ficcion FROM libros WHERE id = p_libro) THEN
    RAISE EXCEPTION 'Las infografías son para libros de no ficción.' USING ERRCODE = '22023', HINT = 'ficcion';
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

  ELSIF p_tipo = 'infografias' THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k NOT IN ('estilo', 'capitulos'))
       OR jsonb_typeof(v_params -> 'estilo') IS DISTINCT FROM 'number'
       OR (v_params ->> 'estilo')::numeric NOT IN (0, 1)
       OR jsonb_typeof(v_params -> 'capitulos') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_n := jsonb_array_length(v_params -> 'capitulos');
    IF v_n NOT BETWEEN 1 AND 300
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_params -> 'capitulos') c
                   WHERE jsonb_typeof(c) <> 'number' OR (c #>> '{}') !~ '^[0-9]{1,4}$')
       OR (SELECT count(DISTINCT numero) FROM capitulos
            WHERE libro_id = p_libro
              AND numero IN (SELECT (c #>> '{}')::int FROM jsonb_array_elements(v_params -> 'capitulos') c)) <> v_n THEN
      RAISE EXCEPTION 'Elige los capítulos de tu libro.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := v_n * (v_precios ->> 'infografia')::numeric;

  ELSIF p_tipo = 'infografia_texto' THEN
    -- Gratis: {imagen, titulo, concepto, bullets: [5 textos]}
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k NOT IN ('imagen', 'titulo', 'concepto', 'bullets'))
       OR coalesce(v_params ->> 'imagen', '') !~ '^[0-9a-f-]{36}$'
       OR NOT EXISTS (SELECT 1 FROM imagenes_escritor WHERE id = (v_params ->> 'imagen')::uuid AND libro_id = p_libro
                        AND tipo = 'infografia' AND datos ? 'plantilla')
       OR jsonb_typeof(v_params -> 'titulo') IS DISTINCT FROM 'string'
       OR length(btrim(v_params ->> 'titulo')) NOT BETWEEN 1 AND 160
       OR jsonb_typeof(v_params -> 'concepto') IS DISTINCT FROM 'string'
       OR length(v_params ->> 'concepto') > 200
       OR jsonb_typeof(v_params -> 'bullets') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_params -> 'bullets') <> 5   -- las plantillas rellenan con su demo lo que falta
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_params -> 'bullets') b
                   WHERE jsonb_typeof(b) <> 'string' OR length(btrim(b #>> '{}')) NOT BETWEEN 1 AND 220) THEN
      RAISE EXCEPTION 'Revisa el texto: título, idea central (hasta 200 letras) y los 5 puntos (hasta 220 letras cada uno).'
        USING ERRCODE = '22023', HINT = 'formato';
    END IF;

  ELSIF p_tipo = 'cartelera' THEN
    IF v_params <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := (v_precios ->> 'cartelera')::numeric;

  ELSIF p_tipo = 'avance' THEN
    -- {estilo 0–8}: el mismo índice que Ilustraciones (ART_STYLES). Gratis.
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k <> 'estilo')
       OR jsonb_typeof(v_params -> 'estilo') IS DISTINCT FROM 'number'
       OR (v_params ->> 'estilo')::numeric NOT IN (0, 1, 2, 3, 4, 5, 6, 7, 8) THEN
      RAISE EXCEPTION 'Elige un estilo.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := (v_precios ->> 'avance')::numeric;

  ELSIF p_tipo = 'avance_rehacer' THEN
    -- {orden: 1–5} = otra imagen para esa escena; {musica: true} = otra música.
    IF NOT ((v_params ? 'orden' AND NOT v_params ? 'musica'
             AND jsonb_typeof(v_params -> 'orden') = 'number'
             AND (v_params ->> 'orden')::numeric IN (1, 2, 3, 4, 5))
            OR v_params = '{"musica": true}'::jsonb)
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k NOT IN ('orden', 'musica'))
       OR NOT EXISTS (SELECT 1 FROM trabajos WHERE libro_id = p_libro AND tipo = 'avance' AND estado = 'hecho')
       OR NOT EXISTS (SELECT 1 FROM libro_reels WHERE libro_id = p_libro) THEN
      RAISE EXCEPTION 'Primero crea tu avance.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := (v_precios ->> 'avance_rehacer')::numeric;
  END IF;

  IF v_reservado IS NOT NULL AND v_reservado > 0 THEN
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


-- ── 4. Bucket «escritores»: también la música del avance ──────
-- Solo el worker sube mp3 (la política de subida del escritor, 107, solo
-- admite «<uid>/<libro>/<uuid>.webp»).
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/webp', 'image/png', 'image/jpeg', 'audio/mpeg'],
       file_size_limit = 10485760
 WHERE id = 'escritores';


-- ── 5. Archivos del avance a la cola de borrado ───────────────
-- Solo los del bucket «escritores» (los avances del catálogo viven en
-- otros buckets y no se tocan). Al reemplazar una URL (rehacer) se va la
-- vieja; al borrar filas (avance nuevo o libro borrado), todas. La música
-- es la misma en las 5 escenas: no se borra mientras otra fila la use.
CREATE OR REPLACE FUNCTION public._ruta_escritores(p_url text) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $fn$
  SELECT substring(p_url FROM '/storage/v1/object/public/escritores/([^?]+)');
$fn$;

CREATE OR REPLACE FUNCTION public._reel_archivos_por_borrar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  INSERT INTO archivos_por_borrar (ruta)
  SELECT v.r FROM (VALUES (_ruta_escritores(OLD.imagen_url)), (_ruta_escritores(OLD.audio_url))) v(r)
   WHERE v.r IS NOT NULL
     AND (TG_OP = 'DELETE'
          OR (v.r IS DISTINCT FROM _ruta_escritores(NEW.imagen_url)
              AND v.r IS DISTINCT FROM _ruta_escritores(NEW.audio_url)))
     AND NOT EXISTS (SELECT 1 FROM libro_reels o
                      WHERE o.libro_id = OLD.libro_id AND o.id <> OLD.id
                        AND (_ruta_escritores(o.audio_url) = v.r OR _ruta_escritores(o.imagen_url) = v.r))
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION public._reel_archivos_por_borrar() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reel_archivos ON public.libro_reels;
CREATE TRIGGER trg_reel_archivos
  AFTER UPDATE OF imagen_url, audio_url OR DELETE ON public.libro_reels
  FOR EACH ROW EXECUTE FUNCTION public._reel_archivos_por_borrar();


-- ── 6. Editar los textos (gratis) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.guardar_texto_avance(p_libro uuid, p_orden int, p_titulo text, p_subtexto text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM libros WHERE id = p_libro AND propietario_id = auth.uid()) THEN
    RAISE EXCEPTION 'Ese libro no es tuyo o ya no existe.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;
  IF length(btrim(coalesce(p_titulo, ''))) NOT BETWEEN 1 AND 80 OR length(coalesce(p_subtexto, '')) > 240 THEN
    RAISE EXCEPTION 'El título va de 1 a 80 letras y el texto hasta 240.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  UPDATE libro_reels SET titulo = btrim(p_titulo), subtexto = nullif(btrim(p_subtexto), '')
   WHERE libro_id = p_libro AND orden = p_orden;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa escena ya no está.' USING ERRCODE = 'P0002', HINT = 'item_invalido';
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.guardar_texto_avance(uuid, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_texto_avance(uuid, int, text, text) TO authenticated;


-- ── 7. Leer el avance = poder leer el libro ───────────────────
DROP POLICY IF EXISTS "Reels visibles para todos" ON public.libro_reels;
DROP POLICY IF EXISTS libro_reels_select ON public.libro_reels;
CREATE POLICY libro_reels_select ON public.libro_reels
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.libros l WHERE l.id = libro_reels.libro_id));
