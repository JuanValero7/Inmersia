// src/components/CompletarCuenta.jsx
// ─────────────────────────────────────────────────────────────
// Paso obligatorio para las cuentas que llegan sin fecha de nacimiento
// (las de "Continuar con Google"). Bloquea la app hasta que se completa:
//   · sin fecha, edad_permite_contacto() (migración 051) dejaría a un menor de
//     16 recibir mensajitos, y no habría forma de aplicar la edad mínima;
//   · Google no pasa por la casilla de los Términos, así que la aceptación
//     (versión + fecha) se recoge aquí, igual que en el registro con correo.
// Por debajo de EDAD_MINIMA la cuenta se borra en el acto (eliminar_mi_cuenta,
// migración 043): no hay forma de quedarse con una cuenta de un menor de 14.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { EDAD_MINIMA, edadEnAnios } from '../lib/edad.js'
import { LEGAL_VERSION } from '../lib/constants.js'
import { evento } from '../lib/analytics.js'
import { ensureProfile } from '../lib/ensureProfile.js'
import LegalModal from './legal/LegalModal.jsx'
import '../styles/auth.css'

/** ¿A esta cuenta le falta completar el registro? */
export const faltaCompletarCuenta = (user) => !!user && !user.user_metadata?.fecha_nacimiento

export default function CompletarCuenta({ user }) {
  const [fecha, setFecha] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [rechazada, setRechazada] = useState(false)
  const [legalDoc, setLegalDoc] = useState(null)
  const nombre = user.user_metadata?.nombre || user.user_metadata?.given_name || ''

  const enviar = async (e) => {
    e.preventDefault(); setError('')
    const edad = edadEnAnios(fecha)
    if (edad === null) { setError('Revisa la fecha de nacimiento.'); return }
    if (!acepta) { setError('Tienes que aceptar los Términos y Condiciones y la Política de Privacidad.'); return }
    setEnviando(true)

    if (edad < EDAD_MINIMA) {
      evento('cuenta_rechazada_edad')
      // La sesión se cierra al pulsar "Entendido": si se cerrara aquí, App
      // desmontaría esta pantalla antes de que se leyera el aviso.
      await supabase.rpc('eliminar_mi_cuenta')
      setRechazada(true)
      return
    }

    const { error: errMeta } = await supabase.auth.updateUser({ data: {
      fecha_nacimiento: fecha,
      legal_aceptado_version: LEGAL_VERSION,
      legal_aceptado_at: new Date().toISOString(),
    } })
    if (errMeta) { setEnviando(false); setError(errMeta.message); return }
    // perfiles.fecha_nacimiento es la que leen las reglas de edad (051). Se
    // espera a que exista la fila (ensureProfile corre en paralelo al entrar).
    await ensureProfile(user)
    const { error: errPerfil } = await supabase.from('perfiles').update({ fecha_nacimiento: fecha }).eq('id', user.id)
    if (errPerfil) console.error('CompletarCuenta (perfil):', errPerfil.message)
    evento('cuenta_completada')
    // onAuthStateChange (USER_UPDATED) trae el usuario con la fecha y esta
    // pantalla desaparece sola.
  }

  return (
    <div className="auth-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="completar-h">
      <div className="auth-modal-card">
        <div className="login-card">
          <div className="login-header">
            <h2 className="login-title" id="completar-h">
              {rechazada ? 'Todavía no' : nombre ? `¡Hola, ${nombre}!` : '¡Ya casi!'}
            </h2>
            <p className="login-sub">
              {rechazada ? `Inmersia es para personas de ${EDAD_MINIMA} años o más.` : 'Un último paso y entras a tu biblioteca.'}
            </p>
          </div>
          <div className="login-body">
            {rechazada ? (
              <>
                <p className="auth-foot" style={{ marginTop: 0, marginBottom: 16 }}>
                  Hemos borrado la cuenta que se acababa de crear. Te esperamos cuando cumplas {EDAD_MINIMA}.
                </p>
                <button type="button" className="btn-stamp" onClick={() => supabase.auth.signOut()}>Entendido</button>
              </>
            ) : (
              <form onSubmit={enviar}>
                {error && <div className="auth-error">{error}</div>}
                <div className="form-field">
                  <label className="field-label" htmlFor="completar-fecha">Fecha de nacimiento</label>
                  <input id="completar-fecha" type="date" required className="auth-input" value={fecha}
                    onChange={(e) => setFecha(e.target.value)} style={{ colorScheme: 'light' }} />
                  <small className="auth-hint">Hace falta tener {EDAD_MINIMA} años o más.</small>
                </div>
                <label className="auth-legal-check">
                  <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
                  <span>
                    He leído y acepto los{' '}
                    <button type="button" onClick={() => setLegalDoc('terminos')}>Términos y Condiciones</button>
                    {' '}y la{' '}
                    <button type="button" onClick={() => setLegalDoc('privacidad')}>Política de Privacidad</button>.
                  </span>
                </label>
                <button type="submit" className="btn-stamp" disabled={enviando || !acepta}>
                  {enviando ? <span className="flex items-center justify-center gap-2"><span className="spinner" />Guardando…</span> : 'Entrar'}
                </button>
                <p className="auth-foot">
                  ¿No eras tú?{' '}
                  <button type="button" onClick={() => supabase.auth.signOut()}>Salir</button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
      {legalDoc && <LegalModal initialDoc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  )
}
