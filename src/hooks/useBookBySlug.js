// Devuelve bookProp si ya es el libro correcto para el URL actual;
// si no (null o slug distinto), lo fetchea desde `libros` por el :slug del route.
// Permite acceso directo a /investigacion/:slug y /foro/:slug sin currentBook en memoria.
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

function mapLibro(data) {
  return {
    id: data.id, libro_id: data.id, slug: data.slug,
    title: data.titulo, author: data.autor || 'Desconocido',
    pages: data.paginas || 200, _baseColor: data.color || '#cf8a6e',
    summary: data.descripcion || '', cover: data.portada_url || null,
    es_ficcion: data.es_ficcion ?? true, leido: false,
  }
}

export function useBookBySlug(bookProp) {
  const { slug } = useParams()
  const alreadyLoaded = !!bookProp?.libro_id && bookProp.slug === slug
  const [fetched, setFetched] = useState(null)
  const [loading, setLoading] = useState(!alreadyLoaded)

  useEffect(() => {
    if (alreadyLoaded) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase.from('libros')
      .select('id, slug, titulo, autor, paginas, descripcion, color, portada_url, es_ficcion')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setFetched(data ? mapLibro(data) : null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [slug, alreadyLoaded])

  return { book: alreadyLoaded ? bookProp : fetched, loading }
}
