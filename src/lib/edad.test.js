import { describe, it, expect, vi, afterEach } from 'vitest'
import { edadEnAnios, puedeUsarChat, EDAD_MINIMA, EDAD_MINIMA_CHAT } from './edad.js'

// Fecha fija para que los tests no cambien de resultado el día del cumpleaños
// de nadie: 15 de junio de 2026.
const HOY = new Date('2026-06-15T12:00:00Z')

function conFechaFija(fn) {
  vi.useFakeTimers()
  vi.setSystemTime(HOY)
  try { return fn() } finally { vi.useRealTimers() }
}

afterEach(() => { vi.useRealTimers() })

describe('edadEnAnios', () => {
  it('cuenta años cumplidos', () => {
    conFechaFija(() => {
      expect(edadEnAnios('2000-06-15')).toBe(26)
      expect(edadEnAnios('1990-01-01')).toBe(36)
    })
  })

  it('resta un año si el cumpleaños aún no llegó', () => {
    conFechaFija(() => {
      expect(edadEnAnios('2010-06-16')).toBe(15)  // mañana cumple 16
      expect(edadEnAnios('2010-06-15')).toBe(16)  // hoy los cumple
      expect(edadEnAnios('2010-06-14')).toBe(16)  // ayer
      expect(edadEnAnios('2010-12-31')).toBe(15)  // cumple en diciembre
    })
  })

  it('devuelve null con fechas inservibles', () => {
    conFechaFija(() => {
      expect(edadEnAnios('')).toBeNull()
      expect(edadEnAnios(null)).toBeNull()
      expect(edadEnAnios(undefined)).toBeNull()
      expect(edadEnAnios('no soy una fecha')).toBeNull()
      expect(edadEnAnios('2030-01-01')).toBeNull()   // en el futuro
    })
  })
})

describe('puedeUsarChat', () => {
  it('deja pasar a partir de la edad mínima del chat', () => {
    conFechaFija(() => {
      expect(puedeUsarChat('2010-06-15')).toBe(true)   // cumple 16 hoy
      expect(puedeUsarChat('1990-01-01')).toBe(true)
    })
  })

  it('bloquea por debajo', () => {
    conFechaFija(() => {
      expect(puedeUsarChat('2010-06-16')).toBe(false)  // 15 años y 364 días
      expect(puedeUsarChat('2013-01-01')).toBe(false)
    })
  })

  it('sin fecha deja pasar: son las cuentas viejas, no menores desconocidos', () => {
    expect(puedeUsarChat(null)).toBe(true)
    expect(puedeUsarChat('')).toBe(true)
  })
})

describe('límites declarados en los documentos legales', () => {
  // Si alguien cambia estos números, hay que cambiar también
  // Documentation/terminos-y-condiciones.md (3.1) y
  // Documentation/politica-de-privacidad.md (8).
  it('son 14 para la cuenta y 16 para el chat', () => {
    expect(EDAD_MINIMA).toBe(14)
    expect(EDAD_MINIMA_CHAT).toBe(16)
  })
})
