-- =============================================================
-- INMERSIA — Migración 089
-- Corazonadas: predicciones con ovillos en mitad de la lectura
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 087 (ovillos_movimientos y _ovillos_saldo).
--
-- QUÉ HAY (decisiones de Juan, 5–7 nov 2026; reglas en
-- Documentation/colegios/corazonadas-prompt.md)
--   · corazonadas_contenido: el juego de cada libro, una fila por libro con
--     el JSON ya comprobado. Lo sube cargar_corazonadas.py. Lleva las
--     respuestas: nadie lo lee directamente.
--   · corazonadas_jugadas: una fila por alumno y corazonada (jugada,
--     cobrada o perdida).
--   · Los ovillos van al libro de cuentas común (ovillos_movimientos,
--     motivo 'corazonada'): al jugar se descuenta lo apostado; al cobrar un
--     acierto se suma el doble.
--
-- REGLAS DEL JUEGO QUE APLICA LA BASE DE DATOS
--   · Se juegan 1, 2 o 3 ovillos, una sola vez por corazonada.
--   · Si el alumno llega a la página de la revelación sin haber jugado, la
--     pierde (corazonada_llegar). Tampoco se puede jugar si ya completó el
--     capítulo de la revelación.
--   · Las sorpresas pagan igual: el aviso del gato es cosa del navegador.
--
-- QUÉ LE LLEGA AL NAVEGADOR
--   Pregunta, contexto y opciones de todas (para pintar el chip donde toca).
--   La correcta, lo que pasó y las pistas de «así se podía saber» solo
--   cuando la cobra.
--
-- La vista del profe (Salón) llegará en otra migración.
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.corazonadas_contenido (
  libro_id       uuid        PRIMARY KEY REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL DEFAULT 1 CHECK (version >= 1),
  datos          jsonb       NOT NULL,
  actualizado_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.corazonadas_contenido IS
  'Corazonadas de cada libro (JSON compilado por cargar_corazonadas.py). Lleva las respuestas: solo lo leen las funciones corazonada*. Los ids no se cambian una vez publicado. Ver migración 089.';

-- Sin políticas: solo lo leen las funciones SECURITY DEFINER.
ALTER TABLE public.corazonadas_contenido ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.corazonadas_jugadas (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id     uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  version      int         NOT NULL,
  corazonada   text        NOT NULL,
  estado       text        NOT NULL CHECK (estado IN ('jugada', 'cobrada', 'perdida')),
  opcion       smallint    CHECK (opcion BETWEEN 0 AND 2),
  ovillos      smallint    CHECK (ovillos BETWEEN 1 AND 3),
  acierto      boolean,
  opcion_tipo  text        CHECK (opcion_tipo IN ('por_encima', 'esperada', 'otra')),
  capitulo     int         NOT NULL,          -- capitulos_completados al jugar (o al perderla)
  created_at   timestamptz NOT NULL DEFAULT now(),
  cobrada_at   timestamptz,
  UNIQUE (user_id, libro_id, corazonada),
  CHECK ((estado = 'perdida') = (opcion IS NULL)),
  CHECK ((opcion IS NULL) = (ovillos IS NULL)),
  CHECK ((estado = 'cobrada') = (acierto IS NOT NULL))
);

COMMENT ON TABLE public.corazonadas_jugadas IS
  'Una fila por alumno y corazonada: jugada (apostó), cobrada (vio si acertó) o perdida (llegó a la revelación sin jugar). Solo escriben las funciones corazonada_*. Ver migración 089.';

ALTER TABLE public.corazonadas_jugadas ENABLE ROW LEVEL SECURITY;


-- ═════════════════════════════════════════════════════════════
-- 2. Estado de un alumno (uso interno)
-- ═════════════════════════════════════════════════════════════
-- Formato de corazonadas_contenido.datos (lo compila cargar_corazonadas.py):
--   corazonadas: [{id, clase, pregunta, contexto, resultado,
--                  chip: {cap, parrafo}, rev: {cap, parrafo},
--                  opciones[3], correcta, tipos[3], pistas[]}]
--   parrafo = parrafos.numero dentro del capítulo.

CREATE OR REPLACE FUNCTION public._corazonadas_estado(p_user uuid, p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d     jsonb;
  v_ver int;
  v_cc  int;
BEGIN
  SELECT datos, version INTO d, v_ver FROM corazonadas_contenido WHERE libro_id = p_libro;
  IF d IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(max(capitulos_completados), 0) INTO v_cc
  FROM progreso_lectura WHERE user_id = p_user AND libro_id = p_libro;

  RETURN jsonb_build_object(
    'version', v_ver,
    'saldo', _ovillos_saldo(p_user, p_libro),
    'corazonadas', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', x->>'id',
          'sorpresa', x->>'clase' = 'sorpresa',
          'pregunta', x->>'pregunta',
          'contexto', x->>'contexto',
          'opciones', x->'opciones',
          'chip', x->'chip',
          'rev', x->'rev',
          -- Sin fila y con el capítulo de la revelación completado: ya no se puede jugar.
          'estado', coalesce(j.estado,
                             CASE WHEN v_cc >= (x->'rev'->>'cap')::int THEN 'perdida' END),
          'opcion', j.opcion,
          'ovillos', j.ovillos
        )
        -- Lo que dice si acertó, solo cuando ya la cobró.
        || CASE WHEN j.estado = 'cobrada' THEN jsonb_build_object(
             'acierto', j.acierto,
             'correcta', (x->>'correcta')::int,
             'resultado', x->>'resultado',
             'pistas', coalesce(x->'pistas', '[]'::jsonb))
           ELSE '{}'::jsonb END
        ORDER BY o)
      FROM jsonb_array_elements(d->'corazonadas') WITH ORDINALITY t(x, o)
      LEFT JOIN corazonadas_jugadas j
        ON j.user_id = p_user AND j.libro_id = p_libro AND j.corazonada = x->>'id'), '[]'::jsonb)
  );
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Lo que llama el alumno
-- ═════════════════════════════════════════════════════════════

-- Las corazonadas del libro, con el estado de cada una.
CREATE OR REPLACE FUNCTION public.corazonadas_libro(p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _corazonadas_estado(auth.uid(), p_libro);
END;
$fn$;


-- Jugarse 1, 2 o 3 ovillos a una opción (0, 1 o 2).
CREATE OR REPLACE FUNCTION public.corazonada_jugar(p_libro uuid, p_corazonada text, p_opcion int, p_ovillos int)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  d      jsonb;
  v_ver  int;
  v_cz   jsonb;
  v_cc   int;
  v_id   uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  -- Una jugada a la vez por alumno y libro (dos pestañas no gastan dos veces el mismo ovillo).
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || p_libro));

  SELECT datos, version INTO d, v_ver FROM corazonadas_contenido WHERE libro_id = p_libro;
  SELECT x INTO v_cz FROM jsonb_array_elements(d->'corazonadas') x WHERE x->>'id' = p_corazonada;
  IF v_cz IS NULL THEN
    RAISE EXCEPTION 'Esa corazonada no existe.';
  END IF;
  IF p_opcion IS NULL OR p_opcion NOT BETWEEN 0 AND 2 THEN
    RAISE EXCEPTION 'Esa opción no existe.';
  END IF;
  IF p_ovillos IS NULL OR p_ovillos NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Se juegan 1, 2 o 3 ovillos.';
  END IF;
  IF EXISTS (SELECT 1 FROM corazonadas_jugadas
             WHERE user_id = v_user AND libro_id = p_libro AND corazonada = p_corazonada) THEN
    RAISE EXCEPTION 'Esta corazonada ya está cerrada.';
  END IF;

  SELECT coalesce(max(capitulos_completados), 0) INTO v_cc
  FROM progreso_lectura WHERE user_id = v_user AND libro_id = p_libro;
  IF v_cc >= (v_cz->'rev'->>'cap')::int THEN
    RAISE EXCEPTION 'El libro ya lo contó.';
  END IF;
  IF _ovillos_saldo(v_user, p_libro) < p_ovillos THEN
    RAISE EXCEPTION 'No te alcanzan los ovillos.';
  END IF;

  INSERT INTO corazonadas_jugadas (user_id, libro_id, version, corazonada, estado, opcion, ovillos, capitulo)
  VALUES (v_user, p_libro, v_ver, p_corazonada, 'jugada', p_opcion, p_ovillos, v_cc)
  RETURNING id INTO v_id;

  INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
  VALUES (v_user, p_libro, -p_ovillos, 'corazonada', v_id, jsonb_build_object('corazonada', p_corazonada));

  RETURN jsonb_build_object('estado', _corazonadas_estado(v_user, p_libro));
END;
$fn$;


-- El alumno llegó a la página de la revelación: si no había jugado, la pierde.
CREATE OR REPLACE FUNCTION public.corazonada_llegar(p_libro uuid, p_corazonada text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_ver  int;
  v_cc   int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  SELECT version INTO v_ver FROM corazonadas_contenido c
  WHERE c.libro_id = p_libro
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.datos->'corazonadas') x WHERE x->>'id' = p_corazonada);
  IF v_ver IS NULL THEN
    RAISE EXCEPTION 'Esa corazonada no existe.';
  END IF;

  SELECT coalesce(max(capitulos_completados), 0) INTO v_cc
  FROM progreso_lectura WHERE user_id = v_user AND libro_id = p_libro;

  INSERT INTO corazonadas_jugadas (user_id, libro_id, version, corazonada, estado, capitulo)
  VALUES (v_user, p_libro, v_ver, p_corazonada, 'perdida', v_cc)
  ON CONFLICT (user_id, libro_id, corazonada) DO NOTHING;

  RETURN jsonb_build_object('estado', _corazonadas_estado(v_user, p_libro));
END;
$fn$;


-- Tocar el corazón de la revelación: ¿acertó? Si acertó, cobra el doble.
CREATE OR REPLACE FUNCTION public.corazonada_cobrar(p_libro uuid, p_corazonada text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_j    corazonadas_jugadas%ROWTYPE;
  v_cz   jsonb;
  v_ok   boolean;
  v_premio int := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || p_libro));

  SELECT * INTO v_j FROM corazonadas_jugadas
  WHERE user_id = v_user AND libro_id = p_libro AND corazonada = p_corazonada FOR UPDATE;
  IF v_j.id IS NULL OR v_j.estado <> 'jugada' THEN
    RAISE EXCEPTION 'No hay nada que cobrar en esta corazonada.';
  END IF;

  SELECT x INTO v_cz
  FROM corazonadas_contenido c, jsonb_array_elements(c.datos->'corazonadas') x
  WHERE c.libro_id = p_libro AND x->>'id' = p_corazonada;

  v_ok := v_j.opcion = (v_cz->>'correcta')::int;
  UPDATE corazonadas_jugadas
  SET estado = 'cobrada', acierto = v_ok, cobrada_at = now(),
      opcion_tipo = CASE WHEN v_ok THEN NULL ELSE v_cz->'tipos'->>v_j.opcion END
  WHERE id = v_j.id;

  IF v_ok THEN
    v_premio := 2 * v_j.ovillos;
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
    VALUES (v_user, p_libro, v_premio, 'corazonada', v_j.id, jsonb_build_object('corazonada', p_corazonada));
  END IF;

  RETURN jsonb_build_object('acierto', v_ok, 'premio', v_premio,
                            'estado', _corazonadas_estado(v_user, p_libro));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._corazonadas_estado(uuid, uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.corazonadas_libro(uuid)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.corazonada_jugar(uuid, text, int, int)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.corazonada_llegar(uuid, text)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.corazonada_cobrar(uuid, text)              FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corazonadas_libro(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.corazonada_jugar(uuid, text, int, int)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.corazonada_llegar(uuid, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.corazonada_cobrar(uuid, text)           TO authenticated;
