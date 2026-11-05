-- =============================================================
-- INMERSIA — Migración 084
-- Panel del colegio como la maqueta de octubre (Downloads\Inmersia Escuelas.html)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 083.
--
-- QUÉ CAMBIA (decisiones de Juan, 3 nov 2026)
--   1. Registro de capítulos terminados con su hora (progreso_capitulos_log).
--      Lo llena un trigger sobre progreso_lectura: el lector NO se toca.
--      Sirve para «pasó N capítulos muy rápido»: si entre un capítulo
--      terminado y el siguiente el reloj dice que leyó más de 600 palabras
--      por minuto, no pudo haberlos leído. El reloj cuenta también las
--      pausas, así que nunca acusa de más. Solo desde que corre esta
--      migración; lo de antes queda con el promedio del libro («Muy rápido»).
--   2. Estados por capítulos, como la maqueta: la «meta de hoy» es el
--      capítulo donde debería ir la clase según la fecha meta (lineal por
--      palabras). Al día = en ese capítulo o más adelante; un poco atrás =
--      1 a 3 capítulos detrás; atrasado = 4 o más.
--   3. Salón suma: capítulo de la meta y promedio de la clase, días que
--      faltan, días sin abrir el libro, cuántas predicciones y subrayados
--      hizo cada uno (solo la cantidad, nunca el texto), quiénes van en
--      cada capítulo y los minutos de la clase día a día (28 días).
--   4. Colegio suma: libros terminados, 10 semanas y el libro de cada aula.
--
-- Las mismas reglas de la 083: solo el libro del aula y nada de lo que el
-- alumno escribe. Idempotente. Después: npm run esquema y commit del volcado.
-- =============================================================


-- ── 1. Capítulos terminados, con su hora ─────────────────────
-- Una fila por cada vez que sube progreso_lectura.capitulos_completados
-- (el lector solo lo sube al cerrar el cuaderno del capítulo, nunca lo
-- baja). Si sube de golpe varios, queda una sola fila con el último: la
-- velocidad se mide por tramos entre filas, sumando las palabras de todos
-- los capítulos del tramo.
CREATE TABLE IF NOT EXISTS public.progreso_capitulos_log (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id     uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  capitulo     int         NOT NULL,
  terminado_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, libro_id, capitulo)
);

-- Solo lo leen las funciones del panel (SECURITY DEFINER).
ALTER TABLE public.progreso_capitulos_log ENABLE ROW LEVEL SECURITY;

-- Al crear la fila de progreso (p. ej. el rescate de la muestra) no se
-- anota: no sabemos cuándo se leyó eso.
CREATE OR REPLACE FUNCTION public._log_capitulo_terminado()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.capitulos_completados > coalesce(OLD.capitulos_completados, 0) THEN
    INSERT INTO progreso_capitulos_log (user_id, libro_id, capitulo)
    VALUES (NEW.user_id, NEW.libro_id, NEW.capitulos_completados)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_log_capitulo_terminado ON public.progreso_lectura;
CREATE TRIGGER trg_log_capitulo_terminado
  AFTER UPDATE OF capitulos_completados ON public.progreso_lectura
  FOR EACH ROW EXECUTE FUNCTION public._log_capitulo_terminado();

REVOKE ALL ON FUNCTION public._log_capitulo_terminado() FROM PUBLIC, anon, authenticated;


-- ── 2. La lectura actual del aula y su meta de hoy (uso interno) ──
-- esperado: % del libro (por palabras) que debería llevar hoy la clase.
-- meta_capitulo: el capítulo donde cae ese %. Sin palabras en algún
-- capítulo, se reparte por número de capítulos.
CREATE OR REPLACE FUNCTION public._meta_aula(p_aula uuid, p_zona text)
RETURNS TABLE (
  libro_id        uuid,
  inicio          timestamptz,
  fecha_meta      date,
  total_capitulos int,
  esperado        numeric,
  meta_capitulo   int
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
$fn$;

REVOKE ALL ON FUNCTION public._meta_aula(uuid, text) FROM PUBLIC, anon, authenticated;


-- ── 3. Una fila por alumno con sus números (reemplaza la de la 083) ──
-- Cambian las columnas, así que se borra y se vuelve a crear. salon_aula y
-- resumen_colegio la llaman al ejecutarse, no dependen de su forma.
DROP FUNCTION IF EXISTS public._alumnos_aula(uuid, text);

CREATE FUNCTION public._alumnos_aula(p_aula uuid, p_zona text)
RETURNS TABLE (
  user_id          uuid,
  nombre           text,
  porcentaje       int,
  capitulos_hechos int,
  capitulo_actual  int,
  caps_detras      int,       -- capítulos detrás de la meta de hoy (negativo = adelantado)
  estado           text,      -- 'terminado' | 'al_dia' | 'poco_atras' | 'atrasado' | 'sin_empezar' | NULL (sin libro o sin meta)
  minutos_semana   int,
  dias_semana      int,
  dias_lectura     text,      -- 7 caracteres, del más antiguo a hoy: 'x' leyó, '.' no
  dias_sin_abrir   int,       -- NULL si nunca lo abrió
  ultima_lectura   timestamptz,
  rapido           boolean,   -- promedio del libro > 600 palabras/min
  caps_rapidos     int,       -- capítulos pasados a más de 600 palabras/min de reloj
  predicciones     int,
  subrayados       int
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;

REVOKE ALL ON FUNCTION public._alumnos_aula(uuid, text) FROM PUBLIC, anon, authenticated;


-- ── 4. Salón (reemplaza la de la 083; misma firma) ───────────
CREATE OR REPLACE FUNCTION public.salon_aula(p_aula uuid, p_zona text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;


-- ── 5. Colegio (reemplaza la de la 083; misma firma) ─────────
CREATE OR REPLACE FUNCTION public.resumen_colegio(p_colegio uuid, p_zona text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;

REVOKE ALL ON FUNCTION public.salon_aula(uuid, text)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resumen_colegio(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salon_aula(uuid, text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.resumen_colegio(uuid, text) TO authenticated;


-- =============================================================
-- COMPROBACIÓN
--   1. Terminar un capítulo en el lector (cerrar su cuaderno) y mirar:
--        SELECT * FROM progreso_capitulos_log ORDER BY terminado_at DESC LIMIT 5;
--      → una fila con el capítulo y la hora.
--   2. Admin: SELECT salon_aula('<aula>', 'America/Lima');
--      → lectura con meta_capitulo y dias_restantes; alumnos con estado
--        (al_dia / poco_atras / atrasado…), caps_detras, dias_lectura, dias_sin_abrir,
--        caps_rapidos, predicciones, subrayados; capitulos con nombres;
--        minutos_dia (28).
--   3. Admin: SELECT resumen_colegio('<colegio>', 'America/Lima');
--      → semanas (10) y aulas[] con terminados y libro_id.
-- =============================================================
