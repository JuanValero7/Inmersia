-- ─────────────────────────────────────────────────────────────
-- 017 · cartelera_items: soporte para alias y evolución narrativa
--
-- Agrega dos columnas a cartelera_items:
--   · nombre_canonico      — nombre unificado del personaje/lugar
--                            (agrupa alias distintos bajo una sola entidad)
--   · descripcion_acumulada— descripción progresiva: lo que el lector sabe
--                            sobre el personaje/lugar hasta ese capítulo
--
-- Para hechos y datos, ambas columnas replican nombre y descripcion.
--
-- La query del frontend cambia de:
--   SELECT * FROM cartelera_items WHERE libro_id = X AND capitulo_numero <= N
-- a:
--   SELECT DISTINCT ON (seccion, nombre_canonico) *
--   FROM cartelera_items
--   WHERE libro_id = X AND capitulo_numero <= N
--   ORDER BY seccion, nombre_canonico, capitulo_numero DESC
--
-- Esto muestra siempre la descripción más actualizada de cada entidad
-- hasta el capítulo actual del lector.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE cartelera_items
  ADD COLUMN IF NOT EXISTS nombre_canonico       TEXT,
  ADD COLUMN IF NOT EXISTS descripcion_acumulada TEXT;

-- Poblar filas existentes con los valores actuales como fallback
UPDATE cartelera_items
SET
  nombre_canonico       = nombre,
  descripcion_acumulada = descripcion
WHERE nombre_canonico IS NULL;

-- Índice para la query de frontend (DISTINCT ON + ORDER BY capitulo_numero DESC)
CREATE INDEX IF NOT EXISTS idx_cartelera_canonico
  ON cartelera_items (libro_id, seccion, nombre_canonico, capitulo_numero DESC);
