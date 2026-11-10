import { describe, it, expect } from 'vitest'
import { conFalsos, esComienzo, trozoEn, resumenFalsificador, idFalso } from './falsificador.js'

const p = (numero) => ({ id: `p${numero}`, numero, contenido: `Párrafo ${numero}.` })
const falso = (id, parrafo) => ({ id, cap: 2, parrafo, texto: `Texto inventado ${id} con varias palabras.` })

describe('conFalsos', () => {
  it('mete el falso justo después de su párrafo', () => {
    const r = conFalsos([p(1), p(2), p(3)], [falso('f1', 2)])
    expect(r.map(x => x.id)).toEqual(['p1', 'p2', idFalso('f1'), 'p3'])
    expect(r[2]).toMatchObject({ tipo: 'falso', falsoId: 'f1', contenido: 'Texto inventado f1 con varias palabras.' })
  })
  it('sin falsos devuelve la misma lista', () => {
    const ps = [p(1)]
    expect(conFalsos(ps, [])).toBe(ps)
  })
  it('ignora los reales (sin texto)', () => {
    const r = conFalsos([p(1), p(2)], [{ id: 'r1', cap: 2, parrafo: 1 }])
    expect(r).toHaveLength(2)
  })
})

describe('esComienzo', () => {
  const texto = 'Uno dos tres cuatro'
  it('el primer trozo de un falso partido', () => {
    expect(esComienzo({ texto, contenido: 'Uno dos' })).toBe(true)
    expect(esComienzo({ texto, contenido: 'tres cuatro' })).toBe(false)
    expect(esComienzo({ texto, contenido: texto })).toBe(true)
  })
})

describe('trozoEn', () => {
  const pantalla = [p(1), { id: 'fx-f1', tipo: 'falso', falsoId: 'f1', numero: undefined }, p(2)]
  it('encuentra el falso por su id y el real por su número', () => {
    expect(trozoEn(falso('f1', 1), pantalla)?.id).toBe('fx-f1')
    expect(trozoEn({ id: 'r1', cap: 2, parrafo: 2 }, pantalla)?.id).toBe('p2')
    expect(trozoEn({ id: 'r2', cap: 2, parrafo: 9 }, pantalla)).toBe(null)
  })
})

describe('resumenFalsificador', () => {
  const aula = {
    items: [{ id: 'f1', falso: true }, { id: 'f2', falso: true }, { id: 'r1', falso: false }, { id: 'r2', falso: false }],
    jugadas: { a: { f1: true, f2: false, r1: true }, b: { f2: false, r2: true } },
  }
  const r = resumenFalsificador(aula, [{ user_id: 'a' }, { user_id: 'b' }, { user_id: 'c' }])
  it('pilló X de N trampas y confió X de N veces', () => {
    expect(r.totalFalsos).toBe(2)
    expect(r.totalReales).toBe(2)
    expect(r.filas[0]).toMatchObject({ pillo: 1, confio: 1, respondidos: 3 })
    expect(r.filas[1]).toMatchObject({ pillo: 0, confio: 1, respondidos: 2 })
    expect(r.filas[2]).toMatchObject({ pillo: 0, confio: 0, respondidos: 0 })
  })
  it('el que más engañó', () => {
    expect(r.masEngano).toMatchObject({ id: 'f2', fallos: 2, respondidos: 2 })
  })
  it('nadie engañado → null', () => {
    expect(resumenFalsificador({ items: aula.items, jugadas: {} }, []).masEngano).toBe(null)
  })
})
