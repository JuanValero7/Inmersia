// @ts-check
// El falsificador (no ficción): párrafos sospechosos, la mitad inventados por
// Claude imitando al autor. Reglas: Documentation/colegios/falsificador-prompt.md.
//
// El falso es un párrafo NUEVO: se mete en la lista de párrafos del capítulo
// antes de paginar (como el chip de las corazonadas), con tipo 'falso', y los
// dos paginadores lo miden y lo parten igual que a un párrafo del libro. El
// resto del lector no lo ve: sinInsertos (utils/corazonadas.js) lo quita.
// El texto del libro no se toca nunca.

/**
 * @typedef {{ dijo: 'autor'|'gato', acierto: boolean, falso: boolean, raro?: string, verdad: string }} Respuesta
 * @typedef {{ id: string, cap: number, parrafo: number, texto?: string, respuesta?: Respuesta }} Item
 *   parrafo: en un falso, el párrafo DESPUÉS del cual va; en un real, el párrafo mismo.
 *   texto: solo los falsos.
 * @typedef {{ id: string, tipo: 'falso', falsoId: string, contenido: string, texto: string }} ParrafoFalso
 */

/** Id del párrafo falso en la lista del capítulo (y en el DOM). */
export const idFalso = (/** @type {string} */ id) => `fx-${id}`

/**
 * Mete cada falso después de su párrafo (`parrafo` = parrafos.numero).
 * @template {{ id: string, numero?: number, tipo?: string }} P
 * @param {P[]} parrafos
 * @param {Item[]} falsos  los del capítulo, con texto
 * @returns {(P | ParrafoFalso)[]}
 */
export function conFalsos(parrafos, falsos) {
  if (!falsos?.length || !parrafos?.length) return parrafos
  const porNumero = new Map(falsos.map(f => [f.parrafo, f]))
  /** @type {(P | ParrafoFalso)[]} */
  const salida = []
  for (const p of parrafos) {
    salida.push(p)
    const f = p.numero != null ? porNumero.get(p.numero) : undefined
    if (f?.texto) salida.push({ id: idFalso(f.id), tipo: 'falso', falsoId: f.id, contenido: f.texto, texto: f.texto })
  }
  return salida
}

/**
 * ¿Este trozo es el comienzo del falso? (si el paginador lo partió, el sello
 * va solo en el primero).
 * @param {{ contenido?: string, texto?: string }} p
 */
export const esComienzo = (p) => !p.texto || p.texto.startsWith(p.contenido ?? '')

/**
 * El trozo de pantalla donde está el sospechoso (en el DOM: data-falso-id o
 * data-parrafo-id). `pantalla` = los párrafos de una pantalla.
 * @param {Item} item
 * @param {{ id: string, numero?: number, tipo?: string, falsoId?: string }[]} pantalla
 */
export function trozoEn(item, pantalla) {
  return pantalla.find(p => item.texto ? p.falsoId === item.id : (p.tipo !== 'falso' && p.numero === item.parrafo)) ?? null
}

/**
 * Lo que ve el profe, por alumno: trampas pilladas y veces que confió en el autor.
 * @param {{ items?: { id: string, falso: boolean, inicio?: string }[]|null, jugadas?: Record<string, Record<string, boolean>> }} aula
 * @param {{ user_id: string }[]} alumnos
 */
export function resumenFalsificador(aula, alumnos) {
  const items = aula.items ?? []
  const falsos = items.filter(x => x.falso)
  const reales = items.filter(x => !x.falso)
  const jugadas = aula.jugadas ?? {}
  const filas = alumnos.map(a => {
    const j = jugadas[a.user_id] ?? {}
    return {
      user_id: a.user_id,
      respondidos: Object.keys(j).length,
      pillo: falsos.filter(x => j[x.id] === true).length,
      confio: reales.filter(x => j[x.id] === true).length,
    }
  })
  // El que más engañó: más fallos (y, si empatan, el que más gente respondió).
  let masEngano = null
  for (const x of items) {
    const resp = Object.values(jugadas).filter(j => x.id in j)
    const fallos = resp.filter(j => j[x.id] === false).length
    if (fallos > 0 && (!masEngano || fallos > masEngano.fallos || (fallos === masEngano.fallos && resp.length > masEngano.respondidos)))
      masEngano = { ...x, fallos, respondidos: resp.length }
  }
  return { filas, totalFalsos: falsos.length, totalReales: reales.length, masEngano }
}
