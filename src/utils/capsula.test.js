import { describe, it, expect } from 'vitest'
import { respuestaValida, completas, tocaAlEmpezar, tocaAlTerminar, fechaCapsula, MAX_CARACTERES } from './capsula.js'

const capsula = (estado, extra = {}) => ({
  preguntas: [{ id: 'a', texto: '¿Quién crees que inventó el dinero?' }],
  estado, sellada_at: null, abierta_at: null, puede_sellar: estado === 'nueva', con_profe: false, ...extra,
})

describe('respuestas', () => {
  it('pide al menos 3 caracteres sin contar espacios', () => {
    expect(respuestaValida('  ab  ')).toBe(false)
    expect(respuestaValida('Un rey')).toBe(true)
  })
  it('no pasa del máximo', () => {
    expect(respuestaValida('x'.repeat(MAX_CARACTERES))).toBe(true)
    expect(respuestaValida('x'.repeat(MAX_CARACTERES + 1))).toBe(false)
  })
  it('completas = todas respondidas y tantas como preguntas', () => {
    expect(completas(['Un rey', 'El banco'], 2)).toBe(true)
    expect(completas(['Un rey', ''], 2)).toBe(false)
    expect(completas(['Un rey'], 2)).toBe(false)
  })
})

describe('tocaAlEmpezar', () => {
  it('salta en el capítulo 1 si no está sellada', () => {
    expect(tocaAlEmpezar(capsula('nueva'), 0, false)).toBe(true)
  })
  it('no salta con «Ahora no» en esta sesión', () => {
    expect(tocaAlEmpezar(capsula('nueva'), 0, true)).toBe(false)
  })
  it('no salta si ya terminó algún capítulo (lo dice la base de datos)', () => {
    expect(tocaAlEmpezar(capsula('nueva', { puede_sellar: false }), 0, false)).toBe(false)
  })
  it('no salta fuera del capítulo 1, ni sellada, ni sin cápsula', () => {
    expect(tocaAlEmpezar(capsula('nueva'), 1, false)).toBe(false)
    expect(tocaAlEmpezar(capsula('sellada'), 0, false)).toBe(false)
    expect(tocaAlEmpezar(null, 0, false)).toBe(false)
  })
})

describe('tocaAlTerminar', () => {
  it('salta al pasar del último capítulo si está sellada', () => {
    expect(tocaAlTerminar(capsula('sellada'), true, false)).toBe(true)
  })
  it('no salta antes del final, sin sellar, ya abierta o cerrada', () => {
    expect(tocaAlTerminar(capsula('sellada'), false, false)).toBe(false)
    expect(tocaAlTerminar(capsula('nueva'), true, false)).toBe(false)
    expect(tocaAlTerminar(capsula('abierta'), true, false)).toBe(false)
    expect(tocaAlTerminar(capsula('sellada'), true, true)).toBe(false)
  })
})

describe('fechaCapsula', () => {
  it('día, mes corto y año', () => {
    expect(fechaCapsula('2026-11-10T15:00:00Z')).toBe('10 nov 2026')
  })
  it('vacía sin fecha', () => {
    expect(fechaCapsula(null)).toBe('')
    expect(fechaCapsula('basura')).toBe('')
  })
})
