// Maneja la ruta /libro/:slug para usuarios autenticados y para invitados.
// Usuarios: usa el currentBook ya cargado en App (evita un fetch extra).
// Invitados: fetcha el libro por slug desde `libros` (tabla pública) y
//            renderiza el Lector en modo guest (máx. 2 capítulos por RLS).
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
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
    pages: data.paginas || 200, _baseColor: data.color || '#cf8a6e',
    summary: data.descripcion || '', cover: data.portada_url || null,
    es_ficcion: data.es_ficcion ?? true, leido: false,
  }
}

export function LectorRoute({ LectorCmp, user, currentBook, isSuperuser, lectorStartNotebook, setLectorStartNotebook, setCartelaJumpId, setForoSource }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [guestBook, setGuestBook] = useState(null)
  const [guestLoading, setGuestLoading] = useState(!user)

  useEffect(() => {
    if (user) { setGuestLoading(false); return }
    let cancelled = false
    setGuestLoading(true)
    supabase.from('libros')
      .select('id, slug, titulo, autor, paginas, descripcion, color, portada_url, es_ficcion')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data) { navigate('/', { replace: true }); return }
        setGuestBook(mapLibro(data))
        setGuestLoading(false)
      })
    return () => { cancelled = true }
  }, [slug, user, navigate])

  if (guestLoading) return LoadingScreen

  const book = user ? currentBook : guestBook
  if (user && !book) return <Navigate to="/biblioteca" replace />
  if (!book) return null

  return (
    <LectorCmp
      book={book}
      guestMode={!user}
      onRequestAuth={(tab) => navigate('/auth', { state: { tab: tab || 'login' } })}
      onGoBack={() => navigate(user ? '/biblioteca' : '/')}
      onGoCartelera={(itemId) => { setCartelaJumpId(itemId || null); navigate(`/cartelera/${book.slug || book.id}`) }}
      onGoForo={() => { setForoSource('lectura'); navigate(`/foro/${book.slug || book.id}`) }}
      startWithNotebook={lectorStartNotebook}
      onNotebookStarted={() => setLectorStartNotebook(false)}
      isSuperuser={isSuperuser}
    />
  )
}
