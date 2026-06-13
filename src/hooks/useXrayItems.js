// Hook compartido entre Lector.jsx (desktop) y LectorMobile.jsx (mobile).
// Carga los personajes visibles hasta el capítulo actual desde cartelera_items,
// deduplicando por nombre y ordenando alfabéticamente.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useXrayItems(isOpen, bookId, chapterNum) {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!isOpen || !bookId) { setItems([]); return }
    let active = true
    supabase
      .from('cartelera_items')
      .select('id, nombre')
      .eq('libro_id', bookId)
      .eq('capitulo_numero', chapterNum)
      .eq('seccion', 'personajes')
      .order('capitulo_numero', { ascending: true })
      .then(({ data }) => {
        if (!active) return
        const seen = new Set()
        setItems(
          (data || [])
            .filter(it => { if (seen.has(it.nombre)) return false; seen.add(it.nombre); return true })
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        )
      })
    return () => { active = false }
  }, [isOpen, bookId, chapterNum])

  return items
}
