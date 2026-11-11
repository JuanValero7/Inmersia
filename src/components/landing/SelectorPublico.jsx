// src/components/landing/SelectorPublico.jsx
// ─────────────────────────────────────────────────────────────
// «¿Cómo vas a usar Inmersia?»: cada gato es un público (PUBLICOS en
// landingData.js). Lo usan la landing de lectores y la de colegios; cada una
// marca el suyo (`actual`) y decide qué pasa al tocar (`onElegir`). `aviso`
// es una línea opcional debajo (p. ej. «el rincón de los escritores llega pronto»).
// ─────────────────────────────────────────────────────────────
import { PUBLICOS, gatoSrc } from './landingData.js'
import '../../styles/selector-publico.css'

export default function SelectorPublico({ actual, onElegir, mobile = false, aviso = null, className = '' }) {
  return (
    <div className={`pub ${mobile ? 'pub-movil' : ''} ${className}`.replace(/\s+/g, ' ').trim()} role="group" aria-label="¿Cómo vas a usar Inmersia?">
      <span className="pub-l">¿Cómo vas a usar Inmersia?</span>
      <div className="pub-opts">
        {PUBLICOS.map((p) => (
          <button key={p.id} type="button" className={`pub-pick pub-${p.id}`} aria-pressed={p.id === actual} onClick={() => onElegir(p)}>
            <span className="pub-cara"><img src={gatoSrc(p.color, 7)} alt="" /></span>
            <span className="pub-nombre">{p.para}</span>
            {p.pronto && <span className="pub-pronto">Pronto</span>}
          </button>
        ))}
      </div>
      {aviso && <span className="pub-aviso" aria-live="polite">{aviso}</span>}
    </div>
  )
}
