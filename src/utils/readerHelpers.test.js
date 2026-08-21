import { describe, it, expect } from 'vitest'
import { offsetDeAnclaje, paginaDeAnclaje, marcasDelParrafo } from './readerHelpers.js'

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

// ── Marcas sobre el párrafo (SFX + subrayados) ──────────────────────────────
const sfxDe = (ref) => ({ metadata: { texto_ref: ref } })
// Reconstruir el texto desde los segmentos debe devolver el original: ningún
// carácter se pierde ni se duplica al trocear.
const reconstruir = (segs) => segs.map(s => s.text).join('')

describe('marcasDelParrafo', () => {
  const T = 'El mar estaba en calma y el faro seguía encendido.'

  it('sin marcas devuelve segmentos null (texto plano)', () => {
    const { segmentos, sfxSinAnclar, anclados } = marcasDelParrafo(T, [], [])
    expect(segmentos).toBe(null)
    expect(sfxSinAnclar).toEqual([])
    expect(anclados).toBe(0)
  })

  it('marca el subrayado sin tocar el resto del texto', () => {
    const { segmentos } = marcasDelParrafo(T, [], ['estaba en calma'])
    expect(reconstruir(segmentos)).toBe(T)
    expect(segmentos.filter(s => s.subrayado).map(s => s.text)).toEqual(['estaba en calma'])
  })

  it('un tramo dentro del subrayado y del SFX lleva las dos marcas', () => {
    const { segmentos } = marcasDelParrafo(T, [sfxDe('el faro')], ['y el faro seguía'])
    expect(reconstruir(segmentos)).toBe(T)
    const ambas = segmentos.filter(s => s.subrayado && s.sfx)
    expect(ambas.map(s => s.text)).toEqual(['el faro'])
    // el resto del subrayado sigue marcado, sin sonido
    expect(segmentos.filter(s => s.subrayado && !s.sfx).map(s => s.text)).toEqual(['y ', ' seguía'])
  })

  it('subrayados solapados no duplican ni pierden texto', () => {
    const { segmentos } = marcasDelParrafo(T, [], ['mar estaba en', 'estaba en calma'])
    expect(reconstruir(segmentos)).toBe(T)
    expect(segmentos.filter(s => s.subrayado).map(s => s.text).join('')).toBe('mar estaba en calma')
  })

  it('marca la parte visible cuando la paginación parte el subrayado', () => {
    const subrayado = 'el faro seguía encendido'
    const primera = 'El mar estaba en calma y el faro'          // fragmento que cierra la página
    const segunda = 'seguía encendido.'                          // fragmento que abre la siguiente
    expect(marcasDelParrafo(primera, [], [subrayado]).segmentos.filter(s => s.subrayado).map(s => s.text))
      .toEqual(['el faro'])
    expect(marcasDelParrafo(segunda, [], [subrayado]).segmentos.filter(s => s.subrayado).map(s => s.text))
      .toEqual(['seguía encendido'])
  })

  it('un subrayado de otro fragmento no marca nada', () => {
    expect(marcasDelParrafo(T, [], ['una frase que no está acá']).segmentos).toBe(null)
  })

  it('los SFX sin texto_ref salen aparte, para iluminar el párrafo entero', () => {
    const suelto = { metadata: {} }
    const { segmentos, sfxSinAnclar, anclados } = marcasDelParrafo(T, [suelto], [])
    expect(segmentos).toBe(null)
    expect(sfxSinAnclar).toEqual([suelto])
    expect(anclados).toBe(0)
  })
})
