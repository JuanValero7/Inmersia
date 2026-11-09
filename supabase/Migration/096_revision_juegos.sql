-- =============================================================
-- INMERSIA — Migración 096
-- Revisión del 9 nov 2026: la IA solo para quien lee el libro,
-- los juegos en «Descargar mis datos» y un cerrojo de la Mesa
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere de la 087 a la 095.
--
-- QUÉ CAMBIA
--   1. El concurso y el desafío llaman a Gemini solo si el alumno tiene
--      el libro en su biblioteca y llegó al capítulo de la frase (o del
--      desafío). Antes cualquiera con cuenta podía pedir evaluaciones de
--      cualquier libro y gastarse el tope diario de 1.000, que es de
--      todas las aulas. Mientras se lee el capítulo de la frase, los
--      capítulos completados son uno menos: por eso «cap − 1».
--      Las Edge Functions no cambian: el error nuevo ('no_llego') cae en
--      su 409 de siempre.
--   2. mis_datos_juegos(): lo que guardan los juegos del propio usuario,
--      para «Descargar mis datos» (src/lib/misDatos.js). Esas tablas no
--      se leen desde el navegador, por eso va por función. No incluye
--      quién del colegio puso la nota o entregó el vale (datos de otra
--      persona), sí la nota, el comentario y el resumen del desafío.
--   3. anderson_jugar toma también el cerrojo de saldo de los demás
--      juegos: jugar la Mesa y una corazonada a la vez (dos pestañas) ya
--      no deja el saldo en −1.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- Orden en producción: primero esta migración, después el deploy del
-- código (el botón de descarga llama a mis_datos_juegos).
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. ¿Llegó a ese capítulo con el libro en su biblioteca?
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public._llego_al_capitulo(p_user uuid, p_libro uuid, p_cap int)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (SELECT 1 FROM bibliotecas_usuarios WHERE user_id = p_user AND libro_id = p_libro)
     AND coalesce((SELECT max(capitulos_completados) FROM progreso_lectura
                   WHERE user_id = p_user AND libro_id = p_libro), 0) >= coalesce(p_cap, 1) - 1;
$fn$;

REVOKE ALL ON FUNCTION public._llego_al_capitulo(uuid, uuid, int) FROM PUBLIC, anon, authenticated;


-- ═════════════════════════════════════════════════════════════
-- 2. Concurso y desafío: las mismas de la 090 y la 092, con la
--    comprobación del punto 1 (marcada «096»)
-- ═════════════════════════════════════════════════════════════

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
  -- 096: solo con el libro en la biblioteca y llegando al capítulo de la frase.
  IF NOT _llego_al_capitulo(p_user, p_libro, (v_x->>'cap')::int) THEN
    RAISE EXCEPTION 'no_llego';
  END IF;
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
  -- 096: solo con el libro en la biblioteca y llegando al capítulo del desafío.
  IF NOT _llego_al_capitulo(p_user, p_libro, (v_q->>'tras_capitulo')::int) THEN
    RAISE EXCEPTION 'no_llego';
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


-- ═════════════════════════════════════════════════════════════
-- 3. La Mesa: la misma de la 087, con el cerrojo de saldo (marcado «096»)
-- ═════════════════════════════════════════════════════════════

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
  -- 096: el mismo cerrojo de saldo que los demás juegos (corazonadas, concurso,
  -- mapa, tienda): jugar la Mesa y otra cosa a la vez no deja el saldo en negativo.
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || p_libro));

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


-- ═════════════════════════════════════════════════════════════
-- 4. Lo de los juegos para «Descargar mis datos»
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
    'expedientes_comprados', (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM expedientes_compras t WHERE t.user_id = v_user),
    -- Sin quién del colegio lo entregó.
    'vales_canjeados',      (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - 'resuelto_por' ORDER BY t.created_at), '[]'::jsonb)
                             FROM recompensas_canjes t WHERE t.user_id = v_user),
    -- Solo la hora: cuántas veces se le pidió a la IA (para los topes diarios).
    'llamadas_ia_concurso', (SELECT coalesce(jsonb_agg(t.created_at ORDER BY t.created_at), '[]'::jsonb)
                             FROM concurso_llamadas t WHERE t.user_id = v_user),
    'llamadas_ia_desafio',  (SELECT coalesce(jsonb_agg(t.created_at ORDER BY t.created_at), '[]'::jsonb)
                             FROM desafio_llamadas t WHERE t.user_id = v_user)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.mis_datos_juegos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_datos_juegos() TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- 5. Permisos (CREATE OR REPLACE los conserva; se repiten por si acaso)
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public.concurso_reservar(uuid, uuid, text)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.desafio_reservar(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.concurso_reservar(uuid, uuid, text)      TO service_role;
GRANT EXECUTE ON FUNCTION public.desafio_reservar(uuid, uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.anderson_jugar(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anderson_jugar(uuid, text, text[]) TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- PRUEBAS (en el SQL Editor, como un alumno con sesión)
-- ═════════════════════════════════════════════════════════════
--   1. Un alumno sin el libro en la biblioteca pide el concurso → la
--      Edge Function contesta 409 (antes llamaba a Gemini).
--   2. Un alumno en el cap. 2 pide una frase del cap. 5 → 409.
--   3. Un alumno en el cap. 4 (3 completados) pide una frase del cap. 4 → OK.
--   4. SELECT mis_datos_juegos(); → objeto con las 10 listas, solo las suyas.
