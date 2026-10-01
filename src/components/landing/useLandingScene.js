// src/components/landing/useLandingScene.js
// ─────────────────────────────────────────────────────────────
// Rotación de los mundos del portal (Landing.jsx y LandingMobile.jsx).
// Manipula la clase `active` de los <img> de forma imperativa, sin estado
// React por cada cambio: un re-render no debe pisar la rotación en curso.
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react'

export function usePortal(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const worlds = Array.from(root.querySelectorAll('.inm-world'))
    if (worlds.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let i = 0
    const interval = setInterval(() => {
      worlds[i].classList.remove('active')
      i = (i + 1) % worlds.length
      worlds[i].classList.add('active')
    }, 5200)
    return () => clearInterval(interval)
  }, [rootRef])
}
