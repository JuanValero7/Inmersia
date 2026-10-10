// src/hooks/useGatoColor.js
// ─────────────────────────────────────────────────────────────
// Preferencia de "gato de compañía" (negro/blanco/naranja) que
// acompaña al usuario en el detalle de libro (Biblioteca).
// Vive en preferencias_usuario.gato_color (ver migración 026),
// la misma tabla que guarda ultimos_libros en App.jsx.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { guardar } from '../lib/guardar.js'

// Gato que el visitante eligió en la landing, antes de tener cuenta. Al entrar
// por primera vez, si la cuenta aún no tiene gato guardado, se queda con ese.
// Lo escribe Landing.jsx; se borra al usarlo o al ver que la cuenta ya tenía uno.
export const GATO_ELEGIDO_KEY = 'inm-gato-elegido'
const COLORES = ['negro', 'blanco', 'naranja']

function tomarGatoElegido() {
  try {
    const c = localStorage.getItem(GATO_ELEGIDO_KEY)
    localStorage.removeItem(GATO_ELEGIDO_KEY)
    return COLORES.includes(c) ? c : null
  } catch { return null }
}

/**
 * Color del gato de compañía, persistido en preferencias_usuario.
 *
 * FUENTE ÚNICA: instanciar este hook en varios componentes a la vez crea copias del
 * estado que se desincronizan. Se monta UNA vez (App.jsx) y el valor baja por props.
 *
 * @param {{ id: string }|null} user
 * @returns {{ gatoColor: 'negro'|'blanco'|'naranja',
 *             updateGatoColor: (c: string) => Promise<void> }}
 */
export function useGatoColor(user) {
  const [gatoColor, setGatoColor] = useState('negro')
  // Solo el id: el objeto `user` cambia de identidad al refrescarse el token,
  // y eso no es motivo para volver a pedir el color.
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    let activo = true
    ;(async () => {
      const { data } = await supabase
        .from('preferencias_usuario')
        .select('gato_color')
        .eq('user_id', userId)
        .maybeSingle()
      if (!activo) return
      const elegidoEnLanding = tomarGatoElegido()
      if (data?.gato_color) { setGatoColor(data.gato_color); return }
      if (elegidoEnLanding) {
        setGatoColor(elegidoEnLanding)
        const { error } = await supabase
          .from('preferencias_usuario')
          .upsert({ user_id: userId, gato_color: elegidoEnLanding, updated_at: new Date().toISOString() })
        if (error) console.error('useGatoColor (gato de la landing):', error.message)
      }
    })()
    return () => { activo = false }
  }, [userId])

  // El color anterior se lee ANTES de cambiarlo. Antes se capturaba dentro del
  // updater de setGatoColor, que React puede ejecutar más tarde: si el guardado
  // fallaba, `previous` seguía en undefined y el gato se quedaba sin color.
  const updateGatoColor = useCallback(async (color) => {
    const previous = gatoColor
    setGatoColor(color)
    if (!userId) return
    const { ok } = await guardar(supabase.from('preferencias_usuario')
      .upsert({ user_id: userId, gato_color: color, updated_at: new Date().toISOString() }),
      { que: 'color del gato' })
    if (!ok) setGatoColor(previous)
  }, [userId, gatoColor])

  return { gatoColor, updateGatoColor }
}
