// src/utils/estanteria.js
// ─────────────────────────────────────────────────────────────
// Reparte los libros de una sala en estanterías (escritorio y móvil).
// Función pura: el azar del lomo lo decide quien llama, para que se
// pueda fijar durante la visita y para poder probarlo.
//
// Reglas (plan de la tienda, 1.3):
//   · 2 baldas por estantería, 5 libros por balda.
//   · Con 3 o más libros en la balda, uno va de lomo: el de mayor
//     `orden` (el menos destacado de esa balda), en una posición
//     aleatoria. Con menos de 3, todos de frente.
// ─────────────────────────────────────────────────────────────

export const LIBROS_POR_BALDA = 5
export const BALDAS_POR_ESTANTERIA = 2
export const MIN_LIBROS_PARA_LOMO = 3
const POR_ESTANTERIA = LIBROS_POR_BALDA * BALDAS_POR_ESTANTERIA

/**
 * @template {{ orden?: number|null }} L
 * @param {L[]} libros  los de la sala, ya en su orden
 * @param {(clave: string, huecos: number) => number} posicionLomo
 *   índice (0..huecos-1) donde va el lomo en la balda `clave` («pagina-balda»)
 * @returns {Array<Array<Array<{ libro: L, lomo: boolean }>>>}
 *   estanterías → baldas → libros, en el orden en que se ven
 */
export function armarEstanterias(libros, posicionLomo) {
  const estanterias = []
  for (let p = 0; p * POR_ESTANTERIA < libros.length; p++) {
    const baldas = []
    for (let b = 0; b < BALDAS_POR_ESTANTERIA; b++) {
      const desde = p * POR_ESTANTERIA + b * LIBROS_POR_BALDA
      const tramo = libros.slice(desde, desde + LIBROS_POR_BALDA)
      if (!tramo.length) continue
      baldas.push(armarBalda(tramo, `${p}-${b}`, posicionLomo))
    }
    estanterias.push(baldas)
  }
  return estanterias
}

function armarBalda(tramo, clave, posicionLomo) {
  if (tramo.length < MIN_LIBROS_PARA_LOMO) return tramo.map(libro => ({ libro, lomo: false }))
  // El de mayor orden; si empatan, el último en aparecer.
  let iLomo = 0
  tramo.forEach((l, i) => { if ((l.orden ?? 0) >= (tramo[iLomo].orden ?? 0)) iLomo = i })
  const frente = tramo.filter((_, i) => i !== iLomo).map(libro => ({ libro, lomo: false }))
  const huecos = frente.length + 1
  const pos = Math.min(Math.max(0, Math.floor(posicionLomo(clave, huecos))), huecos - 1)
  frente.splice(pos, 0, { libro: tramo[iLomo], lomo: true })
  return frente
}

/** Los libros en el orden en que se ven (balda a balda): la secuencia de «Desliza». */
export function secuenciaVisual(estanterias) {
  return estanterias.flat(2).map(x => x.libro)
}

/** En qué estantería está la posición `indice` de la secuencia visual. */
export function estanteriaDe(indice) {
  return Math.floor(indice / POR_ESTANTERIA)
}
