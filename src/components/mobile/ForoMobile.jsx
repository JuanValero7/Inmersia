// src/components/mobile/ForoMobile.jsx
// ─────────────────────────────────────────────────────────────
// CÁSCARA MOBILE DEL FORO.
// Reescribe SOLO el chrome (header compacto + tabs + navegación en
// bottom-sheet). La lógica de comentarios y chat NO se duplica:
// se reutilizan TAL CUAL <ForoComentarios> y <ForoChat>, los mismos
// componentes que usa el Foro de escritorio. El FAB y el modal
// "nuevo comentario" de ForoComentarios se adaptan a mobile solo
// por CSS (foro.mobile.css) — sin tocar su JS.
//
// Mismo contrato de props que Foro.jsx:
//   { book, user, onGoBack, onGoLectura, onGoBiblioteca, onGoCartelera }
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import ForoComentarios from '../foro/ForoComentarios.jsx'   // ← reutilizado
import ForoChat from '../foro/ForoChat.jsx'                  // ← reutilizado
import { getTourPhase, setTourPhase } from '../guidedTour.js' // ← coordinación de fase (igual que desktop)
import { runGuidedForo1Mobile } from '../tutorial.mobile.js'
import { useForoData } from '../../hooks/useForoData.js'     // ← lógica de datos compartida
import '../../styles/foro.css'        // base (clases que usan las sub-vistas)
import '../../styles/foro.mobile.css'  // overrides responsive del chrome

export default function ForoMobile({ book, user, onGoBack, onGoLectura, onGoBiblioteca, onGoCartelera }) {
  // — MISMA lógica de datos que Foro.jsx (ver src/hooks/useForoData.js) —
  const {
    foro, miNombre, loading,
    comentariosCount, setComentariosCount,
    hasSesion, setHasSesion,
  } = useForoData(book, user)

  // Estado de UI/chrome (no compartido)
  const [activeTab, setActiveTab] = useState('comentarios')
  const [navOpen,   setNavOpen]   = useState(false)

  // Tutorial mobile — lanza el tour del Foro cuando corresponde
  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => { if (getTourPhase() === 'foro_1') runGuidedForo1Mobile() }, 700)
    return () => clearTimeout(t)
  }, [loading])

  const goNav = (fn) => { setNavOpen(false); fn && fn() }

  return (
    <div className="foro-root foro-m">

      {/* ── Header compacto ── */}
      <header className="foro-header foro-m-header">
        <div className="foro-header-center foro-m-title">
          <h1 className="foro-titulo">{book?.title || 'Foro'}</h1>
          <p className="foro-subtitulo">Foro del libro</p>
        </div>
        <button type="button" className="foro-back-btn foro-m-explore" onClick={() => setNavOpen(o => !o)} title="Navegar a…">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><path d="M2 12h20"/>
          </svg>
        </button>
      </header>

      {/* ── Tabs ── */}
      <div id="tutorial-foro-tabs" className="foro-tabs foro-m-tabs">
        <button type="button" className={clsx('foro-tab', activeTab === 'comentarios' && 'active')} onClick={() => setActiveTab('comentarios')}>
          Comentarios
          {comentariosCount > 0 && <span className="foro-tab-badge">{comentariosCount}</span>}
        </button>
        <button type="button" className={clsx('foro-tab', activeTab === 'chat' && 'active')} onClick={() => setActiveTab('chat')}>
          Chat
          {hasSesion && <span className="foro-tab-dot" />}
        </button>
      </div>

      {/* ── Contenido (sub-vistas REUTILIZADAS, sin cambios) ── */}
      {loading ? (
        <div className="foro-state-msg" style={{ padding: '72px 0' }}>Cargando…</div>
      ) : !foro ? (
        <div className="foro-state-msg" style={{ padding: '72px 0' }}>No se encontró el foro.</div>
      ) : activeTab === 'comentarios' ? (
        <ForoComentarios foro={foro} user={user} onCountChange={setComentariosCount} />
      ) : (
        <ForoChat foro={foro} book={book} user={user} miNombre={miNombre} onSesionChange={setHasSesion} />
      )}

      {/* ── Bottom-sheet de navegación ── */}
      {navOpen && (
        <div className="foro-m-sheet-backdrop" onClick={() => setNavOpen(false)}>
          <div className="foro-m-sheet" onClick={e => e.stopPropagation()}>
            <div className="foro-m-sheet-grip" />
            <p className="foro-m-sheet-title">Ir a…</p>
            <div className="foro-m-sheet-nav">
              {onGoLectura && (
                <button type="button" onClick={() => goNav(onGoLectura)}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
                  <span>Lectura</span>
                </button>
              )}
              {onGoBiblioteca && (
                <button type="button" onClick={() => { if (getTourPhase() === 'wait_bib_2') setTourPhase('bib_2'); goNav(onGoBiblioteca) }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  <span>Biblioteca</span>
                </button>
              )}
              {onGoCartelera && (
                <button type="button" onClick={() => goNav(onGoCartelera)}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <span>Investigación</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
