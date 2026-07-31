import React from 'react'
import terminosRaw from '../../../Documentation/terminos-y-condiciones.md?raw'
import privacidadRaw from '../../../Documentation/politica-de-privacidad.md?raw'

// =============================================================
// LegalModal — visor de Términos y Condiciones / Política de Privacidad.
// Lee el contenido tal cual de Documentation/*.md (única fuente) y lo
// interpreta con un parser mínimo (headers, hr, listas, tablas, negrita/
// itálica, links) — alcanza para estos dos documentos, sin sumar una
// dependencia de markdown completa.
// =============================================================

const INK = '#4a3622'
const ACCENT = '#F2792A'

const DOCS = {
  terminos:   { label: 'Términos y Condiciones', raw: terminosRaw },
  privacidad: { label: 'Política de Privacidad',  raw: privacidadRaw },
}

function parseMarkdown(md) {
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
    const para = []
    while (i < lines.length && lines[i].trim() && !/^-{3,}$/.test(lines[i].trim())
      && !/^#{1,4}\s/.test(lines[i]) && !/^-\s+/.test(lines[i]) && !/^\|.*\|\s*$/.test(lines[i])) {
      para.push(lines[i]); i++
    }
    blocks.push({ type: 'p', text: para.join(' ') })
  }
  return blocks
}

const INLINE_RE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g

function renderInline(text, onNavigate) {
  const out = []
  let last = 0, m, key = 0
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      const href = m[2]
      const internal = /\.md$/i.test(href) && href.includes('privacidad') ? 'privacidad'
        : /\.md$/i.test(href) && href.includes('terminos') ? 'terminos' : null
      out.push(internal
        ? <button key={key++} type="button" onClick={() => onNavigate(internal)} style={{
            background: 'none', border: 'none', padding: 0, margin: 0, color: ACCENT, fontWeight: 700,
            textDecoration: 'underline', cursor: 'pointer', font: 'inherit',
          }}>{m[1]}</button>
        : <a key={key++} href={href} target="_blank" rel="noreferrer" style={{ color: ACCENT, fontWeight: 700 }}>{m[1]}</a>)
    } else if (m[3] !== undefined) {
      out.push(<strong key={key++}>{m[3]}</strong>)
    } else if (m[4] !== undefined) {
      out.push(<em key={key++}>{m[4]}</em>)
    }
    last = INLINE_RE.lastIndex
  }
  out.push(text.slice(last))
  return out
}

function Doc({ raw, onNavigate }) {
  const blocks = React.useMemo(() => parseMarkdown(raw), [raw])
  return (
    <div style={{ color: INK, fontSize: 14.5, lineHeight: 1.65 }}>
      {blocks.map((b, idx) => {
        if (b.type === 'hr') return <hr key={idx} style={{ border: 'none', borderTop: `1.5px solid ${INK}22`, margin: '18px 0' }} />
        if (b.type === 'h1') return <h1 key={idx} style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>{renderInline(b.text, onNavigate)}</h1>
        if (b.type === 'h2') return <h2 key={idx} style={{ fontSize: 17.5, fontWeight: 800, margin: '22px 0 8px' }}>{renderInline(b.text, onNavigate)}</h2>
        if (b.type === 'h3') return <h3 key={idx} style={{ fontSize: 15, fontWeight: 800, margin: '16px 0 6px' }}>{renderInline(b.text, onNavigate)}</h3>
        if (b.type === 'ul') return (
          <ul key={idx} style={{ margin: '6px 0 12px', paddingLeft: 22 }}>
            {b.items.map((it, j) => <li key={j} style={{ marginBottom: 4 }}>{renderInline(it, onNavigate)}</li>)}
          </ul>
        )
        if (b.type === 'table') return (
          <div key={idx} style={{ overflowX: 'auto', margin: '10px 0 16px' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13.5 }}>
              <thead><tr>{b.header.map((c, j) => (
                <th key={j} style={{ textAlign: 'left', padding: '7px 10px', borderBottom: `2px solid ${INK}`, fontWeight: 800 }}>{renderInline(c, onNavigate)}</th>
              ))}</tr></thead>
              <tbody>{b.rows.map((r, j) => (
                <tr key={j}>{r.map((c, k) => (
                  <td key={k} style={{ padding: '7px 10px', borderBottom: `1px solid ${INK}18`, verticalAlign: 'top' }}>{renderInline(c, onNavigate)}</td>
                ))}</tr>
              ))}</tbody>
            </table>
          </div>
        )
        return <p key={idx} style={{ margin: '0 0 12px' }}>{renderInline(b.text, onNavigate)}</p>
      })}
    </div>
  )
}

export default function LegalModal({ initialDoc = 'terminos', onClose }) {
  const [doc, setDoc] = React.useState(initialDoc)

  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(50,34,18,0.45)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Baloo 2', cursive",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fffdf8', border: `2px solid ${INK}`, borderRadius: 20, width: '100%', maxWidth: 640,
        maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: `3px 6px 0 ${INK}33`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: `2px solid ${INK}22` }}>
          {Object.entries(DOCS).map(([key, { label }]) => (
            <button key={key} type="button" onClick={() => setDoc(key)} style={{
              flex: 1, background: doc === key ? ACCENT : '#f1e8d4', color: doc === key ? '#fff' : '#5a4632',
              border: `2px solid ${INK}`, borderRadius: 12, padding: '8px 10px', fontFamily: 'inherit',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{label}</button>
          ))}
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{
            background: '#fffdf8', border: `2px solid ${INK}`, borderRadius: 10, width: 34, height: 34,
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 15, color: INK, flexShrink: 0,
          }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px 24px', overflowY: 'auto' }}>
          <Doc raw={DOCS[doc].raw} onNavigate={setDoc} />
        </div>
      </div>
    </div>
  )
}
