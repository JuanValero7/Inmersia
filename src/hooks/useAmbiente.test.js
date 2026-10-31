import { describe, it, expect } from 'vitest'
import { ambienteDelParrafo, elegirDetalle } from './useAmbiente.js'
import { AMBIENTES } from '../lib/ambientes.js'

const tramos = [
  { desde: 1, hasta: 10, ambiente: 'casa_silencio' },
  { desde: 11, hasta: 20, ambiente: 'ninguno' },
  { desde: 21, hasta: 30, ambiente: 'ambiente_que_no_tiene_audios' },
]

describe('ambienteDelParrafo', () => {
  it('da el ambiente del tramo que contiene el párrafo, bordes incluidos', () => {
    expect(ambienteDelParrafo(tramos, 1)).toBe('casa_silencio')
    expect(ambienteDelParrafo(tramos, 10)).toBe('casa_silencio')
  })
  it('"ninguno", fuera de los tramos o sin audios en la app → silencio', () => {
    expect(ambienteDelParrafo(tramos, 11)).toBeNull()
    expect(ambienteDelParrafo(tramos, 99)).toBeNull()
    expect(ambienteDelParrafo(tramos, 25)).toBeNull()
  })
  it('sin tramos o sin párrafo → silencio', () => {
    expect(ambienteDelParrafo(null, 3)).toBeNull()
    expect(ambienteDelParrafo([], 3)).toBeNull()
    expect(ambienteDelParrafo(tramos, undefined)).toBeNull()
  })
})

describe('elegirDetalle', () => {
  const lista = [{ slug: 'a', peso: 3 }, { slug: 'b', peso: 1 }, { slug: 'c', peso: 1 }]

  it('respeta el peso: con r bajo sale el de más peso', () => {
    expect(elegirDetalle(lista, null, 0).slug).toBe('a')
    expect(elegirDetalle(lista, null, 0.59).slug).toBe('a')   // 3 de 5
    expect(elegirDetalle(lista, null, 0.61).slug).toBe('b')
    expect(elegirDetalle(lista, null, 0.99).slug).toBe('c')
  })
  it('nunca repite el último', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) expect(elegirDetalle(lista, 'a', r).slug).not.toBe('a')
  })
  it('con un solo detalle, lo repite', () => {
    expect(elegirDetalle([{ slug: 'solo', peso: 1 }], 'solo', 0.5).slug).toBe('solo')
  })
})

describe('catálogo de la app', () => {
  it('cada ambiente está bien formado', () => {
    for (const [slug, a] of Object.entries(AMBIENTES)) {
      expect(a.nombre, slug).toBeTruthy()
      if (a.tipo === 'bucle') expect(a.variantes.length, slug).toBeGreaterThan(0)
      else {
        expect(a.tipo, slug).toBe('detalles')
        expect(a.intervalo[0], slug).toBeGreaterThanOrEqual(30)   // Juan: mínimo 30 s entre detalles
        expect(a.intervalo[1], slug).toBeGreaterThan(a.intervalo[0])
        expect(a.detalles.length, slug).toBeGreaterThan(0)
      }
    }
  })
})
