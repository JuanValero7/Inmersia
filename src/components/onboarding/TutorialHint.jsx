// Pista del tutorial: tarjeta centrada con un mensaje y un botón que la cierra.
// Reutilizada en los distintos pasos (ej. la bienvenida de Investigación).
// El encabezado admite un emoji o, con `logo`, la marca de Inmersia.
export default function TutorialHint({ emoji = '🔎', logo = false, title, body, buttonLabel = 'Entendido', onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3200, background: 'rgba(20,12,4,0.72)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'relative', background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 20, padding: '32px 34px 26px', maxWidth: 400, width: '100%', textAlign: 'center',
          maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', boxShadow: '3px 6px 0 rgba(74,54,34,0.25), 0 20px 40px rgba(0,0,0,0.35)' }}>
        {logo
          ? <img src="/assets/inmersia-logo.png" alt="Inmersia" style={{ display: 'block', height: 40, width: 'auto', margin: '0 auto 14px' }} />
          : emoji && <div style={{ fontSize: 34, marginBottom: 10 }}>{emoji}</div>}
        {title && (
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, color: '#2c1a0e', margin: '0 0 10px', lineHeight: 1.25 }}>{title}</h2>
        )}
        <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 15, color: '#6b4c34', lineHeight: 1.55, margin: '0 0 24px' }}>{body}</p>
        <button type="button" onClick={onClose}
          style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 15, cursor: 'pointer', background: '#F2792A', color: '#fff', border: '2px solid #4a3622', borderRadius: 999, padding: '11px 28px', boxShadow: '2px 3px 0 rgba(74,54,34,0.4)' }}>
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
