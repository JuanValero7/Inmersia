// @ts-check
// El hilo de ideas (no ficción): el «método Anderson» de los libros de no
// ficción. Reglas: Documentation/colegios/hilo-prompt.md; las aplica la base
// de datos (migración 100). Aquí solo lo que se pinta: dónde va cada tarjeta
// en la pizarra, qué dice cada idea según las pistas que el lector puso, y
// los resúmenes de la carpeta y del profe.

/**
 * @typedef {{ id: string, cap: number, t: string, cita: string, usada_en?: string }} PistaHilo
 * @typedef {{ id: string, final: 'principal'|'extra'|null, previas: string[], huecos: number, abre: number,
 *   estado: 'cerrada'|'abierta'|'armada', titulo?: string, pregunta?: string, conclusion?: string,
 *   piezas?: string[], falta?: string, ultima?: { pistas: string[], resultado: string }, pareja?: string[] }} IdeaHilo
 * @typedef {{ version: number, capitulos_completados: number, total_capitulos: number, saldo: number,
 *   pistas: PistaHilo[], ideas: IdeaHilo[],
 *   faltaron: { id: string, titulo: string, conclusion: string, piezas: string[] }[]|null }} EstadoHilo
 */

// Geometría de la pizarra (la de la maqueta): tarjetas de 172 px, columnas cada
// 190 y filas cada 124 (las tarjetas miden menos de 100 px).
export const TARJETA = 172
const PASO_X = 190
const PASO_Y = 124
const MARGEN = 14
const ALTO_TARJETA = 104
const FILAS_MAX = 3

/**
 * Dónde va cada idea. Cada columna es un paso del hilo: una idea va a la
 * derecha de las ideas de las que sale. Las que no salen de ninguna se
 * colocan lo más cerca posible de la idea a la que llegan, sin pasar de 3
 * por columna (si no cabe, una columna antes). Dentro de la columna, cada
 * una a la altura de sus ideas previas, para que los hilos crucen poco.
 * @param {{ id: string, previas: string[] }[]} ideas  en el orden del contenido
 * @param {{ ancho?: number, tarjeta?: number, pasoY?: number, altoTarjeta?: number }} [opts]
 *   ancho: si sobra sitio, las columnas se separan para llenarlo (PC: la pizarra
 *   ocupa todo el marco, como la Cartelera). tarjeta/pasoY/altoTarjeta: en PC las
 *   tarjetas son más anchas y más bajas (la pregunta cabe en 2 líneas).
 * @returns {{ pos: Record<string, { x: number, y: number }>, ancho: number, alto: number, tarjeta: number }}
 */
export function colocar(ideas, opts = {}) {
  const { ancho: anchoDeseado = 0, tarjeta = TARJETA, pasoY = PASO_Y, altoTarjeta = ALTO_TARJETA } = opts
  const porId = Object.fromEntries(ideas.map(i => [i.id, i]))
  /** @type {Record<string, number>} */
  const col = {}
  const prof = (/** @type {string} */ id, /** @type {string[]} */ camino = []) => {
    if (col[id] != null) return col[id]
    const previas = (porId[id]?.previas ?? []).filter(p => porId[p] && !camino.includes(p))
    col[id] = previas.length ? 1 + Math.max(...previas.map(p => prof(p, [...camino, id]))) : 0
    return col[id]
  }
  ideas.forEach(i => prof(i.id))

  // Las sueltas (sin ideas previas) se acercan a la idea que las usa.
  const usan = (/** @type {string} */ id) => ideas.filter(i => i.previas.includes(id))
  const sueltas = ideas.filter(i => !i.previas.some(p => porId[p]) && usan(i.id).length)
  const fijas = ideas.filter(i => !sueltas.includes(i))
  /** @type {Record<number, number>} */
  const cuenta = {}
  fijas.forEach(i => { cuenta[col[i.id]] = (cuenta[col[i.id]] ?? 0) + 1 })
  const limite = (/** @type {{ id: string }} */ i) => Math.min(...usan(i.id).map(u => col[u.id])) - 1
  ;[...sueltas].sort((a, b) => limite(b) - limite(a)).forEach(i => {
    let c = limite(i)
    while (c > 0 && (cuenta[c] ?? 0) >= FILAS_MAX) c--
    col[i.id] = c
    cuenta[c] = (cuenta[c] ?? 0) + 1
  })

  const columnas = Math.max(...ideas.map(i => col[i.id])) + 1
  const pasoMin = tarjeta + PASO_X - TARJETA
  const pasoX = columnas > 1 ? Math.max(pasoMin, (anchoDeseado - MARGEN * 2 - tarjeta) / (columnas - 1)) : pasoMin
  const filas = Math.max(FILAS_MAX, ...Object.values(cuenta))
  const centro = ((filas - 1) * pasoY) / 2
  /** @type {Record<string, { x: number, y: number }>} */
  const pos = {}
  for (let c = 0; c < columnas; c++) {
    const enCol = ideas.filter(i => col[i.id] === c)
    // Altura deseada: la media de sus ideas previas ya colocadas, o el centro.
    const deseo = (/** @type {{ id: string, previas: string[] }} */ i) => {
      const ys = i.previas.filter(p => pos[p]).map(p => pos[p].y)
      return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : centro
    }
    const orden = [...enCol].sort((a, b) => deseo(a) - deseo(b))
    const huecos = mejoresFilas(orden.map(deseo), filas, pasoY)
    orden.forEach((i, k) => { pos[i.id] = { x: Math.round(MARGEN + c * pasoX), y: 16 + huecos[k] * pasoY } })
  }
  return { pos, ancho: Math.round(MARGEN * 2 + (columnas - 1) * pasoX + tarjeta), alto: 16 + (filas - 1) * pasoY + altoTarjeta + 16, tarjeta }
}

/** Las filas (en orden) que menos se alejan de la altura que quiere cada tarjeta. */
function mejoresFilas(/** @type {number[]} */ deseos, /** @type {number} */ filas, /** @type {number} */ pasoY) {
  let mejor = /** @type {number[]} */ ([]), coste = Infinity
  const probar = (/** @type {number[]} */ elegidas, /** @type {number} */ desde) => {
    if (elegidas.length === deseos.length) {
      const c = elegidas.reduce((s, f, k) => s + Math.abs(16 + f * pasoY - deseos[k]), 0)
      if (c < coste) { coste = c; mejor = elegidas }
      return
    }
    for (let f = desde; f <= filas - (deseos.length - elegidas.length); f++) probar([...elegidas, f], f + 1)
  }
  probar([], 0)
  return mejor
}

/**
 * Lo que dice una idea abierta con las pistas que el lector le puso.
 * @param {IdeaHilo} idea
 * @param {string[]} mano       pistas puestas en sus huecos
 * @param {Record<string, IdeaHilo>} ideas  todas, por id
 */
export function infoIdea(idea, mano, ideas) {
  const faltanIdeas = idea.previas.filter(p => ideas[p]?.estado !== 'armada')
  const lleno = mano.length === idea.huecos
  // Lo que dijo la última jugada, solo si las piezas siguen siendo las mismas.
  const u = idea.ultima
  const igual = !!u && u.pistas.length === mano.length && u.pistas.every(x => mano.includes(x))
  const res = igual ? (u.resultado === 'casi' ? 'casi' : 'no') : null
  const marcadas = (idea.pareja ?? []).filter(x => mano.includes(x))
  return { faltanIdeas, lleno, res, marcadas, puedeJugar: lleno && !faltanIdeas.length && idea.huecos > 0 }
}

/**
 * ¿Ya se puede armar? Abierta, con huecos y con todas sus ideas previas armadas
 * (sus pistas ya llegaron: por eso está abierta).
 * @param {IdeaHilo} idea
 * @param {Record<string, IdeaHilo>} ideas  todas, por id
 */
export const sePuedeArmar = (idea, ideas) => idea.estado === 'abierta' && idea.huecos > 0
  && idea.previas.every(p => ideas[p]?.estado === 'armada')

/**
 * La carpeta del centro de la Cartelera.
 * @param {EstadoHilo|null} estado
 */
export function resumenHilo(estado) {
  if (!estado) return null
  const total = estado.ideas.length
  const armadas = estado.ideas.filter(i => i.estado === 'armada').length
  const porId = Object.fromEntries(estado.ideas.map(i => [i.id, i]))
  const porArmar = estado.ideas.filter(i => sePuedeArmar(i, porId)).length
  const final = estado.ideas.find(i => i.final === 'principal')
  const sello = !estado.pistas.length ? { txt: 'Sin pistas aún', cls: 'is-empty' }
    : final?.estado === 'armada' ? { txt: 'Caso cerrado', cls: 'is-done' }
    : { txt: 'Caso abierto', cls: 'is-open' }
  return { armadas, total, porArmar, sello, hayPistas: estado.pistas.length > 0 }
}

/**
 * Lo que llegó con el último capítulo terminado, para el aviso del lector.
 * @param {EstadoHilo|null} estado
 * @returns {{ pistas: number, ideas: number }}
 */
export function novedadesHilo(estado) {
  if (!estado) return { pistas: 0, ideas: 0 }
  const cc = estado.capitulos_completados
  return {
    pistas: estado.pistas.filter(p => p.cap === cc).length,
    ideas: estado.ideas.filter(i => i.estado === 'abierta' && i.abre === cc).length,
  }
}

/**
 * Las pistas marcadas con 🔗 por idea sin armar: el número de la marca es el
 * orden de la idea entre las que tienen pareja (como en Anderson).
 * @param {IdeaHilo[]} ideas
 * @returns {Record<string, number>}  pista → número de pareja (0, 1, …)
 */
export function marcasPareja(ideas) {
  /** @type {Record<string, number>} */
  const out = {}
  ideas.filter(i => i.estado !== 'armada' && i.pareja?.length).forEach((i, k) => {
    for (const p of /** @type {string[]} */ (i.pareja)) if (out[p] == null) out[p] = k
  })
  return out
}

/**
 * Lo que ve el profe (hilo_aula): por alumno y por idea.
 * @param {{ ideas?: { id: string, titulo: string, final: string|null, huecos: number }[]|null,
 *   alumnos?: Record<string, { armadas: string[], fallos: Record<string, number>, ayudas: string[], senuelos: number }> }} aula
 * @param {{ user_id: string }[]} alumnos
 */
export function resumenHiloAula(aula, alumnos) {
  const ideas = aula.ideas ?? []
  const datos = aula.alumnos ?? {}
  const final = ideas.find(i => i.final === 'principal')?.id
  const filas = alumnos.map(a => {
    const d = datos[a.user_id]
    return {
      user_id: a.user_id,
      jugo: !!d,
      armadas: d?.armadas.length ?? 0,
      conclusion: !!d && !!final && d.armadas.includes(final),
      fallos: d ? Object.values(d.fallos).reduce((s, n) => s + n, 0) : 0,
      ayudas: d?.ayudas.length ?? 0,
      senuelos: d?.senuelos ?? 0,
    }
  })
  const jugaron = Object.values(datos)
  const porIdea = ideas.map(i => ({
    ...i,
    armaron: jugaron.filter(d => d.armadas.includes(i.id)).length,
    fallos: jugaron.reduce((s, d) => s + (d.fallos[i.id] ?? 0), 0),
  }))
  // Donde se atasca la clase: la idea con más intentos fallidos (solo las que se juegan).
  const atasco = porIdea.filter(i => i.huecos > 0 && i.fallos > 0).sort((a, b) => b.fallos - a.fallos)[0] ?? null
  return { filas, porIdea, atasco, total: ideas.length, jugaron: jugaron.length }
}
