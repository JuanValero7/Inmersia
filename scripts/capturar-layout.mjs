// scripts/capturar-layout.mjs — capturas del banco de pruebas para revisar a ojo.
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const URL = process.argv[2] || 'http://localhost:5173/probe.html'
const OUT = process.argv[3] || 'capturas'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()
for (const w of [860, 900, 1024, 1440]) {
  await page.setViewportSize({ width: w, height: 820 })
  await page.goto(URL, { waitUntil: 'networkidle' })
  for (const [tab, slug] of [['Seguir leyendo', 'seguir'], ['Novedades', 'novedades'], ['Recomendaciones', 'recom']]) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${OUT}/${w}-${slug}.png` })
  }
}
await browser.close()
console.log('listo →', OUT)
