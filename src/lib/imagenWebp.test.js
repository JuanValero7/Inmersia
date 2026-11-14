import { describe, it, expect } from 'vitest'
import { medidasReducidas } from './imagenWebp.js'

describe('medidasReducidas', () => {
  it('reduce el lado mayor a 1600 manteniendo la proporción', () => {
    expect(medidasReducidas(4000, 3000)).toEqual({ ancho: 1600, alto: 1200 })
    expect(medidasReducidas(1000, 3200)).toEqual({ ancho: 500, alto: 1600 })
  })
  it('no agranda las pequeñas', () => {
    expect(medidasReducidas(800, 600)).toEqual({ ancho: 800, alto: 600 })
  })
})
