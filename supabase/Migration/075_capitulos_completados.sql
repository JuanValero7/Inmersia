-- =============================================================
-- INMERSIA — Migración 075
-- Progreso: el % por palabras y los capítulos completados, por separado
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA
-- `progreso_lectura.porcentaje` significaba dos cosas: el lector lo
-- guardaba por capítulos (5 de 20 = 25 %) y el rescate de la muestra por
-- palabras. Dentro del lector, el "% del libro" se calcula por palabras,
-- así que la Biblioteca y el lector enseñaban porcentajes distintos. Y la
-- Cartelera lo leía como capítulos para desbloquear fichas.
--
-- SOLUCIÓN (decisión de Juan, 10 oct 2026)
--   · porcentaje            = % del libro POR PALABRAS. Es lo que se le
--                             enseña al usuario (Biblioteca, comunidad).
--   · capitulos_completados = capítulos terminados. Es lo que desbloquea
--                             contenido (Cartelera, Álbum, Investigación,
--                             «Anteriormente en…»).
-- Relleno de las filas existentes, solo al crear la columna:
--   1. capitulos_completados sale del porcentaje con la misma fórmula que
--      usaba la Cartelera (round(pct/100 × total)), así nadie ve ni más ni
--      menos fichas que antes.
--   2. porcentaje se recalcula por palabras a partir de esos capítulos. El
--      100 % se queda en 100. Si a algún capítulo del libro le faltan las
--      palabras, o no hay capítulos completos, se deja como estaba.
--
-- ORDEN DE DESPLIEGUE: correr esto y desplegar el código justo después.
-- Mientras tanto, el código viejo sigue funcionando (no conoce la columna);
-- lo que guarde en esos minutos se corrige al pasar el siguiente capítulo.
--
-- QUÉ NO CAMBIA
--   · progreso_comunidad() sigue leyendo porcentaje: ahora es por palabras,
--     igual que lo que ve cada uno en el lector.
--   · Políticas: la columna nueva la cubren las de la tabla.
--
-- Después de correrla: npm run esquema y commit del volcado.
-- Idempotente: el relleno solo corre la vez que se crea la columna.
-- =============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'progreso_lectura'
      AND column_name = 'capitulos_completados'
  ) THEN
    RAISE NOTICE '075 ya aplicada: no se rellena otra vez.';
    RETURN;
  END IF;

  ALTER TABLE progreso_lectura
    ADD COLUMN capitulos_completados integer NOT NULL DEFAULT 0
    CONSTRAINT progreso_lectura_capitulos_completados_check CHECK (capitulos_completados >= 0);

  COMMENT ON COLUMN progreso_lectura.capitulos_completados IS
    'Capítulos terminados. Desbloquea la Cartelera, el Álbum y el repaso. El % que ve el usuario es `porcentaje` (por palabras). Ver migración 075.';
  COMMENT ON COLUMN progreso_lectura.porcentaje IS
    '% del libro por palabras, para mostrar. Lo que desbloquea contenido es capitulos_completados. Ver migración 075.';

  -- 1. Capítulos completados, con la fórmula que usaba la Cartelera.
  UPDATE progreso_lectura pl
  SET capitulos_completados = LEAST(t.total, round(pl.porcentaje::numeric / 100 * t.total)::int)
  FROM (SELECT libro_id, count(*)::int AS total FROM capitulos GROUP BY libro_id) t
  WHERE t.libro_id = pl.libro_id AND pl.porcentaje > 0;

  -- 2. Porcentaje por palabras a partir de esos capítulos.
  UPDATE progreso_lectura pl
  SET porcentaje = LEAST(100, round(a.acumuladas::numeric / a.total_palabras * 100))::smallint
  FROM (
    SELECT libro_id,
           row_number() OVER w AS orden,
           sum(palabras) OVER w AS acumuladas,
           sum(palabras) OVER (PARTITION BY libro_id) AS total_palabras,
           bool_and(coalesce(palabras, 0) > 0) OVER (PARTITION BY libro_id) AS completas
    FROM capitulos
    WINDOW w AS (PARTITION BY libro_id ORDER BY numero ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
  ) a
  WHERE a.libro_id = pl.libro_id
    AND a.orden = pl.capitulos_completados
    AND a.completas
    AND pl.porcentaje < 100;
END;
$$;
