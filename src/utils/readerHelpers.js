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

// ── Marcas sobre el texto de un párrafo (SFX + subrayados del usuario) ──
// Un fragmento de párrafo puede llevar dos marcas distintas encima: los tramos
// con sonido anclado (texto_ref) y los subrayados guardados por el usuario, que
// pueden solaparse entre sí. Se resuelve por puntos de corte, no por rangos
// sueltos, para que un tramo que cae dentro de ambos lleve las dos marcas.

// Localiza `ref` dentro de `text` tolerando que la paginación lo haya partido:
// coincidencia entera, el arranque al final del fragmento, o la cola al inicio.
export function localizarRef(text, ref) {
  const pos = text.toLowerCase().indexOf(ref.toLowerCase())
  if (pos !== -1) return { start: pos, end: pos + ref.length }
  const inicio = findPrefixAtEnd(text, ref)
  if (inicio !== -1) return { start: inicio, end: text.length }
  const fin = findSuffixAtStart(text, ref)
  if (fin !== -1) return { start: 0, end: fin }
  return null
}

// Devuelve, para un fragmento de párrafo:
//   · segmentos: [{ text, start, sfx, subrayado }] o null si no hay ninguna
//     marca (el llamador pinta el texto plano, sin spans de más);
//   · sfxSinAnclar: sonidos del párrafo sin texto_ref, que iluminan el párrafo
//     entero cuando no hay ningún tramo anclado.
export function marcasDelParrafo(text, sfx = [], subrayados = []) {
  const rangos = []
  const sfxSinAnclar = []
  let anclados = 0
  for (const s of sfx) {
    const ref = s.metadata?.texto_ref
    if (!ref) { sfxSinAnclar.push(s); continue }
    const r = localizarRef(text, ref)
    if (r) { rangos.push({ ...r, sfx: s }); anclados++ }
  }
  for (const t of subrayados) {
    if (!t || !t.trim()) continue
    const r = localizarRef(text, t)
    if (r) rangos.push({ ...r, sfx: null })
  }
  if (rangos.length === 0) return { segmentos: null, sfxSinAnclar, anclados }

  const cortes = new Set([0, text.length])
  for (const r of rangos) { cortes.add(r.start); cortes.add(r.end) }
  const puntos = [...cortes].sort((a, b) => a - b)
  const segmentos = []
  for (let i = 0; i < puntos.length - 1; i++) {
    const start = puntos[i], end = puntos[i + 1]
    if (end <= start) continue
    const dentro = rangos.filter(r => r.start <= start && r.end >= end)
    segmentos.push({
      text: text.slice(start, end),
      start,
      sfx: dentro.find(r => r.sfx)?.sfx || null,
      subrayado: dentro.some(r => !r.sfx),
    })
  }
  return { segmentos, sfxSinAnclar, anclados }
}
