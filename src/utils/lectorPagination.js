// Plain JavaScript (.js)
// Paginación por altura en píxeles, medida directamente desde el DOM real
// (offsetHeight) — ver paginarParrafosDesktopDOM más abajo.

const MIN_SPLIT_LINES = 2      // mínimo de líneas en cada mitad al dividir un párrafo

// ── Paginador desktop con medición DOM real ──────────────────────────────────
// Mismo enfoque que el mobile: el browser decide dónde corta el texto mediante
// offsetHeight real, sin estimaciones. Elimina los espacios en blanco causados
// por errores de estimación de altura y por el margen +10% en fragmentos.
// Requiere `document` — se invoca desde un useEffect, tras document.fonts.ready.
// opts: { pageW, pageH, fontSize, readingFont, chapterHead }
//   chapterHead: { numero, titulo }
export function paginarParrafosDesktopDOM(parrafos, opts = {}) {
  const {
    pageW, pageH,
    fontSize = 18, readingFont = "'Crimson Text', Georgia, serif",
    chapterHead = null,
  } = opts

  if (typeof document === 'undefined' || !parrafos?.length || !pageW || !pageH) {
    return parrafos?.length ? [[...parrafos]] : [[]]
  }

  const pad      = Math.round(pageW * 0.11)
  const contentW = pageW - 2 * pad
  const maxH     = Math.round(pageH * 0.79)
  const lineH    = Math.round(fontSize * 1.85)

  const container = document.createElement('div')
  container.style.cssText =
    `position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none;` +
    `width:${contentW}px;font-family:${readingFont};font-size:${fontSize}px;line-height:1.85;`
  document.body.appendChild(container)

  const pages  = []
  const queue  = parrafos.map(p => ({ ...p }))
  let   qi     = 0
  let   pageNum = 0

  try {
    while (qi < queue.length) {
      const pageEl = document.createElement('div')
      pageEl.style.cssText = 'display:flow-root'
      container.appendChild(pageEl)

      if (pageNum === 0 && chapterHead) {
        const headEl   = document.createElement('div')
        headEl.style.marginBottom = '22px'
        const capLabel = document.createElement('div')
        capLabel.style.cssText = `font-family:'Special Elite',monospace;font-size:${fontSize*0.6}px;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px`
        capLabel.textContent   = `Capítulo ${chapterHead.numero ?? ''}`
        const capTitle = document.createElement('div')
        capTitle.style.cssText = `font-family:'Playfair Display',serif;font-size:${fontSize*1.7}px;font-weight:700;line-height:1.1`
        capTitle.textContent   = chapterHead.titulo || ''
        const capLine  = document.createElement('div')
        capLine.style.cssText  = 'width:60px;height:3px;margin-top:14px'
        headEl.append(capLabel, capTitle, capLine)
        pageEl.appendChild(headEl)
      }

      const pageItems = []

      while (qi < queue.length) {
        const p     = queue[qi]
        const baseH = pageEl.offsetHeight
        const pEl   = document.createElement('p')

        if (p.tipo === 'separador') {
          pEl.style.cssText = `margin:0 0 0.7em;text-align:center;letter-spacing:0.4em;`
          pEl.textContent   = '❧'
        } else {
          pEl.style.cssText =
            `margin:0 0 0.7em;white-space:pre-line;text-align:justify;hyphens:auto;` +
            `text-indent:${p.tipo === 'dialogo' ? '0' : '1.2em'};` +
            `font-style:${p.tipo === 'dialogo' ? 'italic' : 'normal'};`
          pEl.textContent = p.contenido || ''
        }
        pageEl.appendChild(pEl)

        if (pageEl.offsetHeight <= maxH) {
          pageItems.push(p); qi++
          continue
        }

        // No cabe entero — intentar dividir por palabra
        const huecoUtil = (maxH - baseH) >= MIN_SPLIT_LINES * lineH
        if (p.tipo === 'separador' || (pageItems.length > 0 && !huecoUtil)) {
          pageEl.removeChild(pEl)
          break
        }

        // Búsqueda binaria: máximas palabras que caben en el espacio restante
        const words = (p.contenido || '').split(' ')
        let lo = 1, hi = words.length, best = 0
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          pEl.textContent = words.slice(0, mid).join(' ')
          if (pageEl.offsetHeight <= maxH) { best = mid; lo = mid + 1 }
          else hi = mid - 1
        }

        if (best <= 0) {
          // Ninguna palabra entra: si hay contenido previo, el párrafo pasa
          // completo a la siguiente página; si la página está vacía, forzar 1
          // palabra para evitar un loop infinito (párrafo más alto que maxH).
          if (pageItems.length > 0) { pageEl.removeChild(pEl); break }
          best = 1
        }

        const primera = words.slice(0, best).join(' ')
        const segunda = words.slice(best).join(' ').trim()
        pEl.textContent = primera
        pageItems.push({ ...p, contenido: primera })
        qi++
        if (segunda) queue.splice(qi, 0, { ...p, contenido: segunda })
        break
      }

      pages.push(pageItems)
      pageNum++
      if (pageNum > 10000) break  // guardia anti-runaway
    }
  } finally {
    document.body.removeChild(container)
  }

  return pages.length ? pages : [[]]
}
