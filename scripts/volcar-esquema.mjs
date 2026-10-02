// scripts/volcar-esquema.mjs
// ─────────────────────────────────────────────────────────────
// Vuelca la ESTRUCTURA de la base de datos de producción (sin contenido)
// a supabase/esquema/, en tres archivos que se restauran en orden:
//
//   01-extensiones.sql      extensiones instaladas (pg_cron, …)
//   02-esquema.sql          todo el esquema public: tablas, columnas,
//                           índices, restricciones, funciones, triggers,
//                           vistas, RLS, políticas y permisos (pg_dump)
//   03-fuera-de-public.sql  lo que pg_dump de public no ve: triggers
//                           sobre auth.*, buckets y políticas de Storage,
//                           tareas de pg_cron y tablas de Realtime
//
// Es el retrato vivo de producción: manda sobre supabase/Migration/,
// que tiene huecos (cosas aplicadas a mano, migraciones que nunca se
// corrieron). Guía completa: Documentation/base-de-datos/respaldo-estructura.md
//
// Requisitos (una vez):
//   · pg_dump y psql de PostgreSQL 17 o más nuevo (comando de instalación en la guía).
//     Si no están en el PATH se buscan en C:\Program Files\PostgreSQL\<versión>\bin,
//     o se indica la carpeta con PG_BIN en el archivo de abajo.
//   · .env.esquema.local con SUPABASE_DB_URL (ver .env.esquema.local.ejemplo).
//     .gitignore ya cubre `.env.*.local`: la clave nunca sube al repo.
//
// Uso: npm run esquema
// Todo es de SOLO LECTURA sobre la base de datos.
// ─────────────────────────────────────────────────────────────
import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const SALIDA = 'supabase/esquema'

// ── configuración ───────────────────────────────────────────
let env = {}
try {
  env = Object.fromEntries(readFileSync('.env.esquema.local', 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
} catch {
  salir('Falta .env.esquema.local. Copia .env.esquema.local.ejemplo y pon tu cadena de conexión.')
}
if (!env.SUPABASE_DB_URL) salir('Falta SUPABASE_DB_URL en .env.esquema.local.')

// La cadena se reparte en variables PG* en lugar de pasarla como argumento,
// para que la contraseña no aparezca en la lista de procesos.
let url
try { url = new URL(env.SUPABASE_DB_URL) } catch { salir('SUPABASE_DB_URL no es una cadena postgresql:// válida.') }
const pgEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: url.pathname.slice(1) || 'postgres',
  PGSSLMODE: 'require',
}

// ── binarios ────────────────────────────────────────────────
function binario(nombre) {
  const exe = process.platform === 'win32' ? `${nombre}.exe` : nombre
  if (env.PG_BIN) return join(env.PG_BIN, exe)
  if (spawnSync(exe, ['--version']).status === 0) return exe
  for (const v of [18, 17, 16]) {
    const p = join('C:\\Program Files\\PostgreSQL', String(v), 'bin', exe)
    if (existsSync(p)) return p
  }
  salir(`No encuentro ${exe}. Instala las herramientas de PostgreSQL (Documentation/base-de-datos/respaldo-estructura.md, sección 1) o pon PG_BIN en .env.esquema.local.`)
}
const PG_DUMP = binario('pg_dump')
const PSQL = binario('psql')

function correr(bin, args) {
  const r = spawnSync(bin, args, { env: pgEnv, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (r.error) salir(`No se pudo ejecutar ${bin}: ${r.error.message}`)
  return r
}

// Una consulta que devuelve una columna de texto → sus filas.
// `opcional`: si falla (p. ej. no existe el esquema cron), se anota y sigue.
function consulta(titulo, sql, opcional = false) {
  const r = correr(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', sql])
  if (r.status !== 0) {
    if (opcional) return `-- (${titulo}: no disponible — ${r.stderr.trim().split('\n')[0]})\n`
    salir(`Falló la consulta «${titulo}»:\n${r.stderr}`)
  }
  const filas = r.stdout.trim()
  return filas ? filas + '\n' : `-- (${titulo}: ninguno)\n`
}

const hoy = new Date().toISOString().slice(0, 10)
const cabecera = (que) => `-- =============================================================
-- INMERSIA — ${que}
-- Volcado de producción del ${hoy} con \`npm run esquema\`.
-- NO SE EDITA A MANO: se regenera. Cómo restaurarlo:
-- Documentation/base-de-datos/respaldo-estructura.md
-- =============================================================

`

mkdirSync(SALIDA, { recursive: true })

// ── 02 · esquema public (primero: si la conexión falla, falla aquí) ──
console.log('Volcando el esquema public con pg_dump…')
const dump = correr(PG_DUMP, ['--schema-only', '--schema=public', '--no-owner'])
if (dump.status !== 0) {
  const err = dump.stderr
  if (/server version mismatch/i.test(err)) {
    salir(`Tu pg_dump es más viejo que el servidor. Instala la versión que pide el mensaje:\n${err}`)
  }
  salir(`pg_dump falló:\n${err}`)
}
// pg_dump 17.6+ protege el archivo con \restrict <clave al azar>. La clave
// cambia en cada volcado y ensuciaría el diff de git: se fija a un valor.
const esquema = dump.stdout.replace(/^\\(un)?restrict \S+$/gm, (_, un) => `\\${un || ''}restrict inmersia`)
writeFileSync(join(SALIDA, '02-esquema.sql'), cabecera('Esquema public (tablas, funciones, RLS, políticas, permisos)') + esquema)

// ── 01 · extensiones ────────────────────────────────────────
console.log('Leyendo extensiones…')
const extensiones = consulta('extensiones', `
  SELECT 'CREATE EXTENSION IF NOT EXISTS ' || quote_ident(e.extname)
         || ' WITH SCHEMA ' || quote_ident(n.nspname) || ';'
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname <> 'plpgsql'
  ORDER BY e.extname`)
writeFileSync(join(SALIDA, '01-extensiones.sql'), cabecera('Extensiones')
  + '-- Un proyecto nuevo de Supabase ya trae varias: las que existan se saltan.\n\n' + extensiones)

// ── 03 · lo de fuera de public ──────────────────────────────
console.log('Leyendo triggers de auth, Storage, pg_cron y Realtime…')
const triggersAuth = consulta('triggers sobre auth/storage que llaman a funciones de public', `
  SELECT 'DROP TRIGGER IF EXISTS ' || quote_ident(t.tgname) || ' ON ' || n.nspname || '.' || quote_ident(c.relname) || ';'
         || E'\\n' || pg_get_triggerdef(t.oid) || ';'
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
  WHERE NOT t.tgisinternal AND n.nspname IN ('auth', 'storage') AND pn.nspname = 'public'
  ORDER BY n.nspname, c.relname, t.tgname`)

const buckets = consulta('buckets de Storage', `
  SELECT 'INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('
         || quote_literal(id) || ', ' || quote_literal(name) || ', ' || public || ', '
         || COALESCE(file_size_limit::text, 'NULL') || ', '
         || COALESCE(quote_literal(allowed_mime_types::text) || '::text[]', 'NULL')
         || ') ON CONFLICT (id) DO NOTHING;'
  FROM storage.buckets ORDER BY id`, true)

// Misma forma que el BLOQUE 1 de supabase/exportar-politicas.sql (DROP + CREATE).
const politicasStorage = consulta('políticas de Storage', `
  SELECT 'DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON storage.' || quote_ident(tablename) || ';' || E'\\n'
         || 'CREATE POLICY ' || quote_ident(policyname) || E'\\n  ON storage.' || quote_ident(tablename)
         || CASE WHEN permissive = 'RESTRICTIVE' THEN ' AS RESTRICTIVE' ELSE '' END
         || ' FOR ' || cmd || ' TO ' || array_to_string(roles, ', ')
         || COALESCE(E'\\n  USING (' || qual || ')', '')
         || COALESCE(E'\\n  WITH CHECK (' || with_check || ')', '') || ';'
  FROM pg_policies WHERE schemaname = 'storage'
  ORDER BY tablename, cmd, policyname`, true)

const cron = consulta('tareas de pg_cron', `
  SELECT 'SELECT cron.schedule(' || quote_literal(jobname) || ', ' || quote_literal(schedule) || ', '
         || quote_literal(command) || ');'
  FROM cron.job ORDER BY jobname`, true)

const realtime = consulta('tablas publicadas en Realtime', `
  SELECT 'ALTER PUBLICATION supabase_realtime ADD TABLE ' || quote_ident(schemaname) || '.' || quote_ident(tablename) || ';'
  FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
  ORDER BY schemaname, tablename`, true)

writeFileSync(join(SALIDA, '03-fuera-de-public.sql'), cabecera('Lo que vive fuera del esquema public')
  + '-- Va DESPUÉS de 02-esquema.sql: los triggers llaman a funciones de public.\n\n'
  + '-- ── Triggers sobre auth.* y storage.* ──\n' + triggersAuth
  + '\n-- ── Buckets de Storage (solo la configuración, no los archivos) ──\n' + buckets
  + '\n-- ── Políticas de Storage ──\n' + politicasStorage
  + '\n-- ── Tareas programadas (pg_cron) ──\n' + cron
  + '\n-- ── Realtime ──\n' + realtime)

// ── resumen ─────────────────────────────────────────────────
const cuenta = (re) => (esquema.match(re) || []).length
console.log(`
✓ Listo en ${SALIDA}/
    tablas      ${cuenta(/^CREATE TABLE /gm)}
    funciones   ${cuenta(/^CREATE (OR REPLACE )?FUNCTION /gm)}
    triggers    ${cuenta(/^CREATE (OR REPLACE )?TRIGGER /gm)}
    vistas      ${cuenta(/^CREATE (OR REPLACE )?VIEW /gm)}
    políticas   ${cuenta(/^CREATE POLICY /gm)}

Siguiente: mira el diff con  git diff --stat supabase/esquema
y guárdalo con           git add supabase/esquema && git commit -m "Esquema: volcado ${hoy}"`)

function salir(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}
