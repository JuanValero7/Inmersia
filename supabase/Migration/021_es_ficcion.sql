-- =============================================================
-- INMERSIA — Columna es_ficcion en libros
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- TRUE  = ficción   (default — protege libros existentes)
-- FALSE = no ficción
-- =============================================================

ALTER TABLE libros
  ADD COLUMN IF NOT EXISTS es_ficcion BOOLEAN NOT NULL DEFAULT TRUE;
