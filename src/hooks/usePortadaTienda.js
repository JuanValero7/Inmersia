// src/hooks/usePortadaTienda.js
// ─────────────────────────────────────────────────────────────
// Lo que muestra la portada de la Tienda, igual en escritorio
// (TiendaPrincipal) y en móvil (TiendaPrincipalMobile):
//   · la temporada vigente y sus libros
//   · las salas, con sus libros
//   · los carriles con reglas fijas (decisión 4 del plan de la tienda)
// Cada pantalla decide cuántos carriles enseña y cuántos libros por
// carril (escritorio 3 × 8, móvil 2 × 6). Un libro sale en un solo
// carril: ver repartir().
// ─────────────────────────────────────────────────────────────
import { useMemo, useCallback } from 'react'
import { useSalasQuery, useLibrosPalabrasQuery } from '../lib/queries.js'
import { seLeeEnUnaTarde } from '../utils/formato.js'
import { esVisitable } from '../components/tienda/salaPiezas.jsx'

// Orden en que los carriles eligen sus libros (en pantalla se ven en el
// orden de la lista de abajo). «Recién llegados» elige primero porque
// saltarse un libro lo haría mentir; «Para empezar» el último porque es
// el orden curado: saltarse uno solo trae al siguiente de la lista.
const PRIORIDAD = ['nuevos', 'tarde', 'empezar']

/** Corta cada carril a `porCarril` libros sin repetir ninguno entre carriles. */
function repartir(carriles, porCarril) {
  const usados = new Set()
  const elegidos = {}
  const orden = [...carriles].sort((a, b) => PRIORIDAD.indexOf(a.clave) - PRIORIDAD.indexOf(b.clave))
  for (const c of orden) {
    elegidos[c.clave] = c.libros.filter(l => !usados.has(l.id)).slice(0, porCarril)
    elegidos[c.clave].forEach(l => usados.add(l.id))
  }
  return carriles.map(c => ({ ...c, libros: elegidos[c.clave] })).filter(c => c.libros.length)
}

/**
 * @param {object[]} catalogo  libros visibles, ya en el orden curado (libros.orden)
 * @param {{ claves: string[], porCarril: number }} medida
 *   qué carriles enseña la pantalla y cuántos libros por carril
 * @returns {{ temporada: object|null, temporadaLibros: object[], salas: object[],
 *   librosDe: (sala: object) => object[],
 *   carriles: Array<{ clave: string, titulo: string, subtitulo: string, libros: object[] }> }}
 */
export function usePortadaTienda(catalogo, { claves, porCarril }) {
  const { data: todas = [] } = useSalasQuery()
  const { data: palabras = {} } = useLibrosPalabrasQuery()

  const porId = useMemo(() => new Map(catalogo.map(l => [l.id, l])), [catalogo])
  const librosDe = useCallback((sala) => sala.libros.map(id => porId.get(id)).filter(Boolean), [porId])

  const temporada = todas.find(s => s.tipo === 'temporada' && esVisitable(s)) || null
  const salas = useMemo(() => todas.filter(s => s.tipo === 'sala'), [todas])

  // `claves` es una constante de módulo en cada pantalla: referencia estable.
  const carriles = useMemo(() => repartir([
    { clave: 'empezar', titulo: 'Para empezar', subtitulo: 'Puertas de entrada, elegidas a mano.',
      libros: catalogo },
    { clave: 'tarde', titulo: 'Se leen en una tarde', subtitulo: 'Historias completas en dos horas o menos.',
      libros: catalogo.filter(l => seLeeEnUnaTarde(palabras[l.id])) },
    { clave: 'nuevos', titulo: 'Recién llegados', subtitulo: 'Lo último que entró en la tienda.',
      libros: [...catalogo].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')) },
  ].filter(c => claves.includes(c.clave)), porCarril), [catalogo, palabras, claves, porCarril])

  return {
    temporada,
    temporadaLibros: temporada ? librosDe(temporada) : [],
    salas,
    librosDe,
    carriles,
  }
}
