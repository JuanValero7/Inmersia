// =============================================================
// INMERSIA · BibliotecaMobile — cáscara mobile del home.
// MISMAS props que VistaBiblioteca y MISMO wiring de datos
// (perfil, categorías + CRUD, libros, asignar categoría, reseñas
// vía la hoja). Cambia sólo la capa visual: header compacto, hero
// "Seguir leyendo" con el gato, "Últimos abiertos" (máx 3), y los
// estantes por categoría (scroll-H, cap 15/fila) con Filtrar y
// Gestionar como pantallas propias.
// =============================================================
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useBiblioteca } from '../../hooks/useBiblioteca.js'
import { useCompraEnBiblioteca, filtrarPorBusqueda, agruparEnEstantes, ultimosAbiertos } from '../biblioteca/miBiblioteca.js'
import { SIN_CATEGORIA_ID, MANUAL_LIBRO_ID } from '../biblioteca/constants.js'
import { INK, BookCover, Skel } from './biblioteca/bibmHelpers.jsx'
import { imgUrl } from '../../lib/img.js'
import { useOnboarding } from '../../context/onboarding.jsx'
import { usePistas } from '../../context/pistas.jsx'
import Pista from '../onboarding/Pista.jsx'
import WelcomePopup from '../onboarding/WelcomePopup.jsx'
import TutorialHint from '../onboarding/TutorialHint.jsx'
import { TEXTO_ALBUM_HINT, TEXTO_TIENDA_FINAL } from '../onboarding/textos.js'
import { MobileCategoryBrowser } from './biblioteca/BibCategoryBrowserMobile.jsx'
import { UltimosAbiertosMobile, LibroCardsMobile } from './biblioteca/UltimosAbiertosMobile.jsx'
import BibBookSheet from './biblioteca/BibBookSheet.jsx'
import { FilterScreen, ManageScreen } from './biblioteca/BibScreensMobile.jsx'
import FichaLibroMobile from './tienda/FichaLibroMobile.jsx'
import '../../styles/tienda.css' // base de las portadas .book-* que usan las tarjetas de Novedades / Para ti
import '../../styles/biblioteca.mobile.css'
import LeerComoSheet from '../comunidades/LeerComoSheet.jsx'
import ComunidadPanel from '../comunidades/ComunidadPanel.jsx'
import { Sello } from '../comunidades/comunidadesShared.jsx'
import { useComunidadActiva } from '../../hooks/useComunidades.js'
import { useCatalogoLibrosQuery } from '../../lib/queries.js'

// Tira inferior desacoplada del hero: "Seguir leyendo" queda solo en el hero;
// acá el usuario alterna entre sus últimos abiertos y las sugerencias de la
// Tienda (Novedades / Para ti), todas con el mismo formato de tarjeta.
const LANE_TABS = [
  { id: 'ultimos', label: 'Últimos abiertos' },
  { id: 'novedades', label: 'Novedades' },
  { id: 'recom', label: 'Para ti' },
]

// ── Esqueleto de carga del hero + la tira ───────────────────
// El marco no depende de datos: la tarjeta del hero con su gato, y las tres
// pestañas de la tira (inertes, porque todavía no hay nada detrás). Solo la
// portada, los textos y las tarjetas esperan como bloques.
function HeroLaneSkeleton({ gatoColor }) {
  return (
    <>
      <div className="bibm-hero">
        <img className="bibm-hero-cat" src={`/assets/wallpapers/gato-${gatoColor}-7.webp`} alt="" />
        <div className="bibm-hero-fade" />
        <div className="bibm-hero-inner" style={{ position: 'relative', zIndex: 2 }}>
          <div className="bibm-hero-body">
            {/* portada de 190px de alto → 131 de ancho (aspect-ratio 210/305) */}
            <Skel w={131} h={190} r={12} style={{ transform: 'rotate(-5deg)' }} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skel w="90%" h={19} />
              <Skel w="60%" h={13} />
              <Skel w="100%" h={10} style={{ marginTop: 10 }} />
              <Skel w={118} h={34} r={999} style={{ marginTop: 10 }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 30 }}>
        <div className="bibm-lane-tabs" aria-hidden="true">
          {LANE_TABS.map((t, i) => (
            <span key={t.id} className={'bibm-lane-tab' + (i === 0 ? ' active' : '')} style={{ textAlign: 'center' }}>{t.label}</span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1].map(i => (
            <div key={i} className="bibm-skel-card">
              {/* portada de 100px de alto → 69 de ancho, como en <BibCard> */}
              <Skel w={69} h={100} r={10} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Skel w="85%" h={14} />
                <Skel w="55%" h={11} />
                <Skel w="70%" h={9} style={{ marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default function BibliotecaMobile({ user, gatoColor, lastOpenedBookIds, isSuperuser, onOpenBook, onGoTienda, onGoCatalogo, onGoPerfil, onGoAlbum, onGoForo, onGoInvestigacion, onGoNotebook, onGoComunidades }) {
  // Lógica de datos compartida con Biblioteca desktop (ver src/hooks/useBiblioteca.js)
  const {
    loadingBooks, categories, categoriasMap, books, featured, novedades, recomendaciones, displayName, inicial,
    createCategoria, updateCategoria,
    deleteCategoria: deleteCategoriaBase,
    assignCategoriaToBook: assignCategoriaToBookBase,
    fetchUserBooks,
  } = useBiblioteca(user, lastOpenedBookIds)

  // Estado de UI/chrome (no compartido)
  const [selectedBook, setSelectedBook] = React.useState(null)
  const [selectedLibro, setSelectedLibro] = React.useState(null) // libro de Novedades/Para ti (aún no adquirido)

  // Comunidades: hoja "Leer como" y panel "Ver comunidad". Al volver de
  // /comunidades tras unirse o crear, llega { verComunidad, bienvenida } en
  // el state de la navegación: se abre el panel una vez y se limpia el state
  // para que no reaparezca al recargar.
  const location = useLocation()
  const navigate = useNavigate()
  const { activa } = useComunidadActiva(user?.id)
  const [hojaLeerComo, setHojaLeerComo] = React.useState(false)
  const [panelComunidad, setPanelComunidad] = React.useState(() =>
    location.state?.verComunidad ? { id: location.state.verComunidad, bienvenida: location.state.bienvenida || null } : null)
  React.useEffect(() => {
    if (location.state?.verComunidad) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  // "Leer con el club": si el libro ya es mío se abre; si no, su ficha del
  // catálogo con "Comenzar a leer" (la misma ficha de la Tienda).
  const { data: catalogo = [] } = useCatalogoLibrosQuery()
  const leerLibroDeComunidad = React.useCallback((libroId) => {
    setPanelComunidad(null)
    const mio = books.find(b => b.id === libroId)
    if (mio) { onOpenBook(mio); return }
    const delCatalogo = catalogo.find(l => l.id === libroId)
    if (delCatalogo) setSelectedLibro(delCatalogo)
  }, [books, catalogo, onOpenBook])
  const [search, setSearch] = React.useState('')
  // El input usa `search` (tecleo instantáneo); el filtrado usa el valor diferido
  // para no recalcular estantes/grupos en cada pulsación.
  const deferredSearch = React.useDeferredValue(search)
  const [activeCategory, setActiveCategory] = React.useState(null) // null | uuid | SIN_CATEGORIA_ID
  const [laneTab, setLaneTab] = React.useState('ultimos') // tira inferior: 'ultimos' | 'novedades' | 'recom'
  const [screen, setScreen] = React.useState(null) // null | 'filter' | 'manage'

  // ── Wrappers que sincronizan estado de UI tras las primitivas del hook ──
  async function deleteCategoria(id) {
    const err = await deleteCategoriaBase(id)
    if (!err && activeCategory === id) setActiveCategory(null)
    return err
  }
  async function assignCategoriaToBook(catalogoLibroId, categoria_id) {
    if (catalogoLibroId === MANUAL_LIBRO_ID) return
    await assignCategoriaToBookBase(catalogoLibroId, categoria_id)
    setSelectedBook(prev => prev && prev.id === catalogoLibroId ? { ...prev, categoria_id } : prev)
  }

  // Compra desde el panel in-place (Novedades/Para ti) — mismas primitivas y
  // mismo límite de pendientes que la Tienda (ver useCompraLibro).
  const compra = useCompraEnBiblioteca({ books, user, isSuperuser, onOpenBook,
    alAdquirir: async () => { await fetchUserBooks(); setSelectedLibro(null) } })
  const handleComprarLibro = compra.comprar
  const handleEmpezarLeerLibro = compra.empezarALeer


  // ── Onboarding ──
  const onboarding = useOnboarding()
  const manualBook = React.useMemo(() => books.find(b => b.id === MANUAL_LIBRO_ID), [books])
  const showWelcome    = onboarding.active && onboarding.step === 'bienvenida'
  const showAlbumHint  = onboarding.active && onboarding.step === 'album'
  const showTiendaHint = onboarding.active && onboarding.step === 'tienda_final'
  // Pistas de primera vez de la Biblioteca (fuera del tour), en este orden: la
  // Tienda (último aviso de "Empezar a leer"), el Álbum cuando ya leyó algo, y
  // las Comunidades.
  const pistas = usePistas()
  const yaLeyoAlgo = books.some(b => b.id !== MANUAL_LIBRO_ID && (b.progress ?? 0) > 0)
  const pistaBiblioteca = pistas.primera(['tienda', yaLeyoAlgo && 'album', 'comunidades'])
  const openManual = React.useCallback(() => {
    if (!manualBook) return
    onboarding.advance('bienvenida')   // bienvenida → manual
    onOpenBook(manualBook)
  }, [manualBook, onboarding, onOpenBook])
  // "Empezar a leer": sin tour, directo a elegir su primer libro.
  const empezarALeer = React.useCallback(() => {
    onboarding.skip()
    onGoCatalogo()
  }, [onboarding, onGoCatalogo])

  // ── Filtrado + agrupado (derivados de UI) ──
  const searchedBooks = React.useMemo(() => filtrarPorBusqueda(books, deferredSearch), [books, deferredSearch])

  const groups = React.useMemo(() => agruparEnEstantes(categories, searchedBooks, activeCategory), [categories, searchedBooks, activeCategory])

  const counts = React.useMemo(() => {
    const m = { __all: books.filter(b => b.id !== MANUAL_LIBRO_ID).length }
    categories.forEach(c => { m[c.id] = books.filter(b => b.categoria_id === c.id).length })
    m[SIN_CATEGORIA_ID] = books.filter(b => !b.categoria_id).length
    return m
  }, [books, categories])

  // Últimos abiertos (máx 3) — featured viene del hook; se excluye para no duplicar "Seguir leyendo"
  const ultimos = React.useMemo(() => ultimosAbiertos(books, lastOpenedBookIds, featured, 3), [books, lastOpenedBookIds, featured])
  const ultimosVisible = React.useMemo(() => {
    if (!deferredSearch) return ultimos
    const ids = new Set(searchedBooks.map(b => b.id))
    return ultimos.filter(b => ids.has(b.id))
  }, [ultimos, searchedBooks, deferredSearch])

  const collectionCount = books.filter(b => b.id !== MANUAL_LIBRO_ID).length
  const activeName = activeCategory
    ? (categoriasMap[activeCategory]?.nombre || (activeCategory === SIN_CATEGORIA_ID ? 'Sin categoría' : ''))
    : null

  const openBook = (book) => { setSelectedBook(book) }
  const closeSheet = () => { setSelectedBook(null) }

  return (
    <div className="bibm-screen">
      {/* Header */}
      <div className="bibm-header-wrap">
        <div className="bibm-header">
          <div className="bibm-logo"><img src="/assets/inmersia-logo2.png" alt="Inmersia" /></div>
          <button className="bibm-icon-btn bibm-com-btn" onClick={() => { pistas.marcar('comunidades'); setHojaLeerComo(true) }}
            title={activa ? `Leyendo con ${activa.nombre}` : 'Comunidades'}>
            {activa
              ? <Sello c={activa} tam="sm" />
              : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.5"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15 14.3c2.6-.3 4.9 1.2 5.5 4.2"/></svg>}
            <span className="bibm-com-txt">{activa ? activa.nombre : 'Comunidades'}</span>
          </button>
          <button className="bibm-avatar" onClick={onGoPerfil} title="Mi perfil">{inicial}</button>
        </div>
        {/* Tienda y Álbum, con nombre, debajo de la cabecera (antes eran dos
            íconos en el centro de la cabecera, que ahora ocupa Comunidades). */}
        <div className="bibm-nav-row">
          <button className="bibm-icon-btn" onClick={onGoTienda} title="Ir a la Tienda">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4m1.6 8L5 5H3m4 8a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Tienda
          </button>
          <button className="bibm-icon-btn" onClick={onGoAlbum} title="Mi álbum">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="3" width="7" height="5" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="12" width="7" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="16" width="7" height="5" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Álbum
          </button>
        </div>
      </div>

      {/* Contenido — una sola tira de scroll general */}
      <div className="bibm-noscroll bibm-scroll">
        <div className="bibm-greeting">¡Hola, {displayName.split(' ')[0]}!</div>

        {loadingBooks ? <HeroLaneSkeleton gatoColor={gatoColor} /> : (<>
          {/* Hero "Seguir leyendo" con el gato — único elemento del hero */}
          <div className="bibm-hero">
            {featured?.heroUrlMobile
              ? <img className="bibm-hero-bg" src={imgUrl(featured.heroUrlMobile, { width: 800 })} alt="" />
              : <img className="bibm-hero-cat" src={`/assets/wallpapers/gato-${gatoColor}-7.webp`} alt="" />}
            {/* Velo crema para legibilidad: solo en el fallback (sin imagen de fondo), igual que en desktop. */}
            {!featured?.heroUrlMobile && <div className="bibm-hero-fade" />}
            <div className="bibm-hero-inner" style={{ position: 'relative', zIndex: 2 }}>
              {featured ? (
                <div className="bibm-hero-body">
                  <div className="bibm-hero-cover" onClick={(e) => openBook(featured, e.currentTarget.getBoundingClientRect())}>
                    <BookCover book={featured} h={190} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div className="bibm-hero-ttl">{featured.title}</div>
                    <div className="bibm-hero-auth">{featured.author}</div>
                    {typeof featured.progress === 'number' && (
                      <div className="bibm-hero-prog">
                        {featured.tiempoLeido && (
                          <span className="bibm-hero-tiempo">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                            Llevas {featured.tiempoLeido}
                          </span>
                        )}
                        <div className="bibm-bar" role="progressbar" aria-valuenow={Math.round(featured.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de lectura"><div style={{ width: `${Math.round(featured.progress * 100)}%` }} /></div>
                      </div>
                    )}
                    <button className="bibm-btn bibm-hero-cta" onClick={(e) => openBook(featured, e.currentTarget.getBoundingClientRect())}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      {typeof featured.progress === 'number' ? 'Continuar' : 'Abrir libro'}
                    </button>
                  </div>
                </div>
              ) : <div className="bibm-hero-empty">Cuando empieces a leer un libro aparecerá acá para que retomes donde lo dejaste.</div>}
            </div>
          </div>

          {/* Solapa bajo el hero: lo último desbloqueado en la Cartelera.
              Se SUMA debajo (asoma por detrás del borde) en vez de robarle
              alto al hero, que no puede crecer. */}
          {featured?.investigacion && (
            <button className="bibm-hero-solapa" onClick={() => onGoInvestigacion(featured)}>
              <span className="bibm-hero-solapa-ico">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
              </span>
              <span className="bibm-hero-solapa-txt">
                <span className="bibm-hero-solapa-kicker">Nuevo en la investigación</span>
                <span className="bibm-hero-solapa-nombre">
                  {featured.investigacion.nombre}
                  {featured.investigacion.mas > 0 && ` y ${featured.investigacion.mas} ${featured.investigacion.mas === 1 ? 'ficha' : 'fichas'} más`}
                </span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>
          )}

          {/* Tira inferior: Últimos abiertos / Novedades / Para ti */}
          {(ultimosVisible.length > 0 || novedades.length > 0 || recomendaciones.length > 0) && (
            <div style={{ marginTop: 30 }}>
              <div className="bibm-lane-tabs">
                {LANE_TABS.map(t => (
                  <button key={t.id} className={'bibm-lane-tab' + (laneTab === t.id ? ' active' : '')} onClick={() => setLaneTab(t.id)}>{t.label}</button>
                ))}
              </div>
              {laneTab === 'ultimos' && (
                ultimosVisible.length > 0
                  ? <UltimosAbiertosMobile books={ultimosVisible} onOpen={openBook} />
                  : <div className="bibm-lane-empty">Todavía no abriste ningún libro. Cuando empieces a leer, aparecerán acá.</div>
              )}
              {laneTab === 'novedades' && (
                novedades.length > 0
                  ? <LibroCardsMobile libros={novedades.slice(0, 3)} onOpen={setSelectedLibro} badge="Recién llegado" />
                  : <div className="bibm-lane-empty">Pronto verás acá los libros recién llegados a la biblioteca. <span className="bibm-soon">Próximamente</span></div>
              )}
              {laneTab === 'recom' && (
                recomendaciones.length > 0
                  ? <LibroCardsMobile libros={recomendaciones.slice(0, 3)} onOpen={setSelectedLibro} badge="Para ti" />
                  : <div className="bibm-lane-empty">Estamos preparando recomendaciones a tu medida. <span className="bibm-soon">Próximamente</span></div>
              )}
            </div>
          )}
        </>)}

        {/* Tu colección — encabezado */}
        <div style={{ marginTop: 36 }}>
          <div className="bibm-col-head">
            <div className="bibm-sec-ttl">Tu colección {loadingBooks
                ? <Skel w={58} h={12} r={7} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                : <span className="bibm-sec-sub">{collectionCount} {collectionCount === 1 ? 'libro' : 'libros'}</span>}</div>
            {/* El buscador filtra la colección, así que vive con ella (antes
                iba fijo bajo la cabecera). */}
            <div className="bibm-search">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={INK} strokeWidth="2.4"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, autor…" />
              {search && <button className="bibm-search-x" onClick={() => setSearch('')} aria-label="Limpiar">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round"/></svg>
              </button>}
            </div>
            <div className="bibm-col-actions">
              <img className="bibm-manage-gato" src={`/assets/wallpapers/gato-${gatoColor}-7.webp`} alt="" loading="lazy" />
              <button className={'bibm-act' + (activeCategory ? ' on' : '')} onClick={() => setScreen('filter')}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3"><path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round"/></svg>
                Filtrar{activeCategory ? ' · 1' : ''}
              </button>
              <button className="bibm-act manage" onClick={() => setScreen('manage')}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Gestionar
              </button>
            </div>
          </div>

          {activeCategory && (
            <div className="bibm-active-filter">
              <span>Mostrando <strong>{activeName}</strong></span>
              <button onClick={() => setActiveCategory(null)}>Quitar ✕</button>
            </div>
          )}
        </div>

        {/* Colección estilo Kindle: mosaicos de categoría paginados (6 por
            pantalla, puntitos si hay más) y, al tocar uno, drill-in a las
            portadas de esa categoría. Sin scroll anidado. */}
        <div style={{ marginTop: 22 }}>
          {loadingBooks
            ? <div className="bibm-skel-tiles">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="bibm-skel-tile">
                    <Skel w="70%" h={14} />
                    <Skel w="40%" h={11} />
                  </div>
                ))}
              </div>
            : <MobileCategoryBrowser groups={groups} onOpen={openBook} />}
        </div>
      </div>

      {selectedBook && (
        <BibBookSheet
          book={books.find(b => b.id === selectedBook.id) || selectedBook}
          user={user}
          categories={categories}
          onClose={closeSheet}
          onOpenBook={(book) => { closeSheet(); onOpenBook(book) }}
          onGoForo={(book) => { closeSheet(); onGoForo(book) }}
          onGoNotebook={(book) => { closeSheet(); onGoNotebook(book) }}
          onAssignCategory={assignCategoriaToBook}
        />
      )}

      {hojaLeerComo && (
        <LeerComoSheet user={user} onClose={() => setHojaLeerComo(false)}
          onVer={(id) => setPanelComunidad({ id, bienvenida: null })}
          onIr={(vista) => { setHojaLeerComo(false); onGoComunidades(vista) }} />
      )}
      {panelComunidad && (
        <ComunidadPanel user={user} comunidadId={panelComunidad.id} bienvenida={panelComunidad.bienvenida}
          modo="hoja" onClose={() => setPanelComunidad(null)} onLeerLibro={leerLibroDeComunidad} />
      )}
      {selectedLibro && (
        <FichaLibroMobile
          key={selectedLibro.id}
          libro={selectedLibro}
          user={user}
          yaAdquirido={false}
          bloqueado={compra.bloqueado}
          onComprar={() => handleComprarLibro(selectedLibro)}
          onEmpezarLeer={() => handleEmpezarLeerLibro(selectedLibro)}
          onCerrar={() => setSelectedLibro(null)}
          origen="biblioteca"
        />
      )}

      {/* Pantallas */}
      {screen === 'filter' && (
        <FilterScreen categories={categories} counts={counts} active={activeCategory}
          onPick={setActiveCategory} onClose={() => setScreen(null)} />
      )}
      {screen === 'manage' && (
        <ManageScreen categories={categories} counts={counts}
          onCreate={createCategoria} onUpdate={updateCategoria} onDelete={deleteCategoria}
          onClose={() => setScreen(null)} />
      )}

      {showWelcome && (
        <WelcomePopup
          user={user}
          manualReady={!!manualBook}
          onOpenManual={openManual}
          onStartReading={empezarALeer}
        />
      )}

      {showAlbumHint && (
        <TutorialHint
          logo
          title={TEXTO_ALBUM_HINT.title}
          body={TEXTO_ALBUM_HINT.body}
          buttonLabel={TEXTO_ALBUM_HINT.buttonLabel}
          onClose={onGoAlbum}
        />
      )}

      {showTiendaHint && (
        <TutorialHint
          logo
          title={TEXTO_TIENDA_FINAL.title}
          body={TEXTO_TIENDA_FINAL.body}
          buttonLabel={TEXTO_TIENDA_FINAL.buttonLabel}
          onClose={() => onboarding.advance('tienda_final')}   // tienda_final → tienda
        />
      )}

      {pistaBiblioteca && (
        <Pista id={pistaBiblioteca} movil
          accion={pistaBiblioteca === 'album' ? { label: 'Ir al Álbum', onClick: onGoAlbum }
            : pistaBiblioteca === 'tienda' ? { label: 'Ir a la Tienda', onClick: onGoTienda }
            : { label: 'Ver comunidades', onClick: () => setHojaLeerComo(true) }} />
      )}
    </div>
  )
}
