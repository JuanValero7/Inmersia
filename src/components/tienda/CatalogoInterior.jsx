import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { CAT_COLOR } from './tiendaHelpers.jsx'
import { Pagination, BookCard, TIPOS } from './catalogoShared.jsx'
import { useCatalogoFiltro } from '../../hooks/useCatalogoFiltro.js'
import { useFichaEnUrl } from '../../hooks/useFichaEnUrl.js'
import FichaLibro from './FichaLibro.jsx'
import CabeceraTienda from './CabeceraTienda.jsx'

// =============================================================
// CatalogoInterior · interior de la tienda (estilo storybook)
// Versión desktop (/tienda/catalogo). Buscador + filtros por categoría +
// rejilla de portadas. Tocar un libro abre su ficha (FichaLibro), que
// vive en la URL (?libro=); el avance se abre desde la ficha. La búsqueda
// puede llegar ya escrita desde una sala (?q=).
//
// Props:
//   catalogo    · filas de `libros` (+ _nuevo)
//   loading     · cargando catálogo
//   user        · usuario auth (para el panel)
//   tieneLibro  · (id) => bool
//   onComprar   · (libro) => void
//   onVolver()  · volver a la tienda principal
// =============================================================

export default function CatalogoInterior({ catalogo, loading, user, gatoColor = 'negro', tieneLibro, onComprar, onVolver, onEmpezarLeer, filtroTipo = 'todos', onFiltroTipo, bloqueado = false }) {
  const location = useLocation()
  const [showFilters, setShowFilters] = useState(false)
  const { libro: sel, abrir, cerrar } = useFichaEnUrl(catalogo)

  const {
    selCats, toggleCat, q, handleQChange, handleQKeyDown,
    availableCats, list, paginatedList, page, goToPage, gridRef, resetFiltro,
  } = useCatalogoFiltro(catalogo, filtroTipo, tieneLibro, {
    qInicial: new URLSearchParams(location.search).get('q') || '',
    donde: 'catalogo',
  })

  const reset = () => { resetFiltro(onFiltroTipo); setShowFilters(false) }

  return (
    <div className="interior show">
      <div className="interior-bg" style={{ '--intbg-gato-url': `url('/assets/tienda/gato-${gatoColor}-5.webp')` }} />
      <CabeceraTienda etiquetaAtras="Tienda" onAtras={onVolver} user={user} />

      <div className="interior-inner">
        <h1 className="int-title">Catálogo</h1>
        <p className="int-sub">Elige tu próximo libro</p>

        {/* Buscador */}
        <div className="int-search">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input type="text" placeholder="Buscar por título o autor…" value={q} aria-label="Buscar en el catálogo"
            onChange={e => handleQChange(e.target.value)}
            onKeyDown={handleQKeyDown} />
          {q && <button className="int-search-clear" onClick={() => handleQChange('')} aria-label="Limpiar">×</button>}
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
                    <span className="dot" style={{ background: CAT_COLOR[c] || '#F2792A' }} />
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="int-count">{list.length} {list.length === 1 ? 'libro' : 'libros'}</p>

        {/* Rejilla */}
        {loading ? (
          <p className="int-count">Cargando catálogo…</p>
        ) : list.length > 0 ? (
          <>
            <div className="int-grid" ref={gridRef}>
              {paginatedList.map(b => (
                <BookCard key={b.id} libro={b} adquirido={tieneLibro(b.id)} onOpen={abrir} />
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

      {/* Ficha del libro (el avance se abre desde ella) */}
      {sel && (
        <FichaLibro
          key={sel.id}
          libro={sel}
          user={user}
          yaAdquirido={tieneLibro(sel.id)}
          bloqueado={bloqueado}
          onComprar={() => { onComprar(sel); cerrar() }}
          onEmpezarLeer={() => onEmpezarLeer(sel)}
          onCerrar={cerrar}
          origen="catalogo"
        />
      )}
    </div>
  )
}
