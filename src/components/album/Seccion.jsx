import Barajita from './Barajita.jsx'

// Una sección de barajitas (Personajes · Lugares · Capítulos).
// Header con contador "X de Y" y grilla con la primera casilla en grande (hero/video).
// `seccion`: key técnica (personajes/lugares/capitulos/infografias) para persistir el pegado.
export default function Seccion({ label, seccion, color, data, tight, onPegar }) {
  const { total = 0, unlocked = 0, items = [], extra = 0 } = data || {}
  // Siempre mostramos al menos una casilla (hero vacío) para dar el "por llenar".
  const slots = items.length ? items : [{ unlocked: false }]

  return (
    <div className="album-section">
      <div className="album-sechead">
        <span className="dot" style={{ background: color }} />
        <h3>{label}</h3>
        <span className="count">{unlocked} de {total}</span>
        <span className="bar" />
      </div>
      <div className={`album-gallery-grid${tight ? ' tight' : ''}`}>
        {slots.map((it, i) => (
          <Barajita key={i} item={it} color={color} idx={i}
            onPegar={(itemKey) => onPegar?.(seccion, itemKey)} />
        ))}
      </div>
      {extra > 0 && <p className="album-gallery-extra">+ {extra} más en tu colección</p>}
    </div>
  )
}
