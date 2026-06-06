-- =============================================================
-- INMERSIA — Manual del Explorador (libro tutorial)
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- UUID fijo del libro: 00000000-0000-4000-8000-000000000001
-- Este mismo UUID está hardcodeado en src/lib/constants.js
--
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

DO $$
DECLARE
  manual_id  UUID := '00000000-0000-4000-8000-000000000001';
  cap1_id    UUID := '00000000-0000-4000-8000-000000000002';
  cap2_id    UUID := '00000000-0000-4000-8000-000000000003';
BEGIN

-- ─────────────────────────────────────────────────────────────
-- LIBRO
-- ─────────────────────────────────────────────────────────────
INSERT INTO libros (id, titulo, autor, paginas, descripcion, color, metadata)
VALUES (
  manual_id,
  'Manual del Explorador',
  'Biblioteca Virtual',
  8,
  'Tu guía de bienvenida a Inmersia. Descubre cómo leer, anotar, investigar y conectar con otros lectores.',
  '#5a7a4a',
  '{"idioma": "es", "genero": "Tutorial", "capitulos_total": 2}'
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- CAPÍTULOS
-- ─────────────────────────────────────────────────────────────
INSERT INTO capitulos (id, libro_id, numero, titulo)
VALUES
  (cap1_id, manual_id, 1, 'Bienvenido a Inmersia'),
  (cap2_id, manual_id, 2, 'Tu Kit de Explorador')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- PÁRRAFOS — Capítulo 1: Bienvenido a Inmersia
-- ─────────────────────────────────────────────────────────────
INSERT INTO parrafos (libro_id, capitulo_id, numero, contenido, tipo, tiene_interactivo)
VALUES
(manual_id, cap1_id, 1,
'Abriste el Manual del Explorador. Eso significa que tu biblioteca acaba de cobrar vida. Inmersia no es solo un lugar para guardar libros: es un espacio donde cada lectura se convierte en una experiencia completa, con sonido, investigación y conversación.',
'texto', false),

(manual_id, cap1_id, 2,
'Para moverte entre páginas, haz clic en los extremos de cada hoja. El lado derecho avanza; el izquierdo regresa. En la barra superior encontrarás el selector de capítulo para saltar directamente a cualquier sección, y el control de tipografía para ajustar el tamaño del texto y la fuente a tu gusto.',
'texto', false),

(manual_id, cap1_id, 3,
'Mientras lees, algunos capítulos tienen un sonido ambiental que acompaña la atmósfera de la historia. El reproductor está en la esquina inferior de la pantalla. Puedes ajustar el volumen o pausarlo cuando quieras, sin interrumpir tu lectura.',
'texto', false),

(manual_id, cap1_id, 4,
'* * *',
'separador', false),

(manual_id, cap1_id, 5,
'También puedes seleccionar cualquier fragmento de texto que te llame la atención para subrayarlo. Esos subrayados quedan guardados en tu Cuaderno de lectura, junto a tus predicciones y anotaciones por capítulo.',
'texto', false),

(manual_id, cap1_id, 6,
'Al llegar al final de este capítulo y continuar, el Cuaderno se abrirá automáticamente. Explóralo: tiene tres secciones — Predicciones, Anotaciones y Subrayados — y pestañas para cada capítulo que hayas trabajado.',
'texto', false)

ON CONFLICT (capitulo_id, numero) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- PÁRRAFOS — Capítulo 2: Tu Kit de Explorador
-- ─────────────────────────────────────────────────────────────
INSERT INTO parrafos (libro_id, capitulo_id, numero, contenido, tipo, tiene_interactivo)
VALUES
(manual_id, cap2_id, 1,
'Cerraste el Cuaderno y llegaste hasta aquí. Eso es exactamente lo que hace un buen explorador. A partir de este punto, el camino se abre en varias direcciones.',
'texto', false),

(manual_id, cap2_id, 2,
'En la esquina inferior derecha verás el botón Explorar. Desde ahí accedes al Cuaderno en cualquier momento, a la Cartelera de Investigación donde el libro revela sus personajes, lugares y secretos a medida que avanzas, y al Foro donde puedes conectar con otros lectores del mismo libro.',
'texto', false),

(manual_id, cap2_id, 3,
'La Cartelera es especial: su contenido se desbloquea progresivamente. Cada capítulo que leas revelará nuevos elementos. No hay spoilers involuntarios — solo ves lo que ya leíste.',
'texto', false),

(manual_id, cap2_id, 4,
'Tu próxima parada es la Cartelera. Presiona Explorar, elige Investigación y descubre lo que este mundo tiene guardado para ti.',
'texto', false)

ON CONFLICT (capitulo_id, numero) DO NOTHING;

END $$;
