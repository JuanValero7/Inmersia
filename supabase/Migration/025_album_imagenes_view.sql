-- =============================================================
-- INMERSIA — album_imagenes: vista de imágenes por libro y capítulo
--
-- Une elementos_interactivos → parrafos → capitulos → biblioteca_media
-- para exponer imágenes (tipo='imagen') con su capitulo_numero y libro_id.
-- Permite filtrar client-side: capitulo_numero < capActual para revelar
-- solo las imágenes desbloqueadas en el Álbum.
-- =============================================================

CREATE OR REPLACE VIEW album_imagenes AS
SELECT DISTINCT ON (c.libro_id, bm.id)
  c.libro_id,
  c.numero    AS capitulo_numero,
  bm.id       AS media_id,
  bm.url,
  bm.titulo,
  bm.slug
FROM elementos_interactivos ei
JOIN parrafos       p  ON p.id  = ei.parrafo_id
JOIN capitulos      c  ON c.id  = p.capitulo_id
JOIN biblioteca_media bm ON bm.id = ei.media_id
WHERE bm.tipo = 'imagen'
ORDER BY c.libro_id, bm.id, c.numero;

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────
SELECT libro_id, capitulo_numero, url, titulo, slug
FROM album_imagenes
LIMIT 5;
