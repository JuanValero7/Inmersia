// Maneja la ruta /libro/:slug para usuarios autenticados y para invitados.
// Si la navegación trae el libro en su state y corresponde al slug del URL se
// usa directamente (evita un fetch extra); si no —refresh de página, enlace
// compartido o libro distinto— se fetchea desde `libros` por slug. Para
// usuarios se embebe bibliotecas_usuarios(leido).
//
// Modo MUESTRA (`guestMode`): se entra tanto sin sesión como con sesión pero sin
// tener el libro en la biblioteca. Son los primeros 10 minutos en ambos casos
// (parrafos.en_muestra, migración 071): lo aplica la RLS y useLectorData filtra
// por la misma columna.
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { MANUAL_LIBRO_ID } from '../lib/constants.js'
import { useBibliotecaUsuarioQuery } from '../lib/queries.js'
import { evento } from '../lib/analytics.js'
import { mapLibro } from '../hooks/useBookBySlug.js'

const LoadingScreen = (
  <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,background:'var(--bg-warm)'}}>
    <div className="spinner" style={{width:32,height:32,borderWidth:3,borderColor:'rgba(139,77,42,0.2)',borderTopColor:'#8b4d2a'}}/>
    <p style={{fontFamily:"'Playfair Display',serif",color:'#9a6a4a',fontSize:'1rem'}}>Abriendo la biblioteca…</p>
  </div>
)

/**
 * Resuelve el libro de la URL y monta el Lector que toque, con la muestra de invitado
 * si no hay sesión.
 *
 * Es la ruta con más props del proyecto, y por eso la que más se beneficia de esto:
 * un `gatoColour` mal escrito no da error en React — el componente lee `gatoColor`,
 * recibe undefined, usa su valor por defecto y todo PARECE funcionar. Te enteras
 * cuando alguien dice que su gato blanco sale negro.
 *
 * @param {object} props
 * @param {React.ComponentType} props.LectorCmp   cáscara a montar (escritorio o móvil)
 * @param {{ id: string }|null} props.user
 * @param {boolean} props.isSuperuser
 * @param {'negro'|'blanco'|'naranja'} props.gatoColor
 * @param {(tab?: string) => void} props.openAuth
 * @param {boolean} props.lectorStartNotebook
 * @param {(v: boolean) => void} props.setLectorStartNotebook
 * @param {(id: string|null) => void} props.setCartelaJumpId
 */
export function LectorRoute({ LectorCmp, user, isSuperuser, gatoColor, openAuth, lectorStartNotebook, setLectorStartNotebook, setCartelaJumpId }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // El libro que traiga la navegación, si viene de dentro de la app. Antes era
  // un `currentBook` global de App.jsx; ahora viaja en el state del historial,
  // que es donde pertenece y además sobrevive al atrás del navegador.
  const currentBook = location.state?.book
  const isAuthed = !!user
  // Los libros navegan por slug o, si no tienen, por id (ver handleOpenBook).
  const matches = !!currentBook?.libro_id && (currentBook.slug === slug || currentBook.id === slug)
  const [fetchedBook, setFetchedBook] = useState(null)
  const montadoPara = useRef(null)  // libro_id para el que ya se montó el lector
  const registrado  = useRef(null)  // libro_id ya anotado en la analítica
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
  // Mientras se vuelve a pedir el MISMO libro (p. ej. al entrar desde el muro,
  // que cambia isAuthed) se sigue mostrando el que ya había: si no, el lector
  // se desmontaría y el invitado perdería la página donde iba.
  const book = matches ? currentBook : (fetchedBook?.slug === slug ? fetchedBook : null)

  // Navegar al Foro o a la Investigación apuntando de dónde se viene, para que
  // su botón atrás sepa volver al lector. Lleva también el libro, que a estas
  // alturas ya está resuelto: así esas vistas no lo vuelven a pedir.
  const irA = (destino) =>
    navigate(destino, { state: { from: location.pathname, book } })
  const libroId = book?.libro_id ?? null
  const bibliotecaQuery = useBibliotecaUsuarioQuery(user?.id)
  const filas = bibliotecaQuery.data

  const tieneLibro =
    !isAuthed                  ? false
    : libroId === MANUAL_LIBRO_ID ? true   // lo tienen todos por definición
    : bibliotecaQuery.isError  ? true      // fallo de red → abrir, la RLS manda
    : filas === undefined      ? null      // todavía sin resolver
    : filas.some(r => r.libro_id === libroId)

  // Único punto de "se abrió un libro": por aquí pasan todos los caminos
  // (biblioteca, tienda, enlace directo, refresco) y las dos plataformas.
  // Se espera a saber si es muestra o no, porque esa propiedad es media
  // pregunta: cuántos de los que curiosean acaban adquiriendo el libro.
  useEffect(() => {
    if (loading || !libroId || registrado.current === libroId) return
    if (isAuthed && tieneLibro === null) return
    registrado.current = libroId
    evento('libro_abierto', {
      libro_id: libroId,
      slug: book?.slug ?? null,
      muestra: !isAuthed || (!tieneLibro && !isSuperuser),
    })
  }, [loading, libroId, isAuthed, tieneLibro, isSuperuser, book?.slug])

  if (loading && !book) return LoadingScreen
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
      // El invitado casi siempre llegó desde el catálogo (y desde ahí vuelve a la
      // landing con su propio "Volver"); el usuario, a su Biblioteca.
      onGoBack={() => navigate(user ? '/biblioteca' : '/tienda')}
      onGoTienda={() => navigate('/tienda')}
      onGoCartelera={(itemId) => { setCartelaJumpId(itemId || null); irA(`/investigacion/${book.slug || book.id}`) }}
      onGoForo={() => irA(`/foro/${book.slug || book.id}`)}
      startWithNotebook={lectorStartNotebook}
      onNotebookStarted={() => setLectorStartNotebook(false)}
      isSuperuser={isSuperuser}
      gatoColor={gatoColor}
    />
  )
}
