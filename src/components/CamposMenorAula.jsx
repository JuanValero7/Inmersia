// src/components/CamposMenorAula.jsx
// ─────────────────────────────────────────────────────────────
// Lo que se pide de más cuando la fecha de nacimiento da 12 o 13 años
// (migración 086): con esa edad solo se entra a Inmersia con el código del
// aula que da el colegio. Lo usan el registro con correo (Auth.jsx) y el
// paso de «Continuar con Google» (CompletarCuenta.jsx).
//   · código del aula (relleno si se llegó por un enlace /unirse/…)
//   · apellido, para que el profesor lo reconozca en su lista
//   · el check de que sus padres o tutores están informados. La base legal
//     es el acuerdo con el colegio; esto es un complemento.
// ─────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
import { normalizarCodigo } from '../hooks/useComunidades.js'

export const MENOR_VACIO = { codigo: '', apellido: '', padres: false }

/**
 * Comprueba los campos y que el código sea de un aula. Devuelve el mensaje
 * de error para el usuario, o null si está todo bien.
 */
export async function validarMenor(m) {
  if (!normalizarCodigo(m.codigo)) return 'Escribe el código de tu aula. Te lo da tu profesor.'
  if (!m.apellido.trim()) return 'Escribe tu apellido, para que tu profesor te reconozca.'
  if (!m.padres) return 'Marca la casilla de tus padres o tutores para seguir.'
  const { data, error } = await supabase.rpc('codigo_aula_valido', { p_codigo: normalizarCodigo(m.codigo) })
  if (error) return 'No pudimos comprobar el código. Revisa tu conexión e inténtalo de nuevo.'
  if (!data) return 'Ese código no es de un aula. Revisa que esté bien escrito.'
  return null
}

export default function CamposMenorAula({ valor, onChange }) {
  const set = (k, v) => onChange({ ...valor, [k]: v })
  return (
    <div className="auth-menor">
      <p className="auth-menor-txt">
        Con 12 o 13 años, Inmersia se usa con tu colegio: escribe el código de tu aula.
      </p>
      <div className="form-field">
        <label className="field-label" htmlFor="menor-codigo">Código de tu aula</label>
        <input id="menor-codigo" type="text" required className="auth-input" placeholder="Te lo da tu profesor"
          autoComplete="off" spellCheck="false" maxLength={20} value={valor.codigo}
          onChange={e => set('codigo', normalizarCodigo(e.target.value))} style={{ letterSpacing: '.12em' }} />
      </div>
      <div className="form-field">
        <label className="field-label" htmlFor="menor-apellido">Tu apellido</label>
        <input id="menor-apellido" type="text" required className="auth-input" placeholder="Como aparece en la lista de tu curso"
          autoComplete="family-name" maxLength={39} value={valor.apellido} onChange={e => set('apellido', e.target.value)} />
      </div>
      <label className="auth-legal-check">
        <input type="checkbox" checked={valor.padres} onChange={e => set('padres', e.target.checked)} />
        <span>Me registro con el código que me dio mi colegio y mis padres o tutores están informados.</span>
      </label>
    </div>
  )
}
