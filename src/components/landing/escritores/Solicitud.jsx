// src/components/landing/escritores/Solicitud.jsx
// ─────────────────────────────────────────────────────────────
// Pop-up «Quiero ser escritor» de la landing de escritores.
// Alta directa (Juan, 14 nov 2026; migración 123): sin código ni espera.
//   · Con sesión: hacerme_escritor() activa el modo escritor (0 $) y va a
//     /escritor. Allí un cartel le pide escribirnos para el cupón de bienvenida.
//   · Sin sesión: se apunta en escritorPendiente y se abre el registro (o el
//     inicio de sesión); al entrar, App.jsx hace el alta y lo lleva al estudio.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { evento } from '../../../lib/analytics.js'
import { guardarEscritorPendiente } from '../../../lib/escritorPendiente.js'
import { useHacermeEscritor } from '../../../hooks/useEscritor.js'
import { gatoSrc } from '../landingData.js'

export default function Solicitud({ user, openAuth, onCerrar }) {
  const navigate = useNavigate()
  const alta = useHacermeEscritor(user?.id)
  const [error, setError] = useState('')

  const abrirEstudio = async () => {
    setError('')
    try {
      await alta.mutateAsync()
      evento('escritores_alta', {})
      navigate('/escritor')
    } catch {
      setError('No se pudo abrir tu estudio. Prueba otra vez.')
    }
  }
  const entrar = (tab) => {
    guardarEscritorPendiente()
    onCerrar()
    openAuth?.(tab)
  }

  return (
    <div className="le-sol" onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="le-sol-caja" role="dialog" aria-modal="true" aria-labelledby="le-sol-t">
        <button type="button" className="le-sol-x" onClick={onCerrar} aria-label="Cerrar">×</button>
        <img className="le-sol-gato" src={gatoSrc('blanco', 2)} alt="Mancha" />
        <h2 id="le-sol-t">Quiero ser escritor</h2>
        {user ? (<>
          <p>Abrimos tu estudio con tu cuenta de Inmersia. Desde ahí subes tu libro y empiezas.</p>
          <p className="le-sol-error" role="alert">{error}</p>
          <button type="button" className="le-pill le-naranja" disabled={alta.isPending} onClick={abrirEstudio}>
            {alta.isPending ? 'Abriendo…' : 'Abrir mi estudio'}
          </button>
        </>) : (<>
          <p>Crea tu cuenta de Inmersia, o entra con la que ya tienes, y te llevamos directo a tu estudio.</p>
          <div className="le-sol-botones">
            <button type="button" className="le-pill le-naranja" onClick={() => entrar('registro')}>Crear mi cuenta</button>
            <button type="button" className="le-pill le-plana" onClick={() => entrar('login')}>Ya tengo cuenta</button>
          </div>
        </>)}
      </div>
    </div>
  )
}
