-- =============================================================
-- INMERSIA — Migración 117
-- Rincón del escritor: editar El mapa del tesoro
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 091 (_mapa_norm) y la 114/116 (_libro_del_escritor,
-- _guardar_juego, _texto_juego, _ubicar_cita).
--
-- QUÉ HACE (Juan, 13 nov 2026)
--   · editar_mapa(libro, tesoros): lista ENTERA de tesoros, como Anderson/Hilo.
--     Por tesoro: pregunta, tipo (vista | escondido), porque (escondido),
--     spoiler y sus frases buenas (1 a 3; la primera es la principal: el
--     brillo va alrededor de ella).
--       · Frase que ya estaba: {parrafo, inicio, fin} tal cual (la base
--         comprueba que era de ese tesoro).
--       · Frase nueva: {cita}. Tiene que estar tal cual (con la misma
--         normalización del juego: rayas, comillas y espacios) UNA sola vez
--         en el capítulo del tesoro. La base pone párrafo y posición.
--     Tesoro nuevo: {nueva: true, id provisional, cap, …}. Se puede quitar
--     cualquiera.
--   · Reglas: ninguna frase es respuesta de dos tesoros; los brillos de un
--     mismo capítulo no se pisan (cada brillo = un tesoro, para el profe).
--   · Brillo (como cargar_mapa.py): 11 párrafos alrededor de la principal,
--     de 3 a 7 antes, elegido por el id. Si la principal no cambió, se deja
--     el que tenía. «textos» se rehace con los párrafos que tienen respuestas.
--   · _ubicar_cita (116) pasa a usar la normalización del mapa: así el aviso
--     al momento coincide con lo que acepta el juego.
--   · Original y «Volver al original»: los de la 114.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================

CREATE OR REPLACE FUNCTION public._ubicar_cita(p_libro uuid, p_cap int, p_cita text) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT p.numero
  FROM capitulos c JOIN parrafos p ON p.capitulo_id = c.id
  WHERE c.libro_id = p_libro AND c.numero = p_cap
    AND length(btrim(coalesce(p_cita, ''))) >= 10
    AND strpos(_mapa_norm(p.contenido), _mapa_norm(p_cita)) > 0
  ORDER BY p.numero
  LIMIT 1;
$fn$;
REVOKE ALL ON FUNCTION public._ubicar_cita(uuid, int, text) FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.editar_mapa(p_libro uuid, p_tesoros jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actual  jsonb;
  v_textos  jsonb := '{}'::jsonb;
  v_tes     jsonb := '[]'::jsonb;
  v_ids     text[] := '{}';
  v_maxcap  int;
  it        jsonb;
  ac        jsonb;
  r         jsonb;
  v_resp    jsonb;
  v_id      text;
  v_cap     int;
  v_cita    text;
  v_n       int;
  v_par     int;
  v_txt     text;
  v_pos     int;
  v_clave   text;
  v_princ   int;
  v_brillo  jsonb;
  v_pars    int[];
  v_i       int;
  b         int;
  v_desde   int;
  v_hasta   int;
  t1        jsonb;
  t2        jsonb;
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  SELECT datos INTO v_actual FROM mapa_contenido WHERE libro_id = p_libro;
  IF v_actual IS NULL THEN
    RAISE EXCEPTION 'Este libro todavía no tiene El mapa del tesoro.' USING ERRCODE = 'P0002', HINT = 'formato';
  END IF;
  IF jsonb_typeof(p_tesoros) IS DISTINCT FROM 'array' OR jsonb_array_length(p_tesoros) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Deja al menos un tesoro.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  SELECT max(numero) INTO v_maxcap FROM capitulos WHERE libro_id = p_libro;

  FOR it IN SELECT * FROM jsonb_array_elements(p_tesoros) LOOP
    -- El tesoro: el que ya estaba o uno nuevo.
    IF coalesce((it ->> 'nueva')::boolean, false) THEN
      IF jsonb_typeof(it -> 'cap') IS DISTINCT FROM 'number' OR (it ->> 'cap')::int NOT BETWEEN 1 AND v_maxcap THEN
        RAISE EXCEPTION 'Un tesoro nuevo necesita su capítulo.' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_id := 't' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
      ac := jsonb_build_object('id', v_id, 'cap', (it ->> 'cap')::int, 'dificultad', 2, 'clave', NULL, 'brillo', NULL, 'respuestas', '[]'::jsonb);
    ELSE
      SELECT x INTO ac FROM jsonb_array_elements(v_actual -> 'tesoros') x WHERE x ->> 'id' = it ->> 'id';
      IF ac IS NULL OR (ac ->> 'id') = ANY (v_ids) THEN
        RAISE EXCEPTION 'Un tesoro ya no está o está repetido. Recarga la página.' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_id := ac ->> 'id';
    END IF;
    v_ids := v_ids || v_id;
    v_cap := (ac ->> 'cap')::int;

    -- Textos.
    IF _texto_juego(it -> 'pregunta', 200) IS NULL OR coalesce(it ->> 'tipo', '') NOT IN ('vista', 'escondido')
       OR jsonb_typeof(it -> 'spoiler') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Revisa el tesoro «%»: la pregunta (hasta 200 letras) no puede quedar vacía.', left(coalesce(it ->> 'pregunta', ''), 50)
        USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    IF it ->> 'tipo' = 'escondido' AND _texto_juego(it -> 'porque', 300) IS NULL THEN
      RAISE EXCEPTION 'El tesoro escondido «%» necesita su «porque» (lo que dice el gato al encontrarlo; hasta 300 letras).',
        left(it ->> 'pregunta', 50) USING ERRCODE = '22023', HINT = 'formato';
    END IF;

    -- Frases buenas.
    IF jsonb_typeof(it -> 'respuestas') IS DISTINCT FROM 'array' OR jsonb_array_length(it -> 'respuestas') NOT BETWEEN 1 AND 3 THEN
      RAISE EXCEPTION 'El tesoro «%» lleva de 1 a 3 frases buenas.', left(it ->> 'pregunta', 50) USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_resp := '[]'::jsonb;
    FOR r IN SELECT * FROM jsonb_array_elements(it -> 'respuestas') LOOP
      IF r ? 'cita' THEN
        v_cita := _mapa_norm(r ->> 'cita');
        IF array_length(regexp_split_to_array(v_cita, ' '), 1) < 3 OR length(v_cita) > 1500 THEN
          RAISE EXCEPTION 'Una frase buena tiene al menos 3 palabras (y no es un párrafo entero).' USING ERRCODE = '22023', HINT = 'formato';
        END IF;
        SELECT count(*), min(p.numero) INTO v_n, v_par
          FROM capitulos c JOIN parrafos p ON p.capitulo_id = c.id
         WHERE c.libro_id = p_libro AND c.numero = v_cap AND strpos(_mapa_norm(p.contenido), v_cita) > 0;
        IF v_n = 0 THEN
          RAISE EXCEPTION 'No encontramos tal cual en el capítulo % la frase «%».', v_cap, left(r ->> 'cita', 50) USING ERRCODE = '22023', HINT = 'formato';
        END IF;
        SELECT _mapa_norm(p.contenido) INTO v_txt FROM capitulos c JOIN parrafos p ON p.capitulo_id = c.id
         WHERE c.libro_id = p_libro AND c.numero = v_cap AND p.numero = v_par;
        IF v_n > 1 OR strpos(substr(v_txt, strpos(v_txt, v_cita) + 1), v_cita) > 0 THEN
          RAISE EXCEPTION 'La frase «%» sale más de una vez en el capítulo %: alárgala un poco.', left(r ->> 'cita', 50), v_cap
            USING ERRCODE = '22023', HINT = 'formato';
        END IF;
        v_pos := strpos(v_txt, v_cita);
        v_clave := v_cap || ':' || v_par;
        IF NOT v_textos ? v_clave THEN
          v_textos := v_textos || jsonb_build_object(v_clave, coalesce(v_actual -> 'textos' ->> v_clave, v_txt));
        END IF;
        -- Si el texto guardado del párrafo no coincide (libro reprocesado), manda el nuevo.
        IF strpos(v_textos ->> v_clave, v_cita) <> v_pos THEN
          v_textos := v_textos || jsonb_build_object(v_clave, v_txt);
        END IF;
        r := jsonb_build_object('parrafo', v_par, 'inicio', v_pos, 'fin', v_pos + length(v_cita) - 1);
      ELSE
        IF coalesce((it ->> 'nueva')::boolean, false) OR NOT (ac -> 'respuestas') @> jsonb_build_array(jsonb_build_object(
             'parrafo', (r ->> 'parrafo')::int, 'inicio', (r ->> 'inicio')::int, 'fin', (r ->> 'fin')::int)) THEN
          RAISE EXCEPTION 'Una frase buena ya no está. Recarga la página.' USING ERRCODE = '22023', HINT = 'formato';
        END IF;
        r := jsonb_build_object('parrafo', (r ->> 'parrafo')::int, 'inicio', (r ->> 'inicio')::int, 'fin', (r ->> 'fin')::int);
        v_clave := v_cap || ':' || (r ->> 'parrafo');
        IF NOT v_textos ? v_clave THEN
          v_textos := v_textos || jsonb_build_object(v_clave, v_actual -> 'textos' ->> v_clave);
        END IF;
      END IF;
      IF v_resp @> jsonb_build_array(jsonb_build_object('parrafo', (r ->> 'parrafo')::int))
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_resp) q WHERE (q ->> 'parrafo')::int = (r ->> 'parrafo')::int
                     AND (q ->> 'inicio')::int <= (r ->> 'fin')::int AND (r ->> 'inicio')::int <= (q ->> 'fin')::int) THEN
        RAISE EXCEPTION 'El tesoro «%» repite una frase.', left(it ->> 'pregunta', 50) USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_resp := v_resp || jsonb_build_array(r);
    END LOOP;

    -- Brillo: el que tenía si la principal sigue igual; si no, uno nuevo (después se comprueba que no pise a otro).
    v_brillo := CASE WHEN ac -> 'respuestas' -> 0 = v_resp -> 0 THEN ac -> 'brillo' END;

    v_tes := v_tes || jsonb_build_array(ac || jsonb_build_object(
      'tipo', it ->> 'tipo', 'pisa', CASE WHEN it ->> 'tipo' = 'vista' THEN 'localizar' ELSE 'comprender' END,
      'spoiler', (it ->> 'spoiler')::boolean, 'pregunta', _texto_juego(it -> 'pregunta', 200),
      'porque', CASE WHEN it ->> 'tipo' = 'escondido' THEN _texto_juego(it -> 'porque', 300) ELSE coalesce(_texto_juego(it -> 'porque', 300, true), '') END,
      'respuestas', v_resp, 'brillo', v_brillo));
  END LOOP;

  -- Ninguna frase es respuesta de dos tesoros.
  FOR t1 IN SELECT * FROM jsonb_array_elements(v_tes) LOOP
    FOR t2 IN SELECT * FROM jsonb_array_elements(v_tes) LOOP
      IF t1 ->> 'id' < t2 ->> 'id' AND t1 ->> 'cap' = t2 ->> 'cap' AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(t1 -> 'respuestas') a, jsonb_array_elements(t2 -> 'respuestas') c
           WHERE a ->> 'parrafo' = c ->> 'parrafo' AND (a ->> 'inicio')::int <= (c ->> 'fin')::int AND (c ->> 'inicio')::int <= (a ->> 'fin')::int) THEN
        RAISE EXCEPTION 'Una misma frase es respuesta de dos tesoros («%» y «%»).', left(t1 ->> 'pregunta', 40), left(t2 ->> 'pregunta', 40)
          USING ERRCODE = '22023', HINT = 'formato';
      END IF;
    END LOOP;
  END LOOP;

  -- Brillos nuevos: 11 párrafos (de 3 a 7 antes de la principal, el primero que no pise a otro).
  FOR v_i IN 0 .. jsonb_array_length(v_tes) - 1 LOOP
    t1 := v_tes -> v_i;
    CONTINUE WHEN jsonb_typeof(t1 -> 'brillo') = 'array';
    v_cap := (t1 ->> 'cap')::int;
    v_par := (t1 -> 'respuestas' -> 0 ->> 'parrafo')::int;
    SELECT array_agg(p.numero ORDER BY p.numero) INTO v_pars FROM capitulos c JOIN parrafos p ON p.capitulo_id = c.id
     WHERE c.libro_id = p_libro AND c.numero = v_cap;
    v_brillo := NULL;
    FOR b IN SELECT g FROM generate_series(3, 7) g ORDER BY md5(p_libro || ':' || (t1 ->> 'id') || ':' || g) LOOP
      v_n := array_position(v_pars, v_par);
      v_desde := v_pars[greatest(1, v_n - b)];
      v_hasta := v_pars[least(cardinality(v_pars), v_n + 10 - b)];
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_tes) o
                     WHERE o ->> 'id' <> t1 ->> 'id' AND (o ->> 'cap')::int = v_cap AND jsonb_typeof(o -> 'brillo') = 'array'
                       AND (o -> 'brillo' ->> 0)::int <= v_hasta AND v_desde <= (o -> 'brillo' ->> 1)::int) THEN
        v_brillo := jsonb_build_array(v_desde, v_hasta);
        EXIT;
      END IF;
    END LOOP;
    IF v_brillo IS NULL THEN
      RAISE EXCEPTION 'El tesoro «%» está demasiado cerca de otro del capítulo %: el libro brillaría para los dos a la vez. Elige una frase principal más lejos.',
        left(t1 ->> 'pregunta', 50), v_cap USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_tes := jsonb_set(v_tes, ARRAY[v_i::text, 'brillo'], v_brillo);
  END LOOP;

  -- Los que conservaron su brillo tampoco pueden pisarse con los nuevos (ni entre sí).
  FOR t1 IN SELECT * FROM jsonb_array_elements(v_tes) LOOP
    FOR t2 IN SELECT * FROM jsonb_array_elements(v_tes) LOOP
      IF t1 ->> 'id' < t2 ->> 'id' AND t1 ->> 'cap' = t2 ->> 'cap'
         AND (t1 -> 'brillo' ->> 0)::int <= (t2 -> 'brillo' ->> 1)::int AND (t2 -> 'brillo' ->> 0)::int <= (t1 -> 'brillo' ->> 1)::int THEN
        RAISE EXCEPTION 'Los tesoros «%» y «%» están demasiado cerca: el libro brillaría para los dos a la vez.',
          left(t1 ->> 'pregunta', 40), left(t2 ->> 'pregunta', 40) USING ERRCODE = '22023', HINT = 'formato';
      END IF;
    END LOOP;
  END LOOP;

  PERFORM _guardar_juego(p_libro, 'mapa', v_actual || jsonb_build_object(
    'tesoros', (SELECT jsonb_agg(x ORDER BY (x ->> 'cap')::int, o) FROM jsonb_array_elements(v_tes) WITH ORDINALITY t(x, o)),
    'textos', v_textos));
END;
$fn$;

REVOKE ALL ON FUNCTION public.editar_mapa(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_mapa(uuid, jsonb) TO authenticated;
