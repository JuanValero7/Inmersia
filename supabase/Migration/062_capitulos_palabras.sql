-- =============================================================
-- INMERSIA — Migración 062
-- Palabras por capítulo (para el "% del libro" del lector)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- El lector deja elegir en Aa cómo ver el progreso: % del libro, % del
-- capítulo o número de página. El % del libro se mide en PALABRAS, no en
-- páginas, para que no dependa de la letra ni de la pantalla:
--   (palabras de los capítulos anteriores + palabras leídas del actual)
--   / palabras del libro
-- Las del actual las cuenta el navegador con los párrafos que ya tiene; las
-- de los demás capítulos salen de capitulos.palabras, que viaja con la lista
-- de capítulos que el lector ya pide al abrir el libro (sin consulta extra).
--
-- Cómo se cuenta: cada párrafo se parte por espacios y se cuentan los trozos;
-- los separadores (❧) no cuentan. Es la misma regla que contarPalabras() en
-- src/utils/readerHelpers.js: si se cambia una, cambiar la otra.
--
-- Se mantiene sola: unos triggers sobre `parrafos` la recalculan cuando se
-- cargan, editan o borran párrafos (también el borrado de superusuario), así
-- que el proceso de carga de libros no tiene que hacer nada.
--
-- Va ANTES de subir el código: el lector nuevo ya pide la columna.
-- =============================================================

ALTER TABLE capitulos
  ADD COLUMN IF NOT EXISTS palabras INTEGER;

CREATE OR REPLACE FUNCTION contar_palabras(texto TEXT)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN btrim(coalesce(texto, '')) = '' THEN 0
              ELSE array_length(regexp_split_to_array(btrim(texto), '\s+'), 1) END
$$;

-- SECURITY DEFINER: el borrado de párrafos del superusuario y la carga de
-- libros no tienen por qué tener permiso de UPDATE sobre capitulos.
CREATE OR REPLACE FUNCTION recalcular_palabras_capitulos(ids UUID[])
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE capitulos c
  SET palabras = coalesce((
    SELECT sum(contar_palabras(p.contenido))
    FROM parrafos p
    WHERE p.capitulo_id = c.id AND p.tipo <> 'separador'
  ), 0)
  WHERE c.id = ANY(ids);
$$;

-- Solo la usan los triggers: nadie la llama desde la app.
REVOKE EXECUTE ON FUNCTION recalcular_palabras_capitulos(UUID[]) FROM PUBLIC, anon, authenticated;

-- Triggers por SENTENCIA (no por fila): una carga de 300 párrafos recalcula
-- cada capítulo una vez, no 300. Postgres no deja una tabla de transición en
-- un trigger de varios eventos, de ahí uno por evento.
CREATE OR REPLACE FUNCTION trg_palabras_insert() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM recalcular_palabras_capitulos(ARRAY(SELECT DISTINCT capitulo_id FROM nuevos));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION trg_palabras_update() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM recalcular_palabras_capitulos(ARRAY(
    SELECT capitulo_id FROM nuevos UNION SELECT capitulo_id FROM viejos));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION trg_palabras_delete() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM recalcular_palabras_capitulos(ARRAY(SELECT DISTINCT capitulo_id FROM viejos));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_parrafos_palabras_ins ON parrafos;
DROP TRIGGER IF EXISTS trg_parrafos_palabras_upd ON parrafos;
DROP TRIGGER IF EXISTS trg_parrafos_palabras_del ON parrafos;

CREATE TRIGGER trg_parrafos_palabras_ins AFTER INSERT ON parrafos
  REFERENCING NEW TABLE AS nuevos
  FOR EACH STATEMENT EXECUTE FUNCTION trg_palabras_insert();

CREATE TRIGGER trg_parrafos_palabras_upd AFTER UPDATE ON parrafos
  REFERENCING NEW TABLE AS nuevos OLD TABLE AS viejos
  FOR EACH STATEMENT EXECUTE FUNCTION trg_palabras_update();

CREATE TRIGGER trg_parrafos_palabras_del AFTER DELETE ON parrafos
  REFERENCING OLD TABLE AS viejos
  FOR EACH STATEMENT EXECUTE FUNCTION trg_palabras_delete();

-- Relleno de lo que ya está cargado.
SELECT recalcular_palabras_capitulos(ARRAY(SELECT id FROM capitulos));

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN: palabras por libro (deberían rondar las de cada novela)
-- ─────────────────────────────────────────────────────────────
SELECT l.titulo, count(c.id) AS capitulos, sum(c.palabras) AS palabras,
       count(*) FILTER (WHERE c.palabras IS NULL OR c.palabras = 0) AS capitulos_vacios
FROM libros l JOIN capitulos c ON c.libro_id = l.id
GROUP BY l.titulo
ORDER BY l.titulo;
