// src/hooks/useResena.js
// ─────────────────────────────────────────────────────────────
// "Mi reseña" de un libro (tabla resenas_libros), en UN solo sitio.
// La usan el lector (useLectorData, al terminar el libro) y la ficha de la
// Biblioteca (BibBookModal en escritorio, BibBookSheet en móvil). Antes el
// lector tenía su propia copia de la consulta y del guardado; ahora comparten
// la caché de React Query, así que lo que se escribe en un sitio se ve en el
// otro sin volver a pedirlo.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { guardar, AVISOS } from '../lib/guardar.js'
import { queryKeys } from '../lib/queries.js'

export const RESENA_MAX = 1000

/**
 * Reseña del usuario sobre un libro: la suya si ya existe, y el formulario para
 * crearla o editarla.
 *
 * @param {object} p
 * @param {string|null|undefined} p.libroId
 * @param {string|null|undefined} p.userId
 * @param {boolean} p.activo   solo se pide con el libro terminado (y nunca en el Manual)
 * @returns {object} miResena, el formulario y submitResena (→ true si se guardó)
 */
export function useResena({ libroId, userId, activo }) {
  const queryClient = useQueryClient()
  const clave = queryKeys.miResena(userId, libroId)
  const { data: miResena = null } = useQuery({
    queryKey: clave,
    queryFn: async () => {
      const { data, error } = await supabase.from('resenas_libros').select('rating, texto')
        .eq('user_id', userId).eq('libro_id', libroId).maybeSingle()
      if (error) throw error
      return data || null
    },
    enabled: !!activo && !!userId && !!libroId,
    staleTime: 60_000,
  })

  const [form, setForm] = useState({ rating: 0, texto: '' })
  const [modoForm, setModoForm] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // El formulario arranca con la reseña guardada, si la hay.
  useEffect(() => {
    if (miResena) setForm({ rating: miResena.rating, texto: miResena.texto || '' })
  }, [miResena])

  async function submitResena() {
    if (!form.rating || (form.texto?.length ?? 0) > RESENA_MAX) return false
    setEnviando(true)
    const { ok } = await guardar(supabase.from('resenas_libros').upsert(
      { user_id: userId, libro_id: libroId, rating: form.rating, texto: form.texto || null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,libro_id' }), { que: 'reseña', aviso: AVISOS.resena })
    setEnviando(false)
    if (!ok) return false
    queryClient.setQueryData(clave, { rating: form.rating, texto: form.texto })
    setModoForm(false)
    return true
  }

  return { miResena, form, setForm, modoForm, setModoForm, enviando, submitResena }
}
