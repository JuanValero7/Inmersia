-- ─────────────────────────────────────────────────────────────
-- 031. Offset fino de progreso de lectura
--      ultimo_parrafo_id identifica el párrafo, pero los párrafos largos se
--      dividen en varias páginas (los fragmentos comparten id). El offset en
--      caracteres dentro del párrafo identifica el fragmento con independencia
--      del maquetado (dispositivo, fuente, tamaño), y permite restaurar en la
--      página que contiene el punto exacto del texto donde quedó el lector.
--      Filas existentes → 0 = comportamiento previo (inicio del párrafo).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE progreso_lectura
  ADD COLUMN IF NOT EXISTS ultimo_parrafo_offset INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN progreso_lectura.ultimo_parrafo_offset IS
  'Offset en caracteres dentro de ultimo_parrafo_id donde empieza la última página vista (para párrafos largos divididos en varias páginas).';
