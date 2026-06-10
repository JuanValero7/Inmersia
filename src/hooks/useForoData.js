// src/hooks/useForoData.js
// ─────────────────────────────────────────────────────────────
// Lógica de datos compartida del Foro de un libro.
// La consumen Foro.jsx (desktop) y ForoMobile.jsx, que aportan su
// propio chrome (tabs, navegación, tour). Aquí vive solo la carga
// del foro y del nombre del usuario contra Supabase.
//
// Lo que NO va aquí (se queda en cada componente, es UI/chrome):
//   · activeTab, navOpen  · click-outside del popup de navegación
//   · efecto del tour foro_1  · helpers de navegación (goNav)
//
// Refactor puro: comportamiento idéntico al previo.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchNombre } from '../components/foro/foroUtils.jsx'

export function useForoData(book, user) {
  const [foro, setForo] = useState(null)
  const [miNombre, setMiNombre] = useState('Lector')
  const [loading, setLoading] = useState(true)
  const [comentariosCount, setComentariosCount] = useState(0)
  const [hasSesion, setHasSesion] = useState(false)

  useEffect(() => {
    if (!book?.libro_id) { setLoading(false); return }
    supabase.from('foros').select('id').eq('libro_id', book.libro_id).maybeSingle()
      .then(({ data }) => { setForo(data || null); setLoading(false) })
  }, [book?.libro_id])

  useEffect(() => {
    fetchNombre(user.id).then(setMiNombre)
  }, [user.id])

  return {
    foro,
    miNombre,
    loading,
    comentariosCount, setComentariosCount,
    hasSesion, setHasSesion,
  }
}
