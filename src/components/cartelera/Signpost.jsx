// Formato: Plain JavaScript (.jsx)
// Gato-dock (esquina inferior izquierda): al tocar el gato se abre una
// bandeja con las otras 4 secciones. Mismo patrón que CatDock en mobile.
import { SECCIONES } from './carteleraHelpers.js'
import { useState } from 'react'

export default function Signpost({ current, onOpenSection, secciones = SECCIONES, gatoColor = 'negro' }) {
  const [open, setOpen] = useState(false)
  const others = secciones.filter(s => s.key !== current).slice(0, 4)

  const handleClick = (key) => {
    setOpen(false)
    onOpenSection(key)
  }

  return (
    <div className="cart-signpost" aria-label="Ir a otra categoría">
      <button type="button" className="cart-sign-btn" onClick={() => setOpen(o => !o)} aria-label="Otras categorías">
        <img className="cart-sign-img" src={`/assets/cartelera/gato-${gatoColor}-2.webp`} alt="Gato" />
      </button>
      {open && (
        <div className="cart-sign-tray">
          {others.map(s => (
            <button key={s.key} type="button" className="cart-sign-tool" onClick={() => handleClick(s.key)}>
              <span className="cart-sign-tile" style={{ background: s.color }}>{s.label[0]}</span>
              <span className="cart-sign-lbl">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
