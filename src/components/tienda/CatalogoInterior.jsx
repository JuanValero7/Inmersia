import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

const LOGO = '/assets/inmersia-logo.png'
import { CAT_COLOR, itint, tituloSizeClass, autorSizeClass } from './tiendaHelpers.jsx'
import PanelLibro from './PanelLibro.jsx'
import LibroReel from './LibroReel.jsx'

// =============================================================
// CatalogoInterior · interior de la tienda (estilo storybook)
// Versión desktop. Buscador + filtros por categoría + rejilla de
// portadas, y panel lateral de detalle.
//
// Props:
//   catalogo    · filas de `libros` (+ _nuevo)
//   loading     · cargando catálogo
//   user        · usuario auth (para el panel)
//   tieneLibro  · (id) => bool
//   libroLeido  · (id) => bool
//   onComprar   · (libro) => void
//   onVolver()  · regresar a la calle
// =============================================================

const PG_SIZE = 15

function Pagination({ page, total, onChange }) {
  const totalPages = Math.ceil(total / PG_SIZE)
  if (totalPages <= 1) return null

  const nums = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) nums.push(i)
  } else if (page <= 4) {
    nums.push(1, 2, 3, 4, 5, '…', totalPages)
  } else if (page >= totalPages - 3) {
    nums.push(1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
  } else {
    nums.push(1, '…', page - 1, page, page + 1, '…', totalPages)
  }

  return (
    <div className="pg-bar">
      <button className="pg-btn" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Anterior">←</button>
      {nums.map((p, i) =>
        p === '…'
          ? <span key={`el-${i}`} className="pg-ellipsis">…</span>
          : <button key={p} className={clsx('pg-btn', p === page && 'on')} onClick={() => onChange(p)}>{p}</button>
      )}
      <button className="pg-btn" onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Siguiente">→</button>
    </div>
  )
}

function CoverCard({ libro }) {
  const c = libro.color || '#cf8a6e'
  return (
    <div className="book" style={{ '--cov': c }}>
      <div className="book-cover">
        {libro.portada_url
          ? <img className="book-art-img" src={libro.portada_url} alt={libro.titulo} />
          : <div className="book-art-empty" />}
        <span className={clsx('book-scribble', autorSizeClass(libro.autor))}>{libro.autor}</span>
        <span className={clsx('book-title', tituloSizeClass(libro.titulo))}>{libro.titulo}</span>
      </div>
      <div className="book-base" />
      <div className="book-pages" />
    </div>
  )
}

const TIPOS = [
  { key: 'todos',     label: 'Todos' },
  { key: 'ficcion',   label: 'Ficción' },
  { key: 'noficcion', label: 'No ficción' },
]

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

export default function CatalogoInterior({ catalogo, loading, user, gatoColor, tieneLibro, libroLeido, onComprar, onVolver, onEmpezarLeer, filtroTipo = 'todos', onFiltroTipo, bloqueado = false }) {
  const navigate = useNavigate()
  const [selCats,     setSelCats]     = useState(new Set())
  const [qInput,      setQInput]      = useState('')
  const [q,           setQ]           = useState('')
  const [sel,         setSel]         = useState(null)
  const [reelLibro,   setReelLibro]   = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [page,        setPage]        = useState(1)
  const gridRef = useRef(null)

  const availableCats = useMemo(() => [...new Set(catalogo.flatMap(b => b.categorias || []))].sort(), [catalogo])
  const query = q.trim().toLowerCase()

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

  const list = useMemo(() => {
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

  useEffect(() => { setPage(1) }, [q, filtroTipo, selCats])

  const paginatedList = list.slice((page - 1) * PG_SIZE, page * PG_SIZE)

  function goToPage(p) {
    setPage(p)
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const reset = () => { setSelCats(new Set()); setQ(''); setQInput(''); setShowFilters(false); onFiltroTipo?.('todos') }

  function handleReelClose() {
    if (!sel) setSel(reelLibro)
    setReelLibro(null)
  }

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
        <p className="int-sub">Elige tu próximo libro</p>

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

        {/* Filtro por tipo */}
        <div className="int-filterbar">
          {TIPOS.map(({ key, label }) => (
            <button key={key} className={clsx('int-chip', filtroTipo === key && 'on')}
              onClick={() => onFiltroTipo?.(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* Filtro por categoría */}
        {availableCats.length > 0 && (
          <div className="int-filterbar">
            <button className={clsx('int-chip', selCats.size > 0 && 'on')}
              onClick={() => setShowFilters(v => !v)}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3">
                <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
              </svg>
              Filtrar{selCats.size > 0 ? ` · ${selCats.size}` : ''}
            </button>
            {showFilters && (
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
            <div className="int-grid" ref={gridRef}>
              {paginatedList.map(b => (
                <BookCard key={b.id} libro={b} adquirido={tieneLibro(b.id)} onOpen={setReelLibro} />
              ))}
            </div>
            <Pagination page={page} total={list.length} onChange={goToPage} />
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

      {/* Panel lateral de detalle */}
      <div className={clsx('bkp-scrim', sel && 'show')} onClick={() => setSel(null)} />
      {sel && (
        <PanelLibro
          key={sel.id}
          libro={sel}
          user={user}
          gatoColor={gatoColor}
          yaAdquirido={tieneLibro(sel.id)}
          yaLeido={libroLeido(sel.id)}
          bloqueado={bloqueado}
          onComprar={() => { onComprar(sel); setSel(null) }}
          onClose={() => setSel(null)}
          onPreview={() => setReelLibro(sel)}
          onEmpezarLeer={() => { onEmpezarLeer(sel); setSel(null) }}
        />
      )}

      {reelLibro && <LibroReel libro={reelLibro} onClose={handleReelClose} />}
    </div>
  )
}
