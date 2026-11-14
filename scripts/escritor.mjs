// scripts/escritor.mjs
// ─────────────────────────────────────────────────────────────
// Solicitudes para ser escritor (migración 120), desde la terminal.
//
//   npm run escritor                          → lista las solicitudes pendientes
//   npm run escritor -- correo@x.com          → activa el modo escritor
//   npm run escritor -- correo@x.com --pruebas  (igual, en inmersia-pruebas)
//
// Activar: si el correo ya tiene cuenta en Inmersia, le da el modo escritor
// (fila en `escritores`). Si no la tiene, le manda la invitación de Supabase
// (un enlace para entrar y ponerse contraseña) y le da el modo escritor a la
// cuenta nueva. En los dos casos marca su solicitud como atendida.
//
// Producción: URL de .env.local y clave de servicio de .env.esquema.local.
// Pruebas: URL de .env.development.local y la clave de servicio se pide a la
// API de Supabase con SUPABASE_ACCES_TOKEN_PRUEBA.
// ─────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const leer = (archivo) => Object.fromEntries(readFileSync(archivo, 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))

const args = process.argv.slice(2)
const PRUEBAS = args.includes('--pruebas')
const correo = args.find(a => !a.startsWith('--'))?.trim().toLowerCase()

const secretos = leer('.env.esquema.local')
let url, clave, sitio
if (PRUEBAS) {
  const REF = 'fewnbqswtiuyvfhgdjiv'
  url = leer('.env.development.local').VITE_SUPABASE_URL
  if (!url.includes(REF)) { console.error('La URL de .env.development.local no es la de pruebas.'); process.exit(1) }
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: `Bearer ${secretos.SUPABASE_ACCES_TOKEN_PRUEBA}` } })
  clave = (await r.json()).find(k => k.name === 'service_role')?.api_key
  sitio = 'http://localhost:5173'
} else {
  url = leer('.env.local').VITE_SUPABASE_URL
  clave = secretos.SUPABASE_SERVICE_KEY
  sitio = 'https://www.inmersia.io'
}
if (!url || !clave) { console.error('Faltan la URL o la clave de servicio.'); process.exit(1) }
const sb = createClient(url, clave, { auth: { persistSession: false } })
console.log(PRUEBAS ? '· inmersia-pruebas' : '· PRODUCCIÓN')

const fecha = (t) => new Date(t).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })

if (!correo) {
  const { data, error } = await sb.from('solicitudes_escritor')
    .select('nombre, correo, creado').is('atendida', null).order('creado')
  if (error) { console.error(error.message); process.exit(1) }
  if (!data.length) { console.log('No hay solicitudes pendientes.'); process.exit(0) }
  console.log(`${data.length} pendiente(s):\n`)
  for (const s of data) console.log(`  ${fecha(s.creado)}  ${s.nombre}  <${s.correo}>`)
  console.log('\nPara activar una: npm run escritor -- correo@x.com')
  process.exit(0)
}

const activar = async () => {
  const { data, error } = await sb.rpc('activar_escritor', { p_correo: correo })
  if (error) { console.error('activar_escritor:', error.message); process.exit(1) }
  return data
}

let estado = await activar()
if (estado === 'sin_cuenta') {
  const { data: sol } = await sb.from('solicitudes_escritor').select('nombre')
    .ilike('correo', correo).order('creado', { ascending: false }).limit(1).maybeSingle()
  const { error } = await sb.auth.admin.inviteUserByEmail(correo, {
    redirectTo: `${sitio}/reset-password`,
    data: sol?.nombre ? { nombre: sol.nombre } : undefined,
  })
  if (error) { console.error('No se pudo invitar:', error.message); process.exit(1) }
  console.log(`✓ invitación enviada a ${correo} (entra por el enlace y se pone contraseña)`)
  estado = await activar()
}

const texto = { activado: 'modo escritor activado', ya_era: 'ya tenía el modo escritor', sin_cuenta: 'la cuenta todavía no aparece' }
console.log(`${estado === 'sin_cuenta' ? '⚠' : '✓'} ${correo}: ${texto[estado] ?? estado}`)
