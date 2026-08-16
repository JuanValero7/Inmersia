// Pop-up de bienvenida del tutorial (paso 'bienvenida').
// Modal BLOQUEANTE a propósito: sus únicas salidas son "Abrir el Manual"
// (avanza el tutorial) o "Saltar tutorial". No tiene × ni cierre por backdrop,
// así el usuario nuevo no puede ir a ningún otro lado.
import { saludoBienvenida } from '../../lib/genero.js'

export default function WelcomePopup({ user, manualReady = true, onOpenManual, onSkip }) {
  const meta     = user?.user_metadata || {}
  const saludo   = saludoBienvenida(meta.genero)
  const nombre   = [meta.nombre, meta.apellido].filter(Boolean).join(' ').trim()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3200, background: 'rgba(20,12,4,0.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'relative', background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 20, padding: '38px 40px 30px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '3px 6px 0 rgba(74,54,34,0.25), 0 20px 40px rgba(0,0,0,0.35)' }}>
        <img src="/assets/inmersia-logo.png" alt="Inmersia" style={{ display: 'block', height: 44, width: 'auto', margin: '0 auto 20px' }} />
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 23, color: '#2c1a0e', margin: '0 0 12px', lineHeight: 1.25 }}>
          ¡{saludo}{nombre ? `, ${nombre}` : ''}!
        </h2>
        <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 15, color: '#6b4c34', lineHeight: 1.55, margin: '0 0 26px' }}>
          Gracias por elegirnos. Antes de que comience tu experiencia con nosotros,
          nos gustaría mostrarte brevemente cómo funciona todo. Por favor, abre el
          <strong> Manual del Explorador</strong>.
        </p>
        <button type="button" onClick={onOpenManual} disabled={!manualReady}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', boxSizing: 'border-box', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 15, cursor: manualReady ? 'pointer' : 'default', opacity: manualReady ? 1 : 0.5, background: '#F2792A', color: '#fff', border: '2px solid #4a3622', borderRadius: 999, padding: '12px 22px', boxShadow: '2px 3px 0 rgba(74,54,34,0.4)' }}>
          Abrir el Manual del Explorador
        </button>
        <button type="button" onClick={onSkip}
          style={{ marginTop: 14, background: 'transparent', border: 'none', color: '#9a6a4a', cursor: 'pointer', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 13, textDecoration: 'underline' }}>
          Saltar tutorial
        </button>
      </div>
    </div>
  )
}
