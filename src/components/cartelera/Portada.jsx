// Formato: Plain JavaScript (.jsx)
// Portada de la Cartelera: 5 paneles acuarela que se abren al pasar el cursor;
// clic → abre esa sección.
import { useState } from 'react'
import clsx from 'clsx'
import { SECCIONES, shade as tint } from './carteleraHelpers.js'

const SECTIONS = SECCIONES.map(s => ({ ...s, initial: s.label[0] }))

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
        <div className="initial">{sec.initial}</div>
        <div className="reveal">
          <div className="word">{sec.label}</div>
          <div className="desc">{sec.desc}.</div>
          <div className="go">Explorar
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>
      <div className="stub">{sec.label}</div>
    </div>
  )
}

export default function Portada({ subtitle, onOpen, onGoBack, onGoForo }) {
  const [hover, setHover] = useState(null)
  return (
    <div className="cart-scene cart-portada">
      <div className="topbar">
        <div className="brand">
          <span className="brand-title">Cartelera</span>
          {subtitle && <span className="brand-sub">{subtitle}</span>}
        </div>
        <div className="actions">
          {onGoForo && <button className="back-btn" type="button" onClick={onGoForo}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Foro
          </button>}
          <button className="back-btn" type="button" onClick={onGoBack}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Lectura
          </button>
        </div>
      </div>
      <div className="board-wrap">
        <div className="cart-portada-board" onMouseLeave={() => setHover(null)}>
          {SECTIONS.map((sec, i) => (
            <Panel key={sec.key} sec={sec} idx={i}
              last={i === SECTIONS.length - 1}
              open={hover === sec.key} hoveredAny={hover !== null}
              onEnter={() => setHover(sec.key)} onOpen={onOpen} />
          ))}
          <div className="cart-portada-hint">Pasá el cursor sobre una sección para abrirla</div>
        </div>
      </div>
    </div>
  )
}
