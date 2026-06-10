import { useState, useEffect, useCallback, useRef } from 'react'
import { BG, telonActual } from './tiendaHelpers.jsx'

// =============================================================
// CalleEscena · fachada con imágenes reales por hora del día
// 3 telones pintados (día / tarde / noche) con crossfade automático
// según la hora del usuario. Hotspot sobre la tienda central, zoom
// a la puerta y, si el acceso está bloqueado, aviso "Cerrado".
//
// RESPONSIVE: en pantallas chicas (≤640px) la escena se renderiza
// "encuadrada" sobre la tienda Inmersia (recorte de los locales
// vecinos para que no se vea estirada), con un botón a pantalla
// completa para entrar. En desktop se mantiene el "cover" original.
//
// Props:
//   pendientes  · nº de lecturas sin terminar (solo informativo)
//   limite      · tope de pendientes (default 5)
//   bloqueado   · true si pendientes >= limite → muestra "Cerrado"
//   onEntrar()  · se llama al terminar el zoom cuando NO está bloqueado
//   onGoBack()  · volver a la Biblioteca
// =============================================================

const IMG_W = 1024, IMG_H = 700
const DOOR = { x: 50.5, y: 85 }   // puerta — origen del zoom
const LOGO = { x: 55,   y: 37 }   // letrero sobre la cornisa de ladrillo

// Hook: ¿viewport mobile?
function useIsMobile(query = '(max-width: 640px)') {
  const [m, setM] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const h = e => setM(e.matches)
    mq.addEventListener ? mq.addEventListener('change', h) : mq.addListener(h)
    return () => mq.removeEventListener ? mq.removeEventListener('change', h) : mq.removeListener(h)
  }, [query])
  return m
}

export default function CalleEscena({ pendientes = 0, limite = 5, bloqueado = false, onEntrar, onGoBack }) {
  const mobile = useIsMobile()
  const [hovered, setHovered] = useState(false)
  const [opening, setOpening] = useState(false)
  const [zooming, setZooming] = useState(false)
  const [closed,  setClosed]  = useState(false)
  const [scale,   setScale]   = useState(1)

  const imgKey = telonActual()

  useEffect(() => {
    // "cover": el telón llena toda la pantalla (sin franjas negras). La escala
    // es uniforme, así que el cartel y la animación mantienen su alineación y
    // la imagen no se estira; solo se recorta algo de cielo/calle en los bordes.
    function fit() { setScale(Math.max(window.innerWidth / IMG_W, window.innerHeight / IMG_H)) }
    fit()
    let raf = 0
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit) }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  // timers de las transiciones; se limpian al desmontar para no llamar
  // setState/onEntrar sobre un componente ya desmontado.
  const timersRef = useRef([])
  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  const enter = useCallback(() => {
    if (opening || zooming) return
    setOpening(true)
    timersRef.current.push(setTimeout(() => setZooming(true), 260))
    timersRef.current.push(setTimeout(() => { if (bloqueado) setClosed(true); else onEntrar?.() }, 980))
  }, [opening, zooming, bloqueado, onEntrar])

  const back = useCallback(() => {
    setClosed(false)
    timersRef.current.push(setTimeout(() => { setZooming(false); setOpening(false) }, 440))
  }, [])

  const overlayUp = zooming || closed

  const backBtn = !overlayUp && (
    <button className="back-btn" type="button" onClick={onGoBack}
      style={{ position: 'fixed', top: 16, left: 16, zIndex: 600 }}>
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Biblioteca
    </button>
  )

  const cerrado = (zooming || closed) && (
    <div className={`closed ${closed ? 'show' : ''}`}>
      <div className="closed-card">
        <span className="closed-mark">✦</span>
        <h2 className="closed-title">Cerrado</h2>
        <p className="closed-text">Termina tus lecturas pendientes antes de adquirir nuevos mundos.</p>
        <button className="closed-btn" onClick={back}>Volver a la calle</button>
      </div>
    </div>
  )

  const pend = !overlayUp && (
    <p className="img-pend" style={{ color: bloqueado ? '#f0a08a' : '#cbe3c6' }}>
      Lecturas pendientes: <strong>{pendientes}</strong> / {limite}
    </p>
  )

  // ── MOBILE: escena encuadrada sobre Inmersia ───────────────────
  if (mobile) {
    return (
      <div className="img-root cm-root">
        {backBtn}
        <div className="cm-scene">
          <div className={`cm-zoomer ${zooming ? 'zoomin' : ''}`}>
            {/* Telones pintados (crossfade por hora), recortados a Inmersia */}
            {Object.entries(BG).map(([k, src]) => (
              <div key={k} className="cm-plate"
                style={{ backgroundImage: `url('${src}')`, opacity: imgKey === k ? 1 : 0 }} />
            ))}
            {/* Letrero Inmersia */}
            <div className="cm-sign">
              <div className="img-sign-board"><img src="/assets/inmersia-logo.png" alt="Inmersia" /></div>
            </div>
          </div>

          {/* Tap = todo el escaparate */}
          <button className="cm-tap" type="button" onClick={enter} aria-label="Entrar a la tienda" />
          {!opening && <span className="cm-hint">Tocá para entrar ✦</span>}

          <div className={`warmflash ${zooming ? 'on' : ''}`}
            style={{ background: 'radial-gradient(circle at 52% 72%, rgba(255,216,130,0.98), rgba(255,196,110,0) 52%)' }} />
        </div>
        {pend}
        {cerrado}
      </div>
    )
  }

  // ── DESKTOP: "cover" original ──────────────────────────────────
  return (
    <div className="img-root">
      {backBtn}

      <div className="img-fit" style={{ width: IMG_W * scale, height: IMG_H * scale }}>
        <div className="img-stage" style={{ transform: `scale(${scale})` }}>
          <div className={`img-zoomer ${zooming ? 'zoomin' : ''}`}
            style={{ transformOrigin: `${DOOR.x}% ${DOOR.y}%` }}>

            {/* Telones pintados (crossfade por hora) */}
            {Object.entries(BG).map(([k, src]) => (
              <img key={k} className="img-plate" src={src} alt="" draggable="false"
                style={{ opacity: imgKey === k ? 1 : 0 }} />
            ))}

            {/* Letrero Inmersia en la franja de ladrillo */}
            <div className="img-sign" style={{ left: `${LOGO.x}%`, top: `${LOGO.y}%` }}>
              <div className="img-sign-board">
                <img src="/assets/inmersia-logo.png" alt="Inmersia" />
              </div>
            </div>

            {/* Hotspot interactivo: columna de la tienda central */}
            <div
              className={`img-hotspot ${hovered ? 'hot' : ''}`}
              style={{ left: '46%', top: '3%', width: '22%', height: '90%' }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onClick={enter}
              role="button" tabIndex={0}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && enter()}
            >
              <span className="img-hotglow" />
            </div>

            {/* Pista "entrar" sobre la franja de ladrillo */}
            <span className={`img-hint ${hovered ? 'show' : ''}`}
              style={{ left: '55%', top: '64%' }}>entrar ✦</span>
          </div>

          <div className={`warmflash ${zooming ? 'on' : ''}`}
            style={{ background: `radial-gradient(circle at ${DOOR.x}% ${DOOR.y}%, rgba(255,216,130,0.98), rgba(255,196,110,0) 50%)` }} />
        </div>
      </div>

      {pend}
      {cerrado}
    </div>
  )
}
