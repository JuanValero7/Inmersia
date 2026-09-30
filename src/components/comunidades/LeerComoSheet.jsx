// Hoja "Leer como" (móvil): se abre desde el botón de Comunidades de la
// cabecera de la Biblioteca. Misma lista que el menú de escritorio
// (LeerComo) y, abajo, Invitación / Buscar / Crear, que llevan a la
// pantalla /comunidades (ComunidadesMobile), donde ya viven esos flujos.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useComunidadActiva, usePuedeCrearComunidadQuery, TOPE_COMUNIDADES } from '../../hooks/useComunidades.js'
import { LeerComo } from './ComunidadesMenu.jsx'
import '../../styles/comunidades.css'

export default function LeerComoSheet({ user, onClose, onVer, onIr }) {
  const { mias } = useComunidadActiva(user?.id)
  const { data: puedeCrear = false } = usePuedeCrearComunidadQuery(user?.id)
  const enTope = mias.length >= TOPE_COMUNIDADES

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  return createPortal(
    <div className="cp-wrap hoja">
      <div className="cp-dim" onClick={onClose} />
      <div className="cp-panel lcs" role="dialog" aria-label="Leer como">
        <span className="cp-grab" aria-hidden="true" />
        <div className="com-dd-head"><h3>Leer como</h3>{mias.length > 0 && <span>{mias.length} de {TOPE_COMUNIDADES}</span>}</div>
        <LeerComo user={user} onVer={(id) => { onClose(); onVer(id) }} onElegida={onClose} />
        <div className="com-dd-acciones">
          <div className="com-fila">
            <button type="button" className="com-btn" onClick={() => onIr('invitacion')}>Invitación</button>
            <button type="button" className="com-btn" onClick={() => onIr('buscar')}>Buscar</button>
          </div>
          {puedeCrear && (
            <button type="button" className="com-btn solid com-dd-crear" disabled={enTope} onClick={() => onIr('crear')}>
              Crear comunidad
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
