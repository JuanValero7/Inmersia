// Cartel del tutorial: pista GRANDE pero NO invasiva. Barrita ancha abajo-centro,
// con título y cuerpo, sin backdrop. Reemplaza al viejo <TutorialToast> (una sola
// línea, se perdía de vista) allí donde la pista es la instrucción principal:
// "la próxima parada está en Hechos", "vuelve a la Biblioteca".
//
// El envoltorio no recibe clicks (pointer-events: none) para que el usuario siga
// explorando la pantalla que hay detrás. Sin `onClose` no hay × y el cartel no se
// puede descartar: lo oculta quien lo renderiza, cuando el usuario ya hizo lo que
// la pista pedía. Ese es el modo que usa la Cartelera durante el tutorial.
// `inline`: en vez de flotar sobre la pantalla, el cartel se mete EN el flujo y
// empuja el contenido. Es lo que usa la Cartelera en móvil: flotando abajo se
// sentaba encima del gato —que ahí es la única forma de cambiar de sección— y,
// como el cartel del tutorial no se puede descartar, dejaba al usuario sin
// manera de llegar a Hechos. Subirlo tampoco servía: la bandeja del gato se
// abre hacia arriba y volvía a chocar.
export default function TutorialCartel({ emoji = '🔎', title, body, onClose, inline = false }) {
  const tarjeta = (
      <div style={{
        pointerEvents: 'auto', position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 14,
        background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 20,
        padding: onClose ? '16px 46px 16px 20px' : '16px 20px',
        maxWidth: inline ? 'none' : 520, width: '100%',
        margin: inline ? '0 0 10px' : 0, boxSizing: 'border-box',
        boxShadow: inline
          ? '2px 3px 0 rgba(74,54,34,0.22)'
          : '3px 5px 0 rgba(74,54,34,0.28), 0 18px 36px rgba(0,0,0,0.28)',
      }}>
        {emoji && <span style={{ fontSize: 26, lineHeight: 1.1, flexShrink: 0 }}>{emoji}</span>}
        <div style={{ minWidth: 0 }}>
          {title && (
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#2c1a0e', margin: '0 0 4px', lineHeight: 1.25 }}>{title}</p>
          )}
          <p style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 600, fontSize: 15, color: '#6b4c34', margin: 0, lineHeight: 1.45 }}>{body}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} title="Entendido" aria-label="Cerrar pista"
            style={{ position: 'absolute', top: 12, right: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, cursor: 'pointer', background: '#F2792A', color: '#fff', border: '2px solid #4a3622', padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
  )

  if (inline) return tarjeta
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 24, zIndex: 3100, display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none' }}>
      {tarjeta}
    </div>
  )
}
