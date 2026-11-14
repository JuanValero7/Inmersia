import { describe, it, expect } from 'vitest'
import { detectarCapitulos, capitulosRaros, contarPalabras, normalizar } from './docxCapitulos.js'

const L = (texto, estilo = 'Normal') => ({ texto, estilo })

describe('detectarCapitulos (mismas reglas que procesar_libro_solo.py)', () => {
  it('parte por «Capítulo N» y no guarda la línea del encabezado', () => {
    const r = detectarCapitulos([L('Capítulo 1'), L('Uno.'), L('Dos.'), L('CAPÍTULO 2'), L('Tres.')])
    expect(r.capitulos).toEqual([['Uno.', 'Dos.'], ['Tres.']])
    expect(r.descartadasAlInicio).toEqual([])
  })

  it('reconoce Cap., Chapter, Parte, romanos solos y estilos Heading', () => {
    const r = detectarCapitulos([
      L('Cap. IV'), L('Uno'), L('Chapter 2'), L('Dos'), L('Parte 3'), L('Tres'),
      L('XIV.'), L('Cuatro'), L('El regreso', 'heading 1'), L('Cinco'),
    ])
    expect(r.capitulos).toEqual([['Uno'], ['Dos'], ['Tres'], ['Cuatro'], ['Cinco']])
  })

  it('número solo + título en MAYÚSCULAS: descarta las dos líneas', () => {
    const r = detectarCapitulos([L('5'), L('UN DECRETO EN DOS ARTÍCULOS'), L('Texto.')])
    expect(r.capitulos).toEqual([['Texto.']])
  })

  it('un número suelto sin título en mayúsculas es texto normal', () => {
    const r = detectarCapitulos([L('Capítulo 1'), L('42'), L('y siguió.')])
    expect(r.capitulos).toEqual([['42', 'y siguió.']])
  })

  it('lo que hay antes del primer capítulo se devuelve aparte (no se guarda)', () => {
    const r = detectarCapitulos([L('La casa del faro', 'Title'), L('Para Ana'), L('Capítulo 1'), L('Texto.')])
    expect(r.descartadasAlInicio).toEqual(['La casa del faro', 'Para Ana'])
    expect(r.capitulos).toEqual([['Texto.']])
  })

  it('encabezados seguidos sin texto no crean capítulos vacíos', () => {
    const r = detectarCapitulos([L('Capítulo 1'), L('Capítulo 2'), L('Texto.')])
    expect(r.capitulos).toEqual([['Texto.']])
  })

  it('una frase que empieza por «Capitulo» sin número no es encabezado', () => {
    const r = detectarCapitulos([L('Capítulo 1'), L('Capitulos enteros pasaron.')])
    expect(r.capitulos).toEqual([['Capitulos enteros pasaron.']])
  })
})

describe('ayudas', () => {
  it('normalizar quita acentos', () => expect(normalizar('CAPÍTULO Ñandú')).toBe('capitulo nandu'))
  it('contarPalabras cuenta por espacios', () => {
    expect(contarPalabras('  Segundo  párrafo con cinco palabras. ')).toBe(5)
    expect(contarPalabras('   ')).toBe(0)
  })
  it('capitulosRaros marca los de más del doble de la mediana', () => {
    expect(capitulosRaros([3400, 3800, 3600, 7920, 3300])).toEqual([3])
    expect(capitulosRaros([100, 900])).toEqual([])
  })
  it('capitulosRaros no salta con capítulos cortos y desiguales', () => {
    expect(capitulosRaros([108, 427, 597, 339, 751, 300, 1400, 250])).toEqual([])
  })
})
