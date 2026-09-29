// src/hooks/useIsMobile.js
// ─────────────────────────────────────────────────────────────
// Detecta dispositivo móvil por ANCHO de viewport (no user-agent).
// Reactivo: si el usuario rota el tablet o achica la ventana, la
// app cambia de modo sola. El corte por defecto es 820px:
//   ≤ 820px  → mobile   (teléfonos + tablet en vertical estrecho)
//   > 820px  → desktop  (PC y tablet apaisado)
// Ajusta BREAKPOINT si quieres otro límite.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'

const BREAKPOINT = 820

/**
 * ¿Estamos en un viewport móvil? Reactivo: si el usuario rota el tablet o achica la
 * ventana, la app cambia de modo sola.
 *
 * Es el ÚNICO corte del proyecto y decide qué árbol monta App.jsx. No definas otro
 * breakpoint en un componente suelto: hubo un bug así, con un useIsMobile local a
 * 640px, que entre 641 y 820px hacía que la app se creyera móvil y la Tienda se
 * creyera escritorio dentro de la misma pantalla.
 *
 * @param {number} [breakpoint]   ancho máximo considerado móvil, en px
 * @returns {boolean}
 */
export default function useIsMobile(breakpoint = BREAKPOINT) {
  const query = `(max-width: ${breakpoint}px)`
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    // sincroniza por si el query cambió entre el primer render y el efecto
    setIsMobile(mq.matches)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return isMobile
}
