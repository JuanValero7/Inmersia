// src/components/landing/colegios/useEscenas.js
// ─────────────────────────────────────────────────────────────
// Lo que depende del scroll en la landing para colegios:
//   · useEscena: qué escena está justo debajo de la barra (el reloj de arriba
//     y si la página va «de noche»). Cada <section> lleva data-dia, data-hora,
//     data-sol y, si no es un día, data-titulo.
//   · useEnFranja: avisa una vez cuando un elemento entra en una franja de la
//     pantalla (dispara las notificaciones de la noche 3 y el concurso).
// Se lee el DOM de forma imperativa, como usePortal en la landing de lectores:
// un re-render por cada píxel de scroll no aporta nada.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'

const leerEscena = (el) => ({
  titulo: el.dataset.titulo || `Día ${el.dataset.dia}`,
  hora: el.dataset.hora,
  sol: el.dataset.sol === '1',
})

export function useEscena(rootRef) {
  const [escena, setEscena] = useState({ titulo: 'Antes de empezar', hora: 'el bimestre', sol: true })
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const escenas = [...root.querySelectorAll('[data-dia]')]
    const nav = root.querySelector('.lc-nav')
    let actual = null
    const mover = () => {
      const linea = nav.getBoundingClientRect().bottom + 24 // un poco más abajo que el margen de los saltos (12 px)
      const el = escenas.find((s) => { const r = s.getBoundingClientRect(); return r.top <= linea && r.bottom > linea }) || escenas[0]
      if (el !== actual) { actual = el; setEscena(leerEscena(el)) }
    }
    mover()
    window.addEventListener('scroll', mover, { passive: true })
    window.addEventListener('resize', mover)
    return () => { window.removeEventListener('scroll', mover); window.removeEventListener('resize', mover) }
  }, [rootRef])
  return escena
}

// Llama a `alEntrar` una sola vez cuando `ref` entra en la franja vertical
// [arriba, abajo] de la pantalla (en fracciones del alto). Un elemento oculto
// (display: none, p. ej. el lado que no se ve en móvil) no cuenta.
export function useEnFranja(ref, alEntrar, { arriba, abajo, activo = true }) {
  const cb = useRef(alEntrar)
  cb.current = alEntrar
  useEffect(() => {
    const el = ref.current
    if (!el || !activo) return
    const io = new IntersectionObserver(([e], obs) => {
      if (e.isIntersecting) { obs.disconnect(); cb.current() }
    }, { rootMargin: `-${arriba * 100}% 0px -${(1 - abajo) * 100}% 0px` })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, arriba, abajo, activo])
}
