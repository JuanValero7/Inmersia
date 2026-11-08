import { describe, it, expect } from 'vitest'
import {
  capituloPorDefecto, capitulosArmables, resumenMesa, estadoFrase, resumenFrases, frasesPorTipo,
  resumenTesoros, resumenCorazonadas, corazonadasAlumno, habilidades,
} from './comprension.js'

const al = (id, capitulos) => ({ user_id: id, nombre: id.toUpperCase(), capitulos })

describe('capituloPorDefecto', () => {
  it('el último capítulo que terminó al menos la mitad de la clase', () => {
    expect(capituloPorDefecto([al('a', 6), al('b', 5), al('c', 2), al('d', 1), al('e', 0)], 12)).toBe(2)
    expect(capituloPorDefecto([al('a', 6), al('b', 5), al('c', 2), al('d', 1)], 12)).toBe(5)
  })
  it('sin alumnos o sin avance, el capítulo 1', () => {
    expect(capituloPorDefecto([], 12)).toBe(1)
    expect(capituloPorDefecto([al('a', 0)], 12)).toBe(1)
  })
})

const deducciones = [
  { id: 'r1', pj: 'h', texto: 'Es curioso', pistas: [{ texto: 'x', cap: 1 }, { texto: 'y', cap: 3 }, { texto: 'z', cap: 2 }, { texto: 'w', cap: 5 }] },
  { id: 'r2', pj: 'h', texto: 'Cambia', pistas: [{ texto: 'r1', deduccion: 'r1' }, { texto: 'q', cap: 4 }, { texto: 'p', cap: 6 }] },
  { id: 'r3', pj: 'w', texto: 'Leal', pistas: [{ texto: 'a', cap: 1 }, { texto: 'b', cap: 1 }] },
]

describe('capitulosArmables', () => {
  it('el capítulo de la 3.ª pieza más temprana', () => {
    expect(capitulosArmables(deducciones).r1).toBe(3)
  })
  it('una deducción dentro del grupo cuenta desde que se puede armar', () => {
    expect(capitulosArmables(deducciones).r2).toBe(6)
  })
  it('con menos de 3 piezas no se puede armar nunca', () => {
    expect(capitulosArmables(deducciones).r3).toBe(Infinity)
  })
})

describe('resumenMesa', () => {
  const mesa = {
    personajes: [{ id: 'h', nombre: 'Holmes', aparece: 1 }],
    deducciones,
    jugadas: {
      a: { r1: { intentos: 3, armada: true }, r2: { intentos: 1, armada: true } },
      b: { r1: { intentos: 2, armada: false } },
    },
  }
  const alumnos = [al('a', 12), al('b', 4), al('c', 2)]
  const r = resumenMesa(mesa, alumnos)
  it('deducciones por alumno sobre el total del libro', () => {
    expect(r.total).toBe(3)
    expect(r.porAlumno).toBeCloseTo(2 / 3)
  })
  it('intentos de media entre todas las que encontraron', () => {
    expect(r.intentos).toBe(2)
  })
  it('completar todos los perfiles = todas las deducciones del libro', () => {
    expect(r.completos).toBe(0)
  })
  it('por deducción: quién la encontró entre los que ya podían', () => {
    expect(r.porDeduccion.r1).toMatchObject({ encontraron: 1, pueden: 2, desde: 3 })
    expect(r.porDeduccion.r2).toMatchObject({ encontraron: 1, pueden: 1 })
  })
  it('armables según lo que leyó cada uno', () => {
    expect(r.armables(al('b', 4))).toBe(1)
    expect(r.armables(al('a', 12))).toBe(2)
  })
})

const cc = {
  frases: [
    { id: 'f1', cap: 1, tipo: 'ironia', cita: '…' },
    { id: 'f2', cap: 1, tipo: 'vocabulario', cita: '…' },
    { id: 'f3', cap: 2, tipo: 'ironia', cita: '…' },
  ],
  asignadas: { a: ['f1', 'f3'], b: ['f2', 'f3'] },
  jugadas: { a: { f1: { veredicto: 'casi', contexto: true, cincuenta: false } }, b: { f2: { veredicto: 'correcto', contexto: false, cincuenta: false } } },
}

describe('frases difíciles', () => {
  it('omitida = le tocó, ya leyó el capítulo y no contestó', () => {
    expect(estadoFrase(cc, al('a', 2), cc.frases[2])).toBe('omitida')
  })
  it('si no le tocó o no llegó al capítulo, no cuenta', () => {
    expect(estadoFrase(cc, al('a', 2), cc.frases[1])).toBeNull()
    expect(estadoFrase(cc, al('b', 1), cc.frases[2])).toBeNull()
  })
  it('resumen por capítulo con ayudas', () => {
    const [f1, f2] = resumenFrases(cc, [al('a', 2), al('b', 2)], 1)
    expect(f1).toMatchObject({ casi: 1, total: 1, ayudas: 1 })
    expect(f2).toMatchObject({ correcto: 1, total: 1, ayudas: 0 })
  })
  it('por tipo, parcial vale la mitad', () => {
    expect(frasesPorTipo(cc, [al('a', 2), al('b', 2)])).toEqual([
      { tipo: 'ironia', pct: 0.5, n: 1 },
      { tipo: 'vocabulario', pct: 1, n: 1 },
    ])
  })
})

describe('resumenTesoros', () => {
  it('encontraron entre los que llegaron, fallos de media de quienes lo encontraron', () => {
    const mapa = {
      tesoros: [{ id: 't1', cap: 1, tipo: 'vista', pregunta: '?' }],
      jugadas: { a: { encontrados: ['t1'], fallos: { t1: 2 }, fallos_cap: { 1: 2 } }, b: { encontrados: [], fallos: {}, fallos_cap: {} } },
    }
    expect(resumenTesoros(mapa, [al('a', 1), al('b', 1), al('c', 0)], 1)[0]).toMatchObject({ encontraron: 1, pueden: 2, fallos: 2 })
  })
})

describe('corazonadas', () => {
  const cz = {
    preguntas: [
      { id: 'c1', cap: 1, rev: 2, sorpresa: false, pregunta: '?', opciones: ['a', 'b', 'c'], correcta: 0 },
      { id: 'c2', cap: 1, rev: 3, sorpresa: true, pregunta: '?', opciones: ['a', 'b', 'c'], correcta: 1 },
    ],
    jugadas: {
      a: { c1: { estado: 'cobrada', opcion: 0, ovillos: 3, acierto: true }, c2: { estado: 'cobrada', opcion: 0, ovillos: 1, acierto: false } },
      b: { c1: { estado: 'perdida', opcion: null, ovillos: null, acierto: null } },
    },
  }
  it('votos por opción y las que dejaron pasar', () => {
    const [c1] = resumenCorazonadas(cz, [al('a', 3), al('b', 3), al('c', 0)], 1)
    expect(c1).toMatchObject({ votos: [1, 0, 0], jugaron: 1, perdidas: 1, pueden: 2 })
  })
  it('las sorpresas no cuentan como acierto ni fallo', () => {
    expect(corazonadasAlumno(cz, al('a', 3))).toEqual({ jugadas: 2, aciertos: 1, resueltas: 1, confianza: 2 })
  })
})

describe('habilidades', () => {
  const tesoros = Array.from({ length: 4 }, (_, i) => ({ id: `v${i}`, cap: 1, tipo: 'vista', pregunta: '?' }))
  const base = {
    libro_id: 'L', total_capitulos: 12, meta_capitulo: 3, juegos: {},
    alumnos: [al('a', 3), al('b', 3), al('c', 3), al('d', 3)],
    mesa: null, corazonadas: null, concurso: null,
    mapa: {
      tesoros,
      jugadas: {
        a: { encontrados: ['v0', 'v1', 'v2', 'v3'], fallos: {}, fallos_cap: {} },
        b: { encontrados: ['v0', 'v1', 'v2', 'v3'], fallos: {}, fallos_cap: {} },
        c: { encontrados: ['v0'], fallos: {}, fallos_cap: {} },
      },
    },
    desafio: {
      momentos: [],
      charlas: {
        a: { mitad: { pregunta: 'x', estado: 'terminada', resumen: null, nota: 8, comentario: null } },
        b: { mitad: { pregunta: 'x', estado: 'terminada', resumen: null, nota: null, comentario: null } },
      },
    },
  }
  const h = habilidades(base)
  it('localizar: necesita apoyo quien queda muy por debajo de la clase, con datos suficientes', () => {
    expect(h.localizar.apoyo.map(x => x.a.user_id)).toEqual(['c'])
    expect(h.localizar.apoyo[0].motivo).toBe('1 de 4 tesoros a la vista')
  })
  it('quien no jugó a nada va aparte, no en «necesita apoyo»', () => {
    expect(h.sinDatos.map(a => a.user_id)).toEqual(['d'])
    expect(h.localizar.apoyo.some(x => x.a.user_id === 'd')).toBe(false)
  })
  it('evaluar: resume las notas del profe; por debajo de 11, necesita apoyo', () => {
    expect(h.evaluar.clase).toEqual({ terminadas: 2, corregidas: 1, media: 8 })
    expect(h.evaluar.apoyo.map(x => x.a.user_id)).toEqual(['a'])
  })
})
