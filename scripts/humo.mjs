// scripts/humo.mjs
// ─────────────────────────────────────────────────────────────
// Pruebas de humo: los recorridos que no pueden romperse, de punta a punta,
// en un navegador de verdad y contra el proyecto de PRUEBAS.
//
//   npm run humo            (headless)
//   npm run humo -- --ver   (con la ventana a la vista)
//
// Qué recorre, con una cuenta desechable que crea y borra al terminar:
//   1. Registro → la base crea perfil y Manual (trigger de la 073).
//   2. Invitado que lee la muestra e inicia sesión sin salir del lector:
//      sigue en la misma página, con el libro adquirido y guardando progreso.
//   3. Límite de 5 pendientes en adquirir_libro() (076).
//   4. Lector de escritorio: leer 2 capítulos, que se guarden capítulos y %
//      por palabras (075), recargar y volver a la misma página.
//   5. Lector de móvil: abre donde lo dejó el escritorio, avanza, recarga.
//   6. Investigación (Cartelera): pide solo las fichas desbloqueadas.
//   7. Pantallas principales en escritorio y móvil sin errores de JavaScript.
//   8. Borrar la cuenta (el "Borrar cuenta" del Perfil).
//
// SOLO PRUEBAS: lee .env.development.local y se niega a correr si la URL no
// es la de inmersia-pruebas. Nunca toca producción. Levanta su propio
// servidor de Vite en el puerto 5188 (no choca con un `npm run dev` abierto).
// ─────────────────────────────────────────────────────────────
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import { readFileSync } from 'fs'

const REF_PRUEBAS = 'fewnbqswtiuyvfhgdjiv'
const PUERTO = 5188
const BASE = `http://localhost:${PUERTO}`
const LIBRO = 'el-principito'           // capítulos cortos y fichas desde el capítulo 1
const VER = process.argv.includes('--ver')

// ── entorno: solo pruebas ────────────────────────────────────
const env = Object.fromEntries(readFileSync('.env.development.local', 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const URL_SB = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY
if (!URL_SB?.includes(REF_PRUEBAS)) {
  console.error(`✗ .env.development.local no apunta a inmersia-pruebas (${REF_PRUEBAS}). No corro nada.`)
  process.exit(1)
}

// ── resultados ───────────────────────────────────────────────
const fallos = []
let paso = ''
const ok = (msg) => console.log(`  ✓ ${msg}`)
const mal = (msg) => { console.log(`  ✗ ${msg}`); fallos.push(`${paso}: ${msg}`) }
const comprobar = (cond, msg, detalle = '') => (cond ? ok(msg) : mal(detalle ? `${msg} (${detalle})` : msg))
const titulo = (t) => { paso = t; console.log(`\n${t}`) }
const esperar = (ms) => new Promise(r => setTimeout(r, ms))

// ── servidor de Vite ─────────────────────────────────────────
async function levantarVite() {
  const proc = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PUERTO), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'pipe'] })
  let salida = ''
  proc.stdout.on('data', d => { salida += d })
  proc.stderr.on('data', d => { salida += d })
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) return proc } catch { /* todavía no */ }
    if (proc.exitCode !== null) break
    await esperar(500)
  }
  proc.kill()
  throw new Error(`Vite no arrancó en el puerto ${PUERTO}:\n${salida}`)
}

// ── navegador con la sesión ya puesta ────────────────────────
// supabase-js guarda la sesión en localStorage con esta clave: se mete antes
// de que cargue la app, así no dependemos del formulario de entrada.
const CLAVE_SESION = `sb-${REF_PRUEBAS}-auth-token`
const erroresJs = []

async function abrirContexto(browser, sesion, movil) {
  const ctx = await browser.newContext(movil
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1280, height: 800 } })
  // Sin sesión = invitado: no se mete nada.
  if (sesion) {
    await ctx.addInitScript(([clave, valor]) => {
      try { localStorage.setItem(clave, valor) } catch { /* sin storage */ }
    }, [CLAVE_SESION, JSON.stringify(sesion)])
  }
  const page = await ctx.newPage()
  page.on('pageerror', e => erroresJs.push(`${movil ? 'móvil' : 'escritorio'} ${page.url()}: ${e.message}`))
  return { ctx, page }
}

// Primer párrafo que se ve en pantalla (el ancla que guarda el lector).
async function primerParrafoVisible(page) {
  return page.evaluate(() => {
    const vh = window.innerHeight, vw = window.innerWidth
    for (const el of document.querySelectorAll('[data-parrafo-id]')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) return el.dataset.parrafoId
    }
    return null
  })
}

async function parrafoEnPantalla(page, id) {
  return page.evaluate((pid) => [...document.querySelectorAll(`[data-parrafo-id="${pid}"]`)].some(el => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
  }), id)
}

async function esperarParrafos(page) {
  await page.waitForSelector('[data-parrafo-id]', { timeout: 30000 })
  await esperar(2500)   // restauración del ancla + paginación definitiva
}

// ── el recorrido ─────────────────────────────────────────────
const sb = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
const vite = await levantarVite()
const browser = await chromium.launch({ headless: !VER })
let uid = null

try {
  titulo('1. Registro')
  const email = `humo.${Date.now().toString(36)}@inmersia-qa.test`
  const clave = `Humo-${Math.random().toString(36).slice(2)}-9`
  const { data: alta, error: errAlta } = await sb.auth.signUp({
    email, password: clave,
    options: { data: { nombre: 'Humo', fecha_nacimiento: '1990-01-01', legal_aceptado_version: 'humo' } },
  })
  if (errAlta || !alta.session) throw new Error(`signUp: ${errAlta?.message || 'sin sesión (¿Confirm email activado en pruebas?)'}`)
  uid = alta.user.id
  const { data: perfil } = await sb.from('perfiles').select('nombre, fecha_nacimiento').eq('id', uid).maybeSingle()
  comprobar(perfil?.nombre === 'Humo' && perfil?.fecha_nacimiento === '1990-01-01', 'la base creó el perfil con nombre y fecha')
  const { data: manual } = await sb.from('bibliotecas_usuarios').select('libro_id')
    .eq('user_id', uid).eq('libro_id', '00000000-0000-4000-8000-000000000001').maybeSingle()
  comprobar(!!manual, 'la base le puso el Manual')
  // Sin tutorial: el overlay del onboarding taparía el lector.
  await sb.from('perfiles').update({ onboarding_completado: true }).eq('id', uid)

  const { data: principito } = await sb.from('libros').select('id').eq('slug', LIBRO).single()
  // Los capítulos se piden cuando ya tiene el libro: antes, la RLS solo deja ver los de la muestra.
  let caps = [], totalPalabras = 0
  const pctEsperado = (n) => Math.min(100, Math.round(caps.slice(0, n).reduce((s, c) => s + c.palabras, 0) / totalPalabras * 100))
  const progreso = async () => (await sb.from('progreso_lectura')
    .select('porcentaje, capitulos_completados, ultimo_parrafo_id').eq('user_id', uid).eq('libro_id', principito.id).maybeSingle()).data

  // Avanza hasta tener `meta` capítulos completados. `avanzar` da un paso.
  async function leerHasta(meta, avanzar) {
    for (let i = 0; i < 80; i++) {
      const p = await progreso()
      if ((p?.capitulos_completados ?? 0) >= meta) return p
      await avanzar()
      await esperar(400)
    }
    return progreso()
  }

  titulo('2. Invitado que inicia sesión desde la muestra')
  // El momento de conversión: lee sin cuenta, entra sin salir del lector y
  // tiene que seguir donde iba, con el libro adquirido y el progreso guardándose.
  const inv = await abrirContexto(browser, null, false)
  await inv.page.goto(`${BASE}/libro/${LIBRO}`)
  await esperarParrafos(inv.page)
  for (let i = 0; i < 4; i++) { await inv.page.keyboard.press('ArrowRight'); await esperar(500) }
  await esperar(800)
  const anclaInvitado = await primerParrafoVisible(inv.page)
  await inv.page.getByRole('button', { name: 'Crear cuenta' }).first().click()
  await inv.page.getByRole('tab', { name: 'Iniciar sesión' }).click()
  await inv.page.fill('#login-email', email)
  await inv.page.fill('form:has(#login-email) input[type="password"]', clave)
  await inv.page.locator('form:has(#login-email) button[type="submit"]').click()
  await esperar(6000)   // entrar + adquirir + rescatar la muestra + desbloquear
  const { data: adquirido } = await sb.from('bibliotecas_usuarios').select('libro_id')
    .eq('user_id', uid).eq('libro_id', principito.id).maybeSingle()
  comprobar(!!adquirido, 'el libro queda en su biblioteca')
  caps = (await sb.from('capitulos').select('numero, palabras').eq('libro_id', principito.id).order('numero')).data || []
  totalPalabras = caps.reduce((s, c) => s + c.palabras, 0)
  let p = await progreso()
  comprobar(p?.capitulos_completados > 0 && !!p?.ultimo_parrafo_id, 'se rescata lo que leyó como invitado',
    `capitulos_completados=${p?.capitulos_completados}`)
  // Con sesión la barra del lector cambia y la página puede cortar en otro
  // punto: lo que importa es que el párrafo donde iba siga en pantalla.
  if (process.env.HUMO_DEBUG) {
    const dondeVe = await primerParrafoVisible(inv.page)
    const ids = [anclaInvitado, p?.ultimo_parrafo_id, dondeVe].filter(Boolean)
    const { data: info } = await sb.from('parrafos').select('id, numero, capitulos(numero)').in('id', ids)
    const de = (id) => { const x = info?.find(r => r.id === id); return x ? `cap ${x.capitulos?.numero} párrafo ${x.numero}` : id }
    console.log(`    [debug] invitado: ${de(anclaInvitado)} · guardado: ${de(p?.ultimo_parrafo_id)} · ve: ${de(dondeVe)}`)
  }
  comprobar(p?.ultimo_parrafo_id === anclaInvitado, 'el rescate guarda el párrafo exacto donde iba')
  comprobar(await parrafoEnPantalla(inv.page, anclaInvitado), 'sigue en la misma página tras entrar')
  const trasEntrar = p?.capitulos_completados ?? 0
  console.log(`    (tras entrar: ${trasEntrar} capítulos, ${p?.porcentaje} %)`)
  p = await leerHasta(trasEntrar + 1, () => inv.page.keyboard.press('ArrowRight'))
  comprobar(p?.capitulos_completados === trasEntrar + 1, 'el progreso se guarda sin recargar',
    `capitulos_completados=${p?.capitulos_completados}, antes ${trasEntrar}`)
  await inv.ctx.close()

  titulo('3. Límite de 5 pendientes')
  // Ya tiene El Principito: 4 más llegan al límite y el siguiente no entra.
  const { data: libros } = await sb.from('libros').select('id, slug').eq('visible', true)
    .neq('id', '00000000-0000-4000-8000-000000000001').neq('slug', LIBRO).limit(5)
  const ids = libros.map(l => l.id)
  const nuevos = []
  for (const id of ids.slice(0, 4)) nuevos.push((await sb.rpc('adquirir_libro', { p_libro_id: id })).data)
  comprobar(nuevos.every(n => n === true), 'adquiere hasta tener 5 pendientes', JSON.stringify(nuevos))
  const sexto = await sb.rpc('adquirir_libro', { p_libro_id: ids[4] })
  comprobar(sexto.error?.hint === 'limite_pendientes', 'el sexto lo rechaza la base', sexto.error?.message || 'lo dejó pasar')
  const repetido = await sb.rpc('adquirir_libro', { p_libro_id: principito.id })
  comprobar(repetido.data === false, 'pedir uno que ya tiene no hace nada')
  const hackeo = await sb.from('bibliotecas_usuarios').update({ libro_id: ids[4] }).eq('user_id', uid).eq('libro_id', ids[0])
  comprobar(!!hackeo.error, 'no se puede cambiar el libro_id de una fila')

  titulo('4. Lector de escritorio')
  const esc = await abrirContexto(browser, alta.session, false)
  await esc.page.goto(`${BASE}/libro/${LIBRO}`)
  await esperarParrafos(esc.page)
  const antesEsc = (await progreso())?.capitulos_completados ?? 0
  console.log(`    (antes: ${antesEsc} capítulos)`)
  p = await leerHasta(antesEsc + 2, () => esc.page.keyboard.press('ArrowRight'))
  comprobar(p?.capitulos_completados === antesEsc + 2, 'leer guarda los capítulos completados', `capitulos_completados=${p?.capitulos_completados}, antes ${antesEsc}`)
  comprobar(p?.porcentaje === pctEsperado(p?.capitulos_completados), 'el % se guarda por palabras', `guardado ${p?.porcentaje} con ${p?.capitulos_completados} capítulos, esperado ${pctEsperado(p?.capitulos_completados)}`)
  await esperar(1500)   // debounce del ancla
  const anclaEsc = await primerParrafoVisible(esc.page)
  p = await progreso()
  comprobar(!!anclaEsc && p?.ultimo_parrafo_id === anclaEsc, 'guarda el párrafo donde va')
  await esc.page.reload()
  await esperarParrafos(esc.page)
  comprobar(await primerParrafoVisible(esc.page) === anclaEsc, 'al recargar vuelve a la misma página')

  titulo('5. Lector de móvil')
  const mov = await abrirContexto(browser, alta.session, true)
  await mov.page.goto(`${BASE}/libro/${LIBRO}`)
  await esperarParrafos(mov.page)
  comprobar(await primerParrafoVisible(mov.page) === anclaEsc, 'abre donde lo dejó el escritorio')
  const yaLeidos = p.capitulos_completados
  p = await leerHasta(yaLeidos + 1, () => mov.page.locator('.lm-turn.right').first().dispatchEvent('click'))
  comprobar(p?.capitulos_completados === yaLeidos + 1, 'avanzar de capítulo en el móvil lo guarda', `capitulos_completados=${p?.capitulos_completados}`)
  comprobar(p?.porcentaje === pctEsperado(p?.capitulos_completados), 'el % se guarda por palabras', `guardado ${p?.porcentaje} con ${p?.capitulos_completados} capítulos, esperado ${pctEsperado(p?.capitulos_completados)}`)
  await esperar(1500)
  const anclaMov = await primerParrafoVisible(mov.page)
  await mov.page.reload()
  await esperarParrafos(mov.page)
  comprobar(await primerParrafoVisible(mov.page) === anclaMov, 'al recargar vuelve a la misma página')

  titulo('6. Investigación (Cartelera)')
  let filtro = null
  const oir = r => { const m = r.url().match(/cartelera_items\?.*capitulo_numero=lt\.(\d+)/); if (m) filtro = Number(m[1]) }
  esc.page.on('request', oir)
  await esc.page.goto(`${BASE}/investigacion/${LIBRO}`)
  await esperar(4000)
  esc.page.off('request', oir)
  comprobar(filtro === p.capitulos_completados + 1, 'pide solo las fichas de los capítulos leídos',
    `filtro lt.${filtro}, capítulos completados ${p.capitulos_completados}`)

  titulo('7. Pantallas principales')
  for (const [nombre, { page }] of [['escritorio', esc], ['móvil', mov]]) {
    for (const ruta of ['/biblioteca', '/tienda', '/album', '/comunidades', '/perfil']) {
      const antes = erroresJs.length
      await page.goto(`${BASE}${ruta}`)
      await esperar(3000)
      const texto = await page.evaluate(() => document.body.innerText.trim().length)
      comprobar(erroresJs.length === antes && texto > 40, `${nombre} ${ruta}`,
        erroresJs.length > antes ? erroresJs.slice(antes).join(' | ') : 'pantalla vacía')
    }
  }
  if (erroresJs.length) { titulo('Errores de JavaScript durante el recorrido'); erroresJs.forEach(e => mal(e)) }
} catch (err) {
  mal(`se cortó: ${err.message}`)
} finally {
  // Borrar la cuenta es también una prueba: es el "Borrar cuenta" del Perfil.
  if (uid) {
    titulo('8. Borrar la cuenta')
    const { error } = await sb.rpc('eliminar_mi_cuenta')
    comprobar(!error, 'eliminar_mi_cuenta() la borra con todo', error?.message)
    if (error) console.log(`  (queda la cuenta ${uid} en pruebas: bórrala a mano)`)
  }
  await browser.close()
  vite.kill()
}

console.log(fallos.length ? `\n✗ ${fallos.length} fallo(s):\n  - ${fallos.join('\n  - ')}` : '\n✓ Todo el humo en verde')
process.exit(fallos.length ? 1 : 0)
