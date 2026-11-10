// @ts-check
// Tienda de recompensas (migraciones 095 y 097): textos y cuentas que
// comparten la tienda del alumno (components/recompensas) y el Salón del
// profe (colegio/RecompensasAula.jsx).

/** @typedef {'alumno'|'semana'|'clase'|'libre'|'bote'} Limite */

/** Las opciones del profe al crear un vale, en el orden del desplegable. */
export const LIMITES = /** @type {const} */ ([
  ['alumno', 'Una vez por alumno'],
  ['semana', 'Una vez por semana'],
  ['clase', 'Solo uno en toda la clase'],
  ['libre', 'Sin límite'],
])

/** @param {string} limite */
export function textoLimite(limite) {
  if (limite === 'bote') return 'Bote de la clase'
  return LIMITES.find(([k]) => k === limite)?.[1] ?? ''
}

/** El profe pone el precio que quiera (1 a 9.999); Inmersia solo sugiere. */
export const PRECIO_MAX = 9999

/** Redondeo de los precios sugeridos: de 1 en 1 por debajo de 10, de 5 en 5 desde ahí. */
export function redondear(/** @type {number} */ n) {
  return n < 10 ? Math.max(1, Math.round(n)) : Math.round(n / 5) * 5
}

/**
 * Precios sugeridos para un vale, a partir de lo que da solo leer el libro
 * del aula: la pequeña y la mediana se alcanzan leyendo; la grande pide
 * jugar bien o ahorrar todo el libro.
 * @param {number} soloLeyendo
 * @returns {Array<[string, number]>}
 */
export function preciosSugeridos(soloLeyendo) {
  return [['Pequeña', redondear(soloLeyendo / 3)], ['Mediana', redondear(soloLeyendo)], ['Grande', redondear(soloLeyendo * 2)]]
}

/**
 * Precio sugerido para un bote de la clase: la mitad de lo que junta toda la
 * clase solo leyendo, de 10 en 10 (nunca menos que lo de un alumno).
 * @param {number} soloLeyendo
 * @param {number} alumnos
 */
export function boteSugerido(soloLeyendo, alumnos) {
  return Math.max(redondear(soloLeyendo), Math.round((soloLeyendo * alumnos) / 2 / 10) * 10)
}

/** Nombres de las partes de la cuenta de ovillos (desglose de _referencia_ovillos). */
export const PARTES_OVILLOS = /** @type {const} */ ([
  ['lectura', 'Leer los capítulos'],
  ['mesa', 'Mesa de investigación'],
  ['corazonadas', 'Corazonadas'],
  ['mapa', 'Mapa del tesoro'],
  ['concurso', 'Frases difíciles'],
  ['falsificador', 'El falsificador'],
  ['hilo', 'Hilo de ideas'],
])

/** @param {string} juego */
export const nombreJuego = (juego) => PARTES_OVILLOS.find(([k]) => k === juego)?.[1] ?? juego

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
  if (r.bloqueo === 'lleno') return '¡Lleno! Tu profe ya lo ve'
  if (r.bloqueo === 'entregado') return 'Ya se entregó'
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
