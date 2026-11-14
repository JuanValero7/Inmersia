-- =============================================================
-- INMERSIA — Migración 107
-- Rincón del escritor, fase 3 (parte 2): Mis imágenes
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 106 (imagenes_escritor, bucket «escritores», archivos_por_borrar).
--
-- QUÉ HACE (maqueta pantallas 6b/6c; decisiones de Juan, 12–13 nov 2026)
--   · El escritor sube sus imágenes, gratis: hasta 20 GUARDADAS por libro
--     (borrar una libera el hueco). El navegador las pasa a WebP y las sube
--     directo a su carpeta del bucket: «<su id>/<id del libro>/<uuid>.webp».
--     Solo puede subir ahí, y solo a libros suyos (política de Storage).
--   · registrar_imagen_propia(): la apunta en imagenes_escritor, comprobando
--     que el archivo existe, que es suyo y el tope de 20.
--   · Dónde va: un capítulo (o ninguno por ahora). En un capítulo se ve en
--     el lector como polaroid, igual que las ilustraciones de siempre: una
--     fila en biblioteca_media + elementos_interactivos en el párrafo N-5
--     del capítulo (la misma regla que upload.py). El pie es el título de
--     la polaroid. Personaje y lugar llegan con la cartelera (fase 4).
--   · _colocar_imagen_escritor() lo hace y deshace; la usarán también las
--     escenas generadas (fase 3, parte 3).
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. La imagen recuerda su polaroid
-- ═════════════════════════════════════════════════════════════
ALTER TABLE public.imagenes_escritor
  ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES public.biblioteca_media(id) ON DELETE SET NULL;


-- ═════════════════════════════════════════════════════════════
-- 2. Subir: solo a su carpeta y a libros suyos
-- ═════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS escritores_subir_propias ON storage.objects;
CREATE POLICY escritores_subir_propias ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'escritores'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND EXISTS (SELECT 1 FROM public.libros l
                 WHERE l.id::text = (storage.foldername(name))[2]
                   AND l.propietario_id = (SELECT auth.uid()))
    AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
  );


-- ═════════════════════════════════════════════════════════════
-- 3. Colocar (o quitar) la polaroid de una imagen en un capítulo
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public._colocar_imagen_escritor(p_imagen uuid, p_capitulo int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  i        imagenes_escritor%ROWTYPE;
  v_cap    uuid;
  v_parr   uuid;
  v_media  uuid;
  v_titulo text;
BEGIN
  SELECT * INTO i FROM imagenes_escritor WHERE id = p_imagen;
  IF NOT FOUND THEN RETURN; END IF;

  -- Fuera la polaroid anterior (elementos_interactivos se va en cascada).
  IF i.media_id IS NOT NULL THEN
    UPDATE imagenes_escritor SET media_id = NULL WHERE id = i.id;
    DELETE FROM biblioteca_media WHERE id = i.media_id;
  END IF;

  IF p_capitulo IS NULL THEN
    UPDATE imagenes_escritor SET capitulo = NULL WHERE id = i.id;
    RETURN;
  END IF;

  SELECT id INTO v_cap FROM capitulos WHERE libro_id = i.libro_id AND numero = p_capitulo;
  IF v_cap IS NULL THEN
    RAISE EXCEPTION 'Ese capítulo no existe.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  -- Párrafo N-5 (o el primero si hay menos de 5), como upload.py.
  SELECT id INTO v_parr FROM parrafos WHERE capitulo_id = v_cap
   ORDER BY numero DESC OFFSET 4 LIMIT 1;
  IF v_parr IS NULL THEN
    SELECT id INTO v_parr FROM parrafos WHERE capitulo_id = v_cap ORDER BY numero LIMIT 1;
  END IF;

  v_titulo := coalesce(nullif(btrim(i.pie), ''), (SELECT titulo FROM libros WHERE id = i.libro_id));
  INSERT INTO biblioteca_media (slug, tipo, url, titulo, metadata)
  VALUES ('escritor-' || i.id, 'imagen', i.url, v_titulo,
          jsonb_build_object('escritor', true, 'libro_id', i.libro_id))
  ON CONFLICT (slug) DO UPDATE SET url = EXCLUDED.url, titulo = EXCLUDED.titulo
  RETURNING id INTO v_media;

  INSERT INTO elementos_interactivos (parrafo_id, media_id) VALUES (v_parr, v_media);
  UPDATE imagenes_escritor SET media_id = v_media, capitulo = p_capitulo WHERE id = i.id;
END;
$fn$;
REVOKE ALL ON FUNCTION public._colocar_imagen_escritor(uuid, int) FROM PUBLIC, anon, authenticated;


-- Al borrar una imagen, también su polaroid (además de sus archivos, 106).
CREATE OR REPLACE FUNCTION public._imagen_escritor_borrada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  INSERT INTO archivos_por_borrar (ruta) SELECT unnest(OLD.rutas) ON CONFLICT DO NOTHING;
  IF OLD.media_id IS NOT NULL THEN
    DELETE FROM biblioteca_media WHERE id = OLD.media_id;
  END IF;
  RETURN OLD;
END;
$fn$;
REVOKE ALL ON FUNCTION public._imagen_escritor_borrada() FROM PUBLIC, anon, authenticated;


-- ═════════════════════════════════════════════════════════════
-- 4. Lo que llama el escritor
-- ═════════════════════════════════════════════════════════════

-- Apunta una imagen recién subida. p_url es la pública que da Storage; se
-- comprueba que corresponde a p_ruta.
CREATE OR REPLACE FUNCTION public.registrar_imagen_propia(
  p_libro uuid, p_ruta text, p_url text, p_capitulo int DEFAULT NULL, p_pie text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM libros WHERE id = p_libro AND propietario_id = v_uid) THEN
    RAISE EXCEPTION 'Ese libro no es tuyo o ya no existe.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;
  IF p_ruta !~ ('^' || v_uid || '/' || p_libro || '/[0-9a-f-]{36}\.webp$')
     OR p_url IS NULL OR right(p_url, length('/storage/v1/object/public/escritores/' || p_ruta))
                         <> '/storage/v1/object/public/escritores/' || p_ruta
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'escritores' AND name = p_ruta) THEN
    RAISE EXCEPTION 'No encontramos la imagen subida.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF length(coalesce(p_pie, '')) > 200 THEN
    RAISE EXCEPTION 'El pie de imagen es demasiado largo (máximo 200 letras).' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('imagenes_propias:' || p_libro));
  IF (SELECT count(*) FROM imagenes_escritor WHERE libro_id = p_libro AND tipo = 'propia') >= 20 THEN
    -- El archivo ya subido no se queda huérfano.
    INSERT INTO archivos_por_borrar (ruta) VALUES (p_ruta) ON CONFLICT DO NOTHING;
    RAISE EXCEPTION 'Ya tienes 20 imágenes propias en este libro. Borra alguna para subir otra.'
      USING ERRCODE = '42501', HINT = 'limite_imagenes';
  END IF;

  INSERT INTO imagenes_escritor (libro_id, tipo, estado, url, rutas, pie, guardado)
  VALUES (p_libro, 'propia', 'guardada', p_url, ARRAY[p_ruta], nullif(btrim(p_pie), ''), now())
  RETURNING id INTO v_id;

  PERFORM _colocar_imagen_escritor(v_id, p_capitulo);
  RETURN v_id;
END;
$fn$;

-- Cambiar a qué capítulo va y el pie (imágenes propias; las escenas, en la parte 3).
CREATE OR REPLACE FUNCTION public.actualizar_imagen_escritor(p_imagen uuid, p_capitulo int, p_pie text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  i imagenes_escritor%ROWTYPE;
BEGIN
  SELECT im.* INTO i FROM imagenes_escritor im JOIN libros l ON l.id = im.libro_id
   WHERE im.id = p_imagen AND l.propietario_id = auth.uid();
  IF NOT FOUND OR i.tipo NOT IN ('propia', 'escena') OR i.estado <> 'guardada' THEN
    RAISE EXCEPTION 'Esa imagen no es de tu libro.' USING ERRCODE = 'P0002', HINT = 'imagen_invalida';
  END IF;
  IF length(coalesce(p_pie, '')) > 200 THEN
    RAISE EXCEPTION 'El pie de imagen es demasiado largo (máximo 200 letras).' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  UPDATE imagenes_escritor SET pie = nullif(btrim(p_pie), '') WHERE id = i.id;
  PERFORM _colocar_imagen_escritor(i.id, p_capitulo);
END;
$fn$;

REVOKE ALL ON FUNCTION public.registrar_imagen_propia(uuid, text, text, int, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.actualizar_imagen_escritor(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_imagen_propia(uuid, text, text, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_imagen_escritor(uuid, int, text) TO authenticated;
