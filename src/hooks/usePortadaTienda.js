// src/hooks/usePortadaTienda.js
// ─────────────────────────────────────────────────────────────
// Lo que muestra la portada de la Tienda, igual en escritorio
// (TiendaPrincipal) y en móvil (TiendaPrincipalMobile):
//   · la temporada vigente y sus libros
//   · las salas, con sus libros
//   · los carriles con reglas fijas (decisión 4 del plan de la tienda)
// Cada pantalla decide cuántos carriles enseña y cuántos libros por
// carril (escritorio 3 × 8, móvil 2 × 6).
// ─────────────────────────────────────────────────────────────
import { useMemo, useCallback } from 'react'
import { useSalasQuery, useLibrosPalabrasQuery } from '../lib/queries.js'
import { seLeeEnUnaTarde } from '../utils/formato.js'
import { esVisitable } from '../components/tienda/salaPiezas.jsx'

/**
 * @param {object[]} catalogo  libros visibles, ya en el orden curado (libros.orden)
 * @returns {{ temporada: object|null, temporadaLibros: object[], salas: object[],
 *   librosDe: (sala: object) => object[],
 *   carriles: Array<{ clave: string, titulo: string, subtitulo: string, libros: object[] }> }}
 */
export function usePortadaTienda(catalogo) {
  const { data: todas = [] } = useSalasQuery()
  const { data: palabras = {} } = useLibrosPalabrasQuery()

  const porId = useMemo(() => new Map(catalogo.map(l => [l.id, l])), [catalogo])
  const librosDe = useCallback((sala) => sala.libros.map(id => porId.get(id)).filter(Boolean), [porId])

  const temporada = todas.find(s => s.tipo === 'temporada' && esVisitable(s)) || null
  const salas = useMemo(() => todas.filter(s => s.tipo === 'sala'), [todas])

  // Todos los libros de cada carril: quien los pinta corta a su medida.
  const carriles = useMemo(() => [
    { clave: 'empezar', titulo: 'Para empezar', subtitulo: 'Puertas de entrada, elegidas a mano.',
      libros: catalogo },
    { clave: 'tarde', titulo: 'Se leen en una tarde', subtitulo: 'Historias completas en dos horas o menos.',
      libros: catalogo.filter(l => seLeeEnUnaTarde(palabras[l.id])) },
    { clave: 'nuevos', titulo: 'Recién llegados', subtitulo: 'Lo último que entró en la tienda.',
      libros: [...catalogo].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')) },
  ].filter(c => c.libros.length), [catalogo, palabras])

  return {
    temporada,
    temporadaLibros: temporada ? librosDe(temporada) : [],
    salas,
    librosDe,
    carriles,
  }
}
