-- =============================================================
-- INMERSIA — Migración 090
-- El concurso: «¿qué quiso decir aquí?», evaluado por IA
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 087 (ovillos_movimientos y _ovillos_saldo).
--
-- QUÉ HAY (decisiones de Juan, 6–7 nov 2026; reglas en
-- Documentation/colegios/concurso-prompt.md)
--   · concurso_contenido: las frases de cada libro (hasta 5 por capítulo),
--     una fila por libro con el JSON ya comprobado. Lo sube
--     cargar_concurso.py. Lleva las respuestas: nadie lo lee directamente.
--   · concurso_jugadas: una fila por alumno y frase (comodines usados y
--     veredicto). NO se guarda lo que escribió el alumno ni la explicación
--     de la IA (decisión de Juan, 7 nov).
--   · concurso_llamadas: una fila por cada llamada a la IA, para los topes.
--   · Los ovillos van al libro de cuentas común (ovillos_movimientos):
--     comodines con motivo 'comodin', premios con motivo 'concurso'.
--
-- QUIÉN LLAMA A QUÉ
--   El navegador (alumno): concurso_libro, concurso_comodin, concurso_elegir.
--   La función del servidor que guarda la clave de Gemini (service_role):
--   concurso_reservar → llama a la IA → concurso_resolver (o
--   concurso_liberar si la IA falló). El alumno no puede llamar a estas
--   tres: si pudiera, vería la referencia antes de contestar o se pondría
--   «correcto» él solo.
--
-- REGLAS DEL JUEGO QUE APLICA LA BASE DE DATOS
--   · A cada alumno le tocan 1 o 2 frases por capítulo, siempre las mismas
--     (sorteo fijo a partir de su id; no hace falta guardarlo).
--   · Un solo intento por frase.
--   · Comodines: más contexto −1, 50/50 −2. Con 50/50 se elige entre dos
--     lecturas y no se llama a la IA (acierto +1).
--   · Premios: correcto +3, casi +1, no 0.
--   · Topes de gasto: 20 llamadas a la IA por alumno y día, 1.000 en toda la
--     app por día (día UTC). Al llegar, «vuelve mañana» sin llamar a nadie.
--
-- QUÉ LE LLEGA AL NAVEGADOR
--   Las frases que le tocan (cita, pregunta, sitio). El contexto y las dos
--   lecturas del 50/50 solo cuando paga el comodín. La referencia y cuál era
--   la buena del 50/50, solo con el veredicto.
--
-- La vista del profe (Salón) llegará en otra migración.
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.concurso_contenido (
  libro_id       uuid        PRIMARY KEY REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL DEFAULT 1 CHECK (version >= 1),
  datos          jsonb       NOT NULL,
  actualizado_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.concurso_contenido IS
  'Frases del concurso de cada libro (JSON compilado por cargar_concurso.py). Lleva referencia y rúbrica: solo lo leen las funciones concurso_*. Los ids no se cambian una vez publicado. Ver migración 090.';

-- Sin políticas: solo lo leen las funciones SECURITY DEFINER.
ALTER TABLE public.concurso_contenido ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.concurso_jugadas (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id     uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  version      int         NOT NULL,
  frase        text        NOT NULL,
  capitulo     int         NOT NULL,          -- capítulo de la frase
  tipo         text        NOT NULL CHECK (tipo IN ('vocabulario', 'sintaxis', 'figurado', 'ironia', 'intencion')),
  estado       text        NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'evaluando', 'resuelta')),
  contexto     boolean     NOT NULL DEFAULT false,   -- usó «más contexto»
  cincuenta    boolean     NOT NULL DEFAULT false,   -- usó el 50/50
  veredicto    text        CHECK (veredicto IN ('correcto', 'casi', 'no')),
  evaluando_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resuelta_at  timestamptz,
  UNIQUE (user_id, libro_id, frase),
  CHECK ((estado = 'resuelta') = (veredicto IS NOT NULL)),
  CHECK (NOT (cincuenta AND veredicto = 'casi'))
);

COMMENT ON TABLE public.concurso_jugadas IS
  'Una fila por alumno y frase del concurso: comodines y veredicto. Nunca guarda el texto del alumno ni la explicación de la IA. Solo escriben las funciones concurso_*. Ver migración 090.';

ALTER TABLE public.concurso_jugadas ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.concurso_llamadas (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concurso_llamadas_fecha ON public.concurso_llamadas (created_at);
CREATE INDEX IF NOT EXISTS idx_concurso_llamadas_user  ON public.concurso_llamadas (user_id, created_at);

COMMENT ON TABLE public.concurso_llamadas IS
  'Una fila por cada llamada a la IA del concurso (cuenta aunque falle). Sirve para los topes por alumno y por día. Ver migración 090.';

ALTER TABLE public.concurso_llamadas ENABLE ROW LEVEL SECURITY;


-- ═════════════════════════════════════════════════════════════
-- 2. Uso interno
-- ═════════════════════════════════════════════════════════════
-- Formato de concurso_contenido.datos (lo compila cargar_concurso.py):
--   frases: [{id, cap, parrafo, tipo, pisa, dificultad, cita, pregunta,
--             contexto: {parrafo, cita}, referencia,
--             rubrica: {ideas_clave[], casi, errores[], no_hace_falta[]},
--             cincuenta: {opciones[2], correcta}}]
--   parrafo = parrafos.numero dentro del capítulo (cada capítulo empieza en 1).

-- Las frases que le tocan a un alumno: 1 o 2 por capítulo, siempre las mismas.
-- Las que ya tienen fila se quedan aunque el contenido cambie de versión.
CREATE OR REPLACE FUNCTION public._concurso_frases(p_user uuid, p_libro uuid)
RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH f AS (
    SELECT x, o, x->>'cap' AS cap,
           row_number() OVER (PARTITION BY x->>'cap' ORDER BY md5(p_user || ':' || (x->>'id'))) AS puesto,
           1 + get_byte(decode(md5(p_user || ':' || p_libro || ':' || (x->>'cap')), 'hex'), 0) % 2 AS cuantas
    FROM concurso_contenido c, jsonb_array_elements(c.datos->'frases') WITH ORDINALITY t(x, o)
    WHERE c.libro_id = p_libro
  )
  SELECT x FROM f
  WHERE puesto <= cuantas
     OR EXISTS (SELECT 1 FROM concurso_jugadas j
                WHERE j.user_id = p_user AND j.libro_id = p_libro AND j.frase = f.x->>'id')
  ORDER BY (cap)::int, o;
$fn$;


CREATE OR REPLACE FUNCTION public._concurso_estado(p_user uuid, p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ver int;
BEGIN
  SELECT version INTO v_ver FROM concurso_contenido WHERE libro_id = p_libro;
  IF v_ver IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'version', v_ver,
    'saldo', _ovillos_saldo(p_user, p_libro),
    'frases', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', x->>'id',
          'cap', (x->>'cap')::int,
          'parrafo', (x->>'parrafo')::int,
          'cita', x->>'cita',
          'pregunta', x->>'pregunta',
          'estado', coalesce(j.estado, 'abierta'),
          'contexto', CASE WHEN j.contexto THEN x->'contexto' END,
          'opciones', CASE WHEN j.cincuenta THEN x->'cincuenta'->'opciones' END,
          'veredicto', j.veredicto
        )
        || CASE WHEN j.estado = 'resuelta' THEN jsonb_build_object(
             'referencia', x->>'referencia',
             'correcta', CASE WHEN j.cincuenta THEN (x->'cincuenta'->>'correcta')::int END)
           ELSE '{}'::jsonb END)
      FROM _concurso_frases(p_user, p_libro) x
      LEFT JOIN concurso_jugadas j
        ON j.user_id = p_user AND j.libro_id = p_libro AND j.frase = x->>'id'), '[]'::jsonb)
  );
END;
$fn$;


-- La frase, solo si le toca a ese alumno. Si no, error.
CREATE OR REPLACE FUNCTION public._concurso_frase(p_user uuid, p_libro uuid, p_frase text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_x jsonb;
BEGIN
  SELECT x INTO v_x FROM _concurso_frases(p_user, p_libro) x WHERE x->>'id' = p_frase;
  IF v_x IS NULL THEN
    RAISE EXCEPTION 'Esa frase no te toca.';
  END IF;
  RETURN v_x;
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Lo que llama el alumno
-- ═════════════════════════════════════════════════════════════

-- Las frases que le tocan en el libro, con el estado de cada una.
CREATE OR REPLACE FUNCTION public.concurso_libro(p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _concurso_estado(auth.uid(), p_libro);
END;
$fn$;


-- Comprar un comodín: 'contexto' (1 ovillo) o 'cincuenta' (2 ovillos).
CREATE OR REPLACE FUNCTION public.concurso_comodin(p_libro uuid, p_frase text, p_cual text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user  uuid := auth.uid();
  v_x     jsonb;
  v_j     concurso_jugadas%ROWTYPE;
  v_coste int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  IF p_cual NOT IN ('contexto', 'cincuenta') THEN
    RAISE EXCEPTION 'Ese comodín no existe.';
  END IF;
  v_coste := CASE p_cual WHEN 'contexto' THEN 1 ELSE 2 END;
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || p_libro));

  v_x := _concurso_frase(v_user, p_libro, p_frase);
  SELECT * INTO v_j FROM concurso_jugadas
  WHERE user_id = v_user AND libro_id = p_libro AND frase = p_frase FOR UPDATE;
  IF v_j.estado IN ('evaluando', 'resuelta') THEN
    RAISE EXCEPTION 'Esta frase ya está contestada.';
  END IF;
  IF (p_cual = 'contexto' AND v_j.contexto) OR (p_cual = 'cincuenta' AND v_j.cincuenta) THEN
    RAISE EXCEPTION 'Ese comodín ya lo usaste.';
  END IF;
  IF _ovillos_saldo(v_user, p_libro) < v_coste THEN
    RAISE EXCEPTION 'No te alcanzan los ovillos.';
  END IF;

  INSERT INTO concurso_jugadas (user_id, libro_id, version, frase, capitulo, tipo, contexto, cincuenta)
  SELECT v_user, p_libro, c.version, p_frase, (v_x->>'cap')::int, v_x->>'tipo',
         p_cual = 'contexto', p_cual = 'cincuenta'
  FROM concurso_contenido c WHERE c.libro_id = p_libro
  ON CONFLICT (user_id, libro_id, frase) DO UPDATE
  SET contexto  = concurso_jugadas.contexto  OR EXCLUDED.contexto,
      cincuenta = concurso_jugadas.cincuenta OR EXCLUDED.cincuenta
  RETURNING * INTO v_j;

  INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
  VALUES (v_user, p_libro, -v_coste, 'comodin', v_j.id,
          jsonb_build_object('juego', 'concurso', 'frase', p_frase, 'comodin', p_cual));

  RETURN jsonb_build_object('estado', _concurso_estado(v_user, p_libro));
END;
$fn$;


-- Elegir una de las dos lecturas del 50/50 (0 o 1). Sin IA: acierto +1.
CREATE OR REPLACE FUNCTION public.concurso_elegir(p_libro uuid, p_frase text, p_opcion int)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_x    jsonb;
  v_j    concurso_jugadas%ROWTYPE;
  v_ok   boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  IF p_opcion IS NULL OR p_opcion NOT IN (0, 1) THEN
    RAISE EXCEPTION 'Esa opción no existe.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || p_libro));

  v_x := _concurso_frase(v_user, p_libro, p_frase);
  SELECT * INTO v_j FROM concurso_jugadas
  WHERE user_id = v_user AND libro_id = p_libro AND frase = p_frase FOR UPDATE;
  IF v_j.id IS NULL OR NOT v_j.cincuenta THEN
    RAISE EXCEPTION 'Primero hay que usar el 50/50.';
  END IF;
  IF v_j.estado <> 'abierta' THEN
    RAISE EXCEPTION 'Esta frase ya está contestada.';
  END IF;

  v_ok := p_opcion = (v_x->'cincuenta'->>'correcta')::int;
  UPDATE concurso_jugadas
  SET estado = 'resuelta', veredicto = CASE WHEN v_ok THEN 'correcto' ELSE 'no' END, resuelta_at = now()
  WHERE id = v_j.id;

  IF v_ok THEN
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
    VALUES (v_user, p_libro, 1, 'concurso', v_j.id, jsonb_build_object('frase', p_frase));
  END IF;

  RETURN jsonb_build_object('veredicto', CASE WHEN v_ok THEN 'correcto' ELSE 'no' END,
                            'premio', CASE WHEN v_ok THEN 1 ELSE 0 END,
                            'estado', _concurso_estado(v_user, p_libro));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. Lo que llama la función del servidor (service_role)
-- ═════════════════════════════════════════════════════════════
-- p_user lo saca la función del servidor del token del alumno, ya verificado.

-- Antes de llamar a la IA: comprueba todo, apunta la llamada y devuelve lo que
-- la IA necesita. Errores con mensaje fijo para que el servidor los traduzca:
--   'limite_alumno', 'limite_global' → «vuelve mañana».
CREATE OR REPLACE FUNCTION public.concurso_reservar(p_user uuid, p_libro uuid, p_frase text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_x   jsonb;
  v_j   concurso_jugadas%ROWTYPE;
  v_hoy timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || p_user || ':' || p_libro));

  v_x := _concurso_frase(p_user, p_libro, p_frase);
  SELECT * INTO v_j FROM concurso_jugadas
  WHERE user_id = p_user AND libro_id = p_libro AND frase = p_frase FOR UPDATE;
  IF v_j.estado = 'resuelta' THEN
    RAISE EXCEPTION 'Esta frase ya está contestada.';
  END IF;
  IF v_j.cincuenta THEN
    RAISE EXCEPTION 'Con el 50/50 se elige, no se escribe.';
  END IF;
  -- Dos clics seguidos no llaman dos veces. Si el servidor se cayó a mitad, a los 2 minutos se libera solo.
  IF v_j.estado = 'evaluando' AND v_j.evaluando_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Ya se está evaluando.';
  END IF;

  IF (SELECT count(*) FROM concurso_llamadas WHERE user_id = p_user AND created_at >= v_hoy) >= 20 THEN
    RAISE EXCEPTION 'limite_alumno';
  END IF;
  -- El tope global, con un cerrojo propio para que dos alumnos a la vez no lo pasen.
  PERFORM pg_advisory_xact_lock(hashtext('concurso:tope_global'));
  IF (SELECT count(*) FROM concurso_llamadas WHERE created_at >= v_hoy) >= 1000 THEN
    RAISE EXCEPTION 'limite_global';
  END IF;

  INSERT INTO concurso_llamadas (user_id) VALUES (p_user);

  INSERT INTO concurso_jugadas (user_id, libro_id, version, frase, capitulo, tipo, estado, evaluando_at)
  SELECT p_user, p_libro, c.version, p_frase, (v_x->>'cap')::int, v_x->>'tipo', 'evaluando', now()
  FROM concurso_contenido c WHERE c.libro_id = p_libro
  ON CONFLICT (user_id, libro_id, frase) DO UPDATE
  SET estado = 'evaluando', evaluando_at = now()
  RETURNING * INTO v_j;

  RETURN jsonb_build_object(
    'cita', v_x->>'cita',
    'contexto', v_x->'contexto'->>'cita',
    'pregunta', v_x->>'pregunta',
    'referencia', v_x->>'referencia',
    'rubrica', v_x->'rubrica');
END;
$fn$;


-- La IA contestó: guarda el veredicto y paga.
CREATE OR REPLACE FUNCTION public.concurso_resolver(p_user uuid, p_libro uuid, p_frase text, p_veredicto text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_j      concurso_jugadas%ROWTYPE;
  v_premio int;
BEGIN
  IF p_veredicto NOT IN ('correcto', 'casi', 'no') THEN
    RAISE EXCEPTION 'Veredicto desconocido.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || p_user || ':' || p_libro));

  SELECT * INTO v_j FROM concurso_jugadas
  WHERE user_id = p_user AND libro_id = p_libro AND frase = p_frase FOR UPDATE;
  IF v_j.id IS NULL OR v_j.estado <> 'evaluando' THEN
    RAISE EXCEPTION 'Esta frase no se está evaluando.';
  END IF;

  UPDATE concurso_jugadas
  SET estado = 'resuelta', veredicto = p_veredicto, resuelta_at = now()
  WHERE id = v_j.id;

  v_premio := CASE p_veredicto WHEN 'correcto' THEN 3 WHEN 'casi' THEN 1 ELSE 0 END;
  IF v_premio > 0 THEN
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
    VALUES (p_user, p_libro, v_premio, 'concurso', v_j.id, jsonb_build_object('frase', p_frase));
  END IF;

  RETURN jsonb_build_object('veredicto', p_veredicto, 'premio', v_premio,
                            'estado', _concurso_estado(p_user, p_libro));
END;
$fn$;


-- La IA falló o no contestó bien: la frase vuelve a quedar abierta para
-- reintentar. La llamada ya contó para los topes.
CREATE OR REPLACE FUNCTION public.concurso_liberar(p_user uuid, p_libro uuid, p_frase text)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
  UPDATE concurso_jugadas SET estado = 'abierta', evaluando_at = NULL
  WHERE user_id = p_user AND libro_id = p_libro AND frase = p_frase AND estado = 'evaluando';
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 5. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._concurso_frases(uuid, uuid)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._concurso_estado(uuid, uuid)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._concurso_frase(uuid, uuid, text)  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.concurso_libro(uuid)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.concurso_comodin(uuid, text, text)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.concurso_elegir(uuid, text, int)         FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concurso_libro(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.concurso_comodin(uuid, text, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.concurso_elegir(uuid, text, int)      TO authenticated;

-- Solo el servidor: el alumno nunca puede reservar ni ponerse el veredicto.
REVOKE ALL ON FUNCTION public.concurso_reservar(uuid, uuid, text)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.concurso_resolver(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.concurso_liberar(uuid, uuid, text)        FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.concurso_reservar(uuid, uuid, text)       TO service_role;
GRANT EXECUTE ON FUNCTION public.concurso_resolver(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.concurso_liberar(uuid, uuid, text)        TO service_role;
