// src/hooks/useResena.js
// ─────────────────────────────────────────────────────────────
// Lógica de "Mi reseña" de un libro (tabla resenas_libros).
// La consumen BibBookModal.jsx (desktop) y BibBookSheet.jsx (mobile),
// que solo renderizan las estrellas y el formulario.
// Refactor puro: comportamiento idéntico al previo.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useResena(book, user, esManual) {
  const [miResena, setMiResena] = useState(null)
  const [form, setForm] = useState({ rating: 0, texto: '' })
  const [modoForm, setModoForm] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!book.leido || esManual || !user) return
    let cancelled = false
    supabase.from('resenas_libros').select('rating, texto').eq('user_id', user.id).eq('libro_id', book.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setMiResena(data || null)
        if (data) setForm({ rating: data.rating, texto: data.texto || '' })
      })
    return () => { cancelled = true }
  }, [book.id, book.leido, esManual, user])

  async function submitResena() {
    if (!form.rating || (form.texto?.length ?? 0) > 1000) return
    setEnviando(true)
    await supabase.from('resenas_libros').upsert(
      { user_id: user.id, libro_id: book.id, rating: form.rating, texto: form.texto || null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,libro_id' })
    setMiResena({ rating: form.rating, texto: form.texto })
    setModoForm(false); setEnviando(false)
  }

  return { miResena, form, setForm, modoForm, setModoForm, enviando, submitResena }
}
