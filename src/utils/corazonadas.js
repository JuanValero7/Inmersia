// @ts-check
// Corazonadas en el lector: el chip va ENTRE párrafos, así que el paginador
// tiene que contarlo. Se mete en la lista de párrafos como un bloque más
// (tipo 'corazonada', de alto fijo y sin partir) justo después del párrafo del
// suspenso, y los dos paginadores lo miden como a un separador.
//
// El resto del lector (guardar la posición, retomarla, comunidad, % leído,
// ambiente) trabaja con párrafos de verdad: para eso está sinCorazonadas, que
// quita los chips sin cambiar el número de páginas.
//
// Reglas del juego: Documentation/colegios/corazonadas-prompt.md.

/** Alto del bloque del chip (px), margen incluido. Lo usan el paginador y el render. */
export const CHIP_ALTO = 46

/**
 * Mete el chip de cada corazonada después de su párrafo (`chip.parrafo` =
 * parrafos.numero dentro del capítulo).
 * @template {{ id: string, numero?: number, tipo?: string }} P
 * @param {P[]} parrafos
 * @param {{ id: string, chip: { cap: number, parrafo: number } }[]} chips  las del capítulo
 * @returns {(P | { id: string, tipo: 'corazonada', corazonadaId: string, contenido: string })[]}
 */
export function conCorazonadas(parrafos, chips) {
  if (!chips?.length || !parrafos?.length) return parrafos
  const porNumero = new Map(chips.map(c => [c.chip.parrafo, c]))
  const salida = []
  for (const p of parrafos) {
    salida.push(p)
    const c = p.numero != null ? porNumero.get(p.numero) : undefined
    if (c) salida.push({ id: `cz-${c.id}`, tipo: 'corazonada', corazonadaId: c.id, contenido: '' })
  }
  return salida
}

/**
 * Las mismas páginas sin los chips (mismo número de páginas).
 * @template {{ tipo?: string }} P
 * @param {P[][]} paginas
 */
export function sinCorazonadas(paginas) {
  return paginas.some(pg => pg.some(p => p.tipo === 'corazonada'))
    ? paginas.map(pg => pg.filter(p => p.tipo !== 'corazonada'))
    : paginas
}
