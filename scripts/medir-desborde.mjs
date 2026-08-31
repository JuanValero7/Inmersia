// scripts/medir-desborde.mjs — detector genérico de desborde horizontal.
// Uso: node scripts/medir-desborde.mjs <url> [anchos separados por coma]
// Recorre los anchos dados y reporta el elemento MÁS INTERNO que no cabe en
// su caja. Sirve para cualquier pantalla; para las que piden login, abrí el
// navegador con `--headed` no alcanza: usá el banco de pruebas (probe.html).
import { chromium } from 'playwright'

const url = process.argv[2]
if (!url) { console.error('falta la url'); process.exit(1) }
const anchos = (process.argv[3] || '860,900,1024,1100,1280,1440').split(',').map(Number)

const medir = () => {
  const fuera = []
  document.querySelectorAll('*').forEach(el => {
    const d = el.scrollWidth - el.clientWidth
    if (d <= 1 || el.clientWidth === 0) return
    if (getComputedStyle(el).overflowX !== 'visible') return
    if ([...el.children].some(c => c.scrollWidth - c.clientWidth >= d - 1)) return
    fuera.push({ exceso: d, w: el.clientWidth, cls: el.className?.toString().slice(0, 30) || '',
      txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 45) })
  })
  return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, fuera: fuera.slice(0, 8) }
}

const browser = await chromium.launch()
const page = await browser.newPage()
for (const w of anchos) {
  await page.setViewportSize({ width: w, height: 900 })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const r = await page.evaluate(medir)
  console.log(`${r.doc === 0 && !r.fuera.length ? '✓' : '✗'} ${String(w).padStart(4)}px   doc+${r.doc}`)
  for (const f of r.fuera) console.log(`     ↳ .${f.cls} se sale ${f.exceso}px (caja ${f.w}px) — "${f.txt}"`)
}
await browser.close()
