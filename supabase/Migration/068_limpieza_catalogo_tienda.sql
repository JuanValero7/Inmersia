-- =============================================================
-- INMERSIA — Migración 068
-- Limpieza del catálogo para la Tienda nueva
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO (revisión de la tienda del 1 oct 2026)
-- 1) AÑOS. `libros.anio` es un entero y no sirve para «s. V a. C.». Se añade
--    `anio_texto`: si tiene valor, la ficha muestra eso; si no, muestra `anio`.
--    `anio` se queda como número para ordenar. Errores corregidos:
--      El arte de la guerra  -500 → «s. V a. C.»
--      El banquete            430 → -385 · «s. IV a. C.» (estaba como si fuera d. C.)
--      Meditaciones           170 → «s. II»
--      Cuando la tierra era niña  1984 → 1853 (Tanglewood Tales, Hawthorne)
--      Noches blancas         NULL → 1848
--      Una vindicación…       NULL → 1792
-- 2) TÍTULO. «Arsene» sin tilde → «Arsène Lupin, caballero ladrón», como el
--    resto de títulos normalizados (ver 050). Solo cambia el texto: el slug
--    ('ladron') y las imágenes ya publicadas no se tocan. OJO: si algún día se
--    vuelve a subir este libro con upload.py, la carpeta de Storage sale del
--    título, así que hay que subirlo con el título nuevo a propósito.
-- 3) CATEGORÍA. 'Policíaca' está fuera del vocabulario cerrado de la 048 (por
--    eso salía con punto naranja y un filtro de un solo libro) → 'Misterio'.
-- 4) Comprueba que la 064 está aplicada (El Principito en el puesto 7, orden 75):
--    el 1 oct la base de datos todavía tenía orden 10.
-- =============================================================

ALTER TABLE libros ADD COLUMN IF NOT EXISTS anio_texto TEXT;

-- 1) Años
UPDATE libros SET anio_texto = 's. V a. C.'              WHERE slug = 'el-arte-de-la-guerra';
UPDATE libros SET anio = -385, anio_texto = 's. IV a. C.' WHERE slug = 'el-banquete-o-del-amor';
UPDATE libros SET anio_texto = 's. II'                   WHERE slug = 'meditaciones';
UPDATE libros SET anio = 1853                            WHERE slug = 'cuando-la-tierra-era-nina';
UPDATE libros SET anio = 1848                            WHERE slug = 'noches-blancas';
UPDATE libros SET anio = 1792                            WHERE slug = 'una-vindicacion-de-los-derechos-de-la-mujer';

-- 2) Título
UPDATE libros SET titulo = 'Arsène Lupin, caballero ladrón' WHERE slug = 'ladron';

-- 3) Categoría (sin duplicar 'Misterio' si ya estuviera)
UPDATE libros
SET categorias = ARRAY(
  SELECT DISTINCT c
  FROM unnest(array_replace(categorias, 'Policíaca', 'Misterio')) AS c
)
WHERE 'Policíaca' = ANY (categorias);

-- ── Comprobación ───────────────────────────────────────────
SELECT slug, titulo, anio, anio_texto, categorias
FROM libros
WHERE slug IN ('el-arte-de-la-guerra', 'el-banquete-o-del-amor', 'meditaciones',
               'cuando-la-tierra-era-nina', 'noches-blancas',
               'una-vindicacion-de-los-derechos-de-la-mujer', 'ladron');

-- Ninguna categoría fuera del vocabulario de la 048 (esperado: 0 filas)
SELECT slug, categorias FROM libros
WHERE NOT categorias <@ ARRAY['Aventura', 'Fantasía', 'Ciencia ficción', 'Misterio', 'Terror',
                              'Romance', 'Drama', 'Cuentos', 'Novela histórica',
                              'Filosofía', 'Ensayo', 'Economía'];

-- 064: El Principito tiene que dar 75. Si da 10, corre la 064.
SELECT slug, orden FROM libros WHERE slug = 'el-principito';
