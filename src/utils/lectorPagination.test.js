import { describe, test, expect } from 'vitest'
import { paginarParrafos, FILL_FACTOR } from './lectorPagination.js'

// Geometría sin window para los tests (valores fijos y predecibles)
const OPTS = {
  charsPerLine:  50,
  lineHeight:    30,
  paragraphGap:  12,
  maxH:         300,
  firstPageMaxH: 300,
}

// Parámetros que hacen visible el bug de GAP antes del fix:
//   maxH(330) es múltiplo exacto de lineH(33), así que el espacio libre
//   siempre tiene un resto de (33 - 20) = 13 px, que es menor que GAP(20).
//   Sin el fix el fragmento excedía free en hasta 7 px.
const OPTS_SPLIT = {
  charsPerLine:  50,
  lineHeight:    33,
  paragraphGap:  20,
  maxH:         330,
  firstPageMaxH: 330,
}

function estimatedH(text, opts) {
  const eCpl  = Math.max(1, Math.floor(opts.charsPerLine * FILL_FACTOR))
  const lines = Math.max(1, Math.ceil(text.length / eCpl))
  return lines * opts.lineHeight + opts.paragraphGap
}

function p(id, contenido) { return { id, tipo: 'parrafo', contenido } }
function sep(id)           { return { id, tipo: 'separador', contenido: '' } }

// Texto largo con espacios — imprescindible para que el split funcione.
// Genera "word0 word1 word2 ..." con patrón predecible para validar bordes.
function words(n) {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────

describe('paginarParrafos — básicos', () => {
  test('lista vacía devuelve [[]]', () => {
    expect(paginarParrafos([], false, OPTS)).toEqual([[]])
  })

  test('párrafos que entran en una página quedan en página 0', () => {
    const pages = paginarParrafos([p(1, 'Hola.'), p(2, 'Mundo.')], false, OPTS)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(2)
  })

  test('párrafo que no entra va a la página siguiente', () => {
    const eCpl = Math.floor(50 * FILL_FACTOR)
    const fill = 'A'.repeat(8 * eCpl)       // 8 líneas → cabe en maxH=300
    const small = 'B'.repeat(eCpl)          // 1 línea más → sigue cabiendo
    const overflow = 'C'.repeat(eCpl * 2)  // 2 líneas → ya no cabe → pag 2
    const pages = paginarParrafos([p(1, fill), p(2, small), p(3, overflow)], false, OPTS)
    expect(pages.length).toBeGreaterThanOrEqual(2)
    expect(pages[0].some(x => x.contenido?.startsWith('C'))).toBe(false)
  })
})

describe('paginarParrafos — separadores', () => {
  test('separador nunca se divide', () => {
    const pages = paginarParrafos([sep(1), p(2, 'Texto.')], false, OPTS)
    const separadores = pages.flat().filter(x => x.tipo === 'separador')
    expect(separadores).toHaveLength(1)
  })
})

describe('paginarParrafos — firstPageMaxH', () => {
  test('primera página respeta firstPageMaxH más chico', () => {
    const opts = { ...OPTS, firstPageMaxH: 120 }
    // words(80) ≈ 550 chars → pH ≈ 402 px, mucho más que firstPageMaxH=120
    const pages = paginarParrafos([p(1, words(80))], false, opts)
    expect(pages.length).toBeGreaterThanOrEqual(2)
  })
})

describe('paginarParrafos — split', () => {
  test('split respeta frontera de palabra', () => {
    const pages = paginarParrafos([p(1, words(200))], false, OPTS)
    if (pages.length < 2) return
    const primera = pages[0].at(-1)?.contenido ?? ''
    const segunda  = pages[1][0]?.contenido     ?? ''
    // Cada fragmento debe contener solo palabras completas del patrón "wordN"
    for (const w of [...primera.trim().split(/\s+/), ...segunda.trim().split(/\s+/)]) {
      expect(w).toMatch(/^word\d+$/)
    }
  })

  test('párrafo sin espacios más largo que maxH no genera loop infinito', () => {
    const pages = paginarParrafos([p(1, 'X'.repeat(5000))], false, OPTS)
    expect(pages.length).toBeGreaterThan(0)
  })

  // Invariante central: tras el split, la altura estimada del fragmento que
  // queda en la página corriente nunca supera el espacio libre disponible.
  // Con OPTS_SPLIT, sin el fix este test falla porque el fragmento excede
  // maxH en ~7 px; con el fix (linesAvail descuenta GAP) siempre pasa.
  test('fragmento del split cabe en el espacio restante', () => {
    const { lineHeight: lineH, paragraphGap: GAP, maxH } = OPTS_SPLIT

    // Caso 1: párrafo largo solo (sin prefijo)
    {
      const pages = paginarParrafos([p(1, words(300))], false, OPTS_SPLIT)
      for (const page of pages) {
        const totalH = page.reduce((acc, par) => acc + (
          par.tipo === 'separador'
            ? Math.round(lineH * 1.2) + 40
            : estimatedH(par.contenido ?? '', OPTS_SPLIT)
        ), 0)
        expect(totalH).toBeLessThanOrEqual(maxH + 1)  // +1 tolerancia de redondeo
      }
    }

    // Caso 2: prefijo + párrafo largo (distintos "restos" de espacio libre)
    const eCpl = Math.max(1, Math.floor(OPTS_SPLIT.charsPerLine * FILL_FACTOR))
    for (let prefixLines = 1; prefixLines <= 5; prefixLines++) {
      const prefix   = 'A'.repeat(prefixLines * eCpl)  // sin espacios, cabe sin split
      const longText = words(300)
      const pages = paginarParrafos([p(10, prefix), p(11, longText)], false, OPTS_SPLIT)
      for (const page of pages) {
        const totalH = page.reduce((acc, par) => acc + (
          par.tipo === 'separador'
            ? Math.round(lineH * 1.2) + 40
            : estimatedH(par.contenido ?? '', OPTS_SPLIT)
        ), 0)
        expect(totalH).toBeLessThanOrEqual(maxH + 1)
      }
    }
  })
})
