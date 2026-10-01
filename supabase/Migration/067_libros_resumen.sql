-- =============================================================
-- INMERSIA — Migración 067
-- libros_resumen: lo que trae cada libro (para la ficha y los carriles)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- La ficha nueva de la Tienda tiene un bloque «Lo que trae en Inmersia»
-- (tiempo de lectura · ilustraciones · ambientes sonoros · personajes y
-- lugares de la Cartelera) y «Así empieza» (la primera línea del libro). El
-- carril «Se leen en una tarde» necesita el largo de cada libro.
--
-- Es una VISTA: calcula sobre lo que ya existe y no guarda nada nuevo (nada de
-- tablas de poco valor). Fuentes:
--   capitulos, palabras  → capitulos.palabras (062, se mantiene sola)
--   ilustraciones, sonidos → media_por_parrafo (063), medios distintos por tipo
--   fichas               → cartelera_items, cada uno una vez aunque aparezca en
--                          varios capítulos. Ficción: personajes y lugares. No
--                          ficción: todas sus secciones (no tiene personajes).
--                          Se agrupa por nombre (sin mayúsculas ni espacios de
--                          más), como hacen el Álbum y la Cartelera. La columna
--                          nombre_canonico que proponía la 017 no existe en la
--                          base de datos (error 42703 al correr esta migración)
--   primera_linea        → primer párrafo del capítulo 1 con 90 caracteres o
--                          más. Así se salta dedicatorias y títulos sueltos
--                          («A Leon Werth:», «HISTORIA»). Si ninguno llega,
--                          NULL y la ficha no muestra «Así empieza». Algunos
--                          libros fallan (Meditaciones abre con «3. De mi
--                          madre…»): Juan revisa la comprobación de abajo.
--
-- El tiempo de lectura lo calcula la app: palabras / 230 por minuto.
--
-- PERMISOS: la vista corre con los permisos de su dueño, no del que consulta
-- (security_invoker = false). Hace falta porque un invitado solo ve 2
-- capítulos por RLS (037) y aquí se cuentan todos. Solo expone recuentos y el
-- primer párrafo del capítulo 1, que el invitado ya puede leer. El linter de
-- Supabase la marcará como «security definer view»: es a propósito.
--
-- RENDIMIENTO: la ficha pide UN libro (.eq('libro_id', …)) y el filtro baja a
-- las subconsultas, que en media_por_parrafo usan el índice por libro (063).
-- Los carriles piden solo libro_id y palabras de todos: Postgres no calcula
-- las columnas que no se piden.
-- =============================================================

CREATE OR REPLACE VIEW libros_resumen
WITH (security_invoker = false) AS
SELECT
  l.id AS libro_id,

  (SELECT count(*)
     FROM capitulos c WHERE c.libro_id = l.id)::INT                     AS capitulos,

  (SELECT COALESCE(sum(c.palabras), 0)
     FROM capitulos c WHERE c.libro_id = l.id)::INT                     AS palabras,

  (SELECT count(DISTINCT m.media_id)
     FROM media_por_parrafo m
    WHERE m.libro_id = l.id AND m.tipo = 'imagen')::INT                 AS ilustraciones,

  (SELECT count(DISTINCT m.media_id)
     FROM media_por_parrafo m
    WHERE m.libro_id = l.id AND m.tipo = 'audio')::INT                  AS sonidos,

  -- Ficción: personajes y lugares. No ficción: no hay personajes, así que
  -- cuenta todas sus fichas (glosario, referencias, datos…), igual que la
  -- sección «Infografías» del Álbum. La app cambia la etiqueta según es_ficcion.
  (SELECT count(DISTINCT (ci.seccion, lower(btrim(ci.nombre))))
     FROM cartelera_items ci
    WHERE ci.libro_id = l.id
      AND (l.es_ficcion = FALSE OR ci.seccion IN ('personajes', 'lugares')))::INT AS fichas,

  (SELECT p.contenido
     FROM capitulos c
     JOIN parrafos  p ON p.capitulo_id = c.id
    WHERE c.libro_id = l.id AND c.numero = 1
      AND p.tipo IN ('texto', 'dialogo')
      AND char_length(p.contenido) >= 90
    ORDER BY p.numero
    LIMIT 1)                                                             AS primera_linea
FROM libros l
WHERE l.visible;

GRANT SELECT ON libros_resumen TO anon, authenticated;

-- ── Comprobación ───────────────────────────────────────────
-- Qué secciones usa cada tipo de libro (para confirmar el criterio de `fichas`).
SELECT CASE WHEN l.es_ficcion = FALSE THEN 'no ficción' ELSE 'ficción' END AS tipo,
       ci.seccion, count(DISTINCT (ci.libro_id, lower(btrim(ci.nombre)))) AS fichas
FROM cartelera_items ci JOIN libros l ON l.id = ci.libro_id
WHERE l.visible
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

-- Revisa sobre todo `primera_linea`: si alguna no sirve, se decide libro a libro.
SELECT l.titulo, r.capitulos, r.palabras,
       round(r.palabras / 230.0 / 60, 1) AS horas,
       r.ilustraciones, r.sonidos, r.fichas,
       left(r.primera_linea, 90) AS primera_linea
FROM libros_resumen r JOIN libros l ON l.id = r.libro_id
ORDER BY l.orden NULLS LAST;
