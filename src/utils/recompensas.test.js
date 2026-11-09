import { describe, it, expect } from 'vitest'
import { cuentaCanje, textoBloqueo, textoLimite, sinPrefijo, ovillos, POCOS_OVILLOS, redondear, preciosSugeridos, boteSugerido, nombreJuego } from './recompensas.js'

describe('cuentaCanje', () => {
  it('alcanza con margen: sin aviso', () => {
    expect(cuentaCanje(34, 5)).toEqual({ queda: 29, alcanza: true, aviso: null })
  })
  it('alcanza pero deja pocos para jugar', () => {
    expect(cuentaCanje(34, 30)).toEqual({ queda: 4, alcanza: true, aviso: 'poco' })
    expect(cuentaCanje(POCOS_OVILLOS + 5, 5).aviso).toBe(null)
  })
  it('justo cero: alcanza, con aviso', () => {
    expect(cuentaCanje(12, 12)).toEqual({ queda: 0, alcanza: true, aviso: 'poco' })
  })
  it('no alcanza', () => {
    expect(cuentaCanje(4, 12)).toEqual({ queda: -8, alcanza: false, aviso: 'falta' })
  })
})

describe('textoBloqueo', () => {
  const hoy = new Date('2026-11-09T10:00:00Z')
  it('libre: null', () => expect(textoBloqueo({ bloqueo: null })).toBe(null))
  it('ya canjeado y agotado', () => {
    expect(textoBloqueo({ bloqueo: 'ya_canjeado' })).toBe('Ya lo canjeaste')
    expect(textoBloqueo({ bloqueo: 'agotado' })).toMatch(/alguien de tu clase/)
  })
  it('semana: mañana o un día con nombre', () => {
    expect(textoBloqueo({ bloqueo: 'esta_semana', desde: '2026-11-10T08:00:00Z' }, hoy)).toBe('Vuelve mañana')
    expect(textoBloqueo({ bloqueo: 'esta_semana', desde: '2026-11-14T08:00:00Z' }, hoy)).toMatch(/^Vuelve el /)
    expect(textoBloqueo({ bloqueo: 'esta_semana', desde: null }, hoy)).toMatch(/semana que viene/)
  })
})

describe('textos', () => {
  it('límites', () => {
    expect(textoLimite('clase')).toBe('Solo uno en toda la clase')
    expect(textoLimite('raro')).toBe('')
  })
  it('expediente sin prefijo', () => {
    expect(sinPrefijo('Expediente: los pescadores de Terranova')).toBe('Los pescadores de Terranova')
  })
  it('plural', () => {
    expect(ovillos(1)).toBe('1 ovillo')
    expect(ovillos(5)).toBe('5 ovillos')
  })
})

describe('precios sugeridos (097)', () => {
  it('redondea de 1 en 1 bajo 10 y de 5 en 5 desde ahí', () => {
    expect(redondear(7.3)).toBe(7)
    expect(redondear(0.2)).toBe(1)
    expect(redondear(11.3)).toBe(10)
    expect(redondear(68)).toBe(70)
  })
  it('El signo de los cuatro (34 solo leyendo): 10 / 35 / 70', () => {
    expect(preciosSugeridos(34)).toEqual([['Pequeña', 10], ['Mediana', 35], ['Grande', 70]])
  })
  it('Noches blancas (22): 7 / 20 / 45', () => {
    expect(preciosSugeridos(22).map(([, n]) => n)).toEqual([7, 20, 45])
  })
  it('bote: la mitad de lo que junta la clase leyendo, nunca menos que un alumno', () => {
    expect(boteSugerido(34, 30)).toBe(510)
    expect(boteSugerido(34, 0)).toBe(35)
  })
  it('textos del bote', () => {
    expect(textoLimite('bote')).toBe('Bote de la clase')
    expect(textoBloqueo({ bloqueo: 'lleno' })).toMatch(/Lleno/)
    expect(textoBloqueo({ bloqueo: 'entregado' })).toBe('Ya se entregó')
    expect(nombreJuego('concurso')).toBe('Frases difíciles')
  })
})
