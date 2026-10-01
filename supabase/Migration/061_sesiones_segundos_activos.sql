-- =============================================================
-- INMERSIA — Migración 061
-- Tiempo activo de lectura en sesiones_lectura
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- Hasta ahora la duración de una sesión se deducía de
-- ended_at − started_at. Eso cuenta como lectura todo lo que pasa entre
-- las dos marcas: una pestaña abierta toda la noche, o la pausa de una
-- sesión retomada dentro de los 30 min. Y en móvil, si se cierra la app
-- sin salir del lector, ended_at nunca llega y la sesión se pierde.
--
-- segundos_activos lo lleva el cliente (useSesionLectura): solo suma
-- con la pestaña visible y con actividad en los últimos 3 min, y se
-- guarda cada ~60 s junto con ended_at.
--
--   NULL → fila anterior a esta migración: la duración se sigue
--          deduciendo de las marcas, con un tope por sesión
--          (ver computeSesionStats en useReadingStats.js).
--   0+   → fila nueva: la duración es este valor.
--
-- Va ANTES de subir el código: el INSERT nuevo ya manda la columna.
-- =============================================================

ALTER TABLE sesiones_lectura
  ADD COLUMN IF NOT EXISTS segundos_activos INTEGER;

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sesiones_lectura'
ORDER BY ordinal_position;
