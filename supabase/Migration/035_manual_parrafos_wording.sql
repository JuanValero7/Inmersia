-- =============================================================
-- INMERSIA — Reescritura del wording de los párrafos del Manual del Explorador
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Español de Venezuela (tuteo). Alinea el texto al flujo real del tutorial:
--   · cap 1 P2 ya NO menciona el selector de capítulo (queda bloqueado durante
--     el tutorial para forzar lectura en orden).
--   · cap 1 P3 describe el sonido por párrafo (donde va el párrafo interactivo).
--
-- Idempotente: UPDATE por capítulo + número de párrafo.
-- =============================================================

DO $$
DECLARE
  cap1_id UUID := '00000000-0000-4000-8000-000000000002';
  cap2_id UUID := '00000000-0000-4000-8000-000000000003';
BEGIN

-- ── Capítulo 1: Bienvenido a Inmersia ──
UPDATE parrafos SET contenido =
  'Abriste el Manual del Explorador, y con eso tu biblioteca cobró vida. Inmersia no es solo un lugar para guardar libros: es un espacio donde cada lectura se vuelve una experiencia completa, con sonido, investigación y conversación. Déjame mostrarte cómo funciona todo.'
  WHERE capitulo_id = cap1_id AND numero = 1;

UPDATE parrafos SET contenido =
  'Para pasar las páginas, toca los bordes de cada hoja: el lado derecho avanza y el izquierdo regresa. En la barra de arriba tienes el control de tipografía, para ajustar el tamaño de la letra y la fuente a tu gusto.'
  WHERE capitulo_id = cap1_id AND numero = 2;

UPDATE parrafos SET contenido =
  'Mientras lees, algunos párrafos guardan un sonido: música o efectos que le dan vida a la historia. Toca el ícono cuando aparezca, o usa el reproductor de la parte de abajo para subir el volumen o pausarlo, sin interrumpir tu lectura.'
  WHERE capitulo_id = cap1_id AND numero = 3;

UPDATE parrafos SET contenido =
  'También puedes seleccionar cualquier frase que te llame la atención para subrayarla. Tus subrayados quedan guardados en el Cuaderno, junto a tus predicciones y anotaciones de cada capítulo.'
  WHERE capitulo_id = cap1_id AND numero = 5;

UPDATE parrafos SET contenido =
  'Cuando llegues al final de este capítulo y avances, el Cuaderno se abrirá solo. Échale un ojo: tiene tres secciones —Predicciones, Anotaciones y Subrayados— con una pestaña por cada capítulo que trabajes.'
  WHERE capitulo_id = cap1_id AND numero = 6;

-- ── Capítulo 2: Tu Kit de Explorador ──
UPDATE parrafos SET contenido =
  'Cerraste el Cuaderno y llegaste hasta aquí. Eso es justo lo que hace un buen explorador. De aquí en adelante, el camino se abre en varias direcciones.'
  WHERE capitulo_id = cap2_id AND numero = 1;

UPDATE parrafos SET contenido =
  'Abajo a la derecha está el botón Explorar. Desde ahí llegas al Cuaderno cuando quieras, a la Cartelera de Investigación —donde el libro revela sus personajes, lugares y secretos a medida que avanzas— y al Foro, para conversar con otros lectores del mismo libro.'
  WHERE capitulo_id = cap2_id AND numero = 2;

UPDATE parrafos SET contenido =
  'La Cartelera tiene algo especial: su contenido se desbloquea poco a poco. Cada capítulo que lees revela elementos nuevos, así que nunca te topas con un spoiler sin querer: solo ves lo que ya leíste.'
  WHERE capitulo_id = cap2_id AND numero = 3;

UPDATE parrafos SET contenido =
  'Tu próxima parada es la Cartelera. Toca Explorar, elige Investigación y descubre lo que este mundo tiene guardado para ti.'
  WHERE capitulo_id = cap2_id AND numero = 4;

END $$;
