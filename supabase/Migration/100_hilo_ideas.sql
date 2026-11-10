-- =============================================================
-- INMERSIA — Migración 100
-- El hilo de ideas (el «método Anderson» de no ficción)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere de la 087 a la 099 (ovillos, juegos encendidos, vista del profe,
-- referencia de ovillos, mis_datos_juegos con el falsificador).
--
-- QUÉ HAY (decisiones de Juan, 10 nov 2026; reglas del contenido en
-- Documentation/colegios/hilo-prompt.md)
--   · Pistas: llegan solas al terminar cada capítulo, mezcladas. Entre ellas
--     hay señuelos (ciertos, pero no van en ninguna idea).
--   · Ideas: tarjetas tapadas en una pizarra, unidas por hilos. SIEMPRE 3
--     piezas y una sola combinación. Las piezas que son ideas anteriores
--     entran solas por el hilo; el lector solo pone pistas.
--   · Una idea se abre cuando ya llegaron todas sus pistas y se abrieron las
--     ideas de las que sale («abre», lo calcula cargar_hilo.py).
--   · «Jugar» cuesta 1 ovillo y se juega contra la idea elegida:
--       acierto     → la idea se destapa con su conclusión (+2; la
--                     conclusión del libro +5);
--       casi        → dos de las piezas van juntas (las ideas que llegan por
--                     el hilo cuentan): esas pistas quedan marcadas 🔗;
--       no_encajan  → nada.
--     Una idea con un solo hueco nunca da «casi».
--   · Al armar una idea, se arman solas las que solo esperaban ideas (la
--     conclusión final), cada una con su premio.
--   · Ayuda: 1 ovillo, una vez por idea, enseña la frase «falta».
--   · Con el libro terminado y sin ovillos se ven las ideas que faltaron
--     (como la 088 en Anderson).
--
--   · hilo_contenido: el juego de cada libro (lo sube cargar_hilo.py). Lleva
--     las respuestas: nadie lo lee directamente.
--   · hilo_jugadas: una fila por cada «Jugar» y por cada idea que se arma
--     sola. La partida se reconstruye de aquí.
--   · hilo_ayudas: qué ayudas pidió cada alumno.
--
-- QUIÉN LLAMA A QUÉ (el navegador)
--   Alumno: hilo_tablero, hilo_jugar, hilo_ayuda.
--   Profe:  hilo_aula.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═════════════════════════════════════════════════════════════

-- datos:
--   pistas: [{id, cap, parrafo, t, cita, senuelo}]
--           cap = el capítulo cuyo final la trae; parrafo = parrafos.numero.
--   ideas:  [{id, titulo, pregunta, piezas[3], conclusion, falta, final, abre}]
--           piezas = ids de pistas o de ideas anteriores; final = null |
--           'principal' | 'extra'; abre = capítulo en que se abre.
CREATE TABLE IF NOT EXISTS public.hilo_contenido (
  libro_id       uuid        PRIMARY KEY REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL DEFAULT 1 CHECK (version >= 1),
  datos          jsonb       NOT NULL,
  actualizado_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(datos->'pistas') = 'array' AND jsonb_array_length(datos->'pistas') BETWEEN 1 AND 80),
  CHECK (jsonb_typeof(datos->'ideas') = 'array' AND jsonb_array_length(datos->'ideas') BETWEEN 1 AND 30)
);
COMMENT ON TABLE public.hilo_contenido IS
  'Hilo de ideas de cada libro de no ficción (lo sube cargar_hilo.py). Lleva las respuestas: solo lo leen las funciones hilo_*. Los ids de pistas e ideas no se cambian una vez publicado. Ver migración 100.';
-- Sin políticas: solo lo leen las funciones SECURITY DEFINER.
ALTER TABLE public.hilo_contenido ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.hilo_jugadas (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id       uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL,
  idea           text        NOT NULL,
  pistas         text[]      NOT NULL CHECK (cardinality(pistas) BETWEEN 0 AND 3),
  -- sola = se armó sin jugar, porque ya tenía todas sus ideas.
  resultado      text        NOT NULL CHECK (resultado IN ('acierto', 'casi', 'no_encajan', 'sola')),
  pareja         jsonb,                      -- en «casi»: las pistas que sí van (🔗)
  senuelos       smallint    NOT NULL DEFAULT 0,   -- cuántos señuelos puso
  pistas_en_mesa int         NOT NULL,       -- pistas que tenía libres al jugar
  capitulo       int         NOT NULL,       -- capitulos_completados al jugar
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK ((resultado = 'sola') = (cardinality(pistas) = 0)),
  CHECK ((resultado = 'casi') = (pareja IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_hilo_jugadas_user_libro ON public.hilo_jugadas (user_id, libro_id);
-- Cada idea se arma una sola vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hilo_idea_armada
  ON public.hilo_jugadas (user_id, libro_id, idea) WHERE resultado IN ('acierto', 'sola');
COMMENT ON TABLE public.hilo_jugadas IS
  'Hilo de ideas: una fila por cada «Jugar» y por cada idea que se armó sola. Solo escribe hilo_jugar. Ver migración 100.';
ALTER TABLE public.hilo_jugadas ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.hilo_ayudas (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id   uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  idea       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, libro_id, idea)
);
COMMENT ON TABLE public.hilo_ayudas IS
  'Hilo de ideas: las ayudas que pidió cada alumno (una por idea, 1 ovillo). Solo escribe hilo_ayuda. Ver migración 100.';
ALTER TABLE public.hilo_ayudas ENABLE ROW LEVEL SECURITY;


-- Los ovillos del hilo van al libro de cuentas común (087).
ALTER TABLE public.ovillos_movimientos DROP CONSTRAINT IF EXISTS ovillos_movimientos_motivo_check;
ALTER TABLE public.ovillos_movimientos ADD CONSTRAINT ovillos_movimientos_motivo_check CHECK (motivo IN (
  'mesa_jugar', 'mesa_premio', 'corazonada', 'concurso', 'tesoro',
  'comodin', 'pista_gato', 'expediente', 'recompensa', 'falsificador',
  'hilo_jugar', 'hilo_premio', 'hilo_ayuda'));


-- ═════════════════════════════════════════════════════════════
-- 2. Uso interno
-- ═════════════════════════════════════════════════════════════

-- Ideas ya armadas por el alumno.
CREATE OR REPLACE FUNCTION public._hilo_armadas(p_user uuid, p_libro uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce(array_agg(idea), '{}') FROM hilo_jugadas
  WHERE user_id = p_user AND libro_id = p_libro AND resultado IN ('acierto', 'sola');
$fn$;

-- Lo que paga armar una idea.
CREATE OR REPLACE FUNCTION public._hilo_premio(p_idea jsonb)
RETURNS int
LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE WHEN p_idea->>'final' = 'principal' THEN 5 ELSE 2 END;
$fn$;


-- El tablero del alumno. Devuelve solo lo que puede ver:
--   {version, capitulos_completados, total_capitulos, saldo,
--    pistas: [{id, cap, t, cita, usada_en?}]       las que ya llegaron, mezcladas
--    ideas:  [{id, final, previas[], huecos, abre, estado: cerrada|abierta|armada,
--              titulo?, pregunta?,                  (si no está cerrada)
--              conclusion?, piezas?,                (si está armada)
--              falta?,                              (si pidió la ayuda)
--              ultima?: {pistas, resultado}, pareja?}]   (la última jugada; sin armar)
--    faltaron: null | [{id, titulo, conclusion, piezas}]}
-- Nunca: qué pista es señuelo ni las piezas de una idea sin armar.
CREATE OR REPLACE FUNCTION public._hilo_estado(p_user uuid, p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d       jsonb;
  v_ver   int;
  v_cc    int;
  v_total int;
  v_saldo int;
  v_arm   text[];
  v_ayu   text[];
  v_ideas text[];
BEGIN
  SELECT datos, version INTO d, v_ver FROM hilo_contenido WHERE libro_id = p_libro;
  IF d IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(max(capitulos_completados), 0) INTO v_cc
  FROM progreso_lectura WHERE user_id = p_user AND libro_id = p_libro;
  SELECT count(*) INTO v_total FROM capitulos WHERE libro_id = p_libro;
  v_saldo := _ovillos_saldo(p_user, p_libro);
  v_arm   := _hilo_armadas(p_user, p_libro);
  SELECT coalesce(array_agg(idea), '{}') INTO v_ayu FROM hilo_ayudas WHERE user_id = p_user AND libro_id = p_libro;
  v_ideas := ARRAY(SELECT x->>'id' FROM jsonb_array_elements(d->'ideas') x);

  RETURN (
    WITH
    pi AS (
      SELECT x->>'id' AS id, (x->>'cap')::int AS cap, x->>'t' AS t, x->>'cita' AS cita
      FROM jsonb_array_elements(d->'pistas') x
    ),
    id_ AS (
      SELECT x->>'id' AS id, x, o, (x->>'abre')::int AS abre,
             ARRAY(SELECT jsonb_array_elements_text(x->'piezas')) AS piezas,
             (x->>'id') = ANY (v_arm) AS armada
      FROM jsonb_array_elements(d->'ideas') WITH ORDINALITY t(x, o)
    ),
    jug AS (
      SELECT * FROM hilo_jugadas WHERE user_id = p_user AND libro_id = p_libro
    )
    SELECT jsonb_build_object(
      'version', v_ver,
      'capitulos_completados', v_cc,
      'total_capitulos', v_total,
      'saldo', v_saldo,
      -- Mezcladas siempre igual para cada libro (no agrupadas por capítulo).
      'pistas', coalesce((
        SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'id', pi.id, 'cap', pi.cap, 't', pi.t, 'cita', pi.cita,
                 'usada_en', (SELECT i.id FROM id_ i WHERE i.armada AND pi.id = ANY (i.piezas) LIMIT 1)))
               ORDER BY md5(p_libro::text || pi.id))
        FROM pi WHERE pi.cap <= v_cc), '[]'::jsonb),
      'ideas', coalesce((
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', i.id,
                   'final', i.x->'final',
                   'previas', to_jsonb(ARRAY(SELECT p FROM unnest(i.piezas) p WHERE p = ANY (v_ideas))),
                   'huecos', (SELECT count(*) FROM unnest(i.piezas) p WHERE NOT (p = ANY (v_ideas))),
                   'abre', i.abre,
                   'estado', CASE WHEN i.armada THEN 'armada' WHEN i.abre <= v_cc THEN 'abierta' ELSE 'cerrada' END)
                 || CASE WHEN i.armada OR i.abre <= v_cc
                         THEN jsonb_build_object('titulo', i.x->>'titulo', 'pregunta', i.x->>'pregunta') ELSE '{}'::jsonb END
                 || CASE WHEN i.armada
                         THEN jsonb_build_object('conclusion', i.x->>'conclusion', 'piezas', to_jsonb(i.piezas)) ELSE '{}'::jsonb END
                 || CASE WHEN NOT i.armada AND i.id = ANY (v_ayu)
                         THEN jsonb_build_object('falta', i.x->>'falta') ELSE '{}'::jsonb END
                 || CASE WHEN NOT i.armada THEN jsonb_strip_nulls(jsonb_build_object(
                         'ultima', (SELECT jsonb_build_object('pistas', to_jsonb(j.pistas), 'resultado', j.resultado)
                                    FROM jug j WHERE j.idea = i.id ORDER BY j.created_at DESC LIMIT 1),
                         'pareja', (SELECT j.pareja FROM jug j WHERE j.idea = i.id AND j.resultado = 'casi'
                                    ORDER BY j.created_at DESC LIMIT 1))) ELSE '{}'::jsonb END
               ORDER BY i.o)
        FROM id_ i), '[]'::jsonb),
      -- Como la 088: solo con el libro terminado Y sin ovillos.
      'faltaron', CASE WHEN v_total > 0 AND v_cc >= v_total AND v_saldo < 1 THEN coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', i.id, 'titulo', i.x->>'titulo',
                                            'conclusion', i.x->>'conclusion', 'piezas', to_jsonb(i.piezas)) ORDER BY i.o)
        FROM id_ i WHERE NOT i.armada), '[]'::jsonb) END
    ));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Lo que llama el alumno
-- ═════════════════════════════════════════════════════════════

-- Abrir la pizarra. null si el libro no tiene hilo.
CREATE OR REPLACE FUNCTION public.hilo_tablero(p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _hilo_estado(auth.uid(), p_libro);
END;
$fn$;


-- «Jugar» una idea con las pistas que puso en sus huecos. Cuesta 1 ovillo.
--   {resultado: acierto|casi|no_encajan, pareja?, armadas: [ids], premio, estado}
--   armadas: la idea y las que se armaron solas detrás (en orden).
CREATE OR REPLACE FUNCTION public.hilo_jugar(p_libro uuid, p_idea text, p_pistas text[])
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user   uuid := auth.uid();
  d        jsonb;
  v_ver    int;
  v_cc     int;
  v_x      jsonb;
  v_y      jsonb;
  v_ideas  text[];
  v_arm    text[];
  v_piezas text[];
  v_prev   text[];
  v_mias   text[];
  v_disp   text[];
  v_buenas text[];
  v_sen    int;
  v_res    text;
  v_id     uuid;
  v_nuevas text[] := '{}';
  v_premio int := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  -- Una jugada a la vez por alumno y libro (dos pestañas no gastan dos veces el mismo ovillo).
  PERFORM pg_advisory_xact_lock(hashtext('hilo:' || v_user || ':' || p_libro));

  SELECT datos, version INTO d, v_ver FROM hilo_contenido WHERE libro_id = p_libro;
  IF d IS NULL THEN
    RAISE EXCEPTION 'Este libro no tiene hilo de ideas.';
  END IF;
  SELECT x INTO v_x FROM jsonb_array_elements(d->'ideas') x WHERE x->>'id' = p_idea;
  IF v_x IS NULL THEN
    RAISE EXCEPTION 'Esa idea no está en el juego.';
  END IF;

  SELECT coalesce(max(capitulos_completados), 0) INTO v_cc
  FROM progreso_lectura WHERE user_id = v_user AND libro_id = p_libro;
  v_ideas  := ARRAY(SELECT x->>'id' FROM jsonb_array_elements(d->'ideas') x);
  v_arm    := _hilo_armadas(v_user, p_libro);
  v_piezas := ARRAY(SELECT jsonb_array_elements_text(v_x->'piezas'));
  v_prev   := ARRAY(SELECT p FROM unnest(v_piezas) p WHERE p = ANY (v_ideas));
  v_mias   := ARRAY(SELECT p FROM unnest(v_piezas) p WHERE NOT (p = ANY (v_ideas)));
  p_pistas := coalesce(p_pistas, '{}');

  IF p_idea = ANY (v_arm) THEN
    RAISE EXCEPTION 'Esa idea ya está armada.';
  END IF;
  IF (v_x->>'abre')::int > v_cc THEN
    RAISE EXCEPTION 'Esa idea todavía no se abre: sigue leyendo.';
  END IF;
  IF cardinality(v_mias) = 0 THEN
    RAISE EXCEPTION 'Esta idea se arma sola.';
  END IF;
  IF NOT (v_prev <@ v_arm) THEN
    RAISE EXCEPTION 'Primero arma la idea que llega por el hilo.';
  END IF;
  IF cardinality(p_pistas) <> cardinality(v_mias)
     OR (SELECT count(DISTINCT x) FROM unnest(p_pistas) x) <> cardinality(v_mias) THEN
    RAISE EXCEPTION 'Hacen falta % pistas distintas.', cardinality(v_mias);
  END IF;

  -- Pistas libres: ya llegaron y no están en una idea armada.
  v_disp := ARRAY(
    SELECT q->>'id' FROM jsonb_array_elements(d->'pistas') q
    WHERE (q->>'cap')::int <= v_cc
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d->'ideas') y
                      WHERE (y->>'id') = ANY (v_arm) AND y->'piezas' ? (q->>'id')));
  IF NOT (p_pistas <@ v_disp) THEN
    RAISE EXCEPTION 'Alguna de esas pistas no está en tu mesa.';
  END IF;
  IF _ovillos_saldo(v_user, p_libro) < 1 THEN
    RAISE EXCEPTION 'Te quedaste sin ovillos.';
  END IF;

  v_buenas := ARRAY(SELECT p FROM unnest(p_pistas) p WHERE p = ANY (v_mias));
  SELECT count(*) INTO v_sen FROM jsonb_array_elements(d->'pistas') q
  WHERE (q->>'id') = ANY (p_pistas) AND coalesce((q->>'senuelo')::boolean, false);

  v_res := CASE
    WHEN cardinality(v_buenas) = cardinality(v_mias) THEN 'acierto'
    -- Dos piezas van juntas (una idea que llega por el hilo cuenta). Con un solo hueco no hay «casi».
    WHEN cardinality(v_mias) >= 2 AND cardinality(v_buenas) + cardinality(v_prev) = 2 THEN 'casi'
    ELSE 'no_encajan' END;

  INSERT INTO hilo_jugadas (user_id, libro_id, version, idea, pistas, resultado, pareja, senuelos, pistas_en_mesa, capitulo)
  VALUES (v_user, p_libro, v_ver, p_idea, p_pistas, v_res,
          CASE WHEN v_res = 'casi' THEN to_jsonb(v_buenas) END,
          v_sen, cardinality(v_disp), v_cc)
  RETURNING id INTO v_id;

  INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
  VALUES (v_user, p_libro, -1, 'hilo_jugar', v_id, jsonb_build_object('idea', p_idea));

  IF v_res = 'acierto' THEN
    v_premio := _hilo_premio(v_x);
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
    VALUES (v_user, p_libro, v_premio, 'hilo_premio', v_id, jsonb_build_object('idea', p_idea));
    v_nuevas := ARRAY[p_idea];
    v_arm := v_arm || p_idea;

    -- Las que solo esperaban ideas (la conclusión final) se arman solas, en cadena.
    LOOP
      SELECT y INTO v_y
      FROM jsonb_array_elements(d->'ideas') WITH ORDINALITY t(y, o)
      WHERE NOT ((y->>'id') = ANY (v_arm))
        AND (y->>'abre')::int <= v_cc
        AND ARRAY(SELECT jsonb_array_elements_text(y->'piezas')) <@ v_arm
      ORDER BY o LIMIT 1;
      EXIT WHEN v_y IS NULL;
      INSERT INTO hilo_jugadas (user_id, libro_id, version, idea, pistas, resultado, pistas_en_mesa, capitulo)
      VALUES (v_user, p_libro, v_ver, v_y->>'id', '{}', 'sola', 0, v_cc)
      RETURNING id INTO v_id;
      INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
      VALUES (v_user, p_libro, _hilo_premio(v_y), 'hilo_premio', v_id, jsonb_build_object('idea', v_y->>'id'));
      v_premio := v_premio + _hilo_premio(v_y);
      v_nuevas := v_nuevas || (v_y->>'id');
      v_arm := v_arm || (v_y->>'id');
    END LOOP;
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'resultado', v_res,
    'pareja', CASE WHEN v_res = 'casi' THEN to_jsonb(v_buenas) END,
    'armadas', to_jsonb(v_nuevas),
    'premio', v_premio))
    || jsonb_build_object('estado', _hilo_estado(v_user, p_libro));
END;
$fn$;


-- Ayuda de una idea: 1 ovillo, una vez. Enseña la frase «falta».
CREATE OR REPLACE FUNCTION public.hilo_ayuda(p_libro uuid, p_idea text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  d      jsonb;
  v_x    jsonb;
  v_cc   int;
  v_id   uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('hilo:' || v_user || ':' || p_libro));

  SELECT datos INTO d FROM hilo_contenido WHERE libro_id = p_libro;
  SELECT x INTO v_x FROM jsonb_array_elements(d->'ideas') x WHERE x->>'id' = p_idea;
  IF v_x IS NULL THEN
    RAISE EXCEPTION 'Esa idea no está en el juego.';
  END IF;
  SELECT coalesce(max(capitulos_completados), 0) INTO v_cc
  FROM progreso_lectura WHERE user_id = v_user AND libro_id = p_libro;
  IF (v_x->>'abre')::int > v_cc THEN
    RAISE EXCEPTION 'Esa idea todavía no se abre: sigue leyendo.';
  END IF;
  IF p_idea = ANY (_hilo_armadas(v_user, p_libro)) THEN
    RAISE EXCEPTION 'Esa idea ya está armada.';
  END IF;
  IF EXISTS (SELECT 1 FROM hilo_ayudas WHERE user_id = v_user AND libro_id = p_libro AND idea = p_idea) THEN
    RAISE EXCEPTION 'ya_pedida';
  END IF;
  IF _ovillos_saldo(v_user, p_libro) < 1 THEN
    RAISE EXCEPTION 'Te quedaste sin ovillos.';
  END IF;

  INSERT INTO hilo_ayudas (user_id, libro_id, idea) VALUES (v_user, p_libro, p_idea) RETURNING id INTO v_id;
  INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
  VALUES (v_user, p_libro, -1, 'hilo_ayuda', v_id, jsonb_build_object('idea', p_idea));

  RETURN jsonb_build_object('estado', _hilo_estado(v_user, p_libro));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. Lo que ve el profe
-- ═════════════════════════════════════════════════════════════
--   {libro_id, encendido, ideas: [{id, titulo, final, huecos}] | null,
--    alumnos: {user_id: {armadas: [idea], fallos: {idea: n}, ayudas: [idea],
--                        senuelos: n (jugadas en las que puso algún señuelo)}}}
CREATE OR REPLACE FUNCTION public.hilo_aula(p_aula uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_libro uuid;
  d       jsonb;
  v_ideas text[];
BEGIN
  PERFORM _profe_de_aula(p_aula);
  SELECT libro_id INTO v_libro FROM _meta_aula(p_aula, 'UTC');
  IF v_libro IS NULL THEN
    RETURN jsonb_build_object('libro_id', NULL);
  END IF;
  SELECT datos INTO d FROM hilo_contenido WHERE libro_id = v_libro;
  v_ideas := ARRAY(SELECT x->>'id' FROM jsonb_array_elements(d->'ideas') x);

  RETURN jsonb_build_object(
    'libro_id', v_libro,
    'encendido', (_juegos_mezclar(_juegos_aula_por_defecto(),
                                  (SELECT juegos FROM comunidades WHERE id = p_aula))->>'hilo')::boolean,
    'ideas', (SELECT jsonb_agg(jsonb_build_object(
                       'id', x->>'id', 'titulo', x->>'titulo', 'final', x->'final',
                       'huecos', (SELECT count(*) FROM jsonb_array_elements_text(x->'piezas') p WHERE NOT (p = ANY (v_ideas))))
                     ORDER BY o)
              FROM jsonb_array_elements(d->'ideas') WITH ORDINALITY AS t(x, o)),
    'alumnos', coalesce((
      SELECT jsonb_object_agg(cm.user_id, jsonb_build_object(
        'armadas', coalesce((SELECT jsonb_agg(j.idea ORDER BY j.created_at) FROM hilo_jugadas j
                             WHERE j.user_id = cm.user_id AND j.libro_id = v_libro AND j.resultado IN ('acierto', 'sola')), '[]'::jsonb),
        'fallos', coalesce((SELECT jsonb_object_agg(s.idea, s.n) FROM (
                              SELECT j.idea, count(*) AS n FROM hilo_jugadas j
                              WHERE j.user_id = cm.user_id AND j.libro_id = v_libro AND j.resultado IN ('casi', 'no_encajan')
                              GROUP BY j.idea) s), '{}'::jsonb),
        'ayudas', coalesce((SELECT jsonb_agg(a.idea ORDER BY a.created_at) FROM hilo_ayudas a
                            WHERE a.user_id = cm.user_id AND a.libro_id = v_libro), '[]'::jsonb),
        'senuelos', (SELECT count(*) FROM hilo_jugadas j
                     WHERE j.user_id = cm.user_id AND j.libro_id = v_libro AND j.senuelos > 0)))
      FROM comunidad_miembros cm
      WHERE cm.comunidad_id = p_aula AND cm.rol = 'miembro'
        AND EXISTS (SELECT 1 FROM hilo_jugadas j WHERE j.user_id = cm.user_id AND j.libro_id = v_libro)), '{}'::jsonb));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 5. La cuenta de ovillos del libro: la de la 099 con el hilo
-- ═════════════════════════════════════════════════════════════
-- Máximo del hilo sin equivocarse = por cada idea con huecos, premio − 1
-- (un Jugar); las que se arman solas, el premio entero. Encendido por
-- defecto en las aulas.
CREATE OR REPLACE FUNCTION public._referencia_ovillos(p_libro uuid, p_juegos jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  -- En un aula, el juego que el profe no tocó va como en _juegos_aula_por_defecto (093/098).
  v_on    jsonb := _juegos_mezclar(_juegos_aula_por_defecto(), coalesce(p_juegos, '{}'::jsonb));
  v_leer  int;
  v_mesa  int;
  v_cz    int;
  v_mapa  int;
  v_fx    int;
  v_hilo  int;
  v_cc    int := 0;
  v_ccmin int := 0;
  v_ccmax int := 0;
  v_apag  text[] := '{}';
BEGIN
  v_leer := 10 + 2 * (SELECT count(*) FROM capitulos WHERE libro_id = p_libro)::int;

  v_mesa := coalesce((SELECT jsonb_array_length(datos->'rasgos') * 2 FROM anderson_contenido WHERE libro_id = p_libro), 0);
  v_cz   := coalesce((SELECT jsonb_array_length(datos->'corazonadas') * 3 FROM corazonadas_contenido WHERE libro_id = p_libro), 0);
  v_mapa := coalesce((SELECT jsonb_array_length(datos->'tesoros') FROM mapa_contenido WHERE libro_id = p_libro), 0);
  v_fx   := coalesce((SELECT jsonb_array_length(datos->'items') FROM falsificador_contenido WHERE libro_id = p_libro), 0);
  v_hilo := coalesce((
    SELECT sum(_hilo_premio(x)
               - CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements_text(x->'piezas') p
                                   WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.datos->'ideas') y WHERE y->>'id' = p))
                      THEN 1 ELSE 0 END)
    FROM hilo_contenido c, jsonb_array_elements(c.datos->'ideas') x
    WHERE c.libro_id = p_libro), 0)::int;
  SELECT coalesce(round(sum(CASE WHEN n >= 2 THEN 1.5 ELSE 1 END) * 3), 0)::int,
         coalesce(count(*) * 3, 0)::int,
         coalesce(sum(least(n, 2)) * 3, 0)::int
  INTO v_cc, v_ccmin, v_ccmax
  FROM (SELECT f->>'cap' AS cap, count(*) AS n
        FROM concurso_contenido c, jsonb_array_elements(c.datos->'frases') f
        WHERE c.libro_id = p_libro GROUP BY 1) s;

  IF NOT (v_on->>'mesa')::boolean         AND v_mesa > 0 THEN v_apag := v_apag || 'mesa'::text;         v_mesa := 0; END IF;
  IF NOT (v_on->>'corazonadas')::boolean  AND v_cz   > 0 THEN v_apag := v_apag || 'corazonadas'::text;  v_cz   := 0; END IF;
  IF NOT (v_on->>'mapa')::boolean         AND v_mapa > 0 THEN v_apag := v_apag || 'mapa'::text;         v_mapa := 0; END IF;
  IF NOT (v_on->>'falsificador')::boolean AND v_fx   > 0 THEN v_apag := v_apag || 'falsificador'::text; v_fx   := 0; END IF;
  IF NOT (v_on->>'hilo')::boolean         AND v_hilo > 0 THEN v_apag := v_apag || 'hilo'::text;         v_hilo := 0; END IF;
  IF NOT (v_on->>'concurso')::boolean     AND v_cc   > 0 THEN
    v_apag := v_apag || 'concurso'::text; v_cc := 0; v_ccmin := 0; v_ccmax := 0;
  END IF;

  RETURN jsonb_build_object(
    'solo_leyendo', v_leer,
    'maximo', v_leer + v_mesa + v_cz + v_mapa + v_cc + v_fx + v_hilo,
    'desglose', jsonb_build_object('lectura', v_leer, 'mesa', v_mesa, 'corazonadas', v_cz,
                                   'mapa', v_mapa, 'concurso', v_cc, 'falsificador', v_fx, 'hilo', v_hilo),
    'concurso_rango', jsonb_build_array(v_ccmin, v_ccmax),
    'apagados', to_jsonb(v_apag));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 6. «Descargar mis datos»: la de la 099 con el hilo
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mis_datos_juegos()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'ovillos',              (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM ovillos_movimientos t WHERE t.user_id = v_user),
    'mesa_investigacion',   (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM anderson_jugadas t WHERE t.user_id = v_user),
    'corazonadas',          (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM corazonadas_jugadas t WHERE t.user_id = v_user),
    'concurso',             (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM concurso_jugadas t WHERE t.user_id = v_user),
    'mapa_del_tesoro',      (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM mapa_jugadas t WHERE t.user_id = v_user),
    -- La charla entera, con la nota, el comentario y el resumen; sin quién la calificó.
    'desafio',              (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - 'nota_por' ORDER BY t.created_at), '[]'::jsonb)
                             FROM desafio_charlas t WHERE t.user_id = v_user),
    -- 098: las preguntas y lo que respondió al empezar y al terminar.
    'capsula_del_tiempo',   (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.sellada_at), '[]'::jsonb)
                             FROM capsula_respuestas t WHERE t.user_id = v_user),
    -- 099: qué dijo en cada párrafo sospechoso y si acertó.
    'falsificador',         (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM falsificador_jugadas t WHERE t.user_id = v_user),
    -- 100: cada «Jugar» del hilo de ideas y las ayudas que pidió.
    'hilo_de_ideas',        (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM hilo_jugadas t WHERE t.user_id = v_user),
    'hilo_de_ideas_ayudas', (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM hilo_ayudas t WHERE t.user_id = v_user),
    'expedientes_comprados', (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM expedientes_compras t WHERE t.user_id = v_user),
    -- Sin quién del colegio lo entregó.
    'vales_canjeados',      (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - 'resuelto_por' ORDER BY t.created_at), '[]'::jsonb)
                             FROM recompensas_canjes t WHERE t.user_id = v_user),
    -- 097: lo que puso en botes de la clase, con el nombre del bote.
    'aportes_a_botes',      (SELECT coalesce(jsonb_agg(jsonb_build_object('bote', r.titulo, 'cantidad', t.cantidad,
                                                                          'libro_id', t.libro_id, 'fecha', t.created_at)
                                                       ORDER BY t.created_at), '[]'::jsonb)
                             FROM recompensas_aportes t JOIN recompensas r ON r.id = t.recompensa_id
                             WHERE t.user_id = v_user),
    -- Solo la hora: cuántas veces se le pidió a la IA (para los topes diarios).
    'llamadas_ia_concurso', (SELECT coalesce(jsonb_agg(t.created_at ORDER BY t.created_at), '[]'::jsonb)
                             FROM concurso_llamadas t WHERE t.user_id = v_user),
    'llamadas_ia_desafio',  (SELECT coalesce(jsonb_agg(t.created_at ORDER BY t.created_at), '[]'::jsonb)
                             FROM desafio_llamadas t WHERE t.user_id = v_user)
  );
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 7. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._hilo_armadas(uuid, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._hilo_premio(jsonb)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._hilo_estado(uuid, uuid)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._referencia_ovillos(uuid, jsonb)       FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.hilo_tablero(uuid)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hilo_jugar(uuid, text, text[])         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hilo_ayuda(uuid, text)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hilo_aula(uuid)                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mis_datos_juegos()                     FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.hilo_tablero(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.hilo_jugar(uuid, text, text[])      TO authenticated;
GRANT EXECUTE ON FUNCTION public.hilo_ayuda(uuid, text)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.hilo_aula(uuid)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_datos_juegos()                  TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- PRUEBAS (en el SQL Editor)
-- ═════════════════════════════════════════════════════════════
--   1. Con un libro cargado (cargar_hilo.py):
--      SELECT jsonb_array_length(datos->'ideas') FROM hilo_contenido c JOIN libros l ON l.id = c.libro_id WHERE l.titulo ILIKE 'Del origen%';
--   2. Alumno: hilo_tablero(libro) → pistas sin «senuelo»; ideas sin armar sin piezas ni conclusión.
--      hilo_jugar(libro, 'Q', ARRAY['p00','p01','p02']) → acierto, premio 2, la idea trae su conclusión.
--   3. Profe: hilo_aula(aula) → armadas, fallos, ayudas y señuelos de cada alumno.
