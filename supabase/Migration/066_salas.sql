-- =============================================================
-- INMERSIA — Migración 066
-- Salas de la Tienda (y la sala de temporada) con sus libros
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- La Tienda nueva (Documentation/tienda/plan-implementacion.md) organiza el
-- catálogo en salas: La sala oscura, El puerto, El jardín de los filósofos y
-- El salón de los corazones. Arriba va una sala de temporada («Octubre de
-- miedo») que solo se muestra entre dos fechas.
--
-- Juan crea las salas y elige sus libros a mano, y un libro puede estar en
-- varias salas (El signo de los cuatro está en la oscura y en el puerto).
-- Por eso es una tabla de unión y no una columna en `libros`.
--
--   salas        una fila por sala. `tipo`:
--                  'sala'       las del pasillo
--                  'temporada'  la portada de la tienda, visible de `desde` a `hasta`
--                  'carril'     reservado: por ahora los carriles salen de
--                               reglas en el código (decisión del 1 oct)
--   sala_libros  qué libros hay en cada sala y en qué orden. El de mayor
--                `orden` de cada balda es el que se pone de lomo.
--
-- CÓMO SE ADMINISTRA (v1, sin código): Supabase → Table Editor.
--   · Nueva sala: fila en `salas` (slug en minúsculas con guiones).
--   · Meter un libro: fila en `sala_libros`. Los libros nuevos NO entran
--     solos en ninguna sala: hay que añadirlos. Atajo en SQL:
--       INSERT INTO sala_libros (sala_id, libro_id, orden)
--       SELECT s.id, l.id, l.orden FROM salas s, libros l
--       WHERE s.slug = 'el-puerto' AND l.slug = '<slug-del-libro>';
--
-- Escribir: solo superusuarios (es_superusuario(), de la 051). Leer: todos
-- ven las salas visibles; el superusuario ve también las ocultas.
-- es_superusuario() no tiene EXECUTE para `anon` (051), así que va en una
-- política aparte, solo para `authenticated`.
-- =============================================================

CREATE TABLE IF NOT EXISTS salas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        NOT NULL UNIQUE
             -- /tienda/<slug>. 'catalogo' queda reservado para /tienda/catalogo.
             CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND slug <> 'catalogo'),
  nombre     TEXT        NOT NULL,
  linea      TEXT,                                   -- «Para leer con la luz encendida.»
  color      TEXT        NOT NULL DEFAULT '#8b4d2a'
             CHECK (color ~ '^#[0-9a-fA-F]{6}$'),     -- paleta de categorías de la tienda
  tipo       TEXT        NOT NULL DEFAULT 'sala'
             CHECK (tipo IN ('sala', 'temporada', 'carril')),
  orden      INTEGER     NOT NULL DEFAULT 0,          -- orden en la tienda y en el pasillo
  visible    BOOLEAN     NOT NULL DEFAULT TRUE,
  desde      DATE,                                    -- temporada: primer día que se muestra
  hasta      DATE,                                    -- temporada: último día que se muestra
  imagen_url TEXT,                                    -- temporada: fondo de la portada
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (desde IS NULL OR hasta IS NULL OR desde <= hasta)
);

CREATE TABLE IF NOT EXISTS sala_libros (
  sala_id  UUID    NOT NULL REFERENCES salas(id)  ON DELETE CASCADE,
  libro_id UUID    NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  orden    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sala_id, libro_id)
);

-- La ficha pregunta «¿en qué sala está este libro?»: índice por libro.
CREATE INDEX IF NOT EXISTS idx_sala_libros_libro ON sala_libros (libro_id);

-- ── Seguridad ──────────────────────────────────────────────
ALTER TABLE salas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sala_libros ENABLE ROW LEVEL SECURITY;

GRANT SELECT                 ON salas, sala_libros TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON salas, sala_libros TO authenticated;

DROP POLICY IF EXISTS "salas_select_visibles" ON salas;
CREATE POLICY "salas_select_visibles" ON salas
  FOR SELECT TO anon, authenticated
  USING (visible);

DROP POLICY IF EXISTS "salas_superusuario" ON salas;
CREATE POLICY "salas_superusuario" ON salas
  FOR ALL TO authenticated
  USING (es_superusuario())
  WITH CHECK (es_superusuario());

DROP POLICY IF EXISTS "sala_libros_select_visibles" ON sala_libros;
CREATE POLICY "sala_libros_select_visibles" ON sala_libros
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM salas s WHERE s.id = sala_libros.sala_id AND s.visible));

DROP POLICY IF EXISTS "sala_libros_superusuario" ON sala_libros;
CREATE POLICY "sala_libros_superusuario" ON sala_libros
  FOR ALL TO authenticated
  USING (es_superusuario())
  WITH CHECK (es_superusuario());

-- ── Siembra: las 4 salas del prototipo y la temporada de octubre ──
-- Colores = los de categoría de la tienda (tiendaHelpers.jsx · CAT_COLOR).
INSERT INTO salas (slug, nombre, linea, color, tipo, orden) VALUES
  ('la-sala-oscura',             'La sala oscura',             'Para leer con la luz encendida.',       '#4f4b5c', 'sala', 10),
  ('el-puerto',                  'El puerto',                  'Todos zarpan al amanecer.',             '#7d8db5', 'sala', 20),
  ('el-jardin-de-los-filosofos', 'El jardín de los filósofos', 'Se piensa mejor con el ruido del agua.', '#7c8a4f', 'sala', 30),
  ('el-salon-de-los-corazones',  'El salón de los corazones',  'Afuera llueve. Aquí se suspira.',       '#cf8ea4', 'sala', 40)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO salas (slug, nombre, linea, color, tipo, orden, desde, hasta, imagen_url)
SELECT 'octubre-de-miedo', 'Octubre de miedo',
       'Ocho clásicos para leer con la luz encendida. Fantasmas, dobles, ratas y una ciudad bajo el hielo.',
       '#c95f1a', 'temporada', 0, DATE '2026-10-01', DATE '2026-10-31',
       (SELECT r.imagen_url FROM libro_reels r JOIN libros l ON l.id = r.libro_id
         WHERE l.slug = 'el-fantasma-de-canterville' AND r.orden = 1)
ON CONFLICT (slug) DO NOTHING;

-- Libros de cada sala por categoría, en el orden curado del catálogo (047).
-- es_ficcion NULL cuenta como ficción, igual que en la app (b.es_ficcion !== false).
-- 'Policíaca' sigue aquí porque la 068 la pasa a 'Misterio' después.
INSERT INTO sala_libros (sala_id, libro_id, orden)
SELECT s.id, l.id, COALESCE(l.orden, 999)
FROM salas s
JOIN libros l ON l.visible AND (
     (s.slug = 'la-sala-oscura'             AND l.es_ficcion IS DISTINCT FROM FALSE
                                            AND l.categorias && ARRAY['Terror', 'Misterio', 'Policíaca'])
  OR (s.slug = 'el-puerto'                  AND l.es_ficcion IS DISTINCT FROM FALSE
                                            AND l.categorias && ARRAY['Aventura'])
  OR (s.slug = 'el-jardin-de-los-filosofos' AND l.es_ficcion = FALSE)
  OR (s.slug = 'el-salon-de-los-corazones'  AND l.es_ficcion IS DISTINCT FROM FALSE
                                            AND l.categorias && ARRAY['Romance', 'Drama'])
)
ON CONFLICT (sala_id, libro_id) DO NOTHING;

-- Temporada: los 8 elegidos, en el orden de la lista.
INSERT INTO sala_libros (sala_id, libro_id, orden)
SELECT s.id, l.id, 10 * array_position(v.slugs, l.slug)
FROM salas s
CROSS JOIN (SELECT ARRAY[
  'el-fantasma-de-canterville',
  'el-extrano-caso-del-dr-jekyll-y-mr-hyde',
  'en-las-montanas-de-la-locura',
  'el-entierro-de-las-ratas',
  'la-gota-de-sangre-y-un-destripador-de-antano',
  'la-bolsa-de-huesos',
  'los-crimenes-de-la-calle-morgue',
  'el-donador-de-almas-y-el-diablo-desinteresado'
] AS slugs) v
JOIN libros l ON l.slug = ANY (v.slugs)
WHERE s.slug = 'octubre-de-miedo'
ON CONFLICT (sala_id, libro_id) DO NOTHING;

-- ── Comprobación ───────────────────────────────────────────
-- Esperado: oscura 9 · puerto 10 · jardín 20 · corazones 10 · octubre 8
SELECT s.orden, s.slug, s.tipo, count(sl.libro_id) AS libros
FROM salas s LEFT JOIN sala_libros sl ON sl.sala_id = s.id
GROUP BY s.id ORDER BY s.orden;

-- La temporada tiene que tener imagen (si sale NULL, falta el reel de Canterville).
SELECT slug, imagen_url IS NOT NULL AS tiene_imagen FROM salas WHERE tipo = 'temporada';
