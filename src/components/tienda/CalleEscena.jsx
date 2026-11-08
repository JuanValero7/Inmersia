import { useState, useEffect, useCallback, useRef } from 'react'
import { BG, telonActual } from './tiendaHelpers.jsx'
import useIsMobile from '../../hooks/useIsMobile.js'

// =============================================================
// CalleEscena · fachada con imágenes reales por hora del día
// 3 telones pintados (día / tarde / noche) con crossfade automático
// según la hora del usuario. Hotspot sobre la tienda central, zoom
// a la puerta y, si el acceso está bloqueado, aviso "Cerrado".
//
// RESPONSIVE: en pantallas chicas la escena se renderiza "encuadrada"
// sobre la tienda Inmersia (recorte de los locales vecinos para que no
// se vea estirada), con un botón a pantalla completa para entrar. En
// desktop se mantiene el "cover" original.
//
// El corte lo decide useIsMobile (820px), el mismo que usa App.jsx para
// elegir qué árbol monta. Antes este archivo tenía su propio hook con
// corte en 640px, así que entre 641 y 820px la app se creía móvil y esta
// escena se creía desktop dentro de la misma pantalla.
//
// EL LOCAL DE LA IZQUIERDA es la tienda de recompensas (migración 095):
// letrero «RECOMPENSAS» encima del que viene pintado. En escritorio tiene su
// propia zona para entrar; en el móvil se pasa de un local a otro con la
// flecha (el encuadre se desliza por la calle). Recompensas nunca está
// «Cerrado»: el límite de lecturas pendientes es solo para los libros.
//
// Props:
//   pendientes  · nº de lecturas sin terminar (solo informativo)
//   limite      · tope de pendientes (default 5)
//   bloqueado   · true si pendientes >= limite → muestra "Cerrado"
//   onEntrar()  · se llama al terminar el zoom cuando NO está bloqueado
//   onGoBack()  · volver a la Biblioteca
//   onRecompensas() · entrar a la tienda de recompensas (sin él, no hay local)
// =============================================================

const IMG_W = 1024, IMG_H = 700
const DOOR = { x: 50.5, y: 85 }   // puerta — origen del zoom
const LOGO = { x: 55,   y: 37 }   // letrero sobre la cornisa de ladrillo
// Local de la izquierda: letrero medido sobre el telón (tapa el pintado),
// su puerta (origen del zoom) y, en el móvil, el encuadre que lo centra.
const REC = { x: 26.4, y: 58.6, w: 23.5 }
const REC_DOOR = { x: 26, y: 86 }
const ENCUADRE = { inm: '53.5% 70%', rec: '17.4% 70%' }

export default function CalleEscena({ pendientes = 0, limite = 5, bloqueado = false, onEntrar, onGoBack, onRecompensas }) {
  const mobile = useIsMobile()
  const [hovered, setHovered] = useState(false)
  const [hoverRec, setHoverRec] = useState(false)
  const [lado, setLado] = useState('inm')      // móvil: qué local enfoca ('inm' | 'rec')
  const [destino, setDestino] = useState('inm') // a qué puerta va el zoom
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

  const enter = useCallback((a = 'inm') => {
    if (opening || zooming) return
    setDestino(a)
    setOpening(true)
    timersRef.current.push(setTimeout(() => setZooming(true), 260))
    timersRef.current.push(setTimeout(() => {
      if (a === 'rec') onRecompensas?.()
      else if (bloqueado) setClosed(true)
      else onEntrar?.()
    }, 980))
  }, [opening, zooming, bloqueado, onEntrar, onRecompensas])
  const conRec = !!onRecompensas
  const enfoque = conRec ? lado : 'inm'

  const back = useCallback(() => {
    setClosed(false)
    timersRef.current.push(setTimeout(() => { setZooming(false); setOpening(false) }, 440))
  }, [])

  const overlayUp = zooming || closed

  const backBtn = !overlayUp && (
    <div className="int-back-row" style={{ zIndex: 600 }}>
      <button className="int-back" type="button" onClick={onGoBack}>
        Biblioteca
      </button>
    </div>
  )

  const cerrado = (zooming || closed) && (
    <div className={`closed ${closed ? 'show' : ''}`}>
      <div className="closed-card">
        <span className="closed-mark">✦</span>
        <h2 className="closed-title">Cerrado</h2>
        <p className="closed-text">Termina tus lecturas pendientes antes de sumar libros nuevos.</p>
        <button className="closed-btn" onClick={back}>Volver a la calle</button>
      </div>
    </div>
  )

  const pend = !overlayUp && enfoque === 'inm' && (
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
            {/* Telones pintados (crossfade por hora), recortados al local enfocado */}
            {Object.entries(BG).map(([k, src]) => (
              <div key={k} className="cm-plate"
                style={{ backgroundImage: `url('${src}')`, opacity: imgKey === k ? 1 : 0, backgroundPosition: ENCUADRE[enfoque] }} />
            ))}
            {/* Letrero del local enfocado */}
            {enfoque === 'inm'
              ? <div className="cm-sign"><div className="img-sign-board"><img src="/assets/inmersia-logo.png" alt="Inmersia" /></div></div>
              : <span className="cm-sign-rec">RECOMPENSAS</span>}
          </div>

          {/* Tap = todo el escaparate */}
          <button className="cm-tap" type="button" onClick={() => enter(enfoque)}
            aria-label={enfoque === 'rec' ? 'Entrar a Recompensas' : 'Entrar a la tienda'} />
          {!opening && <button className="cm-hint" type="button" onClick={() => enter(enfoque)}>Toca para entrar ✦</button>}
          {conRec && !opening && (enfoque === 'inm'
            ? <button type="button" className="cm-pan izq" onClick={() => setLado('rec')}>‹ Recompensas</button>
            : <button type="button" className="cm-pan der" onClick={() => setLado('inm')}>Libros ›</button>)}

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
            style={{ transformOrigin: destino === 'rec' ? `${REC_DOOR.x}% ${REC_DOOR.y}%` : `${DOOR.x}% ${DOOR.y}%` }}>

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
              onClick={() => enter('inm')}
              role="button" tabIndex={0} aria-label="Entrar a la tienda"
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && enter('inm')}
            >
              <span className="img-hotglow" />
            </div>

            {/* Pista "entrar" sobre la franja de ladrillo */}
            <span className={`img-hint ${hovered ? 'show' : ''}`}
              style={{ left: '55%', top: '64%' }}>entrar ✦</span>

            {/* Local de la izquierda: Recompensas */}
            {conRec && <>
              <span className="img-sign-rec" style={{ left: `${REC.x}%`, top: `${REC.y}%`, width: `${REC.w + 1}%` }}>RECOMPENSAS</span>
              <div
                className={`img-hotspot ${hoverRec ? 'hot' : ''}`}
                style={{ left: '12%', top: '24%', width: '28%', height: '66%' }}
                onMouseEnter={() => setHoverRec(true)}
                onMouseLeave={() => setHoverRec(false)}
                onClick={() => enter('rec')}
                role="button" tabIndex={0} aria-label="Entrar a Recompensas"
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && enter('rec')}
              >
                <span className="img-hotglow" />
              </div>
              <span className={`img-hint ${hoverRec ? 'show' : ''}`}
                style={{ left: `${REC.x}%`, top: '70%' }}>Recompensas ✦</span>
            </>}
          </div>

          <div className={`warmflash ${zooming ? 'on' : ''}`}
            style={{ background: `radial-gradient(circle at ${destino === 'rec' ? `${REC_DOOR.x}% ${REC_DOOR.y}%` : `${DOOR.x}% ${DOOR.y}%`}, rgba(255,216,130,0.98), rgba(255,196,110,0) 50%)` }} />
        </div>
      </div>

      {pend}
      {cerrado}
    </div>
  )
}
