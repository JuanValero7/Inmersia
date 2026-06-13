// Formato: Plain JavaScript (.jsx)
// Ficha de una sección (cuaderno a dos páginas): índice a la izquierda, detalle
// a la derecha. Los items vienen ya filtrados por capítulo desde Supabase, así
// que acá no hay lógica de spoilers. Sin relaciones (fuera del MVP).
import { useState, useMemo, useEffect } from 'react'
import clsx from 'clsx'
import { getTags, getCap, shade, DOT_AMT } from './carteleraHelpers.js'

function Magnifier() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <circle cx="11" cy="11" r="7" strokeLinecap="round" /><path d="m21 21-4.3-4.3" strokeLinecap="round" /></svg>)
}
function Wave({ color }) {
  return (<svg className="fic-rule" viewBox="0 0 320 16" preserveAspectRatio="none" fill="none"
    stroke={color} strokeWidth="3" strokeLinecap="round">
    <path d="M2 8 Q22 1 42 8 T82 8 T122 8 T162 8 T202 8 T242 8 T282 8 T318 8" /></svg>)
}
const initial = (s) => (s || '').replace(/^(El|La|Los|Las)\s+/i, '').charAt(0).toUpperCase()

// Devuelve solo el texto nuevo de curr que no estaba en prev (descripción acumulada → delta)
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

export default function Ficha({ section, items = [], onBackTablero, onBackPortada, initialItemId }) {
  const total = items.length
  const [sel, setSel] = useState(initialItemId || items[0]?.id || null)
  const [query, setQuery] = useState('')
  const [scale, setScale] = useState(1)

  const sec = section.color

  useEffect(() => {
    const fit = () => {
      const sw = (window.innerWidth - 64) / 1180
      const sh = (window.innerHeight - 188) / 760
      setScale(Math.max(0.32, Math.min(sw, sh, 1)))
    }
    fit()
    let raf = 0
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit) }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(it =>
      (it.nombre || '').toLowerCase().includes(q) ||
      getTags(it).join(' ').toLowerCase().includes(q))
  }, [query, items])

  const current = items.find(it => it.id === sel || it.allIds?.includes(sel)) || null

  const rootStyle = { '--sec': sec, '--idxw': '390px', '--rowpad': '13px', '--fscale': 1 }

  return (
    <div className="cart-scene" style={rootStyle}>
      <div className="bg-layer" />
      <div className="topbar">
        <div className="ttl">
          <h1>{section.label}</h1>
          <span className="sub">{section.sub}</span>
        </div>
        <div className="actions">
          <button className="btn ghost" type="button" onClick={onBackTablero}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Tablero
          </button>
          <button className="btn" type="button" onClick={onBackPortada}>Cartelera</button>
        </div>
      </div>

      <div className="stage">
        <div className="book-scale" style={{ transform: `scale(${scale})` }}>
          <div className="book">
            {/* índice */}
            <div className="page left">
              <div className="idx-head">
                <div className="idx-kicker">Índice</div>
                <div className="idx-title"><b>{section.label}</b><span>{total}</span></div>
                <div className="search">
                  <Magnifier />
                  <input value={query} onChange={e => setQuery(e.target.value)}
                    placeholder={`Buscar ${section.label.toLowerCase()}…`} />
                </div>
              </div>
              <div className="idx-list">
                {filtered.map((it) => {
                  const di = items.indexOf(it)
                  return (
                    <div key={it.id} className={clsx('idx-item', it.id === sel && 'active')}
                      onClick={() => setSel(it.id)}>
                      <span className="idx-dot" style={{ background: shade(sec, DOT_AMT[di % DOT_AMT.length]) }}>
                        {initial(it.nombre)}
                      </span>
                      <span className="idx-meta">
                        <div className="idx-nm">{it.nombre}</div>
                        <div className="idx-cap">{getCap(it)}</div>
                      </span>
                    </div>
                  )
                })}
                {total === 0 && (
                  <div className="idx-vacio">Sin datos disponibles todavía. Avanzá en la lectura para revelar nuevas pistas.</div>
                )}
                {total > 0 && filtered.length === 0 && (
                  <div className="idx-vacio">Sin resultados para “{query}”.</div>
                )}
              </div>
            </div>

            {/* lomo */}
            <div className="spine"><i /><i /><i /><i /><i /></div>
            <div className="ribbon" />

            {/* ficha */}
            <div className="page right">
              <div className="ruled" />
              {!current && (
                <div className="empty-pane">
                  <svg className="empty-arrow" width="58" height="40" viewBox="0 0 58 40" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M54 20H6" /><path d="M18 8 6 20l12 12" /></svg>
                  <div className="ek">{total === 0 ? 'Sin datos disponibles' : 'Elegí un nombre del índice'}</div>
                  <p>{total === 0
                    ? 'Cuando avances en la lectura, acá aparecerán las fichas de esta sección.'
                    : 'Su ficha aparecerá aquí: descripción, etiquetas y —si la tiene— una imagen.'}</p>
                </div>
              )}
              {current && (
                <div className="ficha" key={current.id}>
                  <div className="fic-top">
                    <div className="fic-head">
                      <div className="fic-kicker">{section.singular}</div>
                      <h2 className="fic-name">{current.nombre}</h2>
                      <div className="chips">
                        {getTags(current).map(tg => <span key={tg} className="chip">{tg}</span>)}
                      </div>
                      <div className="cap-pill">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        Primera aparición · {getCap(current)}
                      </div>
                    </div>
                    <div className="polaroid">
                      <span className="tape" />
                      {current.imagen?.url
                        ? <img className="pol-img" src={current.imagen.url} alt={current.nombre} />
                        : <div className="pol-empty">{initial(current.nombre)}</div>}
                      <div className="pcap">{current.nombre}</div>
                    </div>
                  </div>
                  <Wave color={sec} />
                  {current.entradas?.length > 1 ? (
                    <div className="fic-timeline">
                      {current.entradas.map((e, i) => (
                        <div key={e.capitulo_numero} className="fic-entrada">
                          <span className="fic-cap-lbl">Cap. {e.capitulo_numero}</span>
                          <p className="fic-desc">{deltaDesc(current.entradas[i - 1]?.descripcion, e.descripcion)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="fic-desc">{current.entradas?.[0]?.descripcion ?? current.descripcion}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
