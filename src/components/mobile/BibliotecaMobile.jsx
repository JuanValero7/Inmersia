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
import { supabase } from '../../lib/supabase.js'
import { MANUAL_LIBRO_ID } from '../../lib/constants.js'
import BookOpenTransition from '../biblioteca/BookOpenTransition.jsx'
import { INK, BookCover } from './biblioteca/bibmHelpers.jsx'
import { MobileShelves, CoverCarousel } from './biblioteca/BibShelvesMobile.jsx'
import BibBookSheet from './biblioteca/BibBookSheet.jsx'
import { FilterScreen, ManageScreen } from './biblioteca/BibScreensMobile.jsx'
import '../../styles/biblioteca.mobile.css'

const COLOR_DEFAULT = '#7a4a28'
const COLOR_BOOK_FALLBACK2 = '#5a3d28'
const SIN_CATEGORIA_ID = '__sin_categoria'

const MANUAL_USUARIO = {
  id: 'manual', libro_id: MANUAL_LIBRO_ID, categoria_id: null,
  title: 'Manual del Explorador', author: 'Biblioteca Virtual',
  pages: 8, _baseColor: '#5a7a4a', cover: null, progress: null,
  summary: 'Tu guía de bienvenida a Inmersia. Descubre cómo leer, anotar, investigar y conectar con otros lectores.',
}

const HERO_TABS = [
  { id: 'seguir', label: 'Seguir leyendo' },
  { id: 'novedades', label: 'Novedades' },
  { id: 'recom', label: 'Recomendaciones' },
]

export default function BibliotecaMobile({ user, lastOpenedBookIds, onSignOut, onOpenBook, onGoTienda, onGoPerfil, onGoForo, onGoNotebook }) {
  const [rawBooks, setRawBooks] = React.useState([MANUAL_USUARIO])
  const [loadingBooks, setLoadingBooks] = React.useState(true)
  const [perfil, setPerfil] = React.useState(null)
  const [categories, setCategories] = React.useState([])
  const [selectedBook, setSelectedBook] = React.useState(null)
  const [pendingBook, setPendingBook] = React.useState(null)
  const [pendingRect, setPendingRect] = React.useState(null)
  const [search, setSearch] = React.useState('')
  const [activeCategory, setActiveCategory] = React.useState(null) // null | uuid | SIN_CATEGORIA_ID
  const [heroTab, setHeroTab] = React.useState('seguir')
  const [screen, setScreen] = React.useState(null) // null | 'filter' | 'manage'

  // ── Perfil (nombre) ──
  React.useEffect(() => {
    let activo = true
    ;(async () => {
      const { data } = await supabase.from('perfiles').select('nombre, apellido').eq('id', user.id).maybeSingle()
      if (activo && data) setPerfil(data)
    })()
    return () => { activo = false }
  }, [user.id])

  // ── Categorías ──
  const fetchCategories = React.useCallback(async () => {
    const { data } = await supabase.from('categorias_usuario')
      .select('id, nombre, color, orden').eq('user_id', user.id)
      .order('orden', { ascending: true }).order('nombre', { ascending: true })
    setCategories(data || [])
  }, [user.id])
  React.useEffect(() => { fetchCategories() }, [fetchCategories])

  // ── Libros ──
  const fetchUserBooks = React.useCallback(async () => {
    setLoadingBooks(true)
    const { data } = await supabase.from('bibliotecas_usuarios')
      .select('leido, categoria_id, libros(id, titulo, autor, paginas, descripcion, color, portada_url, metadata)')
      .eq('user_id', user.id)
    const mapped = (data || []).map(r => ({
      id: r.libros.id,
      libro_id: r.libros.id,
      categoria_id: r.categoria_id,
      title: r.libros.titulo,
      author: r.libros.autor || 'Desconocido',
      pages: r.libros.paginas || 200,
      _baseColor: r.libros.color || COLOR_BOOK_FALLBACK2,
      summary: r.libros.descripcion || '',
      leido: r.leido,
      cover: r.libros.portada_url || null,
      // TODO progreso de lectura: cuando exista la columna `progreso` (0..1)
      // en bibliotecas_usuarios, súmala al .select() y usá:
      // progress: typeof r.progreso === 'number' ? r.progreso : null,
      progress: null,
    }))
    setRawBooks([MANUAL_USUARIO, ...mapped])
    setLoadingBooks(false)
  }, [user.id])
  React.useEffect(() => { fetchUserBooks() }, [fetchUserBooks])

  // ── CRUD categorías (idéntico al real) ──
  async function createCategoria(nombre, color) {
    const { error } = await supabase.from('categorias_usuario').insert({ user_id: user.id, nombre, color })
    if (error) return error.message.includes('duplicate') ? `Ya tenés una categoría llamada "${nombre}".` : error.message
    await fetchCategories()
    return null
  }
  async function updateCategoria(id, fields) {
    const { error } = await supabase.from('categorias_usuario').update(fields).eq('id', id)
    if (error) return error.message
    await fetchCategories()
    return null
  }
  async function deleteCategoria(id) {
    const { error } = await supabase.from('categorias_usuario').delete().eq('id', id)
    if (error) return error.message
    await Promise.all([fetchCategories(), fetchUserBooks()])
    if (activeCategory === id) setActiveCategory(null)
    return null
  }
  async function assignCategoriaToBook(catalogoLibroId, categoria_id) {
    if (catalogoLibroId === 'manual') return
    await supabase.from('bibliotecas_usuarios').update({ categoria_id })
      .eq('user_id', user.id).eq('libro_id', catalogoLibroId)
    await fetchUserBooks()
    setSelectedBook(prev => prev && prev.id === catalogoLibroId ? { ...prev, categoria_id } : prev)
  }

  // ── Resolución + filtrado ──
  const categoriasMap = React.useMemo(() => { const m = {}; categories.forEach(c => { m[c.id] = c }); return m }, [categories])

  const books = React.useMemo(() => rawBooks.map(b => {
    const cat = b.categoria_id ? categoriasMap[b.categoria_id] : null
    return { ...b, color: cat?.color || b._baseColor || COLOR_BOOK_FALLBACK2, categoryName: cat?.nombre || '' }
  }), [rawBooks, categoriasMap])

  const searchedBooks = React.useMemo(() => books.filter(b => {
    const q = search.toLowerCase()
    if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false
    return true
  }), [books, search])

  const totalPages = searchedBooks.reduce((s, b) => s + b.pages, 0)

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
    const m = { __all: books.filter(b => b.id !== 'manual').length }
    categories.forEach(c => { m[c.id] = books.filter(b => b.categoria_id === c.id).length })
    m[SIN_CATEGORIA_ID] = books.filter(b => !b.categoria_id).length
    return m
  }, [books, categories])
  const hasSinCategoria = (counts[SIN_CATEGORIA_ID] || 0) > 0

  // Destacado del hero + Últimos abiertos (máx 3)
  const featured = React.useMemo(() => {
    const nonManual = books.filter(b => b.id !== 'manual')
    if (lastOpenedBookIds?.length) {
      const last = nonManual.find(b => b.id === lastOpenedBookIds[0])
      if (last) return last
    }
    return nonManual[0] || null
  }, [books, lastOpenedBookIds])

  const ultimos = React.useMemo(() => {
    const nonManual = books.filter(b => b.id !== 'manual')
    if (lastOpenedBookIds?.length) {
      return lastOpenedBookIds.map(id => nonManual.find(b => b.id === id)).filter(Boolean).slice(0, 3)
    }
    return nonManual.slice(0, 3)
  }, [books, lastOpenedBookIds])
  const ultimosVisible = React.useMemo(() => {
    if (!search) return ultimos
    const ids = new Set(searchedBooks.map(b => b.id))
    return ultimos.filter(b => ids.has(b.id))
  }, [ultimos, searchedBooks, search])

  const displayName = perfil?.nombre ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : (user?.email?.split('@')[0] || 'Lector')
  const inicial = displayName.charAt(0).toUpperCase()
  const collectionCount = books.filter(b => b.id !== 'manual').length
  const activeName = activeCategory
    ? (categoriasMap[activeCategory]?.nombre || (activeCategory === SIN_CATEGORIA_ID ? 'Sin categoría' : ''))
    : null

  const openBook = (book, rect) => { setPendingBook(book); setPendingRect(rect) }
  const closeSheet = () => { setSelectedBook(null); setPendingBook(null); setPendingRect(null) }

  return (
    <div className="bibm-screen">
      {/* Header */}
      <div className="bibm-header-wrap">
        <div className="bibm-header">
          <div className="bibm-logo"><img src="/assets/inmersia-logo.png" alt="Inmersia" /></div>
          <div style={{ flex: 1 }} />
          <button className="bibm-tienda" onClick={onGoTienda} title="Ir a la Tienda">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4m1.6 8L5 5H3m4 8a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Tienda
          </button>
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

      {/* Contenido */}
      <div className="bibm-noscroll bibm-scroll">
        <div className="bibm-greeting">¡Hola otra vez, {displayName.split(' ')[0]}!</div>

        {loadingBooks ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(74,54,34,0.5)', fontSize: 15, fontWeight: 600 }}>Cargando tu biblioteca…</div>
        ) : (
          <>
            {/* Hero "Seguir leyendo" con el gato */}
            <div className="bibm-hero">
              {heroTab === 'seguir' && (
                <>
                  <img className="bibm-hero-cat" src="/assets/wallpapers/hero-cat.webp" alt="" />
                  <div className="bibm-hero-fade" />
                </>
              )}
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div className="bibm-hero-tabs">
                  {HERO_TABS.map(t => (
                    <button key={t.id} className={'bibm-hero-tab' + (heroTab === t.id ? ' active' : '')} onClick={() => setHeroTab(t.id)}>{t.label}</button>
                  ))}
                </div>
                {heroTab === 'seguir' ? (
                  featured ? (
                    <div className="bibm-hero-body">
                      <div className="bibm-hero-cover" onClick={(e) => openBook(featured, e.currentTarget.getBoundingClientRect())}>
                        <BookCover book={featured} h={150} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <div className="bibm-hero-ttl">{featured.title}</div>
                        <div className="bibm-hero-auth">{featured.author}</div>
                        {typeof featured.progress === 'number' && (
                          <div className="bibm-hero-prog">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: INK }}>{Math.round(featured.progress * 100)}% <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(74,54,34,0.55)' }}>leído</span></span>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(74,54,34,0.55)' }}>pág. {Math.round(featured.pages * featured.progress)} / {featured.pages}</span>
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
                  ) : <div className="bibm-hero-empty">Cuando empieces a leer un libro aparecerá acá para que retomes donde lo dejaste.</div>
                ) : heroTab === 'novedades'
                  ? <div className="bibm-hero-empty">Pronto verás acá los libros recién llegados a la biblioteca. <span className="bibm-soon">Próximamente</span></div>
                  : <div className="bibm-hero-empty">Estamos preparando recomendaciones a tu medida. <span className="bibm-soon">Próximamente</span></div>}
              </div>
            </div>

            {/* Últimos abiertos (máx 3) */}
            {ultimosVisible.length > 0 && (
              <div style={{ marginTop: 30 }}>
                <div className="bibm-sec-ttl">Últimos abiertos</div>
                <CoverCarousel books={ultimosVisible} onOpen={openBook} />
              </div>
            )}

            {/* Tu colección */}
            <div style={{ marginTop: 36 }}>
              <div className="bibm-col-head">
                <div className="bibm-sec-ttl">Tu colección <span className="bibm-sec-sub">{collectionCount} {collectionCount === 1 ? 'libro' : 'libros'} · {totalPages.toLocaleString()} págs</span></div>
                <div className="bibm-col-actions">
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

              <div style={{ marginTop: 22 }}>
                <MobileShelves groups={groups} onOpen={openBook} />
              </div>
            </div>

          </>
        )}
      </div>

      {/* Transición de apertura + hoja de detalle */}
      {pendingBook && (
        <BookOpenTransition book={pendingBook} startRect={pendingRect} color={pendingBook.color}
          onComplete={() => setSelectedBook(pendingBook)} />
      )}
      {selectedBook && (
        <BibBookSheet
          book={books.find(b => b.id === selectedBook.id) || selectedBook}
          user={user}
          transparentBackdrop={!!pendingBook}
          categories={categories}
          onClose={closeSheet}
          onOpenBook={(book) => { closeSheet(); onOpenBook(book) }}
          onGoForo={(book) => { closeSheet(); onGoForo(book) }}
          onGoNotebook={(book) => { closeSheet(); onGoNotebook(book) }}
          onAssignCategory={assignCategoriaToBook}
        />
      )}

      {/* Pantallas */}
      {screen === 'filter' && (
        <FilterScreen categories={categories} counts={counts} active={activeCategory}
          hasSinCategoria={hasSinCategoria} onPick={setActiveCategory} onClose={() => setScreen(null)} />
      )}
      {screen === 'manage' && (
        <ManageScreen categories={categories} counts={counts}
          onCreate={createCategoria} onUpdate={updateCategoria} onDelete={deleteCategoria}
          onClose={() => setScreen(null)} />
      )}
    </div>
  )
}
