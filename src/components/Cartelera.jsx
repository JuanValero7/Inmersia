// Formato: Plain JavaScript (.jsx)
// Vista principal de la Cartelera. Orquesta: Landing → Ficha (cuaderno).
// El mural suelto por sección ya no existe: las imágenes que se desbloquean
// viven en las placas del landing. Lee todo de Supabase con useCartelera.
//   <CartelaView onGoLectura book user onGoForo />
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { useBookBySlug } from '../hooks/useBookBySlug.js'

const VALID_SECCIONES = ['personajes', 'lugares', 'hechos', 'datos', 'notas', 'glosario', 'referencias', 'resumen']
import { useCartelera } from '../hooks/useCartelera.js'
import { useMesaInvestigacion, resumenMesa } from '../hooks/useMesaInvestigacion.js'
import { useHiloIdeas } from '../hooks/useHiloIdeas.js'
import { resumenHilo } from '../utils/hilo.js'
import { useJuegosLibro } from '../hooks/useJuegos.js'
import { getSecciones, carpetaMesa, carpetaHilo } from './cartelera/carteleraHelpers.js'
import MesaInvestigacion from './mesa/MesaInvestigacion.jsx'
import HiloIdeas from './hilo/HiloIdeas.jsx'
import ExplorarPopup from './cartelera/ExplorarPopup.jsx'
import CarteleraLanding from './cartelera/CarteleraLanding.jsx'
import Ficha from './cartelera/Ficha.jsx'
import { useOnboarding } from '../context/onboarding.jsx'
import { TEXTO_INTRO_CARTELERA, CARTEL_HECHOS } from './onboarding/textos.js'
import TutorialHint from './onboarding/TutorialHint.jsx'
import TutorialCartel from './onboarding/TutorialCartel.jsx'
import { usePistas } from '../context/pistas.jsx'
import Pista from './onboarding/Pista.jsx'
import '../styles/cartelera.css'

function Filters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="mesaGrain"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" stitchTiles="stitch" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.0" /></filter>
    </svg>
  )
}

/**
 * Tablero de investigación de un libro: personajes, lugares, hechos y datos, que se
 * van revelando según el capítulo al que ha llegado el lector.
 *
 * @param {object} props
 * @param {() => void} props.onGoLectura   vuelve al lector (el botón se llama "Lectura")
 * @param {object|null} props.book               libro; si falta se resuelve por la URL
 * @param {{ id: string }|null} props.user
 * @param {() => void} props.onGoForo
 * @param {() => void} props.onGoBiblioteca
 * @param {string|null} props.jumpToItemId       ítem al que saltar al abrir
 * @param {() => void} props.onJumpConsumed
 * @param {boolean} [props.isSuperuser]
 * @param {'negro'|'blanco'|'naranja'} [props.gatoColor]
 */
export default function CartelaView({ onGoLectura, book: bookProp, user, onGoForo, onGoBiblioteca, jumpToItemId, onJumpConsumed, isSuperuser = false, gatoColor = 'negro' }) {
  const { book, loading: bookLoading } = useBookBySlug(bookProp)
  const esNoficcion = book?.es_ficcion === false
  const secciones  = getSecciones(esNoficcion)
  const data = useCartelera(book?.libro_id || null, user?.id || null, isSuperuser)
  // La carpeta del centro es la mesa de investigación. Misma query que usa la
  // mesa: React Query la comparte, así que abrirla no vuelve a pedir nada.
  // Apagada en el Perfil (o por el profe, en su aula): carpeta de relleno y sin pedir nada.
  const juegosLibro = useJuegosLibro(book?.libro_id || null, user?.id || null)
  // En no ficción la carpeta es el hilo de ideas (migración 100), con su propio interruptor.
  const conMesa = esNoficcion ? juegosLibro.juegos.hilo : juegosLibro.juegos.mesa
  const mesa = useMesaInvestigacion(conMesa && !esNoficcion ? (book?.libro_id || null) : null, user?.id || null)
  const hilo = useHiloIdeas(conMesa && esNoficcion ? (book?.libro_id || null) : null, user?.id || null)
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const [view, setView] = useState(() => {
    const s = searchParams.get('seccion')
    if (s === 'mesa') return { kind: 'mesa', key: 'mesa' }
    return s && VALID_SECCIONES.includes(s) ? { kind: 'ficha', key: s } : { kind: 'landing', key: null }
  })
  const [fichaInitItemId, setFichaInitItemId] = useState(null)

  // Con la mesa apagada, el enlace ?seccion=mesa vuelve al tablero.
  useEffect(() => {
    if (view.kind === 'mesa' && juegosLibro.listo && !conMesa) setView({ kind: 'landing', key: null })
  }, [view.kind, juegosLibro.listo, conMesa])

  // El `state` se repasa a propósito: setSearchParams reemplaza la entrada del
  // historial y DESCARTA el state si no se le pasa. Ahí viajan el "de dónde
  // vengo" del botón atrás y el libro ya resuelto, así que sin esto abrir una
  // sección del tablero hacía que el botón atrás perdiera su destino.
  //
  // ⚠️ DOS PRECAUCIONES QUE NO SE PUEDEN QUITAR
  //
  // 1. El state se lee de un ref, NO de las dependencias. Pasarlo a
  //    setSearchParams produce un location nuevo, así que tenerlo como
  //    dependencia hace que el efecto se dispare a sí mismo sin parar: cientos
  //    de replaceState por segundo que, además de quemar CPU, pisan cualquier
  //    navegación que intente salir de aquí. El botón atrás dejaba de
  //    funcionar porque su pushState se sobrescribía al instante.
  //
  // 2. La guarda de abajo: si la URL ya dice lo que queremos, no se toca.
  //    Corta el bucle por si alguien vuelve a añadir una dependencia.
  const stateRef = useRef(location.state)
  stateRef.current = location.state

  useEffect(() => {
    const actual = searchParams.get('seccion')
    if (actual === (view.key ?? null)) return
    const opts = { replace: true, state: stateRef.current }
    if (view.key) setSearchParams({ seccion: view.key }, opts)
    else setSearchParams({}, opts)
  }, [view.key, searchParams, setSearchParams])

  // ── Tutorial (paso 'investigacion') ──
  // Vive acá arriba y no en el landing a propósito: el landing se desmonta al
  // abrir una sección, así que un estado local haría reaparecer la bienvenida
  // cada vez que el usuario vuelve al tablero.
  //   1. bienvenida bloqueante → al cerrarla el tablero queda libre;
  //   2. cartel no invasivo que recuerda ir a Hechos, SOLO dentro de una ficha.
  // El cartel no se pinta en el tablero a propósito: ahí la instrucción es
  // "toca una categoría" (ya la dan el pop-up y la pista del marco), y el "ve a
  // Hechos" se leía como una orden que competía con ella. Recién cuando el
  // usuario está viendo los detalles de una sección tiene sentido decirle cuál
  // es la próxima parada.
  // No se descarta ni se apaga al llegar a Hechos: acompaña TODO el paso y solo
  // desaparece cuando el usuario sale al Foro — ahí avanza el step y esta vista
  // se desmonta. Antes se apagaba al entrar a Hechos y el que no leía la ficha
  // se quedaba sin ninguna instrucción a la vista.
  const onboarding = useOnboarding()
  const tutorialInv = onboarding.active && onboarding.step === 'investigacion'
  const [introVista, setIntroVista] = useState(false)
  const showIntro = tutorialInv && !introVista
  const showCartel = tutorialInv && introVista && view.kind === 'ficha'

  // Pistas de primera vez (fuera del tour): en el tablero, "toca una sección";
  // dentro de una, "usa las lengüetas". Usarlo cuenta como haberla visto.
  const pistas = usePistas()
  const pistaCartelera = pistas.primera([
    view.kind === 'landing' && 'investigacion_tablero',
    view.kind === 'ficha' && 'investigacion_secciones',
  ])
  const abrirSeccion = (k) => {
    pistas.marcar(view.kind === 'landing' ? 'investigacion_tablero' : 'investigacion_secciones')
    setView({ kind: 'ficha', key: k })
  }

  useEffect(() => {
    if (!jumpToItemId || bookLoading) return
    setFichaInitItemId(jumpToItemId)
    setView({ kind: 'ficha', key: esNoficcion ? 'glosario' : 'personajes' })
    onJumpConsumed?.()
  }, [jumpToItemId, bookLoading, esNoficcion, onJumpConsumed])

  if (bookLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-warm)' }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(139,77,42,0.2)', borderTopColor: 'var(--brown-mid)' }} />
    </div>
  )

  const abrirMesa = () => setView({ kind: 'mesa', key: 'mesa' })
  const centro = esNoficcion
    ? carpetaHilo(resumenHilo(hilo.estado), hilo.cargando || !juegosLibro.listo,
      hilo.tieneHilo ? abrirMesa : null, conMesa ? null : juegosLibro.fuente)
    : carpetaMesa(resumenMesa(mesa.estado), mesa.cargando || !juegosLibro.listo,
      mesa.tieneMesa ? abrirMesa : null, conMesa ? null : juegosLibro.fuente)

  let content
  if (view.kind === 'landing') {
    content = <CarteleraLanding subtitle={book?.title} data={data} esNoficcion={esNoficcion} centro={centro}
      onOpenSection={abrirSeccion}
      onOpenList={abrirSeccion}
      onGoLectura={onGoLectura} onGoForo={onGoForo} onGoBiblioteca={onGoBiblioteca} />
  } else if (view.kind === 'mesa') {
    content = (
      <div className="cart-scene">
        <div className="topbar">
          {/* El recuadro del título es también el botón de volver, como en el lector. */}
          <button type="button" className="cart-portada-tag is-volver" onClick={() => setView({ kind: 'landing', key: null })}
            aria-label="Volver al tablero" title="Volver al tablero">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            <span className="cpt-label">{esNoficcion ? 'Hilo de ideas' : 'Mesa de investigación'}</span>
            {book?.title && <><span className="cpt-sep">·</span><span className="cpt-book">{book.title}</span></>}
          </button>
          <div className="actions">
            <ExplorarPopup onGoForo={onGoForo} onGoLectura={onGoLectura} onGoBiblioteca={onGoBiblioteca} btnClass="back-btn" />
          </div>
        </div>
        {esNoficcion
          ? <HiloIdeas libroId={book?.libro_id || null} userId={user?.id || null} gatoColor={gatoColor} />
          : <MesaInvestigacion libroId={book?.libro_id || null} userId={user?.id || null}
            personajesCartelera={data.itemsBySeccion.personajes || []} />}
      </div>
    )
  } else {
    content = <Ficha key={view.key} section={secciones.find(s => s.key === view.key)} items={data.itemsBySeccion[view.key] || []}
      initialItemId={fichaInitItemId}
      secciones={secciones}
      gatoColor={gatoColor}
      onBackPortada={() => setView({ kind: 'landing', key: null })}
      onGoLectura={onGoLectura}
      onGoForo={onGoForo}
      onGoBiblioteca={onGoBiblioteca}
      onOpenList={abrirSeccion} />
  }

  return (
    <div className="cart-root">
      <Filters />
      {content}

      {showIntro && (
        <TutorialHint
          logo
          title={TEXTO_INTRO_CARTELERA.title}
          body={TEXTO_INTRO_CARTELERA.body}
          buttonLabel={TEXTO_INTRO_CARTELERA.buttonLabel}
          onClose={() => setIntroVista(true)}
        />
      )}
      {showCartel && (
        <TutorialCartel
          emoji={CARTEL_HECHOS.emoji}
          title={CARTEL_HECHOS.title}
          body={CARTEL_HECHOS.body}
        />
      )}
      {pistaCartelera && <Pista id={pistaCartelera} bottom={64} />}
    </div>
  )
}
