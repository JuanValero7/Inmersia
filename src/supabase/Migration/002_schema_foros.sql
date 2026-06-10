-- 002_schema_foros.sql
-- Foros por libro (comentarios + replies con tags) y chat efímero 1-a-1

-- ─────────────────────────────────────────
-- FORO
-- ─────────────────────────────────────────

CREATE TABLE foros (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  libro_id    uuid        NOT NULL UNIQUE REFERENCES libros(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE foros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "foros_select" ON foros
  FOR SELECT TO authenticated USING (true);

-- Trigger: crea automáticamente el foro cuando se inserta un libro
CREATE OR REPLACE FUNCTION _crear_foro_para_libro()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO foros (libro_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_foro_nuevo_libro
  AFTER INSERT ON libros
  FOR EACH ROW EXECUTE FUNCTION _crear_foro_para_libro();


-- ─────────────────────────────────────────
-- FORO: COMENTARIOS
-- ─────────────────────────────────────────

CREATE TABLE foros_comentarios (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  foro_id     uuid        NOT NULL REFERENCES foros(id) ON DELETE CASCADE,
  autor_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contenido   text        NOT NULL CHECK (char_length(contenido) > 0),
  parent_id   uuid        REFERENCES foros_comentarios(id) ON DELETE CASCADE,
  tags        text[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- tags solo aplica a comentarios raíz (parent_id IS NULL); los replies no las usan

CREATE INDEX ON foros_comentarios (foro_id, created_at DESC);
CREATE INDEX ON foros_comentarios (parent_id);
CREATE INDEX ON foros_comentarios USING GIN (tags);

ALTER TABLE foros_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "foros_comentarios_select" ON foros_comentarios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "foros_comentarios_insert" ON foros_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid());

CREATE POLICY "foros_comentarios_delete" ON foros_comentarios
  FOR DELETE TO authenticated
  USING (autor_id = auth.uid());


-- ─────────────────────────────────────────
-- CHAT EFÍMERO 1-A-1
-- ─────────────────────────────────────────

CREATE TABLE chat_sesiones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  libro_id    uuid        NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  usuario_a   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario_b   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_sesiones_distintos CHECK (usuario_a <> usuario_b)
);

CREATE INDEX ON chat_sesiones (libro_id);

-- Impide que un usuario esté en más de una sesión activa simultánea (como a o como b)
CREATE OR REPLACE FUNCTION _check_usuario_sin_sesion_activa()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM chat_sesiones
    WHERE usuario_a = NEW.usuario_a
       OR usuario_b = NEW.usuario_a
       OR usuario_a = NEW.usuario_b
       OR usuario_b = NEW.usuario_b
  ) THEN
    RAISE EXCEPTION 'El usuario ya tiene una sesión de chat activa';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chat_sesion_unica
  BEFORE INSERT ON chat_sesiones
  FOR EACH ROW EXECUTE FUNCTION _check_usuario_sin_sesion_activa();

ALTER TABLE chat_sesiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sesiones_select" ON chat_sesiones
  FOR SELECT TO authenticated
  USING (usuario_a = auth.uid() OR usuario_b = auth.uid());

CREATE POLICY "chat_sesiones_insert" ON chat_sesiones
  FOR INSERT TO authenticated
  WITH CHECK (usuario_a = auth.uid());

CREATE POLICY "chat_sesiones_delete" ON chat_sesiones
  FOR DELETE TO authenticated
  USING (usuario_a = auth.uid() OR usuario_b = auth.uid());


-- ─────────────────────────────────────────
-- CHAT: MENSAJES
-- ─────────────────────────────────────────

CREATE TABLE chat_mensajes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id   uuid        NOT NULL REFERENCES chat_sesiones(id) ON DELETE CASCADE,
  autor_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contenido   text        NOT NULL CHECK (char_length(contenido) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON chat_mensajes (sesion_id, created_at ASC);

ALTER TABLE chat_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_mensajes_select" ON chat_mensajes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sesiones s
      WHERE s.id = sesion_id
        AND (s.usuario_a = auth.uid() OR s.usuario_b = auth.uid())
    )
  );

CREATE POLICY "chat_mensajes_insert" ON chat_mensajes
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_sesiones s
      WHERE s.id = sesion_id
        AND (s.usuario_a = auth.uid() OR s.usuario_b = auth.uid())
    )
  );
