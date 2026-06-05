-- Plain Text SQL (.sql)
-- Historial de las últimas conversaciones de chat por usuario y foro.
-- Registra cada vez que dos usuarios inician un chat; se usa para mostrar
-- las últimas 5 personas con las que habló el usuario en ese foro.

CREATE TABLE chat_historial (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  foro_id    uuid        NOT NULL REFERENCES foros(id)      ON DELETE CASCADE,
  partner_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON chat_historial (user_id, foro_id, created_at DESC);

ALTER TABLE chat_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_historial_select" ON chat_historial
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "chat_historial_insert" ON chat_historial
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
