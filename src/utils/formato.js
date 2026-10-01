// src/utils/formato.js
// ─────────────────────────────────────────────────────────────
// Cómo se muestran los datos de un libro en la Tienda (ficha,
// carriles, salas). Funciones puras: sin React ni Supabase.
// ─────────────────────────────────────────────────────────────

// Velocidad de lectura acordada para el tiempo de la ficha y el carril
// «Se leen en una tarde» (plan de la tienda, decisión 2).
export const PALABRAS_POR_MINUTO = 230
export const MINUTOS_UNA_TARDE = 120

/**
 * Año que se enseña. `anio_texto` (migración 068) manda para los casos que un
 * entero no puede decir: «s. V a. C.», «s. II».
 * @param {{ anio?: number|null, anio_texto?: string|null }|null} libro
 */
export function anioMostrar(libro) {
  if (!libro) return ''
  if (libro.anio_texto) return libro.anio_texto
  return libro.anio != null ? String(libro.anio) : ''
}

/** Minutos de lectura a partir de las palabras del libro (0 si no hay dato). */
export function minutosLectura(palabras) {
  if (!palabras || palabras <= 0) return 0
  return Math.max(1, Math.round(palabras / PALABRAS_POR_MINUTO))
}

/**
 * Tiempo legible y redondeado, porque es una estimación: no tiene sentido
 * prometer «1 h 23 min». Menos de una hora va de 5 en 5 minutos; desde una
 * hora, de 10 en 10.
 *   45 → «≈ 45 min» · 80 → «≈ 1 h 20 min» · 120 → «≈ 2 h»
 */
export function tiempoLectura(palabras) {
  const min = minutosLectura(palabras)
  if (!min) return ''
  if (min < 60) return `≈ ${Math.max(5, Math.round(min / 5) * 5)} min`
  const total = Math.round(min / 10) * 10
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `≈ ${h} h ${m} min` : `≈ ${h} h`
}

/** ¿Cabe en una tarde? (2 h o menos). */
export function seLeeEnUnaTarde(palabras) {
  const min = minutosLectura(palabras)
  return min > 0 && min <= MINUTOS_UNA_TARDE
}

/**
 * La sinopsis llega como párrafos separados por una línea en blanco. El
 * primero es el gancho (va en negrita en la ficha); el resto, el cuerpo.
 */
export function partirSinopsis(texto) {
  const parrafos = (texto || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
  return { entrada: parrafos[0] || '', resto: parrafos.slice(1).join('\n\n') }
}

/** Corta en el último espacio antes de `max` y añade «…». */
export function recortar(texto, max) {
  if (!texto || texto.length <= max) return texto || ''
  return texto.slice(0, max).replace(/\s+\S*$/, '') + '…'
}
