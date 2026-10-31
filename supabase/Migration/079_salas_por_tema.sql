-- =============================================================
-- INMERSIA — Migración 079
-- Tres salas nuevas por tema y casa para los libros huérfanos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- (después de la 078, que saca El rojo emblema del valor del salón)
--
-- CONTEXTO
-- 14 de los 62 libros no estaban en ninguna sala fija. Las salas nuevas no
-- salen de las categorías del catálogo sino de lo que pasa en los libros
-- (decidido con Juan el 31 oct 2026):
--   · Más allá del mapa   otros mundos, lo que hay detrás de la puerta
--   · En las trincheras   la guerra y el miedo a no estar a la altura
--   · Sueño febril        obsesiones y locura
-- Y cinco huérfanos van a salas que ya existían:
--   · La sala oscura             El misterio del cuarto amarillo, Martin Hewitt
--   · El salón de los corazones  Persuasión, Ethan Frome, Tres cuentos
--
-- Quedan sin sala A PROPÓSITO, hasta que haya una sala donde encajen por
-- tema: Lazarillo de Tormes y Edipo Rey.
--
-- Libros dentro de cada sala: en el orden curado del catálogo (047), como
-- en la 066. Ojo con los slugs raros que hay hoy en `libros`: 'persuasión'
-- (con tilde), 'frome', 'amarillo', 'investigador', 'muerte',
-- 'metamorfosis', 'jorobados'.
-- =============================================================

-- Colores = los de categoría de la tienda (tiendaHelpers.jsx · CAT_COLOR):
-- Fantasía, Novela histórica y Ciencia ficción.
INSERT INTO salas (slug, nombre, linea, genero, color, tipo, orden) VALUES
  ('mas-alla-del-mapa', 'Más allá del mapa', 'Detrás hay otro mundo.',                                      'Otros mundos',      '#86ad9e', 'sala', 50),
  ('en-las-trincheras', 'En las trincheras', 'Nadie sabe si es valiente hasta que suena el primer disparo.', 'Guerra',            '#9a8256', 'sala', 60),
  ('sueno-febril',      'Sueño febril',      'Empieza como una idea. Acaba ocupándolo todo.',               'Obsesión y locura', '#8778b8', 'sala', 70)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sala_libros (sala_id, libro_id, orden)
SELECT s.id, l.id, COALESCE(l.orden, 999)
FROM (VALUES
  -- Más allá del mapa
  ('mas-alla-del-mapa', 'las-aventuras-de-alicia-en-el-pais-de-las-maravillas'),
  ('mas-alla-del-mapa', 'el-principito'),
  ('mas-alla-del-mapa', 'una-princesa-de-marte'),
  ('mas-alla-del-mapa', 'horizontes-perdidos'),
  ('mas-alla-del-mapa', 'cuando-la-tierra-era-nina'),
  ('mas-alla-del-mapa', 'leyendas'),
  ('mas-alla-del-mapa', 'en-las-montanas-de-la-locura'),
  ('mas-alla-del-mapa', 'jorobados'),
  -- En las trincheras
  ('en-las-trincheras', 'el-rojo-emblema-del-valor'),
  ('en-las-trincheras', 'el-arte-de-la-guerra'),
  ('en-las-trincheras', 'el-corsario-negro'),
  ('en-las-trincheras', 'santiago-damour'),
  -- Sueño febril
  ('sueno-febril', 'metamorfosis'),
  ('sueno-febril', 'la-muerte-en-venecia'),
  ('sueno-febril', 'la-sala-numero-seis'),
  ('sueno-febril', 'novela-de-ajedrez'),
  ('sueno-febril', 'muerte'),
  ('sueno-febril', 'el-extrano-caso-del-dr-jekyll-y-mr-hyde'),
  ('sueno-febril', 'frankenstein'),
  ('sueno-febril', 'el-donador-de-almas-y-el-diablo-desinteresado'),
  -- Huérfanos a salas que ya existían
  ('la-sala-oscura',            'amarillo'),
  ('la-sala-oscura',            'investigador'),
  ('el-salon-de-los-corazones', 'persuasión'),
  ('el-salon-de-los-corazones', 'frome'),
  ('el-salon-de-los-corazones', 'tres-cuentos')
) AS v(sala, libro)
JOIN salas  s ON s.slug = v.sala
JOIN libros l ON l.slug = v.libro
ON CONFLICT (sala_id, libro_id) DO NOTHING;

-- ── Comprobación ───────────────────────────────────────────
-- Esperado: oscura 11 · puerto 10 · jardín 20 · corazones 12 (9 tras la 078 + 3)
--           más allá del mapa 8 · trincheras 4 · sueño febril 8
SELECT s.orden, s.slug, count(sl.libro_id) AS libros
FROM salas s LEFT JOIN sala_libros sl ON sl.sala_id = s.id
WHERE s.tipo = 'sala'
GROUP BY s.id ORDER BY s.orden;

-- Libros visibles sin sala fija. Esperado: solo Lazarillo de Tormes y Edipo Rey.
SELECT l.titulo FROM libros l
WHERE l.visible AND NOT EXISTS (
  SELECT 1 FROM sala_libros sl JOIN salas s ON s.id = sl.sala_id
  WHERE sl.libro_id = l.id AND s.tipo = 'sala')
ORDER BY l.titulo;
