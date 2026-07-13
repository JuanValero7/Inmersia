// @vitest-environment jsdom
import { describe, test, expect, afterEach } from 'vitest'
import { paginarParrafosDesktopDOM } from './lectorPagination.js'

// jsdom no calcula layout real (offsetHeight siempre es 0), así que para poder
// probar el paginador DOM real simulamos el ajuste de línea: cada elemento hoja
// "ocupa" ceil(chars / CPL) líneas, y un contenedor ocupa la suma de sus hijos.
const CPL    = 40   // caracteres por línea simulados
const LINE_H = 33   // ~round(18 * 1.85), igual que calcula el código fuente
const GAP    = 10   // margen reservado por párrafo en la simulación

function estimatedH(text) {
  const lines = Math.max(1, Math.ceil((text?.length || 0) / CPL))
  return lines * LINE_H + GAP
}

let restoreOffsetHeight = null

function mockLayout() {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      if (this.children.length === 0) return estimatedH(this.textContent)
      let total = 0
      for (const child of this.children) total += child.offsetHeight
      return total
    },
  })
  restoreOffsetHeight = () => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
    else delete HTMLElement.prototype.offsetHeight
  }
}

afterEach(() => {
  restoreOffsetHeight?.()
  restoreOffsetHeight = null
})

// pageH=380 → maxH = round(380*0.79) = 300, alineado con LINE_H/GAP de arriba.
const OPTS = { pageW: 800, pageH: 380, fontSize: 18 }

function p(id, contenido, tipo = 'parrafo') { return { id, tipo, contenido } }
function words(n) { return Array.from({ length: n }, (_, i) => `word${i}`).join(' ') }

describe('paginarParrafosDesktopDOM — básicos', () => {
  test('lista vacía devuelve [[]]', () => {
    expect(paginarParrafosDesktopDOM([], OPTS)).toEqual([[]])
  })

  test('párrafos cortos entran en una sola página', () => {
    mockLayout()
    const pages = paginarParrafosDesktopDOM([p(1, 'Hola.'), p(2, 'Mundo.')], OPTS)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(2)
  })

  test('párrafo que no entra va a la página siguiente', () => {
    mockLayout()
    const fill     = 'A'.repeat(6 * CPL)   // 6 líneas → 208px, cabe en maxH=300
    const small    = 'B'.repeat(CPL)       // 1 línea más → 251px, sigue cabiendo
    const overflow = 'C'.repeat(2 * CPL)   // sin espacios: no se puede partir por palabra
    const pages = paginarParrafosDesktopDOM([p(1, fill), p(2, small), p(3, overflow)], OPTS)
    expect(pages.length).toBeGreaterThanOrEqual(2)
    expect(pages[0].some(x => x.contenido?.startsWith('C'))).toBe(false)
  })
})

describe('paginarParrafosDesktopDOM — separadores', () => {
  test('separador nunca se divide', () => {
    mockLayout()
    const pages = paginarParrafosDesktopDOM([p(1, '', 'separador'), p(2, 'Texto.')], OPTS)
    const separadores = pages.flat().filter(x => x.tipo === 'separador')
    expect(separadores).toHaveLength(1)
  })
})

describe('paginarParrafosDesktopDOM — split', () => {
  test('split respeta frontera de palabra', () => {
    mockLayout()
    const pages = paginarParrafosDesktopDOM([p(1, words(200))], OPTS)
    expect(pages.length).toBeGreaterThanOrEqual(2)
    for (const page of pages) {
      for (const item of page) {
        for (const w of (item.contenido ?? '').trim().split(/\s+/).filter(Boolean)) {
          expect(w).toMatch(/^word\d+$/)
        }
      }
    }
  })

  test('párrafo sin espacios más largo que maxH no genera loop infinito', () => {
    mockLayout()
    const pages = paginarParrafosDesktopDOM([p(1, 'X'.repeat(5000))], OPTS)
    expect(pages.length).toBeGreaterThan(0)
  })
})
