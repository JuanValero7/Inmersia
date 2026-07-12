-- 027_foro_spoilers.sql
-- Permite marcar comentarios (y respuestas) del foro como spoiler.
-- El contenido se oculta en el cliente hasta que el lector decide revelarlo.

ALTER TABLE foros_comentarios
  ADD COLUMN es_spoiler boolean NOT NULL DEFAULT false;
