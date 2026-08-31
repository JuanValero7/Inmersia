-- =============================================================
-- INMERSIA — Manual del Explorador: devolver el gato negro a Capítulos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- ⚠️  Ejecutar DESPUÉS de 036_manual_parrafos_v2.sql. Esa migración borra los
--     párrafos de los capítulos 1 y 2, y el borrado CASCADEA a
--     elementos_interactivos: si se vuelve a correr 036, hay que correr esta
--     otra vez detrás. Eso es exactamente lo que dejó rota la sección.
--
-- EL PROBLEMA
--   En el Álbum, la sección "Capítulos" del Manual salía vacía ("0 de 0", con la
--   casilla fantasma "Pega tu barajita"). Esa sección se alimenta de la vista
--   `album_imagenes` (elementos_interactivos → párrafos → capítulos → media), y
--   para el Manual no tenía ni una fila.
--
--   La media SIGUE existiendo y el archivo sigue en Storage: es
--   `manual_capitulo_katana` ("Katana", .../Manual del Explorador/Capitulos/
--   katana.webp), la copia del gato negro que se subió aparte justo para que el
--   Álbum no la confundiera con la placa de cartelera_principal.hechos ("Gato
--   negro") — useAlbum descarta de Capítulos todo lo que se llame igual que una
--   imagen hero (`sinHero`, compara por título normalizado).
--   Lo único que se perdió fue el LINK párrafo ↔ media. Esta migración lo rehace.
--
--   El link va al ÚLTIMO párrafo del capítulo 1 (antes estaba en el primero):
--   es lo que promete el propio Manual en el cap. 1 — "Al final de cada capítulo
--   aparecerá una imagen, recreando la escena más memorable de esa parte del
--   libro" — así que como polaroid del Lector cae donde corresponde. Para el
--   Álbum da igual: lo que cuenta es el capítulo, no el párrafo.
--
-- También corrige un voseo en la ficha de Katana ("esperás" → "esperas"): el
-- copy de Inmersia es español de Venezuela, y ese texto lo ve todo usuario nuevo
-- durante el tutorial.
--
-- Idempotente: se puede correr las veces que sea.
-- =============================================================

DO $$
DECLARE
  manual_id   UUID := '00000000-0000-4000-8000-000000000001';
  cap1_id     UUID := '00000000-0000-4000-8000-000000000002';
  katana_id   UUID;
  parrafo_fin UUID;
BEGIN

-- ── 1. La media ya existe: solo se busca ──
SELECT id INTO katana_id
FROM biblioteca_media
WHERE slug = 'manual_capitulo_katana';

IF katana_id IS NULL THEN
  RAISE EXCEPTION 'No existe la media manual_capitulo_katana. Hay que volver a subir la imagen del gato negro de Capítulos.';
END IF;

-- ── 2. Último párrafo del capítulo 1 ──
SELECT id INTO parrafo_fin
FROM parrafos
WHERE capitulo_id = cap1_id
ORDER BY numero DESC
LIMIT 1;

IF parrafo_fin IS NULL THEN
  RAISE EXCEPTION 'El capítulo 1 del Manual no tiene párrafos. Corre antes 036_manual_parrafos_v2.sql.';
END IF;

-- ── 3. Rehacer el link (y limpiar cualquier link viejo a otro párrafo del
--       mismo capítulo, para no terminar con la imagen repetida) ──
DELETE FROM elementos_interactivos ei
USING parrafos p
WHERE ei.parrafo_id = p.id
  AND p.capitulo_id = cap1_id
  AND ei.media_id   = katana_id
  AND ei.parrafo_id <> parrafo_fin;

INSERT INTO elementos_interactivos (parrafo_id, media_id, metadata)
VALUES (parrafo_fin, katana_id, '{"alt": "Katana, el gato negro de Inmersia"}'::jsonb)
ON CONFLICT (parrafo_id, media_id) DO NOTHING;

UPDATE parrafos SET tiene_interactivo = TRUE WHERE id = parrafo_fin;

-- ── 4. Voseo → tuteo en la ficha de Katana ──
UPDATE cartelera_items
   SET descripcion = 'El gato negro: elegante y misterioso, aparece cuando menos lo esperas para acompañarte en la lectura.'
 WHERE libro_id = manual_id AND seccion = 'personajes' AND nombre = 'Katana';

END $$;

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN — debe devolver UNA fila: capitulo_numero = 1, titulo 'Katana'
-- ─────────────────────────────────────────────────────────────
SELECT capitulo_numero, titulo, slug, url
FROM album_imagenes
WHERE libro_id = '00000000-0000-4000-8000-000000000001';
