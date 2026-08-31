// scripts/revisar-pantallas.mjs
// ─────────────────────────────────────────────────────────────
// Barrido de adaptabilidad de TODAS las pantallas de escritorio.
// Entra con una cuenta real (las pantallas piden login), recorre cada
// ruta en varios anchos, reporta desbordes y guarda capturas.
//
// Credenciales: NUNCA por argumento (quedan en el historial del shell).
// Se leen de .env.revision.local, que .gitignore ya cubre vía `.env.*.local`:
//     INMERSIA_EMAIL=tu@correo.com
//     INMERSIA_PASSWORD=tu-clave
//
// Uso: node scripts/revisar-pantallas.mjs [urlBase] [carpetaCapturas]
// ─────────────────────────────────────────────────────────────
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'fs'

const BASE = process.argv[2] || 'http://localhost:5199'
const OUT  = process.argv[3] || 'capturas-revision'
const ANCHOS   = [860, 900, 1024, 1100, 1280, 1440]
const CAPTURAS = [900, 1024, 1280]   // menos anchos: son para mirar a ojo

// ── credenciales ────────────────────────────────────────────
let env = {}
try {
  env = Object.fromEntries(readFileSync('.env.revision.local', 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
} catch {
  console.error('Falta .env.revision.local con INMERSIA_EMAIL / INMERSIA_PASSWORD')
  process.exit(1)
}
const EMAIL = env.INMERSIA_EMAIL, PASS = env.INMERSIA_PASSWORD
if (!EMAIL || !PASS) { console.error('Faltan INMERSIA_EMAIL o INMERSIA_PASSWORD'); process.exit(1) }

// ── detector: el elemento MÁS INTERNO que no cabe en su caja ──
const medir = () => {
  const fuera = []
  document.querySelectorAll('*').forEach(el => {
    const d = el.scrollWidth - el.clientWidth
    if (d <= 1 || el.clientWidth === 0) return
    if (getComputedStyle(el).overflowX !== 'visible') return
    if ([...el.children].some(c => c.scrollWidth - c.clientWidth >= d - 1)) return
    fuera.push({ exceso: d, w: el.clientWidth,
      cls: el.className?.toString().slice(0, 34) || '(sin clase)',
      txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 42) })
  })
  // Además: lo que se sale del viewport aunque su padre lo recorte
  // (`overflow-x: hidden` en body esconde el síntoma, no el problema).
  const vw = document.documentElement.clientWidth
  const escapan = []
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    if (getComputedStyle(el).position === 'fixed') return
    if (r.right > vw + 2 || r.left < -2) {
      if ([...el.children].some(c => { const b = c.getBoundingClientRect(); return b.right > vw + 2 || b.left < -2 })) return
      escapan.push({ cls: el.className?.toString().slice(0, 34) || '(sin clase)',
        izq: Math.round(r.left), der: Math.round(r.right),
        txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 42) })
    }
  })
  return { doc: document.documentElement.scrollWidth - vw, fuera: fuera.slice(0, 5), escapan: escapan.slice(0, 5) }
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

// Los slugs no se saben de antemano: se pescan de la respuesta de Supabase.
const slugs = new Set()
page.on('response', async r => {
  if (!r.url().includes('/rest/v1/libros')) return
  try {
    const j = await r.json()
    ;(Array.isArray(j) ? j : []).forEach(l => { if (l.slug) slugs.add(l.slug) })
  } catch { /* respuesta no-JSON, da igual */ }
})

// ── login ───────────────────────────────────────────────────
// /auth redirige a la raíz y abre el pop-up en la pestaña de login
// (ver AuthRedirect en App.jsx), así no hace falta cazar el enlace.
await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' })
await page.waitForSelector('input[type="email"]', { timeout: 15000 })
await page.locator('input[type="email"]').last().fill(EMAIL)
await page.locator('input[type="password"]').last().fill(PASS)
await page.getByRole('button', { name: /entrar a la biblioteca/i }).click()
await page.waitForURL(/\/biblioteca/, { timeout: 20000 })
console.log('✓ sesión iniciada\n')

await page.goto(`${BASE}/tienda`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const slug = [...slugs][0]
if (!slug) console.log('⚠ no se pudo pescar ningún slug: Lector/Cartelera/Foro se saltan\n')

const PANTALLAS = [
  ['Biblioteca', '/biblioteca'],
  ['Tienda',     '/tienda'],
  ['Álbum',      '/album'],
  ['Perfil',     '/perfil'],
  ...(slug ? [
    ['Lector',    `/libro/${slug}`],
    ['Cartelera', `/investigacion/${slug}`],
    ['Foro',      `/foro/${slug}`],
  ] : []),
]

let problemas = 0
for (const [nombre, ruta] of PANTALLAS) {
  console.log(`═══ ${nombre}  (${ruta})`)
  for (const w of ANCHOS) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto(BASE + ruta, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    const r = await page.evaluate(medir)
    const mal = r.doc > 0 || r.fuera.length > 0 || r.escapan.length > 0
    if (mal) problemas++
    console.log(`  ${mal ? '✗' : '✓'} ${String(w).padStart(4)}px   doc+${r.doc}`)
    for (const f of r.fuera)   console.log(`      ↳ .${f.cls} se sale ${f.exceso}px de su caja (${f.w}px) — "${f.txt}"`)
    for (const e of r.escapan) console.log(`      ⇥ .${e.cls} fuera de pantalla [${e.izq}..${e.der}] — "${e.txt}"`)
    if (CAPTURAS.includes(w)) {
      await page.screenshot({ path: `${OUT}/${nombre.replace(/[^\wÁ-ú]/g, '')}-${w}.png`, fullPage: false })
    }
  }
  console.log('')
}
console.log(problemas ? `${problemas} combinaciones con problemas.` : 'Sin problemas en ningún ancho.')
await browser.close()
