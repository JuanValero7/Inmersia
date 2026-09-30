// Denunciar una comunidad: el formulario (motivo + detalle opcional) y su
// versión en ventanita, para el ⋯ del buscador. En el panel "Ver
// comunidad" el formulario va como una subvista más.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MOTIVOS_COMUNIDAD, denunciarComunidad } from '../../hooks/useDenuncias.js'
import '../../styles/comunidades.css'

export function FormDenunciaComunidad({ user, c, onCancelar, onListo, conTitulo = false }) {
  const [motivo, setMotivo] = useState(null)
  const [detalle, setDetalle] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [hecho, setHecho] = useState(false)

  const enviar = async () => {
    if (!motivo || enviando) return
    setEnviando(true); setError(null)
    const err = await denunciarComunidad(user.id, c.id, motivo, detalle)
    setEnviando(false)
    if (err) setError(err)
    else setHecho(true)
  }

  if (hecho) return (
    <div className="dn-form">
      <p className="dn-gracias" role="status">Gracias. Lo vamos a revisar.</p>
      <div className="dn-pie"><button type="button" className="com-btn sm" onClick={onListo}>Cerrar</button></div>
    </div>
  )

  return (
    <div className="dn-form">
      {conTitulo && <h3 className="dn-titulo">Denunciar «{c.nombre}»</h3>}
      <p className="dn-lead">Lo revisa el equipo de Inmersia. Su moderador no sabrá que fuiste tú.</p>
      <div className="dn-motivos" role="radiogroup" aria-label="Motivo">
        {MOTIVOS_COMUNIDAD.map(m => (
          <button key={m} type="button" role="radio" aria-checked={motivo === m}
            className="dn-motivo" onClick={() => setMotivo(m)}>
            <i aria-hidden="true" />{m}
          </button>
        ))}
      </div>
      <textarea id="dn-detalle" className="dn-detalle" maxLength={300} value={detalle}
        placeholder="Cuéntanos algo más (opcional)" onChange={(e) => setDetalle(e.target.value)} />
      {error && <p className="com-error" role="alert">{error}</p>}
      <div className="dn-pie">
        <button type="button" className="com-btn sm" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="com-btn sm dn-rojo" disabled={!motivo || enviando} onClick={enviar}>
          {enviando ? 'Enviando…' : 'Denunciar'}
        </button>
      </div>
    </div>
  )
}

export function ModalDenunciaComunidad({ user, c, onClose }) {
  return createPortal(
    <div className="dn-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dn-caja" role="dialog" aria-label={`Denunciar ${c.nombre}`}>
        <FormDenunciaComunidad user={user} c={c} conTitulo onCancelar={onClose} onListo={onClose} />
      </div>
    </div>,
    document.body,
  )
}

// El ⋯ de una fila del buscador con su única opción.
export function MasDenunciar({ onDenunciar }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <span className="dn-mas-wrap">
      <button type="button" className="dn-mas" aria-label="Más opciones" aria-expanded={abierto}
        onClick={(e) => { e.stopPropagation(); setAbierto(v => !v) }}>⋯</button>
      {abierto && (
        <span className="dn-pop">
          <button type="button" onClick={(e) => { e.stopPropagation(); setAbierto(false); onDenunciar() }}>Denunciar comunidad</button>
        </span>
      )}
    </span>
  )
}
