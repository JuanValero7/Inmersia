// Formato: Plain JavaScript (.jsx)
// Vista principal de la Cartelera. Orquesta: Portada → Tablero(sección) → Ficha.
// Lee todo de Supabase con useCartelera. Mantiene la firma original:
//   <CartelaView onGoBack book user onGoForo />
import { useState, useEffect, useRef } from 'react'
import { useCartelera } from './cartelera/useCartelera.js'
import { seccionMeta } from './cartelera/carteleraHelpers.js'
import Portada from './cartelera/Portada.jsx'
import Signpost from './cartelera/Signpost.jsx'
import Ficha from './cartelera/Ficha.jsx'
import TableroPersonajes from './cartelera/TableroPersonajes.jsx'
import TableroLugares from './cartelera/TableroLugares.jsx'
import TableroHechos from './cartelera/TableroHechos.jsx'
import TableroDatos from './cartelera/TableroDatos.jsx'
import TableroNotas from './cartelera/TableroNotas.jsx'
import '../styles/cartelera.css'

const TABLEROS = { personajes: TableroPersonajes, lugares: TableroLugares, hechos: TableroHechos, datos: TableroDatos }
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

function BoardView({ sectionKey, data, onPortada, onOpenList, onOpenSection }) {
  const meta = seccionMeta(sectionKey)
  const stageRef = useRef(null)
  const scale = useFitScale(stageRef)
  const Tablero = TABLEROS[sectionKey]

  return (
    <div className="cart-scene" style={{ '--sec': meta.color }}>
      <div className="bg-layer" />
      <Signpost current={sectionKey} onOpenSection={onOpenSection} />
      <div className="topbar">
        <div className="ttl"><h1>{meta.label}</h1><span className="sub">{meta.sub}</span></div>
        <div className="actions">
          <button className="btn ghost" type="button" onClick={onPortada}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Cartelera
          </button>
        </div>
      </div>
      <div className="stage" ref={stageRef}>
        <div className="cart-canvas-box" style={{ width: BOARD_W * scale, height: BOARD_H * scale }}>
          {sectionKey === 'notas'
            ? <TableroNotas pct={data.porcentaje} scale={scale} principal={data.principal}
                onOpenSection={onOpenSection} />
            : <Tablero pct={data.porcentaje} scale={scale} imageUrl={data.principal[sectionKey]?.url}
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

export default function CartelaView({ onGoBack, book, user, onGoForo }) {
  const data = useCartelera(book?.libro_id || null, user?.id || null)
  const [view, setView] = useState({ kind: 'portada', key: null })

  let content
  if (view.kind === 'portada') {
    content = <Portada subtitle={book?.title} onOpen={(k) => setView({ kind: 'board', key: k })}
      onGoBack={onGoBack} onGoForo={onGoForo} />
  } else if (view.kind === 'ficha') {
    content = <Ficha section={seccionMeta(view.key)} items={data.itemsBySeccion[view.key] || []}
      onBackTablero={() => setView({ kind: 'board', key: view.key })}
      onBackPortada={() => setView({ kind: 'portada', key: null })} />
  } else {
    content = <BoardView sectionKey={view.key} data={data}
      onPortada={() => setView({ kind: 'portada', key: null })}
      onOpenList={(k) => setView({ kind: 'ficha', key: k })}
      onOpenSection={(k) => setView({ kind: 'board', key: k })} />
  }

  return (
    <div className="cart-root">
      <Filters />
      {content}
    </div>
  )
}
