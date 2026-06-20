// Formato: Plain JavaScript (.jsx)
// Letrero (esquina inferior izquierda): salta a las otras 4 secciones.
import { SECCIONES } from './carteleraHelpers.js'
import { getTourPhase, setTourPhase } from '../guidedTour.js'

const YS = [8.6, 25.8, 44.5, 64.5] // posición vertical de cada cartel (% de la imagen)

export default function Signpost({ current, onOpenSection, secciones = SECCIONES }) {
  const others = secciones.filter(s => s.key !== current).slice(0, 4)

  const handleClick = (key) => {
    if (key === 'notas' && getTourPhase() === 'wait_notas') setTourPhase('cart_notas')
    onOpenSection(key)
  }

  return (
    <div className="cart-signpost" aria-label="Ir a otra categoría">
      {others.map((s, i) => (
        <button key={s.key} type="button" className="cart-signlink"
          style={{ left: '48%', top: `${YS[i]}%` }}
          onClick={() => handleClick(s.key)}>{s.label}</button>
      ))}
    </div>
  )
}
