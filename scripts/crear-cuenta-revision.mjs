// scripts/crear-cuenta-revision.mjs
// ─────────────────────────────────────────────────────────────
// Crea una cuenta DESECHABLE para el barrido de pantallas y le deja una
// biblioteca con contenido (si no, Biblioteca/Álbum salen vacías y no hay
// layout que medir).
//
// Escribe en Supabase de PRODUCCIÓN. Deja el email/clave en
// .env.revision.local (ignorado por git) y los datos para borrarla luego.
// ─────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const sello = Date.now().toString(36)
const EMAIL = `revision.layout.${sello}@inmersia-qa.test`
const PASS  = `Rev-${sello}-${Math.random().toString(36).slice(2, 10)}`

// 1) Alta. Con el confirm-email desactivado, signUp ya devuelve sesión.
const { data: alta, error: errAlta } = await sb.auth.signUp({
  email: EMAIL, password: PASS,
  options: { data: { nombre: 'Revisión', apellido: 'Layout', fecha_nacimiento: null, genero: null } },
})
if (errAlta) { console.error('signUp:', errAlta.message); process.exit(1) }
if (!alta.session) { console.error('signUp no devolvió sesión: el confirm-email sigue activo.'); process.exit(1) }
const uid = alta.user.id
console.log('✓ cuenta creada:', EMAIL)

// 2) Perfil + tutorial ya visto (si no, el overlay del onboarding tapa todo).
await sb.from('perfiles').insert({ id: uid, nombre: 'Revisión', apellido: 'Layout', fecha_nacimiento: null })
const { error: errFlag } = await sb.from('perfiles').update({ onboarding_completado: true }).eq('id', uid)
if (errFlag) console.error('  ⚠ no se pudo marcar el onboarding:', errFlag.message)
else console.log('✓ perfil creado y tutorial marcado como visto')

// 3) Libros: el Manual + 4 del catálogo. Dos como leídos, para no chocar con
//    el límite de 5 pendientes que bloquea la Tienda.
const MANUAL = '00000000-0000-4000-8000-000000000001'
const { data: libros, error: errLib } = await sb.from('libros')
  .select('id, slug, titulo').eq('visible', true).neq('id', MANUAL)
  .order('created_at', { ascending: false }).limit(4)
if (errLib) { console.error('libros:', errLib.message); process.exit(1) }

const filas = [
  { user_id: uid, libro_id: MANUAL, leido: false },
  ...libros.map((l, i) => ({ user_id: uid, libro_id: l.id, leido: i < 2 })),
]
const { error: errIns } = await sb.from('bibliotecas_usuarios').insert(filas)
if (errIns) console.error('  ⚠ no se pudieron agregar libros:', errIns.message)
else console.log(`✓ ${filas.length} libros en la biblioteca:`, libros.map(l => l.titulo).join(' · '))

writeFileSync('.env.revision.local',
  `# Cuenta DESECHABLE creada por scripts/crear-cuenta-revision.mjs\n` +
  `# Para borrarla:  delete from auth.users where id = '${uid}';\n` +
  `INMERSIA_EMAIL=${EMAIL}\nINMERSIA_PASSWORD=${PASS}\nINMERSIA_UID=${uid}\n`)
console.log('\n✓ credenciales en .env.revision.local (ignorado por git)')
console.log('  uid:', uid)
console.log('  slugs:', libros.map(l => l.slug).join(', '))
