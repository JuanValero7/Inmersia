-- =============================================================
-- INMERSIA — Migración 064
-- El Principito baja al puesto 7 + "X-ray" pasa a "Fichas" + nombres del Manual
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- 1) El orden del catálogo es curado a mano (047, de 10 en 10). El Principito
--    estaba primero (orden 10). Pasa a 75: entre El fantasma de Canterville (70)
--    y Bambi (80), es decir, séptimo. El arte de la guerra queda primero.
-- 2) En el lector el botón "X-ray" ahora se llama "Fichas". El Manual del
--    Explorador lo explicaba con el nombre viejo (cap. 1, ítem "2. X-ray: …").
--    Solo cambia el texto del párrafo: no se borra nada, así que no toca los
--    elementos_interactivos (ver la trampa de la 036 → 044).
-- 3) Nombres unificados: la sección se llama "Investigación" (no "Cartelera de
--    Investigación"). El Manual la nombraba así en el cap. 2.
-- =============================================================

UPDATE libros SET orden = 75 WHERE slug = 'el-principito';

UPDATE parrafos p
SET contenido = replace(p.contenido, 'X-ray', 'Fichas')
FROM capitulos c
WHERE p.capitulo_id = c.id
  AND c.libro_id = '00000000-0000-4000-8000-000000000001'
  AND p.contenido LIKE '%X-ray%';

UPDATE parrafos p
SET contenido = replace(p.contenido, 'La Cartelera de Investigación', 'La Investigación')
FROM capitulos c
WHERE p.capitulo_id = c.id
  AND c.libro_id = '00000000-0000-4000-8000-000000000001'
  AND p.contenido LIKE '%La Cartelera de Investigación%';

-- Comprobación
SELECT slug, orden FROM libros WHERE visible ORDER BY orden NULLS LAST LIMIT 8;
SELECT p.contenido FROM parrafos p JOIN capitulos c ON c.id = p.capitulo_id
WHERE c.libro_id = '00000000-0000-4000-8000-000000000001' AND (p.contenido LIKE '%Fichas%' OR p.contenido LIKE '%La Investigación%');
