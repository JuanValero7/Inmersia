-- ─────────────────────────────────────────────────────────────
-- 022 · cartelera_items: índice para la query de useXrayItems
--
-- useXrayItems filtra con tres igualdades exactas:
--   WHERE libro_id = $1 AND capitulo_numero = $2 AND seccion = $3
--
-- El índice idx_cartelera_canonico (de 017) fue creado para la query
-- DISTINCT ON con ORDER BY capitulo_numero DESC y no cubre este
-- patrón eficientemente (capitulo_numero queda después de nombre_canonico,
-- columna que no aparece en el WHERE → el planner no puede usar el prefijo
-- completo sin un index skip scan).
--
-- Este índice cubre la query exacta de useXrayItems en O(log n).
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cartelera_items_xray
  ON cartelera_items (libro_id, seccion, capitulo_numero);
