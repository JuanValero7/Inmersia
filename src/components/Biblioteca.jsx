import React from 'react'
import { useBiblioteca } from '../hooks/useBiblioteca.js'
import { useCompraLibro, LIMITE_PENDIENTES } from '../hooks/useCompraLibro.js'
import { SIN_CATEGORIA_ID, COLOR_DEFAULT, MANUAL_LIBRO_ID } from './biblioteca/constants.js'
import '../styles/tienda.css'
import '../styles/biblioteca.css'
import BibBookModal from './biblioteca/BibBookModal.jsx'
import ManageCategoriasModal from './biblioteca/ManageCategoriasModal.jsx'
import PanelLibro from './tienda/PanelLibro.jsx'
import LibroReel from './tienda/LibroReel.jsx'
import { InmHeader, Swimlane } from './biblioteca/clay/HeaderSwimlane.jsx'
import { CategoriasHome } from './biblioteca/clay/CategoriasHome.jsx'
import { LateralHome } from './biblioteca/clay/LateralHome.jsx'
import { INK } from './biblioteca/clay/helpers.jsx'
import { saludoBienvenida } from '../lib/genero.js'
import { useOnboarding } from '../context/onboarding.jsx'
import WelcomePopup from './onboarding/WelcomePopup.jsx'
import TutorialHint from './onboarding/TutorialHint.jsx'
import { TEXTO_ALBUM_HINT, TEXTO_TIENDA_FINAL } from './onboarding/textos.js'

// =============================================================
// ACUARELA · VistaBiblioteca (orquestador).
// MISMAS props del componente real. La lógica de datos (perfil,
// categorías + CRUD, libros, asignar categoría, memos books/featured)
// vive en src/hooks/useBiblioteca.js, compartida con BibliotecaMobile.
// Aquí solo queda el chrome desktop + sus derivados de UI
// (búsqueda, groups, portadas).
// =============================================================

function VistaBiblioteca({ user, gatoColor, lastOpenedBookIds, isSuperuser, onSignOut, onOpenBook, onGoTienda, onGoPerfil, onGoAlbum, onGoForo, onGoNotebook }) {
  // Lógica de datos compartida con BibliotecaMobile (ver src/hooks/useBiblioteca.js)
  const {
    loadingBooks, categories, books, featured, novedades, recomendaciones, displayName, inicial,
    createCategoria, updateCategoria,
    deleteCategoria: deleteCategoriaBase,
    assignCategoriaToBook: assignCategoriaToBookBase,
    fetchUserBooks,
  } = useBiblioteca(user, lastOpenedBookIds)

  // Estado de UI/chrome (no compartido)
  const [selectedBook, setSelectedBook] = React.useState(null);
  const [selectedLibro, setSelectedLibro] = React.useState(null); // libro de Novedades/Recomendaciones (aún no adquirido)
  const [reelLibro, setReelLibro] = React.useState(null); // preview (LibroReel) del panel de arriba
  const [showManageCats, setShowManage] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [activeCategory, setCategory] = React.useState(null); // null | uuid | SIN_CATEGORIA_ID

  // Compra desde el panel in-place (Novedades/Recomendaciones) — mismas
  // primitivas y mismo límite de pendientes que la Tienda (ver useCompraLibro).
  const pendientes = React.useMemo(() => books.filter(b => b.id !== MANUAL_LIBRO_ID && !b.leido).length, [books]);
  const { comprar: comprarLibro, comprarYLeer: comprarYLeerLibro } = useCompraLibro(user, isSuperuser, onOpenBook);
  const handleComprarLibro = async (libro) => {
    const { error } = await comprarLibro(libro, { pendientes });
    if (!error) { await fetchUserBooks(); setSelectedLibro(null); }
  };
  const handleEmpezarLeerLibro = async (libro) => {
    const { error } = await comprarYLeerLibro(libro, { pendientes, tieneLibro: () => false });
    if (!error) { await fetchUserBooks(); setSelectedLibro(null); }
  };

  // ── Wrappers que sincronizan estado de UI tras las primitivas del hook ──
  async function deleteCategoria(id) {
    const err = await deleteCategoriaBase(id);
    if (!err && activeCategory === id) setCategory(null);
    return err;
  }
  async function assignCategoriaToBook(catalogoLibroId, categoria_id) {
    if (catalogoLibroId === MANUAL_LIBRO_ID) return;
    await assignCategoriaToBookBase(catalogoLibroId, categoria_id);
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

  // ── Filtrado + agrupado (derivados de UI) ──
  const searchedBooks = React.useMemo(() => books.filter(b => {
    const q = search.toLowerCase();
    if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false;
    return true;
  }), [books, search]);

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

  // "Últimos abiertos" del lateral (máx 2) — excluye el libro ya mostrado en
  // el hero "Seguir leyendo" para que no se repita.
  const portadas = React.useMemo(() => {
    const nonManual = books.filter(b => b.id !== MANUAL_LIBRO_ID && b.id !== featured?.id)
    if (lastOpenedBookIds?.length) {
      const ordered = lastOpenedBookIds.filter(id => id !== featured?.id).map(id => nonManual.find(b => b.id === id)).filter(Boolean)
      return ordered.slice(0, 2)
    }
    return nonManual.slice(0, 2)
  }, [books, lastOpenedBookIds, featured]);

  const openBook = React.useCallback((book) => { setSelectedBook(book); }, []);

  // ── Onboarding ──
  const onboarding = useOnboarding();
  const manualBook = React.useMemo(() => books.find(b => b.id === MANUAL_LIBRO_ID), [books]);
  const showWelcome     = onboarding.active && onboarding.step === 'bienvenida';
  const showAlbumHint   = onboarding.active && onboarding.step === 'album';
  const showTiendaHint  = onboarding.active && onboarding.step === 'tienda_final';
  const openManual = React.useCallback(() => {
    if (!manualBook) return;
    onboarding.advance('bienvenida');   // bienvenida → manual
    onOpenBook(manualBook);
  }, [manualBook, onboarding, onOpenBook]);

  const handleGoTienda = () => {
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
    <div className="bib-body" style={{ fontFamily: "'Baloo 2', cursive", color: INK, minHeight: '100%', backgroundColor: '#FBF5EC' }}>
      <InmHeader search={searchInput} onSearch={handleSearchChange} onSearchKeyDown={handleSearchKeyDown} displayName={displayName} inicial={inicial}
        onGoPerfil={onGoPerfil} onSignOut={onSignOut} />

      <div style={{ padding: '26px 32px 56px' }}>
        <div style={{ fontWeight: 800, fontSize: 32, letterSpacing: '-0.01em', color: headerInk }}>¡{saludoBienvenida(user?.user_metadata?.genero)}, {displayName.split(' ')[0]}!</div>

        {loadingBooks ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(74,54,34,0.5)', fontSize: 17, fontWeight: 600 }}>Cargando tu biblioteca…</div>
        ) : (
          <>
            {/* Fila superior: hero (60%) + lateral con 2 últimos abiertos y
                accesos a Tienda/Álbum (40%). */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <div style={{ flex: 3, minWidth: 0 }}>
                <Swimlane featured={featured} onOpen={openBook} novedades={novedades} recomendaciones={recomendaciones} onOpenLibro={setSelectedLibro} onPreviewLibro={setReelLibro} gatoColor={gatoColor} />
              </div>
              <div style={{ flex: 2, minWidth: 0 }}>
                <LateralHome books={portadas} onOpen={openBook} onGoTienda={handleGoTienda} onGoAlbum={onGoAlbum} />
              </div>
            </div>

            {/* Encabezado colección + acciones */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 44, position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 24, color: headerInk, whiteSpace: 'nowrap' }}>Tu colección</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(74,54,34,0.55)', whiteSpace: 'nowrap' }}>{books.filter(b => b.id !== MANUAL_LIBRO_ID).length} {books.filter(b => b.id !== MANUAL_LIBRO_ID).length === 1 ? 'libro' : 'libros'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
                <button onClick={() => setShowFilters(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, background: activeCategory !== null ? '#F2792A' : '#fffdf8', color: activeCategory !== null ? '#fff' : INK, border: `2px solid ${INK}`, borderRadius: 999, padding: '10px 17px', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', textShadow: activeCategory !== null ? '0 1px 1px rgba(0,0,0,0.2)' : 'none', boxShadow: `1.6px 2px 0 ${INK}33` }}>
                  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3"><path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round"/></svg>
                  Filtrar{activeCategory ? ' · 1' : ''}
                </button>
                <button onClick={() => setShowManage(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fffdf8', color: '#2B1616', border: `2px solid ${INK}`, borderRadius: 999, padding: '10px 17px', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: `1.6px 2px 0 ${INK}33` }}>
                  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Gestionar tu colección
                </button>
              </div>
            </div>

            {showFilters && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 16, flexWrap: 'wrap' }}>
                <button onClick={() => setCategory(null)} style={chip(activeCategory === null, '#F2792A')}>Todos</button>
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
                : <CategoriasHome groups={groups} activeCat={activeCategory} onOpen={openBook} />}
            </div>
          </>
        )}
      </div>

      {selectedBook && (
        <BibBookModal
          book={books.find(b => b.id === selectedBook.id) || selectedBook}
          user={user}
          onClose={() => setSelectedBook(null)}
          onOpenBook={(book) => { setSelectedBook(null); onOpenBook(book); }}
          onGoForo={(book) => { setSelectedBook(null); onGoForo(book); }}
          onGoNotebook={(book) => { setSelectedBook(null); onGoNotebook(book); }}
          categories={categories}
          onAssignCategory={assignCategoriaToBook}
        />
      )}
      {showManageCats && (
        <ManageCategoriasModal categories={categories} onClose={() => setShowManage(false)}
          onCreate={createCategoria} onUpdate={updateCategoria} onDelete={deleteCategoria} />
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
      {reelLibro && (
        <LibroReel
          libro={reelLibro}
          onClose={() => setReelLibro(null)}
          onFinish={() => { setSelectedLibro(reelLibro); setReelLibro(null); }}
        />
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
  );
}

export default VistaBiblioteca;
