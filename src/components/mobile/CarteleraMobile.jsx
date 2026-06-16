// src/components/mobile/CarteleraMobile.jsx
// ─────────────────────────────────────────────────────────────
// CÁSCARA MOBILE DE LA CARTELERA.
// Reescribe SOLO el cromo: header, sub-header (Mural/Lista),
// portada vertical, gato-dock (salto entre secciones) y bottom-sheet
// "Explorar". La REVELACIÓN no se duplica: reutiliza TAL CUAL los
// tableros de escritorio (TableroPersonajes/Lugares/Hechos/Datos/Notas)
// y el hook de datos useCartelera. La lista y la ficha son mobile
// (CarteleraMobileFicha.jsx) pero leen los mismos campos de Supabase.
//
// Mismo contrato de props que Cartelera.jsx:
//   { onGoBack, book, user, onGoForo, onGoBiblioteca }
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { useCartelera } from '../cartelera/useCartelera.js'
import { SECCIONES, seccionMeta, shade } from '../cartelera/carteleraHelpers.js'
import TableroPersonajes from '../cartelera/TableroPersonajes.jsx'
import TableroLugares from '../cartelera/TableroLugares.jsx'
import TableroHechos from '../cartelera/TableroHechos.jsx'
import TableroDatos from '../cartelera/TableroDatos.jsx'
import TableroNotas from '../cartelera/TableroNotas.jsx'
import CarteleraMobileFicha, { CarteleraMobileLista } from './CarteleraMobileFicha.jsx'
import { getTourPhase, setTourPhase } from '../guidedTour.js'
import {
  runGuidedCartPortada1Mobile, runGuidedCartPortada2Mobile,
  runGuidedCartPersonajesMobile, runGuidedCartNotasMobile,
} from '../tutorial.mobile.js'
import '../../styles/cartelera.css'
import '../../styles/cartelera.mobile.css'

const BOARD_W = 700, BOARD_H = 860
const TABLEROS = { personajes: TableroPersonajes, lugares: TableroLugares, hechos: TableroHechos, datos: TableroDatos }
const ORDER = ['personajes', 'lugares', 'hechos', 'datos', 'notas']

// borde inferior rasgado (acuarela) por panel de la portada
const TORN = [
  'polygon(0 0,100% 0,100% calc(100% - 14px),84% 100%,66% calc(100% - 13px),46% 100%,26% calc(100% - 11px),9% 100%,0 calc(100% - 16px))',
  'polygon(0 0,100% 0,100% calc(100% - 16px),80% 100%,60% calc(100% - 12px),42% 100%,22% calc(100% - 14px),7% 100%,0 calc(100% - 12px))',
  'polygon(0 0,100% 0,100% calc(100% - 13px),86% 100%,64% calc(100% - 14px),48% 100%,28% calc(100% - 12px),11% 100%,0 calc(100% - 15px))',
  'polygon(0 0,100% 0,100% calc(100% - 15px),82% 100%,62% calc(100% - 12px),44% 100%,24% calc(100% - 13px),8% 100%,0 calc(100% - 14px))',
  'none',
]

// ── Iconos ──
const Compass = ({ s = 17 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /><path d="M2 12h20" /></svg>)
const Back = ({ s = 16 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>)
const Close = ({ s = 14 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>)
const ListIcon = ({ s = 15 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>)
const MuralIcon = ({ s = 15 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>)

const NAV_ICONS = {
  lectura:    <g><path d="M12 7v14" /><path d="M3 18a1 1 0 01-1-1V4a1 1 0 011-1h5a4 4 0 014 4 4 4 0 014-4h5a1 1 0 011 1v13a1 1 0 01-1 1h-6a3 3 0 00-3 3 3 3 0 00-3-3z" /></g>,
  biblioteca: <g><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></g>,
  foro:       <path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />,
}

// escala el tablero fijo (700×860) para que entre en el área disponible
function useFitScale() {
  const ref = useRef(null)
  const [scale, setScale] = useState(0.45)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      setScale(Math.max(0.2, Math.min((w - 8) / BOARD_W, (h - 8) / BOARD_H, 1)))
    }
    fit()
    const ro = new ResizeObserver(fit); ro.observe(el)
    window.addEventListener('resize', fit)
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  }, [])
  return [ref, scale]
}

function Filters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="mesaGrain"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" stitchTiles="stitch" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.0" /></filter>
      <filter id="paperGrain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.1" /></filter>
      <filter id="washBleed"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.016" numOctaves="3" seed="7" result="t" />
        <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .8 0" result="a" />
        <feComponentTransfer in="a"><feFuncA type="discrete" tableValues="0 .5 .85 1" /></feComponentTransfer></filter>
    </svg>
  )
}

// ── Header (atrás opcional · título · Explorar) ──
function Header({ book, onBack, onExplore }) {
  return (
    <header className="cm-header">
      {onBack && <button type="button" className="cm-iconbtn" onClick={onBack} aria-label="Volver a la cartelera"><Back /></button>}
      <div className="cm-title">
        <h1>{book?.title || 'Cartelera'}</h1>
        <p>Investigación</p>
      </div>
      <button type="button" className="cm-iconbtn" onClick={onExplore} aria-label="Explorar"><Compass /></button>
    </header>
  )
}

// ── Gato-dock: salta a las otras 4 secciones ──
function CatDock({ currentKey, onJump }) {
  const [open, setOpen] = useState(false)
  const others = ORDER.filter(k => k !== currentKey).map(seccionMeta)
  return (
    <div className="cm-cat-dock">
      <button type="button" id="tutorial-m-catdock" className="cm-cat-btn" onClick={() => setOpen(o => !o)} aria-label="Otras categorías">
        <img className="cm-cat-img" src="/assets/cartelera/cat-sit.png" alt="Gato" />
      </button>
      {open && (
        <div className="cm-cat-tray">
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
function ExploreSheet({ onClose, onGoBack, onGoForo, onGoBiblioteca }) {
  const opts = [
    onGoBack && { key: 'lectura', label: 'Lectura', fn: onGoBack },
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

// ── Portada vertical ──
function Portada({ book, onOpen }) {
  return (
    <div className="pv-intro-stack" style={{ display: 'contents' }}>
      <div className="pv-intro"><span className="k">Cartelera · {book?.title || ''}</span></div>
      <div id="tutorial-m-paneles" className="pv-stack">
        {SECCIONES.map((sec, i) => {
          const light = shade(sec.color, 0.16), dark = shade(sec.color, -0.20)
          const blot1 = shade(sec.color, 0.10), blot2 = shade(sec.color, -0.12)
          const last = i === SECCIONES.length - 1
          const clip = TORN[i % TORN.length]
          return (
            <button key={sec.key} type="button" className="pv-panel"
              style={{ clipPath: clip, WebkitClipPath: clip, zIndex: 50 - i,
                filter: last ? 'none' : 'drop-shadow(0 4px 0 rgba(74,54,34,.22))', paddingBottom: last ? 0 : 22 }}
              onClick={() => onOpen(sec.key)}>
              <div className="pv-ink" style={{ background: `
                radial-gradient(60% 60% at 20% 18%, ${blot1}, transparent 60%),
                radial-gradient(55% 70% at 84% 74%, ${blot2}, transparent 62%),
                radial-gradient(44% 50% at 60% 40%, ${light}, transparent 60%),
                linear-gradient(150deg, ${light}, ${sec.color} 46%, ${dark})` }} />
              <div className="pv-wash" style={{ background: dark, filter: 'url(#washBleed)' }} />
              <div className="pv-grain" style={{ filter: 'url(#paperGrain)' }} />
              <div className="pv-vig" />
              <div className="pv-content">
                <span className="pv-initial">{sec.label[0]}</span>
                <div className="pv-text">
                  <div className="pv-word">{sec.label}</div>
                  <div className="pv-desc">{sec.sub}.</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Vista de sección: tablero (Mural) / lista / ficha ──
function SectionView({ sectionKey, data, onPortada, onJump, onExplore, initialItemId }) {
  const meta = seccionMeta(sectionKey)
  const [tab, setTab] = useState('mural')      // mural | lista | ficha
  const [selId, setSelId] = useState(null)
  const [boardRef, scale] = useFitScale()
  const isNotas = sectionKey === 'notas'
  const items = data.itemsBySeccion[sectionKey] || []
  const current = items.find(it => it.id === selId || it.allIds?.includes(selId)) || null
  const Tablero = TABLEROS[sectionKey]

  // al cambiar de sección reseteamos al Mural
  useEffect(() => { setTab('mural'); setSelId(null) }, [sectionKey])

  // salto directo a un item desde X-ray
  useEffect(() => {
    if (!initialItemId || items.length === 0) return
    if (items.find(it => it.id === initialItemId || it.allIds?.includes(initialItemId))) {
      setSelId(initialItemId)
      setTab('ficha')
    }
  }, [initialItemId, items])

  const openLista = () => { if (!isNotas) setTab('lista') }
  const pick = (id) => { setSelId(id); setTab('ficha') }

  return (
    <div className="cm-screen" style={{ '--sec': meta.color }}>
      <Header book={data.book} onBack={onPortada} onExplore={onExplore} />

      <div className="cm-subhead">
        <div className="cm-sec-name">
          <span className="cm-sec-swatch" style={{ background: meta.color }}>{meta.label[0]}</span>
          <h2>{meta.label}</h2>
        </div>
        {isNotas
          ? <span className="cm-sec-tag">Cartelera de investigación</span>
          : (
            <div id="tutorial-m-lista" className="cm-seg">
              <button type="button" className={clsx(tab === 'mural' && 'active')} onClick={() => setTab('mural')}><MuralIcon /> Mural</button>
              <button type="button" className={clsx(tab !== 'mural' && 'active')} onClick={openLista}><ListIcon /> Lista</button>
            </div>
          )}
      </div>

      {tab === 'mural' && (
        <div className="cm-board-area" ref={boardRef} onClick={isNotas ? undefined : openLista}>
          <div className="cart-canvas-box" style={{ width: BOARD_W * scale, height: BOARD_H * scale }}>
            {isNotas
              ? <TableroNotas pct={data.porcentaje} scale={scale} principal={data.principal} onOpenSection={onJump} />
              : <Tablero pct={data.porcentaje} scale={scale} imageUrl={data.principal[sectionKey]?.url}
                  videoUrl={data.principal[sectionKey]?.videoUrl} />}
          </div>
        </div>
      )}

      {tab === 'lista' && !isNotas && (
        <CarteleraMobileLista section={meta} items={items} onPick={pick} />
      )}

      {tab === 'ficha' && !isNotas && (
        <CarteleraMobileFicha section={meta} item={current} onBack={() => setTab('lista')} />
      )}

      <CatDock currentKey={sectionKey} onJump={onJump} />
    </div>
  )
}

export default function CarteleraMobile({ onGoBack, book, user, onGoForo, onGoBiblioteca, jumpToItemId, onJumpConsumed }) {
  const data = useCartelera(book?.libro_id || null, user?.id || null)
  // Lazy init: si viene con jumpToItemId (desde X-ray) arranca directo en el tablero,
  // evitando el render de la portada antes de que el efecto lo corrija.
  const [view, setView] = useState(() =>
    jumpToItemId ? { kind: 'board', key: 'personajes' } : { kind: 'portada', key: null }
  )
  const [explore, setExplore] = useState(false)
  const [fichaInitItemId, setFichaInitItemId] = useState(() => jumpToItemId || null)

  useEffect(() => {
    if (!jumpToItemId) return
    setFichaInitItemId(jumpToItemId)
    setView({ kind: 'board', key: 'personajes' })
    onJumpConsumed?.()
  }, [jumpToItemId])

  // Tour mobile — avanza las mismas fases que el desktop según la acción.
  const openSection = (k) => {
    if (k === 'personajes' && getTourPhase() === 'wait_personajes') setTourPhase('cart_personajes')
    if (k === 'notas' && getTourPhase() === 'wait_notas') setTourPhase('cart_notas')
    setView({ kind: 'board', key: k })
  }
  const goPortada = () => {
    if (getTourPhase() === 'wait_portada_2') setTourPhase('cart_portada_2')
    setView({ kind: 'portada', key: null })
  }

  // Lanza el popover correcto al entrar a cada vista del tour.
  useEffect(() => {
    const phase = getTourPhase()
    let t
    if (view.kind === 'portada') {
      if (phase === 'cart_portada_1') t = setTimeout(() => runGuidedCartPortada1Mobile(), 700)
      else if (phase === 'cart_portada_2') t = setTimeout(() => runGuidedCartPortada2Mobile(), 700)
    } else if (view.kind === 'board') {
      if (view.key === 'personajes' && phase === 'cart_personajes') t = setTimeout(() => runGuidedCartPersonajesMobile(), 700)
      else if (view.key === 'notas' && phase === 'cart_notas') t = setTimeout(() => runGuidedCartNotasMobile(), 700)
    }
    return () => clearTimeout(t)
  }, [view])

  const goForoTour = () => { if (getTourPhase() === 'wait_foro') setTourPhase('foro_1'); onGoForo() }
  const exploreProps = { onClose: () => setExplore(false), onGoBack, onGoForo: goForoTour, onGoBiblioteca }
  const dataWithBook = { ...data, book }

  return (
    <div className="cart-root cm-root">
      <Filters />
      {view.kind === 'portada' ? (
        <div className="cm-screen">
          <Header book={book} onBack={null} onExplore={() => setExplore(true)} />
          <Portada book={book} onOpen={openSection} />
        </div>
      ) : (
        <SectionView
          sectionKey={view.key}
          data={dataWithBook}
          onPortada={goPortada}
          onJump={openSection}
          onExplore={() => setExplore(true)}
          initialItemId={fichaInitItemId}
        />
      )}
      {explore && <ExploreSheet {...exploreProps} />}
    </div>
  )
}
