-- =============================================================
-- INMERSIA — Migración 091
-- El mapa del tesoro: encontrar frases del capítulo subrayándolas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 087 (ovillos_movimientos y _ovillos_saldo).
--
-- QUÉ HAY (decisiones de Juan, 6–7 nov 2026; reglas en
-- Documentation/colegios/mapa-tesoro-prompt.md)
--   · mapa_contenido: los tesoros de cada libro, una fila por libro con el
--     JSON ya comprobado. Lo sube cargar_mapa.py. Lleva las respuestas:
--     nadie lo lee directamente.
--   · mapa_jugadas: una fila por cada vez que el alumno subraya y elige
--     «Mapa del tesoro» (acierto o fallo). El estado de cada tesoro se saca
--     de aquí. NO se guarda lo que subrayó.
--   · Los ovillos van al libro de cuentas común (ovillos_movimientos,
--     motivo 'tesoro'): +1 al acertar, −1 al fallar.
--
-- REGLAS DEL JUEGO QUE APLICA LA BASE DE DATOS
--   · Sin límite de intentos: acierto +1, cada fallo −1, esté donde esté.
--     Para intentarlo hace falta al menos 1 ovillo.
--   · Vale si más de la mitad de lo subrayado cae en una frase buena de un
--     tesoro pendiente del capítulo. Hacen falta al menos 3 palabras.
--   · Subrayar otra vez un tesoro ya encontrado no cobra ni paga.
--   · «Cerca»: el fallo cae en el párrafo de una frase buena pendiente o en
--     el de al lado. Cuesta igual.
--   · Para el profe, un fallo dentro de un brillo se apunta a ese tesoro;
--     fuera de los brillos queda sin tesoro (fallo del capítulo).
--   · Los tesoros no se escapan: siguen abiertos hasta que se encuentran.
--
-- QUÉ LE LLEGA AL NAVEGADOR
--   Las fichas de todos los capítulos (pregunta, tipo, si es spoiler) y
--   entre qué párrafos brilla el borde del libro. Las fichas con spoiler
--   las esconde la app hasta su brillo. Las frases buenas nunca: dónde
--   estaba y el «porque» del gato solo cuando lo encuentra.
--
-- La vista del profe (Salón) llegará en otra migración.
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mapa_contenido (
  libro_id       uuid        PRIMARY KEY REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL DEFAULT 1 CHECK (version >= 1),
  datos          jsonb       NOT NULL,
  actualizado_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mapa_contenido IS
  'Tesoros del mapa de cada libro (JSON compilado por cargar_mapa.py). Lleva las frases buenas: solo lo leen las funciones mapa_*. Los ids no se cambian una vez publicado. Ver migración 091.';

-- Sin políticas: solo lo leen las funciones SECURITY DEFINER.
ALTER TABLE public.mapa_contenido ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.mapa_jugadas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id    uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  version     int         NOT NULL,
  capitulo    int         NOT NULL,
  parrafo     int         NOT NULL,          -- dónde subrayó (parrafos.numero)
  tesoro      text,                          -- el encontrado, o el del brillo del fallo; NULL = fallo fuera de los brillos
  tipo        text        CHECK (tipo IN ('vista', 'escondido')),
  acierto     boolean     NOT NULL,
  cerca       boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((tesoro IS NULL) = (tipo IS NULL)),
  CHECK (NOT acierto OR (tesoro IS NOT NULL AND NOT cerca))
);

-- Cada tesoro se paga una sola vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mapa_jugadas_acierto
  ON public.mapa_jugadas (user_id, libro_id, tesoro) WHERE acierto;
CREATE INDEX IF NOT EXISTS idx_mapa_jugadas_user_libro ON public.mapa_jugadas (user_id, libro_id);

COMMENT ON TABLE public.mapa_jugadas IS
  'Una fila por cada subrayado enviado al mapa del tesoro: acierto o fallo, y el tesoro (el encontrado o el del brillo). Nunca guarda el texto subrayado. Solo escriben las funciones mapa_*. Ver migración 091.';

ALTER TABLE public.mapa_jugadas ENABLE ROW LEVEL SECURITY;


-- ═════════════════════════════════════════════════════════════
-- 2. Uso interno
-- ═════════════════════════════════════════════════════════════
-- Formato de mapa_contenido.datos (lo compila cargar_mapa.py):
--   tesoros: [{id, cap, tipo, pisa, dificultad, spoiler, pregunta, porque,
--              brillo: [desde, hasta],
--              respuestas: [{parrafo, inicio, fin}]}]
--   textos:  {"<cap>:<parrafo>": texto normalizado de cada párrafo con respuestas}
--   parrafo = parrafos.numero dentro del capítulo (cada capítulo empieza en 1). inicio/fin = posición de la
--   frase buena dentro del texto normalizado (desde 1, fin incluido).
--   La primera respuesta es la principal (la que se enseña al encontrarlo).

-- La misma normalización que norm() de cargar_anderson.py: rayas a '-',
-- comillas a '"', espacios seguidos a uno.
CREATE OR REPLACE FUNCTION public._mapa_norm(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT btrim(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
           '[–—-]+', '-', 'g'), '[«»“”"]', '"', 'g'), '\s+', ' ', 'g'));
$fn$;


CREATE OR REPLACE FUNCTION public._mapa_estado(p_user uuid, p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_c mapa_contenido%ROWTYPE;
BEGIN
  SELECT * INTO v_c FROM mapa_contenido WHERE libro_id = p_libro;
  IF v_c.libro_id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'version', v_c.version,
    'saldo', _ovillos_saldo(p_user, p_libro),
    'tesoros', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', x->>'id',
          'cap', (x->>'cap')::int,
          'tipo', x->>'tipo',
          'spoiler', (x->>'spoiler')::boolean,
          'pregunta', x->>'pregunta',
          'brillo', x->'brillo',
          'encontrado', ok.si IS NOT NULL
        )
        || CASE WHEN ok.si IS NOT NULL THEN jsonb_build_object(
             'parrafo', (x->'respuestas'->0->>'parrafo')::int,
             'cita', substr(v_c.datos->'textos'->>((x->>'cap') || ':' || (x->'respuestas'->0->>'parrafo')),
                            (x->'respuestas'->0->>'inicio')::int,
                            (x->'respuestas'->0->>'fin')::int - (x->'respuestas'->0->>'inicio')::int + 1),
             'porque', x->>'porque')
           ELSE '{}'::jsonb END
        ORDER BY (x->>'cap')::int, o)
      FROM jsonb_array_elements(v_c.datos->'tesoros') WITH ORDINALITY t(x, o)
      LEFT JOIN LATERAL (
        SELECT true AS si FROM mapa_jugadas j
        WHERE j.user_id = p_user AND j.libro_id = p_libro AND j.tesoro = x->>'id' AND j.acierto
      ) ok ON true), '[]'::jsonb)
  );
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Lo que llama el alumno
-- ═════════════════════════════════════════════════════════════

-- Las fichas del libro, con cuáles ya encontró.
CREATE OR REPLACE FUNCTION public.mapa_libro(p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _mapa_estado(auth.uid(), p_libro);
END;
$fn$;


-- Subrayó un trozo de un párrafo y eligió «Mapa del tesoro».
-- Devuelve resultado: 'tesoro' | 'ya_encontrado' | 'cerca' | 'no'.
-- Errores sin cobrar: sesión, libro sin mapa, menos de 3 palabras, capítulo
-- sin tesoros pendientes, sin ovillos, texto que no está en ese párrafo.
CREATE OR REPLACE FUNCTION public.mapa_subrayar(p_libro uuid, p_capitulo int, p_parrafo int, p_texto text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user     uuid := auth.uid();
  v_c        mapa_contenido%ROWTYPE;
  v_sel      text := _mapa_norm(p_texto);
  v_texto    text;
  v_pos      int;
  v_len      int;
  v_hallado  jsonb;
  v_repetido boolean := false;
  v_brillo   jsonb;
  v_cerca    boolean;
  v_x        jsonb;
  v_r        jsonb;
  v_comun    int;
  v_pend     int := 0;
  v_j        uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_c FROM mapa_contenido WHERE libro_id = p_libro;
  IF v_c.libro_id IS NULL THEN
    RAISE EXCEPTION 'Este libro no tiene mapa del tesoro.';
  END IF;
  IF array_length(regexp_split_to_array(v_sel, ' '), 1) < 3 OR v_sel = '' THEN
    RAISE EXCEPTION 'Subraya al menos tres palabras.';
  END IF;
  IF length(v_sel) > 3000 THEN
    RAISE EXCEPTION 'Eso es demasiado texto.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || p_libro));

  v_len   := length(v_sel);
  v_texto := v_c.datos->'textos'->>(p_capitulo || ':' || p_parrafo);
  IF v_texto IS NOT NULL THEN
    v_pos := strpos(v_texto, v_sel);
    IF v_pos = 0 THEN
      -- Es un párrafo con respuestas pero lo subrayado no está en él: fallo
      -- nuestro (normalización) o del navegador. No se cobra.
      RAISE EXCEPTION 'texto_no_coincide';
    END IF;
  END IF;

  -- Recorre los tesoros del capítulo: pendientes, encontrado, brillo, cerca.
  FOR v_x IN
    SELECT x FROM jsonb_array_elements(v_c.datos->'tesoros') x WHERE (x->>'cap')::int = p_capitulo
  LOOP
    IF EXISTS (SELECT 1 FROM mapa_jugadas j WHERE j.user_id = v_user AND j.libro_id = p_libro
               AND j.tesoro = v_x->>'id' AND j.acierto) THEN
      IF v_pos > 0 THEN
        FOR v_r IN SELECT * FROM jsonb_array_elements(v_x->'respuestas') LOOP
          IF (v_r->>'parrafo')::int = p_parrafo THEN
            v_comun := least(v_pos + v_len - 1, (v_r->>'fin')::int) - greatest(v_pos, (v_r->>'inicio')::int) + 1;
            IF v_comun * 2 > v_len THEN v_repetido := true; END IF;
          END IF;
        END LOOP;
      END IF;
      CONTINUE;
    END IF;

    v_pend := v_pend + 1;
    IF p_parrafo BETWEEN (v_x->'brillo'->>0)::int AND (v_x->'brillo'->>1)::int THEN
      v_brillo := v_x;
    END IF;
    FOR v_r IN SELECT * FROM jsonb_array_elements(v_x->'respuestas') LOOP
      IF abs((v_r->>'parrafo')::int - p_parrafo) <= 1 THEN v_cerca := true; END IF;
      IF v_hallado IS NULL AND v_pos > 0 AND (v_r->>'parrafo')::int = p_parrafo THEN
        v_comun := least(v_pos + v_len - 1, (v_r->>'fin')::int) - greatest(v_pos, (v_r->>'inicio')::int) + 1;
        IF v_comun * 2 > v_len THEN v_hallado := v_x; END IF;
      END IF;
    END LOOP;
  END LOOP;

  IF v_hallado IS NULL AND v_repetido THEN
    RETURN jsonb_build_object('resultado', 'ya_encontrado', 'ovillos', 0,
                              'estado', _mapa_estado(v_user, p_libro));
  END IF;
  IF v_pend = 0 THEN
    RAISE EXCEPTION 'En este capítulo no quedan tesoros.';
  END IF;
  IF _ovillos_saldo(v_user, p_libro) < 1 THEN
    RAISE EXCEPTION 'No te alcanzan los ovillos.';
  END IF;

  IF v_hallado IS NOT NULL THEN
    INSERT INTO mapa_jugadas (user_id, libro_id, version, capitulo, parrafo, tesoro, tipo, acierto)
    VALUES (v_user, p_libro, v_c.version, p_capitulo, p_parrafo, v_hallado->>'id', v_hallado->>'tipo', true)
    RETURNING id INTO v_j;
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
    VALUES (v_user, p_libro, 1, 'tesoro', v_j, jsonb_build_object('tesoro', v_hallado->>'id'));
    RETURN jsonb_build_object('resultado', 'tesoro', 'tesoro', v_hallado->>'id', 'ovillos', 1,
                              'estado', _mapa_estado(v_user, p_libro));
  END IF;

  v_cerca := coalesce(v_cerca, false);
  INSERT INTO mapa_jugadas (user_id, libro_id, version, capitulo, parrafo, tesoro, tipo, acierto, cerca)
  VALUES (v_user, p_libro, v_c.version, p_capitulo, p_parrafo, v_brillo->>'id', v_brillo->>'tipo', false, v_cerca)
  RETURNING id INTO v_j;
  INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
  VALUES (v_user, p_libro, -1, 'tesoro', v_j, jsonb_build_object('tesoro', v_brillo->>'id', 'fallo', true));
  RETURN jsonb_build_object('resultado', CASE WHEN v_cerca THEN 'cerca' ELSE 'no' END, 'ovillos', -1,
                            'estado', _mapa_estado(v_user, p_libro));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._mapa_estado(uuid, uuid)              FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.mapa_libro(uuid)                      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mapa_subrayar(uuid, int, int, text)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mapa_libro(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.mapa_subrayar(uuid, int, int, text) TO authenticated;
