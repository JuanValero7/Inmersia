import { useState } from 'react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase.js'
import { MANUAL_LIBRO_ID } from '../lib/constants.js'
import '../styles/auth.css'

// Logo y fondo se sirven desde public/assets (referencia con ruta absoluta)
const LOGO  = '/assets/inmersia-logo.png'
const FONDO = '/assets/fondo-acuarela.webp'

// ⬅︎ LANDING: `initialTab` permite abrir en 'login' o 'registro' desde la landing.
//             `onBack` (opcional) muestra un enlace para volver a la landing.
export default function Auth({ onAuthSuccess, initialTab = 'login', onBack }) {
  const [tab,         setTab]         = useState(initialTab === 'registro' ? 'registro' : 'login')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')
  const [loginForm,   setLoginForm]   = useState({ email: '', password: '' })
  const [regForm,     setRegForm]     = useState({ nombre: '', apellido: '', fechaNacimiento: '', email: '', password: '', confirmPassword: '' })
  const [forgotEmail, setForgotEmail] = useState('')

  const setL = (k, v) => setLoginForm(f => ({ ...f, [k]: v }))
  const setR = (k, v) => setRegForm(f => ({ ...f, [k]: v }))
  const clear = () => { setError(''); setSuccess('') }

  const handleForgot = async (e) => {
    e.preventDefault(); clear(); setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim(),
      { redirectTo: window.location.origin }
    )
    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess('Si esa dirección está registrada, recibirás un enlace para restablecer tu contraseña.')
  }

  const handleLogin = async (e) => {
    e.preventDefault(); clear(); setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginForm.email.trim(), password: loginForm.password,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onAuthSuccess(data.user)
  }

  const handleRegister = async (e) => {
    e.preventDefault(); clear()
    if (regForm.password !== regForm.confirmPassword) { setError('Las contraseñas no coinciden.'); return }
    if (regForm.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: regForm.email.trim(), password: regForm.password,
      options: { data: { nombre: regForm.nombre.trim(), apellido: regForm.apellido.trim() } },
    })
    if (signUpError) { setLoading(false); setError(signUpError.message); return }
    if (data.user) {
      await supabase.from('perfiles').insert({
        id: data.user.id,
        nombre: regForm.nombre.trim(),
        apellido: regForm.apellido.trim(),
        fecha_nacimiento: regForm.fechaNacimiento || null,
      })
      // Todo usuario nuevo recibe el Manual del Explorador automáticamente
      await supabase.from('bibliotecas_usuarios').insert({
        user_id: data.user.id,
        libro_id: MANUAL_LIBRO_ID,
        leido: false,
      })
    }
    setLoading(false)
    if (data.session) { onAuthSuccess(data.user) }
    else { setSuccess('¡Registro exitoso! Revisa tu correo para confirmar tu cuenta.'); setTab('login') }
  }

  return (
    <div className="login-scene">
      <img className="scene-bg" src={FONDO} alt="" aria-hidden="true" />

      <div className="login-card">
        <div className="login-header">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                position: 'absolute', top: 14, left: 16, zIndex: 2,
                background: 'transparent', border: '1.5px solid rgba(74,54,34,0.35)',
                color: '#9a6a4a', borderRadius: 8, padding: '5px 11px', cursor: 'pointer',
                fontFamily: "'Baloo 2', system-ui, sans-serif", fontWeight: 700, fontSize: 13,
              }}
            >← Volver</button>
          )}
          <img className="login-logo-mark" src={LOGO} alt="Inmersia" />
          <p className="login-sub">Carnet de Acceso a la Colección</p>
        </div>

        <div className="login-body">
          {tab !== 'forgot' && (
            <div className="auth-tabs">
              <button className={clsx('auth-tab', tab === 'login' && 'active')} onClick={() => { setTab('login'); clear() }}>Iniciar sesión</button>
              <button className={clsx('auth-tab', tab === 'registro' && 'active')} onClick={() => { setTab('registro'); clear() }}>Registrarse</button>
            </div>
          )}

          {error   && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="form-field">
                <label className="field-label">Correo electrónico</label>
                <input type="email" required className="auth-input" placeholder="tu@correo.com" value={loginForm.email} onChange={e => setL('email', e.target.value)} />
              </div>
              <div className="form-field">
                <label className="field-label">Contraseña</label>
                <input type="password" required className="auth-input" placeholder="••••••••" value={loginForm.password} onChange={e => setL('password', e.target.value)} />
              </div>
              <button type="submit" className="btn-stamp" disabled={loading}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="spinner" />Verificando…</span>
                  : 'Entrar a la biblioteca'}
              </button>
              <p className="auth-foot">
                ¿Aún no tienes carnet?{' '}
                <button type="button" onClick={() => { setTab('registro'); clear() }}>Regístrate aquí</button>
                {' · '}
                <button type="button" onClick={() => { setTab('forgot'); clear(); setForgotEmail(loginForm.email) }}>¿Olvidaste tu contraseña?</button>
              </p>
            </form>
          )}

          {tab === 'forgot' && (
            <form onSubmit={handleForgot}>
              <p className="auth-foot" style={{ marginBottom: 16 }}>
                Ingresá tu correo y te enviamos un enlace para restablecer tu contraseña.
              </p>
              <div className="form-field">
                <label className="field-label">Correo electrónico</label>
                <input type="email" required className="auth-input" placeholder="tu@correo.com"
                  value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} autoFocus />
              </div>
              <button type="submit" className="btn-stamp" disabled={loading}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="spinner" />Enviando…</span>
                  : 'Enviar enlace de recuperación'}
              </button>
              <p className="auth-foot">
                <button type="button" onClick={() => { setTab('login'); clear() }}>← Volver al inicio de sesión</button>
              </p>
            </form>
          )}

          {tab === 'registro' && (
            <form onSubmit={handleRegister}>
              <div className="form-row">
                <div><label className="field-label">Nombre *</label><input type="text" required className="auth-input" placeholder="Ana" value={regForm.nombre} onChange={e => setR('nombre', e.target.value)} /></div>
                <div><label className="field-label">Apellido *</label><input type="text" required className="auth-input" placeholder="García" value={regForm.apellido} onChange={e => setR('apellido', e.target.value)} /></div>
              </div>
              <div className="form-field">
                <label className="field-label">Fecha de nacimiento</label>
                <input type="date" className="auth-input" value={regForm.fechaNacimiento} onChange={e => setR('fechaNacimiento', e.target.value)} style={{ colorScheme: 'light' }} />
              </div>
              <div className="form-field">
                <label className="field-label">Correo electrónico *</label>
                <input type="email" required className="auth-input" placeholder="tu@correo.com" value={regForm.email} onChange={e => setR('email', e.target.value)} />
              </div>
              <div className="form-row">
                <div><label className="field-label">Contraseña *</label><input type="password" required className="auth-input" placeholder="6+ caracteres" value={regForm.password} onChange={e => setR('password', e.target.value)} /></div>
                <div><label className="field-label">Confirmar *</label><input type="password" required className="auth-input" placeholder="Repite" value={regForm.confirmPassword} onChange={e => setR('confirmPassword', e.target.value)} /></div>
              </div>
              <button type="submit" className="btn-stamp" disabled={loading}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="spinner" />Creando carnet…</span>
                  : 'Crear mi carnet de biblioteca'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
