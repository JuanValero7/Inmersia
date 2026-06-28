-- =============================================================
-- INMERSIA — Preferencias de usuario
-- Almacena los últimos libros abiertos por usuario (máx. 3),
-- reemplazando el localStorage para sincronizar entre dispositivos.
-- =============================================================

CREATE TABLE IF NOT EXISTS preferencias_usuario (
  user_id        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ultimos_libros UUID[]      NOT NULL DEFAULT '{}',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE preferencias_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prefs_select"
  ON preferencias_usuario FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "prefs_insert"
  ON preferencias_usuario FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prefs_update"
  ON preferencias_usuario FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
