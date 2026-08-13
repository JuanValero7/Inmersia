// src/components/mobile/CarteleraMobile.jsx
// ─────────────────────────────────────────────────────────────
// CÁSCARA MOBILE DE LA CARTELERA.
// Reescribe SOLO el cromo: header, sub-header de sección, gato-dock
// (salto entre secciones) y bottom-sheet "Explorar". La entrada es el
// LANDING vertical (CarteleraLandingMobile) — re-flow del corcho del
// desktop —; tocar una zona abre la LISTA/FICHA de esa sección
// (CarteleraMobileFicha.jsx), que lee los mismos campos de Supabase.
//
// Mismo contrato de props que Cartelera.jsx:
//   { onGoBack, book, user, onGoForo, onGoBiblioteca }
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBookBySlug } from '../../hooks/useBookBySlug.js'

const VALID_SECCIONES = ['personajes', 'lugares', 'hechos', 'datos', 'notas', 'glosario', 'referencias', 'resumen']
import { useCartelera } from '../cartelera/useCartelera.js'
import { SECCIONES, getSecciones } from '../cartelera/carteleraHelpers.js'
import CarteleraLandingMobile from './CarteleraLandingMobile.jsx'
import CarteleraMobileFicha, { CarteleraMobileLista } from './CarteleraMobileFicha.jsx'
import '../../styles/cartelera.css'
import '../../styles/cartelera.mobile.css'

// ── Iconos ──
const Compass = ({ s = 17 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /><path d="M2 12h20" /></svg>)
const Back = ({ s = 16 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>)
const Close = ({ s = 14 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>)

const NAV_ICONS = {
  lectura:    <g><path d="M12 7v14" /><path d="M3 18a1 1 0 01-1-1V4a1 1 0 011-1h5a4 4 0 014 4 4 4 0 014-4h5a1 1 0 011 1v13a1 1 0 01-1 1h-6a3 3 0 00-3 3 3 3 0 00-3-3z" /></g>,
  biblioteca: <g><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></g>,
  foro:       <path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />,
}

// ── Header (atrás opcional · título · Explorar) ──
function Header({ book, onBack, onExplore }) {
  return (
    <header className="cm-header">
      {onBack && <button type="button" className="cm-iconbtn" onClick={onBack} aria-label="Volver a Investigación"><Back /></button>}
      <div className="cm-title">
        <h1>{book?.title || 'Investigación'}</h1>
        <p>Investigación</p>
      </div>
      <button type="button" className="cm-iconbtn" onClick={onExplore} aria-label="Explorar"><Compass /></button>
    </header>
  )
}

// Icono de la cartelera (corcho 2×2) para el atajo "Cartelera" del gato-dock
const BoardIcon = ({ s = 17 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M12 3v18M3 12h18" /></svg>)

// ── Gato-dock: navegación INTERNA de la cartelera (volver al landing + saltar
// a otras secciones). El botón "atrás" del header sale de Investigación. ──
function CatDock({ currentKey, onJump, onGoLanding, secciones = SECCIONES, gatoColor = 'negro' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const others = secciones.filter(s => s.key !== currentKey)

  useEffect(() => {
    if (!open) return
    const handleOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [open])

  return (
    <div className="cm-cat-dock" ref={ref}>
      <button type="button" className="cm-cat-btn" onClick={() => setOpen(o => !o)} aria-label="Menú del gato">
        <img className="cm-cat-img" src={`/assets/cartelera/gato-${gatoColor}-2.webp`} alt="Gato" />
      </button>
      {open && (
        <div className="cm-cat-tray">
          {onGoLanding && (
            <button type="button" className="cm-cat-tool" onClick={() => { setOpen(false); onGoLanding() }}>
              <span className="cm-cat-tile cm-cat-tile-board"><BoardIcon /></span>
              <span className="cm-cat-lbl">Cartelera</span>
            </button>
          )}
          {others.map(s => (
            <button key={s.key} type="button" className="cm-cat-tool" onClick={() => { setOpen(false); onJump(s.key) }}>
              <span className="cm-cat-tile" style={{ background: s.color }}>{s.label[0]}</span>
              <span className="cm-cat-lbl">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Bottom-sheet "Explorar" (mismas salidas que el desktop) ──
function ExploreSheet({ onClose, onGoLectura, onGoForo, onGoBiblioteca }) {
  const opts = [
    onGoLectura && { key: 'lectura', label: 'Lectura', fn: onGoLectura },
    onGoBiblioteca && { key: 'biblioteca', label: 'Biblioteca', fn: onGoBiblioteca },
    onGoForo && { key: 'foro', label: 'Foro', fn: onGoForo },
  ].filter(Boolean)
  return (
    <div className="cm-backdrop" onClick={onClose}>
      <div className="cm-sheet" onClick={e => e.stopPropagation()}>
        <div className="cm-grip" />
        <div className="cm-sheet-head">
          <span className="cm-sheet-title">Ir a…</span>
          <button type="button" className="cm-close" onClick={onClose}><Close /></button>
        </div>
        <div className="cm-nav-grid">
          {opts.map(o => (
            <button key={o.key} type="button" onClick={() => { onClose(); o.fn() }}>
              <span className="cm-nav-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{NAV_ICONS[o.key]}</svg></span>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Vista de sección: lista → ficha ──
function SectionView({ sectionKey, data, onGoBack, onGoLanding, onJump, onExplore, initialItemId, secciones = SECCIONES, gatoColor = 'negro' }) {
  const meta = secciones.find(s => s.key === sectionKey)
  const [tab, setTab] = useState('lista')      // lista | ficha
  const [selId, setSelId] = useState(null)
  const items = data.itemsBySeccion[sectionKey] || []
  const current = items.find(it => it.id === selId || it.allIds?.includes(selId)) || null
  const listScrollRef = useRef(0)

  // al cambiar de sección reseteamos a Lista
  useEffect(() => { setTab('lista'); setSelId(null); listScrollRef.current = 0 }, [sectionKey])

  // salto directo a un item desde X-ray: back desde ficha va al origen, no a la lista
  useEffect(() => {
    if (!initialItemId || items.length === 0) return
    if (items.find(it => it.id === initialItemId || it.allIds?.includes(initialItemId))) {
      setSelId(initialItemId)
      setTab('ficha')
    }
  }, [initialItemId, items])

  const pick = (id) => { setSelId(id); setTab('ficha') }

  return (
    <div className="cm-screen" style={{ '--sec': meta.color }}>
      <Header book={data.book} onBack={onGoBack} onExplore={onExplore} />

      <div className="cm-subhead">
        <div className="cm-sec-name">
          <span className="cm-sec-swatch" style={{ background: meta.color }}>{meta.label[0]}</span>
          <h2>{meta.label}</h2>
        </div>
      </div>

      {tab === 'lista' && (
        <CarteleraMobileLista section={meta} items={items} onPick={pick}
          initialScroll={listScrollRef.current} onScroll={(y) => { listScrollRef.current = y }} />
      )}

      {tab === 'ficha' && (
        <CarteleraMobileFicha section={meta} item={current} onBack={() => setTab('lista')} backLabel="Lista" />
      )}

      <CatDock currentKey={sectionKey} onJump={onJump} onGoLanding={onGoLanding} secciones={secciones} gatoColor={gatoColor} />
    </div>
  )
}

export default function CarteleraMobile({ onGoBack, onGoLectura, book: bookProp, user, onGoForo, onGoBiblioteca, jumpToItemId, onJumpConsumed, isSuperuser = false, gatoColor = 'negro' }) {
  const { book, loading: bookLoading } = useBookBySlug(bookProp)
  const esNoficcion = book?.es_ficcion === false
  const secciones  = getSecciones(esNoficcion)
  const data = useCartelera(book?.libro_id || null, user?.id || null, isSuperuser)
  const [searchParams, setSearchParams] = useSearchParams()
  // Lazy init: jumpToItemId tiene prioridad; si no, lee ?seccion= de la URL.
  const [view, setView] = useState(() => {
    if (jumpToItemId) return { kind: 'board', key: secciones[0].key }
    const s = searchParams.get('seccion')
    return s && VALID_SECCIONES.includes(s) ? { kind: 'board', key: s } : { kind: 'landing', key: null }
  })
  const [explore, setExplore] = useState(false)

  useEffect(() => {
    if (view.key) setSearchParams({ seccion: view.key }, { replace: true })
    else setSearchParams({}, { replace: true })
  }, [view.key, setSearchParams])
  const [fichaInitItemId, setFichaInitItemId] = useState(() => jumpToItemId || null)

  useEffect(() => {
    if (!jumpToItemId || bookLoading) return
    setFichaInitItemId(jumpToItemId)
    setView({ kind: 'board', key: secciones[0].key })
    onJumpConsumed?.()
  }, [jumpToItemId, bookLoading])

  const openSection = (k) => {
    setView({ kind: 'board', key: k })
  }

  if (bookLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-warm)' }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(139,77,42,0.2)', borderTopColor: '#8b4d2a' }} />
    </div>
  )

  const exploreProps = { onClose: () => setExplore(false), onGoLectura, onGoForo, onGoBiblioteca }
  const dataWithBook = { ...data, book }

  return (
    <div className="cart-root cm-root">
      {view.kind === 'landing' ? (
        <div className="cm-screen">
          <Header book={book} onBack={onGoBack} onExplore={() => setExplore(true)} />
          <CarteleraLandingMobile data={dataWithBook} esNoficcion={esNoficcion} onOpenSection={openSection} />
        </div>
      ) : (
        <SectionView
          sectionKey={view.key}
          data={dataWithBook}
          onGoBack={onGoBack}
          onGoLanding={() => setView({ kind: 'landing', key: null })}
          onJump={openSection}
          onExplore={() => setExplore(true)}
          initialItemId={fichaInitItemId}
          secciones={secciones}
          gatoColor={gatoColor}
        />
      )}
      {explore && <ExploreSheet {...exploreProps} />}
    </div>
  )
}
