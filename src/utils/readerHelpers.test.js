import { describe, it, expect } from 'vitest'
import { offsetDeAnclaje, paginaDeAnclaje } from './readerHelpers.js'

// Fragmenta un texto en trozos de ~n caracteres cortando por palabra,
// simulando lo que hace el paginador con un párrafo largo.
function fragmentar(texto, n) {
  const words = texto.split(' ')
  const out = []
  let cur = []
  for (const w of words) {
    cur.push(w)
    if (cur.join(' ').length >= n) { out.push(cur.join(' ')); cur = [] }
  }
  if (cur.length) out.push(cur.join(' '))
  return out
}

const TEXTO = Array.from({ length: 120 }, (_, i) => `palabra${i}`).join(' ')

// Paginación: una página por fragmento del párrafo largo 'P',
// precedida de una página con un párrafo corto normal.
function paginar(anchoFragmento) {
  const frags = fragmentar(TEXTO, anchoFragmento)
  return [
    [{ id: 'previo', contenido: 'Un párrafo corto anterior.' }],
    ...frags.map(contenido => [{ id: 'P', contenido }]),
  ]
}

describe('offsetDeAnclaje / paginaDeAnclaje', () => {
  it('ida y vuelta en la misma paginación: recupera la misma página', () => {
    const paginas = paginar(200)
    for (let i = 1; i < paginas.length; i++) {
      const off = offsetDeAnclaje(paginas, i, 'P')
      expect(paginaDeAnclaje(paginas, 'P', off)).toBe(i)
    }
  })

  it('entre paginaciones distintas: localiza la página que cubre el mismo punto del texto', () => {
    const movil = paginar(150)     // páginas pequeñas (más fragmentos)
    const tablet = paginar(400)    // páginas grandes (menos fragmentos)
    // ancla guardada desde la última página del móvil (final del párrafo)
    const off = offsetDeAnclaje(movil, movil.length - 1, 'P')
    const idx = paginaDeAnclaje(tablet, 'P', off)
    // debe caer en una de las últimas páginas de la tablet, nunca en la primera del párrafo
    expect(idx).toBeGreaterThan(1)
    // y el punto del texto debe estar cubierto: el acumulado hasta esa página lo alcanza
    const cubiertoHasta = offsetDeAnclaje(tablet, idx + 1, 'P')
    expect(cubiertoHasta).toBeGreaterThan(off)
  })

  it('offset 0 → página donde empieza el párrafo (compatibilidad con filas antiguas)', () => {
    const paginas = paginar(200)
    expect(paginaDeAnclaje(paginas, 'P', 0)).toBe(1)
    expect(paginaDeAnclaje(paginas, 'previo', 0)).toBe(0)
  })

  it('offset más allá del final → última página que contiene el párrafo', () => {
    const paginas = paginar(200)
    expect(paginaDeAnclaje(paginas, 'P', 999999)).toBe(paginas.length - 1)
  })

  it('párrafo inexistente → -1', () => {
    expect(paginaDeAnclaje(paginar(200), 'no-existe', 0)).toBe(-1)
  })

  it('párrafo entero en una sola página → offset 0 y la encuentra', () => {
    const paginas = [[{ id: 'a', contenido: 'texto' }], [{ id: 'b', contenido: 'otro' }]]
    expect(offsetDeAnclaje(paginas, 1, 'b')).toBe(0)
    expect(paginaDeAnclaje(paginas, 'b', 0)).toBe(1)
  })
})
