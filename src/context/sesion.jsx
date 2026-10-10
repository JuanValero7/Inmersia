// src/context/sesion.jsx
// ─────────────────────────────────────────────────────────────
// Quién está usando la app, en UN solo sitio: el usuario, si es superusuario y
// el color de su gato. Se lee con useSesion() desde cualquier componente o hook.
//
// POR QUÉ
// Antes App.jsx guardaba el usuario en un useState y lo pasaba por props, y
// useLectorData leía la sesión por su cuenta una sola vez al montarse. Dos
// fuentes de verdad: si alguien entraba sin que el lector se remontara, el
// lector seguía creyendo que no había nadie y no guardaba el progreso.
//
// Aquí también vive lo que pasa al cambiar la sesión: crear el perfil al
// entrar (red de seguridad, ver ensureProfile) y llevar a la portada al salir.
// ─────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { ensureProfile } from '../lib/ensureProfile.js'
import { useSuperuser } from '../hooks/useSuperuser.js'
import { useGatoColor } from '../hooks/useGatoColor.js'

const SesionContext = createContext(null)

/**
 * @typedef {object} Sesion
 * @property {object|null|undefined} user   undefined mientras se resuelve; null = invitado
 * @property {boolean} authReady            ya se sabe si hay sesión
 * @property {boolean} isSuperuser
 * @property {'negro'|'blanco'|'naranja'} gatoColor
 * @property {(color: string) => void} updateGatoColor
 * @property {(u: object) => void} setUser  para el pop-up de entrada, que ya trae el usuario
 * @property {() => Promise<void>} cerrarSesion
 */

export function SesionProvider({ children }) {
  const [user, setUser] = useState(undefined)
  const [authReady, setAuthReady] = useState(false)
  const navigate = useNavigate()
  const isSuperuser = useSuperuser(user ?? null)
  const { gatoColor, updateGatoColor } = useGatoColor(user)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      // ensureProfile va en un setTimeout(0) a propósito: este callback corre
      // DENTRO del lock exclusivo de auth de supabase-js, y cualquier llamada al
      // cliente desde acá vuelve a pedir ese mismo lock → deadlock (la app se
      // queda colgada en "Abriendo la biblioteca…"). Es el patrón que recomienda
      // la propia librería (ver el doc de onAuthStateChange en @supabase/auth-js).
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(() => ensureProfile(session.user), 0)
      }
      if (event === 'PASSWORD_RECOVERY') { navigate('/reset-password'); return }
      if (event === 'SIGNED_OUT') navigate('/')
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [navigate])

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    navigate('/')
  }, [navigate])

  const valor = useMemo(() => ({
    user, authReady, isSuperuser, gatoColor, updateGatoColor, setUser, cerrarSesion,
  }), [user, authReady, isSuperuser, gatoColor, updateGatoColor, cerrarSesion])

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}

/** @returns {Sesion} */
export function useSesion() {
  const sesion = useContext(SesionContext)
  if (!sesion) throw new Error('useSesion() fuera de <SesionProvider>')
  return sesion
}
