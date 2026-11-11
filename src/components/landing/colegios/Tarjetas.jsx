// src/components/landing/colegios/Tarjetas.jsx
// ─────────────────────────────────────────────────────────────
// Los bloques de texto debajo de cada escena («Cada escena suena», etc.).
// Escritorio: en fila (el contenedor ya es una grilla).
// Móvil: tarjetas que se deslizan de lado, con puntitos debajo.
// Con `interior` (dentro de una caja con relleno: la mesa del método Anderson,
// el espacio seguro) el carrusel móvil se ajusta a esa caja; en escritorio, sin
// `className` no se envuelve en nada (las tarjetas son celdas de la grilla de la caja).
// ─────────────────────────────────────────────────────────────
import { Children, useState } from 'react'

const GAP = 12

export default function Tarjetas({ mobile, className = '', interior = false, children }) {
  const [activa, setActiva] = useState(0)
  const n = Children.count(children)

  if (!mobile) return interior && !className ? children : <div className={className}>{children}</div>

  const alDeslizar = (e) => {
    const c = e.currentTarget, primera = c.children[0]
    if (!primera) return
    setActiva(Math.min(n - 1, Math.round(c.scrollLeft / (primera.getBoundingClientRect().width + GAP))))
  }
  return (
    <>
      <div className={interior ? 'lc-m-carrusel-in' : `${className} lc-m-carrusel`} onScroll={alDeslizar}>{children}</div>
      <div className="lc-m-puntos" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => <i key={i} className={i === activa ? 'lc-on' : undefined} />)}
      </div>
    </>
  )
}
