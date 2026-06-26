// Formato: Plain JavaScript (.jsx)
// Portada de la Cartelera: 5 paneles acuarela que se abren al pasar el cursor;
// clic → abre esa sección.
import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { SECCIONES, shade as tint } from './carteleraHelpers.js'
import { getTourPhase } from '../guidedTour.js'
import { runGuidedCartPortada1, runGuidedCartPortada2 } from '../tutorial.js'
import ExplorarPopup from './ExplorarPopup.jsx'

const BOLT = `polygon(
  0 0, 100% 0,
  calc(100% - 22px) 30%, calc(100% - 8px) 35%,
  calc(100% - 44px) 66%, calc(100% - 30px) 70%,
  calc(100% - 64px) 100%, 0 100%
)`

function Panel({ sec, open, hoveredAny, last, idx, onEnter, onOpen }) {
  const grow = open ? '40%' : (hoveredAny ? '13%' : '20%')
  const light = tint(sec.color, 0.16)
  const dark = tint(sec.color, -0.20)
  const blot1 = tint(sec.color, 0.10)
  const blot2 = tint(sec.color, -0.12)
  const clip = last ? 'none' : BOLT
  return (
    <div className={clsx('panel', open && 'is-open')}
      style={{
        flexBasis: grow, clipPath: clip, WebkitClipPath: clip, zIndex: 50 - idx,
        filter: last ? 'none' : 'drop-shadow(3px 0 0 rgba(74,54,34,.30))',
        paddingRight: last ? 34 : 84,
      }}
      onMouseEnter={onEnter}
      onClick={() => onOpen(sec.key)}>
      <div className="ink-fill" style={{
        background: `
          radial-gradient(60% 50% at 22% 16%, ${blot1}, transparent 60%),
          radial-gradient(55% 60% at 82% 70%, ${blot2}, transparent 62%),
          radial-gradient(40% 38% at 60% 36%, ${light}, transparent 60%),
          linear-gradient(160deg, ${light}, ${sec.color} 46%, ${dark})` }} />
      <div className="wash" style={{ background: dark, filter: 'url(#washBleed)', opacity: .5 }} />
      <div className="grain" style={{ filter: 'url(#paperGrain)' }} />
      <div className="vignette" />
      <div className="content">
        <div className="initial" style={idx > 0 ? { marginLeft: 32 } : undefined}>{sec.initial}</div>
        <div className="reveal">
          <div className="word">{sec.label}</div>
          <div className="desc">{sec.sub}.</div>
          <div className="go">Explorar
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>
      <div className="stub">{sec.sub}</div>
    </div>
  )
}

export default function Portada({ subtitle, onOpen, onGoBack, onGoForo, onGoBiblioteca, secciones = SECCIONES }) {
  const SECTIONS = useMemo(() => secciones.map(s => ({ ...s, initial: s.label[0] })), [secciones])
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const phase = getTourPhase()
    let t
    if (phase === 'cart_portada_1') {
      t = setTimeout(() => runGuidedCartPortada1(), 700)
    } else if (phase === 'cart_portada_2') {
      t = setTimeout(() => runGuidedCartPortada2(), 700)
    }
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="cart-scene cart-portada">
      <div className="topbar" style={{ zIndex: 61 }}>
        <div className="cart-portada-tag">
          <span className="cpt-label">Investigación</span>
          {subtitle && <><span className="cpt-sep">·</span><span className="cpt-book">{subtitle}</span></>}
        </div>
        <div className="cart-portada-hint">Elige una sección para investigar</div>
        <div className="actions">
          <ExplorarPopup onGoForo={onGoForo} onGoBack={onGoBack} onGoBiblioteca={onGoBiblioteca} btnClass="back-btn" />
        </div>
      </div>
      <div className="board-wrap">
        <div id="tutorial-portada-paneles" className="cart-portada-board" onMouseLeave={() => setHover(null)}>
          {SECTIONS.map((sec, i) => (
            <Panel key={sec.key} sec={sec} idx={i}
              last={i === SECTIONS.length - 1}
              open={hover === sec.key} hoveredAny={hover !== null}
              onEnter={() => setHover(sec.key)} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  )
}
