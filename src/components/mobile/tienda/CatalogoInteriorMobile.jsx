import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useOpenAuth } from '../../../context/authModal.jsx'
import { CAT_COLOR } from '../../tienda/tiendaHelpers.jsx'
import { Pagination, BookCard, TIPOS } from '../../tienda/catalogoShared.jsx'
import { useCatalogoFiltro } from '../../../hooks/useCatalogoFiltro.js'
import { useFichaEnUrl } from '../../../hooks/useFichaEnUrl.js'
import FichaLibroMobile from './FichaLibroMobile.jsx'
import CabeceraTiendaMobile from './CabeceraTiendaMobile.jsx'

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
                  background: selCats.has(c) ? 'rgba(255,255,255,0.75)' : (CAT_COLOR[c] || '#F2792A'),
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

export default function CatalogoInteriorMobile({ catalogo, loading, user, gatoColor = 'negro', tieneLibro, onComprar, onVolver, onEmpezarLeer, filtroTipo = 'todos', onFiltroTipo, bloqueado = false }) {
  const openAuth = useOpenAuth()
  const location = useLocation()
  const [showFilters, setShowFilters] = useState(false)
  // La ficha vive en la URL (?libro=): el botón Atrás de Android la cierra
  // sin salir de la tienda, porque abrirla apila una entrada en el historial.
  const { libro: sel, abrir, cerrar } = useFichaEnUrl(catalogo)

  const {
    selCats, toggleCat, clearCats, q, handleQChange, handleQKeyDown,
    availableCats, list, paginatedList, page, goToPage, gridRef, resetFiltro,
  } = useCatalogoFiltro(catalogo, filtroTipo, tieneLibro, {
    qInicial: new URLSearchParams(location.search).get('q') || '',
    donde: 'catalogo_movil',
  })

  const reset = () => { resetFiltro(onFiltroTipo); setShowFilters(false) }

  const activeCount = selCats.size + (filtroTipo !== 'todos' ? 1 : 0)

  return (
    <div className="interior show">
      <div className="interior-bg" style={{ '--intbg-gato-url': `url('/assets/tienda/gato-${gatoColor}-5.webp')` }} />
      <CabeceraTiendaMobile
        etiquetaAtras="Tienda"
        onAtras={onVolver}
        derecha={!user && (
          <button type="button" className="tpm-pill tpm-pill-naranja" onClick={() => openAuth('registro')}>Crear cuenta</button>
        )}
      />

      <div className="interior-inner">
        <h1 className="int-title">Catálogo</h1>
        <p className="int-sub">Elige tu próximo libro</p>

        <div className="int-search">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input type="text" placeholder="Buscar por título o autor…" value={q} aria-label="Buscar en el catálogo"
            onChange={e => handleQChange(e.target.value)}
            onKeyDown={handleQKeyDown} />
          {q && <button className="int-search-clear" onClick={() => handleQChange('')} aria-label="Limpiar">×</button>}
        </div>

        {availableCats.length > 0 && (
          <div className="int-filterbar">
            <button className={clsx('int-chip', activeCount > 0 && 'on')}
              onClick={() => setShowFilters(true)}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3">
                <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
              </svg>
              Filtrar{activeCount > 0 ? ` · ${activeCount}` : ''}
            </button>
          </div>
        )}
        <p className="int-count">{list.length} {list.length === 1 ? 'libro' : 'libros'}</p>

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

      {showFilters && (
        <FilterOverlay
          availableCats={availableCats}
          selCats={selCats}
          onToggle={toggleCat}
          onClear={() => { clearCats(); onFiltroTipo?.('todos'); setShowFilters(false) }}
          onClose={() => setShowFilters(false)}
          filtroTipo={filtroTipo}
          onFiltroTipo={onFiltroTipo}
        />
      )}

      {/* Ficha del libro a pantalla completa (el avance se abre desde ella) */}
      {sel && (
        <FichaLibroMobile
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
