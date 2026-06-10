-- =============================================================
-- INMERSIA — Schema para vista interna de la tienda
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Ejecutar DESPUÉS de 012_consolidar_libros.sql
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. COLUMNAS NUEVAS EN LIBROS
-- ─────────────────────────────────────────────────────────────

-- Año de publicación como columna real (ya existía en metadata)
ALTER TABLE libros
  ADD COLUMN IF NOT EXISTS anio int;

-- Migrar el anio que ya existe en metadata
UPDATE libros
SET anio = (metadata->>'anio')::int
WHERE metadata->>'anio' IS NOT NULL
  AND anio IS NULL;

-- Categorías del libro (array — permite múltiples y filtrado por @>)
-- Ej: ARRAY['Ficción', 'Clásicos', 'Aventura']
ALTER TABLE libros
  ADD COLUMN IF NOT EXISTS categorias text[] NOT NULL DEFAULT '{}';

-- Moods del libro (definidos por el admin)
-- Ej: ARRAY['melancólico', 'esperanzador', 'sorprendente']
ALTER TABLE libros
  ADD COLUMN IF NOT EXISTS moods text[] NOT NULL DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────
-- 2. ÍNDICES PARA FILTRADO
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_libros_categorias
  ON libros USING gin(categorias);

CREATE INDEX IF NOT EXISTS idx_libros_moods
  ON libros USING gin(moods);

-- ─────────────────────────────────────────────────────────────
-- 3. RESEÑAS Y RATING
--    Una reseña por usuario por libro.
--    rating obligatorio (1-5), texto opcional.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resenas_libros (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id   uuid        NOT NULL REFERENCES libros(id)     ON DELETE CASCADE,
  rating     smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  texto      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, libro_id)
);

CREATE INDEX IF NOT EXISTS idx_resenas_libro
  ON resenas_libros (libro_id);

ALTER TABLE resenas_libros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resenas_select"
  ON resenas_libros FOR SELECT TO authenticated USING (true);

CREATE POLICY "resenas_insert"
  ON resenas_libros FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "resenas_update"
  ON resenas_libros FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "resenas_delete"
  ON resenas_libros FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. SUBRAYADOS — abrir SELECT para conteo agregado (top 3)
--    subrayados_usuario ya existe (011_cuaderno.sql).
--    Su policy de SELECT era solo "ver los propios", lo que
--    impide calcular el top 3 entre todos los usuarios.
--    La reemplazamos para permitir SELECT a todos.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "subrayados_select" ON subrayados_usuario;

CREATE POLICY "subrayados_select"
  ON subrayados_usuario FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────
-- 5. SEED: datos de El Principito
-- ─────────────────────────────────────────────────────────────
UPDATE libros
SET
  anio       = 1943,
  categorias = ARRAY['Clásicos', 'Fábula', 'Filosófico'],
  moods      = ARRAY['melancólico', 'esperanzador', 'reflexivo', 'tierno'],
  descripcion = COALESCE(
    NULLIF(descripcion, ''),
    'Un aviador varado en el desierto del Sahara conoce a un pequeño príncipe llegado de un asteroide lejano. A través de sus viajes por planetas habitados por adultos absurdos, el principito descubre el sentido de la amistad, el amor y la pérdida.'
  )
WHERE titulo = 'El Principito';

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────
SELECT
  titulo,
  anio,
  categorias,
  moods,
  LEFT(descripcion, 80) AS descripcion_preview
FROM libros
ORDER BY titulo;
