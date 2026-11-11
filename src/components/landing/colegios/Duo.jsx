// src/components/landing/colegios/Duo.jsx
// ─────────────────────────────────────────────────────────────
// Las dos columnas de cada noche: «Mateo, como hoy» y «Mateo, en Inmersia».
//
// Escritorio: lado a lado (el ancho de cada lado lo pone el CSS; en la noche 3
// lo deciden las clases lc-gana-malo / lc-gana-bueno).
// Móvil: un lado a la vez. Arriba, un interruptor fijo bajo la barra mientras
// dura la escena; también se cambia deslizando con el dedo o con el botón del
// final de cada lado. Si nadie lo toca, «En Inmersia» late para invitar.
//
// `ver` / `onVer` son opcionales: la noche 3 los controla desde fuera porque
// las notificaciones y el sonido dependen de qué lado se ve.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'

export default function Duo({
  mobile, className = '', malo, bueno, extraMalo = null, extraBueno = null,
  nombreBueno = 'Mateo, en Inmersia', ver: verFuera, onVer,
}) {
  const [verDentro, setVerDentro] = useState('malo')
  const ver = verFuera ?? verDentro
  const [pulso, setPulso] = useState(false)
  const cajaRef = useRef(null)
  const duoRef = useRef(null)
  const toque = useRef(null)

  const poner = (v, subir) => {
    if (onVer) onVer(v); else setVerDentro(v)
    if (v === 'bueno') setPulso(false)
    if (subir && cajaRef.current?.getBoundingClientRect().top < 0) cajaRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  // «En Inmersia» late cuando la escena ya está a la vista y nadie lo tocó.
  useEffect(() => {
    if (!mobile || !duoRef.current) return
    const io = new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { setPulso(true); obs.disconnect() } }, { threshold: 0.35 })
    io.observe(duoRef.current)
    return () => io.disconnect()
  }, [mobile])

  // Deslizar a la izquierda = Inmersia. No cuenta dentro de carruseles ni campos de texto.
  const alTocar = (e) => {
    toque.current = e.target.closest('.lc-m-carrusel, .lc-m-carrusel-in, textarea, input, .lc-md-cartas')
      ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const alSoltar = (e) => {
    const t = toque.current
    toque.current = null
    if (!t) return
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) poner(dx < 0 ? 'bueno' : 'malo', true)
  }

  const duo = (
    <div
      ref={duoRef}
      className={`lc-duo ${className} ${ver === 'bueno' ? 'lc-m-ver-bueno' : ''}`.trim()}
      {...(mobile ? { onTouchStart: alTocar, onTouchEnd: alSoltar } : {})}
    >
      <div className="lc-lado lc-lado-malo">
        <div className="lc-lado-tag"><span className="lc-quien">Mateo, como hoy</span>{extraMalo}</div>
        {malo}
        {mobile && <button type="button" className="lc-m-sig" onClick={() => poner('bueno', true)}>Ahora, Mateo en Inmersia →</button>}
      </div>
      <div className="lc-lado lc-lado-bueno">
        <div className="lc-lado-tag"><span className="lc-quien">{nombreBueno}</span>{extraBueno}</div>
        {bueno}
        {mobile && <button type="button" className="lc-m-ant" onClick={() => poner('malo', true)}>← Volver a Mateo, como hoy</button>}
      </div>
    </div>
  )
  if (!mobile) return duo

  return (
    <div className="lc-m-duo" ref={cajaRef}>
      <div className={`lc-m-seg ${pulso ? 'lc-m-pulso' : ''}`.trim()} role="tablist">
        {[['malo', 'Mateo, como hoy'], ['bueno', 'Mateo, en Inmersia']].map(([v, t]) => (
          <button key={v} type="button" role="tab" data-v={v} aria-selected={ver === v} onClick={() => poner(v, false)}>{t}</button>
        ))}
      </div>
      {duo}
    </div>
  )
}
