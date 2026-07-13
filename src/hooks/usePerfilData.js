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
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { usePerfilQuery, queryKeys } from '../lib/queries.js'

export function usePerfilData(user) {
  const [sec, setSec] = useState('datos')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const queryClient = useQueryClient()

  const email = user?.email || ''

  const miembroDesde = (() => {
    if (!user?.created_at) return null
    try {
      return new Date(user.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' })
    } catch { return null }
  })()

  const inicial = (nombre || email || '?').trim().charAt(0).toUpperCase() || '?'

  // Perfil: query compartida con Biblioteca (ver src/lib/queries.js)
  const perfilQuery = usePerfilQuery(user.id)
  const cargando = perfilQuery.isLoading
  useEffect(() => {
    if (perfilQuery.data) {
      setNombre(perfilQuery.data.nombre || '')
      setApellido(perfilQuery.data.apellido || '')
    }
  }, [perfilQuery.data])

  // Guardar datos → devuelve null si ok, o el mensaje de error
  async function guardarDatos({ nombre: n, apellido: a }) {
    const { error } = await supabase
      .from('perfiles')
      .update({ nombre: n, apellido: a })
      .eq('id', user.id)
    if (error) return error.message
    setNombre(n); setApellido(a)
    queryClient.setQueryData(queryKeys.perfil(user.id), { nombre: n, apellido: a })
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
