-- =============================================================
-- INMERSIA — Manual del Explorador: controles numerados, el gato del móvil
--            y un cierre explícito del capítulo 2
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ CAMBIA
--   Cap. 1 · Los cuatro controles de la barra de arriba pasan a estar
--            NUMERADOS (1. Aa … 4. Selector de capítulos), y el selector deja
--            de ser una línea suelta: se explica qué hace y por qué durante el
--            tutorial sale con candado (BookReader.jsx lo bloquea con
--            `chapterLocked` para forzar lectura en orden).
--          · Párrafo NUEVO, justo antes de la lista: en el teléfono el gato de
--            abajo a la izquierda abre las herramientas. Antes esto solo se
--            contaba en el último párrafo del capítulo — demasiado tarde para
--            quien está leyendo desde el móvil.
--            Dice la verdad de LectorMobile.jsx: la barra Aa / X-ray / capítulo
--            vive bajo el título, y el gato guarda Cuaderno, Subrayar y Audio.
--   Cap. 2 · Párrafo NUEVO al final: que le dé a Explorar → Investigación.
--            Repite a propósito lo que ya dice el párrafo 1 del capítulo.
--
-- POR QUÉ NO SE BORRA NADA (a diferencia de 036)
--   El DELETE de párrafos CASCADEA a elementos_interactivos, y el último
--   párrafo del cap. 1 tiene enganchado el gato negro del Álbum (ver
--   044_manual_gato_negro_capitulo.sql). Acá se hace todo con UPDATE +
--   corrimiento de `numero`, así que las filas —y sus enlaces— sobreviven.
--   El UNIQUE (capitulo_id, numero) no es deferrable: por eso los corrimientos
--   pasan por un offset temporal de +1000 en vez de sumar 1 en sitio.
--
-- Español de Venezuela (tuteo). Idempotente: se puede correr las veces que sea.
-- =============================================================

DO $$
DECLARE
  manual_id UUID := '00000000-0000-4000-8000-000000000001';
  cap1_id   UUID := '00000000-0000-4000-8000-000000000002';
  cap2_id   UUID := '00000000-0000-4000-8000-000000000003';
BEGIN

-- ─────────────────────────────────────────────────────────────
-- 0. Idempotencia: quitar los párrafos que inserta ESTA migración.
--    Son párrafos nuevos, sin media ni elementos enganchados, así que
--    borrarlos no arrastra nada. Se identifican por su frase de arranque.
-- ─────────────────────────────────────────────────────────────
DELETE FROM parrafos
 WHERE capitulo_id = cap1_id AND contenido LIKE 'Si lees desde el teléfono%';
DELETE FROM parrafos
 WHERE capitulo_id = cap2_id AND contenido LIKE 'Última cosa antes de irte%';

-- ─────────────────────────────────────────────────────────────
-- 1. Compactar la numeración (1..n en el orden actual), por si el borrado
--    de arriba dejó huecos en una segunda corrida.
-- ─────────────────────────────────────────────────────────────
UPDATE parrafos SET numero = numero + 1000 WHERE capitulo_id IN (cap1_id, cap2_id);

WITH ord AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY capitulo_id ORDER BY numero) AS n
    FROM parrafos WHERE capitulo_id IN (cap1_id, cap2_id)
)
UPDATE parrafos p SET numero = ord.n FROM ord WHERE p.id = ord.id;

-- ─────────────────────────────────────────────────────────────
-- 2. Capítulo 1 — numerar los controles (párrafos 3 a 6 de 036)
-- ─────────────────────────────────────────────────────────────
UPDATE parrafos SET contenido =
  '1. Aa: control de tipografía, tamaño de letra y modo día/noche.'
  WHERE capitulo_id = cap1_id AND numero = 3;

UPDATE parrafos SET contenido =
  '2. X-ray: analiza el capítulo y te permite ver qué personajes aparecen en él, si es ficción, o qué términos, si es no ficción.'
  WHERE capitulo_id = cap1_id AND numero = 4;

UPDATE parrafos SET contenido =
  '3. Sonidos: una característica única de la no ficción, donde podrás elegir entre una variedad de ruidos blancos para aumentar tu concentración.'
  WHERE capitulo_id = cap1_id AND numero = 5;

UPDATE parrafos SET contenido =
  '4. Selector de capítulos: te dice en cuál vas y, al tocarlo, abre la lista completa del libro para que saltes al capítulo que quieras. Aquí en el tutorial lo verás con un candado, porque esta lectura va en orden; en tus libros lo tienes siempre a la mano.'
  WHERE capitulo_id = cap1_id AND numero = 6;

-- ─────────────────────────────────────────────────────────────
-- 3. Capítulo 1 — párrafo nuevo del gato, ANTES de la lista de controles
--    (queda de número 3; el resto del capítulo corre uno hacia abajo)
-- ─────────────────────────────────────────────────────────────
UPDATE parrafos SET numero = numero + 1000
 WHERE capitulo_id = cap1_id AND numero >= 3;

INSERT INTO parrafos (libro_id, capitulo_id, numero, contenido, tipo, tiene_interactivo)
VALUES (manual_id, cap1_id, 3,
'Si lees desde el teléfono, esa barra la tienes justo debajo del título, y tu gato guarda el resto: tócalo abajo a la izquierda y se abren tus herramientas —el Cuaderno, el subrayado y el audio—. Acostúmbrate a él, porque es tu botón para casi todo.',
'texto', false);

UPDATE parrafos SET numero = numero - 999
 WHERE capitulo_id = cap1_id AND numero >= 1000;

-- ─────────────────────────────────────────────────────────────
-- 4. Capítulo 2 — párrafo nuevo de cierre, al final del capítulo
-- ─────────────────────────────────────────────────────────────
INSERT INTO parrafos (libro_id, capitulo_id, numero, contenido, tipo, tiene_interactivo)
SELECT manual_id, cap2_id, COALESCE(MAX(numero), 0) + 1,
'Última cosa antes de irte: toca Explorar, arriba a la derecha, y entra en Investigación. Ya te lo dije al empezar el capítulo, pero prefiero repetírtelo a que te quedes aquí dando vueltas. Nos vemos allá.',
'texto', false
FROM parrafos WHERE capitulo_id = cap2_id;

END $$;

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN — cap. 1 con 11 párrafos (el gato de 3º, controles 4..7)
--                y cap. 2 con 5 (el cierre de último)
-- ─────────────────────────────────────────────────────────────
SELECT c.numero AS capitulo, p.numero, LEFT(p.contenido, 70) AS inicio
FROM parrafos p
JOIN capitulos c ON c.id = p.capitulo_id
WHERE p.libro_id = '00000000-0000-4000-8000-000000000001'
ORDER BY c.numero, p.numero;

-- El enlace del gato negro del Álbum sigue en pie (debe devolver 1 fila):
SELECT ei.id, p.numero AS parrafo
FROM elementos_interactivos ei
JOIN parrafos p ON p.id = ei.parrafo_id
WHERE p.capitulo_id = '00000000-0000-4000-8000-000000000002';
