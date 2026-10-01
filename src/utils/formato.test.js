import { describe, it, expect } from 'vitest'
import { anioMostrar, minutosLectura, tiempoLectura, seLeeEnUnaTarde, partirSinopsis, recortar } from './formato.js'

describe('anioMostrar', () => {
  it('prefiere anio_texto cuando existe', () => {
    expect(anioMostrar({ anio: -500, anio_texto: 's. V a. C.' })).toBe('s. V a. C.')
  })
  it('usa el año numérico si no hay texto', () => {
    expect(anioMostrar({ anio: 1887, anio_texto: null })).toBe('1887')
  })
  it('devuelve vacío sin dato', () => {
    expect(anioMostrar({ anio: null })).toBe('')
    expect(anioMostrar(null)).toBe('')
  })
})

describe('tiempoLectura', () => {
  it('redondea de 5 en 5 por debajo de una hora', () => {
    expect(tiempoLectura(230 * 43)).toBe('≈ 45 min')
    expect(tiempoLectura(230 * 2)).toBe('≈ 5 min')
  })
  it('redondea de 10 en 10 desde una hora', () => {
    expect(tiempoLectura(230 * 83)).toBe('≈ 1 h 20 min')
    expect(tiempoLectura(230 * 118)).toBe('≈ 2 h')
  })
  it('sin palabras no muestra nada', () => {
    expect(tiempoLectura(0)).toBe('')
    expect(minutosLectura(null)).toBe(0)
  })
})

describe('seLeeEnUnaTarde', () => {
  it('cabe con 2 h o menos', () => {
    expect(seLeeEnUnaTarde(230 * 120)).toBe(true)
    expect(seLeeEnUnaTarde(230 * 121)).toBe(false)
    expect(seLeeEnUnaTarde(0)).toBe(false)
  })
})

describe('partirSinopsis', () => {
  it('separa el primer párrafo del resto', () => {
    const { entrada, resto } = partirSinopsis('Gancho.\n\nUno.\n\n  Dos.  ')
    expect(entrada).toBe('Gancho.')
    expect(resto).toBe('Uno.\n\nDos.')
  })
  it('aguanta texto vacío', () => {
    expect(partirSinopsis(null)).toEqual({ entrada: '', resto: '' })
  })
})

describe('recortar', () => {
  it('corta en un espacio y añade puntos suspensivos', () => {
    expect(recortar('uno dos tres cuatro', 10)).toBe('uno dos…')
  })
  it('no toca lo que ya cabe', () => {
    expect(recortar('corto', 10)).toBe('corto')
  })
})
