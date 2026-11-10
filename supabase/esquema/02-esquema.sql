-- =============================================================
-- INMERSIA — Esquema public (tablas, funciones, RLS, políticas, permisos)
-- Volcado de producción del 2026-11-10 con `npm run esquema`.
-- NO SE EDITA A MANO: se regenera. Cómo restaurarlo:
-- Documentation/base-de-datos/respaldo-estructura.md
-- =============================================================

--
-- PostgreSQL database dump
--

\restrict inmersia

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: _alta_en_aula(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._alta_en_aula(p_user uuid, p_codigo text, p_nombre text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_aula   uuid;
  v_nombre text := nullif(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), '');
BEGIN
  SELECT cc.comunidad_id INTO v_aula
  FROM comunidad_codigos cc JOIN comunidades co ON co.id = cc.comunidad_id
  WHERE cc.codigo = upper(btrim(p_codigo)) AND co.colegio_id IS NOT NULL;

  IF v_aula IS NULL OR v_nombre IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO comunidad_miembros (comunidad_id, user_id, rol, nombre_en_aula)
  VALUES (v_aula, p_user, 'miembro', v_nombre)
  ON CONFLICT (comunidad_id, user_id) DO UPDATE SET nombre_en_aula = EXCLUDED.nombre_en_aula;
  PERFORM _dar_libro_aula(v_aula, p_user);
  RETURN v_aula;
END;
$$;


--
-- Name: _alumnos_aula(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._alumnos_aula(p_aula uuid, p_zona text) RETURNS TABLE(user_id uuid, nombre text, porcentaje integer, capitulos_hechos integer, capitulo_actual integer, caps_detras integer, estado text, minutos_semana integer, dias_semana integer, dias_lectura text, dias_sin_abrir integer, ultima_lectura timestamp with time zone, rapido boolean, caps_rapidos integer, predicciones integer, subrayados integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH meta AS (SELECT * FROM _meta_aula(p_aula, p_zona)),
  palabras AS (
    SELECT sum(c.palabras)::numeric AS total FROM capitulos c WHERE c.libro_id = (SELECT libro_id FROM meta)
  ),
  miembros AS (
    SELECT m.user_id, m.nombre_en_aula FROM comunidad_miembros m
    WHERE m.comunidad_id = p_aula AND m.rol = 'miembro'
  ),
  ses AS (
    SELECT s.user_id, s.started_at,
           coalesce(s.segundos_activos,
                    CASE WHEN s.ended_at IS NULL THEN 0
                         ELSE least(extract(epoch FROM s.ended_at - s.started_at), 7200) END) AS seg
    FROM sesiones_lectura s
    WHERE s.libro_id = (SELECT libro_id FROM meta) AND s.user_id IN (SELECT user_id FROM miembros)
  ),
  -- Tramos entre capítulos terminados: palabras del tramo / minutos de reloj.
  tramos AS (
    SELECT t.user_id, t.capitulo - t.anterior AS caps,
           (SELECT sum(c.palabras) FROM capitulos c
            WHERE c.libro_id = (SELECT libro_id FROM meta) AND c.numero > t.anterior AND c.numero <= t.capitulo) AS palabras,
           extract(epoch FROM t.terminado_at - t.antes) / 60 AS minutos
    FROM (
      SELECT g.user_id, g.capitulo, g.terminado_at,
             lag(g.capitulo)     OVER (PARTITION BY g.user_id ORDER BY g.capitulo) AS anterior,
             lag(g.terminado_at) OVER (PARTITION BY g.user_id ORDER BY g.capitulo) AS antes
      FROM progreso_capitulos_log g
      WHERE g.libro_id = (SELECT libro_id FROM meta) AND g.user_id IN (SELECT user_id FROM miembros)
    ) t
    WHERE t.anterior IS NOT NULL
  ),
  base AS (
    SELECT
      mi.user_id,
      coalesce(mi.nombre_en_aula, nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Lector') AS nombre,
      coalesce(pl.porcentaje, 0)::int AS porcentaje,
      coalesce(pl.capitulos_completados, 0)::int AS hechos,
      least(coalesce(pl.capitulos_completados, 0) + 1, greatest((SELECT total_capitulos FROM meta), 1))::int AS actual,
      tot.seg_total, tot.ultima, sem.seg AS seg_semana, sem.dias,
      (SELECT string_agg(CASE WHEN EXISTS (
                SELECT 1 FROM ses s2
                WHERE s2.user_id = mi.user_id
                  AND (s2.started_at AT TIME ZONE p_zona)::date = (now() AT TIME ZONE p_zona)::date - d)
              THEN 'x' ELSE '.' END, '' ORDER BY d DESC)
       FROM generate_series(0, 6) d) AS dias_lectura,
      (SELECT count(*) FROM predicciones_usuario pr
       WHERE pr.user_id = mi.user_id AND pr.libro_id = (SELECT libro_id FROM meta) AND btrim(pr.contenido) <> '')::int AS predicciones,
      (SELECT count(*) FROM subrayados_usuario su
       WHERE su.user_id = mi.user_id AND su.libro_id = (SELECT libro_id FROM meta))::int AS subrayados,
      (SELECT coalesce(sum(tr.caps), 0) FROM tramos tr
       WHERE tr.user_id = mi.user_id AND tr.palabras >= 1000
         AND tr.palabras / greatest(tr.minutos, 0.1) > 600)::int AS caps_rapidos
    FROM miembros mi
    LEFT JOIN perfiles pf ON pf.id = mi.user_id
    LEFT JOIN progreso_lectura pl ON pl.user_id = mi.user_id AND pl.libro_id = (SELECT libro_id FROM meta)
    LEFT JOIN LATERAL (
      SELECT sum(ses.seg) AS seg_total, max(ses.started_at) AS ultima FROM ses WHERE ses.user_id = mi.user_id
    ) tot ON true
    LEFT JOIN LATERAL (
      SELECT sum(ses.seg) AS seg, count(DISTINCT (ses.started_at AT TIME ZONE p_zona)::date) AS dias
      FROM ses WHERE ses.user_id = mi.user_id AND ses.started_at >= now() - interval '7 days'
    ) sem ON true
  )
  SELECT
    b.user_id, b.nombre, b.porcentaje, b.hechos, b.actual,
    CASE WHEN (SELECT meta_capitulo FROM meta) IS NULL THEN NULL
         ELSE (SELECT meta_capitulo FROM meta) - b.actual END,
    CASE
      WHEN (SELECT libro_id FROM meta) IS NULL THEN NULL
      WHEN b.porcentaje >= 100 THEN 'terminado'
      WHEN b.porcentaje = 0 AND b.seg_total IS NULL THEN 'sin_empezar'
      WHEN (SELECT meta_capitulo FROM meta) IS NULL THEN NULL
      WHEN (SELECT meta_capitulo FROM meta) - b.actual <= 0 THEN 'al_dia'
      WHEN (SELECT meta_capitulo FROM meta) - b.actual <= 3 THEN 'poco_atras'
      ELSE 'atrasado'
    END,
    coalesce(b.seg_semana, 0)::int / 60,
    coalesce(b.dias, 0)::int,
    b.dias_lectura,
    CASE WHEN b.ultima IS NULL THEN NULL
         ELSE ((now() AT TIME ZONE p_zona)::date - (b.ultima AT TIME ZONE p_zona)::date) END,
    b.ultima,
    -- Sin sesiones (p. ej. avance rescatado de la muestra) no hay velocidad.
    coalesce(
      b.seg_total > 0
      AND (SELECT total FROM palabras) * b.porcentaje / 100 >= 2000
      AND (SELECT total FROM palabras) * b.porcentaje / 100 / greatest(b.seg_total / 60, 1) > 600,
      false),
    b.caps_rapidos,
    b.predicciones,
    b.subrayados
  FROM base b;
$$;


--
-- Name: _anderson_estado(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._anderson_estado(p_user uuid, p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
    'faltaron', CASE WHEN v_total > 0 AND v_cc >= v_total AND _ovillos_saldo(p_user, p_libro) < 1 THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'pj', ra.pj, 'texto', ra.texto,
        'pistas', (SELECT coalesce(jsonb_agg(pi.resumen ORDER BY pi.o), '[]'::jsonb) FROM pi WHERE pi.id = ANY (ra.pool))
      ) ORDER BY ra.o)
      FROM ra WHERE ra.pendiente), '[]'::jsonb) END
  ) INTO v_res;

  RETURN v_res;
END;
$$;


--
-- Name: _asignar_manual(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._asignar_manual(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO bibliotecas_usuarios (user_id, libro_id, leido)
  VALUES (p_user_id, '00000000-0000-4000-8000-000000000001', false)
  ON CONFLICT (user_id, libro_id) DO NOTHING;
END;
$$;


--
-- Name: _aulas_de_alumno(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._aulas_de_alumno(p_user uuid) RETURNS TABLE(aula_id uuid, nombre text, libro_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT co.id, co.nombre, co.libro_id
  FROM comunidad_miembros m JOIN comunidades co ON co.id = m.comunidad_id
  WHERE m.user_id = p_user AND m.rol = 'miembro' AND co.colegio_id IS NOT NULL;
$$;


--
-- Name: _bote_juntado(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._bote_juntado(p_rec uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(sum(cantidad), 0)::int FROM recompensas_aportes WHERE recompensa_id = p_rec;
$$;


--
-- Name: _capsula_estado(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._capsula_estado(p_user uuid, p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: _capsula_limpiar(text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._capsula_limpiar(p_respuestas text[], p_n integer) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
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
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: desafio_charlas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.desafio_charlas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    version integer NOT NULL,
    momento text NOT NULL,
    pregunta text NOT NULL,
    tipo text NOT NULL,
    estado text DEFAULT 'abierta'::text NOT NULL,
    turnos jsonb DEFAULT '[]'::jsonb NOT NULL,
    resumen jsonb,
    evaluando_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    terminada_at timestamp with time zone,
    nota smallint,
    comentario text,
    nota_por uuid,
    nota_at timestamp with time zone,
    CONSTRAINT desafio_charlas_check CHECK (((estado = 'terminada'::text) = (terminada_at IS NOT NULL))),
    CONSTRAINT desafio_charlas_comentario_largo CHECK ((length(comentario) <= 1000)),
    CONSTRAINT desafio_charlas_estado_check CHECK ((estado = ANY (ARRAY['abierta'::text, 'evaluando'::text, 'terminada'::text]))),
    CONSTRAINT desafio_charlas_momento_check CHECK ((momento = ANY (ARRAY['mitad'::text, 'final'::text]))),
    CONSTRAINT desafio_charlas_nota_rango CHECK (((nota >= 0) AND (nota <= 20))),
    CONSTRAINT desafio_charlas_turnos_check CHECK ((jsonb_typeof(turnos) = 'array'::text))
);


--
-- Name: TABLE desafio_charlas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.desafio_charlas IS 'Una fila por alumno, libro y momento del desafío: la charla con el gato y el resumen para el profe. Guarda el texto del alumno (lo lee su profe). Solo escriben las funciones desafio_*. Ver migración 092.';


--
-- Name: COLUMN desafio_charlas.nota; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.desafio_charlas.nota IS 'Nota del profe, de 0 a 20. La pone el profe con desafio_calificar; el alumno la ve en su Cuaderno. Ver migración 094.';


--
-- Name: COLUMN desafio_charlas.comentario; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.desafio_charlas.comentario IS 'Comentario libre del profe sobre la charla (máx. 1000). El alumno lo ve. Ver migración 094.';


--
-- Name: _charla_de_alumno(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._charla_de_alumno(p_aula uuid, p_user uuid, p_momento text) RETURNS public.desafio_charlas
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_libro uuid;
  v_ch    desafio_charlas%ROWTYPE;
BEGIN
  PERFORM _profe_de_aula(p_aula);
  IF NOT EXISTS (SELECT 1 FROM comunidad_miembros
                 WHERE comunidad_id = p_aula AND user_id = p_user AND rol = 'miembro') THEN
    RAISE EXCEPTION 'Ese alumno no está en esta aula.';
  END IF;
  SELECT libro_id INTO v_libro FROM _meta_aula(p_aula, 'UTC');
  SELECT * INTO v_ch FROM desafio_charlas
  WHERE user_id = p_user AND libro_id = v_libro AND momento = p_momento;
  IF v_ch.id IS NULL THEN
    RAISE EXCEPTION 'Ese alumno todavía no hizo este desafío.';
  END IF;
  RETURN v_ch;
END;
$$;


--
-- Name: _check_usuario_sin_sesion_activa(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._check_usuario_sin_sesion_activa() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM chat_sesiones
    WHERE usuario_a = NEW.usuario_a
       OR usuario_b = NEW.usuario_a
       OR usuario_a = NEW.usuario_b
       OR usuario_b = NEW.usuario_b
  ) THEN
    RAISE EXCEPTION 'El usuario ya tiene una sesión de chat activa';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: _codigo_colegio(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._codigo_colegio(prefijo text) RETURNS text
    LANGUAGE sql
    AS $$
  SELECT prefijo || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;


--
-- Name: _colegio_ultimo_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._colegio_ultimo_admin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id)
     AND EXISTS (SELECT 1 FROM colegios WHERE id = OLD.colegio_id)
     AND NOT EXISTS (
       SELECT 1 FROM colegio_admins
       WHERE colegio_id = OLD.colegio_id AND user_id <> OLD.user_id
     ) THEN
    RAISE EXCEPTION 'El colegio tiene que quedar con al menos un administrador.'
      USING ERRCODE = 'P0001', HINT = 'ultimo_admin';
  END IF;
  RETURN OLD;
END;
$$;


--
-- Name: _comunidad_al_crear(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._comunidad_al_crear() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.colegio_id IS NULL THEN
    INSERT INTO comunidad_miembros (comunidad_id, user_id, rol)
    VALUES (NEW.id, NEW.creador_id, 'moderador');
  END IF;

  INSERT INTO comunidad_codigos (comunidad_id) VALUES (NEW.id);

  IF NEW.colegio_id IS NOT NULL THEN
    INSERT INTO colegio_codigos (codigo, colegio_id, tipo, comunidad_id)
    VALUES (_codigo_colegio('PROF'), NEW.colegio_id, 'profesor', NEW.id);
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: _comunidad_cambio_libro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._comunidad_cambio_libro() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.libro_id IS NOT DISTINCT FROM OLD.libro_id THEN
    RETURN NULL;
  END IF;

  UPDATE comunidad_lecturas SET fin = now()
  WHERE comunidad_id = NEW.id AND fin IS NULL;

  IF NEW.libro_id IS NOT NULL THEN
    INSERT INTO comunidad_lecturas (comunidad_id, libro_id) VALUES (NEW.id, NEW.libro_id);
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: _comunidad_poner_codigo(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._comunidad_poner_codigo(p_comunidad uuid, p_codigo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT es_moderador(p_comunidad) THEN
    RAISE EXCEPTION 'Solo el moderador puede cambiar el código.' USING ERRCODE = '42501';
  END IF;
  UPDATE comunidad_codigos SET codigo = p_codigo WHERE comunidad_id = p_comunidad;
END;
$$;


--
-- Name: _comunidad_tope_miembro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._comunidad_tope_miembro() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  TOPE_COMUNIDADES CONSTANT int := 5;
BEGIN
  IF EXISTS (SELECT 1 FROM comunidades WHERE id = NEW.comunidad_id AND colegio_id IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  IF (
    SELECT count(*) FROM comunidad_miembros m
    JOIN comunidades c ON c.id = m.comunidad_id
    WHERE m.user_id = NEW.user_id AND c.colegio_id IS NULL
  ) >= TOPE_COMUNIDADES THEN
    RAISE EXCEPTION 'Ya estás en % comunidades, el máximo permitido.', TOPE_COMUNIDADES
      USING ERRCODE = 'P0001', HINT = 'tope_comunidades';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: _comunidad_tras_baja(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._comunidad_tras_baja() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  heredero uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM comunidades WHERE id = OLD.comunidad_id) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM comunidades WHERE id = OLD.comunidad_id AND colegio_id IS NOT NULL) THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM comunidad_miembros WHERE comunidad_id = OLD.comunidad_id) THEN
    DELETE FROM comunidades WHERE id = OLD.comunidad_id;
    RETURN NULL;
  END IF;

  IF OLD.rol = 'moderador' AND NOT EXISTS (
    SELECT 1 FROM comunidad_miembros
    WHERE comunidad_id = OLD.comunidad_id AND rol = 'moderador'
  ) THEN
    SELECT user_id INTO heredero
    FROM comunidad_miembros
    WHERE comunidad_id = OLD.comunidad_id
    ORDER BY unido_at, user_id
    LIMIT 1;

    UPDATE comunidad_miembros SET rol = 'moderador'
    WHERE comunidad_id = OLD.comunidad_id AND user_id = heredero;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: _concurso_estado(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._concurso_estado(p_user uuid, p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: _concurso_frase(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._concurso_frase(p_user uuid, p_libro uuid, p_frase text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_x jsonb;
BEGIN
  SELECT x INTO v_x FROM _concurso_frases(p_user, p_libro) x WHERE x->>'id' = p_frase;
  IF v_x IS NULL THEN
    RAISE EXCEPTION 'Esa frase no te toca.';
  END IF;
  RETURN v_x;
END;
$$;


--
-- Name: _concurso_frases(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._concurso_frases(p_user uuid, p_libro uuid) RETURNS SETOF jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: _corazonadas_estado(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._corazonadas_estado(p_user uuid, p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: _crear_foro_para_libro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._crear_foro_para_libro() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO foros (libro_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;


--
-- Name: _crear_perfil(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._crear_perfil(p_user_id uuid, p_meta jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_completo text   := btrim(coalesce(nullif(p_meta->>'full_name', ''), p_meta->>'name', ''));
  v_partes   text[] := regexp_split_to_array(v_completo, '\s+');
  v_fecha    date;
  v_genero   text   := p_meta->>'genero';
BEGIN
  BEGIN
    v_fecha := nullif(p_meta->>'fecha_nacimiento', '')::date;
  EXCEPTION WHEN others THEN
    v_fecha := NULL;
  END;

  IF v_genero NOT IN ('masculino', 'femenino', 'diverso') THEN
    v_genero := NULL;
  END IF;

  INSERT INTO perfiles (id, nombre, apellido, fecha_nacimiento, genero)
  VALUES (
    p_user_id,
    coalesce(nullif(p_meta->>'nombre', ''), nullif(p_meta->>'given_name', ''), v_partes[1], ''),
    coalesce(nullif(p_meta->>'apellido', ''), nullif(p_meta->>'family_name', ''),
             array_to_string(v_partes[2:], ' ')),
    v_fecha,
    v_genero
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;


--
-- Name: _dar_libro_aula(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._dar_libro_aula(p_aula uuid, p_user uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_libro uuid;
BEGIN
  SELECT cl.libro_id INTO v_libro
  FROM comunidad_lecturas cl JOIN comunidades co ON co.id = cl.comunidad_id
  WHERE cl.comunidad_id = p_aula AND cl.fin IS NULL AND co.colegio_id IS NOT NULL
  LIMIT 1;
  IF v_libro IS NULL THEN RETURN; END IF;

  INSERT INTO bibliotecas_usuarios (user_id, libro_id, leido, de_aula)
  SELECT m.user_id, v_libro, false, true
  FROM comunidad_miembros m
  WHERE m.comunidad_id = p_aula AND (p_user IS NULL OR m.user_id = p_user)
  ON CONFLICT (user_id, libro_id) DO UPDATE SET de_aula = true;
END;
$$;


--
-- Name: _denuncia_copiar_contenido(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._denuncia_copiar_contenido() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_texto      text;
  v_comunidad  uuid;
  v_autor      uuid;
  v_libro      uuid;
  v_parrafo    uuid;
  v_ok         boolean := false;
BEGIN
  IF NEW.tipo = 'foro' THEN
    SELECT contenido, comunidad_id, autor_id INTO v_texto, v_comunidad, v_autor
    FROM foros_comentarios
    WHERE id = NEW.objeto_id AND (comunidad_id IS NULL OR es_miembro(comunidad_id));
    v_ok := FOUND;

  ELSIF NEW.tipo = 'comentario_lectura' THEN
    SELECT contenido, comunidad_id, autor_id, libro_id, parrafo_id
      INTO v_texto, v_comunidad, v_autor, v_libro, v_parrafo
    FROM comentarios_lectura
    WHERE id = NEW.objeto_id AND es_miembro(comunidad_id);
    v_ok := FOUND;

  ELSIF NEW.tipo = 'mensajito' THEN
    SELECT contenido, comunidad_id, de_id, libro_id, parrafo_id
      INTO v_texto, v_comunidad, v_autor, v_libro, v_parrafo
    FROM mensajitos
    WHERE id = NEW.objeto_id AND auth.uid() IN (de_id, para_id);
    v_ok := FOUND;

  ELSIF NEW.tipo = 'comunidad' THEN
    SELECT nombre || coalesce(E'\n\n' || descripcion, ''), id, libro_id
      INTO v_texto, v_comunidad, v_libro
    FROM comunidades
    WHERE id = NEW.objeto_id AND (NOT privada OR es_miembro(id));
    v_ok := FOUND;
    IF v_ok THEN
      -- "Quién la escribió" = quien la modera ahora (el más antiguo si hay varios)
      SELECT user_id INTO v_autor
      FROM comunidad_miembros
      WHERE comunidad_id = NEW.objeto_id AND rol = 'moderador'
      ORDER BY unido_at LIMIT 1;
    END IF;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'No se encontró lo que quieres denunciar.' USING ERRCODE = 'P0002';
  END IF;

  NEW.contenido_denunciado := v_texto;
  NEW.comunidad_id         := v_comunidad;
  NEW.denunciado_id        := v_autor;
  NEW.libro_id             := v_libro;
  NEW.parrafo_id           := v_parrafo;
  NEW.estado               := 'pendiente';
  NEW.resolucion           := NULL;
  NEW.resuelta_at          := NULL;
  RETURN NEW;
END;
$$;


--
-- Name: _desafio_estado(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._desafio_estado(p_user uuid, p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
                              FROM jsonb_array_elements(ch.turnos) WITH ORDINALITY x(t, o)), '[]'::jsonb),
          'nota', ch.nota,
          'comentario', ch.comentario)
        ORDER BY mo.orden)
      FROM (VALUES ('mitad', 1), ('final', 2)) mo(momento, orden)
      CROSS JOIN LATERAL _desafio_pregunta(p_user, p_libro, mo.momento) q
      LEFT JOIN desafio_charlas ch
        ON ch.user_id = p_user AND ch.libro_id = p_libro AND ch.momento = mo.momento
      WHERE q IS NOT NULL), '[]'::jsonb)
  );
END;
$$;


--
-- Name: _desafio_pregunta(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._desafio_pregunta(p_user uuid, p_libro uuid, p_momento text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT q || jsonb_build_object('tras_capitulo', (m->>'tras_capitulo')::int)
  FROM desafio_contenido c,
       jsonb_array_elements(c.datos->'momentos') m,
       jsonb_array_elements(m->'preguntas') q
  WHERE c.libro_id = p_libro AND m->>'momento' = p_momento
  ORDER BY (q->>'id') IS DISTINCT FROM (SELECT ch.pregunta FROM desafio_charlas ch
                                        WHERE ch.user_id = p_user AND ch.libro_id = p_libro AND ch.momento = p_momento),
           md5(p_user || ':' || p_libro || ':' || (q->>'id'))
  LIMIT 1;
$$;


--
-- Name: _desafio_turnos_alumno(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._desafio_turnos_alumno(p_turnos jsonb) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT count(*)::int FROM jsonb_array_elements(p_turnos) t WHERE t->>'de' = 'alumno';
$$;


--
-- Name: _edad(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._edad(p_fecha date) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
  SELECT CASE WHEN p_fecha IS NULL THEN NULL
              ELSE extract(year FROM age(current_date, p_fecha))::int END;
$$;


--
-- Name: _falsificador_estado(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._falsificador_estado(p_user uuid, p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_datos jsonb;
BEGIN
  SELECT datos INTO v_datos FROM falsificador_contenido WHERE libro_id = p_libro;
  IF v_datos IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'saldo', _ovillos_saldo(p_user, p_libro),
    'autor', v_datos->'autor',
    'items', coalesce((
      SELECT jsonb_agg(
               jsonb_build_object('id', x->>'id', 'cap', (x->>'cap')::int, 'parrafo', (x->>'parrafo')::int)
               || CASE WHEN (x->>'falso')::boolean THEN jsonb_build_object('texto', x->>'texto') ELSE '{}'::jsonb END
               || CASE WHEN j.id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('respuesta',
                    jsonb_strip_nulls(jsonb_build_object('dijo', j.dijo, 'acierto', j.acierto,
                      'falso', (x->>'falso')::boolean, 'raro', x->>'raro', 'verdad', x->>'verdad'))) END
               ORDER BY o)
      FROM jsonb_array_elements(v_datos->'items') WITH ORDINALITY AS t(x, o)
      LEFT JOIN falsificador_jugadas j
        ON j.user_id = p_user AND j.libro_id = p_libro AND j.item = x->>'id'), '[]'::jsonb));
END;
$$;


--
-- Name: _juegos_aula_por_defecto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._juegos_aula_por_defecto() RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT '{"mesa": true, "corazonadas": true, "mapa": true, "concurso": true, "desafio": true,
           "capsula": true, "hilo": true, "falsificador": false, "explicaselo": false}'::jsonb;
$$;


--
-- Name: _juegos_mezclar(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._juegos_mezclar(p_base jsonb, p_elegido jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT jsonb_object_agg(k, CASE WHEN jsonb_typeof(p_elegido->k) = 'boolean' THEN p_elegido->k ELSE p_base->k END)
  FROM jsonb_object_keys(p_base) k;
$$;


--
-- Name: _juegos_por_defecto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._juegos_por_defecto() RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT '{"mesa": true, "corazonadas": true, "mapa": true, "concurso": false, "desafio": false,
           "capsula": true, "hilo": true, "falsificador": false, "explicaselo": false}'::jsonb;
$$;


--
-- Name: _lectura_aula_dar_libro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._lectura_aula_dar_libro() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM _dar_libro_aula(NEW.comunidad_id);
  RETURN NULL;
END;
$$;


--
-- Name: _llego_al_capitulo(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._llego_al_capitulo(p_user uuid, p_libro uuid, p_cap integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM bibliotecas_usuarios WHERE user_id = p_user AND libro_id = p_libro)
     AND coalesce((SELECT max(capitulos_completados) FROM progreso_lectura
                   WHERE user_id = p_user AND libro_id = p_libro), 0) >= coalesce(p_cap, 1) - 1;
$$;


--
-- Name: _log_capitulo_terminado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._log_capitulo_terminado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.capitulos_completados > coalesce(OLD.capitulos_completados, 0) THEN
    INSERT INTO progreso_capitulos_log (user_id, libro_id, capitulo)
    VALUES (NEW.user_id, NEW.libro_id, NEW.capitulos_completados)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: _mapa_estado(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._mapa_estado(p_user uuid, p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: _mapa_norm(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._mapa_norm(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT btrim(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
           '[–—-]+', '-', 'g'), '[«»“”"]', '"', 'g'), '\s+', ' ', 'g'));
$$;


--
-- Name: _meta_aula(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._meta_aula(p_aula uuid, p_zona text) RETURNS TABLE(libro_id uuid, inicio timestamp with time zone, fecha_meta date, total_capitulos integer, esperado numeric, meta_capitulo integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH lec AS (
    SELECT cl.libro_id, cl.inicio, cl.fecha_meta
    FROM comunidad_lecturas cl
    WHERE cl.comunidad_id = p_aula AND cl.fin IS NULL
    LIMIT 1
  ),
  caps AS (
    SELECT c.numero, c.palabras,
           sum(c.palabras) OVER (ORDER BY c.numero) AS acum,
           sum(c.palabras) OVER () AS total,
           count(*) OVER () AS n,
           bool_or(c.palabras IS NULL OR c.palabras = 0) OVER () AS faltan
    FROM capitulos c JOIN lec ON c.libro_id = lec.libro_id
  ),
  esp AS (
    SELECT CASE WHEN lec.fecha_meta IS NULL THEN NULL ELSE
      100 * greatest(0, least(1,
        extract(epoch FROM now() - lec.inicio)
        / nullif(extract(epoch FROM ((lec.fecha_meta + 1)::timestamp AT TIME ZONE p_zona) - lec.inicio), 0)))
    END AS pct
    FROM lec
  )
  SELECT
    lec.libro_id, lec.inicio, lec.fecha_meta,
    (SELECT count(*)::int FROM caps),
    round((SELECT pct FROM esp), 1),
    CASE
      WHEN (SELECT pct FROM esp) IS NULL THEN NULL
      WHEN (SELECT bool_or(faltan) FROM caps) THEN
        greatest(1, ceil((SELECT pct FROM esp) / 100 * (SELECT count(*) FROM caps)))::int
      ELSE coalesce(
        (SELECT min(numero) FROM caps WHERE acum >= (SELECT pct FROM esp) / 100 * total AND acum > 0),
        (SELECT max(numero) FROM caps))
    END
  FROM lec;
$$;


--
-- Name: _nombre_en_aula(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._nombre_en_aula(p_aula uuid, p_user uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(
    (SELECT coalesce(m.nombre_en_aula, nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''))
     FROM comunidad_miembros m LEFT JOIN perfiles pf ON pf.id = m.user_id
     WHERE m.comunidad_id = p_aula AND m.user_id = p_user),
    'Lector');
$$;


--
-- Name: _ovillos_saldo(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._ovillos_saldo(p_user uuid, p_libro uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 10
       + 2 * coalesce((SELECT max(capitulos_completados) FROM progreso_lectura
                       WHERE user_id = p_user AND libro_id = p_libro), 0)
       + coalesce((SELECT sum(cantidad) FROM ovillos_movimientos
                   WHERE user_id = p_user AND libro_id = p_libro), 0)::int;
$$;


--
-- Name: _profe_de_aula(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._profe_de_aula(p_aula uuid) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM comunidades WHERE id = p_aula AND colegio_id IS NOT NULL)
     OR NOT (es_admin_de_aula(p_aula) OR es_moderador(p_aula)) THEN
    RAISE EXCEPTION 'Solo el colegio ve los datos de esta aula.' USING ERRCODE = '42501';
  END IF;
END;
$$;


--
-- Name: _recompensa_bloqueo(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._recompensa_bloqueo(p_user uuid, p_rec uuid, p_libro uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE r.limite
    WHEN 'alumno' THEN CASE WHEN EXISTS (
        SELECT 1 FROM recompensas_canjes c WHERE c.recompensa_id = r.id AND c.libro_id = p_libro
          AND c.user_id = p_user AND c.estado <> 'devuelto') THEN 'ya_canjeado' END
    WHEN 'semana' THEN CASE WHEN EXISTS (
        SELECT 1 FROM recompensas_canjes c WHERE c.recompensa_id = r.id
          AND c.user_id = p_user AND c.estado <> 'devuelto' AND c.created_at > now() - interval '7 days') THEN 'esta_semana' END
    WHEN 'clase' THEN CASE WHEN EXISTS (
        SELECT 1 FROM recompensas_canjes c WHERE c.recompensa_id = r.id AND c.libro_id = p_libro
          AND c.estado <> 'devuelto') THEN 'agotado' END
    WHEN 'bote' THEN CASE WHEN r.entregado_at IS NOT NULL THEN 'entregado'
                          WHEN _bote_juntado(r.id) >= r.precio THEN 'lleno' END
    ELSE NULL END
  FROM recompensas r WHERE r.id = p_rec;
$$;


--
-- Name: _referencia_ovillos(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._referencia_ovillos(p_libro uuid, p_juegos jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  -- En un aula, el juego que el profe no tocó va como en _juegos_aula_por_defecto (093/098).
  v_on    jsonb := _juegos_mezclar(_juegos_aula_por_defecto(), coalesce(p_juegos, '{}'::jsonb));
  v_leer  int;
  v_mesa  int;
  v_cz    int;
  v_mapa  int;
  v_fx    int;
  v_cc    int := 0;
  v_ccmin int := 0;
  v_ccmax int := 0;
  v_apag  text[] := '{}';
BEGIN
  v_leer := 10 + 2 * (SELECT count(*) FROM capitulos WHERE libro_id = p_libro)::int;

  v_mesa := coalesce((SELECT jsonb_array_length(datos->'rasgos') * 2 FROM anderson_contenido WHERE libro_id = p_libro), 0);
  v_cz   := coalesce((SELECT jsonb_array_length(datos->'corazonadas') * 3 FROM corazonadas_contenido WHERE libro_id = p_libro), 0);
  v_mapa := coalesce((SELECT jsonb_array_length(datos->'tesoros') FROM mapa_contenido WHERE libro_id = p_libro), 0);
  v_fx   := coalesce((SELECT jsonb_array_length(datos->'items') FROM falsificador_contenido WHERE libro_id = p_libro), 0);
  SELECT coalesce(round(sum(CASE WHEN n >= 2 THEN 1.5 ELSE 1 END) * 3), 0)::int,
         coalesce(count(*) * 3, 0)::int,
         coalesce(sum(least(n, 2)) * 3, 0)::int
  INTO v_cc, v_ccmin, v_ccmax
  FROM (SELECT f->>'cap' AS cap, count(*) AS n
        FROM concurso_contenido c, jsonb_array_elements(c.datos->'frases') f
        WHERE c.libro_id = p_libro GROUP BY 1) s;

  IF NOT (v_on->>'mesa')::boolean         AND v_mesa > 0 THEN v_apag := v_apag || 'mesa'::text;         v_mesa := 0; END IF;
  IF NOT (v_on->>'corazonadas')::boolean  AND v_cz   > 0 THEN v_apag := v_apag || 'corazonadas'::text;  v_cz   := 0; END IF;
  IF NOT (v_on->>'mapa')::boolean         AND v_mapa > 0 THEN v_apag := v_apag || 'mapa'::text;         v_mapa := 0; END IF;
  IF NOT (v_on->>'falsificador')::boolean AND v_fx   > 0 THEN v_apag := v_apag || 'falsificador'::text; v_fx   := 0; END IF;
  IF NOT (v_on->>'concurso')::boolean     AND v_cc   > 0 THEN
    v_apag := v_apag || 'concurso'::text; v_cc := 0; v_ccmin := 0; v_ccmax := 0;
  END IF;

  RETURN jsonb_build_object(
    'solo_leyendo', v_leer,
    'maximo', v_leer + v_mesa + v_cz + v_mapa + v_cc + v_fx,
    'desglose', jsonb_build_object('lectura', v_leer, 'mesa', v_mesa, 'corazonadas', v_cz,
                                   'mapa', v_mapa, 'concurso', v_cc, 'falsificador', v_fx),
    'concurso_rango', jsonb_build_array(v_ccmin, v_ccmax),
    'apagados', to_jsonb(v_apag));
END;
$$;


--
-- Name: _trg_fecha_menor_con_aula(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._trg_fecha_menor_con_aula() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_edad int := _edad(NEW.fecha_nacimiento);
BEGIN
  IF v_edad IS NULL OR v_edad >= 14 THEN
    RETURN NEW;
  END IF;
  IF v_edad < 12 THEN
    RAISE EXCEPTION 'Inmersia es para alumnos desde los 12 años.' USING ERRCODE = '42501', HINT = 'menor_de_12';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM comunidad_miembros m JOIN comunidades co ON co.id = m.comunidad_id
    WHERE m.user_id = NEW.id AND m.rol = 'miembro' AND co.colegio_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Con 12 o 13 años hace falta el código de tu aula.' USING ERRCODE = '42501', HINT = 'menor_sin_aula';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: _trg_fecha_nacimiento_fija(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._trg_fecha_nacimiento_fija() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.fecha_nacimiento IS NOT NULL
     AND NEW.fecha_nacimiento IS DISTINCT FROM OLD.fecha_nacimiento
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'La fecha de nacimiento no se puede cambiar.'
      USING ERRCODE = '42501', HINT = 'fecha_fija';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: _trg_menor_no_sale_del_aula(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._trg_menor_no_sale_del_aula() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.rol = 'miembro'
     AND auth.uid() = OLD.user_id
     AND EXISTS (SELECT 1 FROM comunidades WHERE id = OLD.comunidad_id AND colegio_id IS NOT NULL)
     AND EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id)
     AND (SELECT _edad(fecha_nacimiento) FROM perfiles WHERE id = OLD.user_id) < 14
     AND NOT EXISTS (
       SELECT 1 FROM comunidad_miembros m JOIN comunidades co ON co.id = m.comunidad_id
       WHERE m.user_id = OLD.user_id AND m.comunidad_id <> OLD.comunidad_id
         AND m.rol = 'miembro' AND co.colegio_id IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Para salir de tu aula, habla con tu profesor.' USING ERRCODE = '42501', HINT = 'menor_unica_aula';
  END IF;
  RETURN OLD;
END;
$$;


--
-- Name: _trg_perfil_al_registrarse(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._trg_perfil_al_registrarse() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_meta  jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_fecha date;
  v_edad  int;
BEGIN
  BEGIN
    v_fecha := nullif(v_meta->>'fecha_nacimiento', '')::date;
  EXCEPTION WHEN others THEN
    v_fecha := NULL;
  END;
  v_edad := _edad(v_fecha);

  IF v_edad IS NOT NULL AND v_edad < 12 THEN
    RAISE EXCEPTION 'Inmersia es para alumnos desde los 12 años.' USING ERRCODE = '42501', HINT = 'menor_de_12';
  END IF;

  IF v_edad IS NOT NULL AND v_edad < 14 THEN
    IF coalesce(v_meta->>'consentimiento_padres', '') <> 'true'
       OR _alta_en_aula(NEW.id, v_meta->>'codigo_aula', v_meta->>'nombre_en_aula') IS NULL THEN
      RAISE EXCEPTION 'Con 12 o 13 años hace falta el código de tu aula.' USING ERRCODE = '42501', HINT = 'menor_sin_aula';
    END IF;
  END IF;

  BEGIN
    PERFORM _crear_perfil(NEW.id, v_meta);
  EXCEPTION WHEN others THEN
    RAISE WARNING '_crear_perfil(%): % %', NEW.id, SQLSTATE, SQLERRM;
  END;

  BEGIN
    PERFORM _asignar_manual(NEW.id);
  EXCEPTION WHEN others THEN
    RAISE WARNING '_asignar_manual(%): % %', NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;


--
-- Name: _zona_valida(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._zona_valida(p_zona text) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT CASE WHEN exists (SELECT 1 FROM pg_timezone_names WHERE name=p_zona) THEN p_zona ELSE 'UTC' END;
  $$;


--
-- Name: admins_colegio(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admins_colegio(p_colegio uuid) RETURNS TABLE(user_id uuid, nombre text, soy_yo boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
BEGIN
  IF NOT es_admin_colegio(p_colegio) THEN
    RAISE EXCEPTION 'Solo los administradores ven esta lista.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT ca.user_id,
         coalesce(nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Administrador'),
         ca.user_id = auth.uid()
  FROM colegio_admins ca LEFT JOIN perfiles pf ON pf.id = ca.user_id
  WHERE ca.colegio_id = p_colegio
  ORDER BY ca.created_at;
END;
$$;


--
-- Name: adquirir_libro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adquirir_libro(p_libro_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_manual constant uuid := '00000000-0000-4000-8000-000000000001';  -- MANUAL_LIBRO_ID
  -- LIMITE_PENDIENTES de src/hooks/useCompraLibro.js: si cambia uno, cambiar los dos.
  v_limite constant int := 5;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta una sesión.' USING ERRCODE = '42501', HINT = 'sin_sesion';
  END IF;

  -- Dos peticiones a la vez del mismo usuario no se cuelan las dos.
  PERFORM pg_advisory_xact_lock(hashtext('adquirir_libro:' || v_uid));

  IF EXISTS (SELECT 1 FROM bibliotecas_usuarios WHERE user_id = v_uid AND libro_id = p_libro_id) THEN
    RETURN false;
  END IF;

  IF p_libro_id <> v_manual
     AND NOT EXISTS (SELECT 1 FROM superusuarios WHERE user_id = v_uid)
     AND (SELECT count(*) FROM bibliotecas_usuarios
          WHERE user_id = v_uid AND libro_id <> v_manual AND NOT coalesce(leido, false) AND NOT de_aula) >= v_limite
  THEN
    RAISE EXCEPTION 'Ya tienes % lecturas pendientes.', v_limite
      USING ERRCODE = '42501', HINT = 'limite_pendientes';
  END IF;

  INSERT INTO bibliotecas_usuarios (user_id, libro_id, leido)
  VALUES (v_uid, p_libro_id, false);
  RETURN true;
END;
$$;


--
-- Name: anderson_elegir(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anderson_elegir(p_jugada uuid, p_opcion integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: anderson_jugar(uuid, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anderson_jugar(p_libro uuid, p_personaje text, p_pistas text[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: anderson_mesa(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anderson_mesa(p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _anderson_estado(auth.uid(), p_libro);
END;
$$;


--
-- Name: asignar_lectura(uuid, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.asignar_lectura(p_aula uuid, p_libro uuid, p_fecha_meta date DEFAULT NULL::date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM comunidades WHERE id = p_aula AND colegio_id IS NOT NULL)
     OR NOT (es_admin_de_aula(p_aula) OR es_moderador(p_aula)) THEN
    RAISE EXCEPTION 'Solo el profesor del aula o la administración pueden asignar la lectura.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM libros WHERE id = p_libro AND visible) THEN
    RAISE EXCEPTION 'Ese libro no está en el catálogo.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;

  UPDATE comunidades SET libro_id = p_libro
  WHERE id = p_aula AND libro_id IS DISTINCT FROM p_libro;

  UPDATE comunidad_lecturas SET fecha_meta = p_fecha_meta
  WHERE comunidad_id = p_aula AND fin IS NULL;
END;
$$;


--
-- Name: bote_entregar(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bote_entregar(p_recompensa uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_r record;
BEGIN
  SELECT aula_id, limite, precio, entregado_at INTO v_r FROM recompensas WHERE id = p_recompensa;
  IF v_r.aula_id IS NULL THEN RAISE EXCEPTION 'Esa recompensa no existe.'; END IF;
  PERFORM _profe_de_aula(v_r.aula_id);
  IF v_r.limite <> 'bote' THEN RAISE EXCEPTION 'Eso no es un bote.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('recompensa:' || p_recompensa));
  IF v_r.entregado_at IS NOT NULL THEN RAISE EXCEPTION 'Este bote ya estaba entregado.'; END IF;
  IF _bote_juntado(p_recompensa) < v_r.precio THEN RAISE EXCEPTION 'El bote todavía no está lleno.'; END IF;
  UPDATE recompensas SET entregado_at = now() WHERE id = p_recompensa;
END;
$$;


--
-- Name: buscar_comunidades(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buscar_comunidades(p_texto text DEFAULT ''::text) RETURNS TABLE(id uuid, nombre text, descripcion text, libro_titulo text, libro_portada text, libro_color text, miembros integer, soy_miembro boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH q AS (SELECT lower(btrim(coalesce(p_texto, ''))) AS t)
  SELECT
    c.id,
    c.nombre,
    c.descripcion,
    l.titulo::text,
    l.portada_url::text,
    l.color::text,
    (SELECT count(*)::int FROM comunidad_miembros m WHERE m.comunidad_id = c.id),
    EXISTS (SELECT 1 FROM comunidad_miembros m WHERE m.comunidad_id = c.id AND m.user_id = auth.uid())
  FROM comunidades c
  LEFT JOIN libros l ON l.id = c.libro_id
  CROSS JOIN q
  WHERE NOT c.privada
    AND (
      q.t = ''
      OR position(q.t IN lower(c.nombre)) > 0
      OR position(q.t IN lower(coalesce(l.titulo, ''))) > 0
    )
  ORDER BY 7 DESC, c.created_at DESC
  LIMIT 20;
$$;


--
-- Name: canje_resolver(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.canje_resolver(p_canje uuid, p_estado text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_c record;
BEGIN
  IF p_estado NOT IN ('entregado', 'devuelto') THEN RAISE EXCEPTION 'Estado no válido.'; END IF;
  SELECT * INTO v_c FROM recompensas_canjes WHERE id = p_canje;
  IF v_c.id IS NULL THEN RAISE EXCEPTION 'Ese canje no existe.'; END IF;
  PERFORM _profe_de_aula(v_c.aula_id);

  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_c.user_id || ':' || v_c.libro_id));
  UPDATE recompensas_canjes SET estado = p_estado, resuelto_at = now(), resuelto_por = auth.uid()
  WHERE id = p_canje AND estado = 'pendiente';
  IF NOT FOUND THEN RAISE EXCEPTION 'Este canje ya estaba resuelto.'; END IF;

  IF p_estado = 'devuelto' THEN
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
    VALUES (v_c.user_id, v_c.libro_id, v_c.precio, 'recompensa', v_c.id, jsonb_build_object('devuelto', true));
  END IF;
END;
$$;


--
-- Name: canjear_codigo(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.canjear_codigo(p_codigo text, p_nombre_en_aula text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid         uuid := auth.uid();
  v_codigo    text := upper(btrim(p_codigo));
  v_nombre    text := nullif(btrim(regexp_replace(coalesce(p_nombre_en_aula, ''), '\s+', ' ', 'g')), '');
  r           colegio_codigos%ROWTYPE;
  v_comunidad uuid;
  v_colegio   uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.';
  END IF;

  -- Códigos del colegio (llevan guion).
  IF position('-' IN v_codigo) > 0 THEN
    SELECT * INTO r FROM colegio_codigos
    WHERE codigo = v_codigo AND (expira_at IS NULL OR expira_at > now());

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El código no es válido.' USING ERRCODE = 'P0002', HINT = 'codigo_invalido';
    END IF;

    IF r.tipo = 'admin' THEN
      INSERT INTO colegio_admins (colegio_id, user_id) VALUES (r.colegio_id, uid)
      ON CONFLICT DO NOTHING;
      DELETE FROM colegio_codigos WHERE codigo = v_codigo;   -- un solo uso
      RETURN jsonb_build_object('tipo', 'admin', 'colegio_id', r.colegio_id);
    END IF;

    -- Profesor: si ya estaba en el aula como alumno, pasa a moderador.
    INSERT INTO comunidad_miembros (comunidad_id, user_id, rol)
    VALUES (r.comunidad_id, uid, 'moderador')
    ON CONFLICT (comunidad_id, user_id) DO UPDATE SET rol = 'moderador';
    PERFORM _dar_libro_aula(r.comunidad_id, uid);

    RETURN jsonb_build_object('tipo', 'profesor', 'colegio_id', r.colegio_id, 'comunidad_id', r.comunidad_id);
  END IF;

  -- ¿Aula o comunidad normal?
  SELECT cc.comunidad_id, co.colegio_id INTO v_comunidad, v_colegio
  FROM comunidad_codigos cc JOIN comunidades co ON co.id = cc.comunidad_id
  WHERE cc.codigo = v_codigo;

  IF v_comunidad IS NULL THEN
    RAISE EXCEPTION 'El código no es válido.' USING ERRCODE = 'P0002', HINT = 'codigo_invalido';
  END IF;

  IF v_colegio IS NULL THEN
    PERFORM unirse_con_codigo(v_codigo);
    RETURN jsonb_build_object('tipo', 'comunidad', 'colegio_id', NULL, 'comunidad_id', v_comunidad);
  END IF;

  -- Aula. La app avisa con el HINT y muestra los campos de nombre.
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'Para entrar a un aula hacen falta tu nombre y apellido.'
      USING ERRCODE = 'P0001', HINT = 'falta_nombre_aula';
  END IF;

  -- Si ya estaba (alumno o profe), solo se corrige el nombre; el rol no cambia.
  INSERT INTO comunidad_miembros (comunidad_id, user_id, rol, nombre_en_aula)
  VALUES (v_comunidad, uid, 'miembro', v_nombre)
  ON CONFLICT (comunidad_id, user_id) DO UPDATE SET nombre_en_aula = EXCLUDED.nombre_en_aula;
  PERFORM _dar_libro_aula(v_comunidad, uid);

  RETURN jsonb_build_object('tipo', 'alumno', 'colegio_id', v_colegio, 'comunidad_id', v_comunidad);
END;
$$;


--
-- Name: capsula_abrir(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capsula_abrir(p_libro uuid, p_respuestas text[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: capsula_aula(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capsula_aula(p_aula uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: capsula_libro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capsula_libro(p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _capsula_estado(auth.uid(), p_libro);
END;
$$;


--
-- Name: capsula_sellar(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capsula_sellar(p_libro uuid, p_respuestas text[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: codigo_aula_valido(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.codigo_aula_valido(p_codigo text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM comunidad_codigos cc JOIN comunidades co ON co.id = cc.comunidad_id
    WHERE cc.codigo = upper(btrim(p_codigo)) AND co.colegio_id IS NOT NULL
  );
$$;


--
-- Name: comprension_aula(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.comprension_aula(p_aula uuid, p_zona text DEFAULT 'UTC'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_meta  record;
  v_users uuid[];
  d       jsonb;
  v_mesa  jsonb;
  v_cz    jsonb;
  v_cc    jsonb;
  v_mapa  jsonb;
  v_df    jsonb;
BEGIN
  PERFORM _profe_de_aula(p_aula);

  SELECT * INTO v_meta FROM _meta_aula(p_aula, _zona_valida(p_zona));
  IF v_meta.libro_id IS NULL THEN
    RETURN jsonb_build_object('libro_id', NULL);
  END IF;

  SELECT coalesce(array_agg(user_id), '{}') INTO v_users
  FROM comunidad_miembros WHERE comunidad_id = p_aula AND rol = 'miembro';

  -- ── Mesa de investigación
  SELECT datos INTO d FROM anderson_contenido WHERE libro_id = v_meta.libro_id;
  IF d IS NOT NULL THEN
    WITH
    j AS (
      SELECT user_id, personaje, rasgo, resultado, created_at FROM anderson_jugadas
      WHERE libro_id = v_meta.libro_id AND user_id = ANY (v_users)
    ),
    -- La primera vez que dio con el trío de cada deducción.
    primera AS (
      SELECT DISTINCT ON (user_id, rasgo) user_id, personaje, rasgo, created_at
      FROM j WHERE rasgo IS NOT NULL
      ORDER BY user_id, rasgo, created_at
    ),
    tramos AS (
      SELECT p.*, lag(p.created_at) OVER (PARTITION BY p.user_id, p.personaje ORDER BY p.created_at) AS antes
      FROM primera p
    ),
    por_ded AS (
      SELECT t.user_id, t.rasgo,
             1 + (SELECT count(*) FROM j x
                  WHERE x.user_id = t.user_id AND x.personaje = t.personaje
                    AND x.resultado IN ('no_encajan', 'casi')
                    AND x.created_at < t.created_at
                    AND (t.antes IS NULL OR x.created_at > t.antes)) AS intentos,
             EXISTS (SELECT 1 FROM j x WHERE x.user_id = t.user_id AND x.rasgo = t.rasgo
                     AND x.resultado = 'acierto') AS armada
      FROM tramos t
    )
    SELECT jsonb_build_object(
      'personajes', (SELECT jsonb_agg(jsonb_build_object('id', x->>'id', 'nombre', x->>'nombre',
                                                         'aparece', (x->>'aparece')::int) ORDER BY o)
                     FROM jsonb_array_elements(d->'personajes') WITH ORDINALITY t(x, o)),
      'deducciones', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', r->>'id', 'pj', r->>'pj',
          'texto', r->'opciones'->>((r->>'correcta')::int),
          -- El grupo de pistas: cualquier 3 la abren. Una deducción dentro del grupo es un cambio de 2.º nivel.
          'pistas', (SELECT jsonb_agg(coalesce(
                        (SELECT jsonb_build_object('texto', pi->>'resumen', 'cap', (pi->>'cap')::int)
                         FROM jsonb_array_elements(d->'pistas') pi WHERE pi->>'id' = pid),
                        (SELECT jsonb_build_object('texto', r2->'opciones'->>((r2->>'correcta')::int), 'deduccion', r2->>'id')
                         FROM jsonb_array_elements(d->'rasgos') r2 WHERE r2->>'id' = pid)) ORDER BY po)
                     FROM jsonb_array_elements_text(r->'pool') WITH ORDINALITY q(pid, po))
        ) ORDER BY o)
        FROM jsonb_array_elements(d->'rasgos') WITH ORDINALITY t(r, o)),
      'jugadas', coalesce((
        SELECT jsonb_object_agg(u.user_id, u.ded)
        FROM (SELECT user_id, jsonb_object_agg(rasgo, jsonb_build_object('intentos', intentos, 'armada', armada)) AS ded
              FROM por_ded GROUP BY user_id) u), '{}'::jsonb)
    ) INTO v_mesa;
  END IF;

  -- ── Corazonadas
  SELECT datos INTO d FROM corazonadas_contenido WHERE libro_id = v_meta.libro_id;
  IF d IS NOT NULL THEN
    SELECT jsonb_build_object(
      'preguntas', (SELECT jsonb_agg(jsonb_build_object(
                      'id', x->>'id', 'cap', (x->'chip'->>'cap')::int, 'rev', (x->'rev'->>'cap')::int,
                      'sorpresa', x->>'clase' = 'sorpresa', 'pregunta', x->>'pregunta',
                      'opciones', x->'opciones', 'correcta', (x->>'correcta')::int) ORDER BY o)
                    FROM jsonb_array_elements(d->'corazonadas') WITH ORDINALITY t(x, o)),
      'jugadas', coalesce((
        SELECT jsonb_object_agg(u.user_id, u.cz)
        FROM (SELECT user_id, jsonb_object_agg(corazonada, jsonb_build_object(
                'estado', estado, 'opcion', opcion, 'ovillos', ovillos, 'acierto', acierto)) AS cz
              FROM corazonadas_jugadas
              WHERE libro_id = v_meta.libro_id AND user_id = ANY (v_users)
              GROUP BY user_id) u), '{}'::jsonb)
    ) INTO v_cz;
  END IF;

  -- ── Frases difíciles (concurso)
  SELECT datos INTO d FROM concurso_contenido WHERE libro_id = v_meta.libro_id;
  IF d IS NOT NULL THEN
    SELECT jsonb_build_object(
      'frases', (SELECT jsonb_agg(jsonb_build_object('id', x->>'id', 'cap', (x->>'cap')::int,
                                                     'tipo', x->>'tipo', 'cita', x->>'cita') ORDER BY (x->>'cap')::int, o)
                 FROM jsonb_array_elements(d->'frases') WITH ORDINALITY t(x, o)),
      -- Las que le tocan a cada uno (el mismo sorteo que ve el alumno): sin esto no se sabe cuál omitió.
      'asignadas', coalesce((
        SELECT jsonb_object_agg(u, (SELECT coalesce(jsonb_agg(f->>'id'), '[]'::jsonb) FROM _concurso_frases(u, v_meta.libro_id) f))
        FROM unnest(v_users) u), '{}'::jsonb),
      'jugadas', coalesce((
        SELECT jsonb_object_agg(u.user_id, u.cc)
        FROM (SELECT user_id, jsonb_object_agg(frase, jsonb_build_object(
                'veredicto', veredicto, 'contexto', contexto, 'cincuenta', cincuenta)) AS cc
              FROM concurso_jugadas
              WHERE libro_id = v_meta.libro_id AND user_id = ANY (v_users)
              GROUP BY user_id) u), '{}'::jsonb)
    ) INTO v_cc;
  END IF;

  -- ── Tesoros (mapa)
  SELECT datos INTO d FROM mapa_contenido WHERE libro_id = v_meta.libro_id;
  IF d IS NOT NULL THEN
    SELECT jsonb_build_object(
      'tesoros', (SELECT jsonb_agg(jsonb_build_object('id', x->>'id', 'cap', (x->>'cap')::int,
                                                      'tipo', x->>'tipo', 'pregunta', x->>'pregunta') ORDER BY (x->>'cap')::int, o)
                  FROM jsonb_array_elements(d->'tesoros') WITH ORDINALITY t(x, o)),
      'jugadas', coalesce((
        SELECT jsonb_object_agg(u, jsonb_build_object(
          'encontrados', (SELECT coalesce(jsonb_agg(m.tesoro), '[]'::jsonb) FROM mapa_jugadas m
                          WHERE m.user_id = u AND m.libro_id = v_meta.libro_id AND m.acierto),
          'fallos', (SELECT coalesce(jsonb_object_agg(s.tesoro, s.n), '{}'::jsonb)
                     FROM (SELECT m.tesoro, count(*) AS n FROM mapa_jugadas m
                           WHERE m.user_id = u AND m.libro_id = v_meta.libro_id AND NOT m.acierto AND m.tesoro IS NOT NULL
                           GROUP BY m.tesoro) s),
          'fallos_cap', (SELECT coalesce(jsonb_object_agg(s.capitulo, s.n), '{}'::jsonb)
                         FROM (SELECT m.capitulo, count(*) AS n FROM mapa_jugadas m
                               WHERE m.user_id = u AND m.libro_id = v_meta.libro_id AND NOT m.acierto
                               GROUP BY m.capitulo) s)))
        FROM unnest(v_users) u
        WHERE EXISTS (SELECT 1 FROM mapa_jugadas m WHERE m.user_id = u AND m.libro_id = v_meta.libro_id)), '{}'::jsonb)
    ) INTO v_mapa;
  END IF;

  -- ── Desafío
  SELECT datos INTO d FROM desafio_contenido WHERE libro_id = v_meta.libro_id;
  IF d IS NOT NULL THEN
    SELECT jsonb_build_object(
      'momentos', (SELECT jsonb_agg(jsonb_build_object(
                     'momento', m->>'momento', 'tras_capitulo', (m->>'tras_capitulo')::int,
                     'preguntas', (SELECT jsonb_agg(jsonb_build_object('id', q->>'id', 'tipo', q->>'tipo', 'consigna', q->>'consigna'))
                                   FROM jsonb_array_elements(m->'preguntas') q)))
                   FROM jsonb_array_elements(d->'momentos') m),
      -- La pregunta que le toca a cada uno aunque no haya empezado; la charla, si existe.
      'charlas', coalesce((
        SELECT jsonb_object_agg(u, (
          SELECT jsonb_object_agg(mo, jsonb_build_object(
                   'pregunta', q->>'id',
                   'estado', coalesce(ch.estado, 'nueva'),
                   'resumen', ch.resumen,
                   'nota', ch.nota,
                   'comentario', ch.comentario))
          FROM unnest(ARRAY['mitad', 'final']) mo
          CROSS JOIN LATERAL _desafio_pregunta(u, v_meta.libro_id, mo) q
          LEFT JOIN desafio_charlas ch ON ch.user_id = u AND ch.libro_id = v_meta.libro_id AND ch.momento = mo
          WHERE q IS NOT NULL))
        FROM unnest(v_users) u), '{}'::jsonb)
    ) INTO v_df;
  END IF;

  RETURN jsonb_build_object(
    'libro_id', v_meta.libro_id,
    'total_capitulos', v_meta.total_capitulos,
    'meta_capitulo', v_meta.meta_capitulo,
    'juegos', (SELECT _juegos_mezclar('{"mesa": true, "corazonadas": true, "mapa": true, "concurso": true, "desafio": true}'::jsonb, juegos)
               FROM comunidades WHERE id = p_aula),
    'alumnos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'user_id', m.user_id,
               'nombre', coalesce(m.nombre_en_aula, nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Lector'),
               'capitulos', coalesce(pl.capitulos_completados, 0))
             ORDER BY coalesce(m.nombre_en_aula, nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Lector'))
      FROM comunidad_miembros m
      LEFT JOIN perfiles pf ON pf.id = m.user_id
      LEFT JOIN progreso_lectura pl ON pl.user_id = m.user_id AND pl.libro_id = v_meta.libro_id
      WHERE m.comunidad_id = p_aula AND m.rol = 'miembro'), '[]'::jsonb),
    'mesa', v_mesa,
    'corazonadas', v_cz,
    'concurso', v_cc,
    'mapa', v_mapa,
    'desafio', v_df
  );
END;
$$;


--
-- Name: concurso_comodin(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.concurso_comodin(p_libro uuid, p_frase text, p_cual text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: concurso_elegir(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.concurso_elegir(p_libro uuid, p_frase text, p_opcion integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: concurso_liberar(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.concurso_liberar(p_user uuid, p_libro uuid, p_frase text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE concurso_jugadas SET estado = 'abierta', evaluando_at = NULL
  WHERE user_id = p_user AND libro_id = p_libro AND frase = p_frase AND estado = 'evaluando';
$$;


--
-- Name: concurso_libro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.concurso_libro(p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _concurso_estado(auth.uid(), p_libro);
END;
$$;


--
-- Name: concurso_reservar(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.concurso_reservar(p_user uuid, p_libro uuid, p_frase text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: concurso_resolver(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.concurso_resolver(p_user uuid, p_libro uuid, p_frase text, p_veredicto text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: contar_palabras(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.contar_palabras(texto text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE WHEN btrim(coalesce(texto, '')) = '' THEN 0
              ELSE array_length(regexp_split_to_array(btrim(texto), '\s+'), 1) END
$$;


--
-- Name: corazonada_cobrar(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.corazonada_cobrar(p_libro uuid, p_corazonada text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: corazonada_jugar(uuid, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.corazonada_jugar(p_libro uuid, p_corazonada text, p_opcion integer, p_ovillos integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: corazonada_llegar(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.corazonada_llegar(p_libro uuid, p_corazonada text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: corazonadas_libro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.corazonadas_libro(p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _corazonadas_estado(auth.uid(), p_libro);
END;
$$;


--
-- Name: crear_aula(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_aula(p_colegio uuid, p_grado text, p_seccion text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_grado   text := btrim(p_grado);
  v_seccion text := nullif(btrim(p_seccion), '');
  v_nombre  text := btrim(concat_ws(' ', btrim(p_grado), nullif(btrim(p_seccion), '')));
  v_aula    uuid;
BEGIN
  IF NOT es_admin_colegio(p_colegio) THEN
    RAISE EXCEPTION 'Solo un administrador del colegio puede crear aulas.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM comunidades WHERE colegio_id = p_colegio AND nombre = v_nombre) THEN
    RAISE EXCEPTION 'Ya existe un aula «%».', v_nombre USING ERRCODE = 'P0001', HINT = 'aula_repetida';
  END IF;

  INSERT INTO comunidades (nombre, privada, creador_id, colegio_id, grado, seccion)
  VALUES (v_nombre, true, auth.uid(), p_colegio, v_grado, v_seccion)
  RETURNING id INTO v_aula;

  RETURN v_aula;
END;
$$;


--
-- Name: crear_colegio(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_colegio(p_nombre text, p_pais text, p_ciudad text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_colegio uuid;
  v_codigo  text := _codigo_colegio('ADMIN');
BEGIN
  INSERT INTO colegios (nombre, pais, ciudad)
  VALUES (btrim(p_nombre), btrim(p_pais), nullif(btrim(p_ciudad), ''))
  RETURNING id INTO v_colegio;

  INSERT INTO colegio_codigos (codigo, colegio_id, tipo, expira_at)
  VALUES (v_codigo, v_colegio, 'admin', now() + interval '30 days');

  RETURN v_codigo;
END;
$$;


--
-- Name: crear_comunidad(text, text, boolean, text, uuid, date, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_comunidad(p_nombre text, p_descripcion text DEFAULT NULL::text, p_privada boolean DEFAULT false, p_codigo text DEFAULT NULL::text, p_libro_id uuid DEFAULT NULL::uuid, p_fecha_meta date DEFAULT NULL::date, p_encuentro_lugar text DEFAULT NULL::text, p_encuentro_fecha timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  uid      uuid := auth.uid();
  v_id     uuid := gen_random_uuid();
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión para crear una comunidad.'
      USING ERRCODE = '42501', HINT = 'sin_sesion';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM creadores_comunidad WHERE user_id = uid) THEN
    RAISE EXCEPTION 'Tu cuenta no tiene permiso para crear comunidades.'
      USING ERRCODE = '42501', HINT = 'sin_permiso_creador';
  END IF;

  IF p_privada AND v_codigo !~ '^[A-Z0-9]{6,20}$' THEN
    RAISE EXCEPTION 'El código debe tener entre 6 y 20 letras o números.'
      USING ERRCODE = '22023', HINT = 'codigo_formato';
  END IF;

  -- Los triggers de 051/054 hacen el resto: meter al creador como
  -- moderador, generar un código, abrir la primera lectura y el tope.
  INSERT INTO comunidades (id, nombre, descripcion, privada, libro_id, creador_id)
  VALUES (v_id, btrim(p_nombre), nullif(btrim(coalesce(p_descripcion, '')), ''), p_privada, p_libro_id, uid);

  IF p_privada THEN
    BEGIN
      UPDATE comunidad_codigos SET codigo = v_codigo WHERE comunidad_id = v_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'Ese código ya lo usa otra comunidad. Prueba con otro.'
        USING ERRCODE = '23505', HINT = 'codigo_en_uso';
    END;
  END IF;

  IF p_libro_id IS NOT NULL THEN
    UPDATE comunidad_lecturas
    SET fecha_meta      = p_fecha_meta,
        encuentro_lugar = nullif(btrim(coalesce(p_encuentro_lugar, '')), ''),
        encuentro_fecha = p_encuentro_fecha
    WHERE comunidad_id = v_id AND fin IS NULL;
  END IF;

  RETURN v_id;
END;
$_$;


--
-- Name: delete_parrafo_superuser(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_parrafo_superuser(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_capitulo_id UUID;
  v_numero      INTEGER;
  v_prev_id     UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superusuarios WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado: se requiere superusuario';
  END IF;

  SELECT capitulo_id, numero INTO v_capitulo_id, v_numero
  FROM parrafos WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Párrafo no encontrado: %', p_id;
  END IF;

  -- Párrafo anterior en el mismo capítulo (NULL si es el primero)
  SELECT id INTO v_prev_id
  FROM parrafos
  WHERE capitulo_id = v_capitulo_id AND numero < v_numero
  ORDER BY numero DESC
  LIMIT 1;

  -- Redirigir progreso de cualquier usuario que estuviera aquí
  UPDATE progreso_lectura
  SET ultimo_parrafo_id = v_prev_id
  WHERE ultimo_parrafo_id = p_id;

  -- Borrar párrafo (CASCADE + SET NULL manejan el resto de FKs)
  DELETE FROM parrafos WHERE id = p_id;
END;
$$;


--
-- Name: denuncias_para_revisar(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.denuncias_para_revisar(p_pendientes boolean DEFAULT true) RETURNS TABLE(id uuid, tipo text, objeto_id uuid, estado text, resolucion text, resuelta_at timestamp with time zone, motivo text, contenido text, created_at timestamp with time zone, comunidad_id uuid, comunidad_nombre text, comunidad_privada boolean, comunidad_miembros integer, libro_titulo text, parrafo_texto text, denunciante_nombre text, denunciado_id uuid, denunciado_nombre text, reincidencias integer, original_existe boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT es_superusuario() THEN
    RAISE EXCEPTION 'Solo el superusuario revisa denuncias.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    d.id, d.tipo, d.objeto_id, d.estado, d.resolucion, d.resuelta_at, d.motivo,
    d.contenido_denunciado, d.created_at,
    d.comunidad_id, c.nombre::text, c.privada,
    (SELECT count(*)::int FROM comunidad_miembros cm WHERE cm.comunidad_id = d.comunidad_id),
    l.titulo::text,
    p.contenido::text,
    nullif(btrim(coalesce(pa.nombre, '') || ' ' || coalesce(pa.apellido, '')), ''),
    d.denunciado_id,
    nullif(btrim(coalesce(pb.nombre, '') || ' ' || coalesce(pb.apellido, '')), ''),
    -- Reincidencia: denuncias anteriores a la misma persona que no se descartaron
    (SELECT count(*)::int FROM denuncias d2
      WHERE d2.denunciado_id = d.denunciado_id AND d2.id <> d.id
        AND d2.created_at < d.created_at AND d2.estado <> 'descartada'),
    CASE d.tipo
      WHEN 'comentario_lectura' THEN EXISTS (SELECT 1 FROM comentarios_lectura x WHERE x.id = d.objeto_id)
      WHEN 'mensajito'          THEN EXISTS (SELECT 1 FROM mensajitos x WHERE x.id = d.objeto_id)
      WHEN 'foro'               THEN EXISTS (SELECT 1 FROM foros_comentarios x WHERE x.id = d.objeto_id)
      WHEN 'comunidad'          THEN EXISTS (SELECT 1 FROM comunidades x WHERE x.id = d.objeto_id)
    END
  FROM denuncias d
  LEFT JOIN comunidades c ON c.id = d.comunidad_id
  LEFT JOIN libros l      ON l.id = d.libro_id
  LEFT JOIN parrafos p    ON p.id = d.parrafo_id
  LEFT JOIN perfiles pa   ON pa.id = d.denunciante_id
  LEFT JOIN perfiles pb   ON pb.id = d.denunciado_id
  WHERE (p_pendientes AND d.estado = 'pendiente') OR (NOT p_pendientes AND d.estado <> 'pendiente')
  ORDER BY CASE WHEN p_pendientes THEN d.created_at END ASC,
           CASE WHEN NOT p_pendientes THEN d.resuelta_at END DESC NULLS LAST;
END;
$$;


--
-- Name: desafio_calificar(uuid, uuid, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.desafio_calificar(p_aula uuid, p_user uuid, p_momento text, p_nota integer, p_comentario text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ch  desafio_charlas%ROWTYPE := _charla_de_alumno(p_aula, p_user, p_momento);
  v_com text := nullif(btrim(coalesce(p_comentario, '')), '');
BEGIN
  IF v_ch.estado <> 'terminada' THEN
    RAISE EXCEPTION 'La charla todavía no terminó.';
  END IF;
  IF p_nota IS NOT NULL AND (p_nota < 0 OR p_nota > 20) THEN
    RAISE EXCEPTION 'La nota va de 0 a 20.';
  END IF;
  IF length(v_com) > 1000 THEN
    RAISE EXCEPTION 'El comentario es demasiado largo.';
  END IF;

  UPDATE desafio_charlas
  SET nota = p_nota, comentario = v_com,
      nota_por = CASE WHEN p_nota IS NULL AND v_com IS NULL THEN NULL ELSE auth.uid() END,
      nota_at  = CASE WHEN p_nota IS NULL AND v_com IS NULL THEN NULL ELSE now() END
  WHERE id = v_ch.id;

  RETURN jsonb_build_object('nota', p_nota, 'comentario', v_com);
END;
$$;


--
-- Name: desafio_charla_aula(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.desafio_charla_aula(p_aula uuid, p_user uuid, p_momento text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ch desafio_charlas%ROWTYPE := _charla_de_alumno(p_aula, p_user, p_momento);
BEGIN
  RETURN jsonb_build_object(
    'momento', v_ch.momento,
    'consigna', (SELECT q->>'consigna'
                 FROM desafio_contenido c, jsonb_array_elements(c.datos->'momentos') m, jsonb_array_elements(m->'preguntas') q
                 WHERE c.libro_id = v_ch.libro_id AND m->>'momento' = v_ch.momento AND q->>'id' = v_ch.pregunta),
    'estado', v_ch.estado,
    'turnos', coalesce((SELECT jsonb_agg(jsonb_build_object('de', t->>'de', 'texto', t->>'texto') ORDER BY o)
                        FROM jsonb_array_elements(v_ch.turnos) WITH ORDINALITY x(t, o)), '[]'::jsonb),
    'resumen', v_ch.resumen,
    'nota', v_ch.nota,
    'comentario', v_ch.comentario);
END;
$$;


--
-- Name: desafio_libro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.desafio_libro(p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _desafio_estado(auth.uid(), p_libro);
END;
$$;


--
-- Name: desafio_reservar(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.desafio_reservar(p_user uuid, p_libro uuid, p_momento text, p_texto text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: desafio_responder(uuid, uuid, text, text, boolean, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.desafio_responder(p_user uuid, p_libro uuid, p_momento text, p_mensaje text, p_terminar boolean, p_resumen jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: edad_permite_contacto(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edad_permite_contacto(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT extract(year FROM age(current_date, p.fecha_nacimiento)) >= 16
     FROM perfiles p WHERE p.id = uid),
    true
  );
$$;


--
-- Name: eliminar_mi_cuenta(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eliminar_mi_cuenta() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa: eliminar_mi_cuenta() solo se puede llamar desde la app, autenticado.';
  END IF;

  -- El CASCADE de auth.users se lleva todo lo demás.
  DELETE FROM auth.users WHERE id = uid;
END;
$$;


--
-- Name: FUNCTION eliminar_mi_cuenta(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.eliminar_mi_cuenta() IS 'Borra la cuenta de quien la llama (auth.uid()) y, por CASCADE, todos sus datos. Derecho de supresión, art. 17 RGPD. La usa el botón de Perfil → Legal.';


--
-- Name: es_admin_colegio(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_admin_colegio(c uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM colegio_admins
    WHERE colegio_id = c AND user_id = auth.uid()
  );
$$;


--
-- Name: es_admin_de_aula(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_admin_de_aula(a uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM comunidades co
    JOIN colegio_admins ca ON ca.colegio_id = co.colegio_id
    WHERE co.id = a AND ca.user_id = auth.uid()
  );
$$;


--
-- Name: es_miembro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_miembro(c uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM comunidad_miembros
    WHERE comunidad_id = c AND user_id = auth.uid()
  );
$$;


--
-- Name: es_moderador(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_moderador(c uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM comunidad_miembros
    WHERE comunidad_id = c AND user_id = auth.uid() AND rol = 'moderador'
  );
$$;


--
-- Name: es_profesor_colegio(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_profesor_colegio(c uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM comunidades co
    JOIN comunidad_miembros m ON m.comunidad_id = co.id
    WHERE co.colegio_id = c AND m.user_id = auth.uid() AND m.rol = 'moderador'
  );
$$;


--
-- Name: es_superusuario(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_superusuario() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM superusuarios WHERE user_id = auth.uid());
$$;


--
-- Name: expediente_comprar(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expediente_comprar(p_libro uuid, p_expediente text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_precio int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Inicia sesión.' USING ERRCODE = '42501'; END IF;

  -- Una compra a la vez por alumno y libro (dos pestañas no gastan dos veces el mismo ovillo).
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || p_libro));

  SELECT (x->>'precio')::int INTO v_precio
  FROM expedientes_contenido e, jsonb_array_elements(e.datos->'expedientes') x
  WHERE e.libro_id = p_libro AND x->>'id' = p_expediente;
  IF v_precio IS NULL THEN RAISE EXCEPTION 'Ese expediente no existe.'; END IF;

  IF EXISTS (SELECT 1 FROM expedientes_compras
             WHERE user_id = v_user AND libro_id = p_libro AND expediente = p_expediente) THEN
    RAISE EXCEPTION 'Ya tienes este expediente.';
  END IF;
  IF _ovillos_saldo(v_user, p_libro) < v_precio THEN
    RAISE EXCEPTION 'No te alcanzan los ovillos.';
  END IF;

  INSERT INTO expedientes_compras (user_id, libro_id, expediente, precio)
  VALUES (v_user, p_libro, p_expediente, v_precio);
  IF v_precio > 0 THEN
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, detalle)
    VALUES (v_user, p_libro, -v_precio, 'expediente', jsonb_build_object('expediente', p_expediente));
  END IF;

  RETURN jsonb_build_object('saldo', _ovillos_saldo(v_user, p_libro));
END;
$$;


--
-- Name: expediente_leer(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expediente_leer(p_libro uuid, p_expediente text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_exp  jsonb;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
       SELECT 1 FROM expedientes_compras
       WHERE user_id = v_user AND libro_id = p_libro AND expediente = p_expediente) THEN
    RAISE EXCEPTION 'Primero canjea este expediente.' USING ERRCODE = '42501';
  END IF;

  SELECT x INTO v_exp
  FROM expedientes_contenido e, jsonb_array_elements(e.datos->'expedientes') x
  WHERE e.libro_id = p_libro AND x->>'id' = p_expediente;

  RETURN jsonb_build_object('titulo', v_exp->>'titulo', 'descripcion', v_exp->>'descripcion',
                            'parrafos', coalesce(v_exp->'parrafos', '[]'::jsonb));
END;
$$;


--
-- Name: falsificador_aula(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.falsificador_aula(p_aula uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_libro uuid;
  v_datos jsonb;
BEGIN
  PERFORM _profe_de_aula(p_aula);
  SELECT libro_id INTO v_libro FROM _meta_aula(p_aula, 'UTC');
  IF v_libro IS NULL THEN
    RETURN jsonb_build_object('libro_id', NULL);
  END IF;
  SELECT datos INTO v_datos FROM falsificador_contenido WHERE libro_id = v_libro;

  RETURN jsonb_build_object(
    'libro_id', v_libro,
    'encendido', (_juegos_mezclar(_juegos_aula_por_defecto(),
                                  (SELECT juegos FROM comunidades WHERE id = p_aula))->>'falsificador')::boolean,
    'autor', v_datos->'autor',
    'items', (SELECT jsonb_agg(jsonb_build_object('id', x->>'id', 'cap', (x->>'cap')::int,
                                                  'falso', (x->>'falso')::boolean, 'inicio', x->>'inicio') ORDER BY o)
              FROM jsonb_array_elements(v_datos->'items') WITH ORDINALITY AS t(x, o)),
    'jugadas', coalesce((
      SELECT jsonb_object_agg(s.user_id, s.porItem)
      FROM (SELECT j.user_id, jsonb_object_agg(j.item, j.acierto) AS porItem
            FROM falsificador_jugadas j
            JOIN comunidad_miembros cm ON cm.user_id = j.user_id AND cm.comunidad_id = p_aula AND cm.rol = 'miembro'
            WHERE j.libro_id = v_libro
            GROUP BY j.user_id) s), '{}'::jsonb));
END;
$$;


--
-- Name: falsificador_libro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.falsificador_libro(p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _falsificador_estado(auth.uid(), p_libro);
END;
$$;


--
-- Name: falsificador_responder(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.falsificador_responder(p_libro uuid, p_item text, p_dice text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_x      jsonb;
  v_ok     boolean;
  v_premio int;
  v_id     uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  IF p_dice NOT IN ('autor', 'gato') THEN
    RAISE EXCEPTION 'Respuesta no válida.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('falsificador:' || v_user || ':' || p_libro));

  SELECT x INTO v_x
  FROM falsificador_contenido c, jsonb_array_elements(c.datos->'items') x
  WHERE c.libro_id = p_libro AND x->>'id' = p_item;
  IF v_x IS NULL THEN
    RAISE EXCEPTION 'Ese párrafo no está en el juego.';
  END IF;
  IF EXISTS (SELECT 1 FROM falsificador_jugadas WHERE user_id = v_user AND libro_id = p_libro AND item = p_item) THEN
    RAISE EXCEPTION 'ya_respondido';
  END IF;

  v_ok := (p_dice = 'gato') = (v_x->>'falso')::boolean;
  INSERT INTO falsificador_jugadas (user_id, libro_id, item, dijo, acierto)
  VALUES (v_user, p_libro, p_item, p_dice, v_ok)
  RETURNING id INTO v_id;

  -- Acierto +1. Fallo −1, solo si le queda alguno (el saldo no baja de 0).
  v_premio := CASE WHEN v_ok THEN 1 WHEN _ovillos_saldo(v_user, p_libro) >= 1 THEN -1 ELSE 0 END;
  IF v_premio <> 0 THEN
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
    VALUES (v_user, p_libro, v_premio, 'falsificador', v_id, jsonb_build_object('item', p_item));
  END IF;

  RETURN jsonb_build_object('acierto', v_ok, 'premio', v_premio,
                            'estado', _falsificador_estado(v_user, p_libro));
END;
$$;


--
-- Name: foro_recortar_tags(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.foro_recortar_tags() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- coalesce es imprescindible: unnest('{}') no devuelve filas y array_agg
  -- daría NULL, pero la columna es NOT NULL. El caso corriente son justamente
  -- las respuestas, que se insertan con tags = '{}'.
  SELECT coalesce(array_agg(left(t, 40)), '{}')
    INTO NEW.tags
    FROM unnest(coalesce(NEW.tags, '{}')) AS t;
  RETURN NEW;
END;
$$;


--
-- Name: invitar_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invitar_admin(p_colegio uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_codigo text := _codigo_colegio('ADMIN');
BEGIN
  IF NOT es_admin_colegio(p_colegio) THEN
    RAISE EXCEPTION 'Solo un administrador del colegio puede invitar a otro.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM colegio_codigos WHERE expira_at < now();

  INSERT INTO colegio_codigos (codigo, colegio_id, tipo, expira_at)
  VALUES (v_codigo, p_colegio, 'admin', now() + interval '7 days');

  RETURN v_codigo;
END;
$$;


--
-- Name: juegos_guardar(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.juegos_guardar(p_juego text, p_encendido boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  IF NOT (_juegos_por_defecto() ? p_juego) OR p_encendido IS NULL THEN
    RAISE EXCEPTION 'Ese juego no existe.';
  END IF;

  INSERT INTO preferencias_usuario (user_id, juegos, updated_at)
  VALUES (v_user, jsonb_build_object(p_juego, p_encendido), now())
  ON CONFLICT (user_id) DO UPDATE
  SET juegos = preferencias_usuario.juegos || jsonb_build_object(p_juego, p_encendido), updated_at = now();

  RETURN mis_juegos();
END;
$$;


--
-- Name: juegos_libro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.juegos_libro(p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: lista_colegio(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lista_colegio(p_colegio uuid) RETURNS TABLE(aula_id uuid, nombre text, grado text, seccion text, codigo_alumnos text, codigo_profesor text, profesores jsonb, alumnos jsonb, total_alumnos integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_admin boolean := es_admin_colegio(p_colegio);
BEGIN
  IF NOT v_admin AND NOT es_profesor_colegio(p_colegio) THEN
    RAISE EXCEPTION 'Solo el colegio ve su lista.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    co.id,
    co.nombre::text,
    co.grado,
    co.seccion,
    cc.codigo,
    CASE WHEN v_admin THEN cp.codigo END,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
              'user_id', m.user_id,
              'nombre', coalesce(nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Profesor')
            ) ORDER BY m.unido_at), '[]'::jsonb)
     FROM comunidad_miembros m LEFT JOIN perfiles pf ON pf.id = m.user_id
     WHERE m.comunidad_id = co.id AND m.rol = 'moderador'),
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
              'user_id', m.user_id,
              'nombre', coalesce(m.nombre_en_aula, nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Lector'),
              'unido_at', m.unido_at
            ) ORDER BY coalesce(m.nombre_en_aula, pf.nombre)), '[]'::jsonb)
     FROM comunidad_miembros m LEFT JOIN perfiles pf ON pf.id = m.user_id
     WHERE m.comunidad_id = co.id AND m.rol = 'miembro'),
    (SELECT count(*)::int FROM comunidad_miembros m
     WHERE m.comunidad_id = co.id AND m.rol = 'miembro')
  FROM comunidades co
  LEFT JOIN comunidad_codigos cc ON cc.comunidad_id = co.id
  LEFT JOIN colegio_codigos  cp ON cp.comunidad_id = co.id AND cp.tipo = 'profesor'
  WHERE co.colegio_id = p_colegio
    AND (v_admin OR es_moderador(co.id))
  ORDER BY co.grado, co.seccion NULLS FIRST, co.nombre;
END;
$$;


--
-- Name: mapa_libro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mapa_libro(p_libro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _mapa_estado(auth.uid(), p_libro);
END;
$$;


--
-- Name: mapa_subrayar(uuid, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mapa_subrayar(p_libro uuid, p_capitulo integer, p_parrafo integer, p_texto text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: mis_colegios(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mis_colegios() RETURNS TABLE(colegio_id uuid, nombre text, rol text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT c.id, c.nombre, 'admin'
  FROM colegio_admins ca JOIN colegios c ON c.id = ca.colegio_id
  WHERE ca.user_id = auth.uid()
  UNION
  SELECT DISTINCT c.id, c.nombre, 'profesor'
  FROM comunidad_miembros m
  JOIN comunidades co ON co.id = m.comunidad_id
  JOIN colegios c     ON c.id = co.colegio_id
  WHERE m.user_id = auth.uid() AND m.rol = 'moderador'
    AND NOT EXISTS (
      SELECT 1 FROM colegio_admins ca
      WHERE ca.colegio_id = c.id AND ca.user_id = auth.uid()
    );
$$;


--
-- Name: mis_datos_juegos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mis_datos_juegos() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
    -- 099: qué dijo en cada párrafo sospechoso y si acertó.
    'falsificador',         (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM falsificador_jugadas t WHERE t.user_id = v_user),
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
$$;


--
-- Name: mis_juegos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mis_juegos() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'juegos', _juegos_mezclar(_juegos_por_defecto(),
                              coalesce((SELECT juegos FROM preferencias_usuario WHERE user_id = v_user), '{}'::jsonb)),
    'en_aula', EXISTS (SELECT 1 FROM comunidad_miembros cm JOIN comunidades co ON co.id = cm.comunidad_id
                       WHERE cm.user_id = v_user AND co.colegio_id IS NOT NULL));
END;
$$;


--
-- Name: ovillos_saldo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ovillos_saldo(p_libro uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE _ovillos_saldo(auth.uid(), p_libro) END;
$$;


--
-- Name: progreso_comunidad(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.progreso_comunidad(p_comunidad uuid) RETURNS TABLE(user_id uuid, nombre text, apellido text, rol text, porcentaje smallint, ultima_lectura timestamp with time zone, otro_libro_id uuid, otro_libro_titulo text, otro_libro_portada text, otro_porcentaje smallint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT es_miembro(p_comunidad) THEN
    RAISE EXCEPTION 'Solo los miembros ven el avance de la comunidad.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    pf.nombre::text,
    pf.apellido::text,
    m.rol,
    pc.porcentaje,
    ult.updated_at,
    CASE WHEN ult.libro_id IS DISTINCT FROM c.libro_id THEN ult.libro_id END,
    CASE WHEN ult.libro_id IS DISTINCT FROM c.libro_id THEN l.titulo::text END,
    CASE WHEN ult.libro_id IS DISTINCT FROM c.libro_id THEN l.portada_url::text END,
    CASE WHEN ult.libro_id IS DISTINCT FROM c.libro_id THEN ult.porcentaje END
  FROM comunidad_miembros m
  JOIN comunidades c        ON c.id = m.comunidad_id
  LEFT JOIN perfiles pf     ON pf.id = m.user_id
  LEFT JOIN progreso_lectura pc
         ON pc.user_id = m.user_id AND pc.libro_id = c.libro_id
  LEFT JOIN LATERAL (
    SELECT pl.libro_id, pl.porcentaje, pl.updated_at
    FROM progreso_lectura pl
    WHERE pl.user_id = m.user_id
    ORDER BY pl.updated_at DESC
    LIMIT 1
  ) ult ON true
  LEFT JOIN libros l ON l.id = ult.libro_id
  WHERE m.comunidad_id = p_comunidad
  ORDER BY pc.porcentaje DESC NULLS LAST, m.unido_at;
END;
$$;


--
-- Name: puede_recibir_mensajitos(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puede_recibir_mensajitos(p_comunidad uuid) RETURNS TABLE(user_id uuid)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT es_miembro(p_comunidad) THEN
    RAISE EXCEPTION 'Solo los miembros dejan mensajitos.' USING ERRCODE = '42501';
  END IF;

  -- Menor de 16: ni envía ni recibe. Vacío, sin explicar por qué.
  IF NOT edad_permite_contacto(auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.user_id
  FROM comunidad_miembros m
  WHERE m.comunidad_id = p_comunidad
    AND m.user_id <> auth.uid()
    AND edad_permite_contacto(m.user_id);
END;
$$;


--
-- Name: purgar_chat_antiguo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purgar_chat_antiguo() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  borrados integer;
BEGIN
  DELETE FROM public.chat_mensajes
   WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS borrados = ROW_COUNT;

  -- Sesiones vacías y viejas: sin mensajes ya no representan nada.
  -- (Una sesión activa nunca llega a 90 días: se borra al cerrar el chat.)
  DELETE FROM public.chat_sesiones s
   WHERE s.created_at < now() - interval '90 days'
     AND NOT EXISTS (
       SELECT 1 FROM public.chat_mensajes m WHERE m.sesion_id = s.id
     );

  -- El historial de «con quién hablaste» es igual de personal.
  DELETE FROM public.chat_historial
   WHERE created_at < now() - interval '90 days';

  RETURN borrados;
END;
$$;


--
-- Name: FUNCTION purgar_chat_antiguo(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.purgar_chat_antiguo() IS 'Borra mensajes, sesiones vacías e historial de chat de más de 90 días. Retención declarada en la Política de Privacidad, sección 4.';


--
-- Name: purgar_denuncias_resueltas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purgar_denuncias_resueltas() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  borradas integer;
BEGIN
  DELETE FROM public.denuncias
   WHERE estado <> 'pendiente'
     AND coalesce(resuelta_at, created_at) < now() - interval '6 months';
  GET DIAGNOSTICS borradas = ROW_COUNT;
  RETURN borradas;
END;
$$;


--
-- Name: FUNCTION purgar_denuncias_resueltas(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.purgar_denuncias_resueltas() IS 'Borra las denuncias revisadas o descartadas de más de 6 meses. Retención declarada en la Política de Privacidad, sección 4.';


--
-- Name: recalcular_muestra(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalcular_muestra(libro_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  tope CONSTANT INTEGER := 2300;  -- 10 min × 230 palabras/min
BEGIN
  WITH orden AS (
    SELECT p.id,
           sum(CASE WHEN p.tipo = 'separador' THEN 0 ELSE contar_palabras(p.contenido) END)
             OVER (PARTITION BY p.libro_id ORDER BY c.numero, p.numero, p.id
                   ROWS UNBOUNDED PRECEDING) AS acumulado,
           row_number() OVER (PARTITION BY p.libro_id ORDER BY c.numero, p.numero, p.id) AS fila
    FROM parrafos p
    JOIN capitulos c ON c.id = p.capitulo_id
    WHERE p.libro_id = ANY(libro_ids)
  )
  UPDATE parrafos p
  SET en_muestra = (o.acumulado <= tope OR o.fila = 1)
  FROM orden o
  WHERE p.id = o.id
    AND p.en_muestra IS DISTINCT FROM (o.acumulado <= tope OR o.fila = 1);

  UPDATE capitulos c
  SET en_muestra = EXISTS (SELECT 1 FROM parrafos p WHERE p.capitulo_id = c.id AND p.en_muestra)
  WHERE c.libro_id = ANY(libro_ids)
    AND c.en_muestra IS DISTINCT FROM
        EXISTS (SELECT 1 FROM parrafos p WHERE p.capitulo_id = c.id AND p.en_muestra);
END $$;


--
-- Name: recalcular_palabras_capitulos(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalcular_palabras_capitulos(ids uuid[]) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE capitulos c
  SET palabras = coalesce((
    SELECT sum(contar_palabras(p.contenido))
    FROM parrafos p
    WHERE p.capitulo_id = c.id AND p.tipo <> 'separador'
  ), 0)
  WHERE c.id = ANY(ids);
$$;


--
-- Name: recompensa_activar(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompensa_activar(p_recompensa uuid, p_activa boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_aula uuid;
BEGIN
  SELECT aula_id INTO v_aula FROM recompensas WHERE id = p_recompensa;
  IF v_aula IS NULL THEN RAISE EXCEPTION 'Esa recompensa no existe.'; END IF;
  PERFORM _profe_de_aula(v_aula);
  UPDATE recompensas SET activa = coalesce(p_activa, false) WHERE id = p_recompensa;
END;
$$;


--
-- Name: recompensa_aportar(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompensa_aportar(p_recompensa uuid, p_cantidad integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_rec     record;
  v_libro   uuid;
  v_juntado int;
  v_cant    int;
  v_id      uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Inicia sesión.' USING ERRCODE = '42501'; END IF;

  SELECT r.*, a.libro_id AS libro_aula INTO v_rec
  FROM recompensas r JOIN _aulas_de_alumno(v_user) a ON a.aula_id = r.aula_id
  WHERE r.id = p_recompensa;
  IF v_rec.id IS NULL THEN RAISE EXCEPTION 'Esta recompensa no es de tu aula.' USING ERRCODE = '42501'; END IF;
  IF v_rec.limite <> 'bote' THEN RAISE EXCEPTION 'Esta recompensa se canjea, no es un bote.'; END IF;
  IF NOT v_rec.activa THEN RAISE EXCEPTION 'Tu profe quitó este bote de la tienda.'; END IF;
  v_libro := v_rec.libro_aula;
  IF v_libro IS NULL THEN RAISE EXCEPTION 'Tu aula todavía no tiene libro.'; END IF;
  IF p_cantidad IS NULL OR p_cantidad < 1 THEN RAISE EXCEPTION 'Pon al menos 1 ovillo.'; END IF;

  -- Primero el bote y después el saldo, igual que recompensa_borrar (sin cruces).
  PERFORM pg_advisory_xact_lock(hashtext('recompensa:' || p_recompensa));
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || v_libro));

  IF (SELECT entregado_at FROM recompensas WHERE id = p_recompensa) IS NOT NULL THEN
    RAISE EXCEPTION 'Este bote ya se entregó.';
  END IF;
  v_juntado := _bote_juntado(p_recompensa);
  IF v_juntado >= v_rec.precio THEN RAISE EXCEPTION '¡El bote ya está lleno!'; END IF;
  v_cant := least(p_cantidad, v_rec.precio - v_juntado);

  IF _ovillos_saldo(v_user, v_libro) < v_cant THEN
    RAISE EXCEPTION 'No te alcanzan los ovillos.';
  END IF;

  INSERT INTO recompensas_aportes (recompensa_id, aula_id, user_id, libro_id, cantidad)
  VALUES (p_recompensa, v_rec.aula_id, v_user, v_libro, v_cant)
  RETURNING id INTO v_id;

  INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
  VALUES (v_user, v_libro, -v_cant, 'recompensa', v_id, jsonb_build_object('bote', p_recompensa));

  RETURN jsonb_build_object('saldo', _ovillos_saldo(v_user, v_libro), 'puesto', v_cant,
                            'juntado', v_juntado + v_cant, 'lleno', v_juntado + v_cant >= v_rec.precio);
END;
$$;


--
-- Name: recompensa_borrar(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompensa_borrar(p_recompensa uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_r record;
  v_a record;
BEGIN
  SELECT aula_id, limite, entregado_at INTO v_r FROM recompensas WHERE id = p_recompensa;
  IF v_r.aula_id IS NULL THEN RAISE EXCEPTION 'Esa recompensa no existe.'; END IF;
  PERFORM _profe_de_aula(v_r.aula_id);

  IF v_r.limite = 'bote' THEN
    IF v_r.entregado_at IS NOT NULL THEN
      RAISE EXCEPTION 'Ese bote ya se entregó: apágalo en vez de borrarlo.';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('recompensa:' || p_recompensa));
    FOR v_a IN
      SELECT user_id, libro_id, sum(cantidad)::int AS total FROM recompensas_aportes
      WHERE recompensa_id = p_recompensa GROUP BY user_id, libro_id ORDER BY user_id
    LOOP
      PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_a.user_id || ':' || v_a.libro_id));
      INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
      VALUES (v_a.user_id, v_a.libro_id, v_a.total, 'recompensa', p_recompensa,
              jsonb_build_object('bote', p_recompensa, 'devuelto', true));
    END LOOP;
    DELETE FROM recompensas WHERE id = p_recompensa;   -- los aportes se van con él (CASCADE)
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM recompensas_canjes WHERE recompensa_id = p_recompensa) THEN
    RAISE EXCEPTION 'Ya la canjearon: apágala en vez de borrarla.';
  END IF;
  DELETE FROM recompensas WHERE id = p_recompensa;
END;
$$;


--
-- Name: recompensa_canjear(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompensa_canjear(p_recompensa uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_rec   record;
  v_libro uuid;
  v_bloq  text;
  v_id    uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Inicia sesión.' USING ERRCODE = '42501'; END IF;

  SELECT r.*, a.libro_id AS libro_aula INTO v_rec
  FROM recompensas r JOIN _aulas_de_alumno(v_user) a ON a.aula_id = r.aula_id
  WHERE r.id = p_recompensa;
  IF v_rec.id IS NULL THEN RAISE EXCEPTION 'Esta recompensa no es de tu aula.' USING ERRCODE = '42501'; END IF;
  IF v_rec.limite = 'bote' THEN RAISE EXCEPTION 'Esto es un bote de la clase: pon los ovillos que quieras.'; END IF;  -- 097
  IF NOT v_rec.activa THEN RAISE EXCEPTION 'Tu profe quitó esta recompensa de la tienda.'; END IF;
  v_libro := v_rec.libro_aula;
  IF v_libro IS NULL THEN RAISE EXCEPTION 'Tu aula todavía no tiene libro.'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || v_libro));
  -- Los de toda la clase, en fila: dos alumnos no se llevan el mismo vale único.
  PERFORM pg_advisory_xact_lock(hashtext('recompensa:' || p_recompensa));

  v_bloq := _recompensa_bloqueo(v_user, p_recompensa, v_libro);
  IF v_bloq = 'ya_canjeado' THEN RAISE EXCEPTION 'Ya canjeaste esta recompensa.'; END IF;
  IF v_bloq = 'esta_semana' THEN RAISE EXCEPTION 'Esta recompensa se canjea una vez por semana.'; END IF;
  IF v_bloq = 'agotado'     THEN RAISE EXCEPTION 'Alguien de tu clase ya se la llevó.'; END IF;

  IF _ovillos_saldo(v_user, v_libro) < v_rec.precio THEN
    RAISE EXCEPTION 'No te alcanzan los ovillos.';
  END IF;

  INSERT INTO recompensas_canjes (recompensa_id, aula_id, user_id, libro_id, titulo, precio)
  VALUES (p_recompensa, v_rec.aula_id, v_user, v_libro, v_rec.titulo, v_rec.precio)
  RETURNING id INTO v_id;

  INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
  VALUES (v_user, v_libro, -v_rec.precio, 'recompensa', v_id, jsonb_build_object('recompensa', p_recompensa));

  RETURN jsonb_build_object('saldo', _ovillos_saldo(v_user, v_libro), 'canje', v_id);
END;
$$;


--
-- Name: recompensa_crear(uuid, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompensa_crear(p_aula uuid, p_titulo text, p_precio integer, p_limite text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM _profe_de_aula(p_aula);
  IF length(btrim(coalesce(p_titulo, ''))) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Escribe qué es (de 3 a 120 letras).';
  END IF;
  IF p_precio IS NULL OR p_precio NOT BETWEEN 1 AND 9999 THEN
    RAISE EXCEPTION 'El precio va de 1 a 9999 ovillos.';
  END IF;
  IF p_limite NOT IN ('alumno', 'semana', 'clase', 'libre', 'bote') THEN
    RAISE EXCEPTION 'Límite no válido.';
  END IF;
  IF (SELECT count(*) FROM recompensas WHERE aula_id = p_aula) >= 30 THEN
    RAISE EXCEPTION 'Máximo 30 recompensas por aula. Borra o reutiliza alguna.';
  END IF;

  INSERT INTO recompensas (aula_id, titulo, precio, limite, creada_por)
  VALUES (p_aula, btrim(p_titulo), p_precio, p_limite, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


--
-- Name: recompensas_aula(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompensas_aula(p_aula uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_libro  uuid;
  v_juegos jsonb;
  v_users  uuid[];
  v_ref    jsonb;
BEGIN
  PERFORM _profe_de_aula(p_aula);

  SELECT libro_id, juegos INTO v_libro, v_juegos FROM comunidades WHERE id = p_aula;
  SELECT coalesce(array_agg(user_id), '{}') INTO v_users
  FROM comunidad_miembros WHERE comunidad_id = p_aula AND rol = 'miembro';

  IF v_libro IS NOT NULL THEN
    v_ref := _referencia_ovillos(v_libro, v_juegos);
    v_ref := v_ref || jsonb_build_object('jugando', v_ref->'maximo');
  END IF;

  RETURN jsonb_build_object(
    'libro_id', v_libro,
    'alumnos', cardinality(v_users),
    'referencia', v_ref,
    'recompensas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'titulo', r.titulo, 'precio', r.precio, 'limite', r.limite, 'activa', r.activa,
        'canjes', CASE WHEN r.limite = 'bote'
                    THEN (SELECT count(DISTINCT ap.user_id) FROM recompensas_aportes ap WHERE ap.recompensa_id = r.id)
                    ELSE (SELECT count(*) FROM recompensas_canjes c WHERE c.recompensa_id = r.id AND c.estado <> 'devuelto') END,
        'juntado', CASE WHEN r.limite = 'bote' THEN _bote_juntado(r.id) END,
        'entregado_at', r.entregado_at,
        'aportes', CASE WHEN r.limite = 'bote' THEN coalesce((
                     SELECT jsonb_agg(jsonb_build_object('alumno', _nombre_en_aula(p_aula, s.user_id), 'cantidad', s.total)
                                      ORDER BY s.total DESC)
                     FROM (SELECT ap.user_id, sum(ap.cantidad)::int AS total FROM recompensas_aportes ap
                           WHERE ap.recompensa_id = r.id GROUP BY ap.user_id) s), '[]'::jsonb) END
      ) ORDER BY r.activa DESC, r.created_at)
      FROM recompensas r WHERE r.aula_id = p_aula), '[]'::jsonb),
    'pendientes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'alumno', _nombre_en_aula(p_aula, c.user_id), 'titulo', c.titulo,
        'precio', c.precio, 'fecha', c.created_at) ORDER BY c.created_at)
      FROM recompensas_canjes c WHERE c.aula_id = p_aula AND c.estado = 'pendiente'), '[]'::jsonb),
    'botes_por_entregar', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'titulo', r.titulo, 'precio', r.precio,
        'aportaron', (SELECT count(DISTINCT ap.user_id) FROM recompensas_aportes ap WHERE ap.recompensa_id = r.id))
        ORDER BY r.created_at)
      FROM recompensas r WHERE r.aula_id = p_aula AND r.limite = 'bote' AND r.entregado_at IS NULL
        AND _bote_juntado(r.id) >= r.precio), '[]'::jsonb),
    'entregados', coalesce((
      SELECT jsonb_agg(e ORDER BY e->>'fecha' DESC) FROM (
        SELECT jsonb_build_object(
          'id', c.id, 'alumno', _nombre_en_aula(p_aula, c.user_id), 'titulo', c.titulo,
          'precio', c.precio, 'estado', c.estado, 'fecha', c.resuelto_at) AS e
        FROM recompensas_canjes c WHERE c.aula_id = p_aula AND c.estado <> 'pendiente'
          AND c.resuelto_at > now() - interval '30 days'
        UNION ALL
        SELECT jsonb_build_object(
          'id', r.id, 'alumno', 'Toda la clase', 'titulo', r.titulo,
          'precio', r.precio, 'estado', 'entregado', 'fecha', r.entregado_at)
        FROM recompensas r WHERE r.aula_id = p_aula AND r.limite = 'bote'
          AND r.entregado_at > now() - interval '30 days'
      ) s), '[]'::jsonb),
    'expedientes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x->>'id', 'titulo', x->>'titulo',
        'abrieron', (SELECT count(*) FROM expedientes_compras ec
                     WHERE ec.libro_id = v_libro AND ec.expediente = x->>'id' AND ec.user_id = ANY (v_users))
      ) ORDER BY o)
      FROM expedientes_contenido e, jsonb_array_elements(e.datos->'expedientes') WITH ORDINALITY t(x, o)
      WHERE e.libro_id = v_libro), '[]'::jsonb)
  );
END;
$$;


--
-- Name: regenerar_codigo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.regenerar_codigo(p_comunidad uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_codigo text;
BEGIN
  IF NOT (es_moderador(p_comunidad) OR es_admin_de_aula(p_comunidad)) THEN
    RAISE EXCEPTION 'Solo el moderador puede cambiar el código.' USING ERRCODE = '42501';
  END IF;

  UPDATE comunidad_codigos
  SET codigo = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  WHERE comunidad_id = p_comunidad
  RETURNING codigo INTO v_codigo;

  RETURN v_codigo;
END;
$$;


--
-- Name: regenerar_codigo_profesor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.regenerar_codigo_profesor(p_aula uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_codigo text;
BEGIN
  IF NOT es_admin_de_aula(p_aula) THEN
    RAISE EXCEPTION 'Solo un administrador del colegio puede cambiar este código.' USING ERRCODE = '42501';
  END IF;

  UPDATE colegio_codigos SET codigo = _codigo_colegio('PROF')
  WHERE comunidad_id = p_aula AND tipo = 'profesor'
  RETURNING codigo INTO v_codigo;

  RETURN v_codigo;
END;
$$;


--
-- Name: resolver_denuncia(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolver_denuncia(p_id uuid, p_accion text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  d denuncias%ROWTYPE;
  v_resolucion text;
BEGIN
  IF NOT es_superusuario() THEN
    RAISE EXCEPTION 'Solo el superusuario resuelve denuncias.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO d FROM denuncias WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa denuncia ya no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF p_accion = 'deshacer' THEN
    UPDATE denuncias SET estado = 'pendiente', resolucion = NULL, resuelta_at = NULL WHERE id = p_id;
    RETURN;
  END IF;

  IF d.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Esa denuncia ya está resuelta.' USING ERRCODE = 'P0001', HINT = 'ya_resuelta';
  END IF;

  IF p_accion = 'descartar' THEN
    v_resolucion := 'descartada';

  ELSIF p_accion = 'borrar' THEN
    IF d.tipo = 'comentario_lectura' THEN DELETE FROM comentarios_lectura WHERE id = d.objeto_id;
    ELSIF d.tipo = 'mensajito'       THEN DELETE FROM mensajitos WHERE id = d.objeto_id;
    ELSIF d.tipo = 'foro'            THEN DELETE FROM foros_comentarios WHERE id = d.objeto_id;
    ELSE RAISE EXCEPTION 'Para una comunidad usa renombrar o cerrar.' USING ERRCODE = '22023';
    END IF;
    v_resolucion := 'borrado';

  ELSIF p_accion = 'sacar' THEN
    IF d.denunciado_id IS NULL OR d.comunidad_id IS NULL THEN
      RAISE EXCEPTION 'No sabemos a quién sacar: la persona o la comunidad ya no existen.' USING ERRCODE = 'P0002', HINT = 'sin_denunciado';
    END IF;
    DELETE FROM comunidad_miembros WHERE comunidad_id = d.comunidad_id AND user_id = d.denunciado_id;
    v_resolucion := 'sacado';

  ELSIF p_accion = 'renombrar' THEN
    IF d.tipo <> 'comunidad' THEN
      RAISE EXCEPTION 'Solo se renombra una comunidad denunciada.' USING ERRCODE = '22023';
    END IF;
    UPDATE comunidades SET nombre = 'Comunidad sin nombre', descripcion = NULL WHERE id = d.objeto_id;
    v_resolucion := 'renombrada';

  ELSIF p_accion = 'cerrar' THEN
    IF d.tipo <> 'comunidad' THEN
      RAISE EXCEPTION 'Solo se cierra una comunidad denunciada.' USING ERRCODE = '22023';
    END IF;
    DELETE FROM comunidades WHERE id = d.objeto_id;
    v_resolucion := 'cerrada';

  ELSE
    RAISE EXCEPTION 'Acción desconocida: %', p_accion USING ERRCODE = '22023';
  END IF;

  UPDATE denuncias
  SET estado = CASE WHEN v_resolucion = 'descartada' THEN 'descartada' ELSE 'revisada' END,
      resolucion = v_resolucion,
      resuelta_at = now()
  WHERE id = p_id;
END;
$$;


--
-- Name: resumen_colegio(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resumen_colegio(p_colegio uuid, p_zona text DEFAULT 'UTC'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_zona  text := _zona_valida(p_zona);
  v_lunes date := date_trunc('week', (now() AT TIME ZONE _zona_valida(p_zona)))::date;
BEGIN
  IF NOT es_admin_colegio(p_colegio) THEN
    RAISE EXCEPTION 'Solo la administración del colegio ve este resumen.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'semanas', (SELECT jsonb_agg(to_char(v_lunes - 7 * i, 'YYYY-MM-DD') ORDER BY i DESC) FROM generate_series(0, 9) i),
    'aulas', coalesce((
      SELECT jsonb_agg(fila ORDER BY co.grado, co.seccion NULLS FIRST, co.nombre)
      FROM comunidades co
      -- Los números de los alumnos, una sola vez por aula.
      CROSS JOIN LATERAL (
        SELECT count(*)                                                   AS alumnos,
               count(*) FILTER (WHERE a.estado IN ('al_dia', 'terminado')) AS al_dia,
               count(*) FILTER (WHERE a.estado = 'poco_atras')             AS poco_atras,
               count(*) FILTER (WHERE a.estado = 'atrasado')               AS atrasados,
               count(*) FILTER (WHERE a.estado = 'sin_empezar')            AS sin_empezar,
               count(*) FILTER (WHERE a.estado IS NOT NULL)                AS con_meta,
               round(avg(a.porcentaje))                                    AS avance_promedio,
               coalesce(sum(a.minutos_semana), 0)                          AS minutos_semana,
               count(*) FILTER (WHERE a.dias_semana > 0)                   AS activos_semana
        FROM _alumnos_aula(co.id, v_zona) a
      ) st
      CROSS JOIN LATERAL (
        SELECT jsonb_build_object(
          'aula_id', co.id,
          'nombre', co.nombre,
          'profesores', coalesce((
            SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id,
                     'nombre', coalesce(nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Profesor')) ORDER BY m.unido_at)
            FROM comunidad_miembros m LEFT JOIN perfiles pf ON pf.id = m.user_id
            WHERE m.comunidad_id = co.id AND m.rol = 'moderador'), '[]'::jsonb),
          'libro_id', (SELECT cl.libro_id FROM comunidad_lecturas cl WHERE cl.comunidad_id = co.id AND cl.fin IS NULL LIMIT 1),
          'libro', (SELECT l.titulo FROM comunidad_lecturas cl JOIN libros l ON l.id = cl.libro_id
                    WHERE cl.comunidad_id = co.id AND cl.fin IS NULL LIMIT 1),
          'alumnos',         st.alumnos,
          'al_dia',          st.al_dia,
          'poco_atras',      st.poco_atras,
          'atrasados',       st.atrasados,
          'sin_empezar',     st.sin_empezar,
          'con_meta',        st.con_meta,
          'avance_promedio', st.avance_promedio,
          'minutos_semana',  st.minutos_semana,
          'activos_semana',  st.activos_semana,
          -- Libros del aula que sus alumnos terminaron (cualquier lectura).
          'terminados', (
            SELECT count(*) FROM progreso_lectura pl
            WHERE pl.porcentaje >= 100
              AND pl.user_id IN (SELECT m.user_id FROM comunidad_miembros m WHERE m.comunidad_id = co.id AND m.rol = 'miembro')
              AND pl.libro_id IN (SELECT cl.libro_id FROM comunidad_lecturas cl WHERE cl.comunidad_id = co.id)),
          -- Minutos por semana (lunes a domingo) en los libros del aula, las
          -- últimas 10, de la más antigua a la actual.
          'minutos_por_semana', (
            SELECT jsonb_agg(coalesce(w.minutos, 0) ORDER BY i DESC)
            FROM generate_series(0, 9) i
            LEFT JOIN (
              SELECT date_trunc('week', s.started_at AT TIME ZONE v_zona)::date AS lunes,
                     sum(coalesce(s.segundos_activos,
                         CASE WHEN s.ended_at IS NULL THEN 0
                              ELSE least(extract(epoch FROM s.ended_at - s.started_at), 7200) END))::int / 60 AS minutos
              FROM sesiones_lectura s
              WHERE s.user_id IN (SELECT m.user_id FROM comunidad_miembros m WHERE m.comunidad_id = co.id AND m.rol = 'miembro')
                AND s.libro_id IN (SELECT cl.libro_id FROM comunidad_lecturas cl WHERE cl.comunidad_id = co.id)
                AND s.started_at >= (v_lunes - 63)::timestamp AT TIME ZONE v_zona
              GROUP BY 1
            ) w ON w.lunes = v_lunes - 7 * i)
        ) AS fila
      ) f
      WHERE co.colegio_id = p_colegio), '[]'::jsonb)
  );
END;
$$;


--
-- Name: salon_aula(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salon_aula(p_aula uuid, p_zona text DEFAULT 'UTC'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_zona  text := _zona_valida(p_zona);
  v_hoy   date := (now() AT TIME ZONE _zona_valida(p_zona))::date;
  v_aula  comunidades%ROWTYPE;
  v_meta  record;
  v_libro record;
  v_alumnos jsonb;
BEGIN
  SELECT * INTO v_aula FROM comunidades WHERE id = p_aula AND colegio_id IS NOT NULL;
  IF NOT FOUND OR NOT (es_admin_de_aula(p_aula) OR es_moderador(p_aula)) THEN
    RAISE EXCEPTION 'Solo el colegio ve los datos de esta aula.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_meta FROM _meta_aula(p_aula, v_zona);
  SELECT l.titulo, l.autor, l.portada_url, l.color INTO v_libro FROM libros l WHERE l.id = v_meta.libro_id;

  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.nombre), '[]'::jsonb) INTO v_alumnos
  FROM _alumnos_aula(p_aula, v_zona) a;

  RETURN jsonb_build_object(
    'aula', jsonb_build_object('id', v_aula.id, 'nombre', v_aula.nombre),
    'lectura', CASE WHEN v_meta.libro_id IS NULL THEN NULL ELSE jsonb_build_object(
      'libro_id', v_meta.libro_id, 'titulo', v_libro.titulo, 'autor', v_libro.autor,
      'portada', v_libro.portada_url, 'color', v_libro.color,
      'inicio', v_meta.inicio, 'fecha_meta', v_meta.fecha_meta,
      'dias_restantes', CASE WHEN v_meta.fecha_meta IS NULL THEN NULL ELSE v_meta.fecha_meta - v_hoy END,
      'total_capitulos', v_meta.total_capitulos,
      'esperado', round(v_meta.esperado),
      'meta_capitulo', v_meta.meta_capitulo,
      'promedio_capitulo', (
        SELECT round(avg((x->>'capitulo_actual')::numeric), 1) FROM jsonb_array_elements(v_alumnos) x
        WHERE (x->>'porcentaje')::int > 0)
    ) END,
    'alumnos', v_alumnos,
    -- Quiénes van en cada capítulo (el siguiente al último terminado).
    'capitulos', CASE WHEN v_meta.libro_id IS NULL THEN '[]'::jsonb ELSE coalesce((
      SELECT jsonb_agg(jsonb_build_object('numero', n, 'nombres', coalesce(q.nombres, '[]'::jsonb)) ORDER BY n)
      FROM generate_series(1, greatest(v_meta.total_capitulos, 1)) n
      LEFT JOIN (
        SELECT (x->>'capitulo_actual')::int AS cap, jsonb_agg(x->>'nombre' ORDER BY x->>'nombre') AS nombres
        FROM jsonb_array_elements(v_alumnos) x
        WHERE (x->>'porcentaje')::int > 0
        GROUP BY 1
      ) q ON q.cap = n), '[]'::jsonb) END,
    -- Minutos de toda la clase por día, últimos 28, en los libros del aula.
    'minutos_dia', (
      SELECT jsonb_agg(jsonb_build_object('dia', to_char(v_hoy - i, 'YYYY-MM-DD'), 'minutos', coalesce(d.minutos, 0)) ORDER BY i DESC)
      FROM generate_series(0, 27) i
      LEFT JOIN (
        SELECT (s.started_at AT TIME ZONE v_zona)::date AS dia,
               sum(coalesce(s.segundos_activos,
                   CASE WHEN s.ended_at IS NULL THEN 0
                        ELSE least(extract(epoch FROM s.ended_at - s.started_at), 7200) END))::int / 60 AS minutos
        FROM sesiones_lectura s
        WHERE s.user_id IN (SELECT m.user_id FROM comunidad_miembros m WHERE m.comunidad_id = p_aula AND m.rol = 'miembro')
          AND s.libro_id IN (SELECT cl.libro_id FROM comunidad_lecturas cl WHERE cl.comunidad_id = p_aula)
          AND s.started_at >= (v_hoy - 27)::timestamp AT TIME ZONE v_zona
        GROUP BY 1
      ) d ON d.dia = v_hoy - i),
    -- Párrafos que subrayaron 3 o más alumnos del aula. El texto es el del
    -- libro (parrafos.contenido), nunca la selección de nadie.
    'subrayados', coalesce((
      SELECT jsonb_agg(jsonb_build_object('capitulo', y.capitulo, 'texto', y.texto, 'alumnos', y.n) ORDER BY y.n DESC, y.capitulo)
      FROM (
        SELECT c.numero AS capitulo, left(p.contenido, 280) AS texto, count(DISTINCT su.user_id) AS n
        FROM subrayados_usuario su
        JOIN parrafos p  ON p.id = su.parrafo_id
        JOIN capitulos c ON c.id = p.capitulo_id
        WHERE su.libro_id = v_meta.libro_id
          AND su.user_id IN (SELECT m.user_id FROM comunidad_miembros m WHERE m.comunidad_id = p_aula AND m.rol = 'miembro')
        GROUP BY c.numero, p.id, p.contenido
        HAVING count(DISTINCT su.user_id) >= 3
        ORDER BY count(DISTINCT su.user_id) DESC, c.numero
        LIMIT 5
      ) y), '[]'::jsonb)
  );
END;
$$;


--
-- Name: tienda_recompensas(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_recompensas(p_libro uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_libros jsonb;
  v_libro  uuid := p_libro;
  v_caps   int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Inicia sesión.' USING ERRCODE = '42501'; END IF;

  WITH aula AS (
    SELECT DISTINCT a.libro_id FROM _aulas_de_alumno(v_user) a WHERE a.libro_id IS NOT NULL
  ),
  con_exp AS (
    SELECT bu.libro_id FROM bibliotecas_usuarios bu JOIN expedientes_contenido e ON e.libro_id = bu.libro_id
    WHERE bu.user_id = v_user
  ),
  todos AS (
    SELECT l.id, l.titulo, EXISTS (SELECT 1 FROM aula WHERE aula.libro_id = l.id) AS de_aula
    FROM libros l WHERE l.id IN (SELECT libro_id FROM aula UNION SELECT libro_id FROM con_exp)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'titulo', titulo, 'de_aula', de_aula)
                            ORDER BY de_aula DESC, titulo), '[]'::jsonb)
  INTO v_libros FROM todos;

  IF v_libro IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_libros) x WHERE (x->>'id')::uuid = v_libro) THEN
    v_libro := (v_libros->0->>'id')::uuid;
  END IF;
  IF v_libro IS NULL THEN
    RETURN jsonb_build_object('libros', '[]'::jsonb, 'libro_id', NULL);
  END IF;

  SELECT count(*) INTO v_caps FROM capitulos WHERE libro_id = v_libro;

  RETURN jsonb_build_object(
    'libros', v_libros,
    'libro_id', v_libro,
    'saldo', _ovillos_saldo(v_user, v_libro),
    'solo_leyendo', 10 + 2 * v_caps,
    'recompensas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'titulo', r.titulo, 'precio', r.precio, 'limite', r.limite, 'aula', a.nombre,
        'bloqueo', _recompensa_bloqueo(v_user, r.id, v_libro),
        'desde', CASE WHEN r.limite = 'semana' THEN (
                   SELECT max(c.created_at) + interval '7 days' FROM recompensas_canjes c
                   WHERE c.recompensa_id = r.id AND c.user_id = v_user AND c.estado <> 'devuelto'
                     AND c.created_at > now() - interval '7 days') END,
        'juntado', CASE WHEN r.limite = 'bote' THEN _bote_juntado(r.id) END,
        'mio', CASE WHEN r.limite = 'bote' THEN (
                 SELECT coalesce(sum(ap.cantidad), 0) FROM recompensas_aportes ap
                 WHERE ap.recompensa_id = r.id AND ap.user_id = v_user) END
      ) ORDER BY (r.limite = 'bote') DESC, r.precio, r.created_at)
      FROM _aulas_de_alumno(v_user) a JOIN recompensas r ON r.aula_id = a.aula_id
      WHERE a.libro_id = v_libro AND r.activa), '[]'::jsonb),
    'expedientes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x->>'id', 'titulo', x->>'titulo', 'descripcion', x->>'descripcion',
        'precio', (x->>'precio')::int,
        'comprado', EXISTS (SELECT 1 FROM expedientes_compras ec
                            WHERE ec.user_id = v_user AND ec.libro_id = v_libro AND ec.expediente = x->>'id')
      ) ORDER BY o)
      FROM expedientes_contenido e, jsonb_array_elements(e.datos->'expedientes') WITH ORDINALITY t(x, o)
      WHERE e.libro_id = v_libro), '[]'::jsonb),
    'canjes', coalesce((
      SELECT jsonb_agg(c ORDER BY c->>'fecha' DESC) FROM (
        SELECT jsonb_build_object('tipo', 'vale', 'id', rc.id, 'titulo', rc.titulo, 'precio', rc.precio,
                                  'estado', rc.estado, 'fecha', rc.created_at) AS c
        FROM recompensas_canjes rc WHERE rc.user_id = v_user AND rc.libro_id = v_libro
        UNION ALL
        SELECT jsonb_build_object('tipo', 'expediente', 'id', ec.expediente,
                                  'titulo', coalesce((SELECT x->>'titulo' FROM expedientes_contenido e, jsonb_array_elements(e.datos->'expedientes') x
                                                      WHERE e.libro_id = ec.libro_id AND x->>'id' = ec.expediente), 'Expediente'),
                                  'precio', ec.precio, 'estado', 'abierto', 'fecha', ec.created_at)
        FROM expedientes_compras ec WHERE ec.user_id = v_user AND ec.libro_id = v_libro
        UNION ALL
        SELECT jsonb_build_object('tipo', 'bote', 'id', ap.id, 'titulo', r.titulo, 'precio', ap.cantidad,
                                  'estado', CASE WHEN r.entregado_at IS NOT NULL THEN 'entregado'
                                                 WHEN _bote_juntado(r.id) >= r.precio THEN 'lleno'
                                                 ELSE 'aportado' END,
                                  'fecha', ap.created_at)
        FROM recompensas_aportes ap JOIN recompensas r ON r.id = ap.recompensa_id
        WHERE ap.user_id = v_user AND ap.libro_id = v_libro
      ) s), '[]'::jsonb)
  );
END;
$$;


--
-- Name: trg_muestra_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_muestra_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  PERFORM recalcular_muestra(ARRAY(SELECT DISTINCT libro_id FROM viejos));
  RETURN NULL;
END $$;


--
-- Name: trg_muestra_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_muestra_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  PERFORM recalcular_muestra(ARRAY(SELECT DISTINCT libro_id FROM nuevos));
  RETURN NULL;
END $$;


--
-- Name: trg_muestra_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_muestra_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  PERFORM recalcular_muestra(ARRAY(
    SELECT libro_id FROM nuevos UNION SELECT libro_id FROM viejos));
  RETURN NULL;
END $$;


--
-- Name: trg_palabras_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_palabras_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM recalcular_palabras_capitulos(ARRAY(SELECT DISTINCT capitulo_id FROM viejos));
  RETURN NULL;
END $$;


--
-- Name: trg_palabras_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_palabras_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM recalcular_palabras_capitulos(ARRAY(SELECT DISTINCT capitulo_id FROM nuevos));
  RETURN NULL;
END $$;


--
-- Name: trg_palabras_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_palabras_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM recalcular_palabras_capitulos(ARRAY(
    SELECT capitulo_id FROM nuevos UNION SELECT capitulo_id FROM viejos));
  RETURN NULL;
END $$;


--
-- Name: unirse_con_codigo(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unirse_con_codigo(p_codigo text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  v_comunidad uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.';
  END IF;

  SELECT comunidad_id INTO v_comunidad
  FROM comunidad_codigos
  WHERE codigo = upper(btrim(p_codigo));

  IF v_comunidad IS NULL THEN
    RAISE EXCEPTION 'El código no es válido.' USING ERRCODE = 'P0002', HINT = 'codigo_invalido';
  END IF;

  IF EXISTS (SELECT 1 FROM comunidades WHERE id = v_comunidad AND colegio_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Para entrar a un aula hacen falta tu nombre y apellido.'
      USING ERRCODE = 'P0001', HINT = 'falta_nombre_aula';
  END IF;

  -- Antes del INSERT: si ya estaba dentro, el trigger del tope no debe
  -- saltar por una comunidad que ya cuenta.
  IF NOT EXISTS (SELECT 1 FROM comunidad_miembros WHERE comunidad_id = v_comunidad AND user_id = uid) THEN
    INSERT INTO comunidad_miembros (comunidad_id, user_id, rol)
    VALUES (v_comunidad, uid, 'miembro');
  END IF;

  RETURN v_comunidad;
END;
$$;


--
-- Name: album_barajitas_pegadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.album_barajitas_pegadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    seccion text NOT NULL,
    item_key text NOT NULL,
    pegada_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: biblioteca_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.biblioteca_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    tipo text NOT NULL,
    url text NOT NULL,
    titulo text,
    descripcion text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    destacado boolean DEFAULT false NOT NULL,
    CONSTRAINT biblioteca_media_tipo_check CHECK ((tipo = ANY (ARRAY['audio'::text, 'imagen'::text, 'video'::text])))
);


--
-- Name: capitulos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capitulos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    numero integer NOT NULL,
    titulo text,
    palabras integer,
    en_muestra boolean DEFAULT false NOT NULL,
    ambientes jsonb
);


--
-- Name: COLUMN capitulos.ambientes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.capitulos.ambientes IS 'Tramos de sonido de ambiente: [{desde, hasta, ambiente}] por número de párrafo. NULL = sin ambiente.';


--
-- Name: elementos_interactivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.elementos_interactivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parrafo_id uuid NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    media_id uuid NOT NULL
);


--
-- Name: parrafos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parrafos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    capitulo_id uuid NOT NULL,
    numero integer NOT NULL,
    contenido text NOT NULL,
    tipo text DEFAULT 'texto'::text NOT NULL,
    tiene_interactivo boolean DEFAULT false NOT NULL,
    escena_tags text[] DEFAULT '{}'::text[] NOT NULL,
    en_muestra boolean DEFAULT false NOT NULL,
    CONSTRAINT parrafos_tipo_check CHECK ((tipo = ANY (ARRAY['texto'::text, 'dialogo'::text, 'nota_marginal'::text, 'separador'::text])))
);


--
-- Name: album_imagenes; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.album_imagenes AS
 SELECT DISTINCT ON (c.libro_id, bm.id) c.libro_id,
    c.numero AS capitulo_numero,
    bm.id AS media_id,
    bm.url,
    bm.titulo,
    bm.slug
   FROM (((public.elementos_interactivos ei
     JOIN public.parrafos p ON ((p.id = ei.parrafo_id)))
     JOIN public.capitulos c ON ((c.id = p.capitulo_id)))
     JOIN public.biblioteca_media bm ON ((bm.id = ei.media_id)))
  WHERE (bm.tipo = 'imagen'::text)
  ORDER BY c.libro_id, bm.id, c.numero;


--
-- Name: anderson_contenido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anderson_contenido (
    libro_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    datos jsonb NOT NULL,
    actualizado_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT anderson_contenido_version_check CHECK ((version >= 1))
);


--
-- Name: TABLE anderson_contenido; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.anderson_contenido IS 'Juego de la mesa de investigación de cada libro (JSON compilado por cargar_anderson.py). Lleva las respuestas: solo lo leen las funciones anderson_*. Las claves de pistas y rasgos no se cambian una vez publicado. Ver migración 087.';


--
-- Name: anderson_jugadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anderson_jugadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    version integer NOT NULL,
    personaje text NOT NULL,
    pistas text[] NOT NULL,
    resultado text NOT NULL,
    rasgo text,
    pareja jsonb,
    opcion smallint,
    opcion_tipo text,
    pistas_en_mesa integer NOT NULL,
    capitulo integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resuelta_at timestamp with time zone,
    CONSTRAINT anderson_jugadas_check CHECK (((resultado = ANY (ARRAY['abierta'::text, 'acierto'::text, 'fallo'::text])) = (rasgo IS NOT NULL))),
    CONSTRAINT anderson_jugadas_check1 CHECK (((resultado = ANY (ARRAY['acierto'::text, 'fallo'::text])) = (opcion IS NOT NULL))),
    CONSTRAINT anderson_jugadas_opcion_tipo_check CHECK ((opcion_tipo = ANY (ARRAY['por_encima'::text, 'otra'::text]))),
    CONSTRAINT anderson_jugadas_pistas_check CHECK ((cardinality(pistas) = 3)),
    CONSTRAINT anderson_jugadas_resultado_check CHECK ((resultado = ANY (ARRAY['no_encajan'::text, 'casi'::text, 'abierta'::text, 'acierto'::text, 'fallo'::text])))
);


--
-- Name: TABLE anderson_jugadas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.anderson_jugadas IS 'Una fila por cada «Jugar» de la mesa de investigación. La partida se reconstruye de aquí. Solo escriben anderson_jugar y anderson_elegir. Ver migración 087.';


--
-- Name: anotaciones_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anotaciones_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    capitulo_num integer NOT NULL,
    contenido text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bibliotecas_usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bibliotecas_usuarios (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid,
    es_manual boolean DEFAULT false,
    leido boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    capitulo_actual integer DEFAULT 1,
    pagina_actual integer DEFAULT 0,
    categoria_id uuid,
    de_aula boolean DEFAULT false NOT NULL
);


--
-- Name: bibliotecas_usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bibliotecas_usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bibliotecas_usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bibliotecas_usuarios_id_seq OWNED BY public.bibliotecas_usuarios.id;


--
-- Name: capsula_contenido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capsula_contenido (
    libro_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    datos jsonb NOT NULL,
    actualizado_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT capsula_contenido_datos_check CHECK (((jsonb_typeof((datos -> 'preguntas'::text)) = 'array'::text) AND ((jsonb_array_length((datos -> 'preguntas'::text)) >= 1) AND (jsonb_array_length((datos -> 'preguntas'::text)) <= 8)))),
    CONSTRAINT capsula_contenido_version_check CHECK ((version >= 1))
);


--
-- Name: TABLE capsula_contenido; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.capsula_contenido IS 'Preguntas de la cápsula del tiempo de cada libro (las sube cargar_capsula.py). Solo las leen las funciones capsula_*. Ver migración 098.';


--
-- Name: capsula_respuestas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capsula_respuestas (
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    preguntas jsonb NOT NULL,
    antes jsonb NOT NULL,
    sellada_at timestamp with time zone DEFAULT now() NOT NULL,
    ahora jsonb,
    abierta_at timestamp with time zone,
    CONSTRAINT capsula_respuestas_check CHECK (((ahora IS NULL) = (abierta_at IS NULL))),
    CONSTRAINT capsula_respuestas_check1 CHECK (((jsonb_typeof(antes) = 'array'::text) AND (jsonb_array_length(antes) = jsonb_array_length(preguntas)))),
    CONSTRAINT capsula_respuestas_check2 CHECK (((ahora IS NULL) OR ((jsonb_typeof(ahora) = 'array'::text) AND (jsonb_array_length(ahora) = jsonb_array_length(preguntas)))))
);


--
-- Name: TABLE capsula_respuestas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.capsula_respuestas IS 'Cápsula del tiempo: lo que el alumno respondió al empezar el libro (antes) y al terminarlo (ahora). Guarda el texto: lo lee su profe. Solo escriben las funciones capsula_*. Ver migración 098.';


--
-- Name: cartelera_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cartelera_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    capitulo_numero integer NOT NULL,
    seccion text NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    imagen_media_id uuid,
    CONSTRAINT cartelera_items_seccion_check CHECK ((seccion = ANY (ARRAY['personajes'::text, 'lugares'::text, 'hechos'::text, 'datos'::text, 'notas'::text, 'glosario'::text, 'referencias'::text, 'resumen'::text])))
);


--
-- Name: cartelera_principal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cartelera_principal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    seccion text NOT NULL,
    imagen_media_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    video_media_id uuid,
    CONSTRAINT cartelera_principal_seccion_check CHECK ((seccion = ANY (ARRAY['personajes'::text, 'lugares'::text, 'hechos'::text, 'datos'::text])))
);


--
-- Name: categorias_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nombre text NOT NULL,
    color text DEFAULT '#7a4a28'::text NOT NULL,
    orden integer DEFAULT 0 NOT NULL
);


--
-- Name: chat_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_historial (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    foro_id uuid NOT NULL,
    partner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_mensajes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_mensajes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sesion_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    contenido text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_mensajes_contenido_check CHECK ((char_length(contenido) > 0))
);


--
-- Name: chat_sesiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sesiones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    usuario_a uuid NOT NULL,
    usuario_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_sesiones_distintos CHECK ((usuario_a <> usuario_b))
);


--
-- Name: colegio_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colegio_admins (
    colegio_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: colegio_codigos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colegio_codigos (
    codigo text NOT NULL,
    colegio_id uuid NOT NULL,
    tipo text NOT NULL,
    comunidad_id uuid,
    expira_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT colegio_codigos_check CHECK (((tipo = 'profesor'::text) = (comunidad_id IS NOT NULL))),
    CONSTRAINT colegio_codigos_codigo_check CHECK ((codigo ~ '^(ADMIN|PROF)-[A-Z0-9]{8}$'::text)),
    CONSTRAINT colegio_codigos_tipo_check CHECK ((tipo = ANY (ARRAY['admin'::text, 'profesor'::text])))
);


--
-- Name: colegios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colegios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    pais text NOT NULL,
    ciudad text,
    estado text DEFAULT 'piloto'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT colegios_ciudad_check CHECK (((ciudad IS NULL) OR (char_length(btrim(ciudad)) <= 80))),
    CONSTRAINT colegios_estado_check CHECK ((estado = ANY (ARRAY['piloto'::text, 'activo'::text, 'baja'::text]))),
    CONSTRAINT colegios_nombre_check CHECK (((char_length(btrim(nombre)) >= 1) AND (char_length(btrim(nombre)) <= 120))),
    CONSTRAINT colegios_pais_check CHECK (((char_length(btrim(pais)) >= 2) AND (char_length(btrim(pais)) <= 60)))
);


--
-- Name: comentarios_lectura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comentarios_lectura (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comunidad_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    parrafo_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    contenido text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    texto_citado text,
    CONSTRAINT comentarios_lectura_algo_que_mostrar CHECK (((contenido IS NOT NULL) OR (texto_citado IS NOT NULL))),
    CONSTRAINT comentarios_lectura_contenido_max CHECK (((contenido IS NULL) OR ((char_length(btrim(contenido)) >= 1) AND (char_length(btrim(contenido)) <= 500)))),
    CONSTRAINT comentarios_lectura_texto_citado_max CHECK (((texto_citado IS NULL) OR ((char_length(btrim(texto_citado)) >= 1) AND (char_length(btrim(texto_citado)) <= 2000))))
);


--
-- Name: comunidad_codigos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comunidad_codigos (
    comunidad_id uuid NOT NULL,
    codigo text DEFAULT upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8)) NOT NULL,
    CONSTRAINT comunidad_codigos_formato CHECK ((codigo ~ '^[A-Z0-9]{6,20}$'::text))
);


--
-- Name: comunidad_lecturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comunidad_lecturas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comunidad_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    fecha_meta date,
    encuentro_lugar text,
    encuentro_fecha timestamp with time zone,
    inicio timestamp with time zone DEFAULT now() NOT NULL,
    fin timestamp with time zone,
    CONSTRAINT comunidad_lecturas_encuentro_lugar_check CHECK (((encuentro_lugar IS NULL) OR ((char_length(btrim(encuentro_lugar)) >= 1) AND (char_length(btrim(encuentro_lugar)) <= 200))))
);


--
-- Name: comunidad_miembros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comunidad_miembros (
    comunidad_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rol text DEFAULT 'miembro'::text NOT NULL,
    unido_at timestamp with time zone DEFAULT now() NOT NULL,
    nombre_en_aula text,
    CONSTRAINT comunidad_miembros_nombre_en_aula_check CHECK (((nombre_en_aula IS NULL) OR ((char_length(btrim(nombre_en_aula)) >= 1) AND (char_length(btrim(nombre_en_aula)) <= 80)))),
    CONSTRAINT comunidad_miembros_rol_check CHECK ((rol = ANY (ARRAY['moderador'::text, 'miembro'::text])))
);


--
-- Name: comunidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comunidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    privada boolean DEFAULT false NOT NULL,
    libro_id uuid,
    creador_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    colegio_id uuid,
    grado text,
    seccion text,
    juegos jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT comunidades_aula_privada CHECK (((colegio_id IS NULL) OR privada)),
    CONSTRAINT comunidades_descripcion_check CHECK (((descripcion IS NULL) OR (char_length(descripcion) <= 500))),
    CONSTRAINT comunidades_grado_check CHECK (((grado IS NULL) OR ((char_length(btrim(grado)) >= 1) AND (char_length(btrim(grado)) <= 30)))),
    CONSTRAINT comunidades_juegos_objeto CHECK ((jsonb_typeof(juegos) = 'object'::text)),
    CONSTRAINT comunidades_nombre_check CHECK (((char_length(btrim(nombre)) >= 1) AND (char_length(btrim(nombre)) <= 60))),
    CONSTRAINT comunidades_seccion_check CHECK (((seccion IS NULL) OR ((char_length(btrim(seccion)) >= 1) AND (char_length(btrim(seccion)) <= 20))))
);


--
-- Name: COLUMN comunidades.juegos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comunidades.juegos IS 'Solo en aulas: los juegos que el profe encendió o apagó para su aula. Si falta uno, encendido. Ver migración 093.';


--
-- Name: concurso_contenido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concurso_contenido (
    libro_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    datos jsonb NOT NULL,
    actualizado_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT concurso_contenido_version_check CHECK ((version >= 1))
);


--
-- Name: TABLE concurso_contenido; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.concurso_contenido IS 'Frases del concurso de cada libro (JSON compilado por cargar_concurso.py). Lleva referencia y rúbrica: solo lo leen las funciones concurso_*. Los ids no se cambian una vez publicado. Ver migración 090.';


--
-- Name: concurso_jugadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concurso_jugadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    version integer NOT NULL,
    frase text NOT NULL,
    capitulo integer NOT NULL,
    tipo text NOT NULL,
    estado text DEFAULT 'abierta'::text NOT NULL,
    contexto boolean DEFAULT false NOT NULL,
    cincuenta boolean DEFAULT false NOT NULL,
    veredicto text,
    evaluando_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resuelta_at timestamp with time zone,
    CONSTRAINT concurso_jugadas_check CHECK (((estado = 'resuelta'::text) = (veredicto IS NOT NULL))),
    CONSTRAINT concurso_jugadas_check1 CHECK ((NOT (cincuenta AND (veredicto = 'casi'::text)))),
    CONSTRAINT concurso_jugadas_estado_check CHECK ((estado = ANY (ARRAY['abierta'::text, 'evaluando'::text, 'resuelta'::text]))),
    CONSTRAINT concurso_jugadas_tipo_check CHECK ((tipo = ANY (ARRAY['vocabulario'::text, 'sintaxis'::text, 'figurado'::text, 'ironia'::text, 'intencion'::text]))),
    CONSTRAINT concurso_jugadas_veredicto_check CHECK ((veredicto = ANY (ARRAY['correcto'::text, 'casi'::text, 'no'::text])))
);


--
-- Name: TABLE concurso_jugadas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.concurso_jugadas IS 'Una fila por alumno y frase del concurso: comodines y veredicto. Nunca guarda el texto del alumno ni la explicación de la IA. Solo escriben las funciones concurso_*. Ver migración 090.';


--
-- Name: concurso_llamadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concurso_llamadas (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE concurso_llamadas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.concurso_llamadas IS 'Una fila por cada llamada a la IA del concurso (cuenta aunque falle). Sirve para los topes por alumno y por día. Ver migración 090.';


--
-- Name: concurso_llamadas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.concurso_llamadas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.concurso_llamadas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: corazonadas_contenido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.corazonadas_contenido (
    libro_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    datos jsonb NOT NULL,
    actualizado_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT corazonadas_contenido_version_check CHECK ((version >= 1))
);


--
-- Name: TABLE corazonadas_contenido; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.corazonadas_contenido IS 'Corazonadas de cada libro (JSON compilado por cargar_corazonadas.py). Lleva las respuestas: solo lo leen las funciones corazonada*. Los ids no se cambian una vez publicado. Ver migración 089.';


--
-- Name: corazonadas_jugadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.corazonadas_jugadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    version integer NOT NULL,
    corazonada text NOT NULL,
    estado text NOT NULL,
    opcion smallint,
    ovillos smallint,
    acierto boolean,
    opcion_tipo text,
    capitulo integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cobrada_at timestamp with time zone,
    CONSTRAINT corazonadas_jugadas_check CHECK (((estado = 'perdida'::text) = (opcion IS NULL))),
    CONSTRAINT corazonadas_jugadas_check1 CHECK (((opcion IS NULL) = (ovillos IS NULL))),
    CONSTRAINT corazonadas_jugadas_check2 CHECK (((estado = 'cobrada'::text) = (acierto IS NOT NULL))),
    CONSTRAINT corazonadas_jugadas_estado_check CHECK ((estado = ANY (ARRAY['jugada'::text, 'cobrada'::text, 'perdida'::text]))),
    CONSTRAINT corazonadas_jugadas_opcion_check CHECK (((opcion >= 0) AND (opcion <= 2))),
    CONSTRAINT corazonadas_jugadas_opcion_tipo_check CHECK ((opcion_tipo = ANY (ARRAY['por_encima'::text, 'esperada'::text, 'otra'::text]))),
    CONSTRAINT corazonadas_jugadas_ovillos_check CHECK (((ovillos >= 1) AND (ovillos <= 3)))
);


--
-- Name: TABLE corazonadas_jugadas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.corazonadas_jugadas IS 'Una fila por alumno y corazonada: jugada (apostó), cobrada (vio si acertó) o perdida (llegó a la revelación sin jugar). Solo escriben las funciones corazonada_*. Ver migración 089.';


--
-- Name: creadores_comunidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creadores_comunidad (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: denuncias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.denuncias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    denunciante_id uuid NOT NULL,
    tipo text NOT NULL,
    objeto_id uuid NOT NULL,
    comunidad_id uuid,
    motivo text,
    contenido_denunciado text,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    denunciado_id uuid,
    libro_id uuid,
    parrafo_id uuid,
    resolucion text,
    resuelta_at timestamp with time zone,
    CONSTRAINT denuncias_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'revisada'::text, 'descartada'::text]))),
    CONSTRAINT denuncias_motivo_check CHECK (((motivo IS NULL) OR (char_length(motivo) <= 1000))),
    CONSTRAINT denuncias_resolucion_check CHECK (((resolucion IS NULL) OR (resolucion = ANY (ARRAY['descartada'::text, 'borrado'::text, 'sacado'::text, 'renombrada'::text, 'cerrada'::text])))),
    CONSTRAINT denuncias_tipo_check CHECK ((tipo = ANY (ARRAY['foro'::text, 'comentario_lectura'::text, 'mensajito'::text, 'comunidad'::text])))
);


--
-- Name: desafio_contenido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.desafio_contenido (
    libro_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    datos jsonb NOT NULL,
    actualizado_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT desafio_contenido_version_check CHECK ((version >= 1))
);


--
-- Name: TABLE desafio_contenido; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.desafio_contenido IS 'Hojas del gato del desafío de cada libro (JSON compilado por cargar_desafio.py). Solo lo leen las funciones desafio_*. Los ids de las preguntas no se cambian una vez publicado. Ver migración 092.';


--
-- Name: desafio_llamadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.desafio_llamadas (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE desafio_llamadas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.desafio_llamadas IS 'Una fila por cada llamada a la IA del desafío (cuenta aunque falle). Sirve para los topes por alumno y por día. Ver migración 092.';


--
-- Name: desafio_llamadas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.desafio_llamadas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.desafio_llamadas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: libros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.libros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    autor text NOT NULL,
    descripcion text,
    portada_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    color text,
    paginas integer,
    anio integer,
    categorias text[] DEFAULT '{}'::text[] NOT NULL,
    moods text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    es_ficcion boolean DEFAULT true NOT NULL,
    slug text,
    visible boolean DEFAULT true NOT NULL,
    orden integer,
    anio_texto text,
    primera_linea text
);


--
-- Name: COLUMN libros.orden; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.libros.orden IS 'Orden curado del catalogo (menor = mas arriba). Numerado de 10 en 10 para poder intercalar sin renumerar. NULL = sin puesto asignado, va al final.';


--
-- Name: elementos_con_contexto; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.elementos_con_contexto WITH (security_invoker='on') AS
 SELECT ei.id,
    bm.slug,
    bm.tipo,
    bm.url,
    bm.titulo,
    bm.descripcion,
    bm.metadata,
    p.id AS parrafo_id,
    p.numero AS parrafo_numero,
    p.contenido AS parrafo_contenido,
    c.id AS capitulo_id,
    c.numero AS capitulo_numero,
    c.titulo AS capitulo_titulo,
    l.id AS libro_id,
    l.titulo AS libro_titulo
   FROM ((((public.elementos_interactivos ei
     JOIN public.biblioteca_media bm ON ((bm.id = ei.media_id)))
     JOIN public.parrafos p ON ((p.id = ei.parrafo_id)))
     JOIN public.capitulos c ON ((c.id = p.capitulo_id)))
     JOIN public.libros l ON ((l.id = c.libro_id)));


--
-- Name: expedientes_compras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expedientes_compras (
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    expediente text NOT NULL,
    precio integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expedientes_compras_precio_check CHECK ((precio >= 0))
);


--
-- Name: TABLE expedientes_compras; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.expedientes_compras IS 'Expedientes que compró cada alumno (una vez cada uno). Solo escribe expediente_comprar. Ver migración 095.';


--
-- Name: expedientes_contenido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expedientes_contenido (
    libro_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    datos jsonb NOT NULL,
    actualizado_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expedientes_contenido_version_check CHECK ((version >= 1))
);


--
-- Name: TABLE expedientes_contenido; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.expedientes_contenido IS 'Expedientes de autor y época de cada libro (JSON de cargar_expedientes.py). Solo lo leen las funciones de la tienda: el texto se entrega a quien lo compró. Los ids no se cambian una vez publicado. Ver migración 095.';


--
-- Name: falsificador_contenido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.falsificador_contenido (
    libro_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    datos jsonb NOT NULL,
    actualizado_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT falsificador_contenido_datos_check CHECK (((jsonb_typeof((datos -> 'items'::text)) = 'array'::text) AND ((jsonb_array_length((datos -> 'items'::text)) >= 1) AND (jsonb_array_length((datos -> 'items'::text)) <= 16)))),
    CONSTRAINT falsificador_contenido_version_check CHECK ((version >= 1))
);


--
-- Name: TABLE falsificador_contenido; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.falsificador_contenido IS 'Párrafos sospechosos del falsificador de cada libro (los sube cargar_falsificador.py). Solo los leen las funciones falsificador_*. Ver migración 099.';


--
-- Name: falsificador_jugadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.falsificador_jugadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    item text NOT NULL,
    dijo text NOT NULL,
    acierto boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT falsificador_jugadas_dijo_check CHECK ((dijo = ANY (ARRAY['autor'::text, 'gato'::text])))
);


--
-- Name: TABLE falsificador_jugadas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.falsificador_jugadas IS 'Falsificador: qué respondió cada alumno en cada párrafo sospechoso (una vez, no se cambia). Solo escribe falsificador_responder. Ver migración 099.';


--
-- Name: foros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: foros_comentarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foros_comentarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    foro_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    contenido text NOT NULL,
    parent_id uuid,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    es_spoiler boolean DEFAULT false NOT NULL,
    comunidad_id uuid,
    CONSTRAINT foros_comentarios_contenido_check CHECK ((char_length(contenido) > 0)),
    CONSTRAINT foros_comentarios_contenido_max CHECK ((char_length(contenido) <= 2000)),
    CONSTRAINT foros_comentarios_tags_max CHECK ((COALESCE(array_length(tags, 1), 0) <= 5))
);


--
-- Name: libro_reels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.libro_reels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    orden smallint NOT NULL,
    imagen_url text,
    audio_url text,
    titulo text,
    subtexto text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: media_por_parrafo; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.media_por_parrafo AS
 SELECT DISTINCT ON (libro_id, capitulo_id, parrafo_id, media_id) parrafo_id,
    capitulo_id,
    libro_id,
    media_id,
    slug,
    tipo,
    url,
    titulo,
    descripcion,
    metadata,
    origen
   FROM ( SELECT p.id AS parrafo_id,
            p.capitulo_id,
            p.libro_id,
            bm.id AS media_id,
            bm.slug,
            bm.tipo,
            bm.url,
            bm.titulo,
            bm.descripcion,
            (bm.metadata || ei.metadata) AS metadata,
            'explicito'::text AS origen,
            1 AS prio
           FROM ((public.elementos_interactivos ei
             JOIN public.parrafos p ON ((p.id = ei.parrafo_id)))
             JOIN public.biblioteca_media bm ON ((bm.id = ei.media_id)))
        UNION ALL
         SELECT p.id AS parrafo_id,
            p.capitulo_id,
            p.libro_id,
            bm.id AS media_id,
            bm.slug,
            bm.tipo,
            bm.url,
            bm.titulo,
            bm.descripcion,
            bm.metadata,
            'tag'::text AS origen,
            2 AS prio
           FROM (public.parrafos p
             JOIN public.biblioteca_media bm ON ((bm.tags && p.escena_tags)))
          WHERE (array_length(p.escena_tags, 1) > 0)) fuentes
  ORDER BY libro_id, capitulo_id, parrafo_id, media_id, prio;


--
-- Name: libros_resumen; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.libros_resumen WITH (security_invoker='false') AS
 SELECT id AS libro_id,
    (( SELECT count(*) AS count
           FROM public.capitulos c
          WHERE (c.libro_id = l.id)))::integer AS capitulos,
    (( SELECT COALESCE(sum(c.palabras), (0)::bigint) AS "coalesce"
           FROM public.capitulos c
          WHERE (c.libro_id = l.id)))::integer AS palabras,
    (( SELECT count(DISTINCT m.media_id) AS count
           FROM public.media_por_parrafo m
          WHERE ((m.libro_id = l.id) AND (m.tipo = 'imagen'::text))))::integer AS ilustraciones,
    (( SELECT count(DISTINCT ROW(m.parrafo_id, m.media_id)) AS count
           FROM public.media_por_parrafo m
          WHERE ((m.libro_id = l.id) AND (m.tipo = 'audio'::text) AND (m.origen = 'explicito'::text))))::integer AS sonidos,
    (( SELECT count(DISTINCT ROW(ci.seccion, lower(btrim(ci.nombre)))) AS count
           FROM public.cartelera_items ci
          WHERE ((ci.libro_id = l.id) AND ((l.es_ficcion = false) OR (ci.seccion = ANY (ARRAY['personajes'::text, 'lugares'::text]))))))::integer AS fichas,
    COALESCE(primera_linea, ( SELECT p.contenido
           FROM (public.capitulos c
             JOIN public.parrafos p ON ((p.capitulo_id = c.id)))
          WHERE ((c.libro_id = l.id) AND (c.numero = 1) AND (p.tipo = ANY (ARRAY['texto'::text, 'dialogo'::text])) AND (char_length(p.contenido) >= 90))
          ORDER BY p.numero
         LIMIT 1)) AS primera_linea
   FROM public.libros l
  WHERE visible;


--
-- Name: mapa_contenido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mapa_contenido (
    libro_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    datos jsonb NOT NULL,
    actualizado_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mapa_contenido_version_check CHECK ((version >= 1))
);


--
-- Name: TABLE mapa_contenido; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.mapa_contenido IS 'Tesoros del mapa de cada libro (JSON compilado por cargar_mapa.py). Lleva las frases buenas: solo lo leen las funciones mapa_*. Los ids no se cambian una vez publicado. Ver migración 091.';


--
-- Name: mapa_jugadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mapa_jugadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    version integer NOT NULL,
    capitulo integer NOT NULL,
    parrafo integer NOT NULL,
    tesoro text,
    tipo text,
    acierto boolean NOT NULL,
    cerca boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mapa_jugadas_check CHECK (((tesoro IS NULL) = (tipo IS NULL))),
    CONSTRAINT mapa_jugadas_check1 CHECK (((NOT acierto) OR ((tesoro IS NOT NULL) AND (NOT cerca)))),
    CONSTRAINT mapa_jugadas_tipo_check CHECK ((tipo = ANY (ARRAY['vista'::text, 'escondido'::text])))
);


--
-- Name: TABLE mapa_jugadas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.mapa_jugadas IS 'Una fila por cada subrayado enviado al mapa del tesoro: acierto o fallo, y el tesoro (el encontrado o el del brillo). Nunca guarda el texto subrayado. Solo escriben las funciones mapa_*. Ver migración 091.';


--
-- Name: mensajitos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensajitos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comunidad_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    parrafo_id uuid NOT NULL,
    de_id uuid NOT NULL,
    para_id uuid NOT NULL,
    contenido text NOT NULL,
    leido_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    texto_citado text,
    efimero boolean DEFAULT false NOT NULL,
    CONSTRAINT mensajitos_check CHECK ((de_id <> para_id)),
    CONSTRAINT mensajitos_contenido_check CHECK (((char_length(btrim(contenido)) >= 1) AND (char_length(btrim(contenido)) <= 300))),
    CONSTRAINT mensajitos_texto_citado_max CHECK (((texto_citado IS NULL) OR ((char_length(btrim(texto_citado)) >= 1) AND (char_length(btrim(texto_citado)) <= 2000))))
);


--
-- Name: COLUMN mensajitos.efimero; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mensajitos.efimero IS 'Se borra cuando lo lea: el cliente del destinatario lo borra al cerrarlo. Ver migración 058.';


--
-- Name: ovillos_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ovillos_movimientos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    cantidad integer NOT NULL,
    motivo text NOT NULL,
    referencia uuid,
    detalle jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ovillos_movimientos_cantidad_check CHECK ((cantidad <> 0)),
    CONSTRAINT ovillos_movimientos_motivo_check CHECK ((motivo = ANY (ARRAY['mesa_jugar'::text, 'mesa_premio'::text, 'corazonada'::text, 'concurso'::text, 'tesoro'::text, 'comodin'::text, 'pista_gato'::text, 'expediente'::text, 'recompensa'::text, 'falsificador'::text])))
);


--
-- Name: TABLE ovillos_movimientos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ovillos_movimientos IS 'Libro de cuentas de ovillos, común a todos los juegos y por libro. Saldo = 10 + 2 × capítulos completados + suma de cantidad (_ovillos_saldo). Solo escriben las funciones de cada juego. Ver migración 087.';


--
-- Name: perfiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perfiles (
    id uuid NOT NULL,
    nombre text NOT NULL,
    apellido text,
    fecha_nacimiento date,
    onboarding_completado boolean DEFAULT false NOT NULL,
    genero text
);


--
-- Name: COLUMN perfiles.genero; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.perfiles.genero IS 'Género declarado en el registro. Base legal: interés legítimo (art. 6.1.f), análisis y recomendaciones. Ver Política de Privacidad, secciones 2 y 3.';


--
-- Name: perfiles_publicos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.perfiles_publicos WITH (security_invoker='false') AS
 SELECT id,
    nombre,
    NULL::text AS apellido
   FROM public.perfiles;


--
-- Name: VIEW perfiles_publicos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.perfiles_publicos IS 'Nombre público de cada usuario para Foro, reseñas y chat. Solo id/nombre; apellido siempre NULL desde la 074 (la columna queda por compatibilidad). El resto de perfiles sigue siendo privado. Ver migraciones 038 y 074.';


--
-- Name: predicciones_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.predicciones_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    capitulo_num integer NOT NULL,
    contenido text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: preferencias_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preferencias_usuario (
    user_id uuid NOT NULL,
    ultimos_libros uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    gato_color text DEFAULT 'negro'::text NOT NULL,
    tutorial_visto jsonb DEFAULT '{}'::jsonb NOT NULL,
    comunidad_activa uuid,
    pistas_vistas text[] DEFAULT '{}'::text[] NOT NULL,
    juegos jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT preferencias_usuario_gato_color_check CHECK ((gato_color = ANY (ARRAY['negro'::text, 'blanco'::text, 'naranja'::text]))),
    CONSTRAINT preferencias_usuario_juegos_objeto CHECK ((jsonb_typeof(juegos) = 'object'::text))
);


--
-- Name: COLUMN preferencias_usuario.comunidad_activa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preferencias_usuario.comunidad_activa IS 'Comunidad con la que lee el usuario ("Leer como"). NULL = solo yo. Ver migración 057.';


--
-- Name: COLUMN preferencias_usuario.juegos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preferencias_usuario.juegos IS 'Juegos de lectura que el usuario encendió o apagó en su Perfil ({mesa, corazonadas, concurso, mapa, desafio}: true|false). Solo lo que tocó; el resto, por defecto. Ver migración 093.';


--
-- Name: progreso_capitulos_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progreso_capitulos_log (
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    capitulo integer NOT NULL,
    terminado_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: progreso_lectura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progreso_lectura (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    ultimo_parrafo_id uuid,
    porcentaje smallint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_parrafo_offset integer DEFAULT 0 NOT NULL,
    capitulos_completados integer DEFAULT 0 NOT NULL,
    CONSTRAINT progreso_lectura_capitulos_completados_check CHECK ((capitulos_completados >= 0)),
    CONSTRAINT progreso_lectura_porcentaje_check CHECK (((porcentaje >= 0) AND (porcentaje <= 100)))
);


--
-- Name: COLUMN progreso_lectura.porcentaje; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.progreso_lectura.porcentaje IS '% del libro por palabras, para mostrar. Lo que desbloquea contenido es capitulos_completados. Ver migración 075.';


--
-- Name: COLUMN progreso_lectura.ultimo_parrafo_offset; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.progreso_lectura.ultimo_parrafo_offset IS 'Offset en caracteres dentro de ultimo_parrafo_id donde empieza la última página vista (para párrafos largos divididos en varias páginas).';


--
-- Name: COLUMN progreso_lectura.capitulos_completados; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.progreso_lectura.capitulos_completados IS 'Capítulos terminados. Desbloquea la Cartelera, el Álbum y el repaso. El % que ve el usuario es `porcentaje` (por palabras). Ver migración 075.';


--
-- Name: recompensas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recompensas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aula_id uuid NOT NULL,
    titulo text NOT NULL,
    precio integer NOT NULL,
    limite text DEFAULT 'alumno'::text NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creada_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    entregado_at timestamp with time zone,
    CONSTRAINT recompensas_limite_check CHECK ((limite = ANY (ARRAY['alumno'::text, 'semana'::text, 'clase'::text, 'libre'::text, 'bote'::text]))),
    CONSTRAINT recompensas_precio_check CHECK (((precio >= 1) AND (precio <= 9999))),
    CONSTRAINT recompensas_titulo_check CHECK (((length(btrim(titulo)) >= 3) AND (length(btrim(titulo)) <= 120)))
);


--
-- Name: TABLE recompensas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.recompensas IS 'Vales que el profe ofrece a su aula en la tienda de recompensas («2 puntos en el examen»). Solo escriben las funciones recompensa_*. Ver migración 095.';


--
-- Name: COLUMN recompensas.entregado_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.recompensas.entregado_at IS 'Solo botes (limite = bote): cuándo el profe lo marcó entregado. Ver migración 097.';


--
-- Name: recompensas_aportes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recompensas_aportes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recompensa_id uuid NOT NULL,
    aula_id uuid NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    cantidad integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recompensas_aportes_cantidad_check CHECK ((cantidad >= 1))
);


--
-- Name: TABLE recompensas_aportes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.recompensas_aportes IS 'Ovillos que cada alumno puso en un bote de la clase. Solo escribe recompensa_aportar; si el profe borra el bote, recompensa_borrar los devuelve. Ver migración 097.';


--
-- Name: recompensas_canjes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recompensas_canjes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recompensa_id uuid NOT NULL,
    aula_id uuid NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    titulo text NOT NULL,
    precio integer NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resuelto_at timestamp with time zone,
    resuelto_por uuid,
    CONSTRAINT recompensas_canjes_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'entregado'::text, 'devuelto'::text]))),
    CONSTRAINT recompensas_canjes_precio_check CHECK ((precio >= 1))
);


--
-- Name: TABLE recompensas_canjes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.recompensas_canjes IS 'Cada canje de un vale del profe. Pendiente → entregado (o devuelto, con los ovillos de vuelta). Ver migración 095.';


--
-- Name: resenas_libros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resenas_libros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    rating smallint NOT NULL,
    texto text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resenas_libros_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT resenas_libros_texto_max CHECK (((texto IS NULL) OR (char_length(texto) <= 1000)))
);


--
-- Name: sala_libros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sala_libros (
    sala_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    orden integer DEFAULT 0 NOT NULL
);


--
-- Name: salas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    nombre text NOT NULL,
    linea text,
    color text DEFAULT '#8b4d2a'::text NOT NULL,
    tipo text DEFAULT 'sala'::text NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    visible boolean DEFAULT true NOT NULL,
    desde date,
    hasta date,
    imagen_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    genero text,
    CONSTRAINT salas_check CHECK (((desde IS NULL) OR (hasta IS NULL) OR (desde <= hasta))),
    CONSTRAINT salas_color_check CHECK ((color ~ '^#[0-9a-fA-F]{6}$'::text)),
    CONSTRAINT salas_slug_check CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (slug <> 'catalogo'::text))),
    CONSTRAINT salas_tipo_check CHECK ((tipo = ANY (ARRAY['sala'::text, 'temporada'::text, 'carril'::text])))
);


--
-- Name: sesiones_lectura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sesiones_lectura (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    segundos_activos integer
);


--
-- Name: subrayados_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subrayados_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    capitulo_num integer NOT NULL,
    texto_original text NOT NULL,
    parrafo_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subrayados_populares; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.subrayados_populares WITH (security_invoker='false') AS
 SELECT libro_id,
    parrafo_id,
    (array_agg(texto_original ORDER BY (length(texto_original)) DESC, texto_original))[1] AS texto,
    count(DISTINCT user_id) AS total
   FROM public.subrayados_usuario
  WHERE (parrafo_id IS NOT NULL)
  GROUP BY libro_id, parrafo_id;


--
-- Name: VIEW subrayados_populares; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.subrayados_populares IS 'Frases más subrayadas por libro para la ficha de Tienda. Agregado anónimo: nunca expone user_id. La tabla subrayados_usuario es privada por fila. Ver migración 040.';


--
-- Name: superusuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.superusuarios (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bibliotecas_usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios ALTER COLUMN id SET DEFAULT nextval('public.bibliotecas_usuarios_id_seq'::regclass);


--
-- Name: album_barajitas_pegadas album_barajitas_pegadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_barajitas_pegadas
    ADD CONSTRAINT album_barajitas_pegadas_pkey PRIMARY KEY (id);


--
-- Name: album_barajitas_pegadas album_barajitas_pegadas_user_id_libro_id_seccion_item_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_barajitas_pegadas
    ADD CONSTRAINT album_barajitas_pegadas_user_id_libro_id_seccion_item_key_key UNIQUE (user_id, libro_id, seccion, item_key);


--
-- Name: anderson_contenido anderson_contenido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anderson_contenido
    ADD CONSTRAINT anderson_contenido_pkey PRIMARY KEY (libro_id);


--
-- Name: anderson_jugadas anderson_jugadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anderson_jugadas
    ADD CONSTRAINT anderson_jugadas_pkey PRIMARY KEY (id);


--
-- Name: anotaciones_usuario anotaciones_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anotaciones_usuario
    ADD CONSTRAINT anotaciones_usuario_pkey PRIMARY KEY (id);


--
-- Name: biblioteca_media biblioteca_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biblioteca_media
    ADD CONSTRAINT biblioteca_media_pkey PRIMARY KEY (id);


--
-- Name: biblioteca_media biblioteca_media_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biblioteca_media
    ADD CONSTRAINT biblioteca_media_slug_key UNIQUE (slug);


--
-- Name: bibliotecas_usuarios bibliotecas_usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios
    ADD CONSTRAINT bibliotecas_usuarios_pkey PRIMARY KEY (id);


--
-- Name: bibliotecas_usuarios bibliotecas_usuarios_user_libro_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios
    ADD CONSTRAINT bibliotecas_usuarios_user_libro_unique UNIQUE (user_id, libro_id);


--
-- Name: capitulos capitulos_id_libro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos
    ADD CONSTRAINT capitulos_id_libro_id_key UNIQUE (id, libro_id);


--
-- Name: capitulos capitulos_libro_id_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos
    ADD CONSTRAINT capitulos_libro_id_numero_key UNIQUE (libro_id, numero);


--
-- Name: capitulos capitulos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos
    ADD CONSTRAINT capitulos_pkey PRIMARY KEY (id);


--
-- Name: capsula_contenido capsula_contenido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capsula_contenido
    ADD CONSTRAINT capsula_contenido_pkey PRIMARY KEY (libro_id);


--
-- Name: capsula_respuestas capsula_respuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capsula_respuestas
    ADD CONSTRAINT capsula_respuestas_pkey PRIMARY KEY (user_id, libro_id);


--
-- Name: cartelera_items cartelera_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_items
    ADD CONSTRAINT cartelera_items_pkey PRIMARY KEY (id);


--
-- Name: cartelera_principal cartelera_principal_libro_id_seccion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_principal
    ADD CONSTRAINT cartelera_principal_libro_id_seccion_key UNIQUE (libro_id, seccion);


--
-- Name: cartelera_principal cartelera_principal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_principal
    ADD CONSTRAINT cartelera_principal_pkey PRIMARY KEY (id);


--
-- Name: categorias_usuario categorias_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_usuario
    ADD CONSTRAINT categorias_usuario_pkey PRIMARY KEY (id);


--
-- Name: categorias_usuario categorias_usuario_user_id_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_usuario
    ADD CONSTRAINT categorias_usuario_user_id_nombre_key UNIQUE (user_id, nombre);


--
-- Name: chat_historial chat_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_historial
    ADD CONSTRAINT chat_historial_pkey PRIMARY KEY (id);


--
-- Name: chat_mensajes chat_mensajes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_mensajes
    ADD CONSTRAINT chat_mensajes_pkey PRIMARY KEY (id);


--
-- Name: chat_sesiones chat_sesiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sesiones
    ADD CONSTRAINT chat_sesiones_pkey PRIMARY KEY (id);


--
-- Name: colegio_admins colegio_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colegio_admins
    ADD CONSTRAINT colegio_admins_pkey PRIMARY KEY (colegio_id, user_id);


--
-- Name: colegio_codigos colegio_codigos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colegio_codigos
    ADD CONSTRAINT colegio_codigos_pkey PRIMARY KEY (codigo);


--
-- Name: colegios colegios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colegios
    ADD CONSTRAINT colegios_pkey PRIMARY KEY (id);


--
-- Name: comentarios_lectura comentarios_lectura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_lectura
    ADD CONSTRAINT comentarios_lectura_pkey PRIMARY KEY (id);


--
-- Name: comunidad_codigos comunidad_codigos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_codigos
    ADD CONSTRAINT comunidad_codigos_codigo_key UNIQUE (codigo);


--
-- Name: comunidad_codigos comunidad_codigos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_codigos
    ADD CONSTRAINT comunidad_codigos_pkey PRIMARY KEY (comunidad_id);


--
-- Name: comunidad_lecturas comunidad_lecturas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_lecturas
    ADD CONSTRAINT comunidad_lecturas_pkey PRIMARY KEY (id);


--
-- Name: comunidad_miembros comunidad_miembros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_miembros
    ADD CONSTRAINT comunidad_miembros_pkey PRIMARY KEY (comunidad_id, user_id);


--
-- Name: comunidades comunidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidades
    ADD CONSTRAINT comunidades_pkey PRIMARY KEY (id);


--
-- Name: concurso_contenido concurso_contenido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concurso_contenido
    ADD CONSTRAINT concurso_contenido_pkey PRIMARY KEY (libro_id);


--
-- Name: concurso_jugadas concurso_jugadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concurso_jugadas
    ADD CONSTRAINT concurso_jugadas_pkey PRIMARY KEY (id);


--
-- Name: concurso_jugadas concurso_jugadas_user_id_libro_id_frase_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concurso_jugadas
    ADD CONSTRAINT concurso_jugadas_user_id_libro_id_frase_key UNIQUE (user_id, libro_id, frase);


--
-- Name: concurso_llamadas concurso_llamadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concurso_llamadas
    ADD CONSTRAINT concurso_llamadas_pkey PRIMARY KEY (id);


--
-- Name: corazonadas_contenido corazonadas_contenido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corazonadas_contenido
    ADD CONSTRAINT corazonadas_contenido_pkey PRIMARY KEY (libro_id);


--
-- Name: corazonadas_jugadas corazonadas_jugadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corazonadas_jugadas
    ADD CONSTRAINT corazonadas_jugadas_pkey PRIMARY KEY (id);


--
-- Name: corazonadas_jugadas corazonadas_jugadas_user_id_libro_id_corazonada_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corazonadas_jugadas
    ADD CONSTRAINT corazonadas_jugadas_user_id_libro_id_corazonada_key UNIQUE (user_id, libro_id, corazonada);


--
-- Name: creadores_comunidad creadores_comunidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creadores_comunidad
    ADD CONSTRAINT creadores_comunidad_pkey PRIMARY KEY (user_id);


--
-- Name: denuncias denuncias_denunciante_id_tipo_objeto_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_denunciante_id_tipo_objeto_id_key UNIQUE (denunciante_id, tipo, objeto_id);


--
-- Name: denuncias denuncias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_pkey PRIMARY KEY (id);


--
-- Name: desafio_charlas desafio_charlas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desafio_charlas
    ADD CONSTRAINT desafio_charlas_pkey PRIMARY KEY (id);


--
-- Name: desafio_charlas desafio_charlas_user_id_libro_id_momento_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desafio_charlas
    ADD CONSTRAINT desafio_charlas_user_id_libro_id_momento_key UNIQUE (user_id, libro_id, momento);


--
-- Name: desafio_contenido desafio_contenido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desafio_contenido
    ADD CONSTRAINT desafio_contenido_pkey PRIMARY KEY (libro_id);


--
-- Name: desafio_llamadas desafio_llamadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desafio_llamadas
    ADD CONSTRAINT desafio_llamadas_pkey PRIMARY KEY (id);


--
-- Name: elementos_interactivos elementos_interactivos_parrafo_media_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elementos_interactivos
    ADD CONSTRAINT elementos_interactivos_parrafo_media_unique UNIQUE (parrafo_id, media_id);


--
-- Name: elementos_interactivos elementos_interactivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elementos_interactivos
    ADD CONSTRAINT elementos_interactivos_pkey PRIMARY KEY (id);


--
-- Name: expedientes_compras expedientes_compras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes_compras
    ADD CONSTRAINT expedientes_compras_pkey PRIMARY KEY (user_id, libro_id, expediente);


--
-- Name: expedientes_contenido expedientes_contenido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes_contenido
    ADD CONSTRAINT expedientes_contenido_pkey PRIMARY KEY (libro_id);


--
-- Name: falsificador_contenido falsificador_contenido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falsificador_contenido
    ADD CONSTRAINT falsificador_contenido_pkey PRIMARY KEY (libro_id);


--
-- Name: falsificador_jugadas falsificador_jugadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falsificador_jugadas
    ADD CONSTRAINT falsificador_jugadas_pkey PRIMARY KEY (id);


--
-- Name: falsificador_jugadas falsificador_jugadas_user_id_libro_id_item_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falsificador_jugadas
    ADD CONSTRAINT falsificador_jugadas_user_id_libro_id_item_key UNIQUE (user_id, libro_id, item);


--
-- Name: foros_comentarios foros_comentarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros_comentarios
    ADD CONSTRAINT foros_comentarios_pkey PRIMARY KEY (id);


--
-- Name: foros foros_libro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros
    ADD CONSTRAINT foros_libro_id_key UNIQUE (libro_id);


--
-- Name: foros foros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros
    ADD CONSTRAINT foros_pkey PRIMARY KEY (id);


--
-- Name: libro_reels libro_reels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libro_reels
    ADD CONSTRAINT libro_reels_pkey PRIMARY KEY (id);


--
-- Name: libros libros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libros
    ADD CONSTRAINT libros_pkey PRIMARY KEY (id);


--
-- Name: mapa_contenido mapa_contenido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapa_contenido
    ADD CONSTRAINT mapa_contenido_pkey PRIMARY KEY (libro_id);


--
-- Name: mapa_jugadas mapa_jugadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapa_jugadas
    ADD CONSTRAINT mapa_jugadas_pkey PRIMARY KEY (id);


--
-- Name: mensajitos mensajitos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_pkey PRIMARY KEY (id);


--
-- Name: ovillos_movimientos ovillos_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ovillos_movimientos
    ADD CONSTRAINT ovillos_movimientos_pkey PRIMARY KEY (id);


--
-- Name: parrafos parrafos_capitulo_id_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parrafos
    ADD CONSTRAINT parrafos_capitulo_id_numero_key UNIQUE (capitulo_id, numero);


--
-- Name: parrafos parrafos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parrafos
    ADD CONSTRAINT parrafos_pkey PRIMARY KEY (id);


--
-- Name: perfiles perfiles_genero_valido; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.perfiles
    ADD CONSTRAINT perfiles_genero_valido CHECK (((genero IS NULL) OR (genero = ANY (ARRAY['masculino'::text, 'femenino'::text, 'diverso'::text])))) NOT VALID;


--
-- Name: perfiles perfiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles
    ADD CONSTRAINT perfiles_pkey PRIMARY KEY (id);


--
-- Name: predicciones_usuario predicciones_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predicciones_usuario
    ADD CONSTRAINT predicciones_usuario_pkey PRIMARY KEY (id);


--
-- Name: predicciones_usuario predicciones_usuario_user_id_libro_id_capitulo_num_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predicciones_usuario
    ADD CONSTRAINT predicciones_usuario_user_id_libro_id_capitulo_num_key UNIQUE (user_id, libro_id, capitulo_num);


--
-- Name: preferencias_usuario preferencias_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_pkey PRIMARY KEY (user_id);


--
-- Name: progreso_capitulos_log progreso_capitulos_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_capitulos_log
    ADD CONSTRAINT progreso_capitulos_log_pkey PRIMARY KEY (user_id, libro_id, capitulo);


--
-- Name: progreso_lectura progreso_lectura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_lectura
    ADD CONSTRAINT progreso_lectura_pkey PRIMARY KEY (id);


--
-- Name: progreso_lectura progreso_lectura_user_id_libro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_lectura
    ADD CONSTRAINT progreso_lectura_user_id_libro_id_key UNIQUE (user_id, libro_id);


--
-- Name: recompensas_aportes recompensas_aportes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas_aportes
    ADD CONSTRAINT recompensas_aportes_pkey PRIMARY KEY (id);


--
-- Name: recompensas_canjes recompensas_canjes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas_canjes
    ADD CONSTRAINT recompensas_canjes_pkey PRIMARY KEY (id);


--
-- Name: recompensas recompensas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas
    ADD CONSTRAINT recompensas_pkey PRIMARY KEY (id);


--
-- Name: resenas_libros resenas_libros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas_libros
    ADD CONSTRAINT resenas_libros_pkey PRIMARY KEY (id);


--
-- Name: resenas_libros resenas_libros_user_id_libro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas_libros
    ADD CONSTRAINT resenas_libros_user_id_libro_id_key UNIQUE (user_id, libro_id);


--
-- Name: sala_libros sala_libros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_libros
    ADD CONSTRAINT sala_libros_pkey PRIMARY KEY (sala_id, libro_id);


--
-- Name: salas salas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_pkey PRIMARY KEY (id);


--
-- Name: salas salas_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_slug_key UNIQUE (slug);


--
-- Name: sesiones_lectura sesiones_lectura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_lectura
    ADD CONSTRAINT sesiones_lectura_pkey PRIMARY KEY (id);


--
-- Name: subrayados_usuario subrayados_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subrayados_usuario
    ADD CONSTRAINT subrayados_usuario_pkey PRIMARY KEY (id);


--
-- Name: superusuarios superusuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.superusuarios
    ADD CONSTRAINT superusuarios_pkey PRIMARY KEY (user_id);


--
-- Name: chat_historial_user_foro_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_historial_user_foro_partner ON public.chat_historial USING btree (user_id, foro_id, partner_id);


--
-- Name: chat_historial_user_id_foro_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_historial_user_id_foro_id_created_at_idx ON public.chat_historial USING btree (user_id, foro_id, created_at DESC);


--
-- Name: chat_sesiones_libro_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_sesiones_libro_id_idx ON public.chat_sesiones USING btree (libro_id);


--
-- Name: foros_comentarios_foro_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foros_comentarios_foro_id_created_at_idx ON public.foros_comentarios USING btree (foro_id, created_at DESC);


--
-- Name: foros_comentarios_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foros_comentarios_parent_id_idx ON public.foros_comentarios USING btree (parent_id);


--
-- Name: foros_comentarios_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foros_comentarios_tags_idx ON public.foros_comentarios USING gin (tags);


--
-- Name: idx_anderson_jugadas_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anderson_jugadas_user_libro ON public.anderson_jugadas USING btree (user_id, libro_id);


--
-- Name: idx_anotaciones_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anotaciones_user_libro ON public.anotaciones_usuario USING btree (user_id, libro_id);


--
-- Name: idx_aportes_recompensa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aportes_recompensa ON public.recompensas_aportes USING btree (recompensa_id);


--
-- Name: idx_aportes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aportes_user ON public.recompensas_aportes USING btree (user_id, libro_id);


--
-- Name: idx_biblioteca_media_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_biblioteca_media_slug ON public.biblioteca_media USING btree (slug);


--
-- Name: idx_biblioteca_media_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_biblioteca_media_tags ON public.biblioteca_media USING gin (tags);


--
-- Name: idx_bibliotecas_usuarios_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bibliotecas_usuarios_user ON public.bibliotecas_usuarios USING btree (user_id);


--
-- Name: idx_bibliotecas_usuarios_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bibliotecas_usuarios_user_libro ON public.bibliotecas_usuarios USING btree (user_id, libro_id);


--
-- Name: idx_canjes_aula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canjes_aula ON public.recompensas_canjes USING btree (aula_id, estado);


--
-- Name: idx_canjes_recompensa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canjes_recompensa ON public.recompensas_canjes USING btree (recompensa_id, libro_id);


--
-- Name: idx_canjes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canjes_user ON public.recompensas_canjes USING btree (user_id, libro_id);


--
-- Name: idx_capitulos_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capitulos_libro ON public.capitulos USING btree (libro_id, numero);


--
-- Name: idx_cartelera_items_imagen_media; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cartelera_items_imagen_media ON public.cartelera_items USING btree (imagen_media_id);


--
-- Name: idx_cartelera_items_libro_cap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cartelera_items_libro_cap ON public.cartelera_items USING btree (libro_id, capitulo_numero);


--
-- Name: idx_cartelera_items_libro_con_imagen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cartelera_items_libro_con_imagen ON public.cartelera_items USING btree (libro_id) WHERE (imagen_media_id IS NOT NULL);


--
-- Name: idx_cartelera_principal_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cartelera_principal_libro ON public.cartelera_principal USING btree (libro_id);


--
-- Name: idx_cartelera_principal_media; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cartelera_principal_media ON public.cartelera_principal USING btree (imagen_media_id);


--
-- Name: idx_categorias_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categorias_user ON public.categorias_usuario USING btree (user_id, orden);


--
-- Name: idx_categorias_usuario_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categorias_usuario_user ON public.categorias_usuario USING btree (user_id, orden, nombre);


--
-- Name: idx_chat_mensajes_sesion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_mensajes_sesion ON public.chat_mensajes USING btree (sesion_id, created_at);


--
-- Name: idx_chat_sesiones_usuario_a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sesiones_usuario_a ON public.chat_sesiones USING btree (usuario_a, libro_id);


--
-- Name: idx_chat_sesiones_usuario_b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sesiones_usuario_b ON public.chat_sesiones USING btree (usuario_b, libro_id);


--
-- Name: idx_colegio_admins_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colegio_admins_user ON public.colegio_admins USING btree (user_id);


--
-- Name: idx_comentarios_lectura_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comentarios_lectura_libro ON public.comentarios_lectura USING btree (comunidad_id, libro_id, parrafo_id);


--
-- Name: idx_comunidad_lecturas_actual; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_comunidad_lecturas_actual ON public.comunidad_lecturas USING btree (comunidad_id) WHERE (fin IS NULL);


--
-- Name: idx_comunidad_lecturas_historial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comunidad_lecturas_historial ON public.comunidad_lecturas USING btree (comunidad_id, inicio DESC);


--
-- Name: idx_comunidad_miembros_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comunidad_miembros_user ON public.comunidad_miembros USING btree (user_id);


--
-- Name: idx_concurso_llamadas_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concurso_llamadas_fecha ON public.concurso_llamadas USING btree (created_at);


--
-- Name: idx_concurso_llamadas_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concurso_llamadas_user ON public.concurso_llamadas USING btree (user_id, created_at);


--
-- Name: idx_denuncias_denunciado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_denuncias_denunciado ON public.denuncias USING btree (denunciado_id, created_at);


--
-- Name: idx_denuncias_pendientes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_denuncias_pendientes ON public.denuncias USING btree (created_at) WHERE (estado = 'pendiente'::text);


--
-- Name: idx_desafio_llamadas_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_desafio_llamadas_fecha ON public.desafio_llamadas USING btree (created_at);


--
-- Name: idx_desafio_llamadas_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_desafio_llamadas_user ON public.desafio_llamadas USING btree (user_id, created_at);


--
-- Name: idx_elementos_interactivos_parrafo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_elementos_interactivos_parrafo ON public.elementos_interactivos USING btree (parrafo_id);


--
-- Name: idx_expedientes_compras_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expedientes_compras_libro ON public.expedientes_compras USING btree (libro_id, expediente);


--
-- Name: idx_foros_comentarios_comunidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_foros_comentarios_comunidad ON public.foros_comentarios USING btree (comunidad_id, foro_id, created_at DESC) WHERE (comunidad_id IS NOT NULL);


--
-- Name: idx_foros_comentarios_foro_parent_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_foros_comentarios_foro_parent_fecha ON public.foros_comentarios USING btree (foro_id, parent_id, created_at DESC);


--
-- Name: idx_interactivos_media; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactivos_media ON public.elementos_interactivos USING btree (media_id);


--
-- Name: idx_libros_categorias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_libros_categorias ON public.libros USING gin (categorias);


--
-- Name: idx_libros_moods; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_libros_moods ON public.libros USING gin (moods);


--
-- Name: idx_libros_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_libros_slug ON public.libros USING btree (slug);


--
-- Name: idx_libros_visible_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_libros_visible_created ON public.libros USING btree (created_at DESC) WHERE (visible = true);


--
-- Name: idx_mapa_jugadas_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mapa_jugadas_user_libro ON public.mapa_jugadas USING btree (user_id, libro_id);


--
-- Name: idx_mensajitos_de; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensajitos_de ON public.mensajitos USING btree (de_id);


--
-- Name: idx_mensajitos_para_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensajitos_para_libro ON public.mensajitos USING btree (para_id, libro_id);


--
-- Name: idx_ovillos_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ovillos_user_libro ON public.ovillos_movimientos USING btree (user_id, libro_id);


--
-- Name: idx_parrafos_capitulo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parrafos_capitulo ON public.parrafos USING btree (capitulo_id, numero);


--
-- Name: idx_parrafos_escena_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parrafos_escena_tags ON public.parrafos USING gin (escena_tags);


--
-- Name: idx_predicciones_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_predicciones_user_libro ON public.predicciones_usuario USING btree (user_id, libro_id);


--
-- Name: idx_predicciones_user_libro_cap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_predicciones_user_libro_cap ON public.predicciones_usuario USING btree (user_id, libro_id, capitulo_num);


--
-- Name: idx_progreso_lectura_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progreso_lectura_user_libro ON public.progreso_lectura USING btree (user_id, libro_id);


--
-- Name: idx_recompensas_aula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recompensas_aula ON public.recompensas USING btree (aula_id);


--
-- Name: idx_resenas_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resenas_libro ON public.resenas_libros USING btree (libro_id);


--
-- Name: idx_resenas_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resenas_user_libro ON public.resenas_libros USING btree (user_id, libro_id);


--
-- Name: idx_sala_libros_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sala_libros_libro ON public.sala_libros USING btree (libro_id);


--
-- Name: idx_sesiones_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sesiones_user_libro ON public.sesiones_lectura USING btree (user_id, libro_id);


--
-- Name: idx_subrayados_libro_con_parrafo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subrayados_libro_con_parrafo ON public.subrayados_usuario USING btree (libro_id) WHERE (parrafo_id IS NOT NULL);


--
-- Name: idx_subrayados_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subrayados_user_libro ON public.subrayados_usuario USING btree (user_id, libro_id);


--
-- Name: libro_reels_libro_orden_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX libro_reels_libro_orden_idx ON public.libro_reels USING btree (libro_id, orden);


--
-- Name: uq_anderson_jugada_abierta; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_anderson_jugada_abierta ON public.anderson_jugadas USING btree (user_id, libro_id) WHERE (resultado = 'abierta'::text);


--
-- Name: uq_colegio_codigos_profesor; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_colegio_codigos_profesor ON public.colegio_codigos USING btree (comunidad_id) WHERE (tipo = 'profesor'::text);


--
-- Name: uq_comunidades_aula_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_comunidades_aula_nombre ON public.comunidades USING btree (colegio_id, nombre) WHERE (colegio_id IS NOT NULL);


--
-- Name: uq_mapa_jugadas_acierto; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_mapa_jugadas_acierto ON public.mapa_jugadas USING btree (user_id, libro_id, tesoro) WHERE acierto;


--
-- Name: chat_sesiones trg_chat_sesion_unica; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_chat_sesion_unica BEFORE INSERT ON public.chat_sesiones FOR EACH ROW EXECUTE FUNCTION public._check_usuario_sin_sesion_activa();


--
-- Name: colegio_admins trg_colegio_ultimo_admin; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_colegio_ultimo_admin BEFORE DELETE ON public.colegio_admins FOR EACH ROW EXECUTE FUNCTION public._colegio_ultimo_admin();


--
-- Name: comunidades trg_comunidad_al_crear; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comunidad_al_crear AFTER INSERT ON public.comunidades FOR EACH ROW EXECUTE FUNCTION public._comunidad_al_crear();


--
-- Name: comunidades trg_comunidad_cambio_libro; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comunidad_cambio_libro AFTER INSERT OR UPDATE OF libro_id ON public.comunidades FOR EACH ROW EXECUTE FUNCTION public._comunidad_cambio_libro();


--
-- Name: comunidad_miembros trg_comunidad_tope_miembro; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comunidad_tope_miembro BEFORE INSERT ON public.comunidad_miembros FOR EACH ROW EXECUTE FUNCTION public._comunidad_tope_miembro();


--
-- Name: comunidad_miembros trg_comunidad_tras_baja; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comunidad_tras_baja AFTER DELETE ON public.comunidad_miembros FOR EACH ROW EXECUTE FUNCTION public._comunidad_tras_baja();


--
-- Name: denuncias trg_denuncia_copiar_contenido; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_denuncia_copiar_contenido BEFORE INSERT ON public.denuncias FOR EACH ROW EXECUTE FUNCTION public._denuncia_copiar_contenido();


--
-- Name: perfiles trg_fecha_menor_con_aula; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fecha_menor_con_aula BEFORE INSERT OR UPDATE OF fecha_nacimiento ON public.perfiles FOR EACH ROW EXECUTE FUNCTION public._trg_fecha_menor_con_aula();


--
-- Name: perfiles trg_fecha_nacimiento_fija; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fecha_nacimiento_fija BEFORE UPDATE OF fecha_nacimiento ON public.perfiles FOR EACH ROW EXECUTE FUNCTION public._trg_fecha_nacimiento_fija();


--
-- Name: libros trg_foro_nuevo_libro; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_foro_nuevo_libro AFTER INSERT ON public.libros FOR EACH ROW EXECUTE FUNCTION public._crear_foro_para_libro();


--
-- Name: foros_comentarios trg_foro_recortar_tags; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_foro_recortar_tags BEFORE INSERT OR UPDATE ON public.foros_comentarios FOR EACH ROW EXECUTE FUNCTION public.foro_recortar_tags();


--
-- Name: comunidad_lecturas trg_lectura_aula_dar_libro; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lectura_aula_dar_libro AFTER INSERT ON public.comunidad_lecturas FOR EACH ROW EXECUTE FUNCTION public._lectura_aula_dar_libro();


--
-- Name: progreso_lectura trg_log_capitulo_terminado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_capitulo_terminado AFTER UPDATE OF capitulos_completados ON public.progreso_lectura FOR EACH ROW EXECUTE FUNCTION public._log_capitulo_terminado();


--
-- Name: comunidad_miembros trg_menor_no_sale_del_aula; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_menor_no_sale_del_aula BEFORE DELETE ON public.comunidad_miembros FOR EACH ROW EXECUTE FUNCTION public._trg_menor_no_sale_del_aula();


--
-- Name: parrafos trg_parrafos_muestra_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_muestra_del AFTER DELETE ON public.parrafos REFERENCING OLD TABLE AS viejos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_muestra_delete();


--
-- Name: parrafos trg_parrafos_muestra_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_muestra_ins AFTER INSERT ON public.parrafos REFERENCING NEW TABLE AS nuevos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_muestra_insert();


--
-- Name: parrafos trg_parrafos_muestra_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_muestra_upd AFTER UPDATE ON public.parrafos REFERENCING OLD TABLE AS viejos NEW TABLE AS nuevos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_muestra_update();


--
-- Name: parrafos trg_parrafos_palabras_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_palabras_del AFTER DELETE ON public.parrafos REFERENCING OLD TABLE AS viejos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_palabras_delete();


--
-- Name: parrafos trg_parrafos_palabras_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_palabras_ins AFTER INSERT ON public.parrafos REFERENCING NEW TABLE AS nuevos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_palabras_insert();


--
-- Name: parrafos trg_parrafos_palabras_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_palabras_upd AFTER UPDATE ON public.parrafos REFERENCING OLD TABLE AS viejos NEW TABLE AS nuevos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_palabras_update();


--
-- Name: album_barajitas_pegadas album_barajitas_pegadas_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_barajitas_pegadas
    ADD CONSTRAINT album_barajitas_pegadas_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: album_barajitas_pegadas album_barajitas_pegadas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_barajitas_pegadas
    ADD CONSTRAINT album_barajitas_pegadas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: anderson_contenido anderson_contenido_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anderson_contenido
    ADD CONSTRAINT anderson_contenido_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: anderson_jugadas anderson_jugadas_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anderson_jugadas
    ADD CONSTRAINT anderson_jugadas_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: anderson_jugadas anderson_jugadas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anderson_jugadas
    ADD CONSTRAINT anderson_jugadas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: anotaciones_usuario anotaciones_usuario_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anotaciones_usuario
    ADD CONSTRAINT anotaciones_usuario_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: anotaciones_usuario anotaciones_usuario_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anotaciones_usuario
    ADD CONSTRAINT anotaciones_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bibliotecas_usuarios bibliotecas_usuarios_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios
    ADD CONSTRAINT bibliotecas_usuarios_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_usuario(id) ON DELETE SET NULL;


--
-- Name: bibliotecas_usuarios bibliotecas_usuarios_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios
    ADD CONSTRAINT bibliotecas_usuarios_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: bibliotecas_usuarios bibliotecas_usuarios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios
    ADD CONSTRAINT bibliotecas_usuarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: capitulos capitulos_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos
    ADD CONSTRAINT capitulos_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: capsula_contenido capsula_contenido_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capsula_contenido
    ADD CONSTRAINT capsula_contenido_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: capsula_respuestas capsula_respuestas_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capsula_respuestas
    ADD CONSTRAINT capsula_respuestas_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: capsula_respuestas capsula_respuestas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capsula_respuestas
    ADD CONSTRAINT capsula_respuestas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cartelera_items cartelera_items_imagen_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_items
    ADD CONSTRAINT cartelera_items_imagen_media_id_fkey FOREIGN KEY (imagen_media_id) REFERENCES public.biblioteca_media(id) ON DELETE SET NULL;


--
-- Name: cartelera_items cartelera_items_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_items
    ADD CONSTRAINT cartelera_items_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: cartelera_principal cartelera_principal_imagen_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_principal
    ADD CONSTRAINT cartelera_principal_imagen_media_id_fkey FOREIGN KEY (imagen_media_id) REFERENCES public.biblioteca_media(id) ON DELETE SET NULL;


--
-- Name: cartelera_principal cartelera_principal_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_principal
    ADD CONSTRAINT cartelera_principal_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: cartelera_principal cartelera_principal_video_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_principal
    ADD CONSTRAINT cartelera_principal_video_media_id_fkey FOREIGN KEY (video_media_id) REFERENCES public.biblioteca_media(id) ON DELETE SET NULL;


--
-- Name: categorias_usuario categorias_usuario_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_usuario
    ADD CONSTRAINT categorias_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_historial chat_historial_foro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_historial
    ADD CONSTRAINT chat_historial_foro_id_fkey FOREIGN KEY (foro_id) REFERENCES public.foros(id) ON DELETE CASCADE;


--
-- Name: chat_historial chat_historial_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_historial
    ADD CONSTRAINT chat_historial_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_historial chat_historial_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_historial
    ADD CONSTRAINT chat_historial_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_mensajes chat_mensajes_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_mensajes
    ADD CONSTRAINT chat_mensajes_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_mensajes chat_mensajes_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_mensajes
    ADD CONSTRAINT chat_mensajes_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.chat_sesiones(id) ON DELETE CASCADE;


--
-- Name: chat_sesiones chat_sesiones_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sesiones
    ADD CONSTRAINT chat_sesiones_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: chat_sesiones chat_sesiones_usuario_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sesiones
    ADD CONSTRAINT chat_sesiones_usuario_a_fkey FOREIGN KEY (usuario_a) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_sesiones chat_sesiones_usuario_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sesiones
    ADD CONSTRAINT chat_sesiones_usuario_b_fkey FOREIGN KEY (usuario_b) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: colegio_admins colegio_admins_colegio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colegio_admins
    ADD CONSTRAINT colegio_admins_colegio_id_fkey FOREIGN KEY (colegio_id) REFERENCES public.colegios(id) ON DELETE CASCADE;


--
-- Name: colegio_admins colegio_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colegio_admins
    ADD CONSTRAINT colegio_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: colegio_codigos colegio_codigos_colegio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colegio_codigos
    ADD CONSTRAINT colegio_codigos_colegio_id_fkey FOREIGN KEY (colegio_id) REFERENCES public.colegios(id) ON DELETE CASCADE;


--
-- Name: colegio_codigos colegio_codigos_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colegio_codigos
    ADD CONSTRAINT colegio_codigos_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: comentarios_lectura comentarios_lectura_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_lectura
    ADD CONSTRAINT comentarios_lectura_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: comentarios_lectura comentarios_lectura_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_lectura
    ADD CONSTRAINT comentarios_lectura_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: comentarios_lectura comentarios_lectura_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_lectura
    ADD CONSTRAINT comentarios_lectura_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: comentarios_lectura comentarios_lectura_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_lectura
    ADD CONSTRAINT comentarios_lectura_parrafo_id_fkey FOREIGN KEY (parrafo_id) REFERENCES public.parrafos(id) ON DELETE CASCADE;


--
-- Name: comunidad_codigos comunidad_codigos_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_codigos
    ADD CONSTRAINT comunidad_codigos_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: comunidad_lecturas comunidad_lecturas_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_lecturas
    ADD CONSTRAINT comunidad_lecturas_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: comunidad_lecturas comunidad_lecturas_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_lecturas
    ADD CONSTRAINT comunidad_lecturas_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: comunidad_miembros comunidad_miembros_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_miembros
    ADD CONSTRAINT comunidad_miembros_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: comunidad_miembros comunidad_miembros_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_miembros
    ADD CONSTRAINT comunidad_miembros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: comunidades comunidades_colegio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidades
    ADD CONSTRAINT comunidades_colegio_id_fkey FOREIGN KEY (colegio_id) REFERENCES public.colegios(id) ON DELETE CASCADE;


--
-- Name: comunidades comunidades_creador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidades
    ADD CONSTRAINT comunidades_creador_id_fkey FOREIGN KEY (creador_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: comunidades comunidades_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidades
    ADD CONSTRAINT comunidades_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE SET NULL;


--
-- Name: concurso_contenido concurso_contenido_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concurso_contenido
    ADD CONSTRAINT concurso_contenido_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: concurso_jugadas concurso_jugadas_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concurso_jugadas
    ADD CONSTRAINT concurso_jugadas_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: concurso_jugadas concurso_jugadas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concurso_jugadas
    ADD CONSTRAINT concurso_jugadas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: concurso_llamadas concurso_llamadas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concurso_llamadas
    ADD CONSTRAINT concurso_llamadas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: corazonadas_contenido corazonadas_contenido_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corazonadas_contenido
    ADD CONSTRAINT corazonadas_contenido_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: corazonadas_jugadas corazonadas_jugadas_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corazonadas_jugadas
    ADD CONSTRAINT corazonadas_jugadas_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: corazonadas_jugadas corazonadas_jugadas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corazonadas_jugadas
    ADD CONSTRAINT corazonadas_jugadas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: creadores_comunidad creadores_comunidad_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creadores_comunidad
    ADD CONSTRAINT creadores_comunidad_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: denuncias denuncias_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE SET NULL;


--
-- Name: denuncias denuncias_denunciado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_denunciado_id_fkey FOREIGN KEY (denunciado_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: denuncias denuncias_denunciante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_denunciante_id_fkey FOREIGN KEY (denunciante_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: denuncias denuncias_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE SET NULL;


--
-- Name: denuncias denuncias_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_parrafo_id_fkey FOREIGN KEY (parrafo_id) REFERENCES public.parrafos(id) ON DELETE SET NULL;


--
-- Name: desafio_charlas desafio_charlas_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desafio_charlas
    ADD CONSTRAINT desafio_charlas_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: desafio_charlas desafio_charlas_nota_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desafio_charlas
    ADD CONSTRAINT desafio_charlas_nota_por_fkey FOREIGN KEY (nota_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: desafio_charlas desafio_charlas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desafio_charlas
    ADD CONSTRAINT desafio_charlas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: desafio_contenido desafio_contenido_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desafio_contenido
    ADD CONSTRAINT desafio_contenido_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: desafio_llamadas desafio_llamadas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desafio_llamadas
    ADD CONSTRAINT desafio_llamadas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: elementos_interactivos elementos_interactivos_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elementos_interactivos
    ADD CONSTRAINT elementos_interactivos_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.biblioteca_media(id) ON DELETE CASCADE;


--
-- Name: elementos_interactivos elementos_interactivos_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elementos_interactivos
    ADD CONSTRAINT elementos_interactivos_parrafo_id_fkey FOREIGN KEY (parrafo_id) REFERENCES public.parrafos(id) ON DELETE CASCADE;


--
-- Name: expedientes_compras expedientes_compras_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes_compras
    ADD CONSTRAINT expedientes_compras_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: expedientes_compras expedientes_compras_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes_compras
    ADD CONSTRAINT expedientes_compras_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: expedientes_contenido expedientes_contenido_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes_contenido
    ADD CONSTRAINT expedientes_contenido_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: falsificador_contenido falsificador_contenido_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falsificador_contenido
    ADD CONSTRAINT falsificador_contenido_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: falsificador_jugadas falsificador_jugadas_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falsificador_jugadas
    ADD CONSTRAINT falsificador_jugadas_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: falsificador_jugadas falsificador_jugadas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falsificador_jugadas
    ADD CONSTRAINT falsificador_jugadas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: parrafos fk_parrafo_capitulo_libro; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parrafos
    ADD CONSTRAINT fk_parrafo_capitulo_libro FOREIGN KEY (capitulo_id, libro_id) REFERENCES public.capitulos(id, libro_id) ON DELETE CASCADE;


--
-- Name: foros_comentarios foros_comentarios_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros_comentarios
    ADD CONSTRAINT foros_comentarios_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: foros_comentarios foros_comentarios_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros_comentarios
    ADD CONSTRAINT foros_comentarios_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: foros_comentarios foros_comentarios_foro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros_comentarios
    ADD CONSTRAINT foros_comentarios_foro_id_fkey FOREIGN KEY (foro_id) REFERENCES public.foros(id) ON DELETE CASCADE;


--
-- Name: foros_comentarios foros_comentarios_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros_comentarios
    ADD CONSTRAINT foros_comentarios_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.foros_comentarios(id) ON DELETE CASCADE;


--
-- Name: foros foros_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros
    ADD CONSTRAINT foros_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: libro_reels libro_reels_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libro_reels
    ADD CONSTRAINT libro_reels_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: mapa_contenido mapa_contenido_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapa_contenido
    ADD CONSTRAINT mapa_contenido_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: mapa_jugadas mapa_jugadas_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapa_jugadas
    ADD CONSTRAINT mapa_jugadas_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: mapa_jugadas mapa_jugadas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapa_jugadas
    ADD CONSTRAINT mapa_jugadas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mensajitos mensajitos_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: mensajitos mensajitos_de_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_de_id_fkey FOREIGN KEY (de_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mensajitos mensajitos_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: mensajitos mensajitos_para_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_para_id_fkey FOREIGN KEY (para_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mensajitos mensajitos_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_parrafo_id_fkey FOREIGN KEY (parrafo_id) REFERENCES public.parrafos(id) ON DELETE CASCADE;


--
-- Name: ovillos_movimientos ovillos_movimientos_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ovillos_movimientos
    ADD CONSTRAINT ovillos_movimientos_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: ovillos_movimientos ovillos_movimientos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ovillos_movimientos
    ADD CONSTRAINT ovillos_movimientos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: parrafos parrafos_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parrafos
    ADD CONSTRAINT parrafos_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: perfiles perfiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles
    ADD CONSTRAINT perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: predicciones_usuario predicciones_usuario_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predicciones_usuario
    ADD CONSTRAINT predicciones_usuario_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: predicciones_usuario predicciones_usuario_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predicciones_usuario
    ADD CONSTRAINT predicciones_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: preferencias_usuario preferencias_usuario_comunidad_activa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_comunidad_activa_fkey FOREIGN KEY (comunidad_activa) REFERENCES public.comunidades(id) ON DELETE SET NULL;


--
-- Name: preferencias_usuario preferencias_usuario_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: progreso_capitulos_log progreso_capitulos_log_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_capitulos_log
    ADD CONSTRAINT progreso_capitulos_log_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: progreso_capitulos_log progreso_capitulos_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_capitulos_log
    ADD CONSTRAINT progreso_capitulos_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: progreso_lectura progreso_lectura_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_lectura
    ADD CONSTRAINT progreso_lectura_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: progreso_lectura progreso_lectura_ultimo_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_lectura
    ADD CONSTRAINT progreso_lectura_ultimo_parrafo_id_fkey FOREIGN KEY (ultimo_parrafo_id) REFERENCES public.parrafos(id);


--
-- Name: progreso_lectura progreso_lectura_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_lectura
    ADD CONSTRAINT progreso_lectura_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recompensas_aportes recompensas_aportes_aula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas_aportes
    ADD CONSTRAINT recompensas_aportes_aula_id_fkey FOREIGN KEY (aula_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: recompensas_aportes recompensas_aportes_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas_aportes
    ADD CONSTRAINT recompensas_aportes_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: recompensas_aportes recompensas_aportes_recompensa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas_aportes
    ADD CONSTRAINT recompensas_aportes_recompensa_id_fkey FOREIGN KEY (recompensa_id) REFERENCES public.recompensas(id) ON DELETE CASCADE;


--
-- Name: recompensas_aportes recompensas_aportes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas_aportes
    ADD CONSTRAINT recompensas_aportes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recompensas recompensas_aula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas
    ADD CONSTRAINT recompensas_aula_id_fkey FOREIGN KEY (aula_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: recompensas_canjes recompensas_canjes_aula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas_canjes
    ADD CONSTRAINT recompensas_canjes_aula_id_fkey FOREIGN KEY (aula_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: recompensas_canjes recompensas_canjes_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas_canjes
    ADD CONSTRAINT recompensas_canjes_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: recompensas_canjes recompensas_canjes_recompensa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas_canjes
    ADD CONSTRAINT recompensas_canjes_recompensa_id_fkey FOREIGN KEY (recompensa_id) REFERENCES public.recompensas(id) ON DELETE CASCADE;


--
-- Name: recompensas_canjes recompensas_canjes_resuelto_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas_canjes
    ADD CONSTRAINT recompensas_canjes_resuelto_por_fkey FOREIGN KEY (resuelto_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: recompensas_canjes recompensas_canjes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas_canjes
    ADD CONSTRAINT recompensas_canjes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recompensas recompensas_creada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recompensas
    ADD CONSTRAINT recompensas_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: resenas_libros resenas_libros_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas_libros
    ADD CONSTRAINT resenas_libros_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: resenas_libros resenas_libros_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas_libros
    ADD CONSTRAINT resenas_libros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sala_libros sala_libros_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_libros
    ADD CONSTRAINT sala_libros_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: sala_libros sala_libros_sala_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_libros
    ADD CONSTRAINT sala_libros_sala_id_fkey FOREIGN KEY (sala_id) REFERENCES public.salas(id) ON DELETE CASCADE;


--
-- Name: sesiones_lectura sesiones_lectura_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_lectura
    ADD CONSTRAINT sesiones_lectura_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: sesiones_lectura sesiones_lectura_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_lectura
    ADD CONSTRAINT sesiones_lectura_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subrayados_usuario subrayados_usuario_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subrayados_usuario
    ADD CONSTRAINT subrayados_usuario_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: subrayados_usuario subrayados_usuario_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subrayados_usuario
    ADD CONSTRAINT subrayados_usuario_parrafo_id_fkey FOREIGN KEY (parrafo_id) REFERENCES public.parrafos(id) ON DELETE SET NULL;


--
-- Name: subrayados_usuario subrayados_usuario_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subrayados_usuario
    ADD CONSTRAINT subrayados_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: superusuarios superusuarios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.superusuarios
    ADD CONSTRAINT superusuarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: perfiles Perfiles visibles por dueño; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Perfiles visibles por dueño" ON public.perfiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: libro_reels Reels visibles para todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reels visibles para todos" ON public.libro_reels FOR SELECT USING (true);


--
-- Name: libro_reels Solo admin puede modificar reels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo admin puede modificar reels" ON public.libro_reels USING ((auth.role() = 'service_role'::text));


--
-- Name: bibliotecas_usuarios Usuarios actualizan su propia biblioteca; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios actualizan su propia biblioteca" ON public.bibliotecas_usuarios FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: bibliotecas_usuarios Usuarios ven su propia biblioteca; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios ven su propia biblioteca" ON public.bibliotecas_usuarios FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: album_barajitas_pegadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.album_barajitas_pegadas ENABLE ROW LEVEL SECURITY;

--
-- Name: album_barajitas_pegadas album_pegadas_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY album_pegadas_insert ON public.album_barajitas_pegadas FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: album_barajitas_pegadas album_pegadas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY album_pegadas_select ON public.album_barajitas_pegadas FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: anderson_contenido; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anderson_contenido ENABLE ROW LEVEL SECURITY;

--
-- Name: anderson_jugadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anderson_jugadas ENABLE ROW LEVEL SECURITY;

--
-- Name: anotaciones_usuario anotaciones_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anotaciones_delete ON public.anotaciones_usuario FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: anotaciones_usuario anotaciones_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anotaciones_insert ON public.anotaciones_usuario FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: anotaciones_usuario anotaciones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anotaciones_select ON public.anotaciones_usuario FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: anotaciones_usuario anotaciones_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anotaciones_update ON public.anotaciones_usuario FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: anotaciones_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anotaciones_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: biblioteca_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.biblioteca_media ENABLE ROW LEVEL SECURITY;

--
-- Name: biblioteca_media biblioteca_media_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY biblioteca_media_select ON public.biblioteca_media FOR SELECT TO authenticated USING (true);


--
-- Name: bibliotecas_usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bibliotecas_usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: capitulos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capitulos ENABLE ROW LEVEL SECURITY;

--
-- Name: capitulos capitulos_guest_preview; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capitulos_guest_preview ON public.capitulos FOR SELECT TO anon USING (en_muestra);


--
-- Name: capitulos capitulos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capitulos_select ON public.capitulos FOR SELECT TO authenticated USING ((en_muestra OR (EXISTS ( SELECT 1
   FROM public.bibliotecas_usuarios bu
  WHERE ((bu.user_id = ( SELECT auth.uid() AS uid)) AND (bu.libro_id = capitulos.libro_id)))) OR (EXISTS ( SELECT 1
   FROM public.superusuarios s
  WHERE (s.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: capsula_contenido; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capsula_contenido ENABLE ROW LEVEL SECURITY;

--
-- Name: capsula_respuestas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capsula_respuestas ENABLE ROW LEVEL SECURITY;

--
-- Name: cartelera_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cartelera_items ENABLE ROW LEVEL SECURITY;

--
-- Name: cartelera_principal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cartelera_principal ENABLE ROW LEVEL SECURITY;

--
-- Name: cartelera_principal cartelera_principal_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cartelera_principal_select ON public.cartelera_principal FOR SELECT TO authenticated USING (true);


--
-- Name: cartelera_items cartelera_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cartelera_select ON public.cartelera_items FOR SELECT TO authenticated USING (true);


--
-- Name: categorias_usuario categorias_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categorias_delete ON public.categorias_usuario FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: categorias_usuario categorias_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categorias_insert ON public.categorias_usuario FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: categorias_usuario categorias_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categorias_select ON public.categorias_usuario FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: categorias_usuario categorias_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categorias_update ON public.categorias_usuario FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: categorias_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categorias_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_historial; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_historial ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_historial chat_historial_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_historial_insert ON public.chat_historial FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: chat_historial chat_historial_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_historial_select ON public.chat_historial FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: chat_historial chat_historial_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_historial_update ON public.chat_historial FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: chat_mensajes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_mensajes ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_mensajes chat_mensajes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_mensajes_insert ON public.chat_mensajes FOR INSERT TO authenticated WITH CHECK (((autor_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.chat_sesiones s
  WHERE ((s.id = chat_mensajes.sesion_id) AND ((s.usuario_a = auth.uid()) OR (s.usuario_b = auth.uid())))))));


--
-- Name: chat_mensajes chat_mensajes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_mensajes_select ON public.chat_mensajes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.chat_sesiones s
  WHERE ((s.id = chat_mensajes.sesion_id) AND ((s.usuario_a = auth.uid()) OR (s.usuario_b = auth.uid()))))));


--
-- Name: chat_sesiones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_sesiones ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sesiones chat_sesiones_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_sesiones_delete ON public.chat_sesiones FOR DELETE TO authenticated USING (((usuario_a = auth.uid()) OR (usuario_b = auth.uid())));


--
-- Name: chat_sesiones chat_sesiones_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_sesiones_insert ON public.chat_sesiones FOR INSERT TO authenticated WITH CHECK ((usuario_a = auth.uid()));


--
-- Name: chat_sesiones chat_sesiones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_sesiones_select ON public.chat_sesiones FOR SELECT TO authenticated USING (((usuario_a = auth.uid()) OR (usuario_b = auth.uid())));


--
-- Name: colegio_admins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colegio_admins ENABLE ROW LEVEL SECURITY;

--
-- Name: colegio_admins colegio_admins_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colegio_admins_delete ON public.colegio_admins FOR DELETE TO authenticated USING ((public.es_admin_colegio(colegio_id) OR public.es_superusuario()));


--
-- Name: colegio_admins colegio_admins_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colegio_admins_select ON public.colegio_admins FOR SELECT TO authenticated USING ((public.es_admin_colegio(colegio_id) OR public.es_superusuario()));


--
-- Name: colegio_codigos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colegio_codigos ENABLE ROW LEVEL SECURITY;

--
-- Name: colegios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colegios ENABLE ROW LEVEL SECURITY;

--
-- Name: colegios colegios_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colegios_select ON public.colegios FOR SELECT TO authenticated USING ((public.es_admin_colegio(id) OR public.es_profesor_colegio(id) OR public.es_superusuario()));


--
-- Name: comentarios_lectura; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comentarios_lectura ENABLE ROW LEVEL SECURITY;

--
-- Name: comentarios_lectura comentarios_lectura_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comentarios_lectura_delete ON public.comentarios_lectura FOR DELETE TO authenticated USING (((autor_id = ( SELECT auth.uid() AS uid)) OR public.es_moderador(comunidad_id) OR public.es_superusuario()));


--
-- Name: comentarios_lectura comentarios_lectura_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comentarios_lectura_insert ON public.comentarios_lectura FOR INSERT TO authenticated WITH CHECK (((autor_id = ( SELECT auth.uid() AS uid)) AND public.es_miembro(comunidad_id) AND (EXISTS ( SELECT 1
   FROM public.parrafos p
  WHERE ((p.id = comentarios_lectura.parrafo_id) AND (p.libro_id = comentarios_lectura.libro_id))))));


--
-- Name: comentarios_lectura comentarios_lectura_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comentarios_lectura_select ON public.comentarios_lectura FOR SELECT TO authenticated USING ((public.es_miembro(comunidad_id) OR public.es_superusuario()));


--
-- Name: comunidad_codigos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comunidad_codigos ENABLE ROW LEVEL SECURITY;

--
-- Name: comunidad_codigos comunidad_codigos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_codigos_select ON public.comunidad_codigos FOR SELECT TO authenticated USING (public.es_moderador(comunidad_id));


--
-- Name: comunidad_lecturas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comunidad_lecturas ENABLE ROW LEVEL SECURITY;

--
-- Name: comunidad_lecturas comunidad_lecturas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_lecturas_select ON public.comunidad_lecturas FOR SELECT TO authenticated USING ((public.es_miembro(comunidad_id) OR public.es_superusuario()));


--
-- Name: comunidad_lecturas comunidad_lecturas_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_lecturas_update ON public.comunidad_lecturas FOR UPDATE TO authenticated USING (public.es_moderador(comunidad_id)) WITH CHECK (public.es_moderador(comunidad_id));


--
-- Name: comunidad_miembros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comunidad_miembros ENABLE ROW LEVEL SECURITY;

--
-- Name: comunidad_miembros comunidad_miembros_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_miembros_delete ON public.comunidad_miembros FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.es_moderador(comunidad_id) OR public.es_admin_de_aula(comunidad_id) OR public.es_superusuario()));


--
-- Name: comunidad_miembros comunidad_miembros_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_miembros_insert ON public.comunidad_miembros FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (rol = 'miembro'::text) AND (EXISTS ( SELECT 1
   FROM public.comunidades c
  WHERE ((c.id = comunidad_miembros.comunidad_id) AND (NOT c.privada))))));


--
-- Name: comunidad_miembros comunidad_miembros_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_miembros_select ON public.comunidad_miembros FOR SELECT TO authenticated USING ((public.es_miembro(comunidad_id) OR public.es_admin_de_aula(comunidad_id) OR public.es_superusuario()));


--
-- Name: comunidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comunidades ENABLE ROW LEVEL SECURITY;

--
-- Name: comunidades comunidades_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_delete ON public.comunidades FOR DELETE TO authenticated USING ((((colegio_id IS NULL) AND public.es_moderador(id)) OR public.es_admin_colegio(colegio_id) OR public.es_superusuario()));


--
-- Name: comunidades comunidades_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_insert ON public.comunidades FOR INSERT TO authenticated WITH CHECK (((creador_id = ( SELECT auth.uid() AS uid)) AND (colegio_id IS NULL) AND (EXISTS ( SELECT 1
   FROM public.creadores_comunidad cc
  WHERE (cc.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: comunidades comunidades_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_select ON public.comunidades FOR SELECT TO authenticated USING (((NOT privada) OR public.es_miembro(id) OR public.es_admin_colegio(colegio_id) OR public.es_superusuario()));


--
-- Name: comunidades comunidades_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_update ON public.comunidades FOR UPDATE TO authenticated USING (public.es_moderador(id)) WITH CHECK (public.es_moderador(id));


--
-- Name: concurso_contenido; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concurso_contenido ENABLE ROW LEVEL SECURITY;

--
-- Name: concurso_jugadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concurso_jugadas ENABLE ROW LEVEL SECURITY;

--
-- Name: concurso_llamadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concurso_llamadas ENABLE ROW LEVEL SECURITY;

--
-- Name: corazonadas_contenido; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.corazonadas_contenido ENABLE ROW LEVEL SECURITY;

--
-- Name: corazonadas_jugadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.corazonadas_jugadas ENABLE ROW LEVEL SECURITY;

--
-- Name: creadores_comunidad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.creadores_comunidad ENABLE ROW LEVEL SECURITY;

--
-- Name: creadores_comunidad creadores_comunidad_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY creadores_comunidad_select_own ON public.creadores_comunidad FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: denuncias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;

--
-- Name: denuncias denuncias_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY denuncias_insert ON public.denuncias FOR INSERT TO authenticated WITH CHECK ((denunciante_id = ( SELECT auth.uid() AS uid)));


--
-- Name: denuncias denuncias_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY denuncias_select ON public.denuncias FOR SELECT TO authenticated USING (((denunciante_id = ( SELECT auth.uid() AS uid)) OR public.es_superusuario()));


--
-- Name: denuncias denuncias_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY denuncias_update ON public.denuncias FOR UPDATE TO authenticated USING (public.es_superusuario()) WITH CHECK (public.es_superusuario());


--
-- Name: desafio_charlas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.desafio_charlas ENABLE ROW LEVEL SECURITY;

--
-- Name: desafio_contenido; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.desafio_contenido ENABLE ROW LEVEL SECURITY;

--
-- Name: desafio_llamadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.desafio_llamadas ENABLE ROW LEVEL SECURITY;

--
-- Name: elementos_interactivos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.elementos_interactivos ENABLE ROW LEVEL SECURITY;

--
-- Name: expedientes_compras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expedientes_compras ENABLE ROW LEVEL SECURITY;

--
-- Name: expedientes_compras expedientes_compras_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY expedientes_compras_select_own ON public.expedientes_compras FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: expedientes_contenido; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expedientes_contenido ENABLE ROW LEVEL SECURITY;

--
-- Name: falsificador_contenido; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.falsificador_contenido ENABLE ROW LEVEL SECURITY;

--
-- Name: falsificador_jugadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.falsificador_jugadas ENABLE ROW LEVEL SECURITY;

--
-- Name: foros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foros ENABLE ROW LEVEL SECURITY;

--
-- Name: foros_comentarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foros_comentarios ENABLE ROW LEVEL SECURITY;

--
-- Name: foros_comentarios foros_comentarios_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY foros_comentarios_delete ON public.foros_comentarios FOR DELETE TO authenticated USING ((autor_id = auth.uid()));


--
-- Name: foros_comentarios foros_comentarios_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY foros_comentarios_insert ON public.foros_comentarios FOR INSERT TO authenticated WITH CHECK (((autor_id = ( SELECT auth.uid() AS uid)) AND ((comunidad_id IS NULL) OR public.es_miembro(comunidad_id)) AND ((parent_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.foros_comentarios padre
  WHERE ((padre.id = foros_comentarios.parent_id) AND (NOT (padre.comunidad_id IS DISTINCT FROM foros_comentarios.comunidad_id))))))));


--
-- Name: foros_comentarios foros_comentarios_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY foros_comentarios_select ON public.foros_comentarios FOR SELECT TO authenticated USING (((comunidad_id IS NULL) OR public.es_miembro(comunidad_id) OR public.es_superusuario()));


--
-- Name: foros foros_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY foros_select ON public.foros FOR SELECT TO authenticated USING (true);


--
-- Name: elementos_interactivos interactivos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interactivos_select ON public.elementos_interactivos FOR SELECT TO authenticated USING (true);


--
-- Name: libro_reels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.libro_reels ENABLE ROW LEVEL SECURITY;

--
-- Name: libros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.libros ENABLE ROW LEVEL SECURITY;

--
-- Name: libros libros_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY libros_public_read ON public.libros FOR SELECT TO anon USING (true);


--
-- Name: libros libros_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY libros_select ON public.libros FOR SELECT TO authenticated USING (true);


--
-- Name: mapa_contenido; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mapa_contenido ENABLE ROW LEVEL SECURITY;

--
-- Name: mapa_jugadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mapa_jugadas ENABLE ROW LEVEL SECURITY;

--
-- Name: mensajitos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mensajitos ENABLE ROW LEVEL SECURITY;

--
-- Name: mensajitos mensajitos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajitos_delete ON public.mensajitos FOR DELETE TO authenticated USING (((para_id = ( SELECT auth.uid() AS uid)) OR public.es_superusuario()));


--
-- Name: mensajitos mensajitos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajitos_insert ON public.mensajitos FOR INSERT TO authenticated WITH CHECK (((de_id = ( SELECT auth.uid() AS uid)) AND public.es_miembro(comunidad_id) AND (EXISTS ( SELECT 1
   FROM public.comunidad_miembros m
  WHERE ((m.comunidad_id = mensajitos.comunidad_id) AND (m.user_id = mensajitos.para_id)))) AND public.edad_permite_contacto(de_id) AND public.edad_permite_contacto(para_id) AND (EXISTS ( SELECT 1
   FROM public.parrafos p
  WHERE ((p.id = mensajitos.parrafo_id) AND (p.libro_id = mensajitos.libro_id))))));


--
-- Name: mensajitos mensajitos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajitos_select ON public.mensajitos FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = de_id) OR (( SELECT auth.uid() AS uid) = para_id)));


--
-- Name: mensajitos mensajitos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajitos_update ON public.mensajitos FOR UPDATE TO authenticated USING ((para_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((para_id = ( SELECT auth.uid() AS uid)));


--
-- Name: foros_comentarios moderador_comentarios_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY moderador_comentarios_delete ON public.foros_comentarios FOR DELETE TO authenticated USING (((comunidad_id IS NOT NULL) AND public.es_moderador(comunidad_id)));


--
-- Name: ovillos_movimientos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ovillos_movimientos ENABLE ROW LEVEL SECURITY;

--
-- Name: ovillos_movimientos ovillos_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ovillos_select_own ON public.ovillos_movimientos FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: parrafos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parrafos ENABLE ROW LEVEL SECURITY;

--
-- Name: parrafos parrafos_guest_preview; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parrafos_guest_preview ON public.parrafos FOR SELECT TO anon USING (en_muestra);


--
-- Name: parrafos parrafos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parrafos_select ON public.parrafos FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.bibliotecas_usuarios bu
  WHERE ((bu.user_id = ( SELECT auth.uid() AS uid)) AND (bu.libro_id = parrafos.libro_id)))) OR (EXISTS ( SELECT 1
   FROM public.superusuarios s
  WHERE (s.user_id = ( SELECT auth.uid() AS uid)))) OR en_muestra));


--
-- Name: perfiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

--
-- Name: perfiles perfiles_insert_propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perfiles_insert_propio ON public.perfiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: perfiles perfiles_update_propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perfiles_update_propio ON public.perfiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: predicciones_usuario predicciones_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY predicciones_delete ON public.predicciones_usuario FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: predicciones_usuario predicciones_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY predicciones_insert ON public.predicciones_usuario FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: predicciones_usuario predicciones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY predicciones_select ON public.predicciones_usuario FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: predicciones_usuario predicciones_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY predicciones_update ON public.predicciones_usuario FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: predicciones_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.predicciones_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: preferencias_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preferencias_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: preferencias_usuario prefs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prefs_insert ON public.preferencias_usuario FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: preferencias_usuario prefs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prefs_select ON public.preferencias_usuario FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: preferencias_usuario prefs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prefs_update ON public.preferencias_usuario FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: progreso_capitulos_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.progreso_capitulos_log ENABLE ROW LEVEL SECURITY;

--
-- Name: progreso_capitulos_log progreso_capitulos_log_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progreso_capitulos_log_select_own ON public.progreso_capitulos_log FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: progreso_lectura progreso_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progreso_insert ON public.progreso_lectura FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: progreso_lectura; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.progreso_lectura ENABLE ROW LEVEL SECURITY;

--
-- Name: progreso_lectura progreso_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progreso_select ON public.progreso_lectura FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: progreso_lectura progreso_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progreso_update ON public.progreso_lectura FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: recompensas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recompensas ENABLE ROW LEVEL SECURITY;

--
-- Name: recompensas_aportes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recompensas_aportes ENABLE ROW LEVEL SECURITY;

--
-- Name: recompensas_aportes recompensas_aportes_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recompensas_aportes_select_own ON public.recompensas_aportes FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: recompensas_canjes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recompensas_canjes ENABLE ROW LEVEL SECURITY;

--
-- Name: recompensas_canjes recompensas_canjes_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recompensas_canjes_select_own ON public.recompensas_canjes FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: resenas_libros resenas_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resenas_delete ON public.resenas_libros FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: resenas_libros resenas_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resenas_insert ON public.resenas_libros FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: resenas_libros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resenas_libros ENABLE ROW LEVEL SECURITY;

--
-- Name: resenas_libros resenas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resenas_select ON public.resenas_libros FOR SELECT TO authenticated USING (true);


--
-- Name: resenas_libros resenas_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resenas_update ON public.resenas_libros FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: sala_libros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sala_libros ENABLE ROW LEVEL SECURITY;

--
-- Name: sala_libros sala_libros_select_visibles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sala_libros_select_visibles ON public.sala_libros FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.salas s
  WHERE ((s.id = sala_libros.sala_id) AND s.visible))));


--
-- Name: sala_libros sala_libros_superusuario; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sala_libros_superusuario ON public.sala_libros TO authenticated USING (public.es_superusuario()) WITH CHECK (public.es_superusuario());


--
-- Name: salas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;

--
-- Name: salas salas_select_visibles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY salas_select_visibles ON public.salas FOR SELECT TO authenticated, anon USING (visible);


--
-- Name: salas salas_superusuario; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY salas_superusuario ON public.salas TO authenticated USING (public.es_superusuario()) WITH CHECK (public.es_superusuario());


--
-- Name: sesiones_lectura sesiones_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sesiones_insert ON public.sesiones_lectura FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: sesiones_lectura; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sesiones_lectura ENABLE ROW LEVEL SECURITY;

--
-- Name: sesiones_lectura sesiones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sesiones_select ON public.sesiones_lectura FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: sesiones_lectura sesiones_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sesiones_update ON public.sesiones_lectura FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: subrayados_usuario subrayados_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subrayados_delete ON public.subrayados_usuario FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: subrayados_usuario subrayados_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subrayados_insert ON public.subrayados_usuario FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: subrayados_usuario subrayados_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subrayados_select ON public.subrayados_usuario FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: subrayados_usuario subrayados_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subrayados_update ON public.subrayados_usuario FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: subrayados_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subrayados_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: foros_comentarios superusuario_comentarios_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuario_comentarios_delete ON public.foros_comentarios FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.superusuarios s
  WHERE (s.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: elementos_interactivos superusuario_ei_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuario_ei_delete ON public.elementos_interactivos FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.superusuarios
  WHERE (superusuarios.user_id = auth.uid()))));


--
-- Name: elementos_interactivos superusuario_ei_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuario_ei_insert ON public.elementos_interactivos FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.superusuarios
  WHERE (superusuarios.user_id = auth.uid()))));


--
-- Name: biblioteca_media superusuario_media_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuario_media_update ON public.biblioteca_media FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.superusuarios
  WHERE (superusuarios.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.superusuarios
  WHERE (superusuarios.user_id = auth.uid()))));


--
-- Name: parrafos superusuario_parrafos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuario_parrafos_delete ON public.parrafos FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.superusuarios
  WHERE (superusuarios.user_id = auth.uid()))));


--
-- Name: superusuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.superusuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: superusuarios superusuarios_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuarios_select_own ON public.superusuarios FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION _alta_en_aula(p_user uuid, p_codigo text, p_nombre text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._alta_en_aula(p_user uuid, p_codigo text, p_nombre text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._alta_en_aula(p_user uuid, p_codigo text, p_nombre text) TO service_role;


--
-- Name: FUNCTION _alumnos_aula(p_aula uuid, p_zona text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._alumnos_aula(p_aula uuid, p_zona text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._alumnos_aula(p_aula uuid, p_zona text) TO service_role;


--
-- Name: FUNCTION _anderson_estado(p_user uuid, p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._anderson_estado(p_user uuid, p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._anderson_estado(p_user uuid, p_libro uuid) TO service_role;


--
-- Name: FUNCTION _asignar_manual(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._asignar_manual(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._asignar_manual(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION _aulas_de_alumno(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._aulas_de_alumno(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._aulas_de_alumno(p_user uuid) TO service_role;


--
-- Name: FUNCTION _bote_juntado(p_rec uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._bote_juntado(p_rec uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._bote_juntado(p_rec uuid) TO service_role;


--
-- Name: FUNCTION _capsula_estado(p_user uuid, p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._capsula_estado(p_user uuid, p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._capsula_estado(p_user uuid, p_libro uuid) TO service_role;


--
-- Name: FUNCTION _capsula_limpiar(p_respuestas text[], p_n integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._capsula_limpiar(p_respuestas text[], p_n integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public._capsula_limpiar(p_respuestas text[], p_n integer) TO service_role;


--
-- Name: TABLE desafio_charlas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.desafio_charlas TO anon;
GRANT ALL ON TABLE public.desafio_charlas TO authenticated;
GRANT ALL ON TABLE public.desafio_charlas TO service_role;


--
-- Name: FUNCTION _charla_de_alumno(p_aula uuid, p_user uuid, p_momento text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._charla_de_alumno(p_aula uuid, p_user uuid, p_momento text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._charla_de_alumno(p_aula uuid, p_user uuid, p_momento text) TO service_role;


--
-- Name: FUNCTION _check_usuario_sin_sesion_activa(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._check_usuario_sin_sesion_activa() TO anon;
GRANT ALL ON FUNCTION public._check_usuario_sin_sesion_activa() TO authenticated;
GRANT ALL ON FUNCTION public._check_usuario_sin_sesion_activa() TO service_role;


--
-- Name: FUNCTION _codigo_colegio(prefijo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._codigo_colegio(prefijo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._codigo_colegio(prefijo text) TO service_role;


--
-- Name: FUNCTION _colegio_ultimo_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._colegio_ultimo_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public._colegio_ultimo_admin() TO service_role;


--
-- Name: FUNCTION _comunidad_al_crear(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._comunidad_al_crear() FROM PUBLIC;
GRANT ALL ON FUNCTION public._comunidad_al_crear() TO service_role;


--
-- Name: FUNCTION _comunidad_cambio_libro(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._comunidad_cambio_libro() FROM PUBLIC;
GRANT ALL ON FUNCTION public._comunidad_cambio_libro() TO service_role;


--
-- Name: FUNCTION _comunidad_poner_codigo(p_comunidad uuid, p_codigo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._comunidad_poner_codigo(p_comunidad uuid, p_codigo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._comunidad_poner_codigo(p_comunidad uuid, p_codigo text) TO authenticated;
GRANT ALL ON FUNCTION public._comunidad_poner_codigo(p_comunidad uuid, p_codigo text) TO service_role;


--
-- Name: FUNCTION _comunidad_tope_miembro(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._comunidad_tope_miembro() FROM PUBLIC;
GRANT ALL ON FUNCTION public._comunidad_tope_miembro() TO service_role;


--
-- Name: FUNCTION _comunidad_tras_baja(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._comunidad_tras_baja() FROM PUBLIC;
GRANT ALL ON FUNCTION public._comunidad_tras_baja() TO service_role;


--
-- Name: FUNCTION _concurso_estado(p_user uuid, p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._concurso_estado(p_user uuid, p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._concurso_estado(p_user uuid, p_libro uuid) TO service_role;


--
-- Name: FUNCTION _concurso_frase(p_user uuid, p_libro uuid, p_frase text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._concurso_frase(p_user uuid, p_libro uuid, p_frase text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._concurso_frase(p_user uuid, p_libro uuid, p_frase text) TO service_role;


--
-- Name: FUNCTION _concurso_frases(p_user uuid, p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._concurso_frases(p_user uuid, p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._concurso_frases(p_user uuid, p_libro uuid) TO service_role;


--
-- Name: FUNCTION _corazonadas_estado(p_user uuid, p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._corazonadas_estado(p_user uuid, p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._corazonadas_estado(p_user uuid, p_libro uuid) TO service_role;


--
-- Name: FUNCTION _crear_foro_para_libro(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._crear_foro_para_libro() FROM PUBLIC;
GRANT ALL ON FUNCTION public._crear_foro_para_libro() TO service_role;


--
-- Name: FUNCTION _crear_perfil(p_user_id uuid, p_meta jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._crear_perfil(p_user_id uuid, p_meta jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public._crear_perfil(p_user_id uuid, p_meta jsonb) TO service_role;


--
-- Name: FUNCTION _dar_libro_aula(p_aula uuid, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._dar_libro_aula(p_aula uuid, p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._dar_libro_aula(p_aula uuid, p_user uuid) TO service_role;


--
-- Name: FUNCTION _denuncia_copiar_contenido(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._denuncia_copiar_contenido() FROM PUBLIC;
GRANT ALL ON FUNCTION public._denuncia_copiar_contenido() TO service_role;


--
-- Name: FUNCTION _desafio_estado(p_user uuid, p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._desafio_estado(p_user uuid, p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._desafio_estado(p_user uuid, p_libro uuid) TO service_role;


--
-- Name: FUNCTION _desafio_pregunta(p_user uuid, p_libro uuid, p_momento text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._desafio_pregunta(p_user uuid, p_libro uuid, p_momento text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._desafio_pregunta(p_user uuid, p_libro uuid, p_momento text) TO service_role;


--
-- Name: FUNCTION _desafio_turnos_alumno(p_turnos jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._desafio_turnos_alumno(p_turnos jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public._desafio_turnos_alumno(p_turnos jsonb) TO service_role;


--
-- Name: FUNCTION _edad(p_fecha date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._edad(p_fecha date) TO anon;
GRANT ALL ON FUNCTION public._edad(p_fecha date) TO authenticated;
GRANT ALL ON FUNCTION public._edad(p_fecha date) TO service_role;


--
-- Name: FUNCTION _falsificador_estado(p_user uuid, p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._falsificador_estado(p_user uuid, p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._falsificador_estado(p_user uuid, p_libro uuid) TO service_role;


--
-- Name: FUNCTION _juegos_aula_por_defecto(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._juegos_aula_por_defecto() FROM PUBLIC;
GRANT ALL ON FUNCTION public._juegos_aula_por_defecto() TO service_role;


--
-- Name: FUNCTION _juegos_mezclar(p_base jsonb, p_elegido jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._juegos_mezclar(p_base jsonb, p_elegido jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public._juegos_mezclar(p_base jsonb, p_elegido jsonb) TO service_role;


--
-- Name: FUNCTION _juegos_por_defecto(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._juegos_por_defecto() FROM PUBLIC;
GRANT ALL ON FUNCTION public._juegos_por_defecto() TO service_role;


--
-- Name: FUNCTION _lectura_aula_dar_libro(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._lectura_aula_dar_libro() FROM PUBLIC;
GRANT ALL ON FUNCTION public._lectura_aula_dar_libro() TO service_role;


--
-- Name: FUNCTION _llego_al_capitulo(p_user uuid, p_libro uuid, p_cap integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._llego_al_capitulo(p_user uuid, p_libro uuid, p_cap integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public._llego_al_capitulo(p_user uuid, p_libro uuid, p_cap integer) TO service_role;


--
-- Name: FUNCTION _log_capitulo_terminado(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._log_capitulo_terminado() FROM PUBLIC;
GRANT ALL ON FUNCTION public._log_capitulo_terminado() TO service_role;


--
-- Name: FUNCTION _mapa_estado(p_user uuid, p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._mapa_estado(p_user uuid, p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._mapa_estado(p_user uuid, p_libro uuid) TO service_role;


--
-- Name: FUNCTION _mapa_norm(p text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._mapa_norm(p text) TO anon;
GRANT ALL ON FUNCTION public._mapa_norm(p text) TO authenticated;
GRANT ALL ON FUNCTION public._mapa_norm(p text) TO service_role;


--
-- Name: FUNCTION _meta_aula(p_aula uuid, p_zona text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._meta_aula(p_aula uuid, p_zona text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._meta_aula(p_aula uuid, p_zona text) TO service_role;


--
-- Name: FUNCTION _nombre_en_aula(p_aula uuid, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._nombre_en_aula(p_aula uuid, p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._nombre_en_aula(p_aula uuid, p_user uuid) TO service_role;


--
-- Name: FUNCTION _ovillos_saldo(p_user uuid, p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ovillos_saldo(p_user uuid, p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._ovillos_saldo(p_user uuid, p_libro uuid) TO service_role;


--
-- Name: FUNCTION _profe_de_aula(p_aula uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._profe_de_aula(p_aula uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._profe_de_aula(p_aula uuid) TO service_role;


--
-- Name: FUNCTION _recompensa_bloqueo(p_user uuid, p_rec uuid, p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._recompensa_bloqueo(p_user uuid, p_rec uuid, p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._recompensa_bloqueo(p_user uuid, p_rec uuid, p_libro uuid) TO service_role;


--
-- Name: FUNCTION _referencia_ovillos(p_libro uuid, p_juegos jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._referencia_ovillos(p_libro uuid, p_juegos jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public._referencia_ovillos(p_libro uuid, p_juegos jsonb) TO service_role;


--
-- Name: FUNCTION _trg_fecha_menor_con_aula(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._trg_fecha_menor_con_aula() FROM PUBLIC;
GRANT ALL ON FUNCTION public._trg_fecha_menor_con_aula() TO service_role;


--
-- Name: FUNCTION _trg_fecha_nacimiento_fija(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._trg_fecha_nacimiento_fija() FROM PUBLIC;
GRANT ALL ON FUNCTION public._trg_fecha_nacimiento_fija() TO service_role;


--
-- Name: FUNCTION _trg_menor_no_sale_del_aula(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._trg_menor_no_sale_del_aula() FROM PUBLIC;
GRANT ALL ON FUNCTION public._trg_menor_no_sale_del_aula() TO service_role;


--
-- Name: FUNCTION _trg_perfil_al_registrarse(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._trg_perfil_al_registrarse() FROM PUBLIC;
GRANT ALL ON FUNCTION public._trg_perfil_al_registrarse() TO service_role;


--
-- Name: FUNCTION _zona_valida(p_zona text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._zona_valida(p_zona text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._zona_valida(p_zona text) TO service_role;


--
-- Name: FUNCTION admins_colegio(p_colegio uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admins_colegio(p_colegio uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admins_colegio(p_colegio uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admins_colegio(p_colegio uuid) TO service_role;


--
-- Name: FUNCTION adquirir_libro(p_libro_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.adquirir_libro(p_libro_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.adquirir_libro(p_libro_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.adquirir_libro(p_libro_id uuid) TO service_role;


--
-- Name: FUNCTION anderson_elegir(p_jugada uuid, p_opcion integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.anderson_elegir(p_jugada uuid, p_opcion integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.anderson_elegir(p_jugada uuid, p_opcion integer) TO authenticated;
GRANT ALL ON FUNCTION public.anderson_elegir(p_jugada uuid, p_opcion integer) TO service_role;


--
-- Name: FUNCTION anderson_jugar(p_libro uuid, p_personaje text, p_pistas text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.anderson_jugar(p_libro uuid, p_personaje text, p_pistas text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.anderson_jugar(p_libro uuid, p_personaje text, p_pistas text[]) TO authenticated;
GRANT ALL ON FUNCTION public.anderson_jugar(p_libro uuid, p_personaje text, p_pistas text[]) TO service_role;


--
-- Name: FUNCTION anderson_mesa(p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.anderson_mesa(p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.anderson_mesa(p_libro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.anderson_mesa(p_libro uuid) TO service_role;


--
-- Name: FUNCTION asignar_lectura(p_aula uuid, p_libro uuid, p_fecha_meta date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.asignar_lectura(p_aula uuid, p_libro uuid, p_fecha_meta date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.asignar_lectura(p_aula uuid, p_libro uuid, p_fecha_meta date) TO authenticated;
GRANT ALL ON FUNCTION public.asignar_lectura(p_aula uuid, p_libro uuid, p_fecha_meta date) TO service_role;


--
-- Name: FUNCTION bote_entregar(p_recompensa uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.bote_entregar(p_recompensa uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.bote_entregar(p_recompensa uuid) TO authenticated;
GRANT ALL ON FUNCTION public.bote_entregar(p_recompensa uuid) TO service_role;


--
-- Name: FUNCTION buscar_comunidades(p_texto text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.buscar_comunidades(p_texto text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.buscar_comunidades(p_texto text) TO authenticated;
GRANT ALL ON FUNCTION public.buscar_comunidades(p_texto text) TO service_role;


--
-- Name: FUNCTION canje_resolver(p_canje uuid, p_estado text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.canje_resolver(p_canje uuid, p_estado text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.canje_resolver(p_canje uuid, p_estado text) TO authenticated;
GRANT ALL ON FUNCTION public.canje_resolver(p_canje uuid, p_estado text) TO service_role;


--
-- Name: FUNCTION canjear_codigo(p_codigo text, p_nombre_en_aula text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.canjear_codigo(p_codigo text, p_nombre_en_aula text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.canjear_codigo(p_codigo text, p_nombre_en_aula text) TO authenticated;
GRANT ALL ON FUNCTION public.canjear_codigo(p_codigo text, p_nombre_en_aula text) TO service_role;


--
-- Name: FUNCTION capsula_abrir(p_libro uuid, p_respuestas text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.capsula_abrir(p_libro uuid, p_respuestas text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.capsula_abrir(p_libro uuid, p_respuestas text[]) TO authenticated;
GRANT ALL ON FUNCTION public.capsula_abrir(p_libro uuid, p_respuestas text[]) TO service_role;


--
-- Name: FUNCTION capsula_aula(p_aula uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.capsula_aula(p_aula uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.capsula_aula(p_aula uuid) TO authenticated;
GRANT ALL ON FUNCTION public.capsula_aula(p_aula uuid) TO service_role;


--
-- Name: FUNCTION capsula_libro(p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.capsula_libro(p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.capsula_libro(p_libro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.capsula_libro(p_libro uuid) TO service_role;


--
-- Name: FUNCTION capsula_sellar(p_libro uuid, p_respuestas text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.capsula_sellar(p_libro uuid, p_respuestas text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.capsula_sellar(p_libro uuid, p_respuestas text[]) TO authenticated;
GRANT ALL ON FUNCTION public.capsula_sellar(p_libro uuid, p_respuestas text[]) TO service_role;


--
-- Name: FUNCTION codigo_aula_valido(p_codigo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.codigo_aula_valido(p_codigo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.codigo_aula_valido(p_codigo text) TO anon;
GRANT ALL ON FUNCTION public.codigo_aula_valido(p_codigo text) TO authenticated;
GRANT ALL ON FUNCTION public.codigo_aula_valido(p_codigo text) TO service_role;


--
-- Name: FUNCTION comprension_aula(p_aula uuid, p_zona text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.comprension_aula(p_aula uuid, p_zona text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.comprension_aula(p_aula uuid, p_zona text) TO authenticated;
GRANT ALL ON FUNCTION public.comprension_aula(p_aula uuid, p_zona text) TO service_role;


--
-- Name: FUNCTION concurso_comodin(p_libro uuid, p_frase text, p_cual text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.concurso_comodin(p_libro uuid, p_frase text, p_cual text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.concurso_comodin(p_libro uuid, p_frase text, p_cual text) TO authenticated;
GRANT ALL ON FUNCTION public.concurso_comodin(p_libro uuid, p_frase text, p_cual text) TO service_role;


--
-- Name: FUNCTION concurso_elegir(p_libro uuid, p_frase text, p_opcion integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.concurso_elegir(p_libro uuid, p_frase text, p_opcion integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.concurso_elegir(p_libro uuid, p_frase text, p_opcion integer) TO authenticated;
GRANT ALL ON FUNCTION public.concurso_elegir(p_libro uuid, p_frase text, p_opcion integer) TO service_role;


--
-- Name: FUNCTION concurso_liberar(p_user uuid, p_libro uuid, p_frase text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.concurso_liberar(p_user uuid, p_libro uuid, p_frase text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.concurso_liberar(p_user uuid, p_libro uuid, p_frase text) TO service_role;


--
-- Name: FUNCTION concurso_libro(p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.concurso_libro(p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.concurso_libro(p_libro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.concurso_libro(p_libro uuid) TO service_role;


--
-- Name: FUNCTION concurso_reservar(p_user uuid, p_libro uuid, p_frase text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.concurso_reservar(p_user uuid, p_libro uuid, p_frase text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.concurso_reservar(p_user uuid, p_libro uuid, p_frase text) TO service_role;


--
-- Name: FUNCTION concurso_resolver(p_user uuid, p_libro uuid, p_frase text, p_veredicto text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.concurso_resolver(p_user uuid, p_libro uuid, p_frase text, p_veredicto text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.concurso_resolver(p_user uuid, p_libro uuid, p_frase text, p_veredicto text) TO service_role;


--
-- Name: FUNCTION contar_palabras(texto text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.contar_palabras(texto text) TO anon;
GRANT ALL ON FUNCTION public.contar_palabras(texto text) TO authenticated;
GRANT ALL ON FUNCTION public.contar_palabras(texto text) TO service_role;


--
-- Name: FUNCTION corazonada_cobrar(p_libro uuid, p_corazonada text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.corazonada_cobrar(p_libro uuid, p_corazonada text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.corazonada_cobrar(p_libro uuid, p_corazonada text) TO authenticated;
GRANT ALL ON FUNCTION public.corazonada_cobrar(p_libro uuid, p_corazonada text) TO service_role;


--
-- Name: FUNCTION corazonada_jugar(p_libro uuid, p_corazonada text, p_opcion integer, p_ovillos integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.corazonada_jugar(p_libro uuid, p_corazonada text, p_opcion integer, p_ovillos integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.corazonada_jugar(p_libro uuid, p_corazonada text, p_opcion integer, p_ovillos integer) TO authenticated;
GRANT ALL ON FUNCTION public.corazonada_jugar(p_libro uuid, p_corazonada text, p_opcion integer, p_ovillos integer) TO service_role;


--
-- Name: FUNCTION corazonada_llegar(p_libro uuid, p_corazonada text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.corazonada_llegar(p_libro uuid, p_corazonada text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.corazonada_llegar(p_libro uuid, p_corazonada text) TO authenticated;
GRANT ALL ON FUNCTION public.corazonada_llegar(p_libro uuid, p_corazonada text) TO service_role;


--
-- Name: FUNCTION corazonadas_libro(p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.corazonadas_libro(p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.corazonadas_libro(p_libro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.corazonadas_libro(p_libro uuid) TO service_role;


--
-- Name: FUNCTION crear_aula(p_colegio uuid, p_grado text, p_seccion text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crear_aula(p_colegio uuid, p_grado text, p_seccion text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.crear_aula(p_colegio uuid, p_grado text, p_seccion text) TO authenticated;
GRANT ALL ON FUNCTION public.crear_aula(p_colegio uuid, p_grado text, p_seccion text) TO service_role;


--
-- Name: FUNCTION crear_colegio(p_nombre text, p_pais text, p_ciudad text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crear_colegio(p_nombre text, p_pais text, p_ciudad text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.crear_colegio(p_nombre text, p_pais text, p_ciudad text) TO service_role;


--
-- Name: FUNCTION crear_comunidad(p_nombre text, p_descripcion text, p_privada boolean, p_codigo text, p_libro_id uuid, p_fecha_meta date, p_encuentro_lugar text, p_encuentro_fecha timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crear_comunidad(p_nombre text, p_descripcion text, p_privada boolean, p_codigo text, p_libro_id uuid, p_fecha_meta date, p_encuentro_lugar text, p_encuentro_fecha timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.crear_comunidad(p_nombre text, p_descripcion text, p_privada boolean, p_codigo text, p_libro_id uuid, p_fecha_meta date, p_encuentro_lugar text, p_encuentro_fecha timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.crear_comunidad(p_nombre text, p_descripcion text, p_privada boolean, p_codigo text, p_libro_id uuid, p_fecha_meta date, p_encuentro_lugar text, p_encuentro_fecha timestamp with time zone) TO service_role;


--
-- Name: FUNCTION delete_parrafo_superuser(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_parrafo_superuser(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_parrafo_superuser(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_parrafo_superuser(p_id uuid) TO service_role;


--
-- Name: FUNCTION denuncias_para_revisar(p_pendientes boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.denuncias_para_revisar(p_pendientes boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.denuncias_para_revisar(p_pendientes boolean) TO authenticated;
GRANT ALL ON FUNCTION public.denuncias_para_revisar(p_pendientes boolean) TO service_role;


--
-- Name: FUNCTION desafio_calificar(p_aula uuid, p_user uuid, p_momento text, p_nota integer, p_comentario text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.desafio_calificar(p_aula uuid, p_user uuid, p_momento text, p_nota integer, p_comentario text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.desafio_calificar(p_aula uuid, p_user uuid, p_momento text, p_nota integer, p_comentario text) TO authenticated;
GRANT ALL ON FUNCTION public.desafio_calificar(p_aula uuid, p_user uuid, p_momento text, p_nota integer, p_comentario text) TO service_role;


--
-- Name: FUNCTION desafio_charla_aula(p_aula uuid, p_user uuid, p_momento text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.desafio_charla_aula(p_aula uuid, p_user uuid, p_momento text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.desafio_charla_aula(p_aula uuid, p_user uuid, p_momento text) TO authenticated;
GRANT ALL ON FUNCTION public.desafio_charla_aula(p_aula uuid, p_user uuid, p_momento text) TO service_role;


--
-- Name: FUNCTION desafio_libro(p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.desafio_libro(p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.desafio_libro(p_libro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.desafio_libro(p_libro uuid) TO service_role;


--
-- Name: FUNCTION desafio_reservar(p_user uuid, p_libro uuid, p_momento text, p_texto text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.desafio_reservar(p_user uuid, p_libro uuid, p_momento text, p_texto text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.desafio_reservar(p_user uuid, p_libro uuid, p_momento text, p_texto text) TO service_role;


--
-- Name: FUNCTION desafio_responder(p_user uuid, p_libro uuid, p_momento text, p_mensaje text, p_terminar boolean, p_resumen jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.desafio_responder(p_user uuid, p_libro uuid, p_momento text, p_mensaje text, p_terminar boolean, p_resumen jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.desafio_responder(p_user uuid, p_libro uuid, p_momento text, p_mensaje text, p_terminar boolean, p_resumen jsonb) TO service_role;


--
-- Name: FUNCTION edad_permite_contacto(uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.edad_permite_contacto(uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edad_permite_contacto(uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.edad_permite_contacto(uid uuid) TO service_role;


--
-- Name: FUNCTION eliminar_mi_cuenta(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.eliminar_mi_cuenta() FROM PUBLIC;
GRANT ALL ON FUNCTION public.eliminar_mi_cuenta() TO authenticated;
GRANT ALL ON FUNCTION public.eliminar_mi_cuenta() TO service_role;


--
-- Name: FUNCTION es_admin_colegio(c uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.es_admin_colegio(c uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.es_admin_colegio(c uuid) TO authenticated;
GRANT ALL ON FUNCTION public.es_admin_colegio(c uuid) TO service_role;


--
-- Name: FUNCTION es_admin_de_aula(a uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.es_admin_de_aula(a uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.es_admin_de_aula(a uuid) TO authenticated;
GRANT ALL ON FUNCTION public.es_admin_de_aula(a uuid) TO service_role;


--
-- Name: FUNCTION es_miembro(c uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.es_miembro(c uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.es_miembro(c uuid) TO authenticated;
GRANT ALL ON FUNCTION public.es_miembro(c uuid) TO service_role;


--
-- Name: FUNCTION es_moderador(c uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.es_moderador(c uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.es_moderador(c uuid) TO authenticated;
GRANT ALL ON FUNCTION public.es_moderador(c uuid) TO service_role;


--
-- Name: FUNCTION es_profesor_colegio(c uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.es_profesor_colegio(c uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.es_profesor_colegio(c uuid) TO authenticated;
GRANT ALL ON FUNCTION public.es_profesor_colegio(c uuid) TO service_role;


--
-- Name: FUNCTION es_superusuario(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.es_superusuario() FROM PUBLIC;
GRANT ALL ON FUNCTION public.es_superusuario() TO authenticated;
GRANT ALL ON FUNCTION public.es_superusuario() TO service_role;


--
-- Name: FUNCTION expediente_comprar(p_libro uuid, p_expediente text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.expediente_comprar(p_libro uuid, p_expediente text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.expediente_comprar(p_libro uuid, p_expediente text) TO authenticated;
GRANT ALL ON FUNCTION public.expediente_comprar(p_libro uuid, p_expediente text) TO service_role;


--
-- Name: FUNCTION expediente_leer(p_libro uuid, p_expediente text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.expediente_leer(p_libro uuid, p_expediente text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.expediente_leer(p_libro uuid, p_expediente text) TO authenticated;
GRANT ALL ON FUNCTION public.expediente_leer(p_libro uuid, p_expediente text) TO service_role;


--
-- Name: FUNCTION falsificador_aula(p_aula uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.falsificador_aula(p_aula uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.falsificador_aula(p_aula uuid) TO authenticated;
GRANT ALL ON FUNCTION public.falsificador_aula(p_aula uuid) TO service_role;


--
-- Name: FUNCTION falsificador_libro(p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.falsificador_libro(p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.falsificador_libro(p_libro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.falsificador_libro(p_libro uuid) TO service_role;


--
-- Name: FUNCTION falsificador_responder(p_libro uuid, p_item text, p_dice text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.falsificador_responder(p_libro uuid, p_item text, p_dice text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.falsificador_responder(p_libro uuid, p_item text, p_dice text) TO authenticated;
GRANT ALL ON FUNCTION public.falsificador_responder(p_libro uuid, p_item text, p_dice text) TO service_role;


--
-- Name: FUNCTION foro_recortar_tags(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.foro_recortar_tags() TO anon;
GRANT ALL ON FUNCTION public.foro_recortar_tags() TO authenticated;
GRANT ALL ON FUNCTION public.foro_recortar_tags() TO service_role;


--
-- Name: FUNCTION invitar_admin(p_colegio uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.invitar_admin(p_colegio uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.invitar_admin(p_colegio uuid) TO authenticated;
GRANT ALL ON FUNCTION public.invitar_admin(p_colegio uuid) TO service_role;


--
-- Name: FUNCTION juegos_guardar(p_juego text, p_encendido boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.juegos_guardar(p_juego text, p_encendido boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.juegos_guardar(p_juego text, p_encendido boolean) TO authenticated;
GRANT ALL ON FUNCTION public.juegos_guardar(p_juego text, p_encendido boolean) TO service_role;


--
-- Name: FUNCTION juegos_libro(p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.juegos_libro(p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.juegos_libro(p_libro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.juegos_libro(p_libro uuid) TO service_role;


--
-- Name: FUNCTION lista_colegio(p_colegio uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lista_colegio(p_colegio uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lista_colegio(p_colegio uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lista_colegio(p_colegio uuid) TO service_role;


--
-- Name: FUNCTION mapa_libro(p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mapa_libro(p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mapa_libro(p_libro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mapa_libro(p_libro uuid) TO service_role;


--
-- Name: FUNCTION mapa_subrayar(p_libro uuid, p_capitulo integer, p_parrafo integer, p_texto text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mapa_subrayar(p_libro uuid, p_capitulo integer, p_parrafo integer, p_texto text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mapa_subrayar(p_libro uuid, p_capitulo integer, p_parrafo integer, p_texto text) TO authenticated;
GRANT ALL ON FUNCTION public.mapa_subrayar(p_libro uuid, p_capitulo integer, p_parrafo integer, p_texto text) TO service_role;


--
-- Name: FUNCTION mis_colegios(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mis_colegios() FROM PUBLIC;
GRANT ALL ON FUNCTION public.mis_colegios() TO authenticated;
GRANT ALL ON FUNCTION public.mis_colegios() TO service_role;


--
-- Name: FUNCTION mis_datos_juegos(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mis_datos_juegos() FROM PUBLIC;
GRANT ALL ON FUNCTION public.mis_datos_juegos() TO authenticated;
GRANT ALL ON FUNCTION public.mis_datos_juegos() TO service_role;


--
-- Name: FUNCTION mis_juegos(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mis_juegos() FROM PUBLIC;
GRANT ALL ON FUNCTION public.mis_juegos() TO authenticated;
GRANT ALL ON FUNCTION public.mis_juegos() TO service_role;


--
-- Name: FUNCTION ovillos_saldo(p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ovillos_saldo(p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ovillos_saldo(p_libro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ovillos_saldo(p_libro uuid) TO service_role;


--
-- Name: FUNCTION progreso_comunidad(p_comunidad uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.progreso_comunidad(p_comunidad uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.progreso_comunidad(p_comunidad uuid) TO authenticated;
GRANT ALL ON FUNCTION public.progreso_comunidad(p_comunidad uuid) TO service_role;


--
-- Name: FUNCTION puede_recibir_mensajitos(p_comunidad uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.puede_recibir_mensajitos(p_comunidad uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.puede_recibir_mensajitos(p_comunidad uuid) TO authenticated;
GRANT ALL ON FUNCTION public.puede_recibir_mensajitos(p_comunidad uuid) TO service_role;


--
-- Name: FUNCTION purgar_chat_antiguo(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purgar_chat_antiguo() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purgar_chat_antiguo() TO service_role;


--
-- Name: FUNCTION purgar_denuncias_resueltas(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purgar_denuncias_resueltas() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purgar_denuncias_resueltas() TO service_role;


--
-- Name: FUNCTION recalcular_muestra(libro_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recalcular_muestra(libro_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recalcular_muestra(libro_ids uuid[]) TO service_role;


--
-- Name: FUNCTION recalcular_palabras_capitulos(ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recalcular_palabras_capitulos(ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recalcular_palabras_capitulos(ids uuid[]) TO service_role;


--
-- Name: FUNCTION recompensa_activar(p_recompensa uuid, p_activa boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recompensa_activar(p_recompensa uuid, p_activa boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recompensa_activar(p_recompensa uuid, p_activa boolean) TO authenticated;
GRANT ALL ON FUNCTION public.recompensa_activar(p_recompensa uuid, p_activa boolean) TO service_role;


--
-- Name: FUNCTION recompensa_aportar(p_recompensa uuid, p_cantidad integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recompensa_aportar(p_recompensa uuid, p_cantidad integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recompensa_aportar(p_recompensa uuid, p_cantidad integer) TO authenticated;
GRANT ALL ON FUNCTION public.recompensa_aportar(p_recompensa uuid, p_cantidad integer) TO service_role;


--
-- Name: FUNCTION recompensa_borrar(p_recompensa uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recompensa_borrar(p_recompensa uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recompensa_borrar(p_recompensa uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recompensa_borrar(p_recompensa uuid) TO service_role;


--
-- Name: FUNCTION recompensa_canjear(p_recompensa uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recompensa_canjear(p_recompensa uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recompensa_canjear(p_recompensa uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recompensa_canjear(p_recompensa uuid) TO service_role;


--
-- Name: FUNCTION recompensa_crear(p_aula uuid, p_titulo text, p_precio integer, p_limite text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recompensa_crear(p_aula uuid, p_titulo text, p_precio integer, p_limite text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recompensa_crear(p_aula uuid, p_titulo text, p_precio integer, p_limite text) TO authenticated;
GRANT ALL ON FUNCTION public.recompensa_crear(p_aula uuid, p_titulo text, p_precio integer, p_limite text) TO service_role;


--
-- Name: FUNCTION recompensas_aula(p_aula uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recompensas_aula(p_aula uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recompensas_aula(p_aula uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recompensas_aula(p_aula uuid) TO service_role;


--
-- Name: FUNCTION regenerar_codigo(p_comunidad uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regenerar_codigo(p_comunidad uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.regenerar_codigo(p_comunidad uuid) TO authenticated;
GRANT ALL ON FUNCTION public.regenerar_codigo(p_comunidad uuid) TO service_role;


--
-- Name: FUNCTION regenerar_codigo_profesor(p_aula uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regenerar_codigo_profesor(p_aula uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.regenerar_codigo_profesor(p_aula uuid) TO authenticated;
GRANT ALL ON FUNCTION public.regenerar_codigo_profesor(p_aula uuid) TO service_role;


--
-- Name: FUNCTION resolver_denuncia(p_id uuid, p_accion text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolver_denuncia(p_id uuid, p_accion text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolver_denuncia(p_id uuid, p_accion text) TO authenticated;
GRANT ALL ON FUNCTION public.resolver_denuncia(p_id uuid, p_accion text) TO service_role;


--
-- Name: FUNCTION resumen_colegio(p_colegio uuid, p_zona text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resumen_colegio(p_colegio uuid, p_zona text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resumen_colegio(p_colegio uuid, p_zona text) TO authenticated;
GRANT ALL ON FUNCTION public.resumen_colegio(p_colegio uuid, p_zona text) TO service_role;


--
-- Name: FUNCTION salon_aula(p_aula uuid, p_zona text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.salon_aula(p_aula uuid, p_zona text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salon_aula(p_aula uuid, p_zona text) TO authenticated;
GRANT ALL ON FUNCTION public.salon_aula(p_aula uuid, p_zona text) TO service_role;


--
-- Name: FUNCTION tienda_recompensas(p_libro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_recompensas(p_libro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_recompensas(p_libro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tienda_recompensas(p_libro uuid) TO service_role;


--
-- Name: FUNCTION trg_muestra_delete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_muestra_delete() TO anon;
GRANT ALL ON FUNCTION public.trg_muestra_delete() TO authenticated;
GRANT ALL ON FUNCTION public.trg_muestra_delete() TO service_role;


--
-- Name: FUNCTION trg_muestra_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_muestra_insert() TO anon;
GRANT ALL ON FUNCTION public.trg_muestra_insert() TO authenticated;
GRANT ALL ON FUNCTION public.trg_muestra_insert() TO service_role;


--
-- Name: FUNCTION trg_muestra_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_muestra_update() TO anon;
GRANT ALL ON FUNCTION public.trg_muestra_update() TO authenticated;
GRANT ALL ON FUNCTION public.trg_muestra_update() TO service_role;


--
-- Name: FUNCTION trg_palabras_delete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_palabras_delete() TO anon;
GRANT ALL ON FUNCTION public.trg_palabras_delete() TO authenticated;
GRANT ALL ON FUNCTION public.trg_palabras_delete() TO service_role;


--
-- Name: FUNCTION trg_palabras_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_palabras_insert() TO anon;
GRANT ALL ON FUNCTION public.trg_palabras_insert() TO authenticated;
GRANT ALL ON FUNCTION public.trg_palabras_insert() TO service_role;


--
-- Name: FUNCTION trg_palabras_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_palabras_update() TO anon;
GRANT ALL ON FUNCTION public.trg_palabras_update() TO authenticated;
GRANT ALL ON FUNCTION public.trg_palabras_update() TO service_role;


--
-- Name: FUNCTION unirse_con_codigo(p_codigo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.unirse_con_codigo(p_codigo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.unirse_con_codigo(p_codigo text) TO authenticated;
GRANT ALL ON FUNCTION public.unirse_con_codigo(p_codigo text) TO service_role;


--
-- Name: TABLE album_barajitas_pegadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.album_barajitas_pegadas TO anon;
GRANT ALL ON TABLE public.album_barajitas_pegadas TO authenticated;
GRANT ALL ON TABLE public.album_barajitas_pegadas TO service_role;


--
-- Name: TABLE biblioteca_media; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.biblioteca_media TO anon;
GRANT ALL ON TABLE public.biblioteca_media TO authenticated;
GRANT ALL ON TABLE public.biblioteca_media TO service_role;


--
-- Name: TABLE capitulos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.capitulos TO anon;
GRANT ALL ON TABLE public.capitulos TO authenticated;
GRANT ALL ON TABLE public.capitulos TO service_role;


--
-- Name: TABLE elementos_interactivos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.elementos_interactivos TO anon;
GRANT ALL ON TABLE public.elementos_interactivos TO authenticated;
GRANT ALL ON TABLE public.elementos_interactivos TO service_role;


--
-- Name: TABLE parrafos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.parrafos TO anon;
GRANT ALL ON TABLE public.parrafos TO authenticated;
GRANT ALL ON TABLE public.parrafos TO service_role;


--
-- Name: TABLE album_imagenes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.album_imagenes TO anon;
GRANT ALL ON TABLE public.album_imagenes TO authenticated;
GRANT ALL ON TABLE public.album_imagenes TO service_role;


--
-- Name: TABLE anderson_contenido; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.anderson_contenido TO anon;
GRANT ALL ON TABLE public.anderson_contenido TO authenticated;
GRANT ALL ON TABLE public.anderson_contenido TO service_role;


--
-- Name: TABLE anderson_jugadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.anderson_jugadas TO anon;
GRANT ALL ON TABLE public.anderson_jugadas TO authenticated;
GRANT ALL ON TABLE public.anderson_jugadas TO service_role;


--
-- Name: TABLE anotaciones_usuario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.anotaciones_usuario TO anon;
GRANT ALL ON TABLE public.anotaciones_usuario TO authenticated;
GRANT ALL ON TABLE public.anotaciones_usuario TO service_role;


--
-- Name: TABLE bibliotecas_usuarios; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bibliotecas_usuarios TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bibliotecas_usuarios TO authenticated;
GRANT ALL ON TABLE public.bibliotecas_usuarios TO service_role;


--
-- Name: COLUMN bibliotecas_usuarios.leido; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(leido) ON TABLE public.bibliotecas_usuarios TO authenticated;


--
-- Name: COLUMN bibliotecas_usuarios.categoria_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(categoria_id) ON TABLE public.bibliotecas_usuarios TO authenticated;


--
-- Name: SEQUENCE bibliotecas_usuarios_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.bibliotecas_usuarios_id_seq TO anon;
GRANT ALL ON SEQUENCE public.bibliotecas_usuarios_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bibliotecas_usuarios_id_seq TO service_role;


--
-- Name: TABLE capsula_contenido; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.capsula_contenido TO anon;
GRANT ALL ON TABLE public.capsula_contenido TO authenticated;
GRANT ALL ON TABLE public.capsula_contenido TO service_role;


--
-- Name: TABLE capsula_respuestas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.capsula_respuestas TO anon;
GRANT ALL ON TABLE public.capsula_respuestas TO authenticated;
GRANT ALL ON TABLE public.capsula_respuestas TO service_role;


--
-- Name: TABLE cartelera_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cartelera_items TO anon;
GRANT ALL ON TABLE public.cartelera_items TO authenticated;
GRANT ALL ON TABLE public.cartelera_items TO service_role;


--
-- Name: TABLE cartelera_principal; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cartelera_principal TO anon;
GRANT ALL ON TABLE public.cartelera_principal TO authenticated;
GRANT ALL ON TABLE public.cartelera_principal TO service_role;


--
-- Name: TABLE categorias_usuario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.categorias_usuario TO anon;
GRANT ALL ON TABLE public.categorias_usuario TO authenticated;
GRANT ALL ON TABLE public.categorias_usuario TO service_role;


--
-- Name: TABLE chat_historial; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_historial TO anon;
GRANT ALL ON TABLE public.chat_historial TO authenticated;
GRANT ALL ON TABLE public.chat_historial TO service_role;


--
-- Name: TABLE chat_mensajes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_mensajes TO anon;
GRANT ALL ON TABLE public.chat_mensajes TO authenticated;
GRANT ALL ON TABLE public.chat_mensajes TO service_role;


--
-- Name: TABLE chat_sesiones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_sesiones TO anon;
GRANT ALL ON TABLE public.chat_sesiones TO authenticated;
GRANT ALL ON TABLE public.chat_sesiones TO service_role;


--
-- Name: TABLE colegio_admins; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.colegio_admins TO anon;
GRANT ALL ON TABLE public.colegio_admins TO authenticated;
GRANT ALL ON TABLE public.colegio_admins TO service_role;


--
-- Name: TABLE colegio_codigos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.colegio_codigos TO anon;
GRANT ALL ON TABLE public.colegio_codigos TO authenticated;
GRANT ALL ON TABLE public.colegio_codigos TO service_role;


--
-- Name: TABLE colegios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.colegios TO anon;
GRANT ALL ON TABLE public.colegios TO authenticated;
GRANT ALL ON TABLE public.colegios TO service_role;


--
-- Name: TABLE comentarios_lectura; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.comentarios_lectura TO anon;
GRANT ALL ON TABLE public.comentarios_lectura TO authenticated;
GRANT ALL ON TABLE public.comentarios_lectura TO service_role;


--
-- Name: TABLE comunidad_codigos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.comunidad_codigos TO anon;
GRANT ALL ON TABLE public.comunidad_codigos TO authenticated;
GRANT ALL ON TABLE public.comunidad_codigos TO service_role;


--
-- Name: TABLE comunidad_lecturas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.comunidad_lecturas TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.comunidad_lecturas TO authenticated;
GRANT ALL ON TABLE public.comunidad_lecturas TO service_role;


--
-- Name: COLUMN comunidad_lecturas.fecha_meta; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(fecha_meta) ON TABLE public.comunidad_lecturas TO authenticated;


--
-- Name: COLUMN comunidad_lecturas.encuentro_lugar; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(encuentro_lugar) ON TABLE public.comunidad_lecturas TO authenticated;


--
-- Name: COLUMN comunidad_lecturas.encuentro_fecha; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(encuentro_fecha) ON TABLE public.comunidad_lecturas TO authenticated;


--
-- Name: TABLE comunidad_miembros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.comunidad_miembros TO anon;
GRANT ALL ON TABLE public.comunidad_miembros TO authenticated;
GRANT ALL ON TABLE public.comunidad_miembros TO service_role;


--
-- Name: TABLE comunidades; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.comunidades TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.comunidades TO authenticated;
GRANT ALL ON TABLE public.comunidades TO service_role;


--
-- Name: COLUMN comunidades.nombre; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(nombre) ON TABLE public.comunidades TO authenticated;


--
-- Name: COLUMN comunidades.descripcion; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(descripcion) ON TABLE public.comunidades TO authenticated;


--
-- Name: COLUMN comunidades.privada; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(privada) ON TABLE public.comunidades TO authenticated;


--
-- Name: COLUMN comunidades.libro_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(libro_id) ON TABLE public.comunidades TO authenticated;


--
-- Name: TABLE concurso_contenido; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concurso_contenido TO anon;
GRANT ALL ON TABLE public.concurso_contenido TO authenticated;
GRANT ALL ON TABLE public.concurso_contenido TO service_role;


--
-- Name: TABLE concurso_jugadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concurso_jugadas TO anon;
GRANT ALL ON TABLE public.concurso_jugadas TO authenticated;
GRANT ALL ON TABLE public.concurso_jugadas TO service_role;


--
-- Name: TABLE concurso_llamadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concurso_llamadas TO anon;
GRANT ALL ON TABLE public.concurso_llamadas TO authenticated;
GRANT ALL ON TABLE public.concurso_llamadas TO service_role;


--
-- Name: SEQUENCE concurso_llamadas_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.concurso_llamadas_id_seq TO anon;
GRANT ALL ON SEQUENCE public.concurso_llamadas_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.concurso_llamadas_id_seq TO service_role;


--
-- Name: TABLE corazonadas_contenido; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.corazonadas_contenido TO anon;
GRANT ALL ON TABLE public.corazonadas_contenido TO authenticated;
GRANT ALL ON TABLE public.corazonadas_contenido TO service_role;


--
-- Name: TABLE corazonadas_jugadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.corazonadas_jugadas TO anon;
GRANT ALL ON TABLE public.corazonadas_jugadas TO authenticated;
GRANT ALL ON TABLE public.corazonadas_jugadas TO service_role;


--
-- Name: TABLE creadores_comunidad; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.creadores_comunidad TO anon;
GRANT ALL ON TABLE public.creadores_comunidad TO authenticated;
GRANT ALL ON TABLE public.creadores_comunidad TO service_role;


--
-- Name: TABLE denuncias; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.denuncias TO anon;
GRANT ALL ON TABLE public.denuncias TO authenticated;
GRANT ALL ON TABLE public.denuncias TO service_role;


--
-- Name: TABLE desafio_contenido; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.desafio_contenido TO anon;
GRANT ALL ON TABLE public.desafio_contenido TO authenticated;
GRANT ALL ON TABLE public.desafio_contenido TO service_role;


--
-- Name: TABLE desafio_llamadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.desafio_llamadas TO anon;
GRANT ALL ON TABLE public.desafio_llamadas TO authenticated;
GRANT ALL ON TABLE public.desafio_llamadas TO service_role;


--
-- Name: SEQUENCE desafio_llamadas_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.desafio_llamadas_id_seq TO anon;
GRANT ALL ON SEQUENCE public.desafio_llamadas_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.desafio_llamadas_id_seq TO service_role;


--
-- Name: TABLE libros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.libros TO anon;
GRANT ALL ON TABLE public.libros TO authenticated;
GRANT ALL ON TABLE public.libros TO service_role;


--
-- Name: TABLE elementos_con_contexto; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.elementos_con_contexto TO anon;
GRANT ALL ON TABLE public.elementos_con_contexto TO authenticated;
GRANT ALL ON TABLE public.elementos_con_contexto TO service_role;


--
-- Name: TABLE expedientes_compras; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.expedientes_compras TO anon;
GRANT ALL ON TABLE public.expedientes_compras TO authenticated;
GRANT ALL ON TABLE public.expedientes_compras TO service_role;


--
-- Name: TABLE expedientes_contenido; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.expedientes_contenido TO anon;
GRANT ALL ON TABLE public.expedientes_contenido TO authenticated;
GRANT ALL ON TABLE public.expedientes_contenido TO service_role;


--
-- Name: TABLE falsificador_contenido; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.falsificador_contenido TO anon;
GRANT ALL ON TABLE public.falsificador_contenido TO authenticated;
GRANT ALL ON TABLE public.falsificador_contenido TO service_role;


--
-- Name: TABLE falsificador_jugadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.falsificador_jugadas TO anon;
GRANT ALL ON TABLE public.falsificador_jugadas TO authenticated;
GRANT ALL ON TABLE public.falsificador_jugadas TO service_role;


--
-- Name: TABLE foros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.foros TO anon;
GRANT ALL ON TABLE public.foros TO authenticated;
GRANT ALL ON TABLE public.foros TO service_role;


--
-- Name: TABLE foros_comentarios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.foros_comentarios TO anon;
GRANT ALL ON TABLE public.foros_comentarios TO authenticated;
GRANT ALL ON TABLE public.foros_comentarios TO service_role;


--
-- Name: TABLE libro_reels; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.libro_reels TO anon;
GRANT ALL ON TABLE public.libro_reels TO authenticated;
GRANT ALL ON TABLE public.libro_reels TO service_role;


--
-- Name: TABLE media_por_parrafo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.media_por_parrafo TO anon;
GRANT ALL ON TABLE public.media_por_parrafo TO authenticated;
GRANT ALL ON TABLE public.media_por_parrafo TO service_role;


--
-- Name: TABLE libros_resumen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.libros_resumen TO anon;
GRANT ALL ON TABLE public.libros_resumen TO authenticated;
GRANT ALL ON TABLE public.libros_resumen TO service_role;


--
-- Name: TABLE mapa_contenido; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mapa_contenido TO anon;
GRANT ALL ON TABLE public.mapa_contenido TO authenticated;
GRANT ALL ON TABLE public.mapa_contenido TO service_role;


--
-- Name: TABLE mapa_jugadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mapa_jugadas TO anon;
GRANT ALL ON TABLE public.mapa_jugadas TO authenticated;
GRANT ALL ON TABLE public.mapa_jugadas TO service_role;


--
-- Name: TABLE mensajitos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.mensajitos TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.mensajitos TO authenticated;
GRANT ALL ON TABLE public.mensajitos TO service_role;


--
-- Name: COLUMN mensajitos.leido_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(leido_at) ON TABLE public.mensajitos TO authenticated;


--
-- Name: TABLE ovillos_movimientos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ovillos_movimientos TO anon;
GRANT ALL ON TABLE public.ovillos_movimientos TO authenticated;
GRANT ALL ON TABLE public.ovillos_movimientos TO service_role;


--
-- Name: TABLE perfiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.perfiles TO anon;
GRANT ALL ON TABLE public.perfiles TO authenticated;
GRANT ALL ON TABLE public.perfiles TO service_role;


--
-- Name: TABLE perfiles_publicos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.perfiles_publicos TO authenticated;
GRANT ALL ON TABLE public.perfiles_publicos TO service_role;


--
-- Name: TABLE predicciones_usuario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.predicciones_usuario TO anon;
GRANT ALL ON TABLE public.predicciones_usuario TO authenticated;
GRANT ALL ON TABLE public.predicciones_usuario TO service_role;


--
-- Name: TABLE preferencias_usuario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.preferencias_usuario TO anon;
GRANT ALL ON TABLE public.preferencias_usuario TO authenticated;
GRANT ALL ON TABLE public.preferencias_usuario TO service_role;


--
-- Name: TABLE progreso_capitulos_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.progreso_capitulos_log TO anon;
GRANT ALL ON TABLE public.progreso_capitulos_log TO authenticated;
GRANT ALL ON TABLE public.progreso_capitulos_log TO service_role;


--
-- Name: TABLE progreso_lectura; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.progreso_lectura TO anon;
GRANT ALL ON TABLE public.progreso_lectura TO authenticated;
GRANT ALL ON TABLE public.progreso_lectura TO service_role;


--
-- Name: TABLE recompensas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.recompensas TO anon;
GRANT ALL ON TABLE public.recompensas TO authenticated;
GRANT ALL ON TABLE public.recompensas TO service_role;


--
-- Name: TABLE recompensas_aportes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.recompensas_aportes TO anon;
GRANT ALL ON TABLE public.recompensas_aportes TO authenticated;
GRANT ALL ON TABLE public.recompensas_aportes TO service_role;


--
-- Name: TABLE recompensas_canjes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.recompensas_canjes TO anon;
GRANT ALL ON TABLE public.recompensas_canjes TO authenticated;
GRANT ALL ON TABLE public.recompensas_canjes TO service_role;


--
-- Name: TABLE resenas_libros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.resenas_libros TO anon;
GRANT ALL ON TABLE public.resenas_libros TO authenticated;
GRANT ALL ON TABLE public.resenas_libros TO service_role;


--
-- Name: TABLE sala_libros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sala_libros TO anon;
GRANT ALL ON TABLE public.sala_libros TO authenticated;
GRANT ALL ON TABLE public.sala_libros TO service_role;


--
-- Name: TABLE salas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.salas TO anon;
GRANT ALL ON TABLE public.salas TO authenticated;
GRANT ALL ON TABLE public.salas TO service_role;


--
-- Name: TABLE sesiones_lectura; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sesiones_lectura TO anon;
GRANT ALL ON TABLE public.sesiones_lectura TO authenticated;
GRANT ALL ON TABLE public.sesiones_lectura TO service_role;


--
-- Name: TABLE subrayados_usuario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subrayados_usuario TO anon;
GRANT ALL ON TABLE public.subrayados_usuario TO authenticated;
GRANT ALL ON TABLE public.subrayados_usuario TO service_role;


--
-- Name: TABLE subrayados_populares; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subrayados_populares TO authenticated;
GRANT ALL ON TABLE public.subrayados_populares TO service_role;


--
-- Name: TABLE superusuarios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.superusuarios TO anon;
GRANT ALL ON TABLE public.superusuarios TO authenticated;
GRANT ALL ON TABLE public.superusuarios TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict inmersia

