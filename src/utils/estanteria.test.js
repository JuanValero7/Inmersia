import { describe, it, expect } from 'vitest'
import { armarEstanterias, secuenciaVisual, estanteriaDe } from './estanteria.js'

const libros = n => Array.from({ length: n }, (_, i) => ({ id: `l${i + 1}`, orden: (i + 1) * 10 }))
const alPrincipio = () => 0
const alFinal = (_clave, huecos) => huecos - 1

describe('armarEstanterias', () => {
  it('reparte 5 por balda y 2 baldas por estantería', () => {
    const e = armarEstanterias(libros(20), alPrincipio)
    expect(e).toHaveLength(2)
    expect(e[0]).toHaveLength(2)
    expect(e[0][0]).toHaveLength(5)
    expect(e[1][1]).toHaveLength(5)
  })

  it('pone de lomo el de título más corto de cada balda', () => {
    const balda5 = ['Robinson Crusoe', 'Bambi', 'El banquete', 'Meditaciones', 'De profundis']
      .map((titulo, i) => ({ id: `l${i + 1}`, orden: (i + 1) * 10, titulo }))
    const [[balda]] = armarEstanterias(balda5, alPrincipio)
    expect(balda[0].libro.titulo).toBe('Bambi')
    expect(balda[0].lomo).toBe(true)
  })

  it('a igual largo de título, va de lomo el de mayor orden', () => {
    const [[balda]] = armarEstanterias(libros(5), alPrincipio)
    expect(balda[0]).toEqual({ libro: { id: 'l5', orden: 50 }, lomo: true })
    expect(balda.filter(x => x.lomo)).toHaveLength(1)
  })

  it('respeta la posición del lomo que decide quien llama', () => {
    const [[balda]] = armarEstanterias(libros(5), alFinal)
    expect(balda[4].lomo).toBe(true)
    expect(balda.slice(0, 4).map(x => x.libro.id)).toEqual(['l1', 'l2', 'l3', 'l4'])
  })

  it('con 3 libros en la balda ya hay lomo; con menos, todos de frente', () => {
    const [[b1, b2]] = armarEstanterias(libros(7), alPrincipio)
    expect(b1.some(x => x.lomo)).toBe(true)
    expect(b2).toHaveLength(2)
    expect(b2.some(x => x.lomo)).toBe(false)
    const [[b3]] = armarEstanterias(libros(3), alPrincipio)
    expect(b3.filter(x => x.lomo)).toHaveLength(1)
  })

  it('una posición fuera de rango se acota', () => {
    const [[balda]] = armarEstanterias(libros(5), () => 99)
    expect(balda[4].lomo).toBe(true)
  })

  it('pasa la clave pagina-balda para fijar el azar', () => {
    const claves = []
    armarEstanterias(libros(12), (clave) => { claves.push(clave); return 0 })
    expect(claves).toEqual(['0-0', '0-1'])
  })

  it('sin libros no hay estanterías', () => {
    expect(armarEstanterias([], alPrincipio)).toEqual([])
  })
})

describe('secuenciaVisual y estanteriaDe', () => {
  it('sigue el orden en que se ven, con el lomo en su sitio', () => {
    const e = armarEstanterias(libros(5), alPrincipio)
    expect(secuenciaVisual(e).map(l => l.id)).toEqual(['l5', 'l1', 'l2', 'l3', 'l4'])
  })
  it('ubica cada posición en su estantería', () => {
    expect(estanteriaDe(0)).toBe(0)
    expect(estanteriaDe(9)).toBe(0)
    expect(estanteriaDe(10)).toBe(1)
  })
})
