// src/components/mobile/CarteleraMobileFicha.jsx
// ─────────────────────────────────────────────────────────────
// LISTA + FICHA de una sección, versión mobile.
// Misma fuente de datos que el Ficha.jsx de escritorio (items ya
// filtrados por capítulo desde Supabase): nombre, descripcion,
// metadata.tags, capitulo_numero, imagen.url. No duplica lógica de
// spoilers — eso lo resuelve useCartelera.
//
//   <CarteleraMobileLista section items onPick />
//   <CarteleraMobileFicha section item onBack />
// ─────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { getTags, getCap, shade, DOT_AMT } from '../cartelera/carteleraHelpers.js'

const initial = (s) => (s || '').replace(/^(El|La|Los|Las)\s+/i, '').charAt(0).toUpperCase()

function deltaDesc(prev, curr) {
  if (!prev) return curr
  const p = prev.trim()
  const c = curr.trim()
  if (c.startsWith(p)) {
    const rest = c.slice(p.length).replace(/^[\s.,;:\-–—]+/, '').trim()
    return rest || c
  }
  return c
}

function SearchIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>)
}
function BackIcon({ s = 14 }) {
  return (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>)
}
function Wave({ color }) {
  return (<svg className="cm-fic-rule" viewBox="0 0 320 14" preserveAspectRatio="none" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
    <path d="M2 7 Q22 1 42 7 T82 7 T122 7 T162 7 T202 7 T242 7 T282 7 T318 7" /></svg>)
}

export function CarteleraMobileLista({ section, items = [], onPick }) {
  const [query, setQuery] = useState('')
  const sec = section.color

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(it =>
      (it.nombre || '').toLowerCase().includes(q) ||
      getTags(it).join(' ').toLowerCase().includes(q))
  }, [query, items])

  return (
    <div className="cm-list-wrap">
      <div className="cm-search">
        <SearchIcon />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder={`Buscar ${section.label.toLowerCase()}…`} />
      </div>

      {items.length === 0 ? (
        <div className="cm-list-empty">Sin datos disponibles todavía. Avanzá en la lectura para revelar nuevas pistas.</div>
      ) : filtered.length === 0 ? (
        <div className="cm-list-empty">Sin resultados para “{query}”.</div>
      ) : (
        <div className="cm-rows">
          {filtered.map(it => {
            const di = items.indexOf(it)
            return (
              <button key={it.id} type="button" className="cm-row" onClick={() => onPick(it.id)}>
                <span className="cm-dot" style={{ background: shade(sec, DOT_AMT[di % DOT_AMT.length]) }}>{initial(it.nombre)}</span>
                <span className="cm-row-meta">
                  <span className="cm-row-nm">{it.nombre}</span>
                  <span className="cm-row-cap">{getCap(it)}</span>
                </span>
                <svg className="cm-row-chev" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l6 6-6 6" /></svg>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CarteleraMobileFicha({ section, item, onBack }) {
  const sec = section.color
  if (!item) return null
  return (
    <div className="cm-ficha-wrap">
      <button type="button" className="cm-fic-back" onClick={onBack}><BackIcon s={14} /> Lista</button>

      <div className="cm-ficha" key={item.id}>
        <div className="cm-polaroid">
          <span className="tape" />
          {item.imagen?.url
            ? <img className="cm-pol-pic" src={item.imagen.url} alt={item.nombre} />
            : <div className="cm-pol-empty">{initial(item.nombre)}</div>}
          <div className="cm-pol-cap">{item.nombre}</div>
        </div>

        <div className="cm-fic-kicker">{section.singular}</div>
        <h2 className="cm-fic-name">{item.nombre}</h2>

        <div className="cm-chips">
          {getTags(item).map(tg => <span key={tg} className="cm-chip">{tg}</span>)}
        </div>
        <div className="cm-cap-pill">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Primera aparición · {getCap(item)}
        </div>

        <Wave color={sec} />
        {item.entradas?.length > 1 ? (
          <div className="cm-fic-timeline">
            {item.entradas.map((e, i) => (
              <div key={e.capitulo_numero} className="cm-fic-entrada">
                <span className="cm-fic-cap-lbl">Cap. {e.capitulo_numero}</span>
                <p className="cm-fic-desc">{deltaDesc(item.entradas[i - 1]?.descripcion, e.descripcion)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="cm-fic-desc">{item.entradas?.[0]?.descripcion ?? item.descripcion}</p>
        )}
      </div>
    </div>
  )
}
