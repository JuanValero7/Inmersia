// Hook compartido entre Lector.jsx (desktop) y LectorMobile.jsx (mobile).
// Carga los personajes visibles hasta el capítulo actual desde cartelera_items,
// deduplicando por nombre y ordenando alfabéticamente.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Ítems de la Cartelera que ya se han revelado, para el panel de rayos X del Lector.
 *
 * Solo consulta con el panel abierto: es un panel que la mayoría de lectores no abre.
 *
 * @param {boolean} isOpen
 * @param {string} bookId
 * @param {number} chapterNum   se revela lo de capítulo_número <= este
 * @param {'personajes'|'lugares'|'hechos'|'datos'} [sección]
 * @returns {object[]}
 */
export function useXrayItems(isOpen, bookId, chapterNum, seccion = 'personajes') {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!isOpen || !bookId) { setItems([]); return }
    let active = true
    supabase
      .from('cartelera_items')
      .select('id, nombre')
      .eq('libro_id', bookId)
      .lte('capitulo_numero', chapterNum)
      .eq('seccion', seccion)
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
  }, [isOpen, bookId, chapterNum, seccion])

  return items
}
