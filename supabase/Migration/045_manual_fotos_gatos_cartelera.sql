-- =============================================================
-- INMERSIA — Manual del Explorador: fotos de los tres gatos en la Cartelera
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Los personajes del Manual (Yuri, Mancha, Katana) estaban sembrados solo con
-- texto: `cartelera_items.imagen_media_id` en NULL, así que la ficha de cada uno
-- salía sin la polaroid. Las tres imágenes YA están subidas a Storage y ya
-- tienen su fila en biblioteca_media (son las mismas que usan las placas de
-- cartelera_principal), así que acá solo se enlazan:
--
--   Yuri   → gato naranja  (manual_del_explorador_principal_personajes)
--   Mancha → gato blanco   (manual_del_explorador_principal_lugares)
--   Katana → gato negro    (manual_del_explorador_principal_hechos)
--
-- Se reusan A PROPÓSITO las media de `..._principal_*` y no la copia
-- `manual_capitulo_katana`: useAlbum descarta de las secciones del Álbum todo lo
-- que se llame igual que una imagen hero (`sinHero`, por título normalizado).
-- Con estos títulos —"Gato naranja"/"Gato blanco"/"Gato negro"— los tres quedan
-- fuera del Álbum, que es lo correcto: ahí ya están como placa de sección, y la
-- copia "Katana" ya ocupa su lugar en Capítulos (ver migración 044). Si se
-- enlazara Katana a `manual_capitulo_katana`, la misma barajita aparecería
-- duplicada en Personajes y en Capítulos.
--
-- Idempotente: se puede correr las veces que sea.
-- =============================================================

DO $$
DECLARE
  manual_id UUID := '00000000-0000-4000-8000-000000000001';
  faltan    INT;
BEGIN

-- Aviso temprano y claro si alguna media no está donde se espera
SELECT 3 - COUNT(*) INTO faltan
FROM biblioteca_media
WHERE slug IN (
  'manual_del_explorador_principal_personajes',
  'manual_del_explorador_principal_lugares',
  'manual_del_explorador_principal_hechos'
);

IF faltan > 0 THEN
  RAISE EXCEPTION 'Faltan % de las 3 imágenes de portada del Manual en biblioteca_media.', faltan;
END IF;

UPDATE cartelera_items ci
   SET imagen_media_id = bm.id
  FROM biblioteca_media bm
 WHERE ci.libro_id = manual_id
   AND ci.seccion  = 'personajes'
   AND bm.slug = CASE ci.nombre
                   WHEN 'Yuri'   THEN 'manual_del_explorador_principal_personajes'
                   WHEN 'Mancha' THEN 'manual_del_explorador_principal_lugares'
                   WHEN 'Katana' THEN 'manual_del_explorador_principal_hechos'
                 END;

END $$;

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN — las tres filas con su imagen enlazada
-- ─────────────────────────────────────────────────────────────
SELECT ci.nombre, bm.titulo AS imagen, bm.url
FROM cartelera_items ci
LEFT JOIN biblioteca_media bm ON bm.id = ci.imagen_media_id
WHERE ci.libro_id = '00000000-0000-4000-8000-000000000001'
  AND ci.seccion  = 'personajes'
ORDER BY ci.nombre;
