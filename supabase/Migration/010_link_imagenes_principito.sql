-- =============================================================
-- INMERSIA — Link de imagenes a items de cartelera (El Principito)
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Ejecutar DESPUES de 009_seed_imagenes_principito.sql
--
-- Mapea (slug en biblioteca_media) ↔ (item en cartelera_items)
-- via (seccion, nombre). Idempotente: re-correr re-aplica el
-- mismo UPDATE.
--
-- Cobertura:
--   - 10 personajes (todos menos El Aviador, que no tiene imagen)
--   - 4 lugares (todos menos Planeta del Rey)
--   - 0 hechos / 0 datos (no hay imagenes especificas en el set)
-- =============================================================

WITH links(slug, seccion, nombre) AS (
  VALUES
    -- ── PERSONAJES ──────────────────────────────────────────
    ('principito', 'personajes', 'El Principito'),
    ('rosa',       'personajes', 'La Rosa'),
    ('rey',        'personajes', 'El Rey'),
    ('vani',       'personajes', 'El Vanidoso'),
    ('bebedor',    'personajes', 'El Bebedor'),
    ('nego',       'personajes', 'El Hombre de Negocios'),
    ('faro',       'personajes', 'El Farolero'),
    ('geo',        'personajes', 'El Geógrafo'),
    ('ser',        'personajes', 'La Serpiente'),
    ('zorro',      'personajes', 'El Zorro'),
    ('avion_y_principito',      'personajes', 'El Aviador'),
    -- ── LUGARES ─────────────────────────────────────────────
    ('sahara',     'lugares',    'El Desierto del Sahara'),
    ('b612',       'lugares',    'Asteroide B-612'),
    ('tierra',     'lugares',    'La Tierra'),
    ('rey',        'lugares', 'Planeta del Rey'),
    ('jdr',        'lugares',    'El Jardín de las Rosas')
)
UPDATE cartelera_items ci
SET imagen_media_id = bm.id
FROM links l
JOIN biblioteca_media bm  ON bm.slug   = l.slug
JOIN libros           lib ON lib.titulo = 'El Principito'
WHERE ci.libro_id = lib.id
  AND ci.seccion  = l.seccion
  AND ci.nombre   = l.nombre;

-- ─────────────────────────────────────────────────────────────
-- VERIFICACION
--   Lista cada item de la cartelera del Principito y la imagen
--   linkeada (NULL si no tiene).
-- ─────────────────────────────────────────────────────────────
SELECT
  ci.seccion,
  ci.capitulo_numero AS cap,
  ci.nombre,
  bm.slug AS imagen_slug
FROM cartelera_items ci
JOIN libros lib ON lib.id = ci.libro_id
LEFT JOIN biblioteca_media bm ON bm.id = ci.imagen_media_id
WHERE lib.titulo = 'El Principito'
ORDER BY ci.seccion, ci.capitulo_numero, ci.nombre;
