// src/components/legal/parseMarkdown.js
// ─────────────────────────────────────────────────────────────
// Parser mínimo de los documentos de Documentation/*.md (headers, hr, listas,
// tablas y párrafos). Vive aparte, sin JSX, porque lo usan dos sitios:
//   - LegalModal.jsx / PaginaLegal.jsx, que pintan los bloques en React.
//   - scripts/generar-seo.mjs, que los convierte a HTML estático para que
//     /impressum, /privacidad y /terminos no lleguen vacíos a los rastreadores.
// Lo inline (links, negrita, itálica) lo resuelve cada uno con INLINE_RE.
// ─────────────────────────────────────────────────────────────

export const INLINE_RE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g

export function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    if (/^-{3,}$/.test(line.trim())) { blocks.push({ type: 'hr' }); i++; continue }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) { blocks.push({ type: `h${h[1].length}`, text: h[2] }); i++; continue }
    if (/^\|.*\|\s*$/.test(line) && lines[i + 1] && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = line.split('|').slice(1, -1).map(c => c.trim())
      i += 2
      const rows = []
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()))
        i++
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }
    if (/^-\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^-\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }
    const para = []
    while (i < lines.length && lines[i].trim() && !/^-{3,}$/.test(lines[i].trim())
      && !/^#{1,4}\s/.test(lines[i]) && !/^-\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])
      && !/^\|.*\|\s*$/.test(lines[i])) {
      para.push(lines[i]); i++
    }
    // Uniendo con salto de línea (y whiteSpace:'pre-line' al pintar), la
    // dirección postal del responsable se lee como una dirección y no
    // como una frase corrida.
    blocks.push({ type: 'p', text: para.join('\n') })
  }
  return blocks
}
