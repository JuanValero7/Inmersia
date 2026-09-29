-- =============================================================
-- INMERSIA — Mapa de la base de datos
--
-- Genera el contenido de Documentation/mapa-bd.md: todas las tablas con sus
-- columnas, su estado de RLS, cuántas políticas tienen, y un diagrama Mermaid
-- de las relaciones que GitHub renderiza solo.
--
-- CÓMO USARLO
--   1. Supabase Dashboard → SQL Editor → New query.
--   2. Ejecuta el BLOQUE 1. Copia la única celda del resultado.
--   3. Pégala en Documentation/mapa-bd.md, reemplazando el archivo entero.
--   4. Ejecuta el BLOQUE 2 y pega su celda al final del mismo archivo.
--   5. git add + commit.
--
-- Todo es de SOLO LECTURA.
--
--
-- POR QUÉ ES SQL Y NO UN SCRIPT DE NODE
-- El plan de trabajo pedía un scripts/generar-mapa-bd.mjs que leyera pg_class
-- con VITE_SUPABASE_ANON_KEY. Eso NO puede funcionar, y no es cuestión de
-- permisos: pg_class y pg_policies viven en el esquema pg_catalog, y PostgREST
-- solo expone `public`. Cualquier clave —anon o service_role— recibe un 404.
-- Comprobado el 2026-09-29.
--
-- Las alternativas para automatizarlo eran dos, y ninguna compensa:
--   · Una función security definer en public, llamable por RPC. Expondría la
--     estructura del esquema a cualquiera que tenga la clave anon, que va
--     dentro del bundle publicado. Es rebajar la seguridad para ahorrar dos
--     copiar-y-pegar al año.
--   · Conectarse a Postgres directo con la contraseña de la base. Es meter la
--     credencial más sensible del proyecto en el entorno de desarrollo para
--     generar un documento.
--
-- Así que esto: el SQL hace el trabajo y devuelve el markdown ya montado.
-- =============================================================


-- ── BLOQUE 1 · Tablas, columnas y estado de RLS ───────────────
WITH columnas AS (
  SELECT
    c.relname AS tabla,
    c.relrowsecurity AS rls,
    (SELECT count(*) FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS politicas,
    string_agg(
      '| `' || a.attname || '` | `' || format_type(a.atttypid, a.atttypmod) || '` | '
      || CASE WHEN a.attnotnull THEN 'no' ELSE 'sí' END || ' |',
      E'\n' ORDER BY a.attnum) AS filas
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  GROUP BY c.relname, c.relrowsecurity
)
SELECT
  '# Mapa de la base de datos' || E'\n\n'
  || '> Generado con `supabase/consultas/mapa-bd.sql` el '
  || to_char(now(), 'YYYY-MM-DD') || '.' || E'\n'
  || '> No lo edites a mano: vuelve a ejecutar la consulta y reemplázalo entero.'
  || E'\n\n'
  || '**' || count(*) || ' tablas** · **'
  || sum(politicas) || ' políticas RLS**'
  || CASE WHEN count(*) FILTER (WHERE NOT rls) > 0
          THEN ' · ⚠️ **' || count(*) FILTER (WHERE NOT rls) || ' tabla(s) SIN RLS**'
          ELSE ' · todas las tablas con RLS activo ✅' END
  || E'\n\n'
  || string_agg(
       '## `' || tabla || '`' || E'\n\n'
       || CASE WHEN rls
               THEN 'RLS activo · ' || politicas || ' política(s)'
               ELSE '⚠️ **RLS DESACTIVADO** — esta tabla está abierta' END
       || E'\n\n'
       || '| columna | tipo | nulable |' || E'\n'
       || '|---|---|---|' || E'\n'
       || filas,
       E'\n\n' ORDER BY tabla)
  AS mapa_markdown
FROM columnas;


-- ── BLOQUE 2 · Diagrama Mermaid de las relaciones ─────────────
-- GitHub renderiza los bloques ```mermaid sin plugins.
WITH fks AS (
  SELECT DISTINCT
    src.relname AS tabla,
    dst.relname AS apunta_a,
    a.attname   AS columna
  FROM pg_constraint con
  JOIN pg_class src      ON src.oid = con.conrelid
  JOIN pg_class dst      ON dst.oid = con.confrelid
  JOIN pg_namespace n    ON n.oid = src.relnamespace
  JOIN pg_attribute a    ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
  WHERE con.contype = 'f' AND n.nspname = 'public'
)
SELECT
  '## Relaciones' || E'\n\n'
  || '```mermaid' || E'\n'
  || 'erDiagram' || E'\n'
  || string_agg('  ' || apunta_a || ' ||--o{ ' || tabla || ' : "' || columna || '"',
                E'\n' ORDER BY apunta_a, tabla)
  || E'\n' || '```' AS relaciones_markdown
FROM fks;


-- ── BLOQUE 3 · Comprobación rápida ────────────────────────────
-- Debe devolver CERO filas. Cualquier fila aquí es una tabla abierta.
SELECT relname AS tabla_sin_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY relname;
