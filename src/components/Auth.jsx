import { useState } from 'react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase.js'
import { EDAD_MINIMA, edadEnAnios } from '../lib/edad.js'
import { LEGAL_VERSION } from '../lib/constants.js'
import { evento } from '../lib/analytics.js'
import LegalModal from './legal/LegalModal.jsx'
import '../styles/auth.css'

// Logo y collage de gatos se sirven desde public/assets (referencia con ruta absoluta)
const LOGO          = '/assets/inmersia-logo.png'
const GATO_NARANJA  = '/assets/tienda/gato-naranja-4.webp'
const GATO_BLANCO   = '/assets/tienda/gato-blanco-5.webp'
const GATO_NEGRO    = '/assets/cartelera/gato-negro-2.webp'

// icono ojo (mismo trazo que el Preview de la biblioteca)
function EyeIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function EyeOffIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" strokeLinecap="round" />
    </svg>
  )
}

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="password-input-wrap">
      <input
        type={visible ? 'text' : 'password'} required className="auth-input"
        placeholder={placeholder} autoComplete={autoComplete}
        value={value} onChange={onChange}
      />
      <button
        type="button" className="password-toggle"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

// ── AuthCard ─────────────────────────────────────────────────────────────
// Tarjeta (carnet) con toda la lógica de login/registro/recuperación.
// Se reutiliza en dos envoltorios:
//   • <Auth>       → escena a pantalla completa (fallback de la ruta /auth).
//   • <AuthModal>  → pop-up sobre la página actual (landing, tienda, lector…).
// Props:
//   `initialTab`  'login' | 'registro'
//   `onAuthSuccess(user)`  se llama al autenticar con éxito.
//   `onBack`   (opcional) enlace "← Volver" en la esquina (escena a pantalla completa).
//   `onClose`  (opcional) botón "×" de cierre (modal).
export function AuthCard({ onAuthSuccess, initialTab = 'login', onBack, onClose }) {
  const [tab,         setTab]         = useState(initialTab === 'registro' ? 'registro' : 'login')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')
  const [loginForm,   setLoginForm]   = useState({ email: '', password: '' })
  const [regForm,     setRegForm]     = useState({ nombre: '', apellido: '', fechaNacimiento: '', genero: '', email: '', password: '', confirmPassword: '' })
  const [aceptaLegal, setAceptaLegal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [legalDoc,    setLegalDoc]    = useState(null) // null | 'terminos' | 'privacidad'

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
    // Edad mínima declarada en los Términos (3.1). Hasta ahora se pedía la fecha
    // y no se comprobaba nada: el documento prometía un límite que el formulario
    // no aplicaba.
    const edad = edadEnAnios(regForm.fechaNacimiento)
    if (edad === null) { setError('Revisa la fecha de nacimiento.'); return }
    if (edad < EDAD_MINIMA) { setError(`Para crear una cuenta en Inmersia tienes que tener al menos ${EDAD_MINIMA} años.`); return }
    if (!aceptaLegal) { setError('Tienes que aceptar los Términos y Condiciones y la Política de Privacidad.'); return }
    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: regForm.email.trim(), password: regForm.password,
      options: { data: {
        nombre: regForm.nombre.trim(),
        apellido: regForm.apellido.trim(),
        fecha_nacimiento: regForm.fechaNacimiento || null,
        genero: regForm.genero || null,
        // Prueba de la aceptación: qué versión de los documentos aceptó y
        // cuándo. Sin esto, "aceptaste los Términos" no se puede sostener.
        legal_aceptado_version: LEGAL_VERSION,
        legal_aceptado_at: new Date().toISOString(),
      } },
    })
    // El perfil y el Manual del Explorador se crean en App.jsx (ensureProfile) al
    // recibir el evento SIGNED_IN — cubre tanto la sesión inmediata (confirmación de
    // email desactivada) como el primer login tras confirmar (cuando signUp no
    // devuelve sesión y no hay auth.uid() disponible todavía para el insert).
    if (signUpError) { setLoading(false); setError(signUpError.message); return }
    // La cuenta ya existe, con sesión inmediata o pendiente de confirmar el
    // correo. La distinción importa: si `confirmacion_pendiente` domina, la
    // gente se está quedando en la bandeja de entrada y nunca vuelve.
    evento('signup_completado', { confirmacion_pendiente: !data.session })
    setLoading(false)
    if (data.session) { onAuthSuccess(data.user, { isNewAccount: true }) }
    else { setSuccess('¡Registro exitoso! Revisa tu correo para confirmar tu cuenta.'); setTab('login') }
  }

  return (
    <>
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
          {onClose && (
            <button
              type="button"
              className="login-close"
              onClick={onClose}
              aria-label="Cerrar"
              title="Cerrar"
            >×</button>
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
                <PasswordInput placeholder="••••••••" autoComplete="current-password" value={loginForm.password} onChange={e => setL('password', e.target.value)} />
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
                <label className="field-label">Fecha de nacimiento *</label>
                <input type="date" required className="auth-input" value={regForm.fechaNacimiento} onChange={e => setR('fechaNacimiento', e.target.value)} style={{ colorScheme: 'light' }} />
              </div>
              <div className="form-field">
                <label className="field-label">Género *</label>
                <select required className="auth-input" value={regForm.genero} onChange={e => setR('genero', e.target.value)} style={{ colorScheme: 'light' }}>
                  <option value="" disabled>Selecciona una opción</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="diverso">Diverso</option>
                </select>
              </div>
              <div className="form-field">
                <label className="field-label">Correo electrónico *</label>
                <input type="email" required className="auth-input" placeholder="tu@correo.com" value={regForm.email} onChange={e => setR('email', e.target.value)} />
              </div>
              <div className="form-row">
                <div><label className="field-label">Contraseña *</label><PasswordInput placeholder="6+ caracteres" autoComplete="new-password" value={regForm.password} onChange={e => setR('password', e.target.value)} /></div>
                <div><label className="field-label">Confirmar *</label><PasswordInput placeholder="Repite" autoComplete="new-password" value={regForm.confirmPassword} onChange={e => setR('confirmPassword', e.target.value)} /></div>
              </div>
              {/* Aceptación explícita: casilla obligatoria, no un "al continuar
                  aceptas" al pie. La versión aceptada y la fecha se guardan en el
                  metadata del usuario (ver handleRegister). */}
              <label className="auth-legal-check">
                <input type="checkbox" checked={aceptaLegal} onChange={e => setAceptaLegal(e.target.checked)} />
                <span>
                  He leído y acepto los{' '}
                  <button type="button" onClick={() => setLegalDoc('terminos')}>Términos y Condiciones</button>
                  {' '}y la{' '}
                  <button type="button" onClick={() => setLegalDoc('privacidad')}>Política de Privacidad</button>.
                </span>
              </label>
              <button type="submit" className="btn-stamp" disabled={loading || !aceptaLegal}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="spinner" />Creando carnet…</span>
                  : 'Crear mi carnet de biblioteca'}
              </button>
            </form>
          )}

          {/* En "registro" la aceptación va en la casilla del formulario; acá
              sobraría. En las demás pestañas los documentos siguen a un clic. */}
          {tab !== 'registro' && (
            <p className="auth-foot" style={{ marginTop: 18, fontSize: 12 }}>
              Puedes consultar los{' '}
              <button type="button" onClick={() => setLegalDoc('terminos')}>Términos y Condiciones</button>
              {' '}y la{' '}
              <button type="button" onClick={() => setLegalDoc('privacidad')}>Política de Privacidad</button>.
            </p>
          )}
        </div>
      </div>

      {legalDoc && <LegalModal initialDoc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </>
  )
}

// ── Auth (escena a pantalla completa) ────────────────────────────────────
// Fallback para la ruta /auth (enlaces directos/marcadores). En el flujo
// normal la autenticación se abre como pop-up con <AuthModal>.
export default function Auth({ onAuthSuccess, initialTab = 'login', onBack }) {
  return (
    <div className="login-scene">
      <img className="scene-cat scene-cat--naranja" src={GATO_NARANJA} alt="" aria-hidden="true" />
      <img className="scene-cat scene-cat--blanco"  src={GATO_BLANCO}  alt="" aria-hidden="true" />
      <img className="scene-cat scene-cat--negro"   src={GATO_NEGRO}   alt="" aria-hidden="true" />
      <AuthCard onAuthSuccess={onAuthSuccess} initialTab={initialTab} onBack={onBack} />
    </div>
  )
}
