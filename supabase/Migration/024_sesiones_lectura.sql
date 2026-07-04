-- =============================================================
-- INMERSIA — Sesiones de lectura
-- Registra cada episodio de lectura de un usuario en un libro.
-- Alimenta las stats del Álbum: tiempo total, veces abierto,
-- sesión más larga.
--
-- Lógica de sesiones:
--   · Una sesión = un "episodio de lectura" (sit-down).
--   · Si el usuario sale al lector en menos de 30 min,
--     retoma la misma sesión (handled client-side con sessionStorage).
--   · La duración se computa a query-time: ended_at - started_at.
--     Breves desvíos a Investigación/Foro dentro del timeout
--     cuentan como parte del episodio.
-- =============================================================

CREATE TABLE IF NOT EXISTS sesiones_lectura (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id    UUID        NOT NULL REFERENCES libros(id)     ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ
);

-- Lookup principal: stats de un usuario para un libro
CREATE INDEX IF NOT EXISTS idx_sesiones_user_libro
  ON sesiones_lectura (user_id, libro_id);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE sesiones_lectura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sesiones_select"
  ON sesiones_lectura FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "sesiones_insert"
  ON sesiones_lectura FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sesiones_update"
  ON sesiones_lectura FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sesiones_lectura'
ORDER BY ordinal_position;
