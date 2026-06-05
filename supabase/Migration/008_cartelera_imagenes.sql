-- =============================================================
-- INMERSIA — Imagenes en cartelera_items via biblioteca_media
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Ejecutar DESPUES de 007_view_media_con_libro.sql
--
-- Cambios:
--   1. cartelera_items.imagen_media_id → FK a biblioteca_media
--      (consistente con como linkeamos audio en parrafos via
--      elementos_interactivos.media_id).
--   2. Drop de la columna vieja imagen_url (nunca se uso).
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Nueva columna FK a biblioteca_media
--    ON DELETE SET NULL: si se borra la media del catalogo, el
--    item de cartelera queda sin imagen pero no se borra.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cartelera_items
  ADD COLUMN IF NOT EXISTS imagen_media_id UUID
    REFERENCES biblioteca_media(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cartelera_items_imagen_media
  ON cartelera_items (imagen_media_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Drop de la columna vieja imagen_url
--    Estaba en el schema 001 pero nunca se llenó. La reemplaza
--    imagen_media_id (que apunta al catalogo unificado).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cartelera_items
  DROP COLUMN IF EXISTS imagen_url;

-- ─────────────────────────────────────────────────────────────
-- 3. Verificacion
-- ─────────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'cartelera_items'
ORDER BY ordinal_position;
