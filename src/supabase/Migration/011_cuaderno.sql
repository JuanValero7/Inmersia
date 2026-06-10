-- =============================================================
-- INMERSIA — Cuaderno del Lector
-- Predicciones, Anotaciones y Subrayados por libro/capítulo
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere: 001_schema_libros.sql ejecutado previamente
-- =============================================================

-- Eliminar tabla legacy de notas (nunca usada — reemplazada
-- por las tres tablas tipadas a continuación)
DROP TABLE IF EXISTS notas_usuario;

-- ─────────────────────────────────────────────────────────────
-- 1. PREDICCIONES
--    El usuario escribe qué cree que pasará antes de avanzar
--    al siguiente capítulo. Aparecen en Cartelera al terminar.
--    Una predicción por (usuario × libro × capítulo). Upsert.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predicciones_usuario (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id     UUID        NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  capitulo_num INTEGER     NOT NULL,  -- capitulos.numero (1-based)
  contenido    TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, libro_id, capitulo_num)
);

-- ─────────────────────────────────────────────────────────────
-- 2. ANOTACIONES
--    Notas libres del usuario sobre el libro.
--    Múltiples anotaciones por (usuario × libro × capítulo).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anotaciones_usuario (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id     UUID        NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  capitulo_num INTEGER     NOT NULL,  -- capitulos.numero (1-based)
  contenido    TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 3. SUBRAYADOS
--    Texto seleccionado por el usuario en el libro.
--    texto_original: el fragmento capturado.
--    parrafo_id: primer párrafo del fragmento (nullable:
--    SET NULL si el párrafo es eliminado).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subrayados_usuario (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id       UUID        NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  capitulo_num   INTEGER     NOT NULL,  -- capitulos.numero (1-based)
  texto_original TEXT        NOT NULL,
  parrafo_id     UUID        REFERENCES parrafos(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- ÍNDICES
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_predicciones_user_libro
  ON predicciones_usuario (user_id, libro_id);

CREATE INDEX IF NOT EXISTS idx_anotaciones_user_libro
  ON anotaciones_usuario (user_id, libro_id);

CREATE INDEX IF NOT EXISTS idx_subrayados_user_libro
  ON subrayados_usuario (user_id, libro_id);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE predicciones_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE anotaciones_usuario  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subrayados_usuario   ENABLE ROW LEVEL SECURITY;

-- Predicciones
CREATE POLICY "predicciones_select" ON predicciones_usuario
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "predicciones_insert" ON predicciones_usuario
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "predicciones_update" ON predicciones_usuario
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "predicciones_delete" ON predicciones_usuario
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Anotaciones
CREATE POLICY "anotaciones_select" ON anotaciones_usuario
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "anotaciones_insert" ON anotaciones_usuario
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "anotaciones_update" ON anotaciones_usuario
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "anotaciones_delete" ON anotaciones_usuario
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Subrayados
CREATE POLICY "subrayados_select" ON subrayados_usuario
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "subrayados_insert" ON subrayados_usuario
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "subrayados_update" ON subrayados_usuario
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "subrayados_delete" ON subrayados_usuario
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
