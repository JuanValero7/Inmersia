-- =============================================================
-- INMERSIA — Migración 069
-- libros_resumen: sonidos que de verdad suenan + primera línea a mano
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO (revisión de la 067 con datos reales, 1 oct 2026)
-- 1) SONIDOS. La 067 contaba todos los audios de media_por_parrafo, también
--    los que entran por etiqueta de escena (origen 'tag'). Pero en ficción el
--    ambiente por etiqueta está apagado (AMBIENTE_FICCION_ACTIVO = false en
--    src/components/lector/readerConstants.js). Lo que de verdad suena al leer
--    son los efectos anclados a una frase (origen 'explicito', ver
--    visibleSfx en Lector.jsx). Ahora se cuentan esos momentos: cada pareja
--    párrafo + sonido una vez. La ficha dirá «momentos con sonido».
--    Los libros de no ficción dan 0 (su audio es otro) y la ficha oculta la
--    tarjeta cuando vale 0.
--
-- 2) PRIMERA LÍNEA. En varios libros el capítulo 1 es una dedicatoria, un
--    prólogo o un índice numerado, y la regla automática (primer párrafo de
--    90 caracteres o más) no sirve. Se añade `libros.primera_linea`: si tiene
--    texto, manda; si es NULL, sigue la regla automática. Es una columna
--    pequeña y solo se rellena donde la regla falla.
--
-- CREATE OR REPLACE: mismas columnas, mismos nombres y tipos que la 067.
-- =============================================================

ALTER TABLE libros ADD COLUMN IF NOT EXISTS primera_linea TEXT;

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

  -- Momentos con sonido: efectos anclados a una frase (lo que suena al leer).
  (SELECT count(DISTINCT (m.parrafo_id, m.media_id))
     FROM media_por_parrafo m
    WHERE m.libro_id = l.id AND m.tipo = 'audio'
      AND m.origen = 'explicito')::INT                                  AS sonidos,

  -- Ficción: personajes y lugares. No ficción: todas sus fichas (ver 067).
  (SELECT count(DISTINCT (ci.seccion, lower(btrim(ci.nombre))))
     FROM cartelera_items ci
    WHERE ci.libro_id = l.id
      AND (l.es_ficcion = FALSE OR ci.seccion IN ('personajes', 'lugares')))::INT AS fichas,

  COALESCE(
    l.primera_linea,
    (SELECT p.contenido
       FROM capitulos c
       JOIN parrafos  p ON p.capitulo_id = c.id
      WHERE c.libro_id = l.id AND c.numero = 1
        AND p.tipo IN ('texto', 'dialogo')
        AND char_length(p.contenido) >= 90
      ORDER BY p.numero
      LIMIT 1)
  )                                                                     AS primera_linea
FROM libros l
WHERE l.visible;

GRANT SELECT ON libros_resumen TO anon, authenticated;

-- ── Primeras líneas fijadas a mano ─────────────────────────
-- Meditaciones: el Libro I es una lista numerada de agradecimientos.
UPDATE libros SET primera_linea =
  'Al despuntar la aurora, hazte estas consideraciones previas: me encontraré con un indiscreto, un ingrato, un insolente, un mentiroso, un envidioso, un insociable. Todo eso les acontece por ignorancia de los bienes y de los males.'
WHERE slug = 'meditaciones';

-- El pragmatismo: el capítulo 1 es la dedicatoria y el prefacio.
UPDATE libros SET primera_linea =
  'En el prefacio a esa admirable colección de ensayos titulada Heretics, Chesterton escribe estas palabras: Hay personas, y yo soy una de ellas, que piensan que la cosa más práctica e importante en el hombre es su punto de vista acerca del universo.'
WHERE slug = 'el-pragmatismo';

-- Ensayos: el capítulo 1 es el poema de apertura (versos cortos, salía NULL).
UPDATE libros SET primera_linea =
  'Existe una mente común a todos los hombres. Cada hombre es una entrada a esa misma mente y a todo lo que ella contiene.'
WHERE slug = 'ensayos-primera-serie';

-- PENDIENTE DE JUAN: El Principito y Largo viaje hacia la noche abren con su
-- dedicatoria, que es célebre en los dos casos. Si prefieres el comienzo de la
-- historia, quita los dos guiones del principio de estas líneas:
-- UPDATE libros SET primera_linea = 'Cuando yo tenía seis años vi en un libro sobre la selva virgen que se titulaba "Historias vividas", una magnífica lámina. Representaba una serpiente boa que se tragaba a una fiera.' WHERE slug = 'el-principito';
-- UPDATE libros SET primera_linea = 'Sala de estar de la residencia de verano de James TYRONE. Una mañana de agosto de 1912.' WHERE slug = 'largo-viaje-hacia-la-noche';

-- ── Comprobación ───────────────────────────────────────────
SELECT l.titulo, r.sonidos, r.fichas, left(r.primera_linea, 80) AS primera_linea
FROM libros_resumen r JOIN libros l ON l.id = r.libro_id
ORDER BY l.orden NULLS LAST;
