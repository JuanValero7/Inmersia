-- =============================================================
-- INMERSIA — Migración 087
-- Mesa de investigación (método Anderson) y libro de cuentas de ovillos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 081 (colegios) y la 075 (capitulos_completados).
--
-- QUÉ HAY (decisiones de Juan, 6 nov 2026; reglas en
-- Documentation/colegios/anderson-prompt.md)
--   · anderson_contenido: el juego de cada libro, una fila por libro con el
--     JSON ya validado (personajes, rasgos, pistas, señuelos). Lo sube
--     cargar_anderson.py. Nadie lo lee directamente: lleva las respuestas.
--   · anderson_jugadas: una fila por cada «Jugar». La partida no se guarda
--     aparte: se reconstruye de aquí (deducciones armadas, parejas 🔗,
--     opciones tachadas, jugada abierta).
--   · ovillos_movimientos: libro de cuentas común a todos los juegos. Los
--     10 de partida y los +2 por capítulo completado no se apuntan: se
--     calculan con capitulos_completados.
--
-- REGLAS DEL JUEGO QUE APLICA LA BASE DE DATOS
--   · Una pista entra en la mesa cuando su capítulo está completado, y su
--     personaje cuando el lector ya sabe quién es (aparece).
--   · Un trío vale si las tres piezas están en una misma deducción pendiente
--     del personaje. Una pista puede servir a varias deducciones.
--   · Una pista sale de la mesa cuando ya no le queda ninguna deducción
--     pendiente. Los señuelos no tienen ninguna y se quedan siempre.
--   · Una deducción armada vuelve a la mesa como carta si entra en otra
--     (el cambio de 2.º nivel).
--   · Cada «Jugar» cuesta 1 ovillo. Si dos de las tres van juntas, la jugada
--     es «casi» y guarda esa pareja, que queda marcada hasta que se arme su
--     deducción.
--   · Premio: 3 ovillos por rasgo armado desde el último cobro, cada vez que
--     el perfil del personaje queda al día con lo leído.
--   · Al terminar el libro se devuelven las deducciones que faltaron.
--
-- POR QUÉ TODO PASA POR FUNCIONES
--   Los ovillos se canjean por recompensas del profe: el cálculo no puede
--   estar en el navegador. Y el contenido lleva las respuestas (qué pistas
--   van juntas, cuál es la correcta): el navegador solo recibe lo que el
--   alumno ya puede ver.
--
-- QUÉ VE EL PROFE (anderson_aula)
--   Por alumno: intentos fallidos al juntar pistas, por personaje, con
--   cuántas pistas había en la mesa de media; por deducción, si la armó y
--   qué conclusiones falsas eligió y de qué tipo; qué señuelos usó. No hay
--   semáforo ni se mide cuándo la armó. En Anderson el alumno no escribe
--   nada, así que no hay nada privado que esconder.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.anderson_contenido (
  libro_id       uuid        PRIMARY KEY REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL DEFAULT 1 CHECK (version >= 1),
  datos          jsonb       NOT NULL,
  actualizado_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.anderson_contenido IS
  'Juego de la mesa de investigación de cada libro (JSON compilado por cargar_anderson.py). Lleva las respuestas: solo lo leen las funciones anderson_*. Las claves de pistas y rasgos no se cambian una vez publicado. Ver migración 087.';

-- Sin políticas: solo lo leen las funciones SECURITY DEFINER.
ALTER TABLE public.anderson_contenido ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.anderson_jugadas (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id       uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL,
  personaje      text        NOT NULL,
  pistas         text[]      NOT NULL CHECK (cardinality(pistas) = 3),
  resultado      text        NOT NULL CHECK (resultado IN ('no_encajan', 'casi', 'abierta', 'acierto', 'fallo')),
  rasgo          text,                       -- la deducción que abrió el trío (abierta, acierto, fallo)
  pareja         jsonb,                      -- en «casi»: [[pista, pista], …] que sí van juntas
  opcion         smallint,                   -- la que eligió (acierto, fallo)
  opcion_tipo    text        CHECK (opcion_tipo IN ('por_encima', 'otra')),
  pistas_en_mesa int         NOT NULL,       -- piezas que tenía ese personaje en la mesa al jugar
  capitulo       int         NOT NULL,       -- capitulos_completados al jugar
  created_at     timestamptz NOT NULL DEFAULT now(),
  resuelta_at    timestamptz,
  CHECK ((resultado IN ('abierta', 'acierto', 'fallo')) = (rasgo IS NOT NULL)),
  CHECK ((resultado IN ('acierto', 'fallo')) = (opcion IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_anderson_jugadas_user_libro ON public.anderson_jugadas (user_id, libro_id);
-- Como mucho una jugada abierta (esperando la conclusión) por alumno y libro.
CREATE UNIQUE INDEX IF NOT EXISTS uq_anderson_jugada_abierta
  ON public.anderson_jugadas (user_id, libro_id) WHERE resultado = 'abierta';

COMMENT ON TABLE public.anderson_jugadas IS
  'Una fila por cada «Jugar» de la mesa de investigación. La partida se reconstruye de aquí. Solo escriben anderson_jugar y anderson_elegir. Ver migración 087.';

ALTER TABLE public.anderson_jugadas ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.ovillos_movimientos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id    uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  cantidad    int         NOT NULL CHECK (cantidad <> 0),
  motivo      text        NOT NULL CHECK (motivo IN (
                'mesa_jugar', 'mesa_premio',            -- mesa de investigación
                'corazonada', 'concurso', 'tesoro',     -- los otros juegos (aún sin construir)
                'comodin', 'pista_gato', 'expediente', 'recompensa')),
  referencia  uuid,                                   -- la jugada, la compra, etc.
  detalle     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ovillos_user_libro ON public.ovillos_movimientos (user_id, libro_id);

COMMENT ON TABLE public.ovillos_movimientos IS
  'Libro de cuentas de ovillos, común a todos los juegos y por libro. Saldo = 10 + 2 × capítulos completados + suma de cantidad (_ovillos_saldo). Solo escriben las funciones de cada juego. Ver migración 087.';

ALTER TABLE public.ovillos_movimientos ENABLE ROW LEVEL SECURITY;

-- Cada uno puede ver sus propios movimientos (para un historial); nadie escribe directo.
DROP POLICY IF EXISTS "ovillos_select_own" ON public.ovillos_movimientos;
CREATE POLICY "ovillos_select_own" ON public.ovillos_movimientos
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- ═════════════════════════════════════════════════════════════
-- 2. Saldo de ovillos
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public._ovillos_saldo(p_user uuid, p_libro uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT 10
       + 2 * coalesce((SELECT max(capitulos_completados) FROM progreso_lectura
                       WHERE user_id = p_user AND libro_id = p_libro), 0)
       + coalesce((SELECT sum(cantidad) FROM ovillos_movimientos
                   WHERE user_id = p_user AND libro_id = p_libro), 0)::int;
$fn$;

CREATE OR REPLACE FUNCTION public.ovillos_saldo(p_libro uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE _ovillos_saldo(auth.uid(), p_libro) END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Estado de la mesa (uso interno)
-- ═════════════════════════════════════════════════════════════
-- Formato de anderson_contenido.datos (lo compila cargar_anderson.py):
--   personajes: [{id, nombre, corto, aparece}]
--   pistas:     [{id, pj, cap, parrafo, resumen, cita, senuelo, por_que}]
--   rasgos:     [{id, pj, opciones[3], correcta, tipos[3], pool[]}]
--               pool = pistas que lo prueban (+ la deducción de la que
--               parte, si es un cambio).
-- Devuelve solo lo que el alumno puede ver: ni el pool, ni la correcta,
-- ni qué pista es señuelo.

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
    'faltaron', CASE WHEN v_total > 0 AND v_cc >= v_total THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'pj', ra.pj, 'texto', ra.texto,
        'pistas', (SELECT coalesce(jsonb_agg(pi.resumen ORDER BY pi.o), '[]'::jsonb) FROM pi WHERE pi.id = ANY (ra.pool))
      ) ORDER BY ra.o)
      FROM ra WHERE ra.pendiente), '[]'::jsonb) END
  ) INTO v_res;

  RETURN v_res;
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. Lo que llama el alumno
-- ═════════════════════════════════════════════════════════════

-- Abrir la mesa.
CREATE OR REPLACE FUNCTION public.anderson_mesa(p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _anderson_estado(auth.uid(), p_libro);
END;
$fn$;


-- «Jugar» con tres piezas de un personaje. Cuesta 1 ovillo.
CREATE OR REPLACE FUNCTION public.anderson_jugar(p_libro uuid, p_personaje text, p_pistas text[])
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user    uuid := auth.uid();
  d         jsonb;
  v_ver     int;
  v_est     jsonb;
  v_validas text[];
  v_hechas  text[];
  v_rasgo   text;
  v_pares   jsonb := '[]'::jsonb;
  v_res     text;
  v_id      uuid;
  a         text;
  b         text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  -- Una jugada a la vez por alumno y libro (dos pestañas no gastan dos veces el mismo ovillo).
  PERFORM pg_advisory_xact_lock(hashtext('anderson:' || v_user || ':' || p_libro));

  SELECT datos, version INTO d, v_ver FROM anderson_contenido WHERE libro_id = p_libro;
  IF d IS NULL THEN
    RAISE EXCEPTION 'Este libro no tiene mesa de investigación.';
  END IF;
  IF cardinality(p_pistas) IS DISTINCT FROM 3
     OR (SELECT count(DISTINCT x) FROM unnest(p_pistas) x) <> 3 THEN
    RAISE EXCEPTION 'Hacen falta tres pistas distintas.';
  END IF;

  v_est := _anderson_estado(v_user, p_libro);
  IF jsonb_typeof(v_est->'abierta') = 'object' THEN
    RAISE EXCEPTION 'Primero elige la conclusión de la jugada que tienes abierta.';
  END IF;

  SELECT array_agg(x->>'id') INTO v_validas
  FROM (SELECT x FROM jsonb_array_elements(v_est->'pistas') x WHERE x->>'pj' = p_personaje
        UNION ALL
        SELECT x FROM jsonb_array_elements(v_est->'cartas') x WHERE x->>'pj' = p_personaje) s;
  IF v_validas IS NULL OR NOT (p_pistas <@ v_validas) THEN
    RAISE EXCEPTION 'Alguna de esas pistas no está en tu mesa.';
  END IF;
  IF (v_est->>'saldo')::int < 1 THEN
    RAISE EXCEPTION 'Te quedaste sin ovillos.';
  END IF;

  SELECT coalesce(array_agg(DISTINCT rasgo), '{}') INTO v_hechas
  FROM anderson_jugadas WHERE user_id = v_user AND libro_id = p_libro AND resultado = 'acierto';

  -- ¿Hay una deducción pendiente de este personaje con las tres piezas?
  SELECT x->>'id' INTO v_rasgo
  FROM jsonb_array_elements(d->'rasgos') x
  WHERE x->>'pj' = p_personaje
    AND NOT ((x->>'id') = ANY (v_hechas))
    AND p_pistas <@ ARRAY(SELECT jsonb_array_elements_text(x->'pool'))
  LIMIT 1;

  IF v_rasgo IS NOT NULL THEN
    v_res := 'abierta';
  ELSE
    -- Parejas que sí van juntas en alguna deducción pendiente: se marcan 🔗.
    FOR i IN 1..2 LOOP
      FOR j IN i + 1..3 LOOP
        a := least(p_pistas[i], p_pistas[j]);
        b := greatest(p_pistas[i], p_pistas[j]);
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(d->'rasgos') x
                   WHERE x->>'pj' = p_personaje
                     AND NOT ((x->>'id') = ANY (v_hechas))
                     AND ARRAY[a, b] <@ ARRAY(SELECT jsonb_array_elements_text(x->'pool'))) THEN
          v_pares := v_pares || jsonb_build_array(jsonb_build_array(a, b));
        END IF;
      END LOOP;
    END LOOP;
    v_res := CASE WHEN jsonb_array_length(v_pares) > 0 THEN 'casi' ELSE 'no_encajan' END;
  END IF;

  INSERT INTO anderson_jugadas (user_id, libro_id, version, personaje, pistas, resultado, rasgo, pareja,
                                pistas_en_mesa, capitulo)
  VALUES (v_user, p_libro, v_ver, p_personaje, p_pistas, v_res, v_rasgo,
          CASE WHEN v_res = 'casi' THEN v_pares END,
          cardinality(v_validas), (v_est->>'capitulos_completados')::int)
  RETURNING id INTO v_id;

  INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia)
  VALUES (v_user, p_libro, -1, 'mesa_jugar', v_id);

  RETURN jsonb_build_object('resultado', v_res, 'jugada', v_id, 'estado', _anderson_estado(v_user, p_libro));
END;
$fn$;


-- Elegir la conclusión (0, 1 o 2) de la jugada abierta. No cuesta ovillos.
CREATE OR REPLACE FUNCTION public.anderson_elegir(p_jugada uuid, p_opcion int)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user    uuid := auth.uid();
  v_libro   uuid;
  v_j       anderson_jugadas%ROWTYPE;
  v_rasgo   jsonb;
  v_ok      boolean;
  v_antes   jsonb;
  v_despues jsonb;
  v_hechas  int;
  v_pend    int;
  v_pagados int;
  v_premio  int := 0;
  v_quedan  int := 0;
  v_pasan   int := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  SELECT libro_id INTO v_libro FROM anderson_jugadas WHERE id = p_jugada AND user_id = v_user;
  IF v_libro IS NULL THEN
    RAISE EXCEPTION 'Esa jugada no existe.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('anderson:' || v_user || ':' || v_libro));

  SELECT * INTO v_j FROM anderson_jugadas WHERE id = p_jugada FOR UPDATE;
  IF v_j.resultado <> 'abierta' THEN
    RAISE EXCEPTION 'Esa jugada ya está resuelta.';
  END IF;

  SELECT x INTO v_rasgo
  FROM anderson_contenido c, jsonb_array_elements(c.datos->'rasgos') x
  WHERE c.libro_id = v_libro AND x->>'id' = v_j.rasgo;
  IF p_opcion IS NULL OR p_opcion < 0 OR p_opcion >= jsonb_array_length(v_rasgo->'opciones') THEN
    RAISE EXCEPTION 'Esa opción no existe.';
  END IF;
  IF EXISTS (SELECT 1 FROM anderson_jugadas WHERE user_id = v_user AND libro_id = v_libro
             AND resultado = 'fallo' AND rasgo = v_j.rasgo AND opcion = p_opcion) THEN
    RAISE EXCEPTION 'Esa opción ya está tachada.';
  END IF;

  v_antes := _anderson_estado(v_user, v_libro);
  v_ok := p_opcion = (v_rasgo->>'correcta')::int;

  UPDATE anderson_jugadas
  SET resultado   = CASE WHEN v_ok THEN 'acierto' ELSE 'fallo' END,
      opcion      = p_opcion,
      opcion_tipo = CASE WHEN v_ok THEN NULL ELSE v_rasgo->'tipos'->>p_opcion END,
      resuelta_at = now()
  WHERE id = p_jugada;

  v_despues := _anderson_estado(v_user, v_libro);

  IF v_ok THEN
    -- Del trío, las que siguen en la mesa porque sirven a otra deducción.
    SELECT count(*) INTO v_quedan FROM unnest(v_j.pistas) p
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(v_despues->'pistas') y WHERE y->>'id' = p);
    -- Las que estaban en la mesa, no entraron en el trío y ya no sirven a nada: pasan a la ficha.
    SELECT count(*) INTO v_pasan FROM jsonb_array_elements(v_antes->'pistas') y
    WHERE NOT ((y->>'id') = ANY (v_j.pistas))
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_despues->'pistas') z WHERE z->>'id' = y->>'id');

    -- Premio si el perfil de ese personaje queda al día con lo leído.
    SELECT (y->>'hechas')::int, (y->>'por_descubrir')::int INTO v_hechas, v_pend
    FROM jsonb_array_elements(v_despues->'personajes') y WHERE y->>'id' = v_j.personaje;
    IF v_pend = 0 THEN
      SELECT coalesce(sum((detalle->>'rasgos')::int), 0) INTO v_pagados
      FROM ovillos_movimientos
      WHERE user_id = v_user AND libro_id = v_libro AND motivo = 'mesa_premio'
        AND detalle->>'personaje' = v_j.personaje;
      IF v_hechas > v_pagados THEN
        v_premio := 3 * (v_hechas - v_pagados);
        INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
        VALUES (v_user, v_libro, v_premio, 'mesa_premio', p_jugada,
                jsonb_build_object('personaje', v_j.personaje, 'rasgos', v_hechas - v_pagados));
        v_despues := jsonb_set(v_despues, '{saldo}', to_jsonb(_ovillos_saldo(v_user, v_libro)));
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'resultado', CASE WHEN v_ok THEN 'acierto' ELSE 'fallo' END,
    'texto', CASE WHEN v_ok THEN v_rasgo->'opciones'->>p_opcion END,
    'quedan', v_quedan, 'pasan', v_pasan, 'premio', v_premio,
    'estado', v_despues);
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 5. Lo que ve el profe (Salón): un aula, su lectura actual
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.anderson_aula(p_aula uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_libro uuid;
  d       jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM comunidades WHERE id = p_aula AND colegio_id IS NOT NULL)
     OR NOT (es_admin_de_aula(p_aula) OR es_moderador(p_aula)) THEN
    RAISE EXCEPTION 'Solo el colegio ve los datos de esta aula.' USING ERRCODE = '42501';
  END IF;

  SELECT cl.libro_id INTO v_libro
  FROM comunidad_lecturas cl WHERE cl.comunidad_id = p_aula AND cl.fin IS NULL LIMIT 1;
  IF v_libro IS NULL THEN
    RETURN jsonb_build_object('libro_id', NULL, 'mesa', false);
  END IF;
  SELECT datos INTO d FROM anderson_contenido WHERE libro_id = v_libro;
  IF d IS NULL THEN
    RETURN jsonb_build_object('libro_id', v_libro, 'mesa', false);
  END IF;

  RETURN jsonb_build_object(
    'libro_id', v_libro,
    'mesa', true,
    'personajes', (SELECT jsonb_agg(jsonb_build_object('id', x->>'id', 'nombre', x->>'nombre') ORDER BY o)
                   FROM jsonb_array_elements(d->'personajes') WITH ORDINALITY t(x, o)),
    'rasgos', (SELECT jsonb_agg(jsonb_build_object('id', x->>'id', 'personaje', x->>'pj',
                                                   'texto', x->'opciones'->>((x->>'correcta')::int)) ORDER BY o)
               FROM jsonb_array_elements(d->'rasgos') WITH ORDINALITY t(x, o)),
    'alumnos', coalesce((
      SELECT jsonb_agg(al ORDER BY al->>'nombre')
      FROM (
        SELECT jsonb_build_object(
          'user_id', m.user_id,
          'nombre', coalesce(m.nombre_en_aula, nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Lector'),
          'ovillos', _ovillos_saldo(m.user_id, v_libro),
          -- Juntar pistas: intentos que no abrieron ninguna deducción, por personaje.
          'juntar', coalesce((
            SELECT jsonb_object_agg(s.personaje, jsonb_build_object('fallidos', s.n, 'pistas_en_mesa', s.media))
            FROM (SELECT j.personaje, count(*) AS n, round(avg(j.pistas_en_mesa)) AS media
                  FROM anderson_jugadas j
                  WHERE j.user_id = m.user_id AND j.libro_id = v_libro AND j.resultado IN ('no_encajan', 'casi')
                  GROUP BY j.personaje) s), '{}'::jsonb),
          -- Elegir la conclusión: por deducción, si la armó y qué falsas eligió.
          'deducciones', coalesce((
            SELECT jsonb_object_agg(r->>'id', jsonb_build_object(
              'armada', EXISTS (SELECT 1 FROM anderson_jugadas j WHERE j.user_id = m.user_id AND j.libro_id = v_libro
                                AND j.resultado = 'acierto' AND j.rasgo = r->>'id'),
              'fallos', coalesce((
                SELECT jsonb_agg(jsonb_build_object('eligio', r->'opciones'->>f.opcion, 'tipo', f.opcion_tipo) ORDER BY f.created_at)
                FROM anderson_jugadas f
                WHERE f.user_id = m.user_id AND f.libro_id = v_libro AND f.resultado = 'fallo' AND f.rasgo = r->>'id'), '[]'::jsonb)))
            FROM jsonb_array_elements(d->'rasgos') r), '{}'::jsonb),
          -- Señuelos que puso en algún trío.
          'senuelos', coalesce((
            SELECT jsonb_agg(DISTINCT p->>'resumen')
            FROM anderson_jugadas j, jsonb_array_elements(d->'pistas') p
            WHERE j.user_id = m.user_id AND j.libro_id = v_libro
              AND (p->>'senuelo')::boolean AND (p->>'id') = ANY (j.pistas)), '[]'::jsonb)
        ) AS al
        FROM comunidad_miembros m
        LEFT JOIN perfiles pf ON pf.id = m.user_id
        WHERE m.comunidad_id = p_aula AND m.rol = 'miembro'
      ) z), '[]'::jsonb)
  );
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 6. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._ovillos_saldo(uuid, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._anderson_estado(uuid, uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.ovillos_saldo(uuid)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.anderson_mesa(uuid)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.anderson_jugar(uuid, text, text[])     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.anderson_elegir(uuid, int)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.anderson_aula(uuid)                    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ovillos_saldo(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.anderson_mesa(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.anderson_jugar(uuid, text, text[])  TO authenticated;
GRANT EXECUTE ON FUNCTION public.anderson_elegir(uuid, int)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.anderson_aula(uuid)                 TO authenticated;
