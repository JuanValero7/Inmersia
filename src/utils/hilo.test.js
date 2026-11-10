import { describe, it, expect } from 'vitest'
import { colocar, infoIdea, resumenHilo, novedadesHilo, marcasPareja, resumenHiloAula, TARJETA } from './hilo.js'

// La cadena de Menger (Del origen del dinero): 11 ideas.
const MENGER = [
  ['Q', []], ['N1', []], ['N2', ['Q']], ['N3', []], ['N4', ['N3']], ['N5', ['N2', 'N4']],
  ['N6', ['N5']], ['N7', ['N6']], ['N8', ['N6']], ['N9', []], ['F', ['N1', 'N8', 'N9']],
].map(([id, previas]) => ({ id: /** @type {string} */ (id), previas: /** @type {string[]} */ (previas) }))

const idea = (id, extra = {}) => ({ id, final: null, previas: [], huecos: 3, abre: 1, estado: 'abierta', ...extra })

describe('colocar', () => {
  const { pos, ancho, alto } = colocar(MENGER)
  const col = (id) => Math.round((pos[id].x - 14) / 190)
  it('cada idea va a la derecha de las ideas de las que sale', () => {
    for (const i of MENGER) for (const p of i.previas) expect(col(i.id)).toBeGreaterThan(col(p))
  })
  it('la conclusión queda sola en la última columna', () => {
    expect(col('F')).toBe(5)
    expect(MENGER.filter(i => col(i.id) === 5).map(i => i.id)).toEqual(['F'])
  })
  it('las sueltas se acercan a la idea que las usa sin pasar de 3 por columna', () => {
    expect(col('N1')).toBe(4)
    expect(col('N9')).toBe(3)
    for (let c = 0; c <= 5; c++) expect(MENGER.filter(i => col(i.id) === c).length).toBeLessThanOrEqual(3)
  })
  it('no hay dos tarjetas en el mismo sitio y todo cabe en el lienzo', () => {
    const sitios = new Set(Object.values(pos).map(p => `${p.x},${p.y}`))
    expect(sitios.size).toBe(MENGER.length)
    for (const p of Object.values(pos)) {
      expect(p.x + TARJETA).toBeLessThanOrEqual(ancho)
      expect(p.y).toBeLessThan(alto)
    }
  })
  it('una idea sola en su columna va a la altura de sus previas', () => {
    expect(pos.N6.y).toBe(pos.N5.y)
  })
})

describe('infoIdea', () => {
  const ideas = { A: idea('A', { estado: 'armada' }), B: idea('B', { previas: ['A'], huecos: 2 }), C: idea('C', { previas: ['Z'], huecos: 2 }), Z: idea('Z') }
  it('lista para jugar con los huecos llenos y las previas armadas', () => {
    expect(infoIdea(ideas.B, ['b1', 'b2'], ideas)).toMatchObject({ lleno: true, faltanIdeas: [], puedeJugar: true, res: null })
  })
  it('le falta una idea anterior', () => {
    expect(infoIdea(ideas.C, ['x', 'y'], ideas)).toMatchObject({ faltanIdeas: ['Z'], puedeJugar: false })
  })
  it('el resultado de la última jugada solo si las piezas son las mismas', () => {
    const b = { ...ideas.B, ultima: { pistas: ['b1', 's1'], resultado: 'casi' }, pareja: ['b1'] }
    expect(infoIdea(b, ['s1', 'b1'], ideas)).toMatchObject({ res: 'casi', marcadas: ['b1'] })
    expect(infoIdea(b, ['b1', 'b2'], ideas)).toMatchObject({ res: null, marcadas: ['b1'] })
    expect(infoIdea({ ...b, ultima: { pistas: ['x', 'y'], resultado: 'no_encajan' } }, ['y', 'x'], ideas).res).toBe('no')
  })
})

describe('resumenHilo y novedadesHilo', () => {
  const estado = {
    version: 1, capitulos_completados: 2, total_capitulos: 9, saldo: 12, faltaron: null,
    pistas: [{ id: 'a', cap: 1, t: '', cita: '' }, { id: 'b', cap: 2, t: '', cita: '' }, { id: 'c', cap: 2, t: '', cita: '' }],
    ideas: [idea('A', { estado: 'armada' }), idea('B', { previas: ['A'], abre: 2 }), idea('C', { previas: ['B'], abre: 2 }), idea('F', { final: 'principal', estado: 'cerrada', abre: 9, huecos: 0 })],
  }
  it('cuenta armadas y las que ya se pueden armar', () => {
    expect(resumenHilo(estado)).toMatchObject({ armadas: 1, total: 4, porArmar: 1, sello: { cls: 'is-open' } })
  })
  it('caso cerrado con la conclusión armada', () => {
    const fin = { ...estado, ideas: estado.ideas.map(i => ({ ...i, estado: 'armada' })) }
    expect(resumenHilo(fin)?.sello.txt).toBe('Caso cerrado')
  })
  it('lo que trajo el último capítulo', () => {
    expect(novedadesHilo(estado)).toEqual({ pistas: 2, ideas: 2 })
    expect(novedadesHilo(null)).toEqual({ pistas: 0, ideas: 0 })
  })
})

describe('marcasPareja', () => {
  it('numera las parejas por idea sin armar', () => {
    const ideas = [idea('A', { pareja: ['a1', 'a2'] }), idea('B', { estado: 'armada', pareja: ['x'] }), idea('C', { pareja: ['c1'] })]
    expect(marcasPareja(ideas)).toEqual({ a1: 0, a2: 0, c1: 1 })
  })
})

describe('resumenHiloAula', () => {
  const aula = {
    ideas: [{ id: 'A', titulo: 'A', final: null, huecos: 3 }, { id: 'B', titulo: 'B', final: null, huecos: 2 }, { id: 'F', titulo: 'F', final: 'principal', huecos: 0 }],
    alumnos: {
      u1: { armadas: ['A', 'B', 'F'], fallos: { A: 2, B: 1 }, ayudas: ['B'], senuelos: 1 },
      u2: { armadas: ['A'], fallos: { B: 4 }, ayudas: [], senuelos: 3 },
    },
  }
  const r = resumenHiloAula(aula, [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }])
  it('por alumno', () => {
    expect(r.filas[0]).toMatchObject({ jugo: true, armadas: 3, conclusion: true, fallos: 3, ayudas: 1, senuelos: 1 })
    expect(r.filas[1]).toMatchObject({ armadas: 1, conclusion: false, fallos: 4 })
    expect(r.filas[2]).toMatchObject({ jugo: false, armadas: 0 })
  })
  it('por idea y dónde se atasca la clase', () => {
    expect(r.porIdea.map(i => i.armaron)).toEqual([2, 1, 1])
    expect(r.atasco?.id).toBe('B')
    expect(r.jugaron).toBe(2)
  })
})
