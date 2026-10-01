-- =============================================================
-- INMERSIA — Migración 070
-- salas.genero: lo que hay en cada sala, en dos o tres palabras
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- Las tarjetas de sala de la Tienda y el título de cada sala dicen qué se
-- encuentra dentro («Terror y misterio · 9 libros»). Sin eso, «El puerto»
-- o «El salón de los corazones» no dicen nada a quien llega nuevo. La 066
-- no lo guardó; se añade aquí. Lo escribe Juan al crear una sala.
--
-- Va ANTES del código de la fase 2 de la tienda: la consulta de salas ya
-- pide la columna.
-- =============================================================

ALTER TABLE salas ADD COLUMN IF NOT EXISTS genero TEXT;

UPDATE salas SET genero = 'Terror y misterio'  WHERE slug = 'la-sala-oscura';
UPDATE salas SET genero = 'Aventura'           WHERE slug = 'el-puerto';
UPDATE salas SET genero = 'Filosofía y ensayo' WHERE slug = 'el-jardin-de-los-filosofos';
UPDATE salas SET genero = 'Romance y drama'    WHERE slug = 'el-salon-de-los-corazones';
UPDATE salas SET genero = 'Temporada'          WHERE slug = 'octubre-de-miedo';

-- ── Comprobación ───────────────────────────────────────────
SELECT orden, slug, genero FROM salas ORDER BY orden;
