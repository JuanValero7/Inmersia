// scripts/respaldar.mjs
// ─────────────────────────────────────────────────────────────
// Copia de seguridad de producción en el disco de este ordenador.
//
// POR QUÉ EXISTE
// El plan gratis de Supabase no hace copias. Sin esto, un borrado por error,
// una migración mal escrita o un problema de Supabase no tendrían vuelta
// atrás: ni las cuentas, ni el progreso de los lectores, ni los libros.
//
// QUÉ GUARDA (en RESPALDO_DIR, por defecto Documentos\Inmersia_copias_seguridad)
//   base-de-datos/AAAA-MM-DD_HHMM/      una carpeta por copia; se guardan 14
//     cuentas.dump        datos de auth: usuarios, identidades (Google), MFA
//     inmersia.dump       esquema public entero: estructura + datos
//     estructura/         foto de lo que vive fuera de public (scripts/volcar-esquema.mjs)
//     resumen.txt         tamaños y número de filas, para comprobar de un vistazo
//   storage/<bucket>/…    ESPEJO de los archivos de Storage (imágenes, sonidos).
//                         Solo baja lo nuevo o cambiado, y nunca borra: si un
//                         archivo desaparece de Supabase, aquí se conserva.
//   respaldo.log          una línea por ejecución
//
// QUÉ NO GUARDA, A PROPÓSITO
//   Sesiones abiertas, refresh tokens, tokens de un solo uso y el registro de
//   auditoría de auth. No sirven para restaurar, y tener tokens válidos en un
//   disco es un riesgo que no compensa. El registro de auditoría lleva IPs.
//
// PRIVACIDAD: son datos personales. Se quedan en este disco (cifrado con
// BitLocker) y solo las 14 últimas copias: quien borra su cuenta desaparece
// de las copias en dos semanas. NUNCA en el repo, que es público.
//
// SI FALLA: deja «Respaldo de Inmersia FALLÓ.txt» en el escritorio con el
// motivo, y lo quita la siguiente vez que sale bien. Una copia programada que
// falla en silencio es peor que no tenerla, porque das por hecho que existe.
//
// Uso: npm run respaldo        (la tarea programada de Windows hace lo mismo)
// Restaurar: Documentation/base-de-datos/copias-de-seguridad.md
// Todo es de SOLO LECTURA sobre producción.
// ─────────────────────────────────────────────────────────────
import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync,
  renameSync, rmSync, statSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = process.env.RESPALDO_DIR || join(homedir(), 'Documents', 'Inmersia_copias_seguridad')
const CONSERVAR = 14
// Con 8 a la vez Supabase cortaba con HTTP 429 (demasiadas peticiones) a mitad
// de la primera copia. 3, y reintentos con espera, es lo que aguanta.
const DESCARGAS_A_LA_VEZ = 3
const REINTENTOS = 5

// Tablas de auth que hacen falta para que la gente vuelva a entrar.
const TABLAS_CUENTAS = ['auth.users', 'auth.identities', 'auth.mfa_factors', 'auth.webauthn_credentials']

const inicio = Date.now()
const marca = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 16).replace(' ', '_').replace(':', '')
const AVISO = escritorio('Respaldo de Inmersia FALLÓ.txt')

try {
  await principal()
} catch (err) {
  fallo(err)
}

async function principal() {
  const env = leerEnv('.env.esquema.local')
  if (!env.SUPABASE_DB_URL) throw new Error('Falta SUPABASE_DB_URL en .env.esquema.local.')
  const supabaseUrl = leerEnv('.env.local').VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('Falta VITE_SUPABASE_URL en .env.local.')

  // Igual que volcar-esquema: la contraseña va en variables PG*, no como
  // argumento, para que no aparezca en la lista de procesos.
  const url = new URL(env.SUPABASE_DB_URL)
  const pgEnv = {
    ...process.env,
    PGHOST: url.hostname, PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1) || 'postgres', PGSSLMODE: 'require',
    // En Windows psql habla por defecto en la codificación de la consola
    // (WIN1252) y estropea las tildes de los nombres de archivo de Storage.
    PGCLIENTENCODING: 'UTF8',
  }
  const PG_DUMP = binario('pg_dump', env), PG_RESTORE = binario('pg_restore', env), PSQL = binario('psql', env)
  const correr = (bin, args, extra = {}, input) => {
    const r = spawnSync(bin, args, { env: { ...pgEnv, ...extra }, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, cwd: RAIZ, input })
    if (r.error) throw new Error(`No se pudo ejecutar ${bin}: ${r.error.message}`)
    if (r.status !== 0) throw new Error(`${bin.split(/[\\/]/).pop()} falló:\n${(r.stderr || r.stdout).trim().slice(0, 1500)}`)
    return r.stdout
  }
  // El SQL entra por stdin y no con -c: Windows convierte los argumentos a la
  // página de códigos del sistema y una «í» llegaba a Postgres como 0xED.
  const consulta = (sql) => correr(PSQL, ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {}, sql).trim()

  // ── 1. Base de datos ────────────────────────────────────────
  const carpetas = join(DESTINO, 'base-de-datos')
  const tmp = join(carpetas, `${marca}.parcial`)
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })

  log('Copiando cuentas…')
  correr(PG_DUMP, ['-Fc', '--data-only', ...TABLAS_CUENTAS.flatMap(t => ['-t', t]), '-f', join(tmp, 'cuentas.dump')])
  log('Copiando el esquema public (estructura y datos)…')
  correr(PG_DUMP, ['-Fc', '--schema=public', '--no-owner', '-f', join(tmp, 'inmersia.dump')])

  // Un archivo que pg_restore no sabe leer no es una copia: se comprueba ya.
  const entradas = (f) => correr(PG_RESTORE, ['--list', join(tmp, f)]).split('\n').filter(l => l && !l.startsWith(';')).length
  const nCuentas = entradas('cuentas.dump'), nInmersia = entradas('inmersia.dump')
  if (nCuentas < TABLAS_CUENTAS.length || nInmersia < 50) {
    throw new Error(`Las copias parecen incompletas (cuentas: ${nCuentas} entradas, inmersia: ${nInmersia}).`)
  }

  log('Foto de la estructura de fuera de public…')
  correr(process.execPath, [join(RAIZ, 'scripts', 'volcar-esquema.mjs')], { ESQUEMA_SALIDA: join(tmp, 'estructura') })

  const filas = consulta(`
    SELECT 'cuentas', count(*) FROM auth.users UNION ALL
    SELECT 'libros', count(*) FROM public.libros UNION ALL
    SELECT 'capítulos', count(*) FROM public.capitulos UNION ALL
    SELECT 'párrafos', count(*) FROM public.parrafos UNION ALL
    SELECT 'progreso de lectura', count(*) FROM public.progreso_lectura UNION ALL
    SELECT 'subrayados', count(*) FROM public.subrayados_usuario UNION ALL
    SELECT 'anotaciones', count(*) FROM public.anotaciones_usuario UNION ALL
    SELECT 'archivos en Storage', count(*) FROM storage.objects`)
  const mb = (f) => { const b = statSync(join(tmp, f)).size; return b < 1048576 ? `${Math.ceil(b / 1024)} kB` : `${(b / 1048576).toFixed(1)} MB` }
  writeFileSync(join(tmp, 'resumen.txt'), [
    `Copia de seguridad de Inmersia — ${marca.replace('_', ' ')} (hora de Berlín)`,
    '',
    `cuentas.dump    ${mb('cuentas.dump')}  (${nCuentas} entradas)`,
    `inmersia.dump   ${mb('inmersia.dump')}  (${nInmersia} entradas)`,
    '',
    'Filas en producción en el momento de la copia:',
    ...filas.split('\n').map(l => { const [k, v] = l.split('\t'); return `  ${k.padEnd(22)}${v}` }),
    '',
    'Cómo restaurar: Documentation/base-de-datos/copias-de-seguridad.md',
  ].join('\n') + '\n')
  renameSync(tmp, join(carpetas, marca))

  // Solo las 14 últimas. Las «.parcial» son de ejecuciones que se cortaron.
  const copias = readdirSync(carpetas).filter(n => /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(n)).sort()
  for (const vieja of copias.slice(0, Math.max(0, copias.length - CONSERVAR))) {
    rmSync(join(carpetas, vieja), { recursive: true, force: true })
  }
  for (const parcial of readdirSync(carpetas).filter(n => n.endsWith('.parcial'))) {
    rmSync(join(carpetas, parcial), { recursive: true, force: true })
  }

  // ── 2. Storage (espejo incremental) ─────────────────────────
  log('Comparando Storage…')
  const manifiestoRuta = join(DESTINO, 'storage', 'manifiesto.json')
  let manifiesto = {}
  try { manifiesto = JSON.parse(readFileSync(manifiestoRuta, 'utf8')) } catch { /* primera vez */ }
  const objetos = consulta(`
    SELECT bucket_id, name, coalesce(metadata->>'size', ''), coalesce(updated_at::text, '')
    FROM storage.objects WHERE name NOT LIKE '%.emptyFolderPlaceholder' ORDER BY bucket_id, name`)
    .split('\n').filter(Boolean).map(l => { const [bucket, name, size, updated] = l.split('\t'); return { bucket, name, size, updated } })

  // Windows no distingue mayúsculas en las rutas, y Storage sí: «El Corsario
  // Negro/portada.webp» y «El corsario negro/portada.webp» caían en el mismo
  // archivo y uno pisaba al otro. Al segundo (en orden fijo) se le añade « (2)».
  const vistos = new Map()
  for (const o of objetos) {
    const clave = `${o.bucket}/${o.name}`.toLowerCase()
    const n = (vistos.get(clave) || 0) + 1
    vistos.set(clave, n)
    if (n > 1) o.sufijo = ` (${n})`
  }

  const pendientes = objetos.filter(o => {
    const m = manifiesto[`${o.bucket}/${o.name}`]
    return !m || m.size !== o.size || m.updated !== o.updated || !existsSync(rutaLocal(o))
  })
  log(`Storage: ${objetos.length} archivos, ${pendientes.length} nuevos o cambiados.`)

  let bajados = 0
  const fallidos = []
  const cola = [...pendientes]
  await Promise.all(Array.from({ length: DESCARGAS_A_LA_VEZ }, async () => {
    for (let o = cola.shift(); o; o = cola.shift()) {
      const enlace = `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(o.bucket)}/${o.name.split('/').map(encodeURIComponent).join('/')}`
      try {
        const r = await descargar(enlace)
        const destino = rutaLocal(o)
        mkdirSync(dirname(destino), { recursive: true })
        writeFileSync(destino, Buffer.from(await r.arrayBuffer()))
        manifiesto[`${o.bucket}/${o.name}`] = { size: o.size, updated: o.updated }
        if (++bajados % 200 === 0) log(`  …${bajados} de ${pendientes.length}`)
      } catch (err) {
        fallidos.push(`${o.bucket}/${o.name}: ${err.message}`)
      }
    }
  }))
  mkdirSync(dirname(manifiestoRuta), { recursive: true })
  writeFileSync(manifiestoRuta, JSON.stringify(manifiesto))

  const enSupabase = new Set(objetos.map(o => `${o.bucket}/${o.name}`))
  const soloAqui = Object.keys(manifiesto).filter(k => !enSupabase.has(k)).length

  // Un puñado de descargas fallidas (red) se reintenta solo mañana: el
  // manifiesto no las marca. Muchas a la vez sí es un problema.
  if (fallidos.length > Math.max(10, pendientes.length * 0.05)) {
    throw new Error(`Fallaron ${fallidos.length} descargas de Storage. Primeras:\n${fallidos.slice(0, 5).join('\n')}`)
  }

  const resumen = `OK ${marca} · base ${mb2(join(carpetas, marca))} · Storage +${bajados}` +
    (fallidos.length ? ` (${fallidos.length} reintentar)` : '') + (soloAqui ? ` · ${soloAqui} ya no están en Supabase` : '') +
    ` · ${Math.round((Date.now() - inicio) / 1000)} s`
  registrar(resumen)
  if (existsSync(AVISO)) unlinkSync(AVISO)
  log(`✓ ${resumen}\n  ${DESTINO}`)
}

// ── utilidades ───────────────────────────────────────────────
// 429 (demasiadas peticiones) y 5xx son pasajeros: se espera y se reintenta,
// respetando Retry-After si Supabase lo manda. Un 404 o un 400 no se reintenta.
async function descargar(enlace) {
  for (let intento = 0; ; intento++) {
    let r
    try { r = await fetch(enlace) } catch (err) { r = { ok: false, status: 0, error: err } }
    if (r.ok) return r
    const pasajero = r.status === 0 || r.status === 429 || r.status >= 500
    if (!pasajero || intento >= REINTENTOS) throw new Error(r.error ? r.error.message : `HTTP ${r.status}`)
    const segundos = Number(r.headers?.get?.('retry-after')) || 2 ** intento
    await new Promise(res => setTimeout(res, Math.min(segundos, 60) * 1000))
  }
}

function rutaLocal(o) {
  // Los nombres de Storage pueden traer caracteres que Windows no admite.
  const partes = o.name.split('/').map(p => p.replace(/[<>:"|?*\\]/g, '_'))
  if (o.sufijo) partes[partes.length - 1] = partes.at(-1).replace(/(\.[^.]*)?$/, `${o.sufijo}$1`)
  return join(DESTINO, 'storage', o.bucket, ...partes)
}

function mb2(carpeta) {
  const total = readdirSync(carpeta).filter(f => f.endsWith('.dump')).reduce((s, f) => s + statSync(join(carpeta, f)).size, 0)
  return (total / 1048576).toFixed(1) + ' MB'
}

function leerEnv(archivo) {
  try {
    return Object.fromEntries(readFileSync(join(RAIZ, archivo), 'utf8').split(/\r?\n/)
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
  } catch { throw new Error(`Falta ${archivo} en la raíz del proyecto.`) }
}

function binario(nombre, env) {
  const exe = process.platform === 'win32' ? `${nombre}.exe` : nombre
  if (env.PG_BIN) return join(env.PG_BIN, exe)
  if (spawnSync(exe, ['--version']).status === 0) return exe
  for (const v of [18, 17]) {
    const p = join('C:\\Program Files\\PostgreSQL', String(v), 'bin', exe)
    if (existsSync(p)) return p
  }
  throw new Error(`No encuentro ${exe} (PostgreSQL 17 o más nuevo). Ver Documentation/base-de-datos/respaldo-estructura.md.`)
}

function escritorio(archivo) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', "[Environment]::GetFolderPath('Desktop')"], { encoding: 'utf8' })
  return join((r.stdout || '').trim() || join(homedir(), 'Desktop'), archivo)
}

function log(msg) { console.log(msg) }

function registrar(linea) {
  mkdirSync(DESTINO, { recursive: true })
  appendFileSync(join(DESTINO, 'respaldo.log'), linea + '\n')
}

function fallo(err) {
  const msg = err?.message || String(err)
  console.error(`✗ ${msg}`)
  try { registrar(`FALLO ${marca} · ${msg.split('\n')[0]}`) } catch { /* ni el log */ }
  try {
    writeFileSync(AVISO, [
      `La copia de seguridad de Inmersia del ${marca.replace('_', ' ')} no se pudo hacer.`,
      '',
      'Motivo:',
      msg,
      '',
      'Qué hacer: abre una terminal en la carpeta del proyecto y ejecuta  npm run respaldo',
      'para ver el error completo. Este archivo desaparece solo cuando una copia sale bien.',
      `Registro: ${join(DESTINO, 'respaldo.log')}`,
    ].join('\r\n'))
  } catch { /* sin escritorio */ }
  process.exit(1)
}
