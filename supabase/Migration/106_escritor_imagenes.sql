-- =============================================================
-- INMERSIA — Migración 106
-- Rincón del escritor, fase 3 (parte 1): imágenes — base común, portada y fondo
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 105 (precios_escritor, cobro con reserva, cerrar_cobro).
--
-- QUÉ HACE (decisiones de Juan, 13 nov 2026)
--   · Precios: portada GRATIS; fondo de ficha 1 $; cada ilustración 0,50 $ y
--     rehacer 0,25 $; análisis de ilustraciones 5 $; infografía 0,50 $.
--     (Sonido sigue igual: 5 $ de análisis + 0,15 $ por sonido nuevo.)
--   · imagenes_escritor: todas las imágenes de los libros de escritor,
--     borrador o guardada. Lo que sale en la portada y en el fondo lo escribe
--     el escritor (parámetro «sujeto»).
--   · Bucket público «escritores» (nombres imposibles de adivinar, como las
--     imágenes de todos los libros). Los archivos los sube el worker.
--   · Borrar archivos de Storage desde SQL no se puede (protect_objects_delete):
--     al borrar una fila, su ruta va a archivos_por_borrar y el worker la
--     borra de Storage en su próxima vuelta. Sirve para descartar, para los
--     borradores de más de 7 días (pg_cron, cada día) y para el libro borrado.
--   · Trabajos «portada» y «fondo» con el mismo cobro con reserva de la 105.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Precios
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.precios_escritor() RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $fn$
  SELECT '{"sonido_analisis": 5.00, "sonido_nuevo": 0.15, "sonido_max_efectos": 12,
           "portada": 0.00, "fondo": 1.00,
           "ilustracion": 0.50, "rehacer": 0.25, "ilustraciones_analisis": 5.00,
           "infografia": 0.50}'::jsonb;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 2. Bucket
-- ═════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('escritores', 'escritores', true, 5242880, ARRAY['image/webp', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/webp', 'image/png', 'image/jpeg'];


-- ═════════════════════════════════════════════════════════════
-- 3. Las imágenes del escritor
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.imagenes_escritor (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libro_id    uuid NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  tipo        text NOT NULL,
  estado      text NOT NULL DEFAULT 'borrador',
  url         text NOT NULL,
  url_movil   text,                       -- el fondo tiene versión móvil
  rutas       text[] NOT NULL DEFAULT '{}', -- archivos en el bucket «escritores»
  descripcion text,                       -- qué se pidió (el «sujeto»)
  nombre      text,                       -- personaje o lugar (fase 3, ilustraciones)
  capitulo    int,                        -- escena o imagen propia en un capítulo
  pie         text,
  trabajo_id  uuid,
  creado      timestamptz NOT NULL DEFAULT now(),
  guardado    timestamptz,
  CONSTRAINT imagenes_escritor_tipo_check
    CHECK (tipo IN ('portada', 'fondo', 'personaje', 'lugar', 'escena', 'propia', 'infografia')),
  CONSTRAINT imagenes_escritor_estado_check CHECK (estado IN ('borrador', 'guardada'))
);
CREATE INDEX IF NOT EXISTS imagenes_escritor_libro_idx ON public.imagenes_escritor (libro_id, tipo);
CREATE INDEX IF NOT EXISTS imagenes_escritor_borradores_idx ON public.imagenes_escritor (creado) WHERE estado = 'borrador';

ALTER TABLE public.imagenes_escritor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS imagenes_escritor_select ON public.imagenes_escritor;
CREATE POLICY imagenes_escritor_select ON public.imagenes_escritor
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.libros l
                  WHERE l.id = imagenes_escritor.libro_id AND l.propietario_id = (SELECT auth.uid())));

REVOKE ALL ON public.imagenes_escritor FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.imagenes_escritor FROM authenticated;


-- Archivos que el worker tiene que borrar de Storage.
CREATE TABLE IF NOT EXISTS public.archivos_por_borrar (
  ruta   text PRIMARY KEY,
  creado timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.archivos_por_borrar ENABLE ROW LEVEL SECURITY;  -- sin políticas: solo el worker
REVOKE ALL ON public.archivos_por_borrar FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._imagen_escritor_borrada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  INSERT INTO archivos_por_borrar (ruta) SELECT unnest(OLD.rutas) ON CONFLICT DO NOTHING;
  RETURN OLD;
END;
$fn$;
REVOKE ALL ON FUNCTION public._imagen_escritor_borrada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_imagen_escritor_borrada ON public.imagenes_escritor;
CREATE TRIGGER trg_imagen_escritor_borrada
  AFTER DELETE ON public.imagenes_escritor
  FOR EACH ROW EXECUTE FUNCTION public._imagen_escritor_borrada();


-- ═════════════════════════════════════════════════════════════
-- 4. Guardar y descartar (el escritor)
-- ═════════════════════════════════════════════════════════════
-- Guardar una portada o un fondo la pone en el libro y quita la anterior
-- (sus archivos van a la cola de borrado).
CREATE OR REPLACE FUNCTION public.guardar_imagen_escritor(p_imagen uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  i imagenes_escritor%ROWTYPE;
BEGIN
  SELECT im.* INTO i FROM imagenes_escritor im JOIN libros l ON l.id = im.libro_id
   WHERE im.id = p_imagen AND l.propietario_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa imagen no es de tu libro.' USING ERRCODE = 'P0002', HINT = 'imagen_invalida';
  END IF;
  IF i.estado = 'guardada' THEN RETURN; END IF;

  IF i.tipo IN ('portada', 'fondo') THEN
    DELETE FROM imagenes_escritor
     WHERE libro_id = i.libro_id AND tipo = i.tipo AND estado = 'guardada' AND id <> i.id;
  END IF;

  UPDATE imagenes_escritor SET estado = 'guardada', guardado = now() WHERE id = i.id;

  IF i.tipo = 'portada' THEN
    UPDATE libros SET portada_url = i.url WHERE id = i.libro_id;
  ELSIF i.tipo = 'fondo' THEN
    UPDATE libros
       SET metadata = coalesce(metadata, '{}'::jsonb)
                      || jsonb_build_object('hero_url', i.url, 'hero_url_mobile', coalesce(i.url_movil, i.url))
     WHERE id = i.libro_id;
  END IF;
END;
$fn$;

-- Descartar un borrador, o quitar una imagen guardada (la portada o el
-- fondo guardados también se quitan del libro).
CREATE OR REPLACE FUNCTION public.descartar_imagen_escritor(p_imagen uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  i imagenes_escritor%ROWTYPE;
BEGIN
  SELECT im.* INTO i FROM imagenes_escritor im JOIN libros l ON l.id = im.libro_id
   WHERE im.id = p_imagen AND l.propietario_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa imagen no es de tu libro.' USING ERRCODE = 'P0002', HINT = 'imagen_invalida';
  END IF;
  IF i.estado = 'guardada' AND i.tipo = 'portada' THEN
    UPDATE libros SET portada_url = NULL WHERE id = i.libro_id AND portada_url = i.url;
  ELSIF i.estado = 'guardada' AND i.tipo = 'fondo' THEN
    UPDATE libros SET metadata = metadata - 'hero_url' - 'hero_url_mobile'
     WHERE id = i.libro_id AND metadata ->> 'hero_url' = i.url;
  END IF;
  DELETE FROM imagenes_escritor WHERE id = i.id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.guardar_imagen_escritor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.descartar_imagen_escritor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_imagen_escritor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.descartar_imagen_escritor(uuid) TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- 5. Borradores de más de 7 días: se borran solos (cada día, 4:37 UTC)
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.purgar_borradores_escritor() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  n int;
BEGIN
  DELETE FROM imagenes_escritor WHERE estado = 'borrador' AND creado < now() - interval '7 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$fn$;
REVOKE ALL ON FUNCTION public.purgar_borradores_escritor() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purgar-borradores-escritor';
SELECT cron.schedule('purgar-borradores-escritor', '37 4 * * *', 'SELECT public.purgar_borradores_escritor()');


-- ═════════════════════════════════════════════════════════════
-- 6. Trabajos «portada» y «fondo»
-- ═════════════════════════════════════════════════════════════
ALTER TABLE public.trabajos DROP CONSTRAINT IF EXISTS trabajos_tipo_check;
ALTER TABLE public.trabajos ADD CONSTRAINT trabajos_tipo_check
  CHECK (tipo IN ('prueba', 'borrar', 'sonido', 'portada', 'fondo'));

-- Igual que en la 105 + portada y fondo.
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
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM escritores WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Tu cuenta no tiene el modo escritor.' USING ERRCODE = '42501', HINT = 'no_escritor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM libros WHERE id = p_libro AND propietario_id = v_uid) THEN
    RAISE EXCEPTION 'Ese libro no es tuyo o ya no existe.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;
  -- Lo que puede pedir el escritor (los internos, como «borrar», no).
  IF p_tipo NOT IN ('prueba', 'sonido', 'portada', 'fondo') THEN
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

  IF p_tipo = 'sonido' THEN
    IF NOT (SELECT es_ficcion FROM libros WHERE id = p_libro) THEN
      RAISE EXCEPTION 'Los libros de no ficción no llevan efectos.' USING ERRCODE = '22023', HINT = 'no_ficcion';
    END IF;
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
    -- «sujeto»: lo que sale, escrito por el escritor. «color» solo en la portada.
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k
                WHERE k NOT IN ('sujeto', 'color') OR (k = 'color' AND p_tipo = 'fondo'))
       OR jsonb_typeof(v_params -> 'sujeto') IS DISTINCT FROM 'string'
       OR length(btrim(v_params ->> 'sujeto')) NOT BETWEEN 3 AND 400
       OR (p_tipo = 'portada' AND coalesce(v_params ->> 'color', '') !~ '^#[0-9a-fA-F]{6}$') THEN
      RAISE EXCEPTION 'Cuéntanos qué quieres que salga (entre 3 y 400 letras).' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := (v_precios ->> p_tipo)::numeric;
  END IF;

  -- Reservar del cupón (bloqueando la fila: dos pedidos a la vez no gastan dos veces).
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
