import { describe, it, expect } from 'vitest'
import { mapLibro, COLOR_LIBRO_DEFECTO } from './libros.js'

describe('mapLibro', () => {
  it('traduce las columnas de `libros` a los nombres de la pantalla', () => {
    const libro = mapLibro({
      id: 'l1', slug: 'el-principito', titulo: 'El Principito', autor: 'Saint-Exupéry',
      paginas: 96, color: '#123456', descripcion: 'Un aviador…', portada_url: 'p.webp',
      es_ficcion: true, metadata: { hero_url: 'h.webp', hero_url_mobile: 'hm.webp' },
    })
    expect(libro).toEqual({
      id: 'l1', libro_id: 'l1', slug: 'el-principito', title: 'El Principito', author: 'Saint-Exupéry',
      pages: 96, _baseColor: '#123456', color: '#123456', summary: 'Un aviador…', cover: 'p.webp',
      heroUrl: 'h.webp', heroUrlMobile: 'hm.webp', es_ficcion: true,
    })
  })

  it('rellena lo que falta con los mismos valores por defecto en todas partes', () => {
    const libro = mapLibro({ id: 'l2', titulo: 'Sin datos' })
    expect(libro.author).toBe('Desconocido')
    expect(libro.pages).toBe(200)
    expect(libro.color).toBe(COLOR_LIBRO_DEFECTO)
    expect(libro._baseColor).toBe(COLOR_LIBRO_DEFECTO)
    expect(libro.summary).toBe('')
    expect(libro.cover).toBeNull()
    expect(libro.slug).toBeNull()
    expect(libro.es_ficcion).toBe(true)
  })

  it('respeta un libro de no ficción', () => {
    expect(mapLibro({ id: 'l3', titulo: 'Ensayo', es_ficcion: false }).es_ficcion).toBe(false)
  })
})
