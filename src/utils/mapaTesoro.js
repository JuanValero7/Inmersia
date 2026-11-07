// @ts-check
// El mapa del tesoro en el lector: qué fichas se ven, cuándo brilla el borde
// del libro y si un subrayado se puede mandar al mapa. El servidor decide si
// es tesoro; esto solo evita llamadas que se sabe que no valen.

import { contarPalabras } from './concurso.js'

/** @typedef {import('../hooks/useMapaTesoro.js').Tesoro} Tesoro */

export const MIN_PALABRAS = 3

/**
 * Las fichas de un capítulo que el alumno puede ver. Las que serían spoiler
 * aparecen cuando el lector llega a su brillo (y ya no se van).
 * @param {Tesoro[]} tesoros
 * @param {number} cap
 * @param {number} hastaParrafo  el párrafo más avanzado que ha visto en ese capítulo
 */
export function fichasDelCapitulo(tesoros, cap, hastaParrafo) {
  return tesoros.filter(t => t.cap === cap && (!t.spoiler || t.encontrado || hastaParrafo >= t.brillo[0]))
}

/**
 * ¿Brilla el borde del libro? Sí, si en pantalla hay algún párrafo dentro del
 * brillo de un tesoro del capítulo que aún no se ha encontrado.
 * @param {Tesoro[]} tesoros
 * @param {number} cap
 * @param {number[]} parrafosEnPantalla
 */
export function brilla(tesoros, cap, parrafosEnPantalla) {
  return tesoros.some(t => t.cap === cap && !t.encontrado
    && parrafosEnPantalla.some(n => n >= t.brillo[0] && n <= t.brillo[1]))
}

/** ¿Quedan tesoros sin encontrar en el capítulo? @param {Tesoro[]} tesoros @param {number} cap */
export function quedanTesoros(tesoros, cap) {
  return tesoros.some(t => t.cap === cap && !t.encontrado)
}

/**
 * Por qué un subrayado no se puede mandar al mapa, o null si se puede.
 * El servidor compara un solo párrafo: si el subrayado cruza varios, no vale.
 * @param {{ text: string, parrafoId: string }[]} segmentos
 * @returns {null | 'varios_parrafos' | 'corto'}
 */
export function motivoNoMapa(segmentos) {
  if (new Set(segmentos.map(s => s.parrafoId)).size > 1) return 'varios_parrafos'
  if (contarPalabras(segmentos.map(s => s.text).join(' ')) < MIN_PALABRAS) return 'corto'
  return null
}
