// Plain JavaScript (.js)
// Paginación por altura en píxeles.
// Cuando se pasan measuredHeights (medidos desde el DOM), usa alturas reales.
// En caso contrario usa estimación por conteo de caracteres como fallback.

const FILL_FACTOR     = 0.88   // fracción de línea usada en prosa (fallback)
const MIN_SPLIT_LINES = 2      // mínimo de líneas en cada mitad al dividir un párrafo

// ── Altura de un párrafo ─────────────────────────────────────────────
// Usa altura medida si está disponible. Para fragmentos (texto más corto
// que el original) aplica proporción + margen de seguridad del 10%.
function parrafoH(p, charsPerLine, lineH, GAP, measuredHeights, originalLengths) {
  if (p.tipo === 'separador') return Math.round(lineH * 1.2) + 40

  const measured = measuredHeights?.[p.id]
  if (measured !== undefined) {
    const origLen = originalLengths?.[p.id]
    const curLen  = (p.contenido || '').length
    if (origLen && curLen < origLen) {
      // Es un fragmento de párrafo dividido: estimación proporcional + 10%
      return Math.ceil(measured * (curLen / origLen) * 1.1) + GAP
    }
    return measured + GAP
  }

  // Fallback: estimación por caracteres
  const eCpl  = Math.max(1, Math.floor(charsPerLine * FILL_FACTOR))
  const lines = Math.max(1, Math.ceil((p.contenido || '').length / eCpl))
  return lines * lineH + GAP
}

// ── Paginador principal ──────────────────────────────────────────────
export function paginarParrafos(parrafos, isDouble = true, opts = {}) {
  const charsPerLine   = opts.charsPerLine    ?? (isDouble ? 50 : 86)
  const lineH          = opts.lineHeight      ?? 33
  const GAP            = opts.paragraphGap    ?? 6
  const maxH           = opts.maxH            ?? Math.round(
    Math.min(700, Math.max(430, window.innerHeight - 222)) * 0.79
  )
  const firstPageMaxH  = opts.firstPageMaxH   ?? maxH
  const measured       = opts.measuredHeights ?? null
  const origLens       = opts.originalLengths ?? null

  const eCpl            = Math.max(1, Math.floor(charsPerLine * FILL_FACTOR))
  const minCharsPerSide = MIN_SPLIT_LINES * eCpl

  const pages  = []
  let cur      = []
  let curH     = 0
  let pageNum  = 0
  const queue  = [...parrafos]

  const mH = () => pageNum === 0 ? firstPageMaxH : maxH

  while (queue.length > 0) {
    const p  = queue.shift()
    const pH = parrafoH(p, charsPerLine, lineH, GAP, measured, origLens)

    // ── Entra en la página actual ──
    if (curH + pH <= mH()) {
      cur.push(p)
      curH += pH
      continue
    }

    // ── No entra: intentar dividir el párrafo ──
    // Nota: esto cubre también el caso cur.length === 0, donde un párrafo
    // más largo que la página completa debe dividirse en lugar de desbordarse.
    const free       = mH() - curH
    const linesAvail = Math.floor(free / lineH)
    const text       = p.contenido || ''

    // Calcular posición de corte usando altura medida cuando existe
    let charsForSplit
    if (measured?.[p.id] !== undefined) {
      const approxLines    = Math.max(1, Math.round(measured[p.id] / lineH))
      const charsPerRealLine = text.length / approxLines
      charsForSplit = Math.round(linesAvail * charsPerRealLine)
    } else {
      charsForSplit = linesAvail * eCpl
    }

    const canSplit =
      p.tipo !== 'separador'        &&
      linesAvail  >= MIN_SPLIT_LINES &&
      text.length >= minCharsPerSide * 2

    if (canSplit && charsForSplit > minCharsPerSide) {
      let splitAt = Math.min(charsForSplit, text.length - minCharsPerSide)
      while (splitAt > minCharsPerSide && text[splitAt] !== ' ') splitAt--

      const primera = splitAt > minCharsPerSide ? text.slice(0, splitAt).trim() : ''
      const segunda = splitAt > minCharsPerSide ? text.slice(splitAt).trim()    : ''

      if (primera && segunda) {
        cur.push({ ...p, contenido: primera })
        pages.push(cur)
        pageNum++
        cur  = []
        curH = 0
        queue.unshift({ ...p, contenido: segunda })
        continue
      }
    }

    // ── Sin split posible ──
    if (cur.length === 0) {
      // Párrafo mayor que la página completa y no divisible: agregar igualmente
      // para evitar loop infinito (caso extremadamente raro con párrafos muy cortos).
      cur.push(p)
      curH += pH
    } else {
      // Mover a la página siguiente
      pages.push(cur)
      pageNum++
      cur  = [p]
      curH = pH
    }
  }

  if (cur.length > 0) pages.push(cur)
  return pages.length > 0 ? pages : [[]]
}
