-- ─────────────────────────────────────────────────────────────
-- 018: Soporte de frase por párrafo en elementos_interactivos
--
-- elementos_interactivos ya tiene metadata JSONB desde la migración 001.
-- upload_sonidos ahora guarda { "texto_ref": "frase exacta" } ahí.
-- La vista media_por_parrafo se actualiza para que el lector reciba
-- el texto_ref específico del párrafo (ei.metadata) mergeado sobre
-- el metadata global del sonido (bm.metadata).
-- ─────────────────────────────────────────────────────────────

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
ORDER BY parrafo_id, media_id, prio;
