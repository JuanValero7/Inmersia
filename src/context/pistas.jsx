// Pistas de primera vez: qué pistas vio ya el usuario.
// ─────────────────────────────────────────────────────────────
// Reemplazan al tour obligatorio: cada función se presenta la primera vez que
// el usuario se la encuentra (texto que suena, primera ilustración, la
// Investigación, el Foro, las Comunidades…) con un cartel chico que no bloquea.
//
// ÚNICA FUENTE DE VERDAD: este controlador se instancia UNA vez en App y se
// reparte por contexto (mismo patrón que el onboarding). Así un "ya la vi"
// marcado en el lector lo ve al instante la Biblioteca, sin dos copias que se
// desincronicen.
//
// Dónde se guarda:
//   · usuario → preferencias_usuario.pistas_vistas (migración 065), así no se
//               repiten al cambiar de dispositivo.
//   · invitado → localStorage. Al registrarse se suma a lo de la cuenta, para
//               que no vuelva a ver la pista del sonido que ya vio en la muestra.
// Si la columna todavía no existe (065 sin correr) no se rompe nada: las pistas
// se muestran y se recuerdan en memoria durante la sesión.
//
// Mientras corre el tour ("Muéstrame cómo funciona") no sale ninguna: el tour
// ya explica lo mismo y se pisarían.
// ─────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { useOnboarding } from './onboarding.jsx'

const LS_KEY = 'inm_pistas_vistas'

function leerLocal() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')) } catch { return new Set() }
}
function guardarLocal(set) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])) } catch { /* modo privado: queda en memoria */ }
}

const PistasContext = createContext(null)

export function usePistasController(user) {
  const [vistas, setVistas] = useState(() => leerLocal())
  const [listo, setListo]   = useState(false)
  const vistasRef = useRef(vistas)
  vistasRef.current = vistas
  const userId = user?.id ?? null

  useEffect(() => {
    let cancelado = false
    if (!userId) { setVistas(leerLocal()); setListo(true); return }
    setListo(false)
    supabase.from('preferencias_usuario').select('pistas_vistas').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return
        const locales = leerLocal()
        if (error) {
          console.error('No se pudieron leer las pistas vistas:', error.message)
          setVistas(locales); setListo(true); return
        }
        const union = new Set([...(data?.pistas_vistas || []), ...locales])
        setVistas(union); setListo(true)
        // Lo que vio como invitado pasa a su cuenta (una sola vez).
        if (locales.size && [...locales].some(id => !(data?.pistas_vistas || []).includes(id))) {
          supabase.from('preferencias_usuario')
            .upsert({ user_id: userId, pistas_vistas: [...union], updated_at: new Date().toISOString() })
            .then(({ error: e }) => { if (!e) { try { localStorage.removeItem(LS_KEY) } catch { /* nada */ } } })
        }
      })
    return () => { cancelado = true }
  }, [userId])

  const marcar = useCallback((id) => {
    if (vistasRef.current.has(id)) return
    const next = new Set(vistasRef.current); next.add(id)
    vistasRef.current = next
    setVistas(next)
    if (userId) {
      supabase.from('preferencias_usuario')
        .upsert({ user_id: userId, pistas_vistas: [...next], updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.error('No se pudo guardar la pista vista:', error.message) })
    } else {
      guardarLocal(next)
    }
  }, [userId])

  return { listo, vistas, marcar }
}

export function PistasProvider({ value, children }) {
  return <PistasContext.Provider value={value}>{children}</PistasContext.Provider>
}

const NOOP = { listo: false, vistas: new Set(), marcar() {} }

/**
 * Lo que consumen las pantallas:
 *   · pendiente(id) → true si la pista se puede mostrar ahora (no vista,
 *                     estado cargado y sin tour en curso).
 *   · primera(ids)  → la primera de la lista que esté pendiente, o null. Sirve
 *                     para que en una pantalla salga UNA pista a la vez.
 *   · marcar(id)    → ya la vio (al cerrarla o al usar la función).
 */
export function usePistas() {
  const ctx = useContext(PistasContext) ?? NOOP
  const onboarding = useOnboarding()
  const pendiente = useCallback(
    (id) => ctx.listo && !onboarding.active && !ctx.vistas.has(id),
    [ctx.listo, ctx.vistas, onboarding.active],
  )
  const primera = useCallback((ids) => ids.find(id => id && pendiente(id)) ?? null, [pendiente])
  return { pendiente, primera, marcar: ctx.marcar }
}
