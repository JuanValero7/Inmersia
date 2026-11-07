// @ts-check
// El concurso en el lector: localizar la frase dentro de los párrafos que se
// ven en pantalla, para encender el foco encima sin tocar cómo se pintan.
//
// La cita del concurso se comprobó contra el párrafo con las mismas reglas que
// `norm` de cargar_anderson.py (guiones, comillas y espacios iguales), así que
// aquí se compara con esas mismas reglas.

/** Letras que cuentan iguales al comparar. */
function claseDe(c) {
  if (/\s/.test(c)) return ' '
  if (/[–—-]/.test(c)) return '-'
  if (/[«»“”"]/.test(c)) return '"'
  return c
}

/**
 * Texto normalizado y, para cada letra suya, dónde estaba en el original.
 * Las tiradas de espacios o de guiones cuentan como uno solo.
 * @param {string} texto
 * @returns {{ s: string, mapa: number[] }}
 */
export function normalizar(texto) {
  let s = ''
  const mapa = []
  for (let i = 0; i < texto.length; i++) {
    const c = claseDe(texto[i])
    if ((c === ' ' || c === '-') && s[s.length - 1] === c) continue
    s += c
    mapa.push(i)
  }
  return { s, mapa }
}

const MIN_TROZO = 12   // letras: menos que esto, un trozo puede coincidir por casualidad

/**
 * Dónde está la cita dentro de un texto (un párrafo o un trozo de párrafo
 * partido entre dos páginas).
 *  · 'entera': la cita completa está aquí.
 *  · 'cabeza': el texto termina con el principio de la cita (sigue en la página siguiente).
 *  · 'cola':   el texto empieza con el final de la cita (empezó en la página anterior).
 * @param {string} texto
 * @param {string} cita
 * @returns {{ tipo: 'entera'|'cabeza'|'cola', start: number, end: number } | null}
 *   start/end en letras del texto original.
 */
export function ubicarCita(texto, cita) {
  const t = normalizar(texto)
  const c = normalizar(cita).s.trim()
  if (!c) return null
  const fin = (k) => t.mapa[k - 1] + 1   // índice original justo después de la letra k-1

  const i = t.s.indexOf(c)
  if (i >= 0) return { tipo: 'entera', start: t.mapa[i], end: fin(i + c.length) }

  const ts = t.s.trimEnd()
  for (let n = c.length - 1; n >= MIN_TROZO; n--) {
    if (ts.endsWith(c.slice(0, n).trimEnd())) {
      const desde = ts.length - c.slice(0, n).trimEnd().length
      return { tipo: 'cabeza', start: t.mapa[desde], end: fin(ts.length) }
    }
  }
  const inicio = t.s.length - t.s.trimStart().length
  const tl = t.s.trimStart()
  for (let n = c.length - 1; n >= MIN_TROZO; n--) {
    const cola = c.slice(c.length - n).trimStart()
    if (tl.startsWith(cola)) return { tipo: 'cola', start: t.mapa[inicio], end: fin(inicio + cola.length) }
  }
  return null
}

/**
 * Palabras de una respuesta (lo mismo que cuenta la función del servidor).
 * @param {string} texto
 */
export function contarPalabras(texto) {
  return texto.trim().split(/\s+/).filter(Boolean).length
}
