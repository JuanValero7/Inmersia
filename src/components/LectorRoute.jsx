// Maneja la ruta /libro/:slug para usuarios autenticados y para invitados.
// Si el currentBook de App corresponde al slug del URL se usa directamente
// (evita un fetch extra); si no —refresh de página, enlace directo o libro
// distinto— se fetchea desde `libros` por slug. Para usuarios se embebe
// bibliotecas_usuarios(leido); invitados leen en modo guest (máx. 2 capítulos
// por RLS).
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

const LoadingScreen = (
  <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,background:'var(--bg-warm)'}}>
    <div className="spinner" style={{width:32,height:32,borderWidth:3,borderColor:'rgba(139,77,42,0.2)',borderTopColor:'#8b4d2a'}}/>
    <p style={{fontFamily:"'Playfair Display',serif",color:'#9a6a4a',fontSize:'1rem'}}>Abriendo la biblioteca…</p>
  </div>
)

function mapLibro(data) {
  return {
    id: data.id, libro_id: data.id, slug: data.slug,
    title: data.titulo, author: data.autor || 'Desconocido',
    pages: data.paginas || 200, _baseColor: data.color || '#F2792A',
    summary: data.descripcion || '', cover: data.portada_url || null,
    es_ficcion: data.es_ficcion ?? true,
    leido: data.bibliotecas_usuarios?.[0]?.leido ?? false,
  }
}

export function LectorRoute({ LectorCmp, user, currentBook, isSuperuser, gatoColor, openAuth, lectorStartNotebook, setLectorStartNotebook, setCartelaJumpId, setForoSource, setCarteleraSource }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const isAuthed = !!user
  // Los libros navegan por slug o, si no tienen, por id (ver handleOpenBook).
  const matches = !!currentBook?.libro_id && (currentBook.slug === slug || currentBook.id === slug)
  const [fetchedBook, setFetchedBook] = useState(null)
  const [loading, setLoading] = useState(!matches)

  useEffect(() => {
    if (matches) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase.from('libros')
      .select(
        'id, slug, titulo, autor, paginas, descripcion, color, portada_url, es_ficcion'
        + (isAuthed ? ', bibliotecas_usuarios(leido)' : '')
      )
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data) { navigate(isAuthed ? '/biblioteca' : '/', { replace: true }); return }
        setFetchedBook(mapLibro(data))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [slug, isAuthed, matches, navigate])

  if (loading) return LoadingScreen

  const book = matches ? currentBook : fetchedBook
  if (!book) return null

  return (
    <LectorCmp
      book={book}
      guestMode={!user}
      onRequestAuth={(tab) => openAuth?.(tab || 'login')}
      onGoBack={() => navigate(user ? '/biblioteca' : '/')}
      onGoCartelera={(itemId) => { setCartelaJumpId(itemId || null); setCarteleraSource?.('lectura'); navigate(`/investigacion/${book.slug || book.id}`) }}
      onGoForo={() => { setForoSource('lectura'); navigate(`/foro/${book.slug || book.id}`) }}
      startWithNotebook={lectorStartNotebook}
      onNotebookStarted={() => setLectorStartNotebook(false)}
      isSuperuser={isSuperuser}
      gatoColor={gatoColor}
    />
  )
}
