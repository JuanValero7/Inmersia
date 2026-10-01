// Pop-up de bienvenida del tutorial (paso 'bienvenida').
// Modal BLOQUEANTE a propósito: sus únicas salidas son las dos opciones. No
// tiene × ni cierre por backdrop, así el usuario nuevo elige por dónde empezar.
//   · "Empezar a leer"           → termina el tutorial y lo lleva al catálogo.
//   · "Muéstrame cómo funciona"  → abre el Manual del Explorador (el tour).

export default function WelcomePopup({ user, manualReady = true, onOpenManual, onStartReading }) {
  // Saludo neutro con el nombre que puso en el registro: "¡Hola, Ana!".
  const nombre = (user?.user_metadata?.nombre || '').trim()

  const boton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', boxSizing: 'border-box', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 15, border: '2px solid #4a3622', borderRadius: 999, padding: '12px 22px', cursor: 'pointer' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3200, background: 'rgba(20,12,4,0.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'relative', background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 20, padding: '38px 40px 30px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '3px 6px 0 rgba(74,54,34,0.25), 0 20px 40px rgba(0,0,0,0.35)' }}>
        <img src="/assets/inmersia-logo.png" alt="Inmersia" style={{ display: 'block', height: 44, width: 'auto', margin: '0 auto 20px' }} />
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 23, color: '#2c1a0e', margin: '0 0 12px', lineHeight: 1.25 }}>
          ¡Hola{nombre ? `, ${nombre}` : ''}!
        </h2>
        <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 15, color: '#6b4c34', lineHeight: 1.55, margin: '0 0 26px' }}>
          Gracias por elegirnos. ¿Por dónde quieres empezar?
        </p>
        <button type="button" onClick={onStartReading}
          style={{ ...boton, background: '#F2792A', color: '#fff', boxShadow: '2px 3px 0 rgba(74,54,34,0.4)' }}>
          Empezar a leer
        </button>
        <button type="button" onClick={onOpenManual} disabled={!manualReady}
          style={{ ...boton, marginTop: 12, background: '#fff', color: '#000', cursor: manualReady ? 'pointer' : 'default', opacity: manualReady ? 1 : 0.5, boxShadow: '2px 3px 0 rgba(74,54,34,0.25)' }}>
          Muéstrame cómo funciona
        </button>
      </div>
    </div>
  )
}
