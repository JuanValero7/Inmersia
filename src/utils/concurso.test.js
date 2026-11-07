import { describe, it, expect } from 'vitest'
import { normalizar, ubicarCita, contarPalabras } from './concurso.js'

const PARRAFO = '––Exponga su caso.\nMe pareció que mi presencia resultaba embarazosa. Me levanté.'

describe('normalizar', () => {
  it('junta espacios y guiones y unifica comillas', () => {
    expect(normalizar('a  \n b –– «c»').s).toBe('a b - "c"')
  })
  it('recuerda dónde estaba cada letra', () => {
    const { s, mapa } = normalizar('a  b')
    expect(s).toBe('a b')
    expect(mapa).toEqual([0, 1, 3])
  })
})

describe('ubicarCita', () => {
  it('encuentra la cita entera y devuelve su sitio en el original', () => {
    const cita = 'Me pareció que mi presencia resultaba embarazosa.'
    const r = ubicarCita(PARRAFO, cita)
    expect(r?.tipo).toBe('entera')
    expect(PARRAFO.slice(r.start, r.end)).toBe(cita)
  })
  it('ignora diferencias de guiones, comillas y saltos de línea', () => {
    const r = ubicarCita('Dijo: «Exponga\nsu caso» –– y calló.', 'Dijo: "Exponga su caso" - y calló.')
    expect(r?.tipo).toBe('entera')
  })
  it('detecta la cabeza cuando la cita sigue en la página siguiente', () => {
    const trozo = 'Algo antes. Me pareció que mi presencia'
    const r = ubicarCita(trozo, 'Me pareció que mi presencia resultaba embarazosa.')
    expect(r?.tipo).toBe('cabeza')
    expect(trozo.slice(r.start, r.end)).toBe('Me pareció que mi presencia')
  })
  it('detecta la cola cuando la cita empezó en la página anterior', () => {
    const trozo = 'presencia resultaba embarazosa. Me levanté.'
    const r = ubicarCita(trozo, 'Me pareció que mi presencia resultaba embarazosa.')
    expect(r?.tipo).toBe('cola')
    expect(trozo.slice(r.start, r.end)).toBe('presencia resultaba embarazosa.')
  })
  it('no confunde trozos cortos', () => {
    expect(ubicarCita('Una frase que termina en Me', 'Me pareció que mi presencia resultaba embarazosa.')).toBeNull()
  })
})

describe('contarPalabras', () => {
  it('cuenta palabras separadas por cualquier espacio', () => {
    expect(contarPalabras('  que  se\nsentía incómodo ')).toBe(4)
    expect(contarPalabras('')).toBe(0)
  })
})
