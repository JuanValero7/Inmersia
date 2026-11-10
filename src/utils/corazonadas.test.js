import { describe, it, expect } from 'vitest'
import { conCorazonadas, sinInsertos } from './corazonadas.js'

const p = (numero) => ({ id: `p${numero}`, numero, contenido: `Párrafo ${numero}.` })
const chip = (id, parrafo) => ({ id, chip: { cap: 1, parrafo } })

describe('conCorazonadas', () => {
  it('mete el chip justo después de su párrafo', () => {
    const r = conCorazonadas([p(1), p(2), p(3)], [chip('perlas', 2)])
    expect(r.map(x => x.id)).toEqual(['p1', 'p2', 'cz-perlas', 'p3'])
    expect(r[2]).toMatchObject({ tipo: 'corazonada', corazonadaId: 'perlas' })
  })
  it('sin chips devuelve la misma lista', () => {
    const ps = [p(1)]
    expect(conCorazonadas(ps, [])).toBe(ps)
  })
})

describe('sinInsertos', () => {
  it('quita los chips sin cambiar el número de páginas', () => {
    const pags = [[p(1), { id: 'cz-a', tipo: 'corazonada' }], [{ id: 'cz-b', tipo: 'corazonada' }], [p(2)]]
    const r = sinInsertos(pags)
    expect(r).toHaveLength(3)
    expect(r.map(pg => pg.map(x => x.id))).toEqual([['p1'], [], ['p2']])
  })
  it('quita también los párrafos falsos del falsificador', () => {
    const pags = [[p(1), { id: 'fx-f1', tipo: 'falso' }], [{ id: 'fx-f1', tipo: 'falso' }, p(2)]]
    expect(sinInsertos(pags).map(pg => pg.map(x => x.id))).toEqual([['p1'], ['p2']])
  })
  it('sin chips devuelve las mismas páginas', () => {
    const pags = [[p(1)]]
    expect(sinInsertos(pags)).toBe(pags)
  })
})
