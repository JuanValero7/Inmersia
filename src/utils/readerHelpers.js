// Cuando la paginación corta un párrafo en medio de un texto_ref:
// Busca el inicio del ref al final del fragmento (el texto empieza aquí, continúa en la próxima página).
export function findPrefixAtEnd(text, ref, minLen = 5) {
  const tl = text.toLowerCase(), rl = ref.toLowerCase()
  for (let len = rl.length - 1; len >= minLen; len--)
    if (tl.endsWith(rl.slice(0, len))) return text.length - len
  return -1
}

// Busca el final del ref al inicio del fragmento (el texto empezó en la página anterior, termina aquí).
export function findSuffixAtStart(text, ref, minLen = 5) {
  const tl = text.toLowerCase(), rl = ref.toLowerCase()
  for (let offset = 1; offset <= rl.length - minLen; offset++)
    if (tl.startsWith(rl.slice(offset))) return rl.length - offset
  return -1
}

// ── Anclaje fino de progreso (párrafos largos divididos en varias páginas) ──
// Los fragmentos de un párrafo dividido conservan su .id, así que el id solo
// localiza el párrafo, no el fragmento. El offset en caracteres dentro del
// párrafo sí lo localiza, con independencia del maquetado (dispositivo,
// fuente, tamaño). El +1 por fragmento repone el espacio que el corte por
// palabras consume entre fragmento y fragmento; la precisión de ±unos
// caracteres es irrelevante porque el destino es una página, no un carácter.

// Offset con el que la página `pageIndex` abre el párrafo `parrafoId`:
// suma de los fragmentos del mismo párrafo en páginas anteriores.
export function offsetDeAnclaje(paginas, pageIndex, parrafoId) {
  let cum = 0
  for (let i = 0; i < pageIndex; i++)
    for (const f of paginas[i])
      if (f.id === parrafoId) cum += (f.contenido || '').length + 1
  return cum
}

// Índice de la página cuyo fragmento del párrafo `parrafoId` cubre `offset`.
// Si el offset queda más allá del final (la paginación cambió), la última
// página que contiene el párrafo; -1 si el párrafo no aparece en ninguna.
export function paginaDeAnclaje(paginas, parrafoId, offset = 0) {
  let cum = 0, last = -1
  for (let i = 0; i < paginas.length; i++) {
    for (const f of paginas[i]) {
      if (f.id !== parrafoId) continue
      last = i
      cum += (f.contenido || '').length + 1
      if (offset < cum) return i
    }
  }
  return last
}
