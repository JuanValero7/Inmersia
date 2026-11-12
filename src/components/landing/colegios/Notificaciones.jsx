// src/components/landing/colegios/Notificaciones.jsx
// ─────────────────────────────────────────────────────────────
// Noche 3: cuando el visitante llega a «Mateo, como hoy», la página misma lo
// interrumpe con notificaciones falsas (en el centro en escritorio; en móvil
// bajan desde arriba, rectas, como en un celular). Al final, «Molesta, ¿verdad?».
// Se dispara una sola vez, cuando `activa` pasa a true.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { NOTIFICACIONES } from './colegiosData.js'

export default function Notificaciones({ activa }) {
  const [vistas, setVistas] = useState(0)
  const [corte, setCorte] = useState(false)
  const [terminada, setTerminada] = useState(false)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!activa) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const paso = reduce ? 250 : 650
    const t = NOTIFICACIONES.map((_, i) => setTimeout(() => setVistas(i + 1), 400 + i * paso))
    t.push(setTimeout(() => setCorte(true), 400 + NOTIFICACIONES.length * paso + 1200))
    return () => t.forEach(clearTimeout)
  }, [activa])

  useEffect(() => { if (corte) btnRef.current?.focus({ preventScroll: true }) }, [corte])

  // Mientras saltan las notificaciones la página no se mueve: si se pudiera
  // seguir bajando, el visitante se iría de la escena sin ver el «Molesta, ¿verdad?».
  const bloqueado = activa && !terminada
  useEffect(() => {
    if (!bloqueado) return
    const html = document.documentElement, antes = html.style.overflow
    html.style.overflow = 'hidden'
    return () => { html.style.overflow = antes }
  }, [bloqueado])

  const seguir = () => { setCorte(false); setVistas(0); setTerminada(true) }

  return (
    <>
      <div className="lc-notis" aria-live="polite">
        <div className="lc-notis-pila">
          {NOTIFICACIONES.slice(0, vistas).map(([app, txt, color, letra], i) => (
            <div
              key={i} className="lc-noti"
              style={{ top: `${(i % 5) * 62 + (i >= 5 ? 26 : 0)}px`, '--r': `${((i * 37) % 9) - 4}deg`, zIndex: i + 1 }}
            >
              <i style={{ background: color }}>{letra}</i><span><b>{app}</b>{txt}</span><em>ahora</em>
            </div>
          ))}
        </div>
      </div>
      {corte && (
        <div className="lc-corte">
          <div className="lc-corte-in">
            <h3>Molesta, ¿verdad?</h3>
            <p>Así compite el libro todas las noches. Usted lo sufrió unos segundos; sus alumnos, cada vez que abren el libro.</p>
            <button type="button" className="lc-btn" ref={btnRef} onClick={seguir}>Seguir</button>
          </div>
        </div>
      )}
    </>
  )
}
