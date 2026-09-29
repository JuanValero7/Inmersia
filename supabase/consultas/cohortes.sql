-- ─────────────────────────────────────────────────────────────
-- RETENCIÓN POR COHORTES
--
-- NO ES UNA MIGRACIÓN. No crea nada, no modifica nada: son dos consultas
-- de solo lectura para pegar en el editor SQL de Supabase cuando quieras
-- mirar cómo va la retención. Viven aquí para no reescribirlas cada vez.
--
-- POR QUÉ ESTO Y NO POSTHOG
-- PostHog está en modo cookieless y su hash de identidad rota cada día, así
-- que un lector que vuelve cuenta como persona nueva cada jornada — el propio
-- comentario de src/lib/analytics.js lo dice. La retención entre días no se
-- puede medir allí. Aquí sí, porque sesiones_lectura guarda un user_id real
-- y estable.
--
-- Y no necesita banner de consentimiento: son datos operativos propios de
-- usuarios con cuenta, ya cubiertos por la política de privacidad. No hay
-- cookies, ni seguimiento entre sitios, ni nada que salga de Supabase.
--
-- AVISO SOBRE EL TAMAÑO DE LA MUESTRA
-- Con cohortes de 8 o 10 personas, que vuelva una más o una menos mueve el
-- porcentaje diez puntos. Sirve para ver la tendencia gruesa entre cohortes,
-- no para afinar decisiones sobre diferencias de pocos puntos.
-- ─────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════
-- 1. LA TABLA DE COHORTES
--
-- La cohorte de cada persona es la semana de su PRIMERA LECTURA, no la de
-- su registro. Mide lo que de verdad importa aquí: de quien empezó a leer,
-- cuántos volvieron.
--
-- CÓMO SE LEE
--   Hacia abajo (comparando cohortes en la misma columna):
--     ¿las cohortes nuevas retienen mejor que las viejas? Si un cambio en
--     el onboarding funcionó, la columna "sem 1 %" sube con el tiempo.
--     Este es el marcador de si lo que haces sirve.
--
--   Hacia la derecha (recorriendo una fila):
--     a qué velocidad se cae un grupo. Si se desploma entre la semana 1 y
--     la 2, el problema es el arranque. Si aguanta y cae en la 4, es que
--     se acaba lo que hay para leer.
--
-- La columna "personas" es el tamaño de la cohorte. Míralo siempre antes
-- que los porcentajes.
-- ═════════════════════════════════════════════════════════════
WITH primera AS (
  SELECT user_id, date_trunc('week', MIN(started_at)) AS cohorte
  FROM sesiones_lectura
  GROUP BY user_id
),
actividad AS (
  -- DISTINCT: alguien que abre el lector cinco veces el martes cuenta una
  -- vez esa semana. Lo que se mide es "volvió", no "cuánto leyó".
  SELECT DISTINCT
    p.cohorte,
    s.user_id,
    (EXTRACT(EPOCH FROM (date_trunc('week', s.started_at) - p.cohorte)) / 604800)::int AS semana
  FROM sesiones_lectura s
  JOIN primera p USING (user_id)
)
SELECT
  cohorte::date,
  COUNT(*) FILTER (WHERE semana = 0) AS personas,
  -- NULLIF evita la división por cero en una cohorte vacía.
  ROUND(100.0 * COUNT(*) FILTER (WHERE semana = 1)
        / NULLIF(COUNT(*) FILTER (WHERE semana = 0), 0)) AS "sem 1 %",
  ROUND(100.0 * COUNT(*) FILTER (WHERE semana = 2)
        / NULLIF(COUNT(*) FILTER (WHERE semana = 0), 0)) AS "sem 2 %",
  ROUND(100.0 * COUNT(*) FILTER (WHERE semana = 3)
        / NULLIF(COUNT(*) FILTER (WHERE semana = 0), 0)) AS "sem 3 %",
  ROUND(100.0 * COUNT(*) FILTER (WHERE semana = 4)
        / NULLIF(COUNT(*) FILTER (WHERE semana = 0), 0)) AS "sem 4 %"
FROM actividad
GROUP BY cohorte
ORDER BY cohorte;


-- ═════════════════════════════════════════════════════════════
-- 2. LOS QUE SE REGISTRARON Y NUNCA LEYERON
--
-- La consulta de arriba ancla en la primera lectura, así que esta gente
-- queda fuera de ella en silencio. Para el público de Inmersia —personas a
-- las que leer les cuesta— es justo el grupo que más dice: quisieron leer
-- más y no llegaron ni a abrir un libro.
--
-- Si este número es alto, el problema no está en el contenido ni en la
-- retención: está entre el registro y la primera página.
-- ═════════════════════════════════════════════════════════════
SELECT
  COUNT(*)                                  AS registrados,
  COUNT(*) FILTER (WHERE s.user_id IS NULL) AS nunca_leyeron,
  ROUND(100.0 * COUNT(*) FILTER (WHERE s.user_id IS NULL) / NULLIF(COUNT(*), 0)) AS "% nunca leyeron"
FROM auth.users u
LEFT JOIN (SELECT DISTINCT user_id FROM sesiones_lectura) s ON s.user_id = u.id;
