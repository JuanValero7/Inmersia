import { describe, it, expect, vi } from 'vitest'

// El hook de compra arrastra Supabase; aquí solo se prueban las funciones puras.
vi.mock('../../hooks/useCompraLibro.js', () => ({ useCompraLibro: () => ({}), LIMITE_PENDIENTES: 5 }))

const { filtrarPorBusqueda, agruparEnEstantes, ultimosAbiertos, contarPendientes } = await import('./miBiblioteca.js')
const { MANUAL_LIBRO_ID, SIN_CATEGORIA_ID } = await import('./constants.js')

const libro = (id, extra = {}) => ({ id, title: `Libro ${id}`, author: 'Autora', leido: false, categoria_id: null, ...extra })

describe('filtrarPorBusqueda', () => {
  const libros = [libro('a', { title: 'El Principito' }), libro('b', { author: 'Poe' })]
  it('busca en título y autor sin distinguir mayúsculas', () => {
    expect(filtrarPorBusqueda(libros, 'principito').map(b => b.id)).toEqual(['a'])
    expect(filtrarPorBusqueda(libros, 'POE').map(b => b.id)).toEqual(['b'])
  })
  it('sin texto devuelve todos', () => {
    expect(filtrarPorBusqueda(libros, '')).toHaveLength(2)
  })
})

describe('agruparEnEstantes', () => {
  const cats = [{ id: 'c1', nombre: 'Clásicos', color: '#111' }, { id: 'c2', nombre: 'Vacía', color: '#222' }]
  const libros = [libro('a', { categoria_id: 'c1' }), libro('b')]
  it('una por categoría con libros y "Sin categoría" al final; las vacías no salen', () => {
    const g = agruparEnEstantes(cats, libros)
    expect(g.map(x => x.cat.id)).toEqual(['c1', SIN_CATEGORIA_ID])
  })
  it('con categoría activa, solo esa', () => {
    expect(agruparEnEstantes(cats, libros, 'c1').map(x => x.cat.id)).toEqual(['c1'])
  })
})

describe('ultimosAbiertos', () => {
  const libros = [libro(MANUAL_LIBRO_ID), libro('a'), libro('b'), libro('c'), libro('d')]
  it('respeta el orden de apertura y quita el Manual y el destacado', () => {
    expect(ultimosAbiertos(libros, ['c', MANUAL_LIBRO_ID, 'a', 'b'], { id: 'a' }, 3).map(b => b.id)).toEqual(['c', 'b'])
  })
  it('sin historial, los primeros de la lista hasta el máximo', () => {
    expect(ultimosAbiertos(libros, [], null, 2).map(b => b.id)).toEqual(['a', 'b'])
  })
})

describe('contarPendientes', () => {
  it('no cuenta el Manual ni los leídos', () => {
    expect(contarPendientes([libro(MANUAL_LIBRO_ID), libro('a'), libro('b', { leido: true })])).toBe(1)
  })
})
