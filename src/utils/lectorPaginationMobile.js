// src/utils/lectorPaginationMobile.js
// ─────────────────────────────────────────────────────────────────────
// Paginador EXCLUSIVO del lector mobile (una sola página visible a la vez).
//
// Por qué NO estimamos (ni por caracteres ni por alturas pre-sumadas):
//   Cualquier estimación se equivoca con párrafos largos y termina colocando
//   más texto del que cabe → el texto se desborda por abajo (queda tapado por
//   el gato / recortado). Pasaba de forma INCONSISTENTE: el párrafo que se
//   alcanzaba a "medir bien" se cortaba; el que caía en el camino de respaldo
//   se colocaba entero y desbordaba.
//
// Enfoque a prueba de fallos: dejamos que EL NAVEGADOR maquete el texto real
// en un contenedor oculto con el ancho/tipografía EXACTOS de la hoja, y
// cortamos la página justo donde el `offsetHeight` real supera el alto
// disponible. Los párrafos más altos que una página se parten por palabra
// mediante BÚSQUEDA BINARIA sobre el layout real. Resultado: una página NUNCA
// puede contener más alto del que cabe, sin importar la fuente o su carga.
//
// Requiere `document` (corre en cliente). El componente lo invoca tras montar
// la hoja y lo re-ejecuta en `document.fonts.ready`.
// ─────────────────────────────────────────────────────────────────────

const SAFETY_PX = 2        // colchón mínimo anti-redondeo sub-pixel
const MIN_SPLIT_LINES = 2  // hueco mínimo (en líneas) para que valga la pena partir
                           // un párrafo y rellenar la página en curso

// Construye el <p> espejo de .lm-para para medir con el MISMO layout que se
// renderiza (justificado, sangría, itálica de diálogo, pre-line, guiones).
function crearParrafoEl(p) {
  const el = document.createElement('p')
  if (p.tipo === 'separador') {
    el.style.cssText = `margin:0 0 0.85em;text-align:center;letter-spacing:0.4em;line-height:1.4`
  } else {
    el.style.cssText =
      `margin:0 0 0.85em;white-space:pre-line;text-align:justify;hyphens:auto;` +
      `text-indent:${p.tipo === 'dialogo' ? '0' : '1.2em'};` +
      `font-style:${p.tipo === 'dialogo' ? 'italic' : 'normal'};`
  }
  return el
}

function crearHeadEl(chapterHead, fontSize) {
  const head = document.createElement('div')
  head.style.cssText = 'margin:0 0 18px'
  const k = document.createElement('div')
  k.style.cssText = `font-family:'Special Elite',monospace;font-size:${fontSize * 0.6}px;letter-spacing:0.18em;text-transform:uppercase`
  k.textContent = chapterHead.kicker || ''
  const t = document.createElement('div')
  t.style.cssText = `font-family:'Playfair Display',serif;font-size:${fontSize * 1.55}px;font-weight:700;line-height:1.08;margin-top:5px`
  t.textContent = chapterHead.titulo || ''
  const r = document.createElement('div')
  r.style.cssText = 'width:56px;height:3px;margin-top:12px'
  head.append(k, t, r)
  return head
}

// ── Paginador mobile a prueba de fallos (mide el DOM real) ────────────
// opts: { contentW, maxH, fontSize, readingFont, lineHeightRatio, chapterHead }
//   contentW       ancho de texto real (px) = ancho de la hoja menos padding
//   maxH           alto de contenido disponible (px) por página
//   chapterHead    { kicker, titulo } para reservar el encabezado en la pág. 0
// Devuelve Array<Array<parrafo>> (los párrafos partidos conservan su .id).
export function paginarParrafosMobileDOM(parrafos, opts = {}) {
  const {
    contentW, maxH,
    fontSize = 19, readingFont = 'serif',
    lineHeightRatio = 1.72, chapterHead = null,
  } = opts
  const lineH = opts.lineHeight ?? Math.round(fontSize * lineHeightRatio)

  if (typeof document === 'undefined' || !parrafos?.length || !contentW || !maxH) {
    return [parrafos?.length ? [...parrafos] : []]
  }

  const budget = Math.max(60, maxH - SAFETY_PX)

  const container = document.createElement('div')
  container.style.cssText =
    `position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none;` +
    `width:${contentW}px;font-family:${readingFont};font-size:${fontSize}px;line-height:${lineHeightRatio};`
  document.body.appendChild(container)

  const pages = []
  // Cola mutable: al partir un párrafo, el resto se reinserta como continuación.
  const queue = parrafos.map(p => ({ ...p }))
  let qi = 0
  let pageNum = 0

  try {
    while (qi < queue.length) {
      const pageEl = document.createElement('div')
      pageEl.style.cssText = 'display:flow-root'   // contiene los márgenes de los hijos
      container.appendChild(pageEl)
      if (pageNum === 0 && chapterHead) pageEl.appendChild(crearHeadEl(chapterHead, fontSize))

      const pageItems = []

      while (qi < queue.length) {
        const p     = queue[qi]
        const baseH = pageEl.offsetHeight   // alto de la página SIN este párrafo
        const pEl   = crearParrafoEl(p)
        pEl.textContent = p.tipo === 'separador' ? '❧' : (p.contenido || '')
        pageEl.appendChild(pEl)

        if (pageEl.offsetHeight <= budget) {
          pageItems.push(p); qi++
          continue
        }

        // No cabe entero ──────────────────────────────────────────
        // Los separadores no se parten.
        // Si la página ya tiene contenido Y el hueco restante es menor a
        // MIN_SPLIT_LINES, no vale la pena partir: el párrafo entero pasa a la
        // página siguiente. En cualquier otro caso lo PARTIMOS para aprovechar
        // el espacio (incl. una página corta seguida de un párrafo largo).
        const huecoUtil = (budget - baseH) >= MIN_SPLIT_LINES * lineH
        if (p.tipo === 'separador' || (pageItems.length > 0 && !huecoUtil)) {
          pageEl.removeChild(pEl)
          break
        }

        const words = (p.contenido || '').split(' ')
        let lo = 1, hi = words.length, best = 0
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          pEl.textContent = words.slice(0, mid).join(' ')
          if (pageEl.offsetHeight <= budget) { best = mid; lo = mid + 1 }
          else hi = mid - 1
        }
        if (best <= 0) {
          // Ni una palabra entra en el hueco. Con contenido previo, el párrafo
          // entero va a la siguiente página; con la página vacía, forzar 1
          // palabra para no colgar (caso degenerado).
          if (pageItems.length > 0) { pageEl.removeChild(pEl); break }
          best = 1
        }

        const primera = words.slice(0, best).join(' ')
        const segunda = words.slice(best).join(' ').trim()
        pEl.textContent = primera
        pageItems.push({ ...p, contenido: primera })
        qi++
        if (segunda) queue.splice(qi, 0, { ...p, contenido: segunda })
        break   // cerrar página
      }

      pages.push(pageItems)
      pageNum++
      if (pageNum > 10000) break   // guardia anti-runaway
    }
  } finally {
    document.body.removeChild(container)
  }

  return pages.length ? pages : [[]]
}
