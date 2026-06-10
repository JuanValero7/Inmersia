// src/hooks/usePerfilData.js
// ─────────────────────────────────────────────────────────────
// Lógica de datos compartida del Perfil (carnet de socio).
// La consumen Perfil.jsx (desktop) y PerfilMobile.jsx, que solo
// aportan su propio chrome/JSX. Aquí vive únicamente la carga y el
// guardado contra Supabase + los derivados de datos.
//
// Comportamiento idéntico al que tenían ambos componentes antes de
// extraer este hook (refactor puro, sin cambios de conducta).
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function usePerfilData(user) {
  const [sec, setSec] = useState('datos')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [cargando, setCargando] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState(null)

  const email = user?.email || ''

  const miembroDesde = (() => {
    if (!user?.created_at) return null
    try {
      return new Date(user.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' })
    } catch { return null }
  })()

  const inicial = (nombre || email || '?').trim().charAt(0).toUpperCase() || '?'

  // Cargar perfil
  useEffect(() => {
    let activo = true
    ;(async () => {
      const { data, error } = await supabase
        .from('perfiles')
        .select('nombre, apellido')
        .eq('id', user.id)
        .maybeSingle()
      if (!activo) return
      if (!error && data) {
        setNombre(data.nombre || '')
        setApellido(data.apellido || '')
      }
      setCargando(false)
    })()
    return () => { activo = false }
  }, [user.id])

  // Guardar datos → devuelve null si ok, o el mensaje de error
  async function guardarDatos({ nombre: n, apellido: a }) {
    const { error } = await supabase
      .from('perfiles')
      .update({ nombre: n, apellido: a })
      .eq('id', user.id)
    if (error) return error.message
    setNombre(n); setApellido(a)
    return null
  }

  // Foto: preview local. TODO: subir a Supabase Storage y guardar la URL en `perfiles`.
  function onPickAvatar(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(reader.result)
    reader.readAsDataURL(file)
  }

  return {
    sec, setSec,
    nombre, setNombre,
    apellido, setApellido,
    cargando,
    avatarUrl,
    email, miembroDesde, inicial,
    guardarDatos, onPickAvatar,
  }
}
