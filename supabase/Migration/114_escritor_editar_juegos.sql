-- =============================================================
-- INMERSIA — Migración 114
-- Rincón del escritor: editar los juegos de su libro (primeros: Corazonadas
-- y Cápsula del tiempo; el resto sigue el mismo patrón)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 111 (_libro_del_escritor) y la 113.
--
-- QUÉ HACE (Juan, 13 nov 2026)
--   · juego_escritor(libro, juego): el dueño lee el JSON de su juego (las
--     tablas *_contenido no se leen directamente).
--   · editar_corazonadas / editar_capsula: el navegador manda SOLO los
--     textos; la base parte del JSON guardado y cambia esos campos. La
--     estructura (ids, dónde sale el chip y la revelación, cuál es la
--     correcta, «tipos» del panel del profe) no la toca el escritor: así un
--     cambio no puede romper el juego en el lector. Se puede quitar
--     corazonadas o preguntas y, en Cápsula, añadir preguntas nuevas.
--   · La primera vez que edita, se guarda el original (juegos_originales):
--     restaurar_juego() vuelve a él.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.juegos_originales (
  libro_id  uuid NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  juego     text NOT NULL,
  datos     jsonb NOT NULL,
  guardado  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (libro_id, juego)
);
ALTER TABLE public.juegos_originales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.juegos_originales FROM anon, authenticated;


-- El JSON del juego (y si está editado). Solo el dueño.
CREATE OR REPLACE FUNCTION public.juego_escritor(p_libro uuid, p_juego text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_datos jsonb;
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  IF p_juego NOT IN ('anderson', 'corazonadas', 'desafio', 'concurso', 'mapa', 'hilo', 'falsificador', 'explicaselo', 'capsula') THEN
    RAISE EXCEPTION 'Ese juego no existe.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  EXECUTE format('SELECT datos FROM %I WHERE libro_id = $1', p_juego || '_contenido') INTO v_datos USING p_libro;
  RETURN jsonb_build_object('datos', v_datos,
    'editado', EXISTS (SELECT 1 FROM juegos_originales WHERE libro_id = p_libro AND juego = p_juego));
END;
$fn$;

-- Guarda el JSON nuevo (y el original la primera vez). Uso interno.
CREATE OR REPLACE FUNCTION public._guardar_juego(p_libro uuid, p_juego text, p_datos jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  EXECUTE format('INSERT INTO juegos_originales (libro_id, juego, datos)
                  SELECT libro_id, %L, datos FROM %I WHERE libro_id = $1
                  ON CONFLICT DO NOTHING', p_juego, p_juego || '_contenido') USING p_libro;
  EXECUTE format('UPDATE %I SET datos = $2, version = version + 1, actualizado_at = now() WHERE libro_id = $1',
                 p_juego || '_contenido') USING p_libro, p_datos;
END;
$fn$;
REVOKE ALL ON FUNCTION public._guardar_juego(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Texto obligatorio y acotado (o NULL si no vale).
CREATE OR REPLACE FUNCTION public._texto_juego(p jsonb, p_max int, p_vacio boolean DEFAULT false) RETURNS text
LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE WHEN jsonb_typeof(p) = 'string'
               AND length(btrim(p #>> '{}')) <= p_max
               AND (p_vacio OR length(btrim(p #>> '{}')) >= 1)
              THEN btrim(p #>> '{}') END;
$fn$;


-- Corazonadas: p_items = [{id, pregunta, contexto, resultado, clase,
-- opciones: [3 textos], pistas: [textos]}] en el orden en que quedan.
-- Las que no vengan se quitan (mínimo 1).
CREATE OR REPLACE FUNCTION public.editar_corazonadas(p_libro uuid, p_items jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actual jsonb;
  v_nuevo  jsonb := '[]'::jsonb;
  it       jsonb;
  cz       jsonb;
  v_ops    jsonb;
  v_pistas jsonb;
  k        int;
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  SELECT datos INTO v_actual FROM corazonadas_contenido WHERE libro_id = p_libro;
  IF v_actual IS NULL THEN
    RAISE EXCEPTION 'Este libro todavía no tiene Corazonadas.' USING ERRCODE = 'P0002', HINT = 'formato';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Deja al menos una corazonada.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT c INTO cz FROM jsonb_array_elements(v_actual -> 'corazonadas') c WHERE c ->> 'id' = it ->> 'id';
    IF cz IS NULL THEN
      RAISE EXCEPTION 'Una corazonada ya no está. Recarga la página.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    IF _texto_juego(it -> 'pregunta', 200) IS NULL OR _texto_juego(it -> 'contexto', 600) IS NULL
       OR _texto_juego(it -> 'resultado', 600) IS NULL
       OR coalesce(it ->> 'clase', '') NOT IN ('deducible', 'sorpresa')
       OR jsonb_typeof(it -> 'opciones') IS DISTINCT FROM 'array'
       OR jsonb_array_length(it -> 'opciones') <> jsonb_array_length(cz -> 'opciones')
       OR jsonb_typeof(it -> 'pistas') IS DISTINCT FROM 'array'
       OR jsonb_array_length(it -> 'pistas') > 8 THEN
      RAISE EXCEPTION 'Revisa la corazonada «%»: pregunta, contexto, resultado y las opciones no pueden quedar vacíos.',
        left(coalesce(it ->> 'pregunta', ''), 60) USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_ops := '[]'::jsonb;
    FOR k IN 0 .. jsonb_array_length(it -> 'opciones') - 1 LOOP
      IF _texto_juego(it -> 'opciones' -> k, 160) IS NULL THEN
        RAISE EXCEPTION 'Las opciones no pueden quedar vacías (hasta 160 letras).' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      v_ops := v_ops || to_jsonb(_texto_juego(it -> 'opciones' -> k, 160));
    END LOOP;
    SELECT coalesce(jsonb_agg(to_jsonb(_texto_juego(p, 300))), '[]'::jsonb) INTO v_pistas
      FROM jsonb_array_elements(it -> 'pistas') p WHERE _texto_juego(p, 300) IS NOT NULL;

    v_nuevo := v_nuevo || jsonb_build_array(cz || jsonb_build_object(
      'pregunta', _texto_juego(it -> 'pregunta', 200), 'contexto', _texto_juego(it -> 'contexto', 600),
      'resultado', _texto_juego(it -> 'resultado', 600), 'clase', it ->> 'clase',
      'opciones', v_ops, 'pistas', v_pistas));
  END LOOP;

  PERFORM _guardar_juego(p_libro, 'corazonadas', jsonb_set(v_actual, '{corazonadas}', v_nuevo));
END;
$fn$;

-- Cápsula: p_preguntas = [{id | null, texto}] en orden (1 a 8). id null =
-- pregunta nueva. Las que no vengan se quitan.
CREATE OR REPLACE FUNCTION public.editar_capsula(p_libro uuid, p_preguntas jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actual jsonb;
  v_nuevo  jsonb := '[]'::jsonb;
  it       jsonb;
  pq       jsonb;
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  SELECT datos INTO v_actual FROM capsula_contenido WHERE libro_id = p_libro;
  IF v_actual IS NULL THEN
    RAISE EXCEPTION 'Este libro todavía no tiene Cápsula del tiempo.' USING ERRCODE = 'P0002', HINT = 'formato';
  END IF;
  IF jsonb_typeof(p_preguntas) <> 'array' OR jsonb_array_length(p_preguntas) NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'La cápsula lleva entre 1 y 8 preguntas.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_preguntas) LOOP
    IF _texto_juego(it -> 'texto', 200) IS NULL THEN
      RAISE EXCEPTION 'Las preguntas no pueden quedar vacías (hasta 200 letras).' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    IF it ->> 'id' IS NULL THEN
      pq := jsonb_build_object('id', 'a' || substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    ELSE
      SELECT p INTO pq FROM jsonb_array_elements(v_actual -> 'preguntas') p WHERE p ->> 'id' = it ->> 'id';
      IF pq IS NULL THEN
        RAISE EXCEPTION 'Una pregunta ya no está. Recarga la página.' USING ERRCODE = '22023', HINT = 'formato';
      END IF;
    END IF;
    v_nuevo := v_nuevo || jsonb_build_array(pq || jsonb_build_object('texto', _texto_juego(it -> 'texto', 200)));
  END LOOP;
  PERFORM _guardar_juego(p_libro, 'capsula', jsonb_set(v_actual, '{preguntas}', v_nuevo));
END;
$fn$;

-- Volver al original (el que preparó Juan).
CREATE OR REPLACE FUNCTION public.restaurar_juego(p_libro uuid, p_juego text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_orig jsonb;
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  SELECT datos INTO v_orig FROM juegos_originales WHERE libro_id = p_libro AND juego = p_juego;
  IF v_orig IS NULL THEN RETURN; END IF;
  EXECUTE format('UPDATE %I SET datos = $2, version = version + 1, actualizado_at = now() WHERE libro_id = $1',
                 p_juego || '_contenido') USING p_libro, v_orig;
  DELETE FROM juegos_originales WHERE libro_id = p_libro AND juego = p_juego;
END;
$fn$;

REVOKE ALL ON FUNCTION public.juego_escritor(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.editar_corazonadas(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.editar_capsula(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restaurar_juego(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.juego_escritor(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_corazonadas(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_capsula(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurar_juego(uuid, text) TO authenticated;
