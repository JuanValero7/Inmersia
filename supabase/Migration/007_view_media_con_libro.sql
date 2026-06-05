-- =============================================================
-- INMERSIA — media_por_parrafo: agregar libro_id y capitulo_id
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Ejecutar DESPUES de 006_principito_en_catalogo.sql
--
-- Motivo:
--   El Lector traia toda la media de un libro filtrando por
--   parrafo_id IN (lista de N UUIDs). Con libros largos esa URL
--   excede el limite de PostgREST y la request falla con 400.
--
--   Solucion: incluir libro_id y capitulo_id en la vista, asi se
--   filtra con .eq('libro_id', X) — una sola condicion corta.
-- =============================================================

-- CREATE OR REPLACE no permite reordenar/renombrar columnas existentes.
-- Como cambiamos el orden (agregamos capitulo_id y libro_id antes de
-- media_id), hay que dropear y recrear.
DROP VIEW IF EXISTS media_por_parrafo;

CREATE VIEW media_por_parrafo AS
SELECT DISTINCT ON (parrafo_id, media_id)
  parrafo_id,
  capitulo_id,
  libro_id,
  media_id,
  slug,
  tipo,
  url,
  titulo,
  descripcion,
  metadata,
  origen
FROM (
  -- Fuente A: link explicito
  SELECT
    p.id          AS parrafo_id,
    p.capitulo_id AS capitulo_id,
    p.libro_id    AS libro_id,
    bm.id         AS media_id,
    bm.slug,
    bm.tipo,
    bm.url,
    bm.titulo,
    bm.descripcion,
    bm.metadata,
    'explicito'::TEXT AS origen,
    1 AS prio
  FROM elementos_interactivos ei
  JOIN parrafos          p  ON p.id  = ei.parrafo_id
  JOIN biblioteca_media  bm ON bm.id = ei.media_id

  UNION ALL

  -- Fuente B: match por tags
  SELECT
    p.id          AS parrafo_id,
    p.capitulo_id AS capitulo_id,
    p.libro_id    AS libro_id,
    bm.id         AS media_id,
    bm.slug,
    bm.tipo,
    bm.url,
    bm.titulo,
    bm.descripcion,
    bm.metadata,
    'tag'::TEXT AS origen,
    2 AS prio
  FROM parrafos         p
  JOIN biblioteca_media bm ON bm.tags && p.escena_tags
  WHERE array_length(p.escena_tags, 1) > 0
) AS fuentes
ORDER BY parrafo_id, media_id, prio;
