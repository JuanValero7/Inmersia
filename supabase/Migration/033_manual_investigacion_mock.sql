-- =============================================================
-- INMERSIA — Mock de Investigación del Manual del Explorador
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Datos de la Cartelera para el libro Manual (tutorial). SOLO texto por ahora
-- (las imágenes se agregan después). El Lector revela la cartelera del Manual
-- sin depender del progreso (ver useCartelera.js: revelarTodo para el Manual).
--
-- Secciones sembradas:
--   · personajes → los 3 gatos de Inmersia
--   · lugares    → Internet
--   · hechos     → 1 entrada que manda al Foro
--   · datos / notas → en blanco (no se siembra nada)
--
-- Idempotente: borra e inserta el mock del Manual en cada corrida.
-- =============================================================

DO $$
DECLARE
  manual_id UUID := '00000000-0000-4000-8000-000000000001';
BEGIN

DELETE FROM cartelera_items WHERE libro_id = manual_id;

INSERT INTO cartelera_items (libro_id, capitulo_numero, seccion, nombre, descripcion) VALUES
  -- Personajes: los gatos de Inmersia
  (manual_id, 1, 'personajes', 'Yuri',
   'El gato naranja de Inmersia: curioso e inquieto, es el primero en asomarse cuando abres un libro nuevo.'),
  (manual_id, 1, 'personajes', 'Mancha',
   'El gato blanco: tranquilo y observador, vigila en silencio cada rincón de la colección.'),
  (manual_id, 1, 'personajes', 'Katana',
   'El gato negro: elegante y misterioso, aparece cuando menos lo esperás para acompañarte en la lectura.'),

  -- Lugares
  (manual_id, 1, 'lugares', 'Internet',
   'El vasto mundo del que vienes. Inmersia es la ventana que lo conecta con el universo de los libros.'),

  -- Hechos: la pista que lleva al Foro
  (manual_id, 1, 'hechos', 'Tu próxima parada: el Foro',
   'Cada libro tiene un Foro donde los lectores conversan sobre la historia. Abre Explorar → Foro para visitar el del Manual del Explorador.');

END $$;
