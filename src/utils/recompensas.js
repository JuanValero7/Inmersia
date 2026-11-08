// @ts-check
// Tienda de recompensas (migración 095): textos y cuentas que comparten la
// tienda del alumno (components/recompensas) y el Salón del profe
// (colegio/RecompensasAula.jsx).

/** @typedef {'alumno'|'semana'|'clase'|'libre'} Limite */

/** Las opciones del profe al crear un vale, en el orden del desplegable. */
export const LIMITES = /** @type {const} */ ([
  ['alumno', 'Una vez por alumno'],
  ['semana', 'Una vez por semana'],
  ['clase', 'Solo uno en toda la clase'],
  ['libre', 'Sin límite'],
])

/** @param {string} limite */
export function textoLimite(limite) {
  return LIMITES.find(([k]) => k === limite)?.[1] ?? ''
}

/** Por debajo de esto, la tienda avisa de que se queda sin ovillos para jugar. */
export const POCOS_OVILLOS = 10

/**
 * @param {number} saldo
 * @param {number} precio
 * @returns {{ queda: number, alcanza: boolean, aviso: null|'falta'|'poco' }}
 */
export function cuentaCanje(saldo, precio) {
  const queda = saldo - precio
  if (queda < 0) return { queda, alcanza: false, aviso: 'falta' }
  return { queda, alcanza: true, aviso: queda < POCOS_OVILLOS ? 'poco' : null }
}

/**
 * Por qué un vale no se puede canjear ahora (lo decide la base de datos).
 * @param {{ bloqueo: null|string, desde?: string|null }} r
 * @param {Date} [hoy]
 */
export function textoBloqueo(r, hoy = new Date()) {
  if (r.bloqueo === 'ya_canjeado') return 'Ya lo canjeaste'
  if (r.bloqueo === 'agotado') return 'Ya se lo llevó alguien de tu clase'
  if (r.bloqueo === 'esta_semana') {
    if (!r.desde) return 'Vuelve la semana que viene'
    const d = new Date(r.desde)
    const dias = Math.ceil((d.getTime() - hoy.getTime()) / 86_400_000)
    if (dias <= 1) return 'Vuelve mañana'
    return `Vuelve el ${d.toLocaleDateString('es', { weekday: 'long', day: 'numeric' })}`
  }
  return null
}

/** @param {number} n */
export const ovillos = (n) => `${n} ${n === 1 ? 'ovillo' : 'ovillos'}`

/** «Expediente: Rudyard Kipling» → «Rudyard Kipling» (el estante ya dice que son expedientes). */
export const sinPrefijo = (/** @type {string} */ t) => t.replace(/^Expediente:\s*/i, '').replace(/^./, (c) => c.toUpperCase())
