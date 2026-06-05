-- =============================================================
-- INMERSIA — Bridge El Principito (catalogo viejo ↔ schema nuevo)
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Ejecutar DESPUES de 005_link_media_principito.sql
--
-- Hace 2 cosas:
--   1. Agrega columna catalogo_libros.libro_id (FK a libros.id)
--      para puentear el catalogo viejo con el schema nuevo.
--      El Lector la usa para saber que UUID consultar en libros.
--
--   2. Inserta El Principito en catalogo_libros (con su libro_id
--      apuntando a la fila ya creada en libros). Asi aparece en
--      La Tienda de los Guardianes y cada usuario lo "compra"
--      cuando quiera para sumarlo a su biblioteca.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Bridge column
-- ─────────────────────────────────────────────────────────────
ALTER TABLE catalogo_libros
  ADD COLUMN IF NOT EXISTS libro_id UUID
    REFERENCES libros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catalogo_libros_libro_id
  ON catalogo_libros (libro_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Insertar Principito en catalogo_libros si no existe
--    Idempotente: usa NOT EXISTS sobre titulo.
-- ─────────────────────────────────────────────────────────────
INSERT INTO catalogo_libros (titulo, autor, paginas, resumen, color, libro_id)
SELECT
  'El Principito',
  'Antoine de Saint-Exupéry',
  96,        -- paginas aprox del libro fisico (afecta el ancho del lomo)
  'Un aviador que se queda varado en el desierto del Sahara conoce a un pequeño príncipe llegado de un asteroide lejano.',
  '#8b4d2a',
  l.id
FROM libros l
WHERE l.titulo = 'El Principito'
  AND NOT EXISTS (
    SELECT 1 FROM catalogo_libros WHERE titulo = 'El Principito'
  );

-- Si ya existia (por pruebas previas) pero sin libro_id, lo conectamos
UPDATE catalogo_libros cl
SET libro_id = l.id
FROM libros l
WHERE cl.titulo = 'El Principito'
  AND l.titulo  = 'El Principito'
  AND cl.libro_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. VERIFICACION
--    Deberia aparecer una fila con el bridge_a_libros poblado.
-- ─────────────────────────────────────────────────────────────
SELECT
  cl.id        AS catalogo_id,
  cl.titulo,
  cl.autor,
  cl.libro_id  AS bridge_a_libros
FROM catalogo_libros cl
WHERE cl.titulo = 'El Principito';
