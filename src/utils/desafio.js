// @ts-check
// El desafío del gato en el lector: cuándo salta y qué se pinta en la charla.
// Reglas: Documentation/colegios/desafio-prompt.md (migración 092).

/**
 * @typedef {{ de: 'gato'|'alumno', texto: string }} Turno
 * @typedef {{ momento: 'mitad'|'final', tras_capitulo: number,
 *   pregunta: { id: string, tipo: string, consigna: string },
 *   estado: 'nueva'|'abierta'|'evaluando'|'terminada', turnos: Turno[] }} Momento
 */

export const MIN_PALABRAS = 2
export const MAX_PALABRAS = 150

/**
 * El momento que toca abrir al pasar del final del capítulo `capNum`: el
 * primero sin terminar cuyo capítulo ya se leyó y que no se cerró con «Ahora
 * no» en esta sesión. Así, si lo deja para luego, vuelve a ofrecerse al
 * terminar otro capítulo más adelante (o al volver a abrir el libro).
 * @param {Momento[]} momentos
 * @param {number|null} capNum
 * @param {Set<string>} cerrados
 * @returns {Momento|null}
 */
export function momentoQueToca(momentos, capNum, cerrados) {
  if (capNum == null) return null
  return momentos.find(m => m.estado !== 'terminada' && !cerrados.has(m.momento) && capNum >= m.tras_capitulo) ?? null
}

/**
 * Las piezas de la charla en orden: la pregunta (el primer turno del gato, o
 * la consigna si aún no empezó) y luego los mensajes.
 * @param {Momento} m
 * @returns {{ consigna: string, mensajes: Turno[] }}
 */
export function piezasCharla(m) {
  const [primero, ...resto] = m.turnos
  if (primero?.de === 'gato') return { consigna: primero.texto, mensajes: resto }
  return { consigna: m.pregunta.consigna, mensajes: m.turnos }
}

/**
 * Cuántos mensajes le quedan al alumno (como mucho 3 por charla).
 * @param {Momento} m
 * @param {number} max
 */
export function mensajesQueQuedan(m, max = 3) {
  return Math.max(0, max - m.turnos.filter(t => t.de === 'alumno').length)
}
