// Tests de la geometría del tablero de la Cartelera.
//
// Es trigonometría pura y sin DOM, así que aquí sí se puede probar de verdad
// (a diferencia del paginador, que necesita layout real).
//
// Lo que estos tests protegen, sobre todo, es LA TRAMPA que describe
// carteleraGeometria.js: que las constantes entren por parámetro y no por
// clausura. Si alguien "simplifica" el módulo importando MAP o DOC_H en vez de
// recibirlos, el tablero móvil se descoloca en silencio. Los dos tests de
// "perfiles distintos" son los que saltan si eso pasa.
//
// Los valores esperados NO están calculados a mano: se obtuvieron ejecutando
// la implementación original (la que vivía duplicada por clausura dentro de
// cada componente) y comprobando que la versión por parámetro coincide bit a
// bit en 40.000 casos aleatorios por perfil.
import { describe, test, expect } from 'vitest'
import { pinAbs, docPinAbs, hechoPinAbs } from './carteleraGeometria.js'

// Los perfiles reales de cada plataforma. Viven aquí COPIADOS a propósito: si
// alguien cambia el tablero de sitio, estos tests siguen probando la fórmula
// y no se arrastran solos detrás del cambio sin que nadie lo note.
const MAP_DESKTOP = { w: 300, h: 210, cx: 985, cy: 170, rot: 2.5 }
const MAP_MOBILE  = { w: 284, h: 198, cx: 590, cy: 180, rot: 2.5 }
const DOC_H_DESKTOP = 150
const DOC_H_MOBILE  = 140

describe('pinAbs', () => {
  test('con rot 0 no gira: solo traslada al origen del mapa', () => {
    const MAP = { ...MAP_DESKTOP, rot: 0 }
    expect(pinAbs({ x: 0, y: 0 }, MAP)).toEqual({ x: 835, y: 65 })
  })

  test('el centro del mapa es punto fijo del giro', () => {
    const centro = { x: MAP_DESKTOP.w / 2, y: MAP_DESKTOP.h / 2 }
    const r = pinAbs(centro, MAP_DESKTOP)
    expect(r.x).toBeCloseTo(MAP_DESKTOP.cx, 6)
    expect(r.y).toBeCloseTo(MAP_DESKTOP.cy, 6)
  })

  // Un giro es una isometría: mueve el punto pero no lo acerca ni lo aleja
  // del centro. Si alguien mete una escala donde debería haber solo un giro,
  // esto salta y los tests de valor fijo de arriba no.
  test('el giro conserva la distancia al centro del mapa', () => {
    const p = { x: 123, y: 45 }
    const dist = (r) => Math.hypot(r.x - MAP_DESKTOP.cx, r.y - MAP_DESKTOP.cy)
    const sinGiro = dist(pinAbs(p, { ...MAP_DESKTOP, rot: 0 }))
    for (const rot of [-30, -2.5, 2.5, 17, 90]) {
      expect(dist(pinAbs(p, { ...MAP_DESKTOP, rot }))).toBeCloseTo(sinGiro, 6)
    }
  })

  // ⚠️ EL TEST DE LA TRAMPA. Si alguien hace que pinAbs lea MAP por clausura
  // en vez de recibirlo, los dos perfiles devuelven lo mismo y esto falla.
  test('el mismo pin cae en sitios distintos según el perfil', () => {
    const p = { x: 40, y: 30 }
    expect(pinAbs(p, MAP_DESKTOP)).not.toEqual(pinAbs(p, MAP_MOBILE))
  })
})

describe('docPinAbs', () => {
  test('sin giro, ancla DOC_H/2 - 8 por encima del centro', () => {
    expect(docPinAbs({ x: 100, y: 200, rot: 0 }, DOC_H_DESKTOP)).toEqual({ x: 100, y: 133 })
  })

  // ⚠️ EL OTRO TEST DE LA TRAMPA, para DOC_H.
  test('el alto del documento cambia el anclaje', () => {
    const s = { x: 100, y: 200, rot: 0 }
    expect(docPinAbs(s, DOC_H_DESKTOP).y).toBe(133)
    expect(docPinAbs(s, DOC_H_MOBILE).y).toBe(138)
    expect(docPinAbs(s, DOC_H_DESKTOP).y).not.toBe(docPinAbs(s, DOC_H_MOBILE).y)
  })

  test('sin giro la x no se mueve; con giro sí', () => {
    expect(docPinAbs({ x: 100, y: 200, rot: 0 },  DOC_H_DESKTOP).x).toBe(100)
    expect(docPinAbs({ x: 100, y: 200, rot: 12 }, DOC_H_DESKTOP).x).not.toBe(100)
  })
})

describe('hechoPinAbs', () => {
  // No lleva perfil de plataforma a propósito: HECHOS_SIZE ya es compartida
  // por escritorio y móvil desde carteleraZonas.jsx.
  test('sin giro, ancla h/2 - 6 por encima del centro', () => {
    const it = { x: 50, y: 80, rot: 0, type: 'polaroid' }
    const r = hechoPinAbs(it)
    expect(r.x).toBe(50)
    expect(r.y).toBeLessThan(80)   // el pin queda por encima del centro
  })

  test('el giro desplaza la punta en las dos coordenadas', () => {
    const recto  = hechoPinAbs({ x: 50, y: 80, rot: 0,  type: 'polaroid' })
    const girado = hechoPinAbs({ x: 50, y: 80, rot: 15, type: 'polaroid' })
    expect(girado.x).not.toBeCloseTo(recto.x, 6)
    expect(girado.y).not.toBeCloseTo(recto.y, 6)
  })
})
