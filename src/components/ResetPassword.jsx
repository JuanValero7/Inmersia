import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import '../styles/auth.css'

const LOGO  = '/assets/inmersia-logo.png'
const FONDO = '/assets/fondo-acuarela.webp'

export default function ResetPassword({ onDone }) {
  const [p1,      setP1]      = useState('')
  const [p2,      setP2]      = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const doneTimerRef = useRef(null)
  useEffect(() => () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (p1.length < 6)  { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (p1 !== p2)       { setError('Las contraseñas no coinciden.'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password: p1 })
    setLoading(false)
    if (err) { setError('No se pudo actualizar la contraseña. El enlace puede haber expirado.'); return }
    setSuccess(true)
    doneTimerRef.current = setTimeout(onDone, 2200)
  }

  return (
    <div className="login-scene">
      <img className="scene-bg" src={FONDO} alt="" aria-hidden="true" />
      <div className="login-card">
        <div className="login-header">
          <img className="login-logo-mark" src={LOGO} alt="Inmersia" />
          <p className="login-sub">Restablecer contraseña</p>
        </div>
        <div className="login-body">
          {success ? (
            <div className="auth-success" style={{ textAlign: 'center', padding: '28px 0' }}>
              ✓ Contraseña actualizada. Entrando a la biblioteca…
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-field">
                <label className="field-label">Nueva contraseña</label>
                <input type="password" required className="auth-input"
                  placeholder="mínimo 6 caracteres" autoComplete="new-password"
                  value={p1} onChange={e => setP1(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="field-label">Confirmar contraseña</label>
                <input type="password" required className="auth-input"
                  placeholder="Repetir contraseña" autoComplete="new-password"
                  value={p2} onChange={e => setP2(e.target.value)} />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn-stamp" disabled={loading}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="spinner" />Actualizando…</span>
                  : 'Establecer nueva contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
