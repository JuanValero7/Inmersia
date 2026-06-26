// Formato: Plain JavaScript (.jsx)
// Popup "Explorar" compartido entre Portada, BoardView y Ficha (desktop).
// Gestiona su propio estado open/close y el dismiss al hacer click fuera.
// La integración con el tour de Foro vive aquí.
import { useState, useEffect } from 'react'
import { getTourPhase, setTourPhase } from '../guidedTour.js'

const BTN_STYLE = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }
const LBL_STYLE = { fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }

function NavBtn({ onClick, icon, label }) {
  return (
    <button type="button" onClick={onClick} style={BTN_STYLE}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      <span style={LBL_STYLE}>{label}</span>
    </button>
  )
}

const ICON_FORO = <path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
const ICON_LECTURA = <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
const ICON_BIBLIOTECA = <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>

export default function ExplorarPopup({ onGoForo, onGoBack, onGoBiblioteca, btnClass = 'cart-sec-btn' }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!e.target.closest('.cart-explorar-popup')) close() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const handleGoForo = () => {
    if (getTourPhase() === 'wait_foro') setTourPhase('foro_1')
    close()
    onGoForo()
  }

  return (
    <div className="cart-explorar-popup" style={{ position: 'relative' }}>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60,
          background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 16,
          padding: '10px 14px', display: 'flex', gap: 20, alignItems: 'flex-end',
          boxShadow: '2px 4px 0 rgba(74,54,34,0.22), 0 14px 30px rgba(0,0,0,0.22)',
          whiteSpace: 'nowrap',
        }}>
          {onGoForo     && <NavBtn onClick={handleGoForo}            icon={ICON_FORO}       label="Foro" />}
          {onGoBack     && <NavBtn onClick={() => { close(); onGoBack() }}     icon={ICON_LECTURA}    label="Lectura" />}
          {onGoBiblioteca && <NavBtn onClick={() => { close(); onGoBiblioteca() }} icon={ICON_BIBLIOTECA} label="Biblioteca" />}
        </div>
      )}
      <button className={btnClass} type="button" onClick={() => setOpen(o => !o)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /><path d="M2 12h20" />
        </svg>
        Explorar
      </button>
    </div>
  )
}
