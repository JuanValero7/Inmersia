-- =============================================================
-- INMERSIA — Biblioteca de media reutilizable
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Ejecutar DESPUES de 001_schema_libros.sql
--
-- Cambios:
--   1. Nueva tabla biblioteca_media (catalogo de sonidos/imagenes
--      reutilizables, identificados por slug).
--   2. parrafos.escena_tags: tags de la escena para match automatico.
--   3. elementos_interactivos pasa de (parrafo, url, tipo) a
--      (parrafo, media_id) — solo es el link, la media vive en
--      biblioteca_media.
--   4. Vista media_por_parrafo: une links explicitos + matches por tag.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. BIBLIOTECA DE MEDIA
--    Catalogo unico de sonidos/imagenes/videos.
--    Cada item se sube UNA vez a Storage y se reutiliza en N
--    parrafos de N libros, identificado por slug.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biblioteca_media (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        UNIQUE NOT NULL,    -- "desierto", "lluvia_suave"
  tipo        TEXT        NOT NULL CHECK (tipo IN ('audio','imagen','video')),
  url         TEXT        NOT NULL,            -- URL publica de Storage
  titulo      TEXT,
  descripcion TEXT,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
                          -- {"naturaleza","ambiente","exterior"}
  metadata    JSONB       NOT NULL DEFAULT '{}',
                          -- audio: {"duracion_segundos": 45, "loop": true}
                          -- imagen: {"alt": "...", "ancho": 800}
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 2. TAGS DE ESCENA EN PARRAFOS
--    Permite match automatico: si un parrafo tiene
--    escena_tags = {'desierto','noche'} y existe media con
--    tags que solapan, se reproduce.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE parrafos
  ADD COLUMN IF NOT EXISTS escena_tags TEXT[] NOT NULL DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────
-- 3. REFACTOR elementos_interactivos
--    Antes: cada fila tenia su propia url+tipo+titulo (1:1).
--    Ahora: cada fila es solo un LINK parrafo ↔ media reutilizable.
--    Como aun no se insertaron elementos, droppeamos las columnas
--    viejas directo. Si hubiera datos, primero habria que migrar.
-- ─────────────────────────────────────────────────────────────

-- La vista 001 referencia ei.tipo / ei.url; hay que tirarla antes
-- de eliminar esas columnas y la recreamos al final.
DROP VIEW IF EXISTS elementos_con_contexto;

ALTER TABLE elementos_interactivos
  ADD COLUMN IF NOT EXISTS media_id UUID
    REFERENCES biblioteca_media(id) ON DELETE CASCADE;

ALTER TABLE elementos_interactivos
  DROP COLUMN IF EXISTS tipo,
  DROP COLUMN IF EXISTS url,
  DROP COLUMN IF EXISTS titulo,
  DROP COLUMN IF EXISTS descripcion;

ALTER TABLE elementos_interactivos
  ALTER COLUMN media_id SET NOT NULL;

-- Evita duplicar la misma media en el mismo parrafo
ALTER TABLE elementos_interactivos
  DROP CONSTRAINT IF EXISTS elementos_interactivos_parrafo_media_unique;
ALTER TABLE elementos_interactivos
  ADD CONSTRAINT elementos_interactivos_parrafo_media_unique
  UNIQUE (parrafo_id, media_id);

-- ─────────────────────────────────────────────────────────────
-- 4. INDICES
-- ─────────────────────────────────────────────────────────────

-- Lookup por slug (insertar links desde script: SELECT id WHERE slug=…)
CREATE INDEX IF NOT EXISTS idx_biblioteca_media_slug
  ON biblioteca_media (slug);

-- Tag overlap (GIN es el indice para operadores de array && @> <@)
CREATE INDEX IF NOT EXISTS idx_biblioteca_media_tags
  ON biblioteca_media USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_parrafos_escena_tags
  ON parrafos USING GIN (escena_tags);

-- "Que parrafos usan X sonido" (admin / debugging)
CREATE INDEX IF NOT EXISTS idx_interactivos_media
  ON elementos_interactivos (media_id);

-- ─────────────────────────────────────────────────────────────
-- 5. VISTA: media efectiva por parrafo
--    Une las dos fuentes — link explicito y match por tag — y
--    deduplica priorizando el explicito (origen='explicito').
--    El lector consulta esta vista por parrafo_id y obtiene
--    todo lo que tiene que reproducir.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW media_por_parrafo AS
SELECT DISTINCT ON (parrafo_id, media_id)
  parrafo_id,
  media_id,
  slug,
  tipo,
  url,
  titulo,
  descripcion,
  metadata,
  origen
FROM (
  -- Fuente A: link explicito (elementos_interactivos)
  SELECT
    p.id   AS parrafo_id,
    bm.id  AS media_id,
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

  -- Fuente B: match automatico por tags (escena_tags && bm.tags)
  SELECT
    p.id   AS parrafo_id,
    bm.id  AS media_id,
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

-- ─────────────────────────────────────────────────────────────
-- 6. RECREAR vista elementos_con_contexto
--    (la version vieja referenciaba columnas que ya no existen
--    en elementos_interactivos)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW elementos_con_contexto AS
SELECT
  ei.id,
  bm.slug,
  bm.tipo,
  bm.url,
  bm.titulo,
  bm.descripcion,
  bm.metadata,
  p.id        AS parrafo_id,
  p.numero    AS parrafo_numero,
  p.contenido AS parrafo_contenido,
  c.id        AS capitulo_id,
  c.numero    AS capitulo_numero,
  c.titulo    AS capitulo_titulo,
  l.id        AS libro_id,
  l.titulo    AS libro_titulo
FROM elementos_interactivos ei
JOIN biblioteca_media bm ON bm.id = ei.media_id
JOIN parrafos         p  ON p.id  = ei.parrafo_id
JOIN capitulos        c  ON c.id  = p.capitulo_id
JOIN libros           l  ON l.id  = c.libro_id;

-- ─────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE biblioteca_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "biblioteca_media_select" ON biblioteca_media;
CREATE POLICY "biblioteca_media_select"
  ON biblioteca_media FOR SELECT TO authenticated USING (true);
