// scripts/verificar-csp.mjs
// ─────────────────────────────────────────────────────────────
// Comprueba que la CSP de vercel.json no rompe nada. Sirve dist/ con
// las cabeceras REALES leídas de vercel.json (así no pueden divergir
// de lo que se despliega), entra con la cuenta de revisión y recorre
// las pantallas anotando cada violación de CSP y cada error de consola.
//
// Mirar la página no basta: una violación de CSP no rompe el render,
// bloquea el recurso en silencio. Por eso se escucha el evento
// `securitypolicyviolation` del documento.
//
// Requiere `npm run build` antes (lee dist/).
// Credenciales en .env.revision.local, igual que revisar-pantallas.mjs.
//
// Uso: node scripts/verificar-csp.mjs
// ─────────────────────────────────────────────────────────────
import { chromium } from 'playwright'
import { readFileSync, existsSync, statSync } from 'fs'
import { createServer } from 'http'
import { extname, join, normalize } from 'path'

const PUERTO = 5210
const RAIZ = 'dist'

if (!existsSync(RAIZ)) {
  console.error('Falta dist/. Corre `npm run build` primero.')
  process.exit(1)
}

// ── cabeceras: las de verdad, de vercel.json ────────────────
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
const regla = (vercel.headers || []).find(h => h.source === '/(.*)')
if (!regla) {
  console.error('vercel.json no tiene headers para /(.*)')
  process.exit(1)
}
const CABECERAS = Object.fromEntries(regla.headers.map(h => [h.key, h.value]))
console.log('Cabeceras servidas:')
for (const k of Object.keys(CABECERAS)) console.log(`  · ${k}`)
console.log('')

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
}

// `nosniff` va en las cabeceras, así que un Content-Type mal puesto aquí
// rompería la página igual que en producción: el servidor debe ser fiel.
const servidor = createServer((req, res) => {
  const limpio = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  let ruta = join(RAIZ, limpio)
  if (!existsSync(ruta) || statSync(ruta).isDirectory()) ruta = join(RAIZ, 'index.html') // fallback SPA
  const tipo = TIPOS[extname(ruta).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, { ...CABECERAS, 'Content-Type': tipo })
  res.end(readFileSync(ruta))
})
await new Promise(r => servidor.listen(PUERTO, r))
const BASE = `http://localhost:${PUERTO}`

// ── credenciales ────────────────────────────────────────────
let env = {}
try {
  env = Object.fromEntries(
    readFileSync('.env.revision.local', 'utf8')
      .split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
} catch {
  console.error('Falta .env.revision.local con INMERSIA_EMAIL / INMERSIA_PASSWORD')
  process.exit(1)
}
const EMAIL = env.INMERSIA_EMAIL
const PASS = env.INMERSIA_PASSWORD
if (!EMAIL || !PASS) {
  console.error('Faltan INMERSIA_EMAIL o INMERSIA_PASSWORD')
  process.exit(1)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const violaciones = []
const errores = []
let pantallaActual = '(arranque)'

// El evento del documento: es lo único que ve una CSP que bloquea en silencio.
await page.exposeFunction('__cspViolada', d => violaciones.push({ pantalla: pantallaActual, ...d }))
await page.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', e => {
    window.__cspViolada({
      directiva: e.effectiveDirective || e.violatedDirective,
      recurso: (e.blockedURI || '').slice(0, 120),
      linea: e.lineNumber || 0,
    })
  })
})
page.on('console', m => {
  if (m.type() !== 'error') return
  errores.push({ pantalla: pantallaActual, txt: m.text().slice(0, 160) })
})
page.on('pageerror', e =>
  errores.push({ pantalla: pantallaActual, txt: `[pageerror] ${e.message}`.slice(0, 160) })
)

const slugs = new Set()
page.on('response', async r => {
  if (!r.url().includes('/rest/v1/libros')) return
  try {
    const j = await r.json()
    ;(Array.isArray(j) ? j : []).forEach(l => l.slug && slugs.add(l.slug))
  } catch {
    /* no-JSON */
  }
})

// ── landing (pública) y login ───────────────────────────────
pantallaActual = 'Landing'
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

pantallaActual = 'Auth'
await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' })
await page.waitForSelector('input[type="email"]', { timeout: 15000 })
await page.locator('input[type="email"]').last().fill(EMAIL)
await page.locator('input[type="password"]').last().fill(PASS)
await page.getByRole('button', { name: /entrar a la biblioteca/i }).click()
await page.waitForURL(/\/biblioteca/, { timeout: 20000 })
console.log('✓ sesión iniciada (REST y websocket de Supabase pasaron la CSP)\n')

await page.goto(`${BASE}/tienda`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const slug = [...slugs][0]

const PANTALLAS = [
  ['Biblioteca', '/biblioteca'],
  ['Tienda', '/tienda'],
  ['Álbum', '/album'],
  ['Perfil', '/perfil'],
  ...(slug
    ? [
        ['Lector', `/libro/${slug}`],
        ['Cartelera', `/investigacion/${slug}`],
        ['Foro', `/foro/${slug}`],
      ]
    : []),
]
if (!slug) console.log('⚠ sin slug: Lector/Cartelera/Foro se saltan\n')

for (const [nombre, ruta] of PANTALLAS) {
  pantallaActual = nombre
  const antes = violaciones.length
  await page.goto(BASE + ruta, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  const nuevas = violaciones.length - antes
  console.log(`  ${nuevas ? '✗' : '✓'} ${nombre.padEnd(12)} ${nuevas ? `${nuevas} violaciones` : 'limpia'}`)
}

// ── comprobación aparte: las fuentes de Google se aplicaron ──
// Es el único origen externo de estilos; si la CSP lo bloqueara, el texto
// caería a la fuente del sistema sin dar ningún error de JS.
pantallaActual = 'Biblioteca'
await page.goto(BASE + '/biblioteca', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const fuentes = await page.evaluate(async () => {
  await document.fonts.ready
  return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family)
})
const familias = [...new Set(fuentes)]
console.log(`\nFuentes web cargadas: ${familias.length ? familias.join(', ') : '(ninguna)'}`)

// Y que el hover de los libros conserva la regla que se movió del <style>
const hover = await page.evaluate(() =>
  [...document.styleSheets].some(h => {
    try {
      return [...h.cssRules].some(r => r.selectorText === '.inm-bk:hover')
    } catch {
      return false
    }
  })
)
console.log(`Regla .inm-bk:hover presente en las hojas: ${hover ? 'sí' : 'NO'}`)

console.log('\n═══ RESULTADO ═══')
if (violaciones.length === 0) {
  console.log('✓ Ninguna violación de CSP.')
} else {
  console.log(`✗ ${violaciones.length} violaciones de CSP:`)
  const agrupadas = {}
  for (const v of violaciones) {
    const k = `${v.directiva} → ${v.recurso}`
    ;(agrupadas[k] ||= new Set()).add(v.pantalla)
  }
  for (const [k, p] of Object.entries(agrupadas)) console.log(`   · ${k}   [${[...p].join(', ')}]`)
}
if (errores.length) {
  console.log(`\n${errores.length} errores de consola (mirar si son de la CSP o preexistentes):`)
  const vistos = new Set()
  for (const e of errores) {
    if (vistos.has(e.txt)) continue
    vistos.add(e.txt)
    console.log(`   · [${e.pantalla}] ${e.txt}`)
  }
} else {
  console.log('Sin errores de consola.')
}

await browser.close()
servidor.close()
process.exit(violaciones.length ? 1 : 0)
