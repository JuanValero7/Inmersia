// @vitest-environment jsdom
//
// TESTS DE CARACTERIZACIÓN — no de corrección.
//
// Esto no comprueba que el paginador móvil sea correcto: comprueba que SIGUE
// HACIENDO LO QUE HACE HOY. El archivo que prueba costó mucho estabilizar y sus
// fallos no explotan, mueven el texto de sitio en silencio. La red está aquí
// para que, si algún día alguien unifica el núcleo con el de escritorio (hoy
// comparten el 51% del código), se entere en el momento de romper algo.
//
// Si un test de este archivo falla tras un cambio, la pregunta correcta es
// "¿quería cambiar este comportamiento?", no "¿qué expectativa arreglo?".
//
// Las expectativas de abajo se fijaron ejecutando el código real, no
// calculándolas a mano.
import { describe, test, expect, afterEach } from 'vitest'
import { paginarParrafosMobileDOM } from './lectorPaginationMobile.js'

// jsdom no maqueta (offsetHeight siempre es 0), así que simulamos el ajuste de
// línea igual que hace el test de escritorio: una hoja "ocupa" ceil(chars/CPL)
// líneas y un contenedor la suma de sus hijos. Es la misma simulación a
// propósito — así los dos archivos se pueden comparar entre sí.
const CPL    = 40   // caracteres por línea simulados
const LINE_H = 33   // = round(19 * 1.72), el lineH que calcula el móvil por defecto
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

// DIFERENCIA CON ESCRITORIO: el móvil recibe `maxH` ya calculado, no un `pageH`
// del que deduce el alto útil. Lo decide el componente, que conoce el alto real
// de la hoja tras descontar el notch y la barra inferior.
const OPTS = { contentW: 360, maxH: 300, fontSize: 19 }

function p(id, contenido, tipo = 'parrafo') { return { id, tipo, contenido } }
function words(n) { return Array.from({ length: n }, (_, i) => `word${i}`).join(' ') }

describe('paginarParrafosMobileDOM — básicos', () => {
  test('lista vacía devuelve [[]]', () => {
    expect(paginarParrafosMobileDOM([], OPTS)).toEqual([[]])
  })

  test('párrafos cortos entran en una sola página', () => {
    mockLayout()
    const pages = paginarParrafosMobileDOM([p(1, 'Hola.'), p(2, 'Mundo.')], OPTS)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(2)
  })

  test('el texto no se pierde: todas las palabras sobreviven a la paginación', () => {
    mockLayout()
    const original = words(200)
    const pages = paginarParrafosMobileDOM([p(1, original)], OPTS)
    const recompuesto = pages.flat().map(x => x.contenido).join(' ').trim()
    expect(recompuesto.split(/\s+/)).toEqual(original.split(/\s+/))
  })
})

describe('paginarParrafosMobileDOM — guardas de entrada', () => {
  // DIFERENCIA CON ESCRITORIO: sin medidas utilizables el móvil NO pagina,
  // devuelve todo junto en una sola página. Es deliberado: es mejor una hoja
  // larga que se pueda desplazar que un corte calculado con datos inventados.
  test('sin contentW devuelve todos los párrafos en una página', () => {
    mockLayout()
    const entrada = [p(1, words(200)), p(2, words(200))]
    const pages = paginarParrafosMobileDOM(entrada, { ...OPTS, contentW: 0 })
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(2)
  })

  test('sin maxH devuelve todos los párrafos en una página', () => {
    mockLayout()
    const entrada = [p(1, words(200)), p(2, words(200))]
    const pages = paginarParrafosMobileDOM(entrada, { ...OPTS, maxH: 0 })
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(2)
  })
})

describe('paginarParrafosMobileDOM — separadores', () => {
  test('separador nunca se divide', () => {
    mockLayout()
    const pages = paginarParrafosMobileDOM([p(1, '', 'separador'), p(2, 'Texto.')], OPTS)
    const separadores = pages.flat().filter(x => x.tipo === 'separador')
    expect(separadores).toHaveLength(1)
  })

  test('un separador que no cabe pasa entero a la página siguiente', () => {
    mockLayout()
    // 8 líneas = 274px de 298 de presupuesto: el separador (una línea, 43px)
    // ya no entra.
    const pages = paginarParrafosMobileDOM(
      [p(1, 'A'.repeat(8 * CPL - 5)), p(2, '', 'separador'), p(3, 'Después.')], OPTS)
    expect(pages[0].some(x => x.tipo === 'separador')).toBe(false)
    expect(pages[1][0].tipo).toBe('separador')
  })

  // ⚠️ HUECO DE COBERTURA CONOCIDO, anotado en vez de disimulado.
  //
  // En el código hay una guarda `p.tipo === 'separador'` en la condición que
  // decide no partir un párrafo. Hoy es INALCANZABLE, y por eso no hay test
  // que la cubra:
  //
  //   · El separador se mide siempre como '❧' (una línea, ~43px), sin importar
  //     su contenido — ver la línea `pEl.textContent = ... ? '❧' : ...`.
  //   · Para que no quepa, la página tiene que estar llena a más de
  //     budget - 43, así que el hueco restante es siempre menor de 43px.
  //   · `huecoUtil` exige un hueco de MIN_SPLIT_LINES × lineH = 2 × 33 = 66px.
  //   · 43 < 66 ⇒ cuando un separador no cabe, `huecoUtil` es siempre falso y
  //     la otra mitad de la condición ya decide lo mismo.
  //
  // Se comprobó quitando la guarda del código: los 13 tests siguen en verde.
  // NO es código muerto: si alguien baja MIN_SPLIT_LINES a 1, el hueco pasa a
  // ser 33px, 43 > 33 deja de cumplirse siempre, y la guarda empieza a hacer
  // falta de verdad. Déjala.
})

describe('paginarParrafosMobileDOM — split por palabra', () => {
  test('split respeta frontera de palabra', () => {
    mockLayout()
    const pages = paginarParrafosMobileDOM([p(1, words(200))], OPTS)
    expect(pages.length).toBeGreaterThanOrEqual(2)
    for (const page of pages) {
      for (const item of page) {
        for (const w of (item.contenido ?? '').trim().split(/\s+/).filter(Boolean)) {
          expect(w).toMatch(/^word\d+$/)
        }
      }
    }
  })

  test('los trozos de un párrafo partido conservan su id', () => {
    mockLayout()
    const pages = paginarParrafosMobileDOM([p(42, words(200))], OPTS)
    expect(pages.length).toBeGreaterThanOrEqual(2)
    for (const item of pages.flat()) expect(item.id).toBe(42)
  })

  test('párrafo sin espacios más largo que la página no genera loop infinito', () => {
    mockLayout()
    const pages = paginarParrafosMobileDOM([p(1, 'X'.repeat(5000))], OPTS)
    expect(pages.length).toBeGreaterThan(0)
  })
})

describe('paginarParrafosMobileDOM — hueco mínimo para partir (MIN_SPLIT_LINES)', () => {
  // La heurística: si en la página ya hay algo y el hueco que queda es menor
  // que MIN_SPLIT_LINES líneas, no vale la pena partir el párrafo siguiente —
  // pasa entero a la página siguiente. Si el hueco SÍ da, se parte para
  // aprovechar el espacio.
  //
  // Los dos tests van en pareja: uno fija cada lado de la decisión. Sin el
  // primero, subir MIN_SPLIT_LINES pasa desapercibido (comprobado subiéndolo
  // a 99 y viendo la suite en verde).

  test('con hueco suficiente, el párrafo largo se parte para llenar la página', () => {
    mockLayout()
    // 5 líneas = 175px de 298 de presupuesto → quedan 123px, casi 4 líneas.
    const cabecera = p(1, 'A'.repeat(5 * CPL - 5))
    const pages = paginarParrafosMobileDOM([cabecera, p(2, words(200))], OPTS)
    // La página 0 se lleva la cabecera MÁS un trozo del párrafo largo.
    expect(pages[0]).toHaveLength(2)
    expect(pages[0][1].id).toBe(2)
    expect(pages[0][1].contenido.length).toBeLessThan(words(200).length)
  })

  test('con hueco insuficiente, el párrafo largo pasa entero a la siguiente', () => {
    mockLayout()
    // 8 líneas = 274px de 298 → quedan 24px, menos de una línea.
    const cabecera = p(1, 'A'.repeat(8 * CPL - 5))
    const pages = paginarParrafosMobileDOM([cabecera, p(2, words(200))], OPTS)
    expect(pages[0]).toHaveLength(1)
    expect(pages[0][0].id).toBe(1)
  })
})

describe('paginarParrafosMobileDOM — encabezado de capítulo', () => {
  // El encabezado solo existe en la página 0 y come alto de esa página, así
  // que con él caben menos párrafos que sin él.
  test('el encabezado reduce lo que cabe en la primera página', () => {
    mockLayout()
    const entrada = Array.from({ length: 6 }, (_, i) => p(i, 'B'.repeat(CPL)))
    const sinHead = paginarParrafosMobileDOM(entrada, OPTS)
    const conHead = paginarParrafosMobileDOM(entrada, {
      ...OPTS, chapterHead: { kicker: 'CAPÍTULO I', titulo: 'El naufragio' },
    })
    expect(conHead[0].length).toBeLessThan(sinHead[0].length)
  })
})
