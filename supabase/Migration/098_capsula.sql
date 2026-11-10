-- =============================================================
-- INMERSIA — Migración 098
-- La cápsula del tiempo (primer juego de no ficción) y la base común
-- de los juegos de no ficción
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere de la 093 a la 097 (juegos encendidos, vista del profe,
-- mis_datos_juegos).
--
-- QUÉ HAY (decisiones de Juan, 10 nov 2026; reglas de las preguntas en
-- Documentation/colegios/capsula-prompt.md)
--   · Al abrir el libro (antes de terminar el capítulo 1) el gato propone
--     guardar lo que piensas hoy: 4 preguntas abiertas que se responden en
--     texto. Al responderlas se sella la cápsula con la fecha.
--   · Al terminar el libro se abre: respondes lo mismo SIN ver lo de antes y
--     luego ves las dos respuestas lado a lado.
--   · Sin IA, sin ovillos, sin respuestas buenas ni malas, sin conteos.
--   · El profe solo LEE las dos respuestas de cada alumno (el alumno lo sabe:
--     «Lo lee tu profe» si está en un aula que lee ese libro).
--
--   · capsula_contenido: las preguntas de cada libro (una fila por libro).
--     Lo sube cargar_capsula.py. Nadie lo lee directamente.
--   · capsula_respuestas: una fila por alumno y libro. Guarda una copia de las
--     preguntas al sellar: si después se cambian, la cápsula sellada no se rompe.
--
-- BASE COMÚN DE NO FICCIÓN
--   · Un libro es de no ficción si libros.es_ficcion = false (ya existía).
--     Los juegos salen solo si el libro tiene contenido cargado.
--   · Interruptores nuevos (preferencias_usuario.juegos / comunidades.juegos):
--     capsula e hilo encendidos; falsificador y explicaselo apagados, también
--     en las aulas (el profe los enciende). Los 5 de ficción no cambian.
--
-- QUIÉN LLAMA A QUÉ (el navegador)
--   Alumno: capsula_libro, capsula_sellar, capsula_abrir.
--   Profe:  capsula_aula.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Interruptores de los juegos de no ficción
-- ═════════════════════════════════════════════════════════════

-- Fuera del aula (el Perfil). Misma función que la 093, con los 4 nuevos.
CREATE OR REPLACE FUNCTION public._juegos_por_defecto()
RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT '{"mesa": true, "corazonadas": true, "mapa": true, "concurso": false, "desafio": false,
           "capsula": true, "hilo": true, "falsificador": false, "explicaselo": false}'::jsonb;
$fn$;

-- En un aula, si el profe no eligió nada: los 5 de ficción encendidos (como
-- en la 093), cápsula e hilo encendidos, falsificador y explícaselo apagados.
CREATE OR REPLACE FUNCTION public._juegos_aula_por_defecto()
RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT '{"mesa": true, "corazonadas": true, "mapa": true, "concurso": true, "desafio": true,
           "capsula": true, "hilo": true, "falsificador": false, "explicaselo": false}'::jsonb;
$fn$;

-- La de la 093, con la base del aula de arriba.
CREATE OR REPLACE FUNCTION public.juegos_libro(p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_aula jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;

  -- Si está en más de un aula con ese libro (raro), manda la primera a la que entró.
  SELECT co.juegos INTO v_aula
  FROM comunidad_miembros cm JOIN comunidades co ON co.id = cm.comunidad_id
  WHERE cm.user_id = v_user AND co.colegio_id IS NOT NULL AND co.libro_id = p_libro
  ORDER BY cm.unido_at
  LIMIT 1;

  IF FOUND THEN
    RETURN _juegos_mezclar(_juegos_aula_por_defecto(), v_aula) || jsonb_build_object('fuente', 'aula');
  END IF;

  RETURN _juegos_mezclar(_juegos_por_defecto(),
                         coalesce((SELECT juegos FROM preferencias_usuario WHERE user_id = v_user), '{}'::jsonb))
         || jsonb_build_object('fuente', 'perfil');
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 2. Tablas de la cápsula
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.capsula_contenido (
  libro_id       uuid        PRIMARY KEY REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL DEFAULT 1 CHECK (version >= 1),
  datos          jsonb       NOT NULL,          -- {preguntas: [{id, texto}]}
  actualizado_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(datos->'preguntas') = 'array' AND jsonb_array_length(datos->'preguntas') BETWEEN 1 AND 8)
);
COMMENT ON TABLE public.capsula_contenido IS
  'Preguntas de la cápsula del tiempo de cada libro (las sube cargar_capsula.py). Solo las leen las funciones capsula_*. Ver migración 098.';
-- Sin políticas: solo lo leen las funciones SECURITY DEFINER.
ALTER TABLE public.capsula_contenido ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.capsula_respuestas (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id   uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  preguntas  jsonb       NOT NULL,              -- copia de las preguntas al sellar: [{id, texto}]
  antes      jsonb       NOT NULL,              -- [texto], en el orden de las preguntas
  sellada_at timestamptz NOT NULL DEFAULT now(),
  ahora      jsonb,                             -- [texto]; null hasta terminar el libro
  abierta_at timestamptz,
  PRIMARY KEY (user_id, libro_id),
  CHECK ((ahora IS NULL) = (abierta_at IS NULL)),
  CHECK (jsonb_typeof(antes) = 'array' AND jsonb_array_length(antes) = jsonb_array_length(preguntas)),
  CHECK (ahora IS NULL OR (jsonb_typeof(ahora) = 'array' AND jsonb_array_length(ahora) = jsonb_array_length(preguntas)))
);
COMMENT ON TABLE public.capsula_respuestas IS
  'Cápsula del tiempo: lo que el alumno respondió al empezar el libro (antes) y al terminarlo (ahora). Guarda el texto: lo lee su profe. Solo escriben las funciones capsula_*. Ver migración 098.';
ALTER TABLE public.capsula_respuestas ENABLE ROW LEVEL SECURITY;


-- ═════════════════════════════════════════════════════════════
-- 3. Uso interno
-- ═════════════════════════════════════════════════════════════

-- Respuestas válidas: tantas como preguntas, cada una de 3 a 600 caracteres
-- (sin contar espacios de los bordes). Devuelve el array limpio o lanza
-- 'respuestas_incompletas' / 'respuesta_larga'.
CREATE OR REPLACE FUNCTION public._capsula_limpiar(p_respuestas text[], p_n int)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_t   text;
BEGIN
  IF p_respuestas IS NULL OR coalesce(array_length(p_respuestas, 1), 0) <> p_n THEN
    RAISE EXCEPTION 'respuestas_incompletas';
  END IF;
  FOREACH v_t IN ARRAY p_respuestas LOOP
    v_t := btrim(coalesce(v_t, ''));
    IF char_length(v_t) < 3 THEN RAISE EXCEPTION 'respuestas_incompletas'; END IF;
    IF char_length(v_t) > 600 THEN RAISE EXCEPTION 'respuesta_larga'; END IF;
    v_out := v_out || to_jsonb(v_t);
  END LOOP;
  RETURN v_out;
END;
$fn$;

-- Lo que ve el alumno de su cápsula. Lo de antes SOLO sale cuando ya
-- respondió lo de ahora (si no, podría copiarse a sí mismo).
--   null si el libro no tiene cápsula ni la selló.
--   {preguntas: [{id, texto}], estado: 'nueva'|'sellada'|'abierta',
--    sellada_at, abierta_at, puede_sellar, con_profe, antes?, ahora?}
CREATE OR REPLACE FUNCTION public._capsula_estado(p_user uuid, p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_c capsula_contenido%ROWTYPE;
  v_r capsula_respuestas%ROWTYPE;
BEGIN
  SELECT * INTO v_c FROM capsula_contenido WHERE libro_id = p_libro;
  SELECT * INTO v_r FROM capsula_respuestas WHERE user_id = p_user AND libro_id = p_libro;
  IF v_c.libro_id IS NULL AND v_r.user_id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'preguntas', coalesce(v_r.preguntas, v_c.datos->'preguntas'),
    'estado', CASE WHEN v_r.user_id IS NULL THEN 'nueva' WHEN v_r.abierta_at IS NULL THEN 'sellada' ELSE 'abierta' END,
    'sellada_at', v_r.sellada_at,
    'abierta_at', v_r.abierta_at,
    -- Solo se sella antes de terminar el capítulo 1: después ya leyó.
    'puede_sellar', v_r.user_id IS NULL AND v_c.libro_id IS NOT NULL
                    AND coalesce((SELECT capitulos_completados FROM progreso_lectura
                                  WHERE user_id = p_user AND libro_id = p_libro), 0) = 0,
    'con_profe', EXISTS (SELECT 1 FROM comunidad_miembros cm JOIN comunidades co ON co.id = cm.comunidad_id
                         WHERE cm.user_id = p_user AND co.colegio_id IS NOT NULL AND co.libro_id = p_libro)
  ) || CASE WHEN v_r.abierta_at IS NOT NULL
            THEN jsonb_build_object('antes', v_r.antes, 'ahora', v_r.ahora)
            ELSE '{}'::jsonb END;
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. Lo que llama el alumno
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.capsula_libro(p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _capsula_estado(auth.uid(), p_libro);
END;
$fn$;


-- Sellar: guarda lo de antes con la fecha. Errores con mensaje fijo:
--   'ya_sellada', 'ya_empezaste' (terminó el capítulo 1), 'respuestas_incompletas', 'respuesta_larga'.
CREATE OR REPLACE FUNCTION public.capsula_sellar(p_libro uuid, p_respuestas text[])
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_preg jsonb;
  v_resp jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('capsula:' || v_user || ':' || p_libro));

  SELECT datos->'preguntas' INTO v_preg FROM capsula_contenido WHERE libro_id = p_libro;
  IF v_preg IS NULL THEN
    RAISE EXCEPTION 'Este libro no tiene cápsula.';
  END IF;
  IF EXISTS (SELECT 1 FROM capsula_respuestas WHERE user_id = v_user AND libro_id = p_libro) THEN
    RAISE EXCEPTION 'ya_sellada';
  END IF;
  IF coalesce((SELECT capitulos_completados FROM progreso_lectura
               WHERE user_id = v_user AND libro_id = p_libro), 0) > 0 THEN
    RAISE EXCEPTION 'ya_empezaste';
  END IF;

  v_resp := _capsula_limpiar(p_respuestas, jsonb_array_length(v_preg));
  INSERT INTO capsula_respuestas (user_id, libro_id, preguntas, antes)
  VALUES (v_user, p_libro, v_preg, v_resp);

  RETURN _capsula_estado(v_user, p_libro);
END;
$fn$;


-- Abrir: guarda lo de ahora y, ya con las dos, devuelve antes y ahora.
--   'sin_sellar', 'ya_abierta', 'respuestas_incompletas', 'respuesta_larga'.
-- Que haya terminado el libro lo controla el lector (salta al pasar del
-- último capítulo); aquí no se exige, como en el desafío.
CREATE OR REPLACE FUNCTION public.capsula_abrir(p_libro uuid, p_respuestas text[])
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_r    capsula_respuestas%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_r FROM capsula_respuestas WHERE user_id = v_user AND libro_id = p_libro FOR UPDATE;
  IF v_r.user_id IS NULL THEN RAISE EXCEPTION 'sin_sellar'; END IF;
  IF v_r.abierta_at IS NOT NULL THEN RAISE EXCEPTION 'ya_abierta'; END IF;

  UPDATE capsula_respuestas
  SET ahora = _capsula_limpiar(p_respuestas, jsonb_array_length(v_r.preguntas)), abierta_at = now()
  WHERE user_id = v_user AND libro_id = p_libro;

  RETURN _capsula_estado(v_user, p_libro);
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 5. Lo que llama el profe
-- ═════════════════════════════════════════════════════════════
-- Las cápsulas de los alumnos del aula en el libro que leen. Solo leer:
-- nada de conteos ni marcas. Lo de antes se ve desde que la sellan.
--   {libro_id, encendida, preguntas: [{id, texto}] | null,
--    respuestas: {user_id: {preguntas, antes, ahora, sellada_at, abierta_at}}}
CREATE OR REPLACE FUNCTION public.capsula_aula(p_aula uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_libro uuid;
BEGIN
  PERFORM _profe_de_aula(p_aula);
  SELECT libro_id INTO v_libro FROM _meta_aula(p_aula, 'UTC');
  IF v_libro IS NULL THEN
    RETURN jsonb_build_object('libro_id', NULL);
  END IF;

  RETURN jsonb_build_object(
    'libro_id', v_libro,
    'encendida', (_juegos_mezclar(_juegos_aula_por_defecto(),
                                  (SELECT juegos FROM comunidades WHERE id = p_aula))->>'capsula')::boolean,
    'preguntas', (SELECT datos->'preguntas' FROM capsula_contenido WHERE libro_id = v_libro),
    'respuestas', coalesce((
      SELECT jsonb_object_agg(r.user_id, jsonb_build_object(
               'preguntas', r.preguntas, 'antes', r.antes, 'ahora', r.ahora,
               'sellada_at', r.sellada_at, 'abierta_at', r.abierta_at))
      FROM capsula_respuestas r
      JOIN comunidad_miembros cm ON cm.user_id = r.user_id AND cm.comunidad_id = p_aula AND cm.rol = 'miembro'
      WHERE r.libro_id = v_libro), '{}'::jsonb));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 6. «Descargar mis datos»: la de la 097 con la cápsula
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

REVOKE ALL ON FUNCTION public._juegos_aula_por_defecto()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._juegos_por_defecto()               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._capsula_limpiar(text[], int)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._capsula_estado(uuid, uuid)         FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.juegos_libro(uuid)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.capsula_libro(uuid)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.capsula_sellar(uuid, text[])        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.capsula_abrir(uuid, text[])         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.capsula_aula(uuid)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mis_datos_juegos()                  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.juegos_libro(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.capsula_libro(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.capsula_sellar(uuid, text[])     TO authenticated;
GRANT EXECUTE ON FUNCTION public.capsula_abrir(uuid, text[])      TO authenticated;
GRANT EXECUTE ON FUNCTION public.capsula_aula(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_datos_juegos()               TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- PRUEBAS (en el SQL Editor)
-- ═════════════════════════════════════════════════════════════
--   1. SELECT _juegos_por_defecto(); → 9 juegos; capsula e hilo true, falsificador y explicaselo false.
--   2. Con un libro cargado (cargar_capsula.py):
--      SELECT datos FROM capsula_contenido c JOIN libros l ON l.id = c.libro_id WHERE l.titulo ILIKE 'Del origen%';
--   3. Alumno: capsula_libro(libro) → estado 'nueva', puede_sellar true, sin 'antes'.
--      capsula_sellar(libro, ARRAY['…','…','…','…']) → 'sellada', sigue sin 'antes'.
--      capsula_abrir(libro, ARRAY[…]) → 'abierta', con 'antes' y 'ahora'.
--   4. Profe: capsula_aula(aula) → las respuestas de sus alumnos.
