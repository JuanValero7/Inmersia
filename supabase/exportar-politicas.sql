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
--      (archivo nuevo; es un retrato de prod, no se ejecuta).
--   4. Repite con el BLOQUE 2 para las tablas que faltan.
--   5. git add + commit.
--
-- Todo lo de acá es de SOLO LECTURA: no modifica nada.
-- =============================================================


-- ── BLOQUE 1 · Todas las políticas RLS de public ──────────────
-- Devuelve sentencias CREATE POLICY listas para pegar.
SELECT
  'CREATE POLICY ' || quote_ident(policyname) || E'\n  ON public.' || tablename
  || CASE WHEN permissive = 'RESTRICTIVE' THEN ' AS RESTRICTIVE' ELSE '' END
  || ' FOR ' || cmd
  || ' TO ' || array_to_string(roles, ', ')
  || COALESCE(E'\n  USING (' || qual || ')', '')
  || COALESCE(E'\n  WITH CHECK (' || with_check || ')', '')
  || ';' AS sentencia
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;


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
