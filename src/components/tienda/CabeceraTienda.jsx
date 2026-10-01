import { useOpenAuth } from '../../context/authModal.jsx'
import '../../styles/tienda-principal.css'

// =============================================================
// CabeceraTienda · la barra de arriba de la Tienda en escritorio,
// igual en la tienda principal, el catálogo completo y las salas:
// el botón Atrás siempre en el mismo sitio (a la izquierda del logo).
//   etiquetaAtras · «Biblioteca», «Volver» (invitado) o «Tienda»
//   children      · lo que va en el centro (el buscador de la principal)
//   user          · sin sesión se añaden Iniciar sesión / Crear cuenta
// Estilos .tp-cab* en styles/tienda-principal.css.
// =============================================================

const LOGO = '/assets/inmersia-logo.png'

const IconoAtras = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
)

export default function CabeceraTienda({ etiquetaAtras, onAtras, user, children }) {
  const openAuth = useOpenAuth()
  return (
    <header className="tp-cab">
      <div className="tp-cab-in">
        <button type="button" className="tp-pill" onClick={onAtras}><IconoAtras /> {etiquetaAtras}</button>
        <img className="tp-logo" src={LOGO} alt="Inmersia" />
        {children || <span className="tp-cab-hueco" />}
        {!user && (
          <>
            <button type="button" className="tp-pill tp-pill-plana" onClick={() => openAuth('login')}>Iniciar sesión</button>
            <button type="button" className="tp-pill tp-pill-naranja" onClick={() => openAuth('registro')}>Crear cuenta</button>
          </>
        )}
      </div>
    </header>
  )
}
