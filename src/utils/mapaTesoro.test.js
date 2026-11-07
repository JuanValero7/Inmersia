import { describe, it, expect } from 'vitest'
import { fichasDelCapitulo, brilla, quedanTesoros, motivoNoMapa } from './mapaTesoro.js'

const t = (id, cap, brillo, extra = {}) => ({ id, cap, tipo: 'vista', spoiler: false, pregunta: '¿?', brillo, encontrado: false, ...extra })
const TESOROS = [
  t('a', 1, [1, 8]),
  t('b', 1, [16, 26], { spoiler: true }),
  t('c', 1, [30, 40], { encontrado: true }),
  t('d', 2, [11, 21]),
]

describe('fichasDelCapitulo', () => {
  it('solo las del capítulo', () => {
    expect(fichasDelCapitulo(TESOROS, 2, 0).map(x => x.id)).toEqual(['d'])
  })
  it('la de spoiler no sale hasta llegar a su brillo', () => {
    expect(fichasDelCapitulo(TESOROS, 1, 15).map(x => x.id)).toEqual(['a', 'c'])
    expect(fichasDelCapitulo(TESOROS, 1, 16).map(x => x.id)).toEqual(['a', 'b', 'c'])
  })
  it('una de spoiler ya encontrada se ve siempre', () => {
    const lista = [t('b', 1, [16, 26], { spoiler: true, encontrado: true })]
    expect(fichasDelCapitulo(lista, 1, 0)).toHaveLength(1)
  })
})

describe('brilla', () => {
  it('brilla si en pantalla hay un párrafo del brillo de un tesoro pendiente', () => {
    expect(brilla(TESOROS, 1, [6, 7, 8, 9])).toBe(true)
    expect(brilla(TESOROS, 1, [9, 10, 11])).toBe(false)
  })
  it('un tesoro encontrado ya no brilla', () => {
    expect(brilla(TESOROS, 1, [33, 34])).toBe(false)
  })
  it('no mezcla capítulos', () => {
    expect(brilla(TESOROS, 2, [6, 7])).toBe(false)
  })
})

describe('quedanTesoros', () => {
  it('cuenta solo los pendientes del capítulo', () => {
    expect(quedanTesoros(TESOROS, 1)).toBe(true)
    expect(quedanTesoros([t('c', 1, [1, 2], { encontrado: true })], 1)).toBe(false)
    expect(quedanTesoros(TESOROS, 3)).toBe(false)
  })
})

describe('motivoNoMapa', () => {
  it('vale un trozo de un solo párrafo con 3 palabras o más', () => {
    expect(motivoNoMapa([{ text: 'la tierra rojiza', parrafoId: 'p1' }])).toBe(null)
  })
  it('no vale si cruza varios párrafos', () => {
    expect(motivoNoMapa([{ text: 'uno dos tres', parrafoId: 'p1' }, { text: 'cuatro', parrafoId: 'p2' }])).toBe('varios_parrafos')
  })
  it('un mismo párrafo partido entre dos páginas cuenta como uno', () => {
    expect(motivoNoMapa([{ text: 'uno dos', parrafoId: 'p1' }, { text: 'tres', parrafoId: 'p1' }])).toBe(null)
  })
  it('no vale con menos de 3 palabras', () => {
    expect(motivoNoMapa([{ text: 'dos palabras', parrafoId: 'p1' }])).toBe('corto')
  })
})
