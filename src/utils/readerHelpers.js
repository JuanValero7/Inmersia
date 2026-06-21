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
