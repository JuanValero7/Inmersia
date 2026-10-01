import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { EDAD_MINIMA, edadEnAnios } from '../lib/edad.js'
import { LEGAL_VERSION } from '../lib/constants.js'
import { evento } from '../lib/analytics.js'
import { antesDeIrAGoogle } from '../lib/progresoInvitado.js'
import LegalModal from './legal/LegalModal.jsx'
import '../styles/auth.css'

// Collage de gatos de la escena /auth: se sirven desde public/assets
const GATO_NARANJA  = '/assets/tienda/gato-naranja-4.webp'
const GATO_BLANCO   = '/assets/tienda/gato-blanco-5.webp'
const GATO_NEGRO    = '/assets/cartelera/gato-negro-2.webp'

// "Continuar con Google" solo aparece con VITE_LOGIN_GOOGLE=true: hasta activar
// el proveedor en Supabase (y la app OAuth en Google Cloud) el botón daría error.
// Las cuentas de Google llegan sin fecha de nacimiento ni aceptación legal: las
// pide <CompletarCuenta> en el primer ingreso, antes de dejar usar la app.
export const LOGIN_GOOGLE = import.meta.env.VITE_LOGIN_GOOGLE === 'true'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  )
}

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
  // Registro mínimo (2026-10): fuera apellido, género y repetir contraseña.
  // El apellido se puede añadir después en el Perfil.
  const [regForm,     setRegForm]     = useState({ nombre: '', fechaNacimiento: '', email: '', password: '' })
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

  // Google vuelve a la misma página (p. ej. el libro que el invitado estaba
  // leyendo). En Supabase → Auth → URL Configuration tiene que estar permitida
  // https://www.inmersia.io/** como Redirect URL.
  const handleGoogle = async () => {
    clear(); setLoading(true)
    evento('auth_google', { pestana: tab })
    antesDeIrAGoogle() // la página se recarga: guarda la muestra que estaba leyendo
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
    if (err) { setLoading(false); setError(err.message) }
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
    if (!regForm.nombre.trim()) { setError('Dinos cómo te llamas.'); return }
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
        fecha_nacimiento: regForm.fechaNacimiento || null,
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
          <h2 className="login-title">
            {tab === 'login' ? '¡Qué bueno verte!' : tab === 'registro' ? 'Crea tu cuenta' : 'Recupera tu contraseña'}
          </h2>
          <p className="login-sub">
            {tab === 'login' ? 'Tu libro sigue abierto donde lo dejaste.'
              : tab === 'registro' ? 'Guarda por dónde vas, tu Cuaderno y tu Álbum.'
              : 'Te mandamos un enlace para crear una nueva.'}
          </p>
        </div>

        <div className="login-body">
          {tab !== 'forgot' && (
            <div className="auth-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'login'} className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); clear() }}>Iniciar sesión</button>
              <button type="button" role="tab" aria-selected={tab === 'registro'} className={`auth-tab ${tab === 'registro' ? 'active' : ''}`} onClick={() => { setTab('registro'); clear() }}>Crear cuenta</button>
            </div>
          )}
          {error   && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          {LOGIN_GOOGLE && tab !== 'forgot' && (
            <>
              <button type="button" className="auth-google" onClick={handleGoogle} disabled={loading}>
                <GoogleIcon /> Continuar con Google
              </button>
              <div className="auth-or">o con tu correo</div>
            </>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="form-field">
                <label className="field-label" htmlFor="login-email">Correo electrónico</label>
                <input id="login-email" type="email" required className="auth-input" placeholder="tu@correo.com" autoComplete="email" value={loginForm.email} onChange={e => setL('email', e.target.value)} />
              </div>
              <div className="form-field">
                <label className="field-label">Contraseña</label>
                <PasswordInput placeholder="Tu contraseña" autoComplete="current-password" value={loginForm.password} onChange={e => setL('password', e.target.value)} />
              </div>
              <div className="auth-forgot">
                <button type="button" onClick={() => { setTab('forgot'); clear(); setForgotEmail(loginForm.email) }}>¿Olvidaste tu contraseña?</button>
              </div>
              <button type="submit" className="btn-stamp" disabled={loading}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="spinner" />Verificando…</span>
                  : 'Iniciar sesión'}
              </button>
              <p className="auth-foot">
                ¿No tienes cuenta?{' '}
                <button type="button" onClick={() => { setTab('registro'); clear() }}>Crea una</button>
              </p>
            </form>
          )}

          {tab === 'forgot' && (
            <form onSubmit={handleForgot}>
              <div className="form-field">
                <label className="field-label" htmlFor="forgot-email">Correo electrónico</label>
                <input id="forgot-email" type="email" required className="auth-input" placeholder="tu@correo.com"
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
              <div className="form-field">
                <label className="field-label" htmlFor="reg-nombre">¿Cómo te llamas?</label>
                <input id="reg-nombre" type="text" required className="auth-input" placeholder="Tu nombre" autoComplete="given-name" value={regForm.nombre} onChange={e => setR('nombre', e.target.value)} />
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="reg-email">Correo electrónico</label>
                <input id="reg-email" type="email" required className="auth-input" placeholder="tu@correo.com" autoComplete="email" value={regForm.email} onChange={e => setR('email', e.target.value)} />
              </div>
              <div className="form-field">
                <label className="field-label">Contraseña</label>
                <PasswordInput placeholder="6 caracteres o más" autoComplete="new-password" value={regForm.password} onChange={e => setR('password', e.target.value)} />
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="reg-fecha">Fecha de nacimiento</label>
                <input id="reg-fecha" type="date" required className="auth-input" value={regForm.fechaNacimiento} onChange={e => setR('fechaNacimiento', e.target.value)} style={{ colorScheme: 'light' }} />
                <small className="auth-hint">Hace falta tener {EDAD_MINIMA} años o más.</small>
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
                  ? <span className="flex items-center justify-center gap-2"><span className="spinner" />Creando tu cuenta…</span>
                  : 'Crear cuenta'}
              </button>
              <p className="auth-foot">
                ¿Ya tienes cuenta?{' '}
                <button type="button" onClick={() => { setTab('login'); clear() }}>Inicia sesión</button>
              </p>
            </form>
          )}

          {/* En "registro" la aceptación va en la casilla del formulario; acá
              sobraría. En las demás pestañas los documentos siguen a un clic. */}
          {tab !== 'registro' && (
            <p className="auth-foot auth-legal-foot">
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
