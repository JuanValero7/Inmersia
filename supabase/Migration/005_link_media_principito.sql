-- =============================================================
-- INMERSIA — Link de media a parrafos de El Principito
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Ejecutar DESPUES de 004_seed_biblioteca_media.sql
--
-- Estrategias:
--   - Tag automatico: 'desierto' aplicado a todos los parrafos del cap 2
--   - Links explicitos: 11 inserts en elementos_interactivos
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TAG 'desierto' a todos los parrafos del capitulo 2
-- ─────────────────────────────────────────────────────────────
UPDATE parrafos p
SET escena_tags = array_append(p.escena_tags, 'desierto')
FROM capitulos c, libros l
WHERE p.capitulo_id = c.id
  AND c.libro_id   = l.id
  AND l.titulo     = 'El Principito'
  AND c.numero     = 2
  AND NOT ('desierto' = ANY(p.escena_tags));   -- idempotente

-- ─────────────────────────────────────────────────────────────
-- 2. LINKS EXPLICITOS (parrafo ↔ media)
--    CTE 'links' lista los pares (slug, capitulo, parrafo);
--    el INSERT resuelve los UUIDs via JOIN.
-- ─────────────────────────────────────────────────────────────
WITH links(slug, cap, par) AS (
  VALUES
    ('magia_aparicion', 2,  1),
    ('reparacion',      2,  2),
    ('dibujo_1',        2, 15),
    ('dibujo_2',        2, 17),
    ('cordero_1',       2, 19),
    ('dibujo_3',        2, 20),
    ('cordero_2',       2, 22),
    ('dibujo_4',        2, 23),
    ('cordero_3',       2, 25),
    ('dibujo_1',        2, 26),   -- mismo sonido reutilizado
    ('chispa_magia',    2, 29)
)
INSERT INTO elementos_interactivos (parrafo_id, media_id)
SELECT p.id, bm.id
FROM links l
JOIN libros           lib ON lib.titulo    = 'El Principito'
JOIN capitulos        c   ON c.libro_id    = lib.id
                          AND c.numero     = l.cap
JOIN parrafos         p   ON p.capitulo_id = c.id
                          AND p.numero     = l.par
JOIN biblioteca_media bm  ON bm.slug       = l.slug
ON CONFLICT (parrafo_id, media_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. Marcar parrafos como interactivos (flag para UI)
--    Cubre tanto los del link explicito como los que matchean
--    por tag — el lector puede usar este flag para resaltar
--    parrafos clickeables sin consultar la vista cada vez.
-- ─────────────────────────────────────────────────────────────
UPDATE parrafos p
SET tiene_interactivo = TRUE
WHERE p.id IN (
  SELECT DISTINCT parrafo_id FROM media_por_parrafo
)
AND p.tiene_interactivo = FALSE;

-- ─────────────────────────────────────────────────────────────
-- 4. VERIFICACION
--    Lista que media termina activa en cada parrafo del cap 2
--    de El Principito, indicando si llego por link explicito
--    o por tag.
-- ─────────────────────────────────────────────────────────────
SELECT
  c.numero  AS cap,
  p.numero  AS par,
  mpp.slug,
  mpp.origen,
  left(p.contenido, 60) AS preview
FROM media_por_parrafo mpp
JOIN parrafos  p ON p.id = mpp.parrafo_id
JOIN capitulos c ON c.id = p.capitulo_id
JOIN libros    l ON l.id = c.libro_id
WHERE l.titulo = 'El Principito'
  AND c.numero = 2
ORDER BY p.numero, mpp.origen, mpp.slug;
