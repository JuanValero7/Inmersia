// @ts-check
// La cápsula del tiempo (no ficción): cuándo salta y qué se puede enviar.
// Reglas: Documentation/colegios/capsula-prompt.md (migración 098).

/**
 * @typedef {{ id: string, texto: string }} PreguntaCapsula
 * @typedef {{ preguntas: PreguntaCapsula[], estado: 'nueva'|'sellada'|'abierta',
 *   sellada_at: string|null, abierta_at: string|null, puede_sellar: boolean,
 *   con_profe: boolean, antes?: string[], ahora?: string[] }} EstadoCapsula
 */

// Lo mismo que _capsula_limpiar() de la 098.
export const MIN_CARACTERES = 3
export const MAX_CARACTERES = 600

/** @param {string} t */
export const respuestaValida = (t) => {
  const n = (t ?? '').trim().length
  return n >= MIN_CARACTERES && n <= MAX_CARACTERES
}

/**
 * Todas las preguntas respondidas (y ninguna demasiado larga).
 * @param {string[]} respuestas
 * @param {number} n  cuántas preguntas hay
 */
export const completas = (respuestas, n) => respuestas.length === n && respuestas.every(respuestaValida)

/**
 * Salta al abrir el libro: sin sellar, todavía en el capítulo 1 (la base de
 * datos dice si ya terminó alguno) y sin «Ahora no» en esta sesión.
 * @param {EstadoCapsula|null} c
 * @param {number} chapterIndex
 * @param {boolean} cerrada
 */
export const tocaAlEmpezar = (c, chapterIndex, cerrada) =>
  !!c && c.estado === 'nueva' && c.puede_sellar && chapterIndex === 0 && !cerrada

/**
 * Salta al pasar del último capítulo, si está sellada y sin abrir.
 * @param {EstadoCapsula|null} c
 * @param {boolean} enUltimoCapitulo
 * @param {boolean} cerrada
 */
export const tocaAlTerminar = (c, enUltimoCapitulo, cerrada) =>
  !!c && c.estado === 'sellada' && enUltimoCapitulo && !cerrada

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * «10 nov 2026», la fecha de la etiqueta de la lata.
 * @param {string|null|undefined} iso
 */
export function fechaCapsula(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}
