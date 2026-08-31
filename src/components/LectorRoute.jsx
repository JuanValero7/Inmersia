// Maneja la ruta /libro/:slug para usuarios autenticados y para invitados.
// Si el currentBook de App corresponde al slug del URL se usa directamente
// (evita un fetch extra); si no —refresh de página, enlace directo o libro
// distinto— se fetchea desde `libros` por slug. Para usuarios se embebe
// bibliotecas_usuarios(leido).
//
// Modo MUESTRA (`guestMode`): se entra tanto sin sesión como con sesión pero sin
// tener el libro en la biblioteca. Son 2 capítulos en ambos casos — para `anon` lo
// aplica la RLS, y para `authenticated` lo aplica useLectorData recortando la lista
// (la RLS no distingue quién adquirió qué).
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { MANUAL_LIBRO_ID } from '../lib/constants.js'
import { useBibliotecaUsuarioQuery } from '../lib/queries.js'

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
  const montadoPara = useRef(null)  // libro_id para el que ya se montó el lector
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

  // ── ¿El usuario tiene este libro en su biblioteca? ──────────────────────
  // Sin esto, un usuario autenticado abría CUALQUIER libro completo escribiendo
  // la URL: el libro se resolvía por slug y `guestMode` era false por el solo
  // hecho de haber sesión, saltándose la adquisición y el límite de pendientes.
  // Se consulta siempre (también en la ruta rápida de `currentBook`, que puede
  // venir de una navegación cualquiera y no prueba propiedad).
  //   · Manual del Explorador → lo tienen todos por definición.
  //   · Superusuario → acceso completo.
  //   · Si la consulta FALLA se abre (`true`): la RLS es la autoridad real; el
  //     cliente solo decide la UI y no queremos dejar afuera a alguien que sí
  //     compró el libro por un fallo de red.
  // Se resuelve con la query COMPARTIDA de React Query (ver lib/queries.js), la
  // misma que usan Biblioteca/Tienda/Álbum: si el usuario llegó desde cualquiera
  // de ellas ya está en caché y esto no cuesta ni un viaje de red ni un spinner.
  const book = matches ? currentBook : fetchedBook
  const libroId = book?.libro_id ?? null
  const bibliotecaQuery = useBibliotecaUsuarioQuery(user?.id)
  const filas = bibliotecaQuery.data

  const tieneLibro =
    !isAuthed                  ? false
    : libroId === MANUAL_LIBRO_ID ? true   // lo tienen todos por definición
    : bibliotecaQuery.isError  ? true      // fallo de red → abrir, la RLS manda
    : filas === undefined      ? null      // todavía sin resolver
    : filas.some(r => r.libro_id === libroId)

  if (loading) return LoadingScreen
  if (!book) return null
  // Solo esperamos la PRIMERA resolución: si el lector ya está en pantalla no se
  // desmonta nunca más por esto. Importa en el caso del invitado que inicia sesión
  // sin salir del lector — ahí la query pasa de deshabilitada a cargando, y sin el
  // pestillo el lector se desmontaría y perdería la página donde iba. Mientras dura
  // esa ventana `tieneLibro` es null → sigue en modo muestra, que es justo lo que
  // el usuario ya tenía; al resolverse se desbloquea solo.
  if (isAuthed && tieneLibro === null && montadoPara.current !== libroId) return LoadingScreen
  montadoPara.current = libroId

  // Modo muestra: invitado sin sesión, o usuario que no adquirió este libro.
  const enMuestra = !user || (!tieneLibro && !isSuperuser)

  return (
    <LectorCmp
      book={book}
      guestMode={enMuestra}
      muestraMotivo={user ? 'sin-adquirir' : 'invitado'}
      onRequestAuth={(tab) => openAuth?.(tab || 'login')}
      onGoBack={() => navigate(user ? '/biblioteca' : '/')}
      onGoTienda={() => navigate('/tienda')}
      onGoCartelera={(itemId) => { setCartelaJumpId(itemId || null); setCarteleraSource?.('lectura'); navigate(`/investigacion/${book.slug || book.id}`) }}
      onGoForo={() => { setForoSource('lectura'); navigate(`/foro/${book.slug || book.id}`) }}
      startWithNotebook={lectorStartNotebook}
      onNotebookStarted={() => setLectorStartNotebook(false)}
      isSuperuser={isSuperuser}
      gatoColor={gatoColor}
    />
  )
}
