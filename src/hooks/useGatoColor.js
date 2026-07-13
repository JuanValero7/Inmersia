// src/hooks/useGatoColor.js
// ─────────────────────────────────────────────────────────────
// Preferencia de "gato de compañía" (negro/blanco/naranja) que
// acompaña al usuario en el detalle de libro (Biblioteca).
// Vive en preferencias_usuario.gato_color (ver migración 026),
// la misma tabla que guarda ultimos_libros en App.jsx.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export function useGatoColor(user) {
  const [gatoColor, setGatoColor] = useState('negro')

  useEffect(() => {
    if (!user) return
    let activo = true
    ;(async () => {
      const { data } = await supabase
        .from('preferencias_usuario')
        .select('gato_color')
        .eq('user_id', user.id)
        .maybeSingle()
      if (activo && data?.gato_color) setGatoColor(data.gato_color)
    })()
    return () => { activo = false }
  }, [user?.id])

  const updateGatoColor = useCallback(async (color) => {
    let previous
    setGatoColor(curr => { previous = curr; return color })
    if (!user) return
    const { error } = await supabase
      .from('preferencias_usuario')
      .upsert({ user_id: user.id, gato_color: color, updated_at: new Date().toISOString() })
    if (error) { console.error('updateGatoColor:', error.message); setGatoColor(previous) }
  }, [user])

  return { gatoColor, updateGatoColor }
}
