// Devuelve bookProp si ya es el libro correcto para el URL actual;
// si no (null o slug distinto), lo fetchea desde `libros` por el :slug del route.
// Permite acceso directo a /investigacion/:slug y /foro/:slug sin currentBook en memoria.
import { useState, useEffect } from 'react'
import { mapLibro as mapLibroBase } from '../lib/libros.js'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

// Fila de `libros` de Supabase → la forma que consumen las vistas.
//
// `leido` sale del join con bibliotecas_usuarios, que solo pide LectorRoute y
// solo cuando hay sesión. Sin el join el encadenamiento opcional cae en false,
// que es lo correcto: un invitado no tiene ningún libro marcado como leído.
export function mapLibro(data) {
  return { ...mapLibroBase(data), leido: data.bibliotecas_usuarios?.[0]?.leido ?? false }
}

/**
 * Resuelve el libro de la URL (/libro/:slug, /foro/:slug...).
 *
 * Si quien llama ya tiene el libro cargado y su slug coincide, lo devuelve tal cual
 * y NO pega a la red: es el camino rápido al navegar dentro de la app. Solo consulta
 * cuando el usuario entra directo por un enlace compartido.
 *
 * @param {object|null} bookProp   libro ya cargado, si lo hay
 * @returns {{ book: object|null, loading: boolean }}
 */
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
