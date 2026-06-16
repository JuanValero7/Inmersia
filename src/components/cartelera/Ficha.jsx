// Formato: Plain JavaScript (.jsx)
// Ficha de una sección (cuaderno a dos páginas): índice a la izquierda, detalle
// a la derecha. Los items vienen ya filtrados por capítulo desde Supabase, así
// que acá no hay lógica de spoilers. Sin relaciones (fuera del MVP).
import { useState, useMemo, useEffect } from 'react'
import clsx from 'clsx'
import { getTags, getCap, shade, DOT_AMT } from './carteleraHelpers.js'
import Signpost from './Signpost.jsx'
import { getTourPhase, setTourPhase } from '../guidedTour.js'

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

export default function Ficha({ section, items = [], onBackTablero, onBackPortada, initialItemId, onGoBack, onGoForo, onGoBiblioteca, onOpenList }) {
  const total = items.length
  const [sel, setSel] = useState(initialItemId || items[0]?.id || null)
  const [query, setQuery] = useState('')
  const [scale, setScale] = useState(1)
  const [explorarOpen, setExplorarOpen] = useState(false)

  const sec = section.color

  useEffect(() => {
    if (!explorarOpen) return
    const h = (e) => { if (!e.target.closest('.cart-explorar-popup')) setExplorarOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [explorarOpen])

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
      {onOpenList && <Signpost current={section.key} onOpenSection={onOpenList} />}
      <div className="topbar">
        <div className="ttl">
          <h1>{section.label}</h1>
          <span className="sub">{section.sub}</span>
        </div>
        <div className="cart-sec-hint">Sigue leyendo para revelar una sorpresa</div>
        <div className="actions">
          <button className="cart-sec-btn" type="button" onClick={onBackTablero}>Mural</button>
          <div className="cart-explorar-popup" style={{ position: 'relative' }}>
            {explorarOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60,
                background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 16,
                padding: '10px 14px', display: 'flex', gap: 20, alignItems: 'flex-end',
                boxShadow: '2px 4px 0 rgba(74,54,34,0.22), 0 14px 30px rgba(0,0,0,0.22)',
                whiteSpace: 'nowrap',
              }}>
                {onGoForo && (
                  <button type="button" onClick={() => { if (getTourPhase() === 'wait_foro') setTourPhase('foro_1'); setExplorarOpen(false); onGoForo() }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/></svg>
                    <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }}>Foro</span>
                  </button>
                )}
                {onGoBack && (
                  <button type="button" onClick={() => { setExplorarOpen(false); onGoBack() }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
                    <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }}>Lectura</span>
                  </button>
                )}
                {onGoBiblioteca && (
                  <button type="button" onClick={() => { setExplorarOpen(false); onGoBiblioteca() }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }}>Biblioteca</span>
                  </button>
                )}
              </div>
            )}
            <button className="cart-sec-btn" type="button" onClick={() => setExplorarOpen(o => !o)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><path d="M2 12h20"/></svg>
              Explorar
            </button>
          </div>
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
