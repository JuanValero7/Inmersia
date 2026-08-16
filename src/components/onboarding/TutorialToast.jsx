// Pista NO invasiva del tutorial: barrita flotante abajo-centro, sin backdrop.
// A diferencia de <TutorialHint>, no bloquea nada: el envoltorio no recibe
// clicks (pointer-events: none) para que el usuario siga explorando la pantalla
// que hay detrás. Se descarta con la × o desde afuera (el que la renderiza la
// oculta cuando el usuario ya hizo lo que la pista pedía).
export default function TutorialToast({ text, onClose }) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 22, zIndex: 3100, display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none' }}>
      <div style={{
        pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12,
        background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 999,
        padding: '10px 12px 10px 18px', maxWidth: 420,
        boxShadow: '2px 4px 0 rgba(74,54,34,0.28), 0 14px 30px rgba(0,0,0,0.25)',
      }}>
        <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 14.5, color: '#4a3622', lineHeight: 1.3 }}>
          {text}
        </span>
        {onClose && (
          <button type="button" onClick={onClose} title="Entendido" aria-label="Cerrar pista"
            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, cursor: 'pointer', background: '#F2792A', color: '#fff', border: '2px solid #4a3622', padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
