-- =============================================================
-- INMERSIA — Migración 112
-- Rincón del escritor, fase 4: «Portada del tablero» (solo ficción)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 111 (_libro_del_escritor, _media_de_imagen_escritor).
--
-- QUÉ HACE (Juan, 13 nov 2026)
--   El escritor elige la imagen principal de los tres paneles del tablero
--   (Personajes, Lugares, Hechos) entre las que GUARDÓ en la Sala de
--   imágenes. Va a cartelera_principal, como las del catálogo. Sin generar
--   aparte (decisión del 12 nov: el costo va dentro de la cartelera).
--   Si luego borra esa imagen, el panel se queda sin ella (FK SET NULL).
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================

CREATE OR REPLACE FUNCTION public.imagen_principal_cartelera(p_libro uuid, p_seccion text, p_imagen uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  l       libros%ROWTYPE := _libro_del_escritor(p_libro);
  v_media uuid;
BEGIN
  IF NOT l.es_ficcion OR p_seccion NOT IN ('personajes', 'lugares', 'hechos') THEN
    RAISE EXCEPTION 'Ese panel no existe en tu tablero.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  IF p_imagen IS NULL THEN
    DELETE FROM cartelera_principal WHERE libro_id = p_libro AND seccion = p_seccion;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM imagenes_escritor WHERE id = p_imagen AND libro_id = p_libro AND estado = 'guardada'
                   AND tipo IN ('personaje', 'lugar', 'escena', 'propia')) THEN
    RAISE EXCEPTION 'Esa imagen no está guardada en tu libro.' USING ERRCODE = '22023', HINT = 'imagen_invalida';
  END IF;
  v_media := _media_de_imagen_escritor(p_imagen);

  INSERT INTO cartelera_principal (libro_id, seccion, imagen_media_id, metadata)
  VALUES (p_libro, p_seccion, v_media, '{"autor": true}'::jsonb)
  ON CONFLICT (libro_id, seccion) DO UPDATE SET imagen_media_id = EXCLUDED.imagen_media_id, video_media_id = NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.imagen_principal_cartelera(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.imagen_principal_cartelera(uuid, text, uuid) TO authenticated;
