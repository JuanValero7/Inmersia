-- =============================================================
-- INMERSIA — Migración 088
-- Mesa de investigación: las respuestas que faltaron solo al final
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 087.
--
-- PROBLEMA
--   La 087 devolvía «lo que te faltó» (las deducciones sin armar, con sus
--   pistas) en cuanto el alumno terminaba el libro, aunque le quedaran
--   ovillos para seguir jugando.
--
-- SOLUCIÓN (decisión de Juan, 6 nov 2026)
--   Se muestran solo si terminó el libro Y se quedó sin ovillos. Mientras le
--   queden ovillos, sigue jugando. Lo decide la base de datos y no la página:
--   si las respuestas llegaran al navegador, se podrían leer aunque no se
--   pintaran.
--
-- QUÉ NO CAMBIA
--   Solo _anderson_estado (misma firma, mismos permisos de la 087). Las
--   tablas, las jugadas y los ovillos quedan igual.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================

CREATE OR REPLACE FUNCTION public._anderson_estado(p_user uuid, p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d        jsonb;
  v_ver    int;
  v_cc     int;
  v_total  int;
  v_hechas text[];
  v_res    jsonb;
BEGIN
  SELECT datos, version INTO d, v_ver FROM anderson_contenido WHERE libro_id = p_libro;
  IF d IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(max(capitulos_completados), 0) INTO v_cc
  FROM progreso_lectura WHERE user_id = p_user AND libro_id = p_libro;
  SELECT count(*) INTO v_total FROM capitulos WHERE libro_id = p_libro;
  SELECT coalesce(array_agg(DISTINCT rasgo), '{}') INTO v_hechas
  FROM anderson_jugadas WHERE user_id = p_user AND libro_id = p_libro AND resultado = 'acierto';

  WITH
  pj AS (
    SELECT x->>'id' AS id, x->>'nombre' AS nombre, x->>'corto' AS corto, (x->>'aparece')::int AS aparece, o
    FROM jsonb_array_elements(d->'personajes') WITH ORDINALITY t(x, o)
  ),
  pi AS (
    SELECT x->>'id' AS id, x->>'pj' AS pj, (x->>'cap')::int AS cap, (x->>'parrafo')::int AS parrafo,
           x->>'resumen' AS resumen, x->>'cita' AS cita, o
    FROM jsonb_array_elements(d->'pistas') WITH ORDINALITY t(x, o)
  ),
  ra AS (
    SELECT x->>'id' AS id, x->>'pj' AS pj,
           x->'opciones'->>((x->>'correcta')::int) AS texto,
           ARRAY(SELECT jsonb_array_elements_text(x->'pool')) AS pool,
           NOT ((x->>'id') = ANY (v_hechas)) AS pendiente, o
    FROM jsonb_array_elements(d->'rasgos') WITH ORDINALITY t(x, o)
  ),
  -- Piezas que el alumno ya tiene de cada deducción (pistas leídas o deducciones armadas).
  ra2 AS (
    SELECT ra.*,
           (SELECT count(*) FROM unnest(ra.pool) p
            WHERE p = ANY (v_hechas) OR EXISTS (SELECT 1 FROM pi WHERE pi.id = p AND pi.cap <= v_cc)) AS disponibles
    FROM ra
  ),
  lista AS (
    SELECT pi.* FROM pi
    WHERE pi.cap <= v_cc
      AND (NOT EXISTS (SELECT 1 FROM ra WHERE pi.id = ANY (ra.pool))
           OR EXISTS (SELECT 1 FROM ra WHERE ra.pendiente AND pi.id = ANY (ra.pool)))
  ),
  cartas AS (
    SELECT ra.* FROM ra
    WHERE NOT ra.pendiente
      AND EXISTS (SELECT 1 FROM ra otro WHERE otro.pendiente AND ra.id = ANY (otro.pool))
  ),
  jug AS (
    SELECT * FROM anderson_jugadas WHERE user_id = p_user AND libro_id = p_libro
  )
  SELECT jsonb_build_object(
    'version', v_ver,
    'capitulos_completados', v_cc,
    'total_capitulos', v_total,
    'saldo', _ovillos_saldo(p_user, p_libro),
    'personajes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pj.id, 'nombre', pj.nombre, 'corto', pj.corto,
        'total',         (SELECT count(*) FROM ra WHERE ra.pj = pj.id),
        'hechas',        (SELECT count(*) FROM ra WHERE ra.pj = pj.id AND NOT ra.pendiente),
        'por_descubrir', (SELECT count(*) FROM ra2 WHERE ra2.pj = pj.id AND ra2.pendiente AND ra2.disponibles >= 3),
        'mas_adelante',  (SELECT count(*) FROM ra2 WHERE ra2.pj = pj.id AND ra2.pendiente AND ra2.disponibles < 3),
        'nuevas',        (SELECT count(*) FROM lista WHERE lista.pj = pj.id AND lista.cap = v_cc),
        'deducciones', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ra.id, 'texto', ra.texto,
            -- Pistas que también la probaban, no entraron en el trío y ya salieron de la mesa.
            'confirman', (SELECT count(*) FROM pi
                          WHERE pi.id = ANY (ra.pool) AND pi.cap <= v_cc
                            AND NOT EXISTS (SELECT 1 FROM jug j WHERE j.resultado = 'acierto' AND j.rasgo = ra.id AND pi.id = ANY (j.pistas))
                            AND NOT EXISTS (SELECT 1 FROM lista l WHERE l.id = pi.id))
          ) ORDER BY ra.o)
          FROM ra WHERE ra.pj = pj.id AND NOT ra.pendiente), '[]'::jsonb)
      ) ORDER BY pj.o)
      FROM pj WHERE pj.aparece <= v_cc), '[]'::jsonb),
    'pistas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', l.id, 'pj', l.pj, 'cap', l.cap, 'parrafo', l.parrafo,
                                          'resumen', l.resumen, 'cita', l.cita) ORDER BY l.o)
      FROM lista l), '[]'::jsonb),
    'cartas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'pj', c.pj, 'texto', c.texto) ORDER BY c.o)
      FROM cartas c), '[]'::jsonb),
    'parejas', coalesce((
      SELECT jsonb_agg(DISTINCT par)
      FROM jug j, jsonb_array_elements(j.pareja) par
      WHERE j.resultado = 'casi'
        AND EXISTS (SELECT 1 FROM ra WHERE ra.pendiente AND (par->>0) = ANY (ra.pool) AND (par->>1) = ANY (ra.pool))), '[]'::jsonb),
    'abierta', (
      SELECT jsonb_build_object(
        'jugada', j.id, 'personaje', j.personaje, 'pistas', to_jsonb(j.pistas),
        'opciones', (SELECT x->'opciones' FROM jsonb_array_elements(d->'rasgos') x WHERE x->>'id' = j.rasgo),
        'tachadas', coalesce((SELECT jsonb_agg(f.opcion ORDER BY f.created_at) FROM jug f
                              WHERE f.resultado = 'fallo' AND f.rasgo = j.rasgo), '[]'::jsonb))
      FROM jug j WHERE j.resultado = 'abierta'
      ORDER BY j.created_at DESC LIMIT 1),
    'faltaron', CASE WHEN v_total > 0 AND v_cc >= v_total AND _ovillos_saldo(p_user, p_libro) < 1 THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'pj', ra.pj, 'texto', ra.texto,
        'pistas', (SELECT coalesce(jsonb_agg(pi.resumen ORDER BY pi.o), '[]'::jsonb) FROM pi WHERE pi.id = ANY (ra.pool))
      ) ORDER BY ra.o)
      FROM ra WHERE ra.pendiente), '[]'::jsonb) END
  ) INTO v_res;

  RETURN v_res;
END;
$fn$;
