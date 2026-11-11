// src/components/landing/colegios/Chips.jsx
// ─────────────────────────────────────────────────────────────
// Chips para cambiar de vista (juegos de una noche, pestañas) y la etiqueta
// del tipo de libro. Norma de la página: todo juego lleva su etiqueta,
// «Ficción» o «No ficción», para que se vea que cada tipo de libro tiene los suyos.
// `opciones` = [[clave, título, tipo?]] con tipo 'f' (ficción) o 'nf' (no ficción).
// ─────────────────────────────────────────────────────────────

export function Tipo({ tipo }) {
  if (!tipo) return null
  return <small className={tipo === 'f' ? 'lc-tag-f' : 'lc-tag-nf'}>{tipo === 'f' ? 'Ficción' : 'No ficción'}</small>
}

export default function Chips({ opciones, valor, onCambio, className = '' }) {
  return (
    <span className={`lc-pestanas ${className}`.trim()} role="tablist">
      {opciones.map(([k, t, tipo]) => (
        <button key={k} type="button" role="tab" aria-selected={valor === k} onClick={() => onCambio(k)}>
          {t}{tipo && <> <Tipo tipo={tipo} /></>}
        </button>
      ))}
    </span>
  )
}
