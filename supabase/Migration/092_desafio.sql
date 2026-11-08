-- =============================================================
-- INMERSIA — Migración 092
-- El desafío del gato: una charla a mitad del libro y otra al final
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ HAY (decisiones de Juan, 8 nov 2026; reglas en
-- Documentation/colegios/desafio-prompt.md)
--   · desafio_contenido: las hojas del gato de cada libro (4 preguntas por
--     momento), una fila por libro con el JSON ya comprobado. Lo sube
--     cargar_desafio.py. Nadie lo lee directamente.
--   · desafio_charlas: una fila por alumno, libro y momento, con la charla
--     entera (lo que escribió el alumno y lo que contestó el gato) y el
--     resumen para el profe. A diferencia del concurso, aquí SÍ se guarda el
--     texto: la charla la lee el profe y el alumno lo sabe.
--   · desafio_llamadas: una fila por cada llamada a la IA, para los topes.
--   · Sin ovillos por ahora.
--
-- QUIÉN LLAMA A QUÉ
--   El navegador (alumno): desafio_libro.
--   La función del servidor que guarda la clave de Gemini (service_role):
--   desafio_reservar → llama a la IA → desafio_responder. Si la IA falla, el
--   servidor contesta igual con una repregunta fija de la hoja (plan B). El
--   alumno no puede llamar a estas dos: vería la hoja o escribiría por el gato.
--
-- REGLAS DEL JUEGO QUE APLICA LA BASE DE DATOS
--   · Dos momentos por libro, 'mitad' y 'final'. En cada uno le toca UNA de
--     las preguntas, siempre la misma (sorteo fijo a partir de su id).
--   · Como mucho 3 mensajes del alumno por charla. Tras el primero el gato
--     nunca termina; tras el tercero termina siempre.
--   · Cada mensaje del alumno, de 2 a 150 palabras.
--   · Topes de gasto: 12 llamadas a la IA por alumno y día, 1.000 en toda la
--     app por día (día UTC). Al llegar, «vuelve mañana» sin llamar a nadie.
--
-- QUÉ LE LLEGA AL NAVEGADOR
--   La pregunta que le toca en cada momento y su charla. Nunca la hoja ni el
--   resumen para el profe. Y `con_profe`: si está en un aula que lee ese libro
--   (solo entonces se le dice que su profe lee la charla).
--
-- La vista del profe (Salón) llegará en otra migración.
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.desafio_contenido (
  libro_id       uuid        PRIMARY KEY REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL DEFAULT 1 CHECK (version >= 1),
  datos          jsonb       NOT NULL,
  actualizado_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.desafio_contenido IS
  'Hojas del gato del desafío de cada libro (JSON compilado por cargar_desafio.py). Solo lo leen las funciones desafio_*. Los ids de las preguntas no se cambian una vez publicado. Ver migración 092.';

-- Sin políticas: solo lo leen las funciones SECURITY DEFINER.
ALTER TABLE public.desafio_contenido ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.desafio_charlas (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id     uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  version      int         NOT NULL,
  momento      text        NOT NULL CHECK (momento IN ('mitad', 'final')),
  pregunta     text        NOT NULL,          -- id de la pregunta en la hoja
  tipo         text        NOT NULL,
  estado       text        NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'evaluando', 'terminada')),
  turnos       jsonb       NOT NULL DEFAULT '[]'::jsonb,   -- [{de: 'gato'|'alumno', texto, at}]
  resumen      jsonb,                          -- para el profe; null hasta terminar (o si la IA falló al final)
  evaluando_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  terminada_at timestamptz,
  UNIQUE (user_id, libro_id, momento),
  CHECK ((estado = 'terminada') = (terminada_at IS NOT NULL)),
  CHECK (jsonb_typeof(turnos) = 'array')
);

COMMENT ON TABLE public.desafio_charlas IS
  'Una fila por alumno, libro y momento del desafío: la charla con el gato y el resumen para el profe. Guarda el texto del alumno (lo lee su profe). Solo escriben las funciones desafio_*. Ver migración 092.';

ALTER TABLE public.desafio_charlas ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.desafio_llamadas (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desafio_llamadas_fecha ON public.desafio_llamadas (created_at);
CREATE INDEX IF NOT EXISTS idx_desafio_llamadas_user  ON public.desafio_llamadas (user_id, created_at);

COMMENT ON TABLE public.desafio_llamadas IS
  'Una fila por cada llamada a la IA del desafío (cuenta aunque falle). Sirve para los topes por alumno y por día. Ver migración 092.';

ALTER TABLE public.desafio_llamadas ENABLE ROW LEVEL SECURITY;


-- ═════════════════════════════════════════════════════════════
-- 2. Uso interno
-- ═════════════════════════════════════════════════════════════
-- Formato de desafio_contenido.datos (lo compila cargar_desafio.py):
--   momentos: [{momento: 'mitad'|'final', tras_capitulo,
--               preguntas: [{id, tipo, consigna, que_mide,
--                            hoja: {hechos, material, no_hace_falta},
--                            repreguntas_fijas[2]}]}]

-- La pregunta que le toca a un alumno en un momento, siempre la misma. Si ya
-- empezó la charla, la de su charla aunque el contenido cambie de versión.
CREATE OR REPLACE FUNCTION public._desafio_pregunta(p_user uuid, p_libro uuid, p_momento text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT q || jsonb_build_object('tras_capitulo', (m->>'tras_capitulo')::int)
  FROM desafio_contenido c,
       jsonb_array_elements(c.datos->'momentos') m,
       jsonb_array_elements(m->'preguntas') q
  WHERE c.libro_id = p_libro AND m->>'momento' = p_momento
  ORDER BY (q->>'id') IS DISTINCT FROM (SELECT ch.pregunta FROM desafio_charlas ch
                                        WHERE ch.user_id = p_user AND ch.libro_id = p_libro AND ch.momento = p_momento),
           md5(p_user || ':' || p_libro || ':' || (q->>'id'))
  LIMIT 1;
$fn$;


CREATE OR REPLACE FUNCTION public._desafio_estado(p_user uuid, p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ver int;
BEGIN
  SELECT version INTO v_ver FROM desafio_contenido WHERE libro_id = p_libro;
  IF v_ver IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'version', v_ver,
    'max_turnos', 3,
    -- Está en un aula que lee este libro: solo entonces el gato dice «Lo lee tu profe».
    'con_profe', EXISTS (SELECT 1 FROM comunidad_miembros cm JOIN comunidades co ON co.id = cm.comunidad_id
                         WHERE cm.user_id = p_user AND co.colegio_id IS NOT NULL AND co.libro_id = p_libro),
    'momentos', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'momento', mo.momento,
          'tras_capitulo', (q->>'tras_capitulo')::int,
          'pregunta', jsonb_build_object('id', q->>'id', 'tipo', q->>'tipo', 'consigna', q->>'consigna'),
          'estado', coalesce(ch.estado, 'nueva'),
          'turnos', coalesce((SELECT jsonb_agg(jsonb_build_object('de', t->>'de', 'texto', t->>'texto') ORDER BY o)
                              FROM jsonb_array_elements(ch.turnos) WITH ORDINALITY x(t, o)), '[]'::jsonb))
        ORDER BY mo.orden)
      FROM (VALUES ('mitad', 1), ('final', 2)) mo(momento, orden)
      CROSS JOIN LATERAL _desafio_pregunta(p_user, p_libro, mo.momento) q
      LEFT JOIN desafio_charlas ch
        ON ch.user_id = p_user AND ch.libro_id = p_libro AND ch.momento = mo.momento
      WHERE q IS NOT NULL), '[]'::jsonb)
  );
END;
$fn$;


-- Cuántos mensajes del alumno hay en la charla.
CREATE OR REPLACE FUNCTION public._desafio_turnos_alumno(p_turnos jsonb)
RETURNS int
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT count(*)::int FROM jsonb_array_elements(p_turnos) t WHERE t->>'de' = 'alumno';
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Lo que llama el alumno
-- ═════════════════════════════════════════════════════════════

-- Las dos charlas del libro (la pregunta que le toca y lo hablado).
CREATE OR REPLACE FUNCTION public.desafio_libro(p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _desafio_estado(auth.uid(), p_libro);
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. Lo que llama la función del servidor (service_role)
-- ═════════════════════════════════════════════════════════════
-- p_user lo saca la función del servidor del token del alumno, ya verificado.

-- El alumno mandó un mensaje: comprueba todo, lo guarda, apunta la llamada y
-- devuelve lo que la IA necesita. Errores con mensaje fijo para que el
-- servidor los traduzca:
--   'muy_corta', 'muy_larga' → el cuadro de texto lo avisa;
--   'limite_alumno', 'limite_global' → «vuelve mañana».
CREATE OR REPLACE FUNCTION public.desafio_reservar(p_user uuid, p_libro uuid, p_momento text, p_texto text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_q        jsonb;
  v_ch       desafio_charlas%ROWTYPE;
  v_turnos   jsonb;
  v_n        int;
  v_palabras int;
  v_hoy      timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  IF p_momento NOT IN ('mitad', 'final') THEN
    RAISE EXCEPTION 'Ese momento no existe.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('desafio:' || p_user || ':' || p_libro));

  v_q := _desafio_pregunta(p_user, p_libro, p_momento);
  IF v_q IS NULL THEN
    RAISE EXCEPTION 'Este libro no tiene desafío.';
  END IF;

  v_palabras := coalesce(array_length(regexp_split_to_array(btrim(coalesce(p_texto, '')), '\s+'), 1), 0);
  IF btrim(coalesce(p_texto, '')) = '' OR v_palabras < 2 THEN
    RAISE EXCEPTION 'muy_corta';
  END IF;
  IF v_palabras > 150 THEN
    RAISE EXCEPTION 'muy_larga';
  END IF;

  SELECT * INTO v_ch FROM desafio_charlas
  WHERE user_id = p_user AND libro_id = p_libro AND momento = p_momento FOR UPDATE;
  IF v_ch.estado = 'terminada' THEN
    RAISE EXCEPTION 'Esta charla ya terminó.';
  END IF;
  -- Dos envíos seguidos no llaman dos veces. Si el servidor se cayó a mitad, a los 2 minutos se libera solo.
  IF v_ch.estado = 'evaluando' AND v_ch.evaluando_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Ya se está evaluando.';
  END IF;

  -- La charla empieza con la pregunta del gato. Un mensaje del alumno que
  -- quedó colgado sin respuesta (servidor caído) se sustituye por el nuevo.
  v_turnos := coalesce(v_ch.turnos,
                       jsonb_build_array(jsonb_build_object('de', 'gato', 'texto', v_q->>'consigna', 'at', now())));
  IF v_turnos->-1->>'de' = 'alumno' THEN
    v_turnos := v_turnos - (jsonb_array_length(v_turnos) - 1);
  END IF;
  v_n := _desafio_turnos_alumno(v_turnos);
  IF v_n >= 3 THEN
    RAISE EXCEPTION 'Esta charla ya terminó.';
  END IF;

  IF (SELECT count(*) FROM desafio_llamadas WHERE user_id = p_user AND created_at >= v_hoy) >= 12 THEN
    RAISE EXCEPTION 'limite_alumno';
  END IF;
  -- El tope global, con un cerrojo propio para que dos alumnos a la vez no lo pasen.
  PERFORM pg_advisory_xact_lock(hashtext('desafio:tope_global'));
  IF (SELECT count(*) FROM desafio_llamadas WHERE created_at >= v_hoy) >= 1000 THEN
    RAISE EXCEPTION 'limite_global';
  END IF;

  INSERT INTO desafio_llamadas (user_id) VALUES (p_user);

  v_turnos := v_turnos || jsonb_build_array(jsonb_build_object('de', 'alumno', 'texto', btrim(p_texto), 'at', now()));

  INSERT INTO desafio_charlas (user_id, libro_id, version, momento, pregunta, tipo, estado, turnos, evaluando_at)
  SELECT p_user, p_libro, c.version, p_momento, v_q->>'id', v_q->>'tipo', 'evaluando', v_turnos, now()
  FROM desafio_contenido c WHERE c.libro_id = p_libro
  ON CONFLICT (user_id, libro_id, momento) DO UPDATE
  SET estado = 'evaluando', turnos = EXCLUDED.turnos, evaluando_at = now();

  RETURN jsonb_build_object(
    'libro', (SELECT titulo FROM libros WHERE id = p_libro),
    'cap', (v_q->>'tras_capitulo')::int,
    'tipo', v_q->>'tipo',
    'consigna', v_q->>'consigna',
    'que_mide', v_q->>'que_mide',
    'hoja', v_q->'hoja',
    'repreguntas_fijas', v_q->'repreguntas_fijas',
    'turnos', (SELECT jsonb_agg(jsonb_build_object('de', t->>'de', 'texto', t->>'texto') ORDER BY o)
               FROM jsonb_array_elements(v_turnos) WITH ORDINALITY x(t, o)),
    'turno', v_n + 1,
    'max', 3);
END;
$fn$;


-- El gato contestó (la IA o el plan B): guarda su mensaje y, si toca,
-- cierra la charla con el resumen. Tras el primer mensaje del alumno nunca
-- se cierra; tras el tercero, siempre.
CREATE OR REPLACE FUNCTION public.desafio_responder(p_user uuid, p_libro uuid, p_momento text,
                                                    p_mensaje text, p_terminar boolean, p_resumen jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ch  desafio_charlas%ROWTYPE;
  v_n   int;
  v_fin boolean;
BEGIN
  IF btrim(coalesce(p_mensaje, '')) = '' OR length(p_mensaje) > 600 THEN
    RAISE EXCEPTION 'Mensaje del gato vacío o demasiado largo.';
  END IF;
  IF p_resumen IS NOT NULL AND jsonb_typeof(p_resumen) <> 'object' THEN
    RAISE EXCEPTION 'El resumen tiene que ser un objeto.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('desafio:' || p_user || ':' || p_libro));

  SELECT * INTO v_ch FROM desafio_charlas
  WHERE user_id = p_user AND libro_id = p_libro AND momento = p_momento FOR UPDATE;
  IF v_ch.id IS NULL OR v_ch.estado <> 'evaluando' THEN
    RAISE EXCEPTION 'Esta charla no está esperando al gato.';
  END IF;

  v_n := _desafio_turnos_alumno(v_ch.turnos);
  v_fin := (coalesce(p_terminar, false) AND v_n > 1) OR v_n >= 3;

  UPDATE desafio_charlas
  SET turnos = turnos || jsonb_build_array(jsonb_build_object('de', 'gato', 'texto', btrim(p_mensaje), 'at', now())),
      estado = CASE WHEN v_fin THEN 'terminada' ELSE 'abierta' END,
      resumen = CASE WHEN v_fin THEN p_resumen END,
      evaluando_at = NULL,
      terminada_at = CASE WHEN v_fin THEN now() END
  WHERE id = v_ch.id;

  RETURN jsonb_build_object('terminada', v_fin, 'estado', _desafio_estado(p_user, p_libro));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 5. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._desafio_pregunta(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._desafio_estado(uuid, uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._desafio_turnos_alumno(jsonb)       FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.desafio_libro(uuid)    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desafio_libro(uuid) TO authenticated;

-- Solo el servidor: el alumno nunca ve la hoja ni escribe por el gato.
REVOKE ALL ON FUNCTION public.desafio_reservar(uuid, uuid, text, text)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.desafio_responder(uuid, uuid, text, text, boolean, jsonb)     FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desafio_reservar(uuid, uuid, text, text)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.desafio_responder(uuid, uuid, text, text, boolean, jsonb)  TO service_role;
