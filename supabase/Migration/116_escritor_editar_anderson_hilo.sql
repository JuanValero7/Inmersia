-- =============================================================
-- INMERSIA — Migración 116
-- Rincón del escritor: editar Método Anderson y Hilo de ideas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 087, la 100 y la 114 (_libro_del_escritor, _guardar_juego, _texto_juego).
--
-- QUÉ HACE (Juan, 13 nov 2026)
--   · editar_anderson(libro, pistas, rasgos): el navegador manda la lista
--     ENTERA de pistas y deducciones (rasgos) tal como deben quedar.
--     Se puede: cambiar textos (resumen de la pista, por_que del señuelo,
--     las 3 conclusiones), quitar y añadir pistas a una deducción, quitar
--     deducciones y crear nuevas.
--     Pista nueva: {nueva: true, id provisional, pj, cap, cita, resumen}.
--       La cita tiene que estar LITERAL en ese capítulo (la base la busca y
--       pone el párrafo) y el capítulo no puede ser anterior al que presenta
--       al personaje (aparece).
--     Deducción nueva: {nueva: true, id provisional, pj, opciones[3], correcta, pool}.
--     Reglas que la base hace cumplir (para que el juego no se rompa):
--       · toda deducción tiene al menos 3 pistas (de su personaje, no señuelos);
--       · dos deducciones del mismo personaje comparten como mucho 2 pistas
--         (si comparten 3, el juego no sabría cuál se arma);
--       · cada personaje conserva al menos una deducción;
--       · la pista que ya no sirve a ninguna deducción (y no es señuelo) se quita.
--     No se tocan: la cita, el capítulo y el párrafo de las pistas que ya
--     estaban, qué pista es señuelo, cuál es la correcta y sus tipos en las
--     deducciones que ya estaban, ni los personajes (su foto se busca por
--     nombre en la cartelera). Una deducción «de cambio» conserva la
--     deducción de la que parte (no cuenta para las 3 pistas).
--   · ubicar_cita_escritor(libro, cap, cita): para avisar al momento si una
--     frase no está tal cual en el capítulo (devuelve el párrafo).
--   · editar_hilo(libro, pistas, ideas): también listas ENTERAS. Textos de
--     pistas (t) e ideas (titulo, pregunta, conclusion, falta); cambiar las 3
--     piezas de una idea (pistas o ideas anteriores), crear ideas y quitarlas.
--     Pista nueva = frase literal del capítulo, como en Anderson.
--     Reglas: 3 piezas distintas por idea; cada pista (no señuelo) en UNA sola
--     idea (la que no va en ninguna se quita); sin ciclos; la conclusión del
--     libro no se quita. «abre» (capítulo en que se abre la idea) lo
--     recalcula la base. No se tocan la cita, cap y parrafo de las pistas que
--     ya estaban, los señuelos (solo su texto) ni «final» de las que ya estaban.
--   · Original y «Volver al original»: los de la 114.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================

-- Párrafo (parrafos.numero) del capítulo que contiene la cita, sin contar
-- espacios de más. NULL si no está.
CREATE OR REPLACE FUNCTION public._ubicar_cita(p_libro uuid, p_cap int, p_cita text) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT p.numero
  FROM capitulos c JOIN parrafos p ON p.capitulo_id = c.id
  WHERE c.libro_id = p_libro AND c.numero = p_cap
    AND length(btrim(coalesce(p_cita, ''))) >= 10
    AND strpos(regexp_replace(p.contenido, '\s+', ' ', 'g'), regexp_replace(btrim(p_cita), '\s+', ' ', 'g')) > 0
  ORDER BY p.numero
  LIMIT 1;
$fn$;
REVOKE ALL ON FUNCTION public._ubicar_cita(uuid, int, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ubicar_cita_escritor(p_libro uuid, p_cap int, p_cita text) RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_par int;
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  v_par := _ubicar_cita(p_libro, p_cap, p_cita);
  IF v_par IS NULL THEN
    RAISE EXCEPTION 'No encontramos esa frase tal cual en el capítulo %. Cópiala de tu libro sin cambiar nada.', p_cap
      USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  RETURN v_par;
END;
$fn$;


-- Anderson: p_pistas = lista entera [{id, resumen, por_que?} | {nueva, id, pj, cap, cita, resumen}]
--           p_rasgos = lista entera [{id, opciones[3], pool[]} | {nueva, id, pj, opciones[3], correcta, pool[]}]
CREATE OR REPLACE FUNCTION public.editar_anderson(p_libro uuid, p_pistas jsonb, p_rasgos jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actual  jsonb;
  v_pjs     jsonb;
  v_pistas  jsonb := '{}'::jsonb;   -- id final → pista
  v_mapa    jsonb := '{}'::jsonb;   -- id provisional → id final
  v_rasgos  jsonb := '[]'::jsonb;
  v_ids_r   text[];
  v_maxcap  int;
  it        jsonb;
  ac        jsonb;
  pj        jsonb;
  v_id      text;
  v_par     int;
  v_ops     jsonb;
  v_pool    jsonb;
  v_n       int;
  k         int;
  r1        jsonb;
  r2        jsonb;
  pid       text;
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  SELECT datos INTO v_actual FROM anderson_contenido WHERE libro_id = p_libro;
  IF v_actual IS NULL THEN
    RAISE EXCEPTION 'Este libro todavía no tiene Método Anderson.' USING ERRCODE = 'P0002', HINT = 'formato';
  END IF;
  IF jsonb_typeof(p_pistas) IS DISTINCT FROM 'array' OR jsonb_typeof(p_rasgos) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_pistas) > 400 OR jsonb_array_length(p_rasgos) > 80 THEN
    RAISE EXCEPTION 'Formato no válido.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  v_pjs := v_actual -> 'personajes';
  SELECT max(numero) INTO v_maxcap FROM capitulos WHERE libro_id = p_libro;

  -- 1. Pistas: las que ya estaban (solo textos) y las nuevas (se ubican en el libro).
  FOR it IN SELECT * FROM jsonb_array_elements(p_pistas) LOOP
    IF coalesce((it ->> 'nueva')::boolean, false) THEN
      SELECT x INTO pj FROM jsonb_array_elements(v_pjs) x WHERE x ->> 'id' = it ->> 'pj';
      IF pj IS NULL THEN
        RAISE EXCEPTION 'Ese personaje no está en el juego.' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      IF jsonb_typeof(it -> 'cap') IS DISTINCT FROM 'number' OR (it ->> 'cap')::int < (pj ->> 'aparece')::int OR (it ->> 'cap')::int > v_maxcap THEN
        RAISE EXCEPTION 'Una pista de % tiene que ser del capítulo % en adelante (cuando aparece).', pj ->> 'corto', pj ->> 'aparece'
          USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      IF _texto_juego(it -> 'cita', 600) IS NULL OR _texto_juego(it -> 'resumen', 200) IS NULL THEN
        RAISE EXCEPTION 'Una pista nueva necesita la frase del libro (hasta 600 letras) y lo que ve el lector (hasta 200).'
          USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_par := _ubicar_cita(p_libro, (it ->> 'cap')::int, it ->> 'cita');
      IF v_par IS NULL THEN
        RAISE EXCEPTION 'No encontramos tal cual en el capítulo % la frase «%».', it ->> 'cap', left(it ->> 'cita', 50)
          USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_id := 'p' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
      IF coalesce(it ->> 'id', '') <> '' THEN v_mapa := v_mapa || jsonb_build_object(it ->> 'id', v_id); END IF;
      v_pistas := v_pistas || jsonb_build_object(v_id, jsonb_build_object(
        'id', v_id, 'pj', pj ->> 'id', 'cap', (it ->> 'cap')::int, 'parrafo', v_par,
        'cita', _texto_juego(it -> 'cita', 600), 'resumen', _texto_juego(it -> 'resumen', 200),
        'senuelo', false, 'por_que', NULL, 'clave', NULL));
    ELSE
      SELECT x INTO ac FROM jsonb_array_elements(v_actual -> 'pistas') x WHERE x ->> 'id' = it ->> 'id';
      IF ac IS NULL OR v_pistas ? (ac ->> 'id') THEN
        RAISE EXCEPTION 'Una pista ya no está o está repetida. Recarga la página.' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      IF _texto_juego(it -> 'resumen', 200) IS NULL THEN
        RAISE EXCEPTION 'Lo que ve el lector en una pista no puede quedar vacío (hasta 200 letras): «%».', left(ac ->> 'cita', 50)
          USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      ac := ac || jsonb_build_object('resumen', _texto_juego(it -> 'resumen', 200));
      IF (ac ->> 'senuelo')::boolean THEN
        IF _texto_juego(it -> 'por_que', 300) IS NULL THEN
          RAISE EXCEPTION 'Explica por qué engaña el señuelo (hasta 300 letras): «%».', left(ac ->> 'cita', 50)
            USING ERRCODE = '22023', HINT = 'formato';
        END IF;
        ac := ac || jsonb_build_object('por_que', _texto_juego(it -> 'por_que', 300));
      END IF;
      v_pistas := v_pistas || jsonb_build_object(ac ->> 'id', ac);
    END IF;
  END LOOP;

  -- Ids finales de deducción (para las referencias de las «de cambio»).
  SELECT coalesce(array_agg(x ->> 'id'), '{}') INTO v_ids_r
    FROM jsonb_array_elements(p_rasgos) x WHERE NOT coalesce((x ->> 'nueva')::boolean, false);

  -- 2. Deducciones.
  FOR it IN SELECT * FROM jsonb_array_elements(p_rasgos) LOOP
    IF coalesce((it ->> 'nueva')::boolean, false) THEN
      SELECT x INTO pj FROM jsonb_array_elements(v_pjs) x WHERE x ->> 'id' = it ->> 'pj';
      IF pj IS NULL OR jsonb_typeof(it -> 'correcta') IS DISTINCT FROM 'number' OR (it ->> 'correcta')::int NOT BETWEEN 0 AND 2 THEN
        RAISE EXCEPTION 'Una deducción nueva necesita su personaje y cuál es la conclusión verdadera.' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      ac := jsonb_build_object('id', 'e' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), 'pj', pj ->> 'id',
        'correcta', (it ->> 'correcta')::int,
        'tipos', (SELECT jsonb_agg(CASE WHEN g = (it ->> 'correcta')::int THEN NULL ELSE 'otra' END ORDER BY g) FROM generate_series(0, 2) g));
    ELSE
      SELECT x INTO ac FROM jsonb_array_elements(v_actual -> 'rasgos') x WHERE x ->> 'id' = it ->> 'id';
      IF ac IS NULL OR v_rasgos @> jsonb_build_array(jsonb_build_object('id', ac ->> 'id')) THEN
        RAISE EXCEPTION 'Una deducción ya no está o está repetida. Recarga la página.' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      SELECT x INTO pj FROM jsonb_array_elements(v_pjs) x WHERE x ->> 'id' = ac ->> 'pj';
    END IF;

    -- Las tres conclusiones.
    IF jsonb_typeof(it -> 'opciones') IS DISTINCT FROM 'array' OR jsonb_array_length(it -> 'opciones') <> 3 THEN
      RAISE EXCEPTION 'Cada deducción lleva tres conclusiones.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_ops := '[]'::jsonb;
    FOR k IN 0 .. 2 LOOP
      IF _texto_juego(it -> 'opciones' -> k, 160) IS NULL THEN
        RAISE EXCEPTION 'Las conclusiones de % no pueden quedar vacías (hasta 160 letras).', pj ->> 'corto' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_ops := v_ops || to_jsonb(_texto_juego(it -> 'opciones' -> k, 160));
    END LOOP;

    -- Las pistas que la arman (+ la deducción de la que parte, si ya la tenía).
    IF jsonb_typeof(it -> 'pool') IS DISTINCT FROM 'array' OR jsonb_array_length(it -> 'pool') > 15 THEN
      RAISE EXCEPTION 'Formato no válido.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_pool := '[]'::jsonb;
    v_n := 0;
    FOR pid IN SELECT jsonb_array_elements_text(it -> 'pool') LOOP
      pid := coalesce(v_mapa ->> pid, pid);
      IF v_pool ? pid THEN CONTINUE; END IF;
      IF v_pistas ? pid THEN
        IF (v_pistas -> pid ->> 'pj') <> (pj ->> 'id') OR (v_pistas -> pid ->> 'senuelo')::boolean THEN
          RAISE EXCEPTION 'Una deducción de % solo puede llevar pistas de % (y no señuelos).', pj ->> 'corto', pj ->> 'corto'
            USING ERRCODE = '22023', HINT = 'formato';
        END IF;
        v_n := v_n + 1;
      ELSIF NOT coalesce((it ->> 'nueva')::boolean, false) AND (ac -> 'pool') ? pid THEN
        -- Deducción de la que parte: se queda si sigue; si el escritor la quitó, se suelta.
        IF NOT pid = ANY (v_ids_r) THEN CONTINUE; END IF;
      ELSE
        RAISE EXCEPTION 'Una pista de la deducción ya no está. Recarga la página.' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_pool := v_pool || to_jsonb(pid);
    END LOOP;
    IF v_n < 3 THEN
      RAISE EXCEPTION 'La deducción «%» necesita al menos 3 pistas (tiene %).', v_ops ->> coalesce((ac ->> 'correcta')::int, 0), v_n
        USING ERRCODE = '22023', HINT = 'formato';
    END IF;

    v_rasgos := v_rasgos || jsonb_build_array(ac || jsonb_build_object('opciones', v_ops, 'pool', v_pool));
  END LOOP;

  -- 3. Reglas de conjunto.
  FOR pj IN SELECT * FROM jsonb_array_elements(v_pjs) LOOP
    IF NOT v_rasgos @> jsonb_build_array(jsonb_build_object('pj', pj ->> 'id')) THEN
      RAISE EXCEPTION '% tiene que quedarse con al menos una deducción.', pj ->> 'corto' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
  END LOOP;
  FOR r1 IN SELECT * FROM jsonb_array_elements(v_rasgos) LOOP
    FOR r2 IN SELECT * FROM jsonb_array_elements(v_rasgos) LOOP
      IF r1 ->> 'id' < r2 ->> 'id' AND r1 ->> 'pj' = r2 ->> 'pj'
         AND (SELECT count(*) FROM jsonb_array_elements_text(r1 -> 'pool') a
              WHERE v_pistas ? a AND (r2 -> 'pool') ? a) >= 3 THEN
        RAISE EXCEPTION 'Dos deducciones comparten 3 pistas o más («%» y «%»): el juego no sabría cuál se arma. Cambia alguna.',
          r1 -> 'opciones' ->> (r1 ->> 'correcta')::int, r2 -> 'opciones' ->> (r2 ->> 'correcta')::int
          USING ERRCODE = '22023', HINT = 'formato';
      END IF;
    END LOOP;
  END LOOP;

  -- 4. Fuera las pistas que ya no sirven a ninguna deducción (los señuelos se quedan).
  PERFORM _guardar_juego(p_libro, 'anderson', v_actual || jsonb_build_object(
    'rasgos', v_rasgos,
    'pistas', coalesce((
      SELECT jsonb_agg(x ORDER BY (x ->> 'cap')::int, (x ->> 'parrafo')::int)
      FROM jsonb_each(v_pistas) e(cl, x)
      WHERE (x ->> 'senuelo')::boolean
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_rasgos) r WHERE (r -> 'pool') ? (x ->> 'id'))), '[]'::jsonb)));
END;
$fn$;


-- Hilo: listas ENTERAS, como Anderson.
--   p_pistas = [{id, t} | {nueva, id, cap, cita, t}]   (los señuelos van con las demás)
--   p_ideas  = [{id, titulo, pregunta, conclusion, falta, piezas[3]} | {nueva, id, …, piezas[3]}]
-- Reglas: cada idea lleva 3 piezas distintas (pistas o ideas anteriores); cada
-- pista (no señuelo) va en UNA sola idea y la que no va en ninguna se quita;
-- sin ciclos; la conclusión del libro no se quita. «abre» lo recalcula la base.
CREATE OR REPLACE FUNCTION public.editar_hilo(p_libro uuid, p_pistas jsonb, p_ideas jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actual jsonb;
  v_pistas jsonb := '{}'::jsonb;   -- id → pista
  v_ideas  jsonb := '[]'::jsonb;
  v_mapa   jsonb := '{}'::jsonb;   -- id provisional → id final
  v_ids_i  text[] := '{}';
  v_abre   jsonb := '{}'::jsonb;
  v_maxcap int;
  it       jsonb;
  ac       jsonb;
  v_id     text;
  v_par    int;
  v_piezas jsonb;
  pid      text;
  v_uso    jsonb := '{}'::jsonb;   -- pista → idea que la usa
  v_vuelta int;
  v_cambio boolean;
  v_max    int;
  v_listo  boolean;
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  SELECT datos INTO v_actual FROM hilo_contenido WHERE libro_id = p_libro;
  IF v_actual IS NULL THEN
    RAISE EXCEPTION 'Este libro todavía no tiene Hilo de ideas.' USING ERRCODE = 'P0002', HINT = 'formato';
  END IF;
  IF jsonb_typeof(p_pistas) IS DISTINCT FROM 'array' OR jsonb_typeof(p_ideas) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_pistas) > 300 OR jsonb_array_length(p_ideas) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Formato no válido.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  SELECT max(numero) INTO v_maxcap FROM capitulos WHERE libro_id = p_libro;

  -- 1. Pistas.
  FOR it IN SELECT * FROM jsonb_array_elements(p_pistas) LOOP
    IF coalesce((it ->> 'nueva')::boolean, false) THEN
      IF jsonb_typeof(it -> 'cap') IS DISTINCT FROM 'number' OR (it ->> 'cap')::int NOT BETWEEN 1 AND v_maxcap
         OR _texto_juego(it -> 'cita', 600) IS NULL OR _texto_juego(it -> 't', 200) IS NULL THEN
        RAISE EXCEPTION 'Una pista nueva necesita su capítulo, la frase del libro (hasta 600 letras) y lo que ve el lector (hasta 200).'
          USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_par := _ubicar_cita(p_libro, (it ->> 'cap')::int, it ->> 'cita');
      IF v_par IS NULL THEN
        RAISE EXCEPTION 'No encontramos tal cual en el capítulo % la frase «%».', it ->> 'cap', left(it ->> 'cita', 50)
          USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_id := 'p' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
      IF coalesce(it ->> 'id', '') <> '' THEN v_mapa := v_mapa || jsonb_build_object(it ->> 'id', v_id); END IF;
      v_pistas := v_pistas || jsonb_build_object(v_id, jsonb_build_object('id', v_id, 'cap', (it ->> 'cap')::int, 'parrafo', v_par,
        'cita', _texto_juego(it -> 'cita', 600), 't', _texto_juego(it -> 't', 200), 'senuelo', false));
    ELSE
      SELECT x INTO ac FROM jsonb_array_elements(v_actual -> 'pistas') x WHERE x ->> 'id' = it ->> 'id';
      IF ac IS NULL OR v_pistas ? (ac ->> 'id') THEN
        RAISE EXCEPTION 'Una pista ya no está o está repetida. Recarga la página.' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      IF _texto_juego(it -> 't', 200) IS NULL THEN
        RAISE EXCEPTION 'Una pista no puede quedar vacía (hasta 200 letras): «%».', left(ac ->> 'cita', 50)
          USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_pistas := v_pistas || jsonb_build_object(ac ->> 'id', ac || jsonb_build_object('t', _texto_juego(it -> 't', 200)));
    END IF;
  END LOOP;

  -- Ids finales de las ideas (las nuevas reciben uno aquí, para poder usarlas como pieza).
  FOR it IN SELECT * FROM jsonb_array_elements(p_ideas) LOOP
    IF coalesce((it ->> 'nueva')::boolean, false) THEN
      v_id := 'i' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
      v_mapa := v_mapa || jsonb_build_object(it ->> 'id', v_id);
    ELSE
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_actual -> 'ideas') x WHERE x ->> 'id' = it ->> 'id') OR (it ->> 'id') = ANY (v_ids_i) THEN
        RAISE EXCEPTION 'Una idea ya no está o está repetida. Recarga la página.' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_id := it ->> 'id';
    END IF;
    v_ids_i := v_ids_i || v_id;
  END LOOP;

  -- 2. Ideas.
  FOR it IN SELECT * FROM jsonb_array_elements(p_ideas) LOOP
    v_id := coalesce(v_mapa ->> (it ->> 'id'), it ->> 'id');
    IF coalesce((it ->> 'nueva')::boolean, false) THEN
      ac := jsonb_build_object('id', v_id, 'final', NULL);
    ELSE
      SELECT x INTO ac FROM jsonb_array_elements(v_actual -> 'ideas') x WHERE x ->> 'id' = v_id;
    END IF;
    IF _texto_juego(it -> 'titulo', 60) IS NULL OR _texto_juego(it -> 'pregunta', 160) IS NULL
       OR _texto_juego(it -> 'conclusion', 500) IS NULL OR _texto_juego(it -> 'falta', 300) IS NULL THEN
      RAISE EXCEPTION 'Revisa la idea «%»: título (hasta 60 letras), pregunta (160), conclusión (500) y ayuda (300) no pueden quedar vacíos.',
        coalesce(nullif(it ->> 'titulo', ''), it ->> 'pregunta', 'nueva') USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    IF jsonb_typeof(it -> 'piezas') IS DISTINCT FROM 'array' OR jsonb_array_length(it -> 'piezas') <> 3 THEN
      RAISE EXCEPTION 'La idea «%» lleva exactamente 3 piezas.', it ->> 'titulo' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_piezas := '[]'::jsonb;
    FOR pid IN SELECT jsonb_array_elements_text(it -> 'piezas') LOOP
      pid := coalesce(v_mapa ->> pid, pid);
      IF v_piezas ? pid OR pid = v_id THEN
        RAISE EXCEPTION 'La idea «%» repite una pieza.', it ->> 'titulo' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      IF v_pistas ? pid THEN
        IF (v_pistas -> pid ->> 'senuelo')::boolean THEN
          RAISE EXCEPTION 'Un señuelo no puede ser pieza de una idea («%»).', it ->> 'titulo' USING ERRCODE = '22023', HINT = 'formato';
        END IF;
        IF v_uso ? pid THEN
          RAISE EXCEPTION 'Una pista va en una sola idea: «%» está en dos.', left(v_pistas -> pid ->> 't', 50) USING ERRCODE = '22023', HINT = 'formato';
        END IF;
        v_uso := v_uso || jsonb_build_object(pid, v_id);
      ELSIF NOT pid = ANY (v_ids_i) THEN
        RAISE EXCEPTION 'La idea «%» usa una pista o idea que ya no está.', it ->> 'titulo' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_piezas := v_piezas || to_jsonb(pid);
    END LOOP;
    v_ideas := v_ideas || jsonb_build_array(ac || jsonb_build_object(
      'titulo', _texto_juego(it -> 'titulo', 60), 'pregunta', _texto_juego(it -> 'pregunta', 160),
      'conclusion', _texto_juego(it -> 'conclusion', 500), 'falta', _texto_juego(it -> 'falta', 300), 'piezas', v_piezas));
  END LOOP;

  IF NOT v_ideas @> '[{"final": "principal"}]' AND v_actual -> 'ideas' @> '[{"final": "principal"}]' THEN
    RAISE EXCEPTION 'La conclusión del libro no se puede quitar.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  -- 3. «abre» = el capítulo en que ya llegaron todas sus pistas y se abrieron sus ideas previas.
  --    Si no se puede calcular para todas, hay un ciclo.
  FOR v_vuelta IN 1 .. jsonb_array_length(v_ideas) + 1 LOOP
    v_cambio := false;
    FOR ac IN SELECT * FROM jsonb_array_elements(v_ideas) LOOP
      IF v_abre ? (ac ->> 'id') THEN CONTINUE; END IF;
      v_max := 0; v_listo := true;
      FOR pid IN SELECT jsonb_array_elements_text(ac -> 'piezas') LOOP
        IF v_pistas ? pid THEN v_max := greatest(v_max, (v_pistas -> pid ->> 'cap')::int);
        ELSIF v_abre ? pid THEN v_max := greatest(v_max, (v_abre ->> pid)::int);
        ELSE v_listo := false; END IF;
      END LOOP;
      IF v_listo THEN v_abre := v_abre || jsonb_build_object(ac ->> 'id', v_max); v_cambio := true; END IF;
    END LOOP;
    EXIT WHEN NOT v_cambio;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_object_keys(v_abre)) <> jsonb_array_length(v_ideas) THEN
    RAISE EXCEPTION 'Hay ideas que dependen unas de otras en círculo: ninguna podría armarse.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  PERFORM _guardar_juego(p_libro, 'hilo', v_actual || jsonb_build_object(
    'ideas', (SELECT jsonb_agg(x || jsonb_build_object('abre', (v_abre ->> (x ->> 'id'))::int) ORDER BY o)
              FROM jsonb_array_elements(v_ideas) WITH ORDINALITY t(x, o)),
    'pistas', coalesce((SELECT jsonb_agg(x ORDER BY (x ->> 'cap')::int, x ->> 'id')
                        FROM jsonb_each(v_pistas) e(cl, x)
                        WHERE (x ->> 'senuelo')::boolean OR v_uso ? (x ->> 'id')), '[]'::jsonb)));
END;
$fn$;

REVOKE ALL ON FUNCTION public.editar_anderson(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.editar_hilo(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_anderson(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_hilo(uuid, jsonb, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ubicar_cita_escritor(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ubicar_cita_escritor(uuid, int, text) TO authenticated;
