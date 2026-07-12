-- =============================================================
-- INMERSIA — Índice parcial para cartelera_items con imagen
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Contexto:
--   useAlbum.js (sección Personajes/Lugares del Álbum) ahora filtra
--   `WHERE libro_id IN (...) AND imagen_media_id IS NOT NULL` — solo
--   cuenta/muestra barajitas que ya tienen imagen real vinculada.
--   Sin este índice, ese filtro cae al índice existente sobre
--   `imagen_media_id` (idx_cartelera_items_imagen_media, migración 008)
--   que no está pensado para el patrón "por libro + con imagen".
--
--   Índice parcial (solo indexa filas con imagen_media_id NOT NULL):
--   liviano y crece con el catálogo curado, no con filas vacías.
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_cartelera_items_libro_con_imagen
  ON cartelera_items (libro_id)
  WHERE imagen_media_id IS NOT NULL;
