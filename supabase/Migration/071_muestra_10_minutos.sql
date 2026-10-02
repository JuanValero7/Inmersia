-- =============================================================
-- INMERSIA — Migración 071
-- La muestra pasa de «2 capítulos» a «los primeros 10 minutos»
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA
-- La muestra (invitados, y usuarios que abren un libro que no tienen)
-- eran los capítulos 1 y 2. Con capítulos de largo muy distinto eso da
-- muestras absurdas: El banquete es UN capítulo de 96 minutos, Los
-- crímenes de la calle Morgue 58, y El Principito se queda en 2 minutos.
-- En 13 libros el capítulo 1 solo ya pasa de 10 minutos, así que no se
-- puede arreglar contando capítulos enteros.
--
-- SOLUCIÓN
-- La muestra son los primeros párrafos del libro, en orden, hasta sumar
-- 2300 palabras (10 minutos a 230 palabras por minuto, la velocidad de
-- PALABRAS_POR_MINUTO en src/utils/formato.js; si cambia una, cambiar
-- las dos). Se corta al final de un párrafo, nunca a la mitad:
--   · capítulos cortos → entran varios enteros (El Principito: ~10 min)
--   · capítulo 1 largo → se corta dentro de él
--   · el primer párrafo entra siempre, aunque solo él pase del tope
-- Las palabras se cuentan con contar_palabras() de la 062, igual que
-- capitulos.palabras (los separadores no cuentan).
--
-- CÓMO
--   · parrafos.en_muestra y capitulos.en_muestra (el capítulo tiene al
--     menos un párrafo de muestra). Las calcula recalcular_muestra().
--   · Se mantienen solas: triggers por sentencia sobre `parrafos`, como
--     los de palabras de la 062. Cargar, editar o borrar párrafos
--     recalcula la muestra de esos libros. Renumerar capítulos sin tocar
--     sus párrafos NO la recalcula: en ese caso, correr a mano
--       SELECT recalcular_muestra(ARRAY[<libro_id>]::uuid[]);
--   · Las 4 políticas que decían «numero <= 2» pasan a «en_muestra».
--     Son las de producción tal como salieron del volcado del 2 oct
--     (supabase/esquema/02-esquema.sql), solo cambia esa condición.
--
-- ORDEN DE DESPLIEGUE: esta migración ANTES de subir el código nuevo
-- (el lector nuevo pide la columna en_muestra). El código viejo sigue
-- funcionando con ella: recorta a 2 capítulos lo que la RLS deja ver.
-- Después de correrla: npm run esquema y commit del volcado.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

-- ── 1. Columnas ──────────────────────────────────────────────
ALTER TABLE parrafos  ADD COLUMN IF NOT EXISTS en_muestra BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE capitulos ADD COLUMN IF NOT EXISTS en_muestra BOOLEAN NOT NULL DEFAULT false;


-- ── 2. Cálculo ───────────────────────────────────────────────
-- Solo escribe las filas que cambian (IS DISTINCT FROM): así una
-- recarga que no mueve la muestra no toca nada, y el UPDATE sobre
-- parrafos no dispara de más los triggers de palabras de la 062.
CREATE OR REPLACE FUNCTION recalcular_muestra(libro_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Solo la usan los triggers y quien la corra a mano en el SQL Editor.
REVOKE EXECUTE ON FUNCTION recalcular_muestra(UUID[]) FROM PUBLIC, anon, authenticated;


-- ── 3. Triggers ──────────────────────────────────────────────
-- Por sentencia, como los de la 062: una carga de 300 párrafos recalcula
-- el libro una vez, no 300. recalcular_muestra() hace a su vez un UPDATE
-- sobre parrafos, que volvería a disparar estos triggers: por eso salen
-- en cuanto pg_trigger_depth() > 1.
CREATE OR REPLACE FUNCTION trg_muestra_insert() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  PERFORM recalcular_muestra(ARRAY(SELECT DISTINCT libro_id FROM nuevos));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION trg_muestra_update() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  PERFORM recalcular_muestra(ARRAY(
    SELECT libro_id FROM nuevos UNION SELECT libro_id FROM viejos));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION trg_muestra_delete() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  PERFORM recalcular_muestra(ARRAY(SELECT DISTINCT libro_id FROM viejos));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_parrafos_muestra_ins ON parrafos;
DROP TRIGGER IF EXISTS trg_parrafos_muestra_upd ON parrafos;
DROP TRIGGER IF EXISTS trg_parrafos_muestra_del ON parrafos;

CREATE TRIGGER trg_parrafos_muestra_ins AFTER INSERT ON parrafos
  REFERENCING NEW TABLE AS nuevos
  FOR EACH STATEMENT EXECUTE FUNCTION trg_muestra_insert();

CREATE TRIGGER trg_parrafos_muestra_upd AFTER UPDATE ON parrafos
  REFERENCING NEW TABLE AS nuevos OLD TABLE AS viejos
  FOR EACH STATEMENT EXECUTE FUNCTION trg_muestra_update();

CREATE TRIGGER trg_parrafos_muestra_del AFTER DELETE ON parrafos
  REFERENCING OLD TABLE AS viejos
  FOR EACH STATEMENT EXECUTE FUNCTION trg_muestra_delete();


-- ── 4. Relleno de lo que ya está cargado ─────────────────────
SELECT recalcular_muestra(ARRAY(SELECT id FROM libros));


-- ── 5. Políticas ─────────────────────────────────────────────
-- Invitados (anon): solo lo que está en la muestra.
DROP POLICY IF EXISTS capitulos_guest_preview ON public.capitulos;
CREATE POLICY capitulos_guest_preview
  ON public.capitulos FOR SELECT TO anon
  USING (en_muestra);

DROP POLICY IF EXISTS parrafos_guest_preview ON public.parrafos;
CREATE POLICY parrafos_guest_preview
  ON public.parrafos FOR SELECT TO anon
  USING (en_muestra);

-- Con sesión: la muestra, el libro entero si está en su biblioteca, o
-- todo si es superusuario (igual que la 037, cambiando solo la muestra).
DROP POLICY IF EXISTS capitulos_select ON public.capitulos;
CREATE POLICY capitulos_select
  ON public.capitulos FOR SELECT TO authenticated
  USING (
    en_muestra
    OR EXISTS (
      SELECT 1 FROM public.bibliotecas_usuarios bu
      WHERE bu.user_id = (SELECT auth.uid())
        AND bu.libro_id = capitulos.libro_id
    )
    OR EXISTS (
      SELECT 1 FROM public.superusuarios s
      WHERE s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS parrafos_select ON public.parrafos;
CREATE POLICY parrafos_select
  ON public.parrafos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bibliotecas_usuarios bu
      WHERE bu.user_id = (SELECT auth.uid())
        AND bu.libro_id = parrafos.libro_id
    )
    OR EXISTS (
      SELECT 1 FROM public.superusuarios s
      WHERE s.user_id = (SELECT auth.uid())
    )
    OR en_muestra
  );


-- =============================================================
-- VERIFICACIÓN (ejecutar después)
--
-- 1) Minutos de muestra por libro. Todos deberían estar cerca de 10 y
--    nunca por encima, salvo un libro cuyo PRIMER párrafo ya pase de
--    2300 palabras (raro). Un libro más corto que 10 minutos entra entero.
--
--   SELECT l.titulo,
--          count(DISTINCT p.capitulo_id) AS capitulos,
--          sum(CASE WHEN p.tipo = 'separador' THEN 0 ELSE contar_palabras(p.contenido) END) AS palabras,
--          round(sum(CASE WHEN p.tipo = 'separador' THEN 0 ELSE contar_palabras(p.contenido) END) / 230.0, 1) AS minutos
--   FROM libros l JOIN parrafos p ON p.libro_id = l.id AND p.en_muestra
--   GROUP BY l.titulo
--   ORDER BY minutos;
--
-- 2) Ningún capítulo marcado sin párrafos de muestra (debe dar 0):
--
--   SELECT count(*) FROM capitulos c
--   WHERE c.en_muestra
--     AND NOT EXISTS (SELECT 1 FROM parrafos p WHERE p.capitulo_id = c.id AND p.en_muestra);
-- =============================================================
