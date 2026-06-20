// Formato: Plain JavaScript (.jsx)
// Vista principal de la Cartelera. Orquesta: Portada → Tablero(sección) → Ficha.
// Lee todo de Supabase con useCartelera. Mantiene la firma original:
//   <CartelaView onGoBack book user onGoForo />
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

const VALID_SECCIONES = ['personajes', 'lugares', 'hechos', 'datos', 'notas', 'glosario', 'referencias', 'resumen']
import { useCartelera } from './cartelera/useCartelera.js'
import { seccionMeta, getSecciones } from './cartelera/carteleraHelpers.js'
import Portada from './cartelera/Portada.jsx'
import Signpost from './cartelera/Signpost.jsx'
import Ficha from './cartelera/Ficha.jsx'
import TableroPersonajes from './cartelera/TableroPersonajes.jsx'
import TableroLugares from './cartelera/TableroLugares.jsx'
import TableroHechos from './cartelera/TableroHechos.jsx'
import TableroDatos from './cartelera/TableroDatos.jsx'
import TableroNotas from './cartelera/TableroNotas.jsx'
import '../styles/cartelera.css'
import { runGuidedCartPersonajes, runGuidedCartNotas } from './tutorial.js'
import { getTourPhase, setTourPhase } from './guidedTour.js'

const TABLEROS_FICCION    = { personajes: TableroPersonajes, lugares: TableroLugares, hechos: TableroHechos, datos: TableroDatos }
const TABLEROS_NOFICCION  = { glosario: TableroPersonajes, datos: TableroLugares, referencias: TableroHechos, resumen: TableroDatos }
const BOARD_W = 700, BOARD_H = 860

function useFitScale(ref) {
  const [scale, setScale] = useState(0.6)
  useEffect(() => {
    let rafId = null
    const fit = () => {
      const el = ref.current; if (!el) return
      setScale(Math.max(0.25, Math.min(el.clientWidth / BOARD_W, el.clientHeight / BOARD_H) * 0.95))
    }
    const onResize = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(fit)
    }
    fit()
    const ro = new ResizeObserver(onResize)
    if (ref.current) ro.observe(ref.current)
    return () => { ro.disconnect(); if (rafId) cancelAnimationFrame(rafId) }
  }, [ref])
  return scale
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

function BoardView({ sectionKey, data, onPortada, onOpenList, onOpenSection, onGoBack, onGoForo, onGoBiblioteca, secciones, tableros, esNoficcion }) {
  const meta = seccionMeta(sectionKey)
  const stageRef = useRef(null)
  const scale = useFitScale(stageRef)
  const Tablero = tableros[sectionKey]
  const [explorarOpen, setExplorarOpen] = useState(false)

  useEffect(() => {
    if (!explorarOpen) return
    const h = (e) => { if (!e.target.closest('.cart-explorar-popup')) setExplorarOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [explorarOpen])

  useEffect(() => {
    const phase = getTourPhase()
    let t
    if (sectionKey === 'personajes' && phase === 'cart_personajes') {
      t = setTimeout(() => runGuidedCartPersonajes(), 700)
    } else if (sectionKey === 'notas' && phase === 'cart_notas') {
      t = setTimeout(() => runGuidedCartNotas(), 700)
    }
    return () => clearTimeout(t)
  }, [sectionKey])

  const handlePortada = () => {
    if (getTourPhase() === 'wait_portada_2') setTourPhase('cart_portada_2')
    onPortada()
  }

  return (
    <div className="cart-scene" style={{ '--sec': meta.color }}>
      <div className="bg-layer" />
      <Signpost current={sectionKey} onOpenSection={onOpenSection} secciones={secciones} />
      <div className="topbar">
        <div className="ttl"><h1>{meta.label}</h1><span className="sub">{meta.sub}</span></div>
        <div className="cart-sec-hint">Sigue leyendo para revelar una sorpresa</div>
        <div className="actions">
          <button id="tutorial-lista-btn" className="cart-sec-btn" type="button" onClick={() => onOpenList(sectionKey)}>Lista</button>
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
      <div className="stage" ref={stageRef}>
        <div className="cart-canvas-box" style={{ width: BOARD_W * scale, height: BOARD_H * scale }}>
          {sectionKey === 'notas'
            ? <TableroNotas pct={data.porcentaje} scale={scale} principal={data.principal}
                onOpenSection={onOpenSection} esNoficcion={esNoficcion} />
            : <Tablero pct={data.porcentaje} scale={scale} imageUrl={data.principal[sectionKey]?.url}
                videoUrl={data.principal[sectionKey]?.videoUrl}
                onOpenList={() => onOpenList(sectionKey)} />}
        </div>
      </div>
      <div className="dock">
        <div className="field">
          <label>Avance de lectura</label>
          <div className="dock-bar"><span style={{ width: `${data.porcentaje}%` }} /></div>
          <span className="count">{data.porcentaje}%</span>
        </div>
        <span className="hint">
          {sectionKey === 'notas'
            ? (() => {
                const shown = Math.round(Math.max(0, Math.min(100, data.porcentaje)) / 100 * 60)
                return shown > 0 ? `El corcho crece según tu lectura · ${shown}/60 notas` : 'El corcho crece y cada sección se actualiza según tu lectura'
              })()
            : (data.capituloActual > 0 ? `Se revela según tu lectura · cap. ${data.capituloActual}` : 'Se revela a medida que avanzás en la lectura')}
        </span>
      </div>
    </div>
  )
}

export default function CartelaView({ onGoBack, book, user, onGoForo, onGoBiblioteca, jumpToItemId, onJumpConsumed, isSuperuser = false }) {
  const esNoficcion = book?.es_ficcion === false
  const secciones  = getSecciones(esNoficcion)
  const tableros   = esNoficcion ? TABLEROS_NOFICCION : TABLEROS_FICCION
  const data = useCartelera(book?.libro_id || null, user?.id || null, isSuperuser)
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState(() => {
    const s = searchParams.get('seccion')
    return s && VALID_SECCIONES.includes(s) ? { kind: 'board', key: s } : { kind: 'portada', key: null }
  })
  const [fichaInitItemId, setFichaInitItemId] = useState(null)

  useEffect(() => {
    if (view.key) setSearchParams({ seccion: view.key }, { replace: true })
    else setSearchParams({}, { replace: true })
  }, [view.key, setSearchParams])

  useEffect(() => {
    if (!jumpToItemId) return
    setFichaInitItemId(jumpToItemId)
    setView({ kind: 'ficha', key: 'personajes' })
    onJumpConsumed?.()
  }, [jumpToItemId])

  const handlePortadaOpen = (k) => {
    if (k === 'personajes' && getTourPhase() === 'wait_personajes') setTourPhase('cart_personajes')
    setView({ kind: 'board', key: k })
  }

  let content
  if (view.kind === 'portada') {
    content = <Portada subtitle={book?.title} onOpen={handlePortadaOpen} secciones={secciones}
      onGoBack={onGoBack} onGoForo={onGoForo} onGoBiblioteca={onGoBiblioteca} />
  } else if (view.kind === 'ficha') {
    content = <Ficha section={seccionMeta(view.key)} items={data.itemsBySeccion[view.key] || []}
      initialItemId={fichaInitItemId}
      secciones={secciones}
      onBackTablero={() => setView({ kind: 'board', key: view.key })}
      onBackPortada={() => setView({ kind: 'portada', key: null })}
      onGoBack={onGoBack}
      onGoForo={onGoForo}
      onGoBiblioteca={onGoBiblioteca}
      onOpenList={(k) => setView({ kind: 'ficha', key: k })} />
  } else {
    content = <BoardView sectionKey={view.key} data={data} secciones={secciones} tableros={tableros} esNoficcion={esNoficcion}
      onPortada={() => setView({ kind: 'portada', key: null })}
      onOpenList={(k) => setView({ kind: 'ficha', key: k })}
      onOpenSection={(k) => setView({ kind: 'board', key: k })}
      onGoBack={onGoBack}
      onGoForo={onGoForo}
      onGoBiblioteca={onGoBiblioteca} />
  }

  return (
    <div className="cart-root">
      <Filters />
      {content}
    </div>
  )
}
