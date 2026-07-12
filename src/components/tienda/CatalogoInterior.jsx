import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

const LOGO = '/assets/inmersia-logo.png'
import { CAT_COLOR } from './tiendaHelpers.jsx'
import { Pagination, BookCard, TIPOS } from './catalogoShared.jsx'
import { useCatalogoFiltro } from '../../hooks/useCatalogoFiltro.js'
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

export default function CatalogoInterior({ catalogo, loading, user, gatoColor = 'negro', tieneLibro, libroLeido, onComprar, onVolver, onEmpezarLeer, filtroTipo = 'todos', onFiltroTipo, bloqueado = false }) {
  const navigate = useNavigate()
  const [sel,         setSel]         = useState(null)
  const [reelLibro,   setReelLibro]   = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const {
    selCats, toggleCat, qInput, q, handleQChange, handleQKeyDown,
    availableCats, list, paginatedList, page, goToPage, gridRef, resetFiltro,
  } = useCatalogoFiltro(catalogo, filtroTipo, tieneLibro)

  const reset = () => { resetFiltro(onFiltroTipo); setShowFilters(false) }

  function handleReelClose() {
    if (!sel) setSel(reelLibro)
    setReelLibro(null)
  }

  return (
    <div className="interior show">
      <div className="interior-bg" style={{ '--intbg-gato-url': `url('/assets/tienda/gato-${gatoColor}-5.webp')` }} />
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
          {qInput && <button className="int-search-clear" onClick={() => handleQChange('')} aria-label="Limpiar">×</button>}
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
              {q ? <>No encontramos nada para «{q}»</> : 'No hay libros con esas categorías.'}
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
