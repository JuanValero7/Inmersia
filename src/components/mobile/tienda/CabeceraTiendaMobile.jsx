import '../../../styles/tienda.mobile.css'

// =============================================================
// CabeceraTiendaMobile · la fila fija de arriba de la Tienda en el
// teléfono, igual en la principal, el catálogo y (fase 5) las salas:
// Atrás a la izquierda, el logo y un botón a la derecha.
//   etiquetaAtras · «Biblioteca», «Volver» (invitado) o «Tienda»
//   derecha       · la lupa, «Crear cuenta»…; sin nada, un hueco
//   buscador      · si viene, ocupa la fila entera (buscando)
// Estilos .tpm-cab* en styles/tienda.mobile.css.
// =============================================================

const LOGO = '/assets/inmersia-logo.png'

export const IconoAtras = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
)

export default function CabeceraTiendaMobile({ etiquetaAtras, onAtras, derecha, buscador }) {
  return (
    <header className="tpm-cab">
      <div className="tpm-cab-fila">
        {buscador || (
          <>
            <button type="button" className="tpm-pill" onClick={onAtras}><IconoAtras /> {etiquetaAtras}</button>
            <img className="tpm-logo" src={LOGO} alt="Inmersia" />
            {derecha || <span className="tpm-hueco" />}
          </>
        )}
      </div>
    </header>
  )
}
