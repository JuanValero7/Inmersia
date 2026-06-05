-- =============================================================
-- INMERSIA — Schema completo de lectura
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Ejecutar ANTES que 002_mock_principito.sql
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. LIBROS
--    Metadata del libro. Un libro existe aquí antes de
--    aparecer en el catálogo de la tienda.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS libros (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT        NOT NULL,
  autor       TEXT        NOT NULL,
  descripcion TEXT,
  portada_url TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}'
              -- { "idioma": "es", "anio": 1943, "genero": "Fábula" }
);

-- ─────────────────────────────────────────────────────────────
-- 2. CAPÍTULOS
--    Un libro tiene muchos capítulos en orden.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capitulos (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  libro_id  UUID    NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  numero    INTEGER NOT NULL,   -- 1, 2, 3 … 27
  titulo    TEXT,               -- "Capítulo I", "Capítulo II", etc.
  UNIQUE (libro_id, numero),
  UNIQUE (id, libro_id)         -- expone el par para el FK compuesto de parrafos
);

-- ─────────────────────────────────────────────────────────────
-- 3. PÁRRAFOS
--    Unidad atómica de contenido. Cada párrafo del texto
--    original es una fila. El lector carga los párrafos
--    de un capítulo a la vez.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parrafos (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  libro_id          UUID    NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  capitulo_id       UUID    NOT NULL,
  numero            INTEGER NOT NULL,  -- orden dentro del capítulo
  contenido         TEXT    NOT NULL,
  tipo              TEXT    NOT NULL DEFAULT 'texto'
                    CHECK (tipo IN (
                      'texto',           -- narración normal
                      'dialogo',         -- línea de diálogo
                      'nota_marginal',   -- anotación del lector ficticio
                      'separador'        -- separador escénico  * * *
                    )),
  tiene_interactivo BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (capitulo_id, numero),
  -- FK compuesto: garantiza que capitulo_id pertenece al mismo libro_id.
  -- Hace imposible asignar un párrafo a un capítulo de otro libro.
  CONSTRAINT fk_parrafo_capitulo_libro
    FOREIGN KEY (capitulo_id, libro_id)
    REFERENCES capitulos(id, libro_id)
    ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- 4. ELEMENTOS INTERACTIVOS
--    Audio, imagen o video ligado a un párrafo específico.
--    El usuario hace click en el párrafo → se activa.
--    La url apunta a Supabase Storage.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS elementos_interactivos (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  parrafo_id  UUID  NOT NULL REFERENCES parrafos(id) ON DELETE CASCADE,
  tipo        TEXT  NOT NULL CHECK (tipo IN ('audio', 'imagen', 'video')),
  url         TEXT  NOT NULL,
  titulo      TEXT,
  descripcion TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'
              -- audio: { "duracion_segundos": 45 }
              -- imagen: { "alt": "El desierto del Sahara", "ancho": 800 }
);

-- ─────────────────────────────────────────────────────────────
-- 5. PROGRESO DE LECTURA
--    Una fila por (usuario × libro). Se actualiza con upsert
--    cada vez que el usuario avanza de párrafo.
--    ultimo_parrafo_id es el punto exacto donde paró —
--    no depende del tamaño de pantalla ni de la paginación.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progreso_lectura (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id           UUID        NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  ultimo_parrafo_id  UUID        REFERENCES parrafos(id),
  porcentaje         SMALLINT    NOT NULL DEFAULT 0
                     CHECK (porcentaje BETWEEN 0 AND 100),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, libro_id)
);

-- ─────────────────────────────────────────────────────────────
-- 6. NOTAS DE USUARIO (cuaderno de predicciones)
--    Una nota por (usuario × capítulo). El usuario escribe
--    su predicción antes de entrar a cada capítulo.
--    Se guarda/actualiza con upsert.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notas_usuario (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capitulo_id UUID        NOT NULL REFERENCES capitulos(id) ON DELETE CASCADE,
  contenido   TEXT        NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, capitulo_id)
);

-- ─────────────────────────────────────────────────────────────
-- 7. CARTELERA (tablero de investigación)
--    Ítems curados por el administrador que se van revelando
--    progresivamente según el capítulo que el usuario está
--    leyendo. capitulo_numero es intencional (sin FK):
--    permite insertar "aparece en capítulo 21" sin necesitar
--    el UUID del capítulo.
--
--    La app filtra: WHERE libro_id = X AND capitulo_numero <= actual
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cartelera_items (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  libro_id        UUID  NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  capitulo_numero INTEGER NOT NULL,  -- se revela al llegar a este capítulo
  seccion         TEXT  NOT NULL
                  CHECK (seccion IN ('personajes', 'lugares', 'hechos', 'datos')),
  nombre          TEXT  NOT NULL,
  descripcion     TEXT,
  imagen_url      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'
                  -- { "tags": ["protagonista", "misterio"], "color": "#c0392b" }
);

-- ─────────────────────────────────────────────────────────────
-- VISTA: elementos_interactivos con contexto
--    Aplana la cadena parrafos → capitulos → libros para que
--    el admin pueda filtrar interactivos por libro o capítulo
--    sin escribir JOINs. La app lectora sigue usando la tabla
--    directamente por parrafo_id.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW elementos_con_contexto AS
SELECT
  ei.id,
  ei.tipo,
  ei.url,
  ei.titulo,
  ei.descripcion,
  ei.metadata,
  p.id           AS parrafo_id,
  p.numero       AS parrafo_numero,
  p.contenido    AS parrafo_contenido,
  c.id           AS capitulo_id,
  c.numero       AS capitulo_numero,
  c.titulo       AS capitulo_titulo,
  l.id           AS libro_id,
  l.titulo       AS libro_titulo
FROM elementos_interactivos ei
JOIN parrafos  p ON p.id = ei.parrafo_id
JOIN capitulos c ON c.id = p.capitulo_id
JOIN libros    l ON l.id = c.libro_id;

-- =============================================================
-- ÍNDICES
-- =============================================================

-- Cargar capítulos de un libro en orden
CREATE INDEX IF NOT EXISTS idx_capitulos_libro
  ON capitulos (libro_id, numero);

-- Cargar párrafos de un capítulo en orden (query más frecuente del lector)
CREATE INDEX IF NOT EXISTS idx_parrafos_capitulo
  ON parrafos (capitulo_id, numero);

-- Buscar progreso de un usuario en un libro
CREATE INDEX IF NOT EXISTS idx_progreso_user_libro
  ON progreso_lectura (user_id, libro_id);

-- Notas de un usuario en un libro (a través de capítulo)
CREATE INDEX IF NOT EXISTS idx_notas_user_capitulo
  ON notas_usuario (user_id, capitulo_id);

-- Cartelera: ítems de un libro hasta cierto capítulo
CREATE INDEX IF NOT EXISTS idx_cartelera_libro_capitulo
  ON cartelera_items (libro_id, capitulo_numero);

-- Interactivos de un párrafo
CREATE INDEX IF NOT EXISTS idx_interactivos_parrafo
  ON elementos_interactivos (parrafo_id);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE libros                ENABLE ROW LEVEL SECURITY;
ALTER TABLE capitulos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE parrafos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE elementos_interactivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE progreso_lectura      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_usuario         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartelera_items       ENABLE ROW LEVEL SECURITY;

-- Contenido público: cualquier usuario autenticado puede leer
CREATE POLICY "libros_select"
  ON libros FOR SELECT TO authenticated USING (true);

CREATE POLICY "capitulos_select"
  ON capitulos FOR SELECT TO authenticated USING (true);

CREATE POLICY "parrafos_select"
  ON parrafos FOR SELECT TO authenticated USING (true);

CREATE POLICY "interactivos_select"
  ON elementos_interactivos FOR SELECT TO authenticated USING (true);

CREATE POLICY "cartelera_select"
  ON cartelera_items FOR SELECT TO authenticated USING (true);

-- Progreso: cada usuario solo accede al suyo
CREATE POLICY "progreso_select"
  ON progreso_lectura FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "progreso_insert"
  ON progreso_lectura FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "progreso_update"
  ON progreso_lectura FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Notas: cada usuario solo accede a las suyas
CREATE POLICY "notas_select"
  ON notas_usuario FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notas_insert"
  ON notas_usuario FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notas_update"
  ON notas_usuario FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
