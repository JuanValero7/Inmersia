-- =============================================================
-- INMERSIA — Migración 039
-- Foro: topes reales en la BD + moderación de superusuario
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA 1 — los límites eran solo del cliente
-- foros_comentarios.contenido solo tenía CHECK (char_length > 0). El tope de
-- 2000 caracteres vive en ForoComentarios.jsx, así que se salta con un POST
-- directo a la API REST (la anon key es pública por diseño). Lo mismo con
-- `tags`, un text[] sin límite de elementos ni de longitud, y con
-- resenas_libros.texto.
--
-- PROBLEMA 2 — no había forma de moderar
-- La única política de DELETE es `autor_id = auth.uid()`: cada quien borra lo
-- suyo y nadie más. Un comentario abusivo solo se podía quitar entrando al
-- dashboard de Supabase.
--
-- NOTA sobre la longitud de cada etiqueta: PostgreSQL NO admite subconsultas
-- dentro de un CHECK (error 0A000), y medir el elemento más largo de un array
-- exige unnest(), que es una subconsulta. Por eso el tope por etiqueta va en un
-- trigger que RECORTA en vez de rechazar — así un cliente antiguo nunca recibe
-- un error por algo que puede arreglarse solo.
--
-- Idempotente: se puede ejecutar entera más de una vez sin error, aunque una
-- ejecución anterior se hubiera aplicado a medias.
-- =============================================================

-- ── 1. Tope de longitud del comentario ───────────────────────
-- Recorta cualquier fila existente que se pase (no debería haber ninguna:
-- el cliente ya limitaba a 2000).
UPDATE foros_comentarios
SET contenido = left(contenido, 2000)
WHERE char_length(contenido) > 2000;

ALTER TABLE foros_comentarios
  DROP CONSTRAINT IF EXISTS foros_comentarios_contenido_max;

ALTER TABLE foros_comentarios
  ADD CONSTRAINT foros_comentarios_contenido_max
  CHECK (char_length(contenido) <= 2000);

-- ── 2a. Número de etiquetas (esto sí cabe en un CHECK) ───────
UPDATE foros_comentarios
SET tags = tags[1:5]
WHERE array_length(tags, 1) > 5;

ALTER TABLE foros_comentarios
  DROP CONSTRAINT IF EXISTS foros_comentarios_tags_max;

ALTER TABLE foros_comentarios
  ADD CONSTRAINT foros_comentarios_tags_max
  CHECK (coalesce(array_length(tags, 1), 0) <= 5);

-- ── 2b. Longitud de cada etiqueta, vía trigger ───────────────
-- Normaliza las filas que ya existan…
UPDATE foros_comentarios c
SET tags = sub.recortadas
FROM (
  SELECT id, coalesce(array_agg(left(t, 40)), '{}') AS recortadas
  FROM foros_comentarios, unnest(tags) AS t
  GROUP BY id
) AS sub
WHERE c.id = sub.id AND c.tags IS DISTINCT FROM sub.recortadas;

-- …y todas las futuras.
CREATE OR REPLACE FUNCTION public.foro_recortar_tags()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- coalesce es imprescindible: unnest('{}') no devuelve filas y array_agg
  -- daría NULL, pero la columna es NOT NULL. El caso corriente son justamente
  -- las respuestas, que se insertan con tags = '{}'.
  SELECT coalesce(array_agg(left(t, 40)), '{}')
    INTO NEW.tags
    FROM unnest(coalesce(NEW.tags, '{}')) AS t;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_foro_recortar_tags ON foros_comentarios;
CREATE TRIGGER trg_foro_recortar_tags
  BEFORE INSERT OR UPDATE ON foros_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.foro_recortar_tags();

-- ── 3. Mismo tope para las reseñas ───────────────────────────
-- resenas_libros.texto tampoco tenía límite; el cliente valida 1000
-- (ver useLectorData.submitResena).
UPDATE resenas_libros
SET texto = left(texto, 1000)
WHERE texto IS NOT NULL AND char_length(texto) > 1000;

ALTER TABLE resenas_libros
  DROP CONSTRAINT IF EXISTS resenas_libros_texto_max;

ALTER TABLE resenas_libros
  ADD CONSTRAINT resenas_libros_texto_max
  CHECK (texto IS NULL OR char_length(texto) <= 1000);

-- ── 4. Moderación: el superusuario puede borrar cualquier comentario ──
-- Política APARTE de foros_comentarios_delete, que se queda como está
-- (cada autor borra lo suyo). Las políticas permisivas se suman con OR.
DROP POLICY IF EXISTS "superusuario_comentarios_delete" ON foros_comentarios;

CREATE POLICY "superusuario_comentarios_delete"
  ON foros_comentarios FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.superusuarios s
      WHERE s.user_id = (SELECT auth.uid())
    )
  );


-- =============================================================
-- COMPROBACIÓN
--   · Los topes (debe dar error, no insertar):
--       INSERT INTO foros_comentarios (foro_id, autor_id, contenido)
--       VALUES ('<un foro_id>', auth.uid(), repeat('x', 2001));
--     Esperado: new row violates check constraint
--
--   · El trigger (debe insertar, con la etiqueta recortada a 40):
--       INSERT INTO foros_comentarios (foro_id, autor_id, contenido, tags)
--       VALUES ('<un foro_id>', auth.uid(), 'prueba', ARRAY[repeat('y', 100)])
--       RETURNING char_length(tags[1]);
--     Esperado: 40
--
--   · Que las respuestas con tags vacíos siguen entrando:
--       INSERT INTO foros_comentarios (foro_id, autor_id, contenido, tags)
--       VALUES ('<un foro_id>', auth.uid(), 'prueba vacia', '{}')
--       RETURNING tags;
--     Esperado: {}   (NO null)
-- =============================================================
