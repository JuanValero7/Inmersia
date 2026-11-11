// src/components/landing/colegios/Contacto.jsx
// ─────────────────────────────────────────────────────────────
// «Quiero participar», arriba a la derecha en la barra (siempre visible).
// Abre una tarjeta con WhatsApp y correo (con «Copiar»). La tarjeta también
// la abre el botón del cierre (`abierta` vive en la página).
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { CONTACTO } from './colegiosData.js'
import { evento } from '../../../lib/analytics.js'

function Copiar({ valor, que }) {
  const [txt, setTxt] = useState('Copiar')
  const copiar = async () => {
    try { await navigator.clipboard.writeText(valor); setTxt('Copiado'); evento('colegios_contacto', { via: que, accion: 'copiar' }) }
    catch { setTxt('Selecciónelo') }
    setTimeout(() => setTxt('Copiar'), 1600)
  }
  return <button type="button" className="lc-copiar" onClick={copiar}>{txt}</button>
}

export default function Contacto({ abierta, setAbierta }) {
  const ref = useRef(null)

  // Un clic fuera la cierra.
  useEffect(() => {
    if (!abierta) return
    const fuera = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest('[data-abre-cta]')) setAbierta(false) }
    document.addEventListener('click', fuera)
    return () => document.removeEventListener('click', fuera)
  }, [abierta, setAbierta])

  return (
    <div className="lc-contacto" ref={ref}>
      <button type="button" className="lc-btn lc-btn-nav" data-abre-cta onClick={() => { setAbierta(!abierta); if (!abierta) evento('colegios_contacto', { via: 'barra', accion: 'abrir' }) }}>
        Quiero participar
      </button>
      {abierta && (
        <div className="lc-cta-pop">
          <b className="lc-pop-tit">Piloto gratis para un curso</b>
          <span className="lc-pop-sub">Hablemos 15 minutos.</span>
          <div className="lc-fila">
            <small>WhatsApp</small>
            <div className="lc-dato-c">
              <a href={CONTACTO.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => evento('colegios_contacto', { via: 'whatsapp', accion: 'abrir' })}>{CONTACTO.whatsappVisible}</a>
              <Copiar valor={CONTACTO.whatsapp} que="whatsapp" />
            </div>
          </div>
          <div className="lc-fila">
            <small>Correo</small>
            <div className="lc-dato-c">
              <a href={`mailto:${CONTACTO.correo}`} onClick={() => evento('colegios_contacto', { via: 'correo', accion: 'abrir' })}>{CONTACTO.correo}</a>
              <Copiar valor={CONTACTO.correo} que="correo" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
