// src/components/landing/escritores/Solicitud.jsx
// ─────────────────────────────────────────────────────────────
// Pop-up «Quiero ser escritor» de la landing de escritores: nombre y correo.
// Guarda la solicitud con solicitar_escritor() (migración 120). Por ahora no
// se manda ningún correo: Juan las ve con `npm run escritor` y desde ahí crea
// la cuenta y activa el modo escritor.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { evento } from '../../../lib/analytics.js'
import { gatoSrc } from '../landingData.js'

const CORREO_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function Solicitud({ user, onCerrar }) {
  const [nombre, setNombre] = useState(user?.user_metadata?.nombre ?? '')
  const [correo, setCorreo] = useState(user?.email ?? '')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const nombreRef = useRef(null)

  useEffect(() => { nombreRef.current?.focus() }, [])

  const enviar = async (e) => {
    e.preventDefault()
    const n = nombre.trim(), c = correo.trim()
    if (!n) { setError('Falta tu nombre.'); return }
    if (!CORREO_OK.test(c)) { setError('Revisa tu correo.'); return }
    setError(''); setEnviando(true)
    const { error: err } = await supabase.rpc('solicitar_escritor', { p_nombre: n, p_correo: c })
    setEnviando(false)
    if (err) {
      setError(err.message?.includes('demasiadas') ? 'Hay muchas solicitudes ahora mismo. Prueba en un rato.' : 'No se pudo enviar. Prueba otra vez.')
      return
    }
    evento('escritores_solicitud', {})
    setHecho(true)
  }

  return (
    <div className="le-sol" onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="le-sol-caja" role="dialog" aria-modal="true" aria-labelledby="le-sol-t">
        <button type="button" className="le-sol-x" onClick={onCerrar} aria-label="Cerrar">×</button>
        <img className="le-sol-gato" src={gatoSrc('blanco', 2)} alt="Mancha" />
        {hecho ? (<>
          <h2 id="le-sol-t">¡Listo!</h2>
          <p>Te escribimos a tu correo cuando tu cuenta de escritor esté lista.</p>
          <button type="button" className="le-pill" onClick={onCerrar}>Seguir viendo</button>
        </>) : (
          <form onSubmit={enviar} noValidate>
            <h2 id="le-sol-t">Quiero ser escritor</h2>
            <p>Déjanos tu nombre y tu correo. Te creamos la cuenta de escritor y te escribimos para que empieces.</p>
            <label>Tu nombre<input ref={nombreRef} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" maxLength={120} placeholder="Como firmas tus libros" /></label>
            <label>Tu correo<input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" maxLength={254} placeholder="tu@correo.com" /></label>
            <p className="le-sol-error" role="alert">{error}</p>
            <button type="submit" className="le-pill le-naranja" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
