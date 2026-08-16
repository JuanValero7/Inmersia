-- =============================================================
-- INMERSIA — Manual del Explorador: contenido v2 de los capítulos 1 y 2
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Reemplaza por completo los párrafos del libro tutorial (reescritos por el
-- autor). Cambia la CANTIDAD de párrafos, así que no basta con UPDATE por
-- número como en 035: se borran y se vuelven a insertar.
--
-- Orden de borrado:
--   1. progreso_lectura.ultimo_parrafo_id NO tiene ON DELETE CASCADE → se
--      pone en NULL antes de borrar (el usuario reabre el manual desde el inicio).
--   2. elementos_interactivos y cuaderno_* sí cascadean / SET NULL solos.
--
-- Español de Venezuela (tuteo). Idempotente: se puede correr las veces que sea.
-- =============================================================

DO $$
DECLARE
  manual_id UUID := '00000000-0000-4000-8000-000000000001';
  cap1_id   UUID := '00000000-0000-4000-8000-000000000002';
  cap2_id   UUID := '00000000-0000-4000-8000-000000000003';
BEGIN

-- ── 1. Soltar las referencias sin cascade ──
UPDATE progreso_lectura SET ultimo_parrafo_id = NULL
 WHERE ultimo_parrafo_id IN (SELECT id FROM parrafos WHERE capitulo_id IN (cap1_id, cap2_id));

-- ── 2. Borrar el contenido viejo ──
DELETE FROM parrafos WHERE capitulo_id IN (cap1_id, cap2_id);

-- ─────────────────────────────────────────────────────────────
-- CAPÍTULO 1 — Bienvenido a Inmersia
-- ─────────────────────────────────────────────────────────────
INSERT INTO parrafos (libro_id, capitulo_id, numero, contenido, tipo, tiene_interactivo)
VALUES
(manual_id, cap1_id, 1,
'Inmersia no es solo un lugar para guardar libros: es un espacio donde cada lectura se vuelve una experiencia completa, con sonido, investigación y conversación. Déjame mostrarte cómo funciona todo.',
'texto', false),

(manual_id, cap1_id, 2,
'Para pasar las páginas, toca los bordes de cada hoja: el lado derecho avanza y el izquierdo regresa. En la barra de arriba tienes el control de tu experiencia.',
'texto', false),

(manual_id, cap1_id, 3,
'Aa: control de tipografía, tamaño de letra y modo día/noche.',
'texto', false),

(manual_id, cap1_id, 4,
'X-ray: analiza el capítulo y te permite ver qué personajes aparecen en él, si es ficción, o qué términos, si es no ficción.',
'texto', false),

(manual_id, cap1_id, 5,
'Sonidos: una característica única de la no ficción, donde podrás elegir entre una variedad de ruidos blancos para aumentar tu concentración.',
'texto', false),

(manual_id, cap1_id, 6,
'Selector de capítulos.',
'texto', false),

(manual_id, cap1_id, 7,
'Mientras lees, algunos párrafos guardan un efecto de sonido que le da vida a la historia. Podría aparecer un elefante marcando su territorio o un avión a punto de despegar; podría ser un grito desgarrador o simplemente un carruaje transitando las calles del Londres victoriano.',
'texto', false),

(manual_id, cap1_id, 8,
'Al final de cada capítulo aparecerá una imagen, recreando la escena más memorable de esa parte del libro. En el caso de que sea no ficción, Inmersia te provee una infografía con el resumen de lo leído.',
'texto', false),

(manual_id, cap1_id, 9,
'También puedes seleccionar cualquier frase que te llame la atención para subrayarla. Tus subrayados quedan guardados en el Cuaderno, junto a tus predicciones y las anotaciones que tengas de cada capítulo.',
'texto', false),

(manual_id, cap1_id, 10,
'El Cuaderno puede abrirse abajo a la derecha si estás en una computadora, o presionando a tu compañero abajo a la izquierda si estás desde tu teléfono. Por defecto, cada vez que termines un capítulo se abrirá automáticamente, permitiéndote escribir lo que quieras. Nuestra recomendación es que no lo ignores: es clave para que todo sea más divertido. Avanza al próximo capítulo cuando hayas explorado lo que quieras dentro del lector.',
'texto', false);

-- ─────────────────────────────────────────────────────────────
-- CAPÍTULO 2 — Tu Kit de Explorador
-- ─────────────────────────────────────────────────────────────
INSERT INTO parrafos (libro_id, capitulo_id, numero, contenido, tipo, tiene_interactivo)
VALUES
(manual_id, cap2_id, 1,
'Arriba a la derecha apareció el botón de Explorar; es desde allí donde podrás desplazarte a cualquier lugar de Inmersia. Ahora, en el tour, solo aparecerá Investigación, que es nuestra siguiente parada. Sin embargo, una vez sepas todo lo que tenemos para ti, tendrás libertad total para ir a donde quieras.',
'texto', false),

(manual_id, cap2_id, 2,
'La Investigación es una ventana a lo que ya has leído. Tendrás un extracto de cada personaje, lugar y hecho a medida que avanzas en el libro. Si es no ficción, eso será reemplazado por el glosario, las referencias y los resúmenes de cada capítulo.',
'texto', false),

(manual_id, cap2_id, 3,
'La cereza del pastel son las predicciones: al final del libro verás cómo fue evolucionando tu imaginación y qué cosas que creíste que pasarían fueron ciertas. La Cartelera de Investigación las analizará y te lo dejará saber. Capaz descubres que lo tuyo siempre fue la inferencia y terminas teniendo un podcast de true crime.',
'texto', false),

(manual_id, cap2_id, 4,
'¡Espera! Antes de continuar, ¿te fijaste que apareció el botón de Reseña arriba? Al terminar el libro podrás dejar tu opinión, así los próximos usuarios sabrán qué esperarse cuando estén en la tienda, eligiendo su próxima lectura.',
'texto', false);

END $$;
