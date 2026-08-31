// scripts/medir-layout.mjs — mide desbordes reales en el banco de pruebas
// (probe.html). Uso: node scripts/medir-layout.mjs [url]
//
// Por cada ancho y pestaña reporta:
//   · desborde horizontal del documento (scrollWidth > clientWidth)
//   · cualquier elemento cuyo contenido no cabe en su caja
//   · el ancho REAL de la columna de texto del spotlight, que es lo que
//     se colapsa a cero antes de que se vea desborde alguno.
import { chromium } from 'playwright'

const URL = process.argv[2] || 'http://localhost:5173/probe.html'
const ANCHOS = [860, 900, 1024, 1100, 1280, 1440, 1920]
const TABS = ['Seguir leyendo', 'Novedades', 'Recomendaciones']

const medir = () => {
  const fuera = []
  document.querySelectorAll('*').forEach(el => {
    const d = el.scrollWidth - el.clientWidth
    if (d > 1 && el.clientWidth > 0 && getComputedStyle(el).overflowX === 'visible') {
      // Solo el desborde MÁS INTERNO: si un padre y su hijo se salen lo mismo,
      // el culpable es el hijo.
      if ([...el.children].some(c => c.scrollWidth - c.clientWidth >= d - 1)) return
      const st = getComputedStyle(el)
      fuera.push({
        exceso: d, w: el.clientWidth,
        flex: st.flex, dir: st.flexDirection,
        txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
        hijos: [...el.children].map(c => {
          const cs = getComputedStyle(c)
          return `${c.tagName.toLowerCase()}[${Math.round(c.getBoundingClientRect().width)}px flex:${cs.flex}]`
        }).join(' + '),
      })
    }
  })
  // Columna de texto del spotlight: el hijo flex:1 del contenedor del spotlight.
  const cols = [...document.querySelectorAll('div')]
    .filter(el => getComputedStyle(el).flexGrow === '1' && el.offsetHeight >= 250 && el.offsetHeight <= 320)
    .map(el => Math.round(el.getBoundingClientRect().width))
  return {
    docDesborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    swimlane: Math.round(document.getElementById('col-swimlane').getBoundingClientRect().width),
    colTexto: cols,
    fuera: fuera.slice(0, 6),
  }
}

const browser = await chromium.launch()
const page = await browser.newPage()
for (const w of ANCHOS) {
  await page.setViewportSize({ width: w, height: 900 })
  await page.goto(URL, { waitUntil: 'networkidle' })
  console.log(`\n═══ ${w}px ${'═'.repeat(46)}`)
  for (const tab of TABS) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await page.waitForTimeout(120)
    const r = await page.evaluate(medir)
    const cols = r.colTexto.length ? r.colTexto.join(', ') + 'px' : '—'
    const mal = r.docDesborde > 0 || r.fuera.length > 0 || r.colTexto.some(c => c < 160)
    console.log(`  ${mal ? '✗' : '✓'} ${tab.padEnd(16)} swimlane=${String(r.swimlane).padStart(4)}  col.texto=${cols.padEnd(14)} doc+${r.docDesborde}`)
    for (const f of r.fuera) {
      console.log(`      ↳ se sale ${f.exceso}px | caja ${f.w}px | flex:${f.flex} ${f.dir}`)
      console.log(`        hijos: ${f.hijos}`)
      console.log(`        texto: "${f.txt}"`)
    }
  }
}
await browser.close()
