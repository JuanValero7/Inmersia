import React from 'react'
import { supabase } from '../lib/supabase.js'
import { MANUAL_LIBRO_ID } from '../lib/constants.js'
import useLocalStorage from '../hooks/useLocalStorage.js'
import '../styles/biblioteca.css'
import { runGuidedBib1, runGuidedBib2 } from './tutorial.js'
import { getTourPhase, setTourPhase, shouldStart } from './guidedTour.js'
import BibBookModal from './biblioteca/BibBookModal.jsx'
import ManageCategoriasModal from './biblioteca/ManageCategoriasModal.jsx'
import BookOpenTransition from './biblioteca/BookOpenTransition.jsx'
import { InmHeader, Swimlane } from './biblioteca/clay/HeaderSwimlane.jsx'
import { FlatShelves, CoverShelf } from './biblioteca/clay/Shelves.jsx'
import { INK } from './biblioteca/clay/helpers.jsx'

// =============================================================
// ACUARELA · VistaBiblioteca (orquestador).
// Réplica del componente real: MISMAS props, queries Supabase,
// CRUD de categorías, notas localStorage y modales. Cambia solo
// la capa visual: Wall(cajones) → FlatShelves, TopBar → InmHeader,
// + saludo + Swimlane + repisa de portadas + chips de filtro.
// En el preview, BookOpenTransition es passthrough (en src/ se
// mantiene el real).
// =============================================================

const COLOR_DEFAULT = '#7a4a28';
const COLOR_BOOK_FALLBACK2 = '#5a3d28';
const SIN_CATEGORIA_ID = '__sin_categoria';

const MANUAL_USUARIO = {
  id: 'manual', libro_id: MANUAL_LIBRO_ID, categoria_id: null,
  title: 'Manual del Explorador', author: 'Biblioteca Virtual',
  pages: 8, _baseColor: '#5a7a4a', cover: null, progress: null,
  summary: 'Tu guía de bienvenida a Inmersia. Descubre cómo leer, anotar, investigar y conectar con otros lectores.',
};

function VistaBiblioteca({ user, lastOpenedBookIds, onSignOut, onOpenBook, onGoTienda, onGoPerfil, onGoForo, onGoNotebook }) {
  const [rawBooks, setRawBooks] = React.useState([MANUAL_USUARIO]);
  const [loadingBooks, setLoadingBooks] = React.useState(true);
  const [perfil, setPerfil] = React.useState(null);
  const [categories, setCategories] = React.useState([]);
  const [notes, setNotes] = useLocalStorage('bv_notes', {});
  const [selectedBook, setSelectedBook] = React.useState(null);
  const [pendingBook, setPendingBook] = React.useState(null);
  const [pendingRect, setPendingRect] = React.useState(null);
  const [showManageCats, setShowManage] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [activeCategory, setCategory] = React.useState(null); // null | 'none' | uuid

  // Tutorial — guided tour o standalone
  React.useEffect(() => {
    if (loadingBooks) return
    const phase = getTourPhase()
    let t
    if (phase === 'bib_1' || shouldStart()) {
      if (shouldStart()) setTourPhase('bib_1')
      t = setTimeout(() => runGuidedBib1(), 700)
    } else if (phase === 'bib_2') {
      t = setTimeout(() => runGuidedBib2(), 700)
    }
    return () => clearTimeout(t)
  }, [loadingBooks])

  // Perfil (nombre)
  React.useEffect(() => {
    let activo = true;
    (async () => {
      const { data } = await supabase.from('perfiles').select('nombre, apellido').eq('id', user.id).maybeSingle();
      if (activo && data) setPerfil(data);
    })();
    return () => { activo = false; };
  }, [user.id]);

  // Categorías
  const fetchCategories = React.useCallback(async () => {
    const { data } = await supabase.from('categorias_usuario')
      .select('id, nombre, color, orden').eq('user_id', user.id)
      .order('orden', { ascending: true }).order('nombre', { ascending: true });
    setCategories(data || []);
  }, [user.id]);
  React.useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // Libros
  const fetchUserBooks = React.useCallback(async () => {
    setLoadingBooks(true);
    const { data } = await supabase.from('bibliotecas_usuarios')
      .select('leido, categoria_id, libros(id, titulo, autor, paginas, descripcion, color, portada_url, metadata)')
      .eq('user_id', user.id);
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
      cover: r.libros.portada_url || null,        // null → portada generada
      // TODO progreso de lectura: cuando agregues la columna `progreso`
      // (numeric 0..1) a bibliotecas_usuarios, súmala al .select() de arriba
      // y cambia esta línea por:  progress: typeof r.progreso === 'number' ? r.progreso : null,
      progress: null,
    }));
    setRawBooks([MANUAL_USUARIO, ...mapped]);
    setLoadingBooks(false);
  }, [user.id]);
  React.useEffect(() => { fetchUserBooks(); }, [fetchUserBooks]);

  // ── CRUD categorías (idéntico al real) ──
  async function createCategoria(nombre, color) {
    const { error } = await supabase.from('categorias_usuario').insert({ user_id: user.id, nombre, color });
    if (error) return error.message.includes('duplicate') ? `Ya tenés una categoría llamada "${nombre}".` : error.message;
    await fetchCategories();
    return null;
  }
  async function updateCategoria(id, fields) {
    const { error } = await supabase.from('categorias_usuario').update(fields).eq('id', id);
    if (error) return error.message;
    await fetchCategories();
    return null;
  }
  async function deleteCategoria(id) {
    const { error } = await supabase.from('categorias_usuario').delete().eq('id', id);
    if (error) return error.message;
    await Promise.all([fetchCategories(), fetchUserBooks()]);
    if (activeCategory === id) setCategory(null);
    return null;
  }
  async function assignCategoriaToBook(catalogoLibroId, categoria_id) {
    if (catalogoLibroId === 'manual') return;
    await supabase.from('bibliotecas_usuarios').update({ categoria_id })
      .eq('user_id', user.id).eq('libro_id', catalogoLibroId);
    await fetchUserBooks();
    setSelectedBook(prev => prev && prev.id === catalogoLibroId ? { ...prev, categoria_id } : prev);
  }

  const handleSearchChange = React.useCallback((value) => {
    setSearchInput(value);
    if (!value) setSearch('');
  }, []);

  const handleSearchKeyDown = React.useCallback((e) => {
    if (e.key === 'Enter') setSearch(searchInput);
    if (e.key === 'Escape') { setSearchInput(''); setSearch(''); }
  }, [searchInput]);

  // ── Resolución + filtrado ──
  const categoriasMap = React.useMemo(() => {
    const m = {}; categories.forEach(c => { m[c.id] = c; }); return m;
  }, [categories]);

  const books = React.useMemo(() => rawBooks.map(b => {
    const cat = b.categoria_id ? categoriasMap[b.categoria_id] : null;
    return { ...b, color: cat?.color || b._baseColor || COLOR_BOOK_FALLBACK2, categoryName: cat?.nombre || '' };
  }), [rawBooks, categoriasMap]);

  const searchedBooks = React.useMemo(() => books.filter(b => {
    const q = search.toLowerCase();
    if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false;
    return true;
  }), [books, search]);

  const totalPages = searchedBooks.reduce((s, b) => s + b.pages, 0);

  // Grupos para los estantes (categorías con libros + "Sin categoría")
  const groups = React.useMemo(() => {
    const out = categories.map(c => ({
      cat: { id: c.id, nombre: c.nombre, color: c.color },
      books: searchedBooks.filter(b => b.categoria_id === c.id),
    }));
    const sinCat = searchedBooks.filter(b => !b.categoria_id);
    if (sinCat.length) out.push({ cat: { id: SIN_CATEGORIA_ID, nombre: 'Sin categoría', color: COLOR_DEFAULT }, books: sinCat });
    return out.filter(g => g.books.length);
  }, [categories, searchedBooks]);

  const shelvesCount = Math.max(1, Math.ceil(groups.length / 3));

  // Destacado del hero + sección "Últimos abiertos"
  const featured = React.useMemo(() => {
    const nonManual = books.filter(b => b.id !== 'manual')
    if (lastOpenedBookIds?.length) {
      const last = nonManual.find(b => b.id === lastOpenedBookIds[0])
      if (last) return last
    }
    return nonManual[0] || null
  }, [books, lastOpenedBookIds]);
  const portadas = React.useMemo(() => {
    const nonManual = books.filter(b => b.id !== 'manual')
    if (lastOpenedBookIds?.length) {
      const ordered = lastOpenedBookIds.map(id => nonManual.find(b => b.id === id)).filter(Boolean)
      return ordered.slice(0, 3)
    }
    return nonManual.slice(0, 3)
  }, [books, lastOpenedBookIds]);

  const displayName = perfil?.nombre ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : (user?.email?.split('@')[0] || 'Lector');
  const inicial = displayName.charAt(0).toUpperCase();

  const openBook = (book, rect) => { setPendingBook(book); setPendingRect(rect); };

  const handleGoTienda = () => {
    if (getTourPhase() === 'wait_tienda') setTourPhase('tienda_calle')
    onGoTienda()
  };

  const chip = (active, color) => ({
    display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '8px 16px', fontSize: 13.5, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', border: `2px solid ${INK}`, transition: 'box-shadow .12s, transform .12s',
    background: active ? color : '#fffdf8', color: active ? '#fff' : '#5a4632', textShadow: active ? '0 1px 1px rgba(0,0,0,0.2)' : 'none',
    boxShadow: active ? `1px 1.4px 0 ${INK}47` : `1.6px 2px 0 ${INK}2e`, transform: active ? 'translateY(1px)' : 'none',
  });
  const headerInk = '#3a2b1c';

  return (
    <div className="bib-body" style={{ fontFamily: "'Baloo 2', cursive", color: INK, minHeight: '100%', backgroundColor: '#f6f3ec' }}>
      <InmHeader search={searchInput} onSearch={handleSearchChange} onSearchKeyDown={handleSearchKeyDown} displayName={displayName} inicial={inicial}
        onGoPerfil={onGoPerfil} onGoTienda={handleGoTienda} onSignOut={onSignOut} />

      <div style={{ padding: '26px 32px 56px' }}>
        <div style={{ fontWeight: 800, fontSize: 32, letterSpacing: '-0.01em', color: headerInk }}>¡Hola otra vez, {displayName.split(' ')[0]}!</div>

        {loadingBooks ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(74,54,34,0.5)', fontSize: 17, fontWeight: 600 }}>Cargando tu biblioteca…</div>
        ) : (
          <>
            <Swimlane featured={featured} onOpen={openBook} />

            {portadas.length > 0 && (
              <div id="tutorial-ultimos-abiertos" style={{ marginTop: 36 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 19, color: headerInk, whiteSpace: 'nowrap' }}>Últimos abiertos</span>
                </div>
                <CoverShelf books={portadas} onOpen={openBook} />
              </div>
            )}

            {/* Encabezado colección + acciones */}
            <div id="tutorial-coleccion" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 44 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 24, color: headerInk, whiteSpace: 'nowrap' }}>Tu colección</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(74,54,34,0.55)', whiteSpace: 'nowrap' }}>{books.filter(b => b.id !== 'manual').length} {books.filter(b => b.id !== 'manual').length === 1 ? 'libro' : 'libros'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
                <button id="tutorial-filtrar-btn" onClick={() => setShowFilters(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, background: showFilters ? '#cf7b4c' : '#fffdf8', color: showFilters ? '#fff' : '#cf7b4c', border: `2px solid ${INK}`, borderRadius: 14, padding: '10px 17px', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', textShadow: showFilters ? '0 1px 1px rgba(0,0,0,0.2)' : 'none', boxShadow: `1.6px 2px 0 ${INK}33` }}>
                  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3"><path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round"/></svg>
                  Filtrar{activeCategory ? ' · 1' : ''}
                </button>
                <button id="tutorial-gestionar-btn" onClick={() => setShowManage(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fffdf8', color: '#6f9457', border: `2px solid ${INK}`, borderRadius: 14, padding: '10px 17px', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: `1.6px 2px 0 ${INK}33` }}>
                  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Gestionar tu colección
                </button>
              </div>
            </div>

            {showFilters && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 16, flexWrap: 'wrap' }}>
                <button onClick={() => setCategory(null)} style={chip(activeCategory === null, '#cf7b4c')}>Todos</button>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setCategory(activeCategory === c.id ? null : c.id)} style={chip(activeCategory === c.id, c.color)}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, display: 'inline-block', marginRight: 8, border: `1px solid ${INK}66` }} />
                    {c.nombre}
                  </button>
                ))}
              </div>
            )}

            <div style={{ marginTop: 28 }}>
              {groups.length === 0
                ? <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(74,54,34,0.5)', fontWeight: 600, fontSize: 16 }}>No hay libros que mostrar.</div>
                : <FlatShelves groups={groups} activeCat={activeCategory === 'none' ? SIN_CATEGORIA_ID : activeCategory} onOpen={openBook} />}
            </div>
          </>
        )}
      </div>

      {pendingBook && (
        <BookOpenTransition book={pendingBook} startRect={pendingRect} color={pendingBook.color}
          onComplete={() => setSelectedBook(pendingBook)} />
      )}
      {selectedBook && (
        <BibBookModal
          book={books.find(b => b.id === selectedBook.id) || selectedBook}
          user={user}
          transparentBackdrop={!!pendingBook}
          onClose={() => { setSelectedBook(null); setPendingBook(null); setPendingRect(null); }}
          onOpenBook={(book) => { setSelectedBook(null); onOpenBook(book); }}
          onGoForo={(book) => { setSelectedBook(null); onGoForo(book); }}
          onGoNotebook={(book) => { setSelectedBook(null); setPendingBook(null); setPendingRect(null); onGoNotebook(book); }}
          categories={categories}
          onAssignCategory={assignCategoriaToBook}
        />
      )}
      {showManageCats && (
        <ManageCategoriasModal categories={categories} onClose={() => setShowManage(false)}
          onCreate={createCategoria} onUpdate={updateCategoria} onDelete={deleteCategoria} />
      )}
    </div>
  );
}

export default VistaBiblioteca;
