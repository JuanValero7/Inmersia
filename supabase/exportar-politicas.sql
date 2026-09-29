-- =============================================================
-- INMERSIA — Exportar el estado REAL de producción al repo
--
-- Por qué existe: producción tiene políticas RLS que NO están en
-- supabase/Migration/ (por ejemplo el límite de 2 capítulos para
-- invitados, que funciona en prod pero no aparece en ninguna
-- migración). Y hay tres tablas que la app usa y que tampoco
-- tienen migración: perfiles, bibliotecas_usuarios y
-- categorias_usuario.
--
-- Mientras eso siga así no se puede auditar lo que está publicado
-- ni reconstruirlo si algo se rompe.
--
-- CÓMO USARLO
--   1. Supabase Dashboard → SQL Editor → New query.
--   2. Ejecuta el BLOQUE 1. Copia la columna de resultados entera.
--   3. Pégala en supabase/Migration/000_politicas_actuales.sql
--      (es un retrato de prod, no se ejecuta) Y, si quieres una
--      migración ejecutable, en un archivo nuevo 0NN_politicas_base.sql.
--   4. Repite con el BLOQUE 2 para las tablas que faltan.
--   5. git add + commit.
--
-- Todo lo de acá es de SOLO LECTURA: no modifica nada.
--
--
-- ⚠️⚠️ LO ÚNICO QUE NO SE PUEDE HACER NUNCA ⚠️⚠️
--
-- NO construyas una migración de políticas copiando el contenido de
-- 000_politicas_actuales.sql. Ese archivo es una FOTO CON FECHA, y las
-- migraciones posteriores cambian políticas que ya aparecían en ella.
-- Ejecutar la foto revierte esos cambios en silencio.
--
-- Comprobado el 2026-09-29 contra la foto del 2026-08-31: al menos tres
-- políticas habrían retrocedido, y las tres abren agujeros reales:
--
--   capitulos_select  ·  la foto dice USING (true). La migración 037 la
--   parrafos_select      cerró a "capítulos 1-2 o libro en su biblioteca".
--                        Revertirlas deja que cualquier usuario registrado
--                        lea TODOS los libros completos.
--
--   subrayados_select ·  la foto dice USING (true). La migración 040 la
--                        cerró a auth.uid() = user_id. Revertirla deja que
--                        cualquiera lea los subrayados de los demás, que
--                        son datos personales (ver la migración 043, RGPD).
--
-- La migración SIEMPRE se genera con el BLOQUE 1 de aquí, que lee el estado
-- VIVO del catálogo. Eso no puede quedarse viejo: lo que sale es lo que hay.
-- =============================================================


-- ── BLOQUE 1 · Todas las políticas RLS de public ──────────────
-- Devuelve, por cada política, su DROP + su CREATE. Así lo que copias es
-- idempotente: se puede ejecutar dos veces seguidas sin error, que es lo que
-- hace falta para poder reconstruir producción o levantar un entorno nuevo.
--
-- El DROP va delante del CREATE a propósito: sin él, ejecutar el archivo en
-- una base que ya tiene las políticas falla en la primera y deja el resto sin
-- aplicar, que es el peor momento para pararse.
SELECT
  'DROP POLICY IF EXISTS ' || quote_ident(policyname)
  || ' ON public.' || quote_ident(tablename) || ';' || E'\n'
  || 'CREATE POLICY ' || quote_ident(policyname)
  || E'\n  ON public.' || quote_ident(tablename)
  || CASE WHEN permissive = 'RESTRICTIVE' THEN ' AS RESTRICTIVE' ELSE '' END
  || ' FOR ' || cmd
  || ' TO ' || array_to_string(roles, ', ')
  || COALESCE(E'\n  USING (' || qual || ')', '')
  || COALESCE(E'\n  WITH CHECK (' || with_check || ')', '')
  || ';' || E'\n' AS sentencia
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;


-- ── BLOQUE 1b · Cuántas hay, para cotejar ─────────────────────
-- El plan de trabajo hablaba de "128 políticas". Ese número salía de sumar
-- los CREATE POLICY de todos los archivos del repo, que cuenta varias veces
-- la misma política (creada en una migración y recreada en otra posterior).
-- Esto devuelve las que hay DE VERDAD en producción.
SELECT count(*) AS politicas_en_produccion
FROM pg_policies WHERE schemaname = 'public';


-- ── BLOQUE 2 · Columnas de las tablas sin migración ───────────
SELECT
  table_name,
  ordinal_position AS pos,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('perfiles', 'bibliotecas_usuarios', 'categorias_usuario')
ORDER BY table_name, ordinal_position;


-- ── BLOQUE 3 · Claves, únicos y checks de esas tablas ─────────
SELECT
  rel.relname   AS tabla,
  con.conname   AS restriccion,
  CASE con.contype WHEN 'p' THEN 'PRIMARY KEY'
                   WHEN 'f' THEN 'FOREIGN KEY'
                   WHEN 'u' THEN 'UNIQUE'
                   WHEN 'c' THEN 'CHECK' END AS tipo,
  pg_get_constraintdef(con.oid) AS definicion
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = 'public'
  AND rel.relname IN ('perfiles', 'bibliotecas_usuarios', 'categorias_usuario')
ORDER BY rel.relname, con.contype;


-- ── BLOQUE 4 · Comprobación: ¿qué tablas quedaron sin RLS? ────
-- Debe devolver CERO filas. Cualquier fila acá es una tabla abierta.
SELECT relname AS tabla_sin_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY relname;
