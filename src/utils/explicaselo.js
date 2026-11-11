// @ts-check
// Explícaselo a… (no ficción, migración 101): los personajes de la ruleta y
// las reglas que se comprueban antes de enviar.
// Reglas del juego: Documentation/colegios/explicaselo-prompt.md.

/**
 * @typedef {'abuela'|'primo'|'pirata'|'marciano'|'ceo'|'granjero'} IdPersonaje
 * @typedef {{ de: 'alumno'|'personaje', texto: string }} Turno
 * @typedef {{ momento: 'mitad'|'final', tras_capitulo: number, consigna: string,
 *   prohibidas: { palabras: string[], raices: string[] },
 *   estado: 'nueva'|'ruleta'|'abierta'|'evaluando'|'terminada',
 *   personaje: IdPersonaje|null, giros: number, turnos: Turno[],
 *   resultado?: 'entendio'|'casi'|'igual', rompio_regla?: boolean,
 *   puntos?: { t: string, cubierto: boolean }[], referencia?: string }} MomentoEx
 */

export const MIN_PALABRAS = 2
export const MAX_PALABRAS = 150
export const MAX_FRASES_PIRATA = 3

/**
 * Los 6 personajes, en el orden de la ruleta (el mismo que
 * _explicaselo_personajes() en la 101 y PERSONAJES en explicaselo-evaluar).
 * `corto`: lo que va escrito en la rueda. `color`: su sector.
 * `regla`: la del marciano se completa con las palabras del libro.
 */
export const PERSONAJES = /** @type {const} */ ([
  { id: 'abuela', corto: 'Abuela', nombre: 'Tu abuela', color: '#ffd2b8',
    regla: 'Sin palabras de economía: con cosas de la casa y del mercado.' },
  { id: 'primo', corto: 'Primo', nombre: 'Tu primo de 6 años', color: '#e6f2e9',
    regla: 'Frases cortas y un ejemplo con golosinas o juguetes.' },
  { id: 'pirata', corto: 'Pirata', nombre: 'Un pirata', color: '#fff3c9',
    regla: `Explícaselo en no más de ${MAX_FRASES_PIRATA} frases.` },
  { id: 'marciano', corto: 'Marciano', nombre: 'Un marciano', color: '#e6eef7',
    regla: 'No entiende algunas palabras: no puedes usarlas.' },
  { id: 'ceo', corto: 'CEO', nombre: 'Kevin Escalada, CEO de Sinergix', color: '#fbe5e1',
    regla: 'Véndele la idea: que le va a cambiar la vida y le hará ganar millones con un producto.' },
  { id: 'granjero', corto: 'Granjero', nombre: 'Un granjero medieval', color: '#efe3ff',
    regla: 'Nada que se haya inventado después del año 1500: con su granja, su aldea y la feria.' },
])

/** @param {string|null|undefined} id */
export const personaje = (id) => PERSONAJES.find(p => p.id === id) ?? null

/**
 * La regla tal como la lee el alumno (la del marciano, con las palabras del libro).
 * @param {IdPersonaje} id
 * @param {string[]} [palabras]
 */
export function reglaDe(id, palabras = []) {
  const p = personaje(id)
  if (!p) return ''
  if (id === 'marciano' && palabras.length) {
    return `No sabe qué es ${unir(palabras)}: no puedes usar esas palabras.`
  }
  return p.regla
}

/** «a», «a ni b», «a, b ni c» @param {string[]} xs */
function unir(xs) {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} ni ${xs[xs.length - 1]}`
}

/**
 * Frases de un texto: trozos con letras o números entre . ! ? (igual que
 * _explicaselo_frases en la 101). «…» no corta; «¿» y «¡» no cuentan.
 * @param {string} texto
 */
export function contarFrases(texto) {
  return (texto || '').split(/[.!?]+/).filter(t => /[\p{L}\p{N}]/u.test(t)).length
}

/** Sin mayúsculas ni tildes (como translate(lower(…)) en la 101). @param {string} t */
const plano = (t) => (t || '').toLowerCase().replace(/[áàéèíìóòúùü]/g, c => 'aaeeiioouuu'['áàéèíìóòúùü'.indexOf(c)])

/**
 * La primera raíz prohibida que aparece al comienzo de una palabra, o null
 * (igual que _explicaselo_prohibida en la 101).
 * @param {string} texto
 * @param {string[]} raices
 */
export function palabraProhibida(texto, raices) {
  const t = plano(texto)
  return raices.find(r => /^[a-zñ]+$/.test(r) && empiezaPalabra(t, r)) ?? null
}

/** ¿`r` aparece en `t` justo al comienzo de una palabra? @param {string} t @param {string} r */
function empiezaPalabra(t, r) {
  for (let i = t.indexOf(r); i >= 0; i = t.indexOf(r, i + 1)) {
    if (i === 0 || !/[a-zñ0-9]/.test(t[i - 1])) return true
  }
  return false
}

/**
 * Lo que impide enviar por la regla del personaje (o null). La base de datos
 * lo vuelve a comprobar.
 * @param {IdPersonaje|null} id
 * @param {string} texto
 * @param {{ palabras: string[], raices: string[] }} [prohibidas]
 * @returns {null|{ tipo: 'frases', n: number }|{ tipo: 'palabra', palabra: string }}
 */
export function avisoRegla(id, texto, prohibidas) {
  if (id === 'pirata') {
    const n = contarFrases(texto)
    return n > MAX_FRASES_PIRATA ? { tipo: 'frases', n } : null
  }
  if (id === 'marciano' && prohibidas) {
    const r = palabraProhibida(texto, prohibidas.raices)
    if (!r) return null
    // La palabra para mostrar: la de la lista que empieza igual, o la raíz.
    const palabra = prohibidas.palabras.find(p => plano(p).startsWith(r)) ?? r
    return { tipo: 'palabra', palabra }
  }
  return null
}

/**
 * El ángulo al que tiene que llegar la rueda para que el personaje quede
 * bajo el puntero (arriba), siempre girando hacia delante unas vueltas.
 * @param {IdPersonaje} id
 * @param {number} desde   ángulo actual
 * @param {number} [vueltas]
 */
export function anguloPara(id, desde, vueltas = 5) {
  const i = PERSONAJES.findIndex(p => p.id === id)
  const sector = 360 / PERSONAJES.length
  const objetivo = 360 - (i * sector + sector / 2)
  return desde - (((desde % 360) + 360) % 360) + 360 * vueltas + objetivo
}

/** Ovillos de cada veredicto (los da la 101). */
export const PREMIO = { entendio: 3, casi: 1, igual: 0 }

/**
 * Cuántos mensajes le quedan al alumno (como mucho 2).
 * @param {MomentoEx} m
 * @param {number} [max]
 */
export function mensajesQueQuedan(m, max = 2) {
  return Math.max(0, max - m.turnos.filter(t => t.de === 'alumno').length)
}
