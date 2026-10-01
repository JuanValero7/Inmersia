-- =============================================================
-- INMERSIA — Migración 063
-- media_por_parrafo: que filtrar por capítulo no recorra todo
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- El lector pide la media de UN capítulo:
--   SELECT … FROM media_por_parrafo WHERE capitulo_id = X
-- pero el EXPLAIN mostró que Postgres armaba la vista ENTERA (los 39.000
-- párrafos y los 4.500 vínculos de todos los libros), la ordenaba y recién
-- al final filtraba el capítulo: ~350 ms para devolver 1 fila.
--
-- La causa es el DISTINCT ON (parrafo_id, media_id): Postgres solo puede
-- empujar un filtro por debajo de un DISTINCT ON si filtra por una de sus
-- columnas, y capitulo_id no lo era.
--
-- El arreglo es poner capitulo_id (y libro_id) al frente del DISTINCT ON. El
-- resultado es IDÉNTICO, porque un párrafo pertenece a un solo capítulo y a un
-- solo libro, así que no cambia qué filas son duplicadas. Pero ahora el filtro
-- baja a las dos ramas de la vista y usa el índice idx_parrafos_capitulo.
--
-- CREATE OR REPLACE (no DROP + CREATE): mantiene los permisos de la vista.
-- Las columnas salen con los mismos nombres, tipos y orden que en la 018.
-- =============================================================

CREATE OR REPLACE VIEW media_por_parrafo AS
SELECT DISTINCT ON (libro_id, capitulo_id, parrafo_id, media_id)
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
  -- Fuente A: link explícito (elementos_interactivos)
  -- ei.metadata sobreescribe claves de bm.metadata (texto_ref va acá)
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
    bm.metadata || ei.metadata AS metadata,
    'explicito'::TEXT AS origen,
    1 AS prio
  FROM elementos_interactivos ei
  JOIN parrafos          p  ON p.id  = ei.parrafo_id
  JOIN biblioteca_media  bm ON bm.id = ei.media_id

  UNION ALL

  -- Fuente B: match automático por tags (sin frase específica)
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
ORDER BY libro_id, capitulo_id, parrafo_id, media_id, prio;

-- Índice para la rama A: buscar los vínculos de los párrafos del capítulo.
CREATE INDEX IF NOT EXISTS idx_elementos_interactivos_parrafo
  ON elementos_interactivos (parrafo_id);

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN: el mismo EXPLAIN de antes. Debería bajar de ~350 ms a pocos
-- ms y mostrar "Index Scan using idx_parrafos_capitulo" en vez de
-- "Seq Scan on parrafos".
-- ─────────────────────────────────────────────────────────────
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM media_por_parrafo
WHERE capitulo_id = (SELECT c.id FROM capitulos c JOIN libros l ON l.id = c.libro_id
                     WHERE l.slug = 'robinson-crusoe' ORDER BY c.numero LIMIT 1);
