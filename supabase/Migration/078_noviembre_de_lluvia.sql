-- =============================================================
-- INMERSIA — Migración 078
-- Temporada «Noviembre de lluvia» y El rojo emblema fuera del salón
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- «Octubre de miedo» (066) deja de verse el 31 de octubre. Noviembre cambia
-- de registro: después de un mes de terror, lecturas tranquilas para una
-- tarde de lluvia y té. Ocho libros elegidos por Juan el 31 oct 2026, varios
-- de ellos sin sala fija hasta hoy (Persuasión, Ethan Frome, Tres cuentos,
-- Leyendas).
--
-- El fondo de la portada es la primera escena del reel de Persuasión (la
-- chica junto a la ventana), igual que octubre usó la de Canterville.
--
-- Además, El rojo emblema del valor sale de El salón de los corazones: es
-- una novela de guerra y desentonaba entre los romances.
--
-- Ojo: el slug de Persuasión lleva tilde ('persuasión') y el de Ethan Frome
-- es 'frome'. Son los que hay hoy en `libros`; si se corrigen, cambiarlos aquí.
-- =============================================================

INSERT INTO salas (slug, nombre, linea, genero, color, tipo, orden, desde, hasta, imagen_url)
SELECT 'noviembre-de-lluvia', 'Noviembre de lluvia',
       'Ocho clásicos para una tarde de lluvia y té. Una carta que llega tarde, cuatro noches en San Petersburgo y un pueblo bajo la nieve.',
       'Temporada', '#6d9099', 'temporada', 0, DATE '2026-11-01', DATE '2026-11-30',
       (SELECT r.imagen_url FROM libro_reels r JOIN libros l ON l.id = r.libro_id
         WHERE l.slug = 'persuasión' AND r.orden = 1)
ON CONFLICT (slug) DO NOTHING;

-- Los 8 elegidos, en el orden de la lista.
INSERT INTO sala_libros (sala_id, libro_id, orden)
SELECT s.id, l.id, 10 * array_position(v.slugs, l.slug)
FROM salas s
CROSS JOIN (SELECT ARRAY[
  'persuasión',
  'frome',
  'noches-blancas',
  'primer-amor',
  'el-libro-del-te',
  'tres-cuentos',
  'leyendas',
  'novela-de-ajedrez'
] AS slugs) v
JOIN libros l ON l.slug = ANY (v.slugs)
WHERE s.slug = 'noviembre-de-lluvia'
ON CONFLICT (sala_id, libro_id) DO NOTHING;

-- El rojo emblema del valor fuera de El salón de los corazones.
DELETE FROM sala_libros sl
USING salas s, libros l
WHERE sl.sala_id = s.id AND sl.libro_id = l.id
  AND s.slug = 'el-salon-de-los-corazones'
  AND l.slug = 'el-rojo-emblema-del-valor';

-- ── Comprobación ───────────────────────────────────────────
-- Esperado: noviembre 8 libros y con imagen · corazones 9
SELECT s.slug, s.tipo, s.desde, s.hasta, s.imagen_url IS NOT NULL AS tiene_imagen, count(sl.libro_id) AS libros
FROM salas s LEFT JOIN sala_libros sl ON sl.sala_id = s.id
WHERE s.slug IN ('noviembre-de-lluvia', 'el-salon-de-los-corazones')
GROUP BY s.id ORDER BY s.orden;
