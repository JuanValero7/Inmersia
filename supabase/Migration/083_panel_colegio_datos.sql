-- =============================================================
-- INMERSIA — Migración 083
-- Datos de lectura del panel del colegio: Salón (un aula) y Colegio (todo)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 081.
--
-- QUÉ VE EL PANEL (decisiones de Juan, 3 nov 2026)
--   Salón (administración y el profesor del aula), sobre la lectura actual:
--     · por alumno: % del libro, capítulo, si va al día con la fecha meta,
--       minutos y días con lectura en los últimos 7 días, «muy rápido».
--     · cuántos alumnos van por cada capítulo.
--     · los párrafos más subrayados por 3 alumnos o más, sin decir quién.
--   Colegio (solo administración): lo mismo sumado por aula, con los
--     profesores de cada una, y las horas de lectura de las últimas 8 semanas.
--
-- REGLAS
--   · Solo cuenta el libro del aula: el tiempo y los días salen de las
--     sesiones de los libros que el aula leyó (comunidad_lecturas). Lo que
--     un alumno lee por su cuenta no aparece.
--   · Nunca lo que el alumno escribe (notas, comentarios, mensajitos,
--     predicciones) ni la frase exacta que subrayó: del subrayado solo se
--     usa el párrafo, y solo si lo marcaron 3 o más.
--   · Al día: lo esperado hoy es lineal entre el inicio de la lectura y el
--     fin del día de la fecha meta. Al día = hasta 10 puntos por debajo.
--     Sin fecha meta no hay «al día» ni «atrasado».
--   · Muy rápido: más de 600 palabras por minuto de media en el libro, con
--     al menos 2.000 palabras leídas (con menos, el número no dice nada).
--   · Duración de una sesión: segundos_activos; las filas antiguas sin él,
--     fin − inicio con tope de 2 horas (igual que useReadingStats.js).
--   · p_zona: la zona horaria del navegador de quien mira, para que «hoy» y
--     los días de la semana sean los suyos. Si no es válida, UTC.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ── 1. Una fila por alumno del aula con sus números (uso interno) ──
CREATE OR REPLACE FUNCTION public._alumnos_aula(p_aula uuid, p_zona text)
RETURNS TABLE (
  user_id         uuid,
  nombre          text,
  porcentaje      int,
  capitulos_hechos int,
  estado          text,      -- 'terminado' | 'al_dia' | 'atrasado' | 'sin_empezar' | NULL (sin meta)
  minutos_semana  int,
  dias_semana     int,
  ultima_lectura  timestamptz,
  rapido          boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH lec AS (
    SELECT cl.libro_id, cl.inicio, cl.fecha_meta
    FROM comunidad_lecturas cl
    WHERE cl.comunidad_id = p_aula AND cl.fin IS NULL
    LIMIT 1
  ),
  esperado AS (
    SELECT CASE WHEN lec.fecha_meta IS NULL THEN NULL ELSE
      100 * greatest(0, least(1,
        extract(epoch FROM now() - lec.inicio)
        / nullif(extract(epoch FROM ((lec.fecha_meta + 1)::timestamp AT TIME ZONE p_zona) - lec.inicio), 0)
      ))
    END AS pct
    FROM lec
  ),
  palabras AS (
    SELECT sum(c.palabras)::numeric AS total FROM capitulos c JOIN lec ON c.libro_id = lec.libro_id
  ),
  ses AS (
    SELECT s.user_id, s.started_at,
           coalesce(s.segundos_activos,
                    CASE WHEN s.ended_at IS NULL THEN 0
                         ELSE least(extract(epoch FROM s.ended_at - s.started_at), 7200) END) AS seg
    FROM sesiones_lectura s JOIN lec ON s.libro_id = lec.libro_id
    WHERE s.user_id IN (SELECT m.user_id FROM comunidad_miembros m WHERE m.comunidad_id = p_aula AND m.rol = 'miembro')
  )
  SELECT
    m.user_id,
    coalesce(m.nombre_en_aula, nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Lector'),
    coalesce(pl.porcentaje, 0)::int,
    coalesce(pl.capitulos_completados, 0)::int,
    CASE
      WHEN (SELECT libro_id FROM lec) IS NULL THEN NULL
      WHEN coalesce(pl.porcentaje, 0) >= 100 THEN 'terminado'
      WHEN coalesce(pl.porcentaje, 0) = 0 AND tot.seg_total IS NULL THEN 'sin_empezar'
      WHEN (SELECT pct FROM esperado) IS NULL THEN NULL
      WHEN coalesce(pl.porcentaje, 0) >= (SELECT pct FROM esperado) - 10 THEN 'al_dia'
      ELSE 'atrasado'
    END,
    coalesce(sem.seg, 0)::int / 60,
    coalesce(sem.dias, 0)::int,
    tot.ultima,
    -- Sin sesiones (p. ej. avance rescatado de la muestra) no hay velocidad.
    coalesce(
      tot.seg_total > 0
      AND (SELECT total FROM palabras) * pl.porcentaje / 100 >= 2000
      AND (SELECT total FROM palabras) * pl.porcentaje / 100 / greatest(tot.seg_total / 60, 1) > 600,
      false)
  FROM comunidad_miembros m
  LEFT JOIN perfiles pf ON pf.id = m.user_id
  LEFT JOIN progreso_lectura pl ON pl.user_id = m.user_id AND pl.libro_id = (SELECT libro_id FROM lec)
  LEFT JOIN LATERAL (
    SELECT sum(ses.seg) AS seg_total, max(ses.started_at) AS ultima
    FROM ses WHERE ses.user_id = m.user_id
  ) tot ON true
  LEFT JOIN LATERAL (
    SELECT sum(ses.seg) AS seg, count(DISTINCT (ses.started_at AT TIME ZONE p_zona)::date) AS dias
    FROM ses WHERE ses.user_id = m.user_id AND ses.started_at >= now() - interval '7 days'
  ) sem ON true
  WHERE m.comunidad_id = p_aula AND m.rol = 'miembro';
$fn$;

CREATE OR REPLACE FUNCTION public._zona_valida(p_zona text)
RETURNS text
LANGUAGE sql STABLE
AS $fn$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_zona) THEN p_zona ELSE 'UTC' END;
$fn$;

REVOKE ALL ON FUNCTION public._alumnos_aula(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._zona_valida(text)        FROM PUBLIC, anon, authenticated;


-- ── 2. Salón: un aula (administración o su profesor) ──────────
CREATE OR REPLACE FUNCTION public.salon_aula(p_aula uuid, p_zona text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_zona  text := _zona_valida(p_zona);
  v_aula  comunidades%ROWTYPE;
  v_lec   record;
  v_esperado numeric;
BEGIN
  SELECT * INTO v_aula FROM comunidades WHERE id = p_aula AND colegio_id IS NOT NULL;
  IF NOT FOUND OR NOT (es_admin_de_aula(p_aula) OR es_moderador(p_aula)) THEN
    RAISE EXCEPTION 'Solo el colegio ve los datos de esta aula.' USING ERRCODE = '42501';
  END IF;

  SELECT cl.libro_id, cl.inicio, cl.fecha_meta, l.titulo, l.portada_url,
         (SELECT count(*) FROM capitulos c WHERE c.libro_id = cl.libro_id) AS total_capitulos
  INTO v_lec
  FROM comunidad_lecturas cl JOIN libros l ON l.id = cl.libro_id
  WHERE cl.comunidad_id = p_aula AND cl.fin IS NULL
  LIMIT 1;

  IF v_lec.fecha_meta IS NOT NULL THEN
    v_esperado := 100 * greatest(0, least(1,
      extract(epoch FROM now() - v_lec.inicio)
      / nullif(extract(epoch FROM ((v_lec.fecha_meta + 1)::timestamp AT TIME ZONE v_zona) - v_lec.inicio), 0)));
  END IF;

  RETURN jsonb_build_object(
    'aula', jsonb_build_object('id', v_aula.id, 'nombre', v_aula.nombre),
    'lectura', CASE WHEN v_lec.libro_id IS NULL THEN NULL ELSE jsonb_build_object(
      'libro_id', v_lec.libro_id, 'titulo', v_lec.titulo, 'portada', v_lec.portada_url,
      'inicio', v_lec.inicio, 'fecha_meta', v_lec.fecha_meta,
      'total_capitulos', v_lec.total_capitulos, 'esperado', round(v_esperado)) END,
    'alumnos', coalesce((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.nombre) FROM _alumnos_aula(p_aula, v_zona) a), '[]'::jsonb),
    -- Capítulo en el que está cada uno (el siguiente al último terminado).
    'capitulos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('numero', x.numero, 'alumnos', x.n) ORDER BY x.numero)
      FROM (
        SELECT least(a.capitulos_hechos + 1, greatest(v_lec.total_capitulos, 1)) AS numero, count(*) AS n
        FROM _alumnos_aula(p_aula, v_zona) a
        WHERE v_lec.libro_id IS NOT NULL AND a.porcentaje > 0
        GROUP BY 1
      ) x), '[]'::jsonb),
    -- Párrafos que subrayaron 3 o más alumnos del aula. El texto es el del
    -- libro (parrafos.contenido), nunca la selección de nadie.
    'subrayados', coalesce((
      SELECT jsonb_agg(jsonb_build_object('capitulo', y.capitulo, 'texto', y.texto, 'alumnos', y.n) ORDER BY y.n DESC, y.capitulo)
      FROM (
        SELECT c.numero AS capitulo, left(p.contenido, 280) AS texto, count(DISTINCT su.user_id) AS n
        FROM subrayados_usuario su
        JOIN parrafos p  ON p.id = su.parrafo_id
        JOIN capitulos c ON c.id = p.capitulo_id
        WHERE su.libro_id = v_lec.libro_id
          AND su.user_id IN (SELECT m.user_id FROM comunidad_miembros m WHERE m.comunidad_id = p_aula AND m.rol = 'miembro')
        GROUP BY c.numero, p.id, p.contenido
        HAVING count(DISTINCT su.user_id) >= 3
        ORDER BY count(DISTINCT su.user_id) DESC, c.numero
        LIMIT 5
      ) y), '[]'::jsonb)
  );
END;
$fn$;


-- ── 3. Colegio: todas las aulas (solo administración) ─────────
CREATE OR REPLACE FUNCTION public.resumen_colegio(p_colegio uuid, p_zona text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_zona text := _zona_valida(p_zona);
  v_lunes date := date_trunc('week', (now() AT TIME ZONE v_zona))::date;
BEGIN
  IF NOT es_admin_colegio(p_colegio) THEN
    RAISE EXCEPTION 'Solo la administración del colegio ve este resumen.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'semanas', (SELECT jsonb_agg(to_char(v_lunes - 7 * i, 'YYYY-MM-DD') ORDER BY i DESC) FROM generate_series(0, 7) i),
    'aulas', coalesce((
      SELECT jsonb_agg(fila ORDER BY co.grado, co.seccion NULLS FIRST, co.nombre)
      FROM comunidades co
      -- Los números de los alumnos, una sola vez por aula.
      CROSS JOIN LATERAL (
        SELECT count(*)                                                   AS alumnos,
               count(*) FILTER (WHERE a.estado IN ('al_dia', 'terminado')) AS al_dia,
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
          'libro', (SELECT l.titulo FROM comunidad_lecturas cl JOIN libros l ON l.id = cl.libro_id
                    WHERE cl.comunidad_id = co.id AND cl.fin IS NULL LIMIT 1),
          'alumnos',         st.alumnos,
          'al_dia',          st.al_dia,
          'atrasados',       st.atrasados,
          'sin_empezar',     st.sin_empezar,
          'con_meta',        st.con_meta,
          'avance_promedio', st.avance_promedio,
          'minutos_semana',  st.minutos_semana,
          'activos_semana',  st.activos_semana,
          -- Minutos por semana (lunes a domingo) en los libros del aula, las
          -- últimas 8, de la más antigua a la actual.
          'minutos_por_semana', (
            SELECT jsonb_agg(coalesce(w.minutos, 0) ORDER BY i DESC)
            FROM generate_series(0, 7) i
            LEFT JOIN (
              SELECT date_trunc('week', s.started_at AT TIME ZONE v_zona)::date AS lunes,
                     sum(coalesce(s.segundos_activos,
                         CASE WHEN s.ended_at IS NULL THEN 0
                              ELSE least(extract(epoch FROM s.ended_at - s.started_at), 7200) END))::int / 60 AS minutos
              FROM sesiones_lectura s
              WHERE s.user_id IN (SELECT m.user_id FROM comunidad_miembros m WHERE m.comunidad_id = co.id AND m.rol = 'miembro')
                AND s.libro_id IN (SELECT cl.libro_id FROM comunidad_lecturas cl WHERE cl.comunidad_id = co.id)
                AND s.started_at >= (v_lunes - 49)::timestamp AT TIME ZONE v_zona
              GROUP BY 1
            ) w ON w.lunes = v_lunes - 7 * i)
        ) AS fila
      ) f
      WHERE co.colegio_id = p_colegio), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.salon_aula(uuid, text)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resumen_colegio(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salon_aula(uuid, text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.resumen_colegio(uuid, text) TO authenticated;


-- =============================================================
-- COMPROBACIÓN (con el colegio de prueba de la 081)
--   1. Admin: SELECT salon_aula('<aula>', 'America/Lima');
--      → aula, lectura (o null si el aula no tiene libro), alumnos[],
--        capitulos[], subrayados[].
--   2. Profesor de otra aula: el mismo SELECT → 'Solo el colegio ve…'.
--   3. Alumno: el mismo SELECT → mismo error.
--   4. Admin: SELECT resumen_colegio('<colegio>', 'America/Lima');
--      → semanas (8 lunes) y aulas[] con sus números.
--   5. Profesor: resumen_colegio → 'Solo la administración…'.
-- =============================================================
