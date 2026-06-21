import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

const LOGO = '/assets/inmersia-logo.png'
import { CAT_COLOR, itint, ilum } from './tiendaHelpers.jsx'
import PanelLibro from './PanelLibro.jsx'
import useIsMobile from '../../hooks/useIsMobile.js'

// =============================================================
// CatalogoInterior · interior de la tienda (estilo storybook)
// Buscador + filtros por categoría + rejilla de portadas, y panel
// lateral de detalle. Toda la data viene de props (catálogo real).
//
// Props:
//   catalogo    · filas de `libros` (+ _nuevo)
//   loading     · cargando catálogo
//   user        · usuario auth (para el panel)
//   tieneLibro  · (id) => bool
//   libroLeido  · (id) => bool
//   onComprar   · (libro) => void
//   onPreview   · (libro) => void  (abre LibroReel)
//   onVolver()  · regresar a la calle
// =============================================================

// Portada de la tarjeta: portada_url si existe, si no una generada.
function CoverCard({ libro }) {
  const c = libro.color || '#cf8a6e'
  if (libro.portada_url) {
    return <img className="bk-cover bk-cover-img" src={libro.portada_url} alt={libro.titulo} />
  }
  const light = ilum(c) > 0.62
  const fg   = light ? 'rgba(40,28,16,0.92)' : 'rgba(255,250,240,0.96)'
  const mark = light ? 'rgba(40,28,16,0.4)'  : 'rgba(255,247,225,0.85)'
  return (
    <div className="bk-cover" style={{ background: `linear-gradient(150deg, ${itint(c, 0.18)}, ${itint(c, -0.16)})` }}>
      <span className="bk-cover-band" />
      <span className="bk-cover-mark" style={{ background: mark }} />
      <span className="bk-cover-title" style={{ color: fg, textShadow: light ? 'none' : '0 1px 2px rgba(0,0,0,0.35)' }}>
        {libro.titulo}
      </span>
    </div>
  )
}

const TIPOS = [
  { key: 'todos',     label: 'Todos' },
  { key: 'ficcion',   label: 'Ficción' },
  { key: 'noficcion', label: 'No ficción' },
]

function FilterOverlay({ availableCats, selCats, onToggle, onClear, onClose, filtroTipo, onFiltroTipo }) {
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntering(false))
    return () => cancelAnimationFrame(id)
  }, [])

  const hasAny = selCats.size > 0 || filtroTipo !== 'todos'

  return (
    <div className={clsx('int-filter-ov', entering && 'entering')}>
      <div className="int-filter-ov-head">
        <button className="int-filter-ov-back" onClick={onClose}>‹ Volver</button>
        <span className="int-filter-ov-title">Filtrar</span>
        {hasAny
          ? <button className="int-filter-ov-clear" onClick={onClear}>Quitar todo</button>
          : <span style={{ minWidth: 72 }} />
        }
      </div>
      <div className="int-filter-ov-body">
        <p className="int-filter-ov-section">Tipo</p>
        {TIPOS.map(({ key, label }) => (
          <button key={key} className={clsx('int-filter-ov-row', filtroTipo === key && 'on')} onClick={() => onFiltroTipo(key)}>
            <span style={{ flex: 1 }}>{label}</span>
            {filtroTipo === key && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            )}
          </button>
        ))}
        {availableCats.length > 0 && (
          <>
            <p className="int-filter-ov-section">Categoría</p>
            {availableCats.map(c => (
              <button key={c} className={clsx('int-filter-ov-row', selCats.has(c) && 'on')} onClick={() => onToggle(c)}>
                <span style={{
                  width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
                  background: selCats.has(c) ? 'rgba(255,255,255,0.75)' : (CAT_COLOR[c] || '#cf8a6e'),
                  border: selCats.has(c) ? '2px solid rgba(255,255,255,0.55)' : '2px solid rgba(74,54,34,0.35)',
                }} />
                <span style={{ flex: 1 }}>{c}</span>
                {selCats.has(c) && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </button>
            ))}
          </>
        )}
      </div>
      <div className="int-filter-ov-foot">
        <button className="int-filter-ov-apply" onClick={onClose}>
          {hasAny ? 'Aplicar filtros' : 'Listo'}
        </button>
      </div>
    </div>
  )
}

function BookCard({ libro, adquirido, onOpen }) {
  const c = libro.color || '#cf8a6e'
  const catCol = CAT_COLOR[libro.categorias?.[0]] || '#cf8a6e'
  return (
    <button className={clsx('bk-card', adquirido && 'bk-card-owned')} type="button"
      title={`${libro.titulo} — ${libro.autor}`} onClick={() => onOpen(libro)}>
      {libro._nuevo && <span className="bk-ribbon">Nuevo</span>}
      <div className="bk-inner">
        <span className="bk-badge" style={{ background: catCol }} title={libro.categorias?.[0]}>✦</span>
        <div className="bk-stage" style={{ background: `linear-gradient(180deg, ${itint(c, 0.82)}, ${itint(c, 0.66)})` }}>
          <span className="bk-glow" style={{ background: `radial-gradient(circle, ${itint(c, 0.28)}, transparent 66%)` }} />
          <span className="bk-podium" />
          <CoverCard libro={libro} />
          <span className="bk-shelf" />
        </div>
        <div className="bk-foot">
          <div className="bk-meta">
            <span className="bk-title">{libro.titulo}</span>
            <span className="bk-author">{libro.autor}</span>
          </div>
          <span className={clsx('bk-fab', adquirido && 'owned')} aria-hidden="true">{adquirido ? '✓' : '›'}</span>
        </div>
      </div>
    </button>
  )
}

export default function CatalogoInterior({ catalogo, loading, loadingMore, hasMore, onLoadMore, user, tieneLibro, libroLeido, onComprar, onPreview, onVolver, onEmpezarLeer, filtroTipo = 'todos', onFiltroTipo }) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [selCats,     setSelCats]     = useState(new Set())
  const [qInput,      setQInput]      = useState('')
  const [q,           setQ]           = useState('')
  const [sel,         setSel]         = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const availableCats = useMemo(() => [...new Set(catalogo.flatMap(b => b.categorias || []))].sort(), [catalogo])
  const query = q.trim().toLowerCase()

  // En mobile, intercepta el botón "Atrás" de Android para cerrar el panel
  // en vez de navegar al historial del browser.
  useEffect(() => {
    if (!isMobile || !sel) return
    window.history.pushState({ _inmPanel: sel.id }, '')
    let closedByBack = false
    const handlePop = () => { closedByBack = true; setSel(null) }
    window.addEventListener('popstate', handlePop)
    return () => {
      window.removeEventListener('popstate', handlePop)
      if (!closedByBack) window.history.go(-1)
    }
  }, [isMobile, sel])

  const toggleCat = (c) => setSelCats(prev => {
    const next = new Set(prev)
    if (next.has(c)) next.delete(c); else next.add(c)
    return next
  })

  const handleQChange = (value) => {
    setQInput(value)
    if (!value) setQ('')
  }
  const handleQKeyDown = (e) => {
    if (e.key === 'Enter') setQ(qInput)
    if (e.key === 'Escape') { setQInput(''); setQ('') }
  }
  const list  = useMemo(() => {
    const filtered = catalogo.filter(b => {
      const okCat  = selCats.size === 0 || (b.categorias || []).some(c => selCats.has(c))
      const okQ    = !query ||
        (b.titulo || '').toLowerCase().includes(query) ||
        (b.autor  || '').toLowerCase().includes(query)
      const okTipo = filtroTipo === 'todos' ||
        (filtroTipo === 'ficcion' ? b.es_ficcion !== false : b.es_ficcion === false)
      return okCat && okQ && okTipo
    })
    return filtered.sort((a, b) => (tieneLibro(a.id) ? 1 : 0) - (tieneLibro(b.id) ? 1 : 0))
  }, [catalogo, selCats, query, filtroTipo, tieneLibro])
  const reset = () => { setSelCats(new Set()); setQ(''); setQInput(''); setShowFilters(false); onFiltroTipo?.('todos') }

  return (
    <div className="interior show">
      <div className="interior-bg" />
      {user ? (
        <div className="int-back-row">
          <button className="int-back" onClick={onVolver}>Biblioteca</button>
        </div>
      ) : (
        <header className="tienda-guest-nav">
          <div className="tienda-guest-nav-in">
            <button className="tienda-guest-volver" onClick={onVolver}>← Volver</button>
            <img src={LOGO} alt="Inmersia" className="tienda-guest-logo" />
            <nav className="tienda-guest-actions">
              <button className="tienda-guest-lnk" onClick={() => navigate('/auth', { state: { tab: 'login' } })}>Iniciar sesión</button>
              <button className="tienda-guest-btn" onClick={() => navigate('/auth', { state: { tab: 'registro' } })}>Crear cuenta</button>
            </nav>
          </div>
        </header>
      )}

      <div className="interior-inner">
        <h1 className="int-title">Catálogo</h1>
        <p className="int-sub">Elige tu próximo mundo</p>

        {/* Buscador */}
        <div className="int-search">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input type="text" placeholder="Buscar por título o autor… (Enter)" value={qInput}
            onChange={e => handleQChange(e.target.value)}
            onKeyDown={handleQKeyDown} />
          {qInput && <button className="int-search-clear" onClick={() => { setQInput(''); setQ('') }} aria-label="Limpiar">×</button>}
        </div>

        {/* Filtro por tipo — solo desktop; en mobile vive dentro del overlay */}
        {!isMobile && (
          <div className="int-filterbar">
            {TIPOS.map(({ key, label }) => (
              <button key={key} className={clsx('int-chip', filtroTipo === key && 'on')}
                onClick={() => onFiltroTipo?.(key)}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Filtro por categoría */}
        {availableCats.length > 0 && (
          <div className="int-filterbar">
            {(() => {
              const activeCount = selCats.size + (isMobile && filtroTipo !== 'todos' ? 1 : 0)
              return (
                <button className={clsx('int-chip', activeCount > 0 && 'on')}
                  onClick={() => isMobile ? setShowFilters(true) : setShowFilters(v => !v)}>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3">
                    <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
                  </svg>
                  Filtrar{activeCount > 0 ? ` · ${activeCount}` : ''}
                </button>
              )
            })()}
            {!isMobile && showFilters && (
              <div className="int-chips">
                {availableCats.map(c => (
                  <button key={c} className={clsx('int-chip', selCats.has(c) && 'on')} onClick={() => toggleCat(c)}>
                    <span className="dot" style={{ background: CAT_COLOR[c] || '#cf8a6e' }} />
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="int-count">{list.length} {list.length === 1 ? 'aventura' : 'aventuras'}</p>

        {/* Rejilla */}
        {loading ? (
          <p className="int-count">Cargando catálogo…</p>
        ) : list.length > 0 ? (
          <>
            <div className="int-grid">
              {list.map(b => (
                <BookCard key={b.id} libro={b} adquirido={tieneLibro(b.id)} onOpen={setSel} />
              ))}
            </div>
            {hasMore && (
              <div style={{ textAlign: 'center', padding: '28px 0 8px' }}>
                <button className="int-empty-reset" onClick={onLoadMore} disabled={loadingMore}>
                  {loadingMore ? 'Cargando…' : 'Cargar más libros'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="int-empty">
            <div className="int-empty-mark">✦</div>
            <div className="int-empty-text">
              {query ? <>No encontramos nada para «{q}»</> : 'No hay libros con esas categorías.'}
            </div>
            <button className="int-empty-reset" onClick={reset}>Ver todo el catálogo</button>
          </div>
        )}
      </div>

      {/* Mobile: overlay filtro pantalla completa */}
      {isMobile && showFilters && (
        <FilterOverlay
          availableCats={availableCats}
          selCats={selCats}
          onToggle={toggleCat}
          onClear={() => { setSelCats(new Set()); onFiltroTipo?.('todos'); setShowFilters(false) }}
          onClose={() => setShowFilters(false)}
          filtroTipo={filtroTipo}
          onFiltroTipo={onFiltroTipo}
        />
      )}

      {/* Panel lateral de detalle */}
      <div className={clsx('bkp-scrim', sel && 'show')} onClick={() => setSel(null)} />
      {sel && (
        <PanelLibro
          key={sel.id}
          libro={sel}
          user={user}
          yaAdquirido={tieneLibro(sel.id)}
          yaLeido={libroLeido(sel.id)}
          onComprar={() => { onComprar(sel); setSel(null) }}
          onClose={() => setSel(null)}
          onPreview={() => onPreview(sel)}
          onEmpezarLeer={() => { onEmpezarLeer(sel); setSel(null) }}
        />
      )}
    </div>
  )
}
