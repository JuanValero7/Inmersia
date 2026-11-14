// src/lib/docxCapitulos.js
// ─────────────────────────────────────────────────────────────
// Lee el .docx del escritor en el navegador y lo parte en capítulos
// (Rincón del escritor, migración 103). Nada sale del navegador hasta que
// el escritor confirma la vista previa; entonces se manda a
// crear_libro_escritor() como [["párrafo", …], …].
//
// Las reglas de detección son las de Documents/procesar_libro_solo.py
// (extraer_capitulos). Si cambias una, cambia la otra.
//   · Estilo de Word «Heading …» (Título 1, 2… en Word en español: el
//     nombre interno sigue siendo «heading N»).
//   · «Capítulo N», «Cap. N», «Chapter N», «Parte N» (N arábigo o romano).
//   · Romano solo (I, II, XIV, IV.).
//   · Número solo (1–999) seguido de una línea corta en MAYÚSCULAS: se
//     descartan las dos líneas.
// La línea del encabezado no se guarda (el capítulo se llama «Capítulo N»)
// y lo que hay antes del primer encabezado tampoco: se avisa al escritor.
// ─────────────────────────────────────────────────────────────

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

const PATRONES_CAPITULO = [
  /^capitulo\s+[ivxlcdm\d]+/,
  /^cap\.?\s+[ivxlcdm\d]+/,
  /^chapter\s+[ivxlcdm\d]+/,
  /^parte\s+[ivxlcdm\d]+/,
  /^[ivxlcdm]+\.?$/,
]

/** Quita acentos y pasa a minúsculas. */
export function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Línea corta completamente en mayúsculas (caso «5» + «UN DECRETO…»). */
function esTituloCaps(texto) {
  if (texto.length > 80) return false
  const letras = texto.match(/[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]/g) || []
  return letras.length >= 3 && letras.every(c => c === c.toUpperCase())
}

function esEncabezado(texto, estilo) {
  if (estilo.toLowerCase().includes('heading')) return true
  const norm = normalizar(texto)
  return PATRONES_CAPITULO.some(p => p.test(norm))
}

/**
 * Parte la lista de líneas del Word en capítulos.
 * @param {{ texto: string, estilo: string }[]} lineas
 * @returns {{ capitulos: string[][], descartadasAlInicio: string[] }}
 */
export function detectarCapitulos(lineas) {
  const capitulos = []
  const descartadasAlInicio = []
  let actual = null
  let i = 0
  const cerrar = () => { if (actual && actual.length) capitulos.push(actual) }

  while (i < lineas.length) {
    const { texto, estilo } = lineas[i]

    if (/^\d{1,3}$/.test(texto) && i + 1 < lineas.length && esTituloCaps(lineas[i + 1].texto)) {
      cerrar(); actual = []; i += 2; continue
    }
    if (esEncabezado(texto, estilo)) {
      cerrar(); actual = []; i += 1; continue
    }
    if (actual) actual.push(texto)
    else descartadasAlInicio.push(texto)
    i += 1
  }
  cerrar()
  return { capitulos, descartadasAlInicio }
}

/** Palabras de un párrafo, como las cuenta la base (por espacios). */
export function contarPalabras(texto) {
  const t = texto.trim()
  return t ? t.split(/\s+/).length : 0
}

/**
 * Capítulos sospechosamente largos: más del doble de la mediana y de
 * 2.500 palabras (al menos 3 capítulos para comparar). Suele ser un
 * «Capítulo N» que falta. El mínimo de palabras evita falsas alarmas en
 * libros de capítulos cortos y desiguales (El Principito).
 * @param {number[]} palabrasPorCapitulo
 * @returns {number[]} índices (desde 0)
 */
export function capitulosRaros(palabrasPorCapitulo) {
  if (palabrasPorCapitulo.length < 3) return []
  const orden = [...palabrasPorCapitulo].sort((a, b) => a - b)
  const mediana = orden[Math.floor(orden.length / 2)]
  return palabrasPorCapitulo.flatMap((n, i) => (n > mediana * 2 && n > 2500 ? [i] : []))
}

// ── Lectura del .docx (solo navegador: usa DOMParser) ─────────

/** Texto de un <w:p>, como python-docx: w:t, tabulaciones y saltos. */
function textoParrafo(p) {
  let out = ''
  const recorrer = (nodo) => {
    for (const hijo of nodo.childNodes) {
      if (hijo.nodeType !== 1) continue
      const nombre = hijo.localName
      // Cuadros de texto y la versión «Fallback» de los dibujos: no son el texto del libro.
      if (nombre === 'txbxContent' || nombre === 'Fallback' || nombre === 'del') continue
      if (nombre === 't' && hijo.namespaceURI === W) out += hijo.textContent
      else if (nombre === 'tab' && hijo.namespaceURI === W) out += '\t'
      else if ((nombre === 'br' || nombre === 'cr') && hijo.namespaceURI === W) out += '\n'
      else recorrer(hijo)
    }
  }
  recorrer(p)
  return out
}

/**
 * Abre el .docx y devuelve sus líneas (párrafos del cuerpo, sin vacíos;
 * los saltos de línea manuales parten el párrafo, como en el Python).
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{ texto: string, estilo: string }[]>}
 */
export async function leerDocx(buffer) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)
  const docXml = await zip.file('word/document.xml')?.async('string')
  if (!docXml) throw new Error('no_es_docx')
  const stylesXml = await zip.file('word/styles.xml')?.async('string')

  const parser = new globalThis.DOMParser()
  const nombresEstilo = new Map()
  if (stylesXml) {
    const st = parser.parseFromString(stylesXml, 'application/xml')
    for (const s of st.getElementsByTagNameNS(W, 'style')) {
      const id = s.getAttributeNS(W, 'styleId') || s.getAttribute('w:styleId')
      const nombre = s.getElementsByTagNameNS(W, 'name')[0]
      if (id && nombre) nombresEstilo.set(id, nombre.getAttributeNS(W, 'val') || nombre.getAttribute('w:val') || '')
    }
  }

  const doc = parser.parseFromString(docXml, 'application/xml')
  const body = doc.getElementsByTagNameNS(W, 'body')[0]
  if (!body) throw new Error('no_es_docx')

  const lineas = []
  for (const p of body.children) {
    if (p.localName !== 'p') continue
    const pStyle = p.getElementsByTagNameNS(W, 'pStyle')[0]
    const id = pStyle ? (pStyle.getAttributeNS(W, 'val') || pStyle.getAttribute('w:val')) : ''
    const estilo = (id && nombresEstilo.get(id)) || id || ''
    for (const linea of textoParrafo(p).split('\n')) {
      const texto = linea.trim()
      if (texto) lineas.push({ texto, estilo })
    }
  }
  return lineas
}
