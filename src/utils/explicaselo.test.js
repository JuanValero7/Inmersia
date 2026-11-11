import { describe, it, expect } from 'vitest'
import { contarFrases, palabraProhibida, avisoRegla, reglaDe, anguloPara, PERSONAJES, mensajesQueQuedan } from './explicaselo.js'

const MENGER = { palabras: ['comprar', 'vender'], raices: ['compr', 'vend', 'venta'] }

describe('contarFrases (igual que _explicaselo_frases)', () => {
  it('cuenta por . ! ?', () => {
    expect(contarFrases('Hola. ¿Qué tal? Bien… y tú')).toBe(3)
    expect(contarFrases('¡Uno! ¡Dos! Tres. Cuatro.')).toBe(4)
  })
  it('una frase sin punto también cuenta', () => {
    expect(contarFrases('Una sola frase sin punto')).toBe(1)
  })
  it('los puntos seguidos o sueltos no suman', () => {
    expect(contarFrases('Primero... luego. . .')).toBe(2)
    expect(contarFrases('')).toBe(0)
  })
})

describe('palabraProhibida (igual que _explicaselo_prohibida)', () => {
  it('pilla la palabra en cualquier forma, con mayúsculas o tildes', () => {
    expect(palabraProhibida('Lo CompRaban en la feria', MENGER.raices)).toBe('compr')
    expect(palabraProhibida('Las vendían caras', MENGER.raices)).toBe('vend')
    expect(palabraProhibida('La VÉNTA de sal', MENGER.raices)).toBe('venta')
  })
  it('solo al comienzo de una palabra', () => {
    expect(palabraProhibida('Lo recompensaron', MENGER.raices)).toBeNull()
    expect(palabraProhibida('Cambiaban sal por pescado', MENGER.raices)).toBeNull()
  })
})

describe('avisoRegla', () => {
  it('pirata: más de 3 frases', () => {
    expect(avisoRegla('pirata', 'Uno. Dos. Tres.')).toBeNull()
    expect(avisoRegla('pirata', 'Uno. Dos. Tres. Cuatro.')).toEqual({ tipo: 'frases', n: 4 })
  })
  it('marciano: dice la palabra de la lista, no la raíz', () => {
    expect(avisoRegla('marciano', 'La gente compraba sal', MENGER)).toEqual({ tipo: 'palabra', palabra: 'comprar' })
    expect(avisoRegla('marciano', 'Nadie vendía nada', MENGER)).toEqual({ tipo: 'palabra', palabra: 'vender' })
    expect(avisoRegla('marciano', 'Una venta', MENGER)).toEqual({ tipo: 'palabra', palabra: 'venta' })
  })
  it('los demás no se comprueban antes de enviar', () => {
    expect(avisoRegla('abuela', 'Uno. Dos. Tres. Cuatro. Compraban.', MENGER)).toBeNull()
  })
})

describe('reglaDe', () => {
  it('el marciano lleva las palabras del libro', () => {
    expect(reglaDe('marciano', ['comprar', 'vender'])).toBe('No sabe qué es comprar ni vender: no puedes usar esas palabras.')
    expect(reglaDe('pirata')).toMatch(/3 frases/)
  })
})

describe('anguloPara', () => {
  it('deja el sector del personaje bajo el puntero y siempre gira hacia delante', () => {
    for (const p of PERSONAJES) {
      for (const desde of [0, 123, 2000]) {
        const a = anguloPara(p.id, desde)
        expect(a).toBeGreaterThan(desde + 360 * 3)
        // bajo el puntero queda el ángulo (360 − a) de la rueda, dentro del sector del personaje
        const bajo = ((360 - (a % 360)) + 360) % 360
        const i = Math.floor(bajo / 60)
        expect(PERSONAJES[i].id).toBe(p.id)
      }
    }
  })
})

describe('mensajesQueQuedan', () => {
  it('como mucho 2', () => {
    expect(mensajesQueQuedan({ turnos: [] })).toBe(2)
    expect(mensajesQueQuedan({ turnos: [{ de: 'alumno', texto: 'x' }, { de: 'personaje', texto: 'y' }] })).toBe(1)
  })
})
