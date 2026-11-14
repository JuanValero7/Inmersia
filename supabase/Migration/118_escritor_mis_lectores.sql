-- =============================================================
-- INMERSIA — Migración 118
-- Rincón del escritor: «Mis lectores» (fase 6, la parte de analítica)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 103 (libros.propietario_id) y la 084 (progreso_capitulos_log
-- no se usa aquí, pero sí progreso_lectura.capitulos_completados).
--
-- QUÉ HACE
--   Una sola función, mis_lectores(libro, desde, zona), que devuelve el
--   resumen del libro YA SUMADO. No crea tablas ni registra nada nuevo:
--   todo sale de lo que la app ya guarda (decisión de Juan, 13 nov 2026:
--   nada de fichas consultadas, origen ni minutos por capítulo).
--
-- QUIÉN LA PUEDE LLAMAR
--   El dueño del libro (libros.propietario_id) o un superusuario, este
--   para cualquier libro del catálogo.
--
-- PRIVACIDAD (maqueta, pantalla 9)
--   · Solo cifras de grupo. Nunca un user_id, nunca un texto escrito por
--     un lector (la Cápsula es texto libre → solo cuántos la sellaron).
--   · Mínimo 10 lectores: cada gráfico (y cada pregunta de un juego) con
--     menos de 10 personas sale como null → «todavía pocos lectores».
--   · No cuentan el propio dueño ni los superusuarios.
--   · Las reseñas ya son públicas en la ficha: la media sale siempre.
--
-- EL FILTRO DE FECHAS (30 días / 3 meses / todo)
--   p_desde NULL = todo. Si no, cuenta los lectores que AGREGARON el libro
--   desde esa fecha (y lo que esos lectores hicieron), y las jugadas,
--   subrayados, reseñas y sesiones de esas fechas.
--
-- Idempotente. Después: npm run esquema y commit del volcado.
-- =============================================================

CREATE OR REPLACE FUNCTION public.mis_lectores(
  p_libro uuid,
  p_desde timestamptz DEFAULT NULL,
  p_zona  text        DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  MINIMO constant int := 10;
  v_uid    uuid := auth.uid();
  v_libro  record;
  v_desde  timestamptz := coalesce(p_desde, '-infinity'::timestamptz);
  v_zona   text := coalesce(nullif(p_zona, ''), 'UTC');
  v_caps   int;
  v_empez  int;
  r        jsonb := '{}'::jsonb;
BEGIN
  SELECT id, titulo, es_ficcion, propietario_id INTO v_libro FROM libros WHERE id = p_libro;
  -- OJO: los libros del catálogo tienen propietario_id NULL; con un «=»
  -- a secas la condición daría NULL y dejaría pasar a cualquiera.
  IF NOT FOUND OR v_uid IS NULL
     OR NOT (v_libro.propietario_id IS NOT DISTINCT FROM v_uid OR es_superusuario()) THEN
    RAISE EXCEPTION 'Ese libro no es tuyo' USING HINT = 'libro_invalido';
  END IF;
  -- Una zona horaria que no existe haría fallar todo: mejor UTC.
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zona) THEN v_zona := 'UTC'; END IF;

  SELECT count(*) INTO v_caps FROM capitulos WHERE libro_id = p_libro;

  -- Los lectores que cuentan: agregaron el libro en el periodo y no son el
  -- dueño ni un superusuario.
  CREATE TEMP TABLE IF NOT EXISTS _ml_lectores (
    user_id uuid PRIMARY KEY, empezo bool, termino bool, cap int, ultima timestamptz
  ) ON COMMIT DROP;
  TRUNCATE _ml_lectores;

  INSERT INTO _ml_lectores
  SELECT b.user_id,
         s.ultima IS NOT NULL OR p.user_id IS NOT NULL,
         b.leido OR (v_caps > 0 AND coalesce(p.capitulos_completados, 0) >= v_caps),
         -- capítulo al que llegó = el siguiente al último terminado
         least(coalesce(p.capitulos_completados, 0) + 1, greatest(v_caps, 1)),
         greatest(s.ultima, p.updated_at)
    FROM bibliotecas_usuarios b
    LEFT JOIN progreso_lectura p ON p.user_id = b.user_id AND p.libro_id = b.libro_id
    LEFT JOIN LATERAL (SELECT max(started_at) AS ultima FROM sesiones_lectura x
                        WHERE x.user_id = b.user_id AND x.libro_id = b.libro_id) s ON true
   WHERE b.libro_id = p_libro
     AND b.created_at >= v_desde
     AND b.user_id IS DISTINCT FROM v_libro.propietario_id
     AND NOT EXISTS (SELECT 1 FROM superusuarios su WHERE su.user_id = b.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT count(*) FILTER (WHERE empezo) INTO v_empez FROM _ml_lectores;

  r := jsonb_build_object(
    'minimo', MINIMO,
    'libro', jsonb_build_object('titulo', v_libro.titulo, 'es_ficcion', v_libro.es_ficcion, 'capitulos', v_caps)
  );

  -- ── Cifras ──────────────────────────────────────────────────
  r := r || jsonb_build_object('cifras', (
    SELECT jsonb_build_object(
      'agregaron',  count(*),
      'empezaron',  count(*) FILTER (WHERE l.empezo),
      'terminaron', count(*) FILTER (WHERE l.termino),
      -- tiempo activo total de los que lo terminaron (promedio, en segundos)
      'segundos_medio', CASE WHEN count(*) FILTER (WHERE l.termino) >= MINIMO THEN (
          SELECT round(avg(t.seg)) FROM (
            SELECT sum(coalesce(x.segundos_activos,
                       least(extract(epoch FROM (x.ended_at - x.started_at)), 4 * 3600)))::bigint AS seg
              FROM sesiones_lectura x JOIN _ml_lectores y ON y.user_id = x.user_id AND y.termino
             WHERE x.libro_id = p_libro
             GROUP BY x.user_id) t) END,
      'aperturas', (SELECT count(*) FROM sesiones_lectura x
                      JOIN _ml_lectores y ON y.user_id = x.user_id
                     WHERE x.libro_id = p_libro AND x.started_at >= v_desde),
      'valoracion', (SELECT round(avg(rating)::numeric, 1) FROM resenas_libros
                      WHERE libro_id = p_libro AND created_at >= v_desde),
      'resenas',    (SELECT count(*) FROM resenas_libros
                      WHERE libro_id = p_libro AND created_at >= v_desde))
    FROM _ml_lectores l));

  -- ── Hasta dónde llegan (de los que lo empezaron) ────────────
  r := r || jsonb_build_object('llegan', CASE WHEN v_empez >= MINIMO THEN (
    SELECT jsonb_agg(jsonb_build_object('cap', c, 'n',
             (SELECT count(*) FROM _ml_lectores l WHERE l.empezo AND (l.cap >= c OR l.termino))) ORDER BY c)
      FROM generate_series(1, v_caps) c) END);

  -- ── Por dónde van ahora (empezaron, no terminaron) ──────────
  -- «dormidos» = más de 30 días sin abrirlo (cuentan como abandonos).
  r := r || jsonb_build_object('ahora', (
    SELECT CASE WHEN count(*) >= MINIMO THEN jsonb_build_object(
             'total',    count(*),
             'dormidos', count(*) FILTER (WHERE l.ultima < now() - interval '30 days'),
             'caps', (SELECT jsonb_agg(jsonb_build_object('cap', c, 'n',
                        (SELECT count(*) FROM _ml_lectores m
                          WHERE m.empezo AND NOT m.termino AND m.cap = c)) ORDER BY c)
                        FROM generate_series(1, v_caps) c)) END
      FROM _ml_lectores l WHERE l.empezo AND NOT l.termino));

  -- ── Lo más subrayado (texto del libro, no del lector) ───────
  r := r || jsonb_build_object('subrayados', (
    SELECT CASE WHEN count(DISTINCT s.user_id) >= MINIMO THEN (
      SELECT coalesce(jsonb_agg(t ORDER BY t.n DESC, t.cap), '[]'::jsonb) FROM (
        SELECT s2.texto_original AS texto, min(s2.capitulo_num) AS cap, count(DISTINCT s2.user_id) AS n
          FROM subrayados_usuario s2 JOIN _ml_lectores y ON y.user_id = s2.user_id
         WHERE s2.libro_id = p_libro AND s2.created_at >= v_desde
         GROUP BY s2.texto_original
         HAVING count(DISTINCT s2.user_id) >= 2
         ORDER BY count(DISTINCT s2.user_id) DESC, min(s2.capitulo_num)
         LIMIT 5) t) END
      FROM subrayados_usuario s JOIN _ml_lectores y ON y.user_id = s.user_id
     WHERE s.libro_id = p_libro AND s.created_at >= v_desde));

  -- ── Cuándo leen (sesiones por franja, hora del escritor) ────
  r := r || jsonb_build_object('horas', (
    SELECT CASE WHEN count(DISTINCT x.user_id) >= MINIMO THEN jsonb_build_object(
             'manana',    count(*) FILTER (WHERE h BETWEEN 6 AND 11),
             'tarde',     count(*) FILTER (WHERE h BETWEEN 12 AND 18),
             'noche',     count(*) FILTER (WHERE h BETWEEN 19 AND 23),
             'madrugada', count(*) FILTER (WHERE h BETWEEN 0 AND 5)) END
      FROM sesiones_lectura x
      JOIN _ml_lectores y ON y.user_id = x.user_id
      CROSS JOIN LATERAL (SELECT extract(hour FROM x.started_at AT TIME ZONE v_zona)::int AS h) hh
     WHERE x.libro_id = p_libro AND x.started_at >= v_desde));

  -- ── Juegos: como los vería un profesor ──────────────────────
  -- Cada pregunta/personaje/tesoro con menos de 10 jugadores lleva pct null.
  r := r || jsonb_build_object('juegos', jsonb_build_object(

    -- Corazonadas: % que acertó, entre los que apostaron y ya se resolvió.
    'corazonadas', (
      SELECT jsonb_agg(jsonb_build_object(
               'texto', c ->> 'pregunta', 'clase', c ->> 'clase',
               'jugaron', coalesce(j.jugaron, 0),
               'pct', CASE WHEN j.resueltas >= MINIMO THEN round(100.0 * j.aciertos / j.resueltas) END)
             ORDER BY o)
        FROM corazonadas_contenido cc,
             jsonb_array_elements(cc.datos -> 'corazonadas') WITH ORDINALITY AS e(c, o)
        LEFT JOIN LATERAL (
          SELECT count(DISTINCT x.user_id) FILTER (WHERE x.opcion IS NOT NULL) AS jugaron,
                 count(DISTINCT x.user_id) FILTER (WHERE x.acierto IS NOT NULL) AS resueltas,
                 count(DISTINCT x.user_id) FILTER (WHERE x.acierto) AS aciertos
            FROM corazonadas_jugadas x JOIN _ml_lectores y ON y.user_id = x.user_id
           WHERE x.libro_id = p_libro AND x.corazonada = c ->> 'id' AND x.created_at >= v_desde) j ON true
       WHERE cc.libro_id = p_libro),

    -- Anderson: % que armó el perfil y cuántos intentos de media.
    'anderson', (
      SELECT jsonb_agg(jsonb_build_object(
               'texto', coalesce(c ->> 'nombre', c ->> 'corto'),
               'jugaron', coalesce(j.jugaron, 0),
               'pct', CASE WHEN j.jugaron >= MINIMO THEN round(100.0 * j.completos / j.jugaron) END,
               'intentos', CASE WHEN j.jugaron >= MINIMO THEN round(j.intentos::numeric / j.jugaron, 1) END)
             ORDER BY o)
        FROM anderson_contenido ac,
             jsonb_array_elements(ac.datos -> 'personajes') WITH ORDINALITY AS e(c, o)
        LEFT JOIN LATERAL (
          SELECT count(DISTINCT x.user_id) AS jugaron,
                 count(DISTINCT x.user_id) FILTER (WHERE x.resultado = 'acierto') AS completos,
                 count(*) AS intentos
            FROM anderson_jugadas x JOIN _ml_lectores y ON y.user_id = x.user_id
           WHERE x.libro_id = p_libro AND x.personaje = c ->> 'id' AND x.created_at >= v_desde) j ON true
       WHERE ac.libro_id = p_libro),

    -- Mapa del tesoro: % que lo encontró, entre los que buscaron en ese capítulo.
    'mapa', (
      SELECT jsonb_agg(jsonb_build_object(
               'texto', c ->> 'pregunta', 'cap', (c ->> 'cap')::int,
               'jugaron', coalesce(j.jugaron, 0),
               'pct', CASE WHEN j.jugaron >= MINIMO THEN round(100.0 * j.hallaron / j.jugaron) END)
             ORDER BY (c ->> 'cap')::int, o)
        FROM mapa_contenido mc,
             jsonb_array_elements(mc.datos -> 'tesoros') WITH ORDINALITY AS e(c, o)
        LEFT JOIN LATERAL (
          SELECT count(DISTINCT x.user_id) AS jugaron,
                 count(DISTINCT x.user_id) FILTER (WHERE x.acierto AND x.tesoro = c ->> 'id') AS hallaron
            FROM mapa_jugadas x JOIN _ml_lectores y ON y.user_id = x.user_id
           WHERE x.libro_id = p_libro AND x.capitulo = (c ->> 'cap')::int AND x.created_at >= v_desde) j ON true
       WHERE mc.libro_id = p_libro),

    -- Hilo: % que juntó la idea.
    'hilo', (
      SELECT jsonb_agg(jsonb_build_object(
               'texto', coalesce(c ->> 'pregunta', c ->> 'titulo'),
               'jugaron', coalesce(j.jugaron, 0),
               'pct', CASE WHEN j.jugaron >= MINIMO THEN round(100.0 * j.aciertos / j.jugaron) END)
             ORDER BY o)
        FROM hilo_contenido hc,
             jsonb_array_elements(hc.datos -> 'ideas') WITH ORDINALITY AS e(c, o)
        LEFT JOIN LATERAL (
          SELECT count(DISTINCT x.user_id) AS jugaron,
                 count(DISTINCT x.user_id) FILTER (WHERE x.resultado = 'acierto') AS aciertos
            FROM hilo_jugadas x JOIN _ml_lectores y ON y.user_id = x.user_id
           WHERE x.libro_id = p_libro AND x.idea = c ->> 'id' AND x.created_at >= v_desde) j ON true
       WHERE hc.libro_id = p_libro),

    -- Falsificador: % que acertó quién escribió cada párrafo.
    'falsificador', (
      SELECT jsonb_agg(jsonb_build_object(
               'texto', c ->> 'inicio', 'cap', (c ->> 'cap')::int,
               'falso', coalesce((c ->> 'falso')::boolean, false),
               'jugaron', coalesce(j.jugaron, 0),
               'pct', CASE WHEN j.jugaron >= MINIMO THEN round(100.0 * j.aciertos / j.jugaron) END)
             ORDER BY (c ->> 'cap')::int, o)
        FROM falsificador_contenido fc,
             jsonb_array_elements(fc.datos -> 'items') WITH ORDINALITY AS e(c, o)
        LEFT JOIN LATERAL (
          SELECT count(DISTINCT x.user_id) AS jugaron,
                 count(DISTINCT x.user_id) FILTER (WHERE x.acierto) AS aciertos
            FROM falsificador_jugadas x JOIN _ml_lectores y ON y.user_id = x.user_id
           WHERE x.libro_id = p_libro AND x.item = c ->> 'id' AND x.created_at >= v_desde) j ON true
       WHERE fc.libro_id = p_libro),

    -- Cápsula: el lector escribe con sus palabras → solo cuántos.
    'capsula', CASE WHEN EXISTS (SELECT 1 FROM capsula_contenido WHERE libro_id = p_libro) THEN (
      SELECT jsonb_build_object(
               'sellaron', count(*),
               'abrieron', count(*) FILTER (WHERE x.abierta_at IS NOT NULL))
        FROM capsula_respuestas x JOIN _ml_lectores y ON y.user_id = x.user_id
       WHERE x.libro_id = p_libro AND x.sellada_at >= v_desde) END
  ));

  RETURN r;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mis_lectores(uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_lectores(uuid, timestamptz, text) TO authenticated;


-- ── Comprobación rápida (pegar aparte, con sesión de superusuario) ──
--   SELECT mis_lectores('<libro_id>');                       -- todo
--   SELECT mis_lectores('<libro_id>', now() - interval '30 days', 'America/Caracas');
