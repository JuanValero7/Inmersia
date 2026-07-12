-- =============================================================
-- INMERSIA — Álbum: barajitas pegadas por el usuario
--
-- Una barajita desbloqueada (por progreso de lectura) queda "pendiente"
-- hasta que el usuario hace el gesto de pegarla en el Álbum. Esta tabla
-- guarda ese estado de forma permanente (nunca se vuelve a pedir).
--
-- item_key sigue el mismo criterio de dedup que useAlbum.js:
-- slug || url || titulo || nombre, scopeado por libro_id + seccion.
-- =============================================================

CREATE TABLE IF NOT EXISTS album_barajitas_pegadas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id   UUID        NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  seccion    TEXT        NOT NULL,
  item_key   TEXT        NOT NULL,
  pegada_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, libro_id, seccion, item_key)
);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE album_barajitas_pegadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "album_pegadas_select" ON album_barajitas_pegadas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "album_pegadas_insert" ON album_barajitas_pegadas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────
SELECT user_id, libro_id, seccion, item_key, pegada_at
FROM album_barajitas_pegadas
LIMIT 5;
