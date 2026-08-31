-- =============================================================
-- INMERSIA — Manual del Explorador: un dato para la sección Datos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- La sección "Datos" del Manual quedó vacía desde el mock inicial
-- (033_manual_investigacion_mock.sql sembró personajes, lugares y hechos, y dejó
-- datos/notas en blanco). En el tutorial eso significa que el usuario abre una
-- sección y se encuentra el "Sin datos disponibles todavía" — mala primera
-- impresión justo en la pantalla que le estamos enseñando.
--
-- El dato que la llena explica algo que hoy no se cuenta en ningún lado: que el
-- gato de compañía se elige en Perfil. Se sirven dos cosas de una.
--
-- capitulo_numero = 1, igual que el resto del mock: se revela al terminar el
-- capítulo 1, junto con los personajes y el hecho que manda al Foro.
--
-- Idempotente: se puede correr las veces que sea.
-- =============================================================

DO $$
DECLARE
  manual_id UUID := '00000000-0000-4000-8000-000000000001';
BEGIN

DELETE FROM cartelera_items
 WHERE libro_id = manual_id AND seccion = 'datos' AND nombre = 'Tu gato de compañía';

INSERT INTO cartelera_items (libro_id, capitulo_numero, seccion, nombre, descripcion) VALUES
  (manual_id, 1, 'datos', 'Tu gato de compañía',
   'Yuri, Mancha y Katana te acompañan por toda la casa: la biblioteca, la tienda, el lector y esta misma cartelera. Puedes elegir cuál quieres en tu Perfil, en la sección Datos, y cambiarlo cuando quieras.');

END $$;

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN — la sección Datos del Manual ya no está vacía
-- ─────────────────────────────────────────────────────────────
SELECT seccion, nombre, capitulo_numero
FROM cartelera_items
WHERE libro_id = '00000000-0000-4000-8000-000000000001'
ORDER BY seccion, nombre;
