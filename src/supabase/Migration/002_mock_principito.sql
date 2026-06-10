-- =============================================================
-- INMERSIA — Mock data: El Principito
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Ejecutar DESPUÉS de 001_schema_libros.sql
-- =============================================================
-- Este archivo crea:
--   • 1 libro (El Principito)
--   • 3 capítulos de ejemplo con párrafos placeholder
--   • Cartelera con ítems de todos los capítulos del libro
--     (personajes, lugares, hechos, datos) — listos para reemplazar
--     la descripción con el texto real cuando quieras
-- =============================================================

-- Usamos una variable para no repetir el ID del libro en cada INSERT.
-- Supabase SQL Editor soporta DO $$ ... $$ con bloques anónimos.

DO $$
DECLARE
  libro_id    UUID;
  cap1_id     UUID;
  cap2_id     UUID;
  cap3_id     UUID;
  p_id        UUID;
BEGIN

-- ─────────────────────────────────────────────────────────────
-- LIBRO
-- ─────────────────────────────────────────────────────────────
INSERT INTO libros (titulo, autor, descripcion, portada_url, metadata)
VALUES (
  'El Principito',
  'Antoine de Saint-Exupéry',
  'Un aviador que se queda varado en el desierto del Sahara conoce a un pequeño príncipe llegado de un asteroide lejano.',
  'https://placehold.co/300x450/8b4d2a/f5ede0?text=El+Principito',
  '{"idioma": "es", "anio_original": 1943, "genero": "Fábula/Literatura infantil", "capitulos_total": 27}'
)
RETURNING id INTO libro_id;

-- ─────────────────────────────────────────────────────────────
-- CAPÍTULOS (solo 3 de ejemplo — agregar el resto con el mismo
-- patrón: INSERT INTO capitulos (libro_id, numero, titulo) ...)
-- ─────────────────────────────────────────────────────────────
INSERT INTO capitulos (libro_id, numero, titulo)
VALUES (libro_id, 1, 'Capítulo I')
RETURNING id INTO cap1_id;

INSERT INTO capitulos (libro_id, numero, titulo)
VALUES (libro_id, 2, 'Capítulo II')
RETURNING id INTO cap2_id;

INSERT INTO capitulos (libro_id, numero, titulo)
VALUES (libro_id, 3, 'Capítulo III')
RETURNING id INTO cap3_id;

-- ─────────────────────────────────────────────────────────────
-- PÁRRAFOS — Capítulo I (placeholder)
-- Reemplazar el contenido con el texto real del libro.
-- tipo: texto | dialogo | nota_marginal | separador
-- libro_id se repite en cada fila para satisfacer el FK compuesto.
-- ─────────────────────────────────────────────────────────────
INSERT INTO parrafos (libro_id, capitulo_id, numero, contenido, tipo) VALUES
  (libro_id, cap1_id, 1, '[PÁRRAFO 1 — Capítulo I]', 'texto'),
  (libro_id, cap1_id, 2, '[PÁRRAFO 2 — Capítulo I]', 'texto'),
  (libro_id, cap1_id, 3, '[PÁRRAFO 3 — Capítulo I]', 'texto'),
  (libro_id, cap1_id, 4, '[PÁRRAFO 4 — Capítulo I]', 'texto'),
  (libro_id, cap1_id, 5, '[PÁRRAFO 5 — Capítulo I]', 'texto');

-- PÁRRAFOS — Capítulo II (placeholder)
INSERT INTO parrafos (libro_id, capitulo_id, numero, contenido, tipo) VALUES
  (libro_id, cap2_id, 1, '[PÁRRAFO 1 — Capítulo II]', 'texto'),
  (libro_id, cap2_id, 2, '[PÁRRAFO 2 — Capítulo II]', 'dialogo'),
  (libro_id, cap2_id, 3, '[PÁRRAFO 3 — Capítulo II]', 'texto'),
  (libro_id, cap2_id, 4, '[PÁRRAFO 4 — Capítulo II]', 'texto');

-- PÁRRAFOS — Capítulo III (placeholder)
INSERT INTO parrafos (libro_id, capitulo_id, numero, contenido, tipo) VALUES
  (libro_id, cap3_id, 1, '[PÁRRAFO 1 — Capítulo III]', 'texto'),
  (libro_id, cap3_id, 2, '[PÁRRAFO 2 — Capítulo III]', 'texto'),
  (libro_id, cap3_id, 3, '[PÁRRAFO 3 — Capítulo III]', 'dialogo'),
  (libro_id, cap3_id, 4, '[PÁRRAFO 4 — Capítulo III]', 'texto');

-- ─────────────────────────────────────────────────────────────
-- CARTELERA — todos los capítulos del libro
-- capitulo_numero indica DESDE qué capítulo es visible el ítem.
-- La app filtra: WHERE libro_id = X AND capitulo_numero <= actual
-- ─────────────────────────────────────────────────────────────

-- ── PERSONAJES ──────────────────────────────────────────────
INSERT INTO cartelera_items (libro_id, capitulo_numero, seccion, nombre, descripcion, metadata) VALUES

  (libro_id, 1, 'personajes', 'El Aviador',
   'El narrador de la historia. Piloto forzado a aterrizar en el desierto del Sahara tras una avería en su motor.',
   '{"tags": ["narrador", "adulto", "piloto"], "color": "#2c3e50"}'),

  (libro_id, 2, 'personajes', 'El Principito',
   'Un niño misterioso llegado de un asteroide muy pequeño. Hace preguntas directas que desconciertan a los adultos.',
   '{"tags": ["protagonista", "niño", "asteroide B-612"], "color": "#f1c40f"}'),

  (libro_id, 4, 'personajes', 'La Rosa',
   'La flor orgullosa y única que vive en el planeta del Principito. Su relación es complicada pero profunda.',
   '{"tags": ["amor", "vanidad", "rosa"], "color": "#e74c3c"}'),

  (libro_id, 10, 'personajes', 'El Rey',
   'Habita un planeta él solo y cree gobernar a todos, incluso a las estrellas. Solo da órdenes razonables.',
   '{"tags": ["poder", "autoridad", "planeta solo"], "color": "#8e44ad"}'),

  (libro_id, 11, 'personajes', 'El Vanidoso',
   'Quiere ser admirado por todos. Solo escucha elogios. Es el más raro de los adultos que visita el Principito.',
   '{"tags": ["vanidad", "adulto", "planeta solo"], "color": "#d35400"}'),

  (libro_id, 12, 'personajes', 'El Bebedor',
   'Bebe para olvidar la vergüenza de beber. Su historia entristece profundamente al Principito.',
   '{"tags": ["tristeza", "contradicción", "planeta solo"], "color": "#7f8c8d"}'),

  (libro_id, 13, 'personajes', 'El Hombre de Negocios',
   'Cuenta estrellas sin parar creyendo que son suyas. No entiende para qué sirven de verdad.',
   '{"tags": ["codicia", "adulto", "planeta solo"], "color": "#27ae60"}'),

  (libro_id, 14, 'personajes', 'El Farolero',
   'El único adulto que el Principito considera que no es completamente absurdo: al menos hace algo útil.',
   '{"tags": ["trabajo", "fidelidad", "planeta solo"], "color": "#16a085"}'),

  (libro_id, 15, 'personajes', 'El Geógrafo',
   'Sabe dónde están todos los mares y montañas, pero nunca los ha visitado. Le recomienda al Principito ir a la Tierra.',
   '{"tags": ["conocimiento", "libros", "planeta solo"], "color": "#2980b9"}'),

  (libro_id, 17, 'personajes', 'La Serpiente',
   'El primer ser que encuentra el Principito en la Tierra. Habla en acertijos y ofrece llevar al Principito a casa.',
   '{"tags": ["muerte", "misterio", "tierra"], "color": "#1a1a1a"}'),

  (libro_id, 21, 'personajes', 'El Zorro',
   'Le enseña al Principito el significado de domesticar: crear lazos hace que algo sea único en el mundo.',
   '{"tags": ["amistad", "amor", "domesticar"], "color": "#e67e22"}');

-- ── LUGARES ─────────────────────────────────────────────────
INSERT INTO cartelera_items (libro_id, capitulo_numero, seccion, nombre, descripcion, metadata) VALUES

  (libro_id, 1, 'lugares', 'El Desierto del Sahara',
   'Donde el aviador aterriza tras la avería. A mil millas de cualquier lugar habitado. Aquí comienza todo.',
   '{"tags": ["desierto", "africa", "aislamiento"], "color": "#f39c12"}'),

  (libro_id, 4, 'lugares', 'Asteroide B-612',
   'El planeta del Principito. Tan pequeño que cabe una silla y hay que limpiar tres volcanes cada mañana.',
   '{"tags": ["asteroide", "planeta", "hogar"], "color": "#3498db"}'),

  (libro_id, 10, 'lugares', 'Planeta del Rey',
   'El primer planeta que visita el Principito en su viaje. Solo lo habita el Rey.',
   '{"tags": ["visita", "planeta", "viaje"], "color": "#9b59b6"}'),

  (libro_id, 16, 'lugares', 'La Tierra',
   'El sexto planeta que visita el Principito. Mucho más grande que los anteriores, con 111 reyes, geógrafos, y millones de rosas.',
   '{"tags": ["tierra", "humanidad", "desierto"], "color": "#2ecc71"}'),

  (libro_id, 22, 'lugares', 'El Jardín de las Rosas',
   'Un jardín con cinco mil rosas iguales a la del Principito. Lo entristece profundamente al ver que su rosa no era única.',
   '{"tags": ["rosas", "tristeza", "unicidad"], "color": "#e74c3c"}');

-- ── HECHOS ──────────────────────────────────────────────────
INSERT INTO cartelera_items (libro_id, capitulo_numero, seccion, nombre, descripcion, metadata) VALUES

  (libro_id, 1, 'hechos', 'El aviador se queda varado',
   'Una avería en el motor obliga al aviador a aterrizar en el Sahara, a mil millas de cualquier lugar habitado.',
   '{"tags": ["inicio", "accidente", "desierto"], "color": "#e74c3c"}'),

  (libro_id, 3, 'hechos', 'El Principito deja su planeta',
   'Motivado por un desacuerdo con la Rosa, el Principito emprende un viaje de exploración por los asteroides cercanos.',
   '{"tags": ["partida", "viaje", "rosa"], "color": "#f1c40f"}'),

  (libro_id, 8, 'hechos', 'La Rosa y sus espinas',
   'La Rosa tiene espinas pero dice que no las necesita para protegerse. Su fragilidad y orgullo confunden al Principito.',
   '{"tags": ["rosa", "fragilidad", "orgullo"], "color": "#e74c3c"}'),

  (libro_id, 21, 'hechos', 'El Zorro domestica al Principito',
   'El zorro explica que domesticar significa crear lazos. Pide al Principito que lo domestique para que sea único para él.',
   '{"tags": ["amistad", "domesticar", "lazos"], "color": "#e67e22"}'),

  (libro_id, 24, 'hechos', 'El pozo en el desierto',
   'El aviador y el Principito encuentran un pozo en el desierto. El Principito dice que lo que embellece al desierto es que esconde un pozo.',
   '{"tags": ["agua", "belleza", "desierto"], "color": "#3498db"}');

-- ── DATOS ───────────────────────────────────────────────────
INSERT INTO cartelera_items (libro_id, capitulo_numero, seccion, nombre, descripcion, metadata) VALUES

  (libro_id, 4, 'datos', 'El asteroide B-612',
   'Fue visto con telescopio por primera vez en 1909 por un astrónomo turco. Solo fue tomado en serio cuando presentó su descubrimiento con traje europeo.',
   '{"tags": ["ciencia", "astronomía", "prejuicio"], "color": "#8e44ad"}'),

  (libro_id, 14, 'datos', 'El planeta del Farolero',
   'Es el planeta más pequeño de todos. Da una vuelta completa en un minuto, por lo que el Farolero enciende y apaga el farol 1440 veces al día.',
   '{"tags": ["tiempo", "planeta", "trabajo"], "color": "#16a085"}'),

  (libro_id, 17, 'datos', 'El veneno de la serpiente',
   'La serpiente afirma que su veneno es tan poderoso que puede devolver a alguien a la tierra de la que vino.',
   '{"tags": ["muerte", "regreso", "serpiente"], "color": "#1a1a1a"}'),

  (libro_id, 21, 'datos', 'Lo esencial es invisible',
   '"Lo esencial es invisible para los ojos." — El Zorro. Solo se ve bien con el corazón.',
   '{"tags": ["filosofía", "amor", "cita"], "color": "#f39c12"}'),

  (libro_id, 26, 'datos', 'Las estrellas y la risa',
   'El Principito promete al aviador que cuando mire las estrellas, en una de ellas él estará riendo. Las estrellas reemplazarán su risa.',
   '{"tags": ["despedida", "estrellas", "risa"], "color": "#f1c40f"}');

-- Fin del bloque anónimo
END $$;
