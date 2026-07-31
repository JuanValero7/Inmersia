// Pop-up de autenticación (login / registro / recuperación).
// Se muestra por encima de la página actual —landing, tienda, lector…— en
// lugar de navegar a una ruta /auth aparte. Reutiliza <AuthCard> (misma
// lógica y estilos "clay" del carnet) dentro de un backdrop oscurecido.
import { useEffect } from 'react'
import { AuthCard } from './Auth.jsx'
import '../styles/auth.css'

export default function AuthModal({ initialTab = 'login', onAuthSuccess, onClose }) {
  // Cerrar con Escape + bloquear el scroll del fondo mientras el pop-up está abierto.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <AuthCard initialTab={initialTab} onAuthSuccess={onAuthSuccess} onClose={onClose} />
      </div>
    </div>
  )
}
