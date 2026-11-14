-- =============================================================
-- INMERSIA — Migración 111
-- Rincón del escritor: corregir el texto de una infografía (fase 3) y
-- Análisis = cartelera editable (fase 4)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 110.
--
-- QUÉ HACE (Juan, 13 nov 2026)
--   1 · «infografia_texto» (GRATIS): el escritor corrige título, idea
--       central y puntos; el PC vuelve a pintar la misma plantilla (sin IA)
--       y reemplaza la imagen (si estaba guardada, también en el lector).
--   2 · «cartelera» (5 $, como los otros análisis; Juan, 13 nov): el PC corre
--       extraer_cartelera.py (ficción) o extraer_cartelera_noficcion.py y la
--       carga en cartelera_items de ESTE libro (por id, no por título).
--       Volver a generarla reemplaza la anterior, ediciones incluidas.
--   3 · Edición: el escritor cambia todo lo de SU cartelera, solo por RPC
--       (el navegador no escribe la tabla). Personajes y lugares son
--       «fichas» (una fila por capítulo en el que cambia: lo que sabe el
--       lector al terminar ese capítulo); el resto, filas sueltas.
--   4 · Imágenes en las fichas: las guardadas de personaje/lugar se pegan
--       solas a la ficha con el mismo nombre (o alias); también a mano.
--   5 · Leer la cartelera: ahora solo si se puede leer el libro (antes
--       USING (true): con el id se leía la de un libro de escritor sin
--       publicar).
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


CREATE OR REPLACE FUNCTION public.precios_escritor() RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $fn$
  SELECT '{"sonido_analisis": 5.00, "sonido_nuevo": 0.15, "sonido_max_efectos": 12,
           "portada": 0.00, "fondo": 1.00,
           "ilustracion": 0.50, "rehacer": 0.25, "ilustraciones_analisis": 5.00,
           "infografia": 0.50, "infografia_texto": 0.00, "cartelera": 5.00}'::jsonb;
$fn$;

ALTER TABLE public.trabajos DROP CONSTRAINT IF EXISTS trabajos_tipo_check;
ALTER TABLE public.trabajos ADD CONSTRAINT trabajos_tipo_check
  CHECK (tipo IN ('prueba', 'borrar', 'sonido', 'portada', 'fondo',
                  'ilustraciones_analisis', 'ilustraciones', 'rehacer', 'infografias',
                  'infografia_texto', 'cartelera'));


-- ═════════════════════════════════════════════════════════════
-- 5. Leer la cartelera = poder leer el libro (la política de libros decide)
-- ═════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS cartelera_select ON public.cartelera_items;
CREATE POLICY cartelera_select ON public.cartelera_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.libros l WHERE l.id = cartelera_items.libro_id));

DROP POLICY IF EXISTS cartelera_principal_select ON public.cartelera_principal;
CREATE POLICY cartelera_principal_select ON public.cartelera_principal
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.libros l WHERE l.id = cartelera_principal.libro_id));


-- ═════════════════════════════════════════════════════════════
-- Ayudas
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public._libro_del_escritor(p_libro uuid) RETURNS libros
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  l libros%ROWTYPE;
BEGIN
  SELECT * INTO l FROM libros WHERE id = p_libro AND propietario_id = auth.uid();
  IF NOT FOUND OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ese libro no es tuyo o ya no existe.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;
  RETURN l;
END;
$fn$;
REVOKE ALL ON FUNCTION public._libro_del_escritor(uuid) FROM PUBLIC, anon, authenticated;

-- Secciones que puede tocar el escritor según el tipo de libro.
CREATE OR REPLACE FUNCTION public._seccion_valida(p_es_ficcion boolean, p_seccion text) RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE WHEN p_es_ficcion THEN p_seccion IN ('personajes', 'lugares', 'hechos', 'datos')
              ELSE p_seccion IN ('glosario', 'datos', 'referencias', 'resumen') END;
$fn$;

-- La foto de una imagen del escritor para ponerla en una ficha (sin capítulo).
-- Si ya tiene polaroid (escena/propia colocada), se reutiliza.
CREATE OR REPLACE FUNCTION public._media_de_imagen_escritor(p_imagen uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  i       imagenes_escritor%ROWTYPE;
  v_media uuid;
BEGIN
  SELECT * INTO i FROM imagenes_escritor WHERE id = p_imagen;
  IF i.media_id IS NOT NULL THEN RETURN i.media_id; END IF;
  INSERT INTO biblioteca_media (slug, tipo, url, titulo, metadata)
  VALUES ('escritor-' || i.id, 'imagen', i.url, coalesce(nullif(btrim(i.nombre), ''), nullif(btrim(i.pie), ''),
          (SELECT titulo FROM libros WHERE id = i.libro_id)),
          jsonb_build_object('escritor', true, 'libro_id', i.libro_id))
  ON CONFLICT (slug) DO UPDATE SET url = EXCLUDED.url
  RETURNING id INTO v_media;
  UPDATE imagenes_escritor SET media_id = v_media WHERE id = i.id;
  RETURN v_media;
END;
$fn$;
REVOKE ALL ON FUNCTION public._media_de_imagen_escritor(uuid) FROM PUBLIC, anon, authenticated;

-- Pega las imágenes guardadas de personajes/lugares a las fichas sin foto
-- que se llamen igual (o tengan ese alias). Sin tildes ni mayúsculas.
CREATE OR REPLACE FUNCTION public.enlazar_imagenes_cartelera(p_libro uuid) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  r   record;
  n   int := 0;
  k   int;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (im.tipo, lower(unaccent(btrim(im.nombre)))) im.id, im.tipo, lower(unaccent(btrim(im.nombre))) AS clave
      FROM imagenes_escritor im
     WHERE im.libro_id = p_libro AND im.estado = 'guardada' AND im.tipo IN ('personaje', 'lugar')
       AND coalesce(btrim(im.nombre), '') <> ''
     ORDER BY im.tipo, lower(unaccent(btrim(im.nombre))), im.guardado DESC
  LOOP
    WITH fichas AS (
      SELECT DISTINCT ci.nombre FROM cartelera_items ci
       WHERE ci.libro_id = p_libro AND ci.seccion = CASE r.tipo WHEN 'personaje' THEN 'personajes' ELSE 'lugares' END
         AND (lower(unaccent(btrim(ci.nombre))) = r.clave
              OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(ci.metadata -> 'aliases', '[]')) a
                          WHERE lower(unaccent(btrim(a))) = r.clave))
    ), sin_foto AS (
      SELECT f.nombre FROM fichas f
       WHERE NOT EXISTS (SELECT 1 FROM cartelera_items x WHERE x.libro_id = p_libro AND x.nombre = f.nombre
                           AND x.seccion = CASE r.tipo WHEN 'personaje' THEN 'personajes' ELSE 'lugares' END
                           AND x.imagen_media_id IS NOT NULL)
    )
    UPDATE cartelera_items ci SET imagen_media_id = _media_de_imagen_escritor(r.id)
     WHERE ci.libro_id = p_libro AND ci.seccion = CASE r.tipo WHEN 'personaje' THEN 'personajes' ELSE 'lugares' END
       AND ci.nombre IN (SELECT nombre FROM sin_foto);
    GET DIAGNOSTICS k = ROW_COUNT;
    n := n + k;
  END LOOP;
  RETURN n;
END;
$fn$;
REVOKE ALL ON FUNCTION public.enlazar_imagenes_cartelera(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enlazar_imagenes_cartelera(uuid) TO service_role;


-- ═════════════════════════════════════════════════════════════
-- Guardar imagen: igual que en la 110 + personaje/lugar → a su ficha
-- ═════════════════════════════════════════════════════════════
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
  ELSIF i.tipo = 'infografia' THEN
    DELETE FROM imagenes_escritor
     WHERE libro_id = i.libro_id AND tipo = 'infografia' AND estado = 'guardada'
       AND capitulo IS NOT DISTINCT FROM i.capitulo AND id <> i.id;
  END IF;

  UPDATE imagenes_escritor SET estado = 'guardada', guardado = now() WHERE id = i.id;

  IF i.tipo = 'portada' THEN
    UPDATE libros SET portada_url = i.url WHERE id = i.libro_id;
  ELSIF i.tipo = 'fondo' THEN
    UPDATE libros
       SET metadata = coalesce(metadata, '{}'::jsonb)
                      || jsonb_build_object('hero_url', i.url, 'hero_url_mobile', coalesce(i.url_movil, i.url))
     WHERE id = i.libro_id;
  ELSIF i.tipo IN ('escena', 'infografia') AND i.capitulo IS NOT NULL THEN
    PERFORM _colocar_imagen_escritor(i.id, i.capitulo);
  ELSIF i.tipo IN ('personaje', 'lugar') THEN
    PERFORM enlazar_imagenes_cartelera(i.libro_id);
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.guardar_imagen_escritor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_imagen_escritor(uuid) TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- 3. Editar la cartelera (todo comprueba que el libro es suyo)
-- ═════════════════════════════════════════════════════════════

-- Una fila: nueva (p_id NULL) o cambiada. En personajes/lugares el nombre
-- es el de la ficha (para renombrarla, renombrar_ficha_cartelera); una fila
-- nueva copia los alias y la foto de la ficha.
CREATE OR REPLACE FUNCTION public.guardar_item_cartelera(
  p_libro uuid, p_id uuid, p_seccion text, p_capitulo int, p_nombre text, p_descripcion text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  l       libros%ROWTYPE := _libro_del_escritor(p_libro);
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_desc   text := btrim(coalesce(p_descripcion, ''));
  v_id     uuid;
  v_ficha  cartelera_items%ROWTYPE;
BEGIN
  IF NOT _seccion_valida(l.es_ficcion, p_seccion) THEN
    RAISE EXCEPTION 'Esa sección no existe en tu libro.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF length(v_nombre) NOT BETWEEN 1 AND 200 OR length(v_desc) > 3000 THEN
    RAISE EXCEPTION 'Pon un nombre (hasta 200 letras) y una descripción de hasta 3.000.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM capitulos WHERE libro_id = p_libro AND numero = p_capitulo) THEN
    RAISE EXCEPTION 'Ese capítulo no existe.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  IF p_id IS NULL THEN
    SELECT * INTO v_ficha FROM cartelera_items
     WHERE libro_id = p_libro AND seccion = p_seccion AND nombre = v_nombre AND p_seccion IN ('personajes', 'lugares')
     ORDER BY capitulo_numero DESC LIMIT 1;
    IF FOUND AND EXISTS (SELECT 1 FROM cartelera_items WHERE libro_id = p_libro AND seccion = p_seccion
                           AND nombre = v_nombre AND capitulo_numero = p_capitulo) THEN
      RAISE EXCEPTION 'Esa ficha ya tiene una entrada en el capítulo %.', p_capitulo USING ERRCODE = '22023', HINT = 'duplicado';
    END IF;
    INSERT INTO cartelera_items (libro_id, capitulo_numero, seccion, nombre, descripcion, metadata, imagen_media_id)
    VALUES (p_libro, p_capitulo, p_seccion, v_nombre, v_desc,
            jsonb_build_object('tags', '[]'::jsonb, 'autor', true)
              || CASE WHEN v_ficha.metadata ? 'aliases' THEN jsonb_build_object('aliases', v_ficha.metadata -> 'aliases') ELSE '{}'::jsonb END,
            v_ficha.imagen_media_id)
    RETURNING id INTO v_id;
  ELSE
    UPDATE cartelera_items
       SET capitulo_numero = p_capitulo,
           nombre = CASE WHEN seccion IN ('personajes', 'lugares') THEN nombre ELSE v_nombre END,
           descripcion = v_desc,
           metadata = coalesce(metadata, '{}'::jsonb) || '{"editado": true}'::jsonb
     WHERE id = p_id AND libro_id = p_libro AND seccion = p_seccion
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Esa entrada ya no está.' USING ERRCODE = 'P0002', HINT = 'item_invalido';
    END IF;
  END IF;
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.borrar_item_cartelera(p_libro uuid, p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  DELETE FROM cartelera_items WHERE id = p_id AND libro_id = p_libro;
END;
$fn$;

-- Ficha entera (personajes/lugares): nombre, alias, foto; o borrarla.
CREATE OR REPLACE FUNCTION public.renombrar_ficha_cartelera(
  p_libro uuid, p_seccion text, p_nombre text, p_nuevo text, p_aliases jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  l       libros%ROWTYPE := _libro_del_escritor(p_libro);
  v_nuevo text := btrim(coalesce(p_nuevo, ''));
BEGIN
  IF p_seccion NOT IN ('personajes', 'lugares') OR NOT l.es_ficcion THEN
    RAISE EXCEPTION 'Solo personajes y lugares tienen ficha.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF length(v_nuevo) NOT BETWEEN 1 AND 200
     OR jsonb_typeof(coalesce(p_aliases, '[]')) <> 'array' OR jsonb_array_length(coalesce(p_aliases, '[]')) > 20
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_aliases, '[]')) a
                 WHERE jsonb_typeof(a) <> 'string' OR length(a #>> '{}') NOT BETWEEN 1 AND 120) THEN
    RAISE EXCEPTION 'Revisa el nombre y los alias.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF v_nuevo <> p_nombre AND EXISTS (SELECT 1 FROM cartelera_items WHERE libro_id = p_libro
                                        AND seccion = p_seccion AND nombre = v_nuevo) THEN
    RAISE EXCEPTION 'Ya hay una ficha que se llama así.' USING ERRCODE = '22023', HINT = 'duplicado';
  END IF;
  UPDATE cartelera_items
     SET nombre = v_nuevo,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('aliases', coalesce(p_aliases, '[]'), 'editado', true)
   WHERE libro_id = p_libro AND seccion = p_seccion AND nombre = p_nombre;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.borrar_ficha_cartelera(p_libro uuid, p_seccion text, p_nombre text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  DELETE FROM cartelera_items WHERE libro_id = p_libro AND seccion = p_seccion AND nombre = p_nombre;
END;
$fn$;

-- p_imagen: una imagen GUARDADA de este libro (personaje, lugar, escena o
-- propia), o NULL para quitar la foto.
CREATE OR REPLACE FUNCTION public.imagen_ficha_cartelera(p_libro uuid, p_seccion text, p_nombre text, p_imagen uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_media uuid;
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  IF p_imagen IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM imagenes_escritor WHERE id = p_imagen AND libro_id = p_libro AND estado = 'guardada'
                     AND tipo IN ('personaje', 'lugar', 'escena', 'propia')) THEN
      RAISE EXCEPTION 'Esa imagen no está guardada en tu libro.' USING ERRCODE = '22023', HINT = 'imagen_invalida';
    END IF;
    v_media := _media_de_imagen_escritor(p_imagen);
  END IF;
  UPDATE cartelera_items SET imagen_media_id = v_media
   WHERE libro_id = p_libro AND seccion = p_seccion AND nombre = p_nombre;
END;
$fn$;

REVOKE ALL ON FUNCTION public.guardar_item_cartelera(uuid, uuid, text, int, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.borrar_item_cartelera(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.renombrar_ficha_cartelera(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.borrar_ficha_cartelera(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.imagen_ficha_cartelera(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_item_cartelera(uuid, uuid, text, int, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.borrar_item_cartelera(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renombrar_ficha_cartelera(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.borrar_ficha_cartelera(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.imagen_ficha_cartelera(uuid, text, text, uuid) TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- pedir_trabajo: igual que en la 110 + «infografia_texto» y «cartelera»
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
  IF p_tipo NOT IN ('prueba', 'sonido', 'portada', 'fondo', 'ilustraciones_analisis', 'ilustraciones', 'rehacer',
                    'infografias', 'infografia_texto', 'cartelera') THEN
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
