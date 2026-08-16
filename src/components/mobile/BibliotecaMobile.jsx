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
import { useBiblioteca } from '../../hooks/useBiblioteca.js'
import { useCompraLibro, LIMITE_PENDIENTES } from '../../hooks/useCompraLibro.js'
import { SIN_CATEGORIA_ID, COLOR_DEFAULT, MANUAL_LIBRO_ID } from '../biblioteca/constants.js'
import { INK, BookCover } from './biblioteca/bibmHelpers.jsx'
import { imgUrl } from '../../lib/img.js'
import { saludoBienvenida } from '../../lib/genero.js'
import { useOnboarding } from '../../context/onboarding.jsx'
import WelcomePopup from '../onboarding/WelcomePopup.jsx'
import TutorialHint from '../onboarding/TutorialHint.jsx'
import { TEXTO_ALBUM_HINT, TEXTO_TIENDA_FINAL } from '../onboarding/textos.js'
import { MobileCategoryBrowser } from './biblioteca/BibCategoryBrowserMobile.jsx'
import { UltimosAbiertosMobile, LibroCardsMobile } from './biblioteca/UltimosAbiertosMobile.jsx'
import BibBookSheet from './biblioteca/BibBookSheet.jsx'
import { FilterScreen, ManageScreen } from './biblioteca/BibScreensMobile.jsx'
import PanelLibro from '../tienda/PanelLibro.jsx'
import LibroReel from '../tienda/LibroReel.jsx'
import '../../styles/tienda.css' // estilos de PanelLibro/LibroReel (.bkp-*, .reel-*) — sin esto renderizan sin overlay/estilos
import '../../styles/biblioteca.mobile.css'

// Tira inferior desacoplada del hero: "Seguir leyendo" queda solo en el hero;
// acá el usuario alterna entre sus últimos abiertos y las sugerencias de la
// Tienda (Novedades / Para ti), todas con el mismo formato de tarjeta.
const LANE_TABS = [
  { id: 'ultimos', label: 'Últimos abiertos' },
  { id: 'novedades', label: 'Novedades' },
  { id: 'recom', label: 'Para ti' },
]

export default function BibliotecaMobile({ user, gatoColor, lastOpenedBookIds, isSuperuser, onOpenBook, onGoTienda, onGoPerfil, onGoAlbum, onGoForo, onGoNotebook }) {
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
  const [reelLibro, setReelLibro] = React.useState(null)
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
  const pendientes = React.useMemo(() => books.filter(b => b.id !== MANUAL_LIBRO_ID && !b.leido).length, [books])
  const { comprar: comprarLibro, comprarYLeer: comprarYLeerLibro } = useCompraLibro(user, isSuperuser, onOpenBook)
  const handleComprarLibro = async (libro) => {
    const { error } = await comprarLibro(libro, { pendientes })
    if (!error) { await fetchUserBooks(); setSelectedLibro(null) }
  }
  const handleEmpezarLeerLibro = async (libro) => {
    const { error } = await comprarYLeerLibro(libro, { pendientes, tieneLibro: () => false })
    if (!error) { await fetchUserBooks(); setSelectedLibro(null) }
  }

  // Al cerrar el Preview: si se abrió desde la lista (todavía sin panel), abre
  // el PanelLibro — mismo recorrido que CatalogoInteriorMobile.handleReelClose.
  // Si ya había un panel abierto (Preview lanzado desde su botón interno), no
  // vuelve a abrirlo.
  function handleReelClose() {
    if (!selectedLibro) setSelectedLibro(reelLibro)
    setReelLibro(null)
  }

  // ── Onboarding ──
  const onboarding = useOnboarding()
  const manualBook = React.useMemo(() => books.find(b => b.id === MANUAL_LIBRO_ID), [books])
  const showWelcome    = onboarding.active && onboarding.step === 'bienvenida'
  const showAlbumHint  = onboarding.active && onboarding.step === 'album'
  const showTiendaHint = onboarding.active && onboarding.step === 'tienda_final'
  const openManual = React.useCallback(() => {
    if (!manualBook) return
    onboarding.advance('bienvenida')   // bienvenida → manual
    onOpenBook(manualBook)
  }, [manualBook, onboarding, onOpenBook])

  // ── Filtrado + agrupado (derivados de UI) ──
  const searchedBooks = React.useMemo(() => books.filter(b => {
    const q = deferredSearch.toLowerCase()
    if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false
    return true
  }), [books, deferredSearch])

  const groups = React.useMemo(() => {
    const out = categories.map(c => ({
      cat: { id: c.id, nombre: c.nombre, color: c.color },
      books: searchedBooks.filter(b => b.categoria_id === c.id),
    }))
    const sinCat = searchedBooks.filter(b => !b.categoria_id)
    if (sinCat.length) out.push({ cat: { id: SIN_CATEGORIA_ID, nombre: 'Sin categoría', color: COLOR_DEFAULT }, books: sinCat })
    return out.filter(g => g.books.length && (!activeCategory || g.cat.id === activeCategory))
  }, [categories, searchedBooks, activeCategory])

  const counts = React.useMemo(() => {
    const m = { __all: books.filter(b => b.id !== MANUAL_LIBRO_ID).length }
    categories.forEach(c => { m[c.id] = books.filter(b => b.categoria_id === c.id).length })
    m[SIN_CATEGORIA_ID] = books.filter(b => !b.categoria_id).length
    return m
  }, [books, categories])

  // Últimos abiertos (máx 3) — featured viene del hook; se excluye para no duplicar "Seguir leyendo"
  const ultimos = React.useMemo(() => {
    const nonManual = books.filter(b => b.id !== MANUAL_LIBRO_ID && b.id !== featured?.id)
    if (lastOpenedBookIds?.length) {
      return lastOpenedBookIds.filter(id => id !== featured?.id).map(id => nonManual.find(b => b.id === id)).filter(Boolean).slice(0, 3)
    }
    return nonManual.slice(0, 3)
  }, [books, lastOpenedBookIds, featured])
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
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button className="bibm-icon-btn" onClick={onGoTienda} title="Ir a la Tienda" aria-label="Ir a la Tienda">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4m1.6 8L5 5H3m4 8a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className="bibm-icon-btn" onClick={onGoAlbum} title="Mi álbum" aria-label="Mi álbum">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="3" width="7" height="5" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="12" width="7" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="16" width="7" height="5" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <button className="bibm-avatar" onClick={onGoPerfil} title="Mi perfil">{inicial}</button>
        </div>
        <div className="bibm-search">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={INK} strokeWidth="2.4"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, autor…" />
          {search && <button className="bibm-search-x" onClick={() => setSearch('')} aria-label="Limpiar">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round"/></svg>
          </button>}
        </div>
      </div>

      {/* Contenido — una sola tira de scroll general */}
      <div className="bibm-noscroll bibm-scroll">
        <div className="bibm-greeting">¡{saludoBienvenida(user?.user_metadata?.genero)}, {displayName.split(' ')[0]}!</div>

        {loadingBooks && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(74,54,34,0.5)', fontSize: 15, fontWeight: 600 }}>Cargando tu biblioteca…</div>
        )}

        {!loadingBooks && (
          <>
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
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: INK }}>{Math.round(featured.progress * 100)}% <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(74,54,34,0.55)' }}>leído</span></span>
                          </div>
                          <div className="bibm-bar"><div style={{ width: `${Math.round(featured.progress * 100)}%` }} /></div>
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
                    ? <LibroCardsMobile libros={novedades.slice(0, 3)} onOpen={setReelLibro} badge="Recién llegado" />
                    : <div className="bibm-lane-empty">Pronto verás acá los libros recién llegados a la biblioteca. <span className="bibm-soon">Próximamente</span></div>
                )}
                {laneTab === 'recom' && (
                  recomendaciones.length > 0
                    ? <LibroCardsMobile libros={recomendaciones.slice(0, 3)} onOpen={setReelLibro} badge="Para ti" />
                    : <div className="bibm-lane-empty">Estamos preparando recomendaciones a tu medida. <span className="bibm-soon">Próximamente</span></div>
                )}
              </div>
            )}

            {/* Tu colección — encabezado */}
            <div style={{ marginTop: 36 }}>
              <div className="bibm-col-head">
                <div className="bibm-sec-ttl">Tu colección <span className="bibm-sec-sub">{collectionCount} {collectionCount === 1 ? 'libro' : 'libros'}</span></div>
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
              <MobileCategoryBrowser groups={groups} onOpen={openBook} />
            </div>
          </>
        )}
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

      {selectedLibro && (
        <PanelLibro
          key={selectedLibro.id}
          libro={selectedLibro}
          user={user}
          gatoColor={gatoColor}
          yaAdquirido={false}
          yaLeido={false}
          bloqueado={!isSuperuser && pendientes >= LIMITE_PENDIENTES}
          onComprar={() => handleComprarLibro(selectedLibro)}
          onClose={() => setSelectedLibro(null)}
          onPreview={() => setReelLibro(selectedLibro)}
          onEmpezarLeer={() => handleEmpezarLeerLibro(selectedLibro)}
        />
      )}
      {reelLibro && <LibroReel libro={reelLibro} onClose={handleReelClose} />}

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
          onSkip={onboarding.skip}
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
          onClose={() => onboarding.advance('tienda_final')}   // tienda_final → done
        />
      )}
    </div>
  )
}
