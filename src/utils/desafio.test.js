import { describe, it, expect } from 'vitest'
import { momentoQueToca, piezasCharla, mensajesQueQuedan } from './desafio.js'

const momento = (momento, tras, estado = 'nueva', turnos = []) => ({
  momento, tras_capitulo: tras, estado, turnos,
  pregunta: { id: `${momento}_x`, tipo: 'amigo', consigna: '¿Serías amigo de Holmes?' },
})

describe('momentoQueToca', () => {
  const momentos = [momento('mitad', 7), momento('final', 12)]

  it('no salta antes del capítulo del momento', () => {
    expect(momentoQueToca(momentos, 6, new Set())).toBeNull()
  })
  it('salta al terminar el capítulo de la mitad', () => {
    expect(momentoQueToca(momentos, 7, new Set())?.momento).toBe('mitad')
  })
  it('si lo dejó para luego, se ofrece al terminar otro capítulo más adelante', () => {
    expect(momentoQueToca(momentos, 9, new Set())?.momento).toBe('mitad')
  })
  it('«Ahora no» lo calla el resto de la sesión', () => {
    expect(momentoQueToca(momentos, 9, new Set(['mitad']))).toBeNull()
  })
  it('al final del libro va primero la mitad pendiente y después el final', () => {
    expect(momentoQueToca(momentos, 12, new Set())?.momento).toBe('mitad')
    expect(momentoQueToca(momentos, 12, new Set(['mitad']))?.momento).toBe('final')
  })
  it('una charla terminada no vuelve a saltar', () => {
    const hechos = [momento('mitad', 7, 'terminada'), momento('final', 12)]
    expect(momentoQueToca(hechos, 12, new Set())?.momento).toBe('final')
  })
  it('sin capítulo no salta', () => {
    expect(momentoQueToca(momentos, null, new Set())).toBeNull()
  })
})

describe('piezasCharla', () => {
  it('sin empezar: la consigna de la pregunta y ningún mensaje', () => {
    expect(piezasCharla(momento('mitad', 7))).toEqual({ consigna: '¿Serías amigo de Holmes?', mensajes: [] })
  })
  it('empezada: el primer turno del gato es la pregunta', () => {
    const m = momento('mitad', 7, 'abierta', [
      { de: 'gato', texto: 'La pregunta' }, { de: 'alumno', texto: 'Sí' }, { de: 'gato', texto: '¿Por qué?' },
    ])
    expect(piezasCharla(m)).toEqual({ consigna: 'La pregunta', mensajes: [{ de: 'alumno', texto: 'Sí' }, { de: 'gato', texto: '¿Por qué?' }] })
  })
})

describe('mensajesQueQuedan', () => {
  it('cuenta solo los del alumno, con 3 como máximo', () => {
    const m = momento('mitad', 7, 'abierta', [{ de: 'gato', texto: 'a' }, { de: 'alumno', texto: 'b' }, { de: 'gato', texto: 'c' }])
    expect(mensajesQueQuedan(m)).toBe(2)
    expect(mensajesQueQuedan(momento('mitad', 7))).toBe(3)
  })
})
