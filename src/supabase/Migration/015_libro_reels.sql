-- ═══════════════════════════════════════════════════════
-- 015 · libro_reels
-- Una fila por pantalla del preview reel de un libro.
-- Seed manual desde el Dashboard de Supabase.
-- ═══════════════════════════════════════════════════════

CREATE TABLE libro_reels (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  libro_id   uuid        NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  orden      smallint    NOT NULL,            -- 1-based, define el orden de las pantallas
  imagen_url text,                            -- URL pública (Supabase Storage u externa)
  audio_url  text,                            -- URL pública del clip de audio
  titulo     text,                            -- Título grande de la pantalla
  subtexto   text,                            -- Texto de cuerpo / descripción
  created_at timestamptz DEFAULT now()
);

-- Garantiza que cada libro tenga órdenes únicos
CREATE UNIQUE INDEX libro_reels_libro_orden_idx ON libro_reels(libro_id, orden);

-- Acceso público de lectura (sin auth requerida para ver previews)
ALTER TABLE libro_reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reels visibles para todos"
  ON libro_reels FOR SELECT
  USING (true);

-- Solo el service_role puede insertar/modificar (seed manual desde Dashboard)
CREATE POLICY "Solo admin puede modificar reels"
  ON libro_reels FOR ALL
  USING (auth.role() = 'service_role');
