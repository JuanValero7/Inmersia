import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./errores.js', () => ({ reportarError: vi.fn() }))
const { reportarError } = await import('./errores.js')
const { guardar, guardarTodo, escucharAvisos } = await import('./guardar.js')

const bien = (data = null) => Promise.resolve({ data, error: null })
const mal = (message, code = '42501') => Promise.resolve({ data: null, error: { message, code, details: 'Key (user_id)=(secreto)' } })

let avisos, baja
beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  avisos = []
  baja = escucharAvisos(t => avisos.push(t))
})
afterEach(() => { baja(); vi.restoreAllMocks() })

describe('guardar', () => {
  it('devuelve ok y los datos cuando la escritura sale bien, sin avisar', async () => {
    const r = await guardar(bien({ id: 7 }), { que: 'x', aviso: 'A' })
    expect(r).toEqual({ ok: true, data: { id: 7 } })
    expect(reportarError).not.toHaveBeenCalled()
    expect(avisos).toEqual([])
  })

  it('un fallo de la base va a Sentry y avisa al lector', async () => {
    const r = await guardar(mal('new row violates row-level security policy'), { que: 'progreso', aviso: 'A' })
    expect(r.ok).toBe(false)
    expect(reportarError).toHaveBeenCalledTimes(1)
    expect(avisos).toEqual(['A'])
  })

  it('a Sentry no van los details de Postgres (pueden llevar valores de la fila)', async () => {
    await guardar(mal('duplicate key'), { que: 'x' })
    const [error, contexto] = reportarError.mock.calls[0]
    expect(JSON.stringify(contexto) + error.message).not.toContain('secreto')
    expect(contexto).toMatchObject({ que: 'x', codigo: '42501' })
  })

  it('un fallo de red avisa al lector pero no va a Sentry', async () => {
    await guardar(mal('TypeError: Failed to fetch', ''), { que: 'progreso', aviso: 'A' })
    expect(reportarError).not.toHaveBeenCalled()
    expect(avisos).toEqual(['A'])
  })

  it('una petición que lanza se trata como fallo, no revienta', async () => {
    const r = await guardar(Promise.reject(new Error('boom')), { que: 'x' })
    expect(r.ok).toBe(false)
    expect(reportarError).toHaveBeenCalledTimes(1)
  })

  it('sin aviso, el fallo solo se registra', async () => {
    await guardar(mal('x'), { que: 'x' })
    expect(avisos).toEqual([])
  })
})

describe('guardarTodo', () => {
  it('ok solo si salen bien todas', async () => {
    expect((await guardarTodo([bien(), bien()], { que: 'x', aviso: 'A' })).ok).toBe(true)
    expect(avisos).toEqual([])
  })

  it('si fallan varias, avisa una sola vez pero reporta cada una', async () => {
    const r = await guardarTodo([mal('uno'), bien(), mal('dos')], { que: 'terminado', aviso: 'A' })
    expect(r.ok).toBe(false)
    expect(avisos).toEqual(['A'])
    expect(reportarError).toHaveBeenCalledTimes(2)
  })
})
