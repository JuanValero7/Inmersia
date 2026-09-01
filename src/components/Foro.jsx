// Plain JavaScript (.jsx)
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import ForoComentarios from './foro/ForoComentarios.jsx'
import ForoChat from './foro/ForoChat.jsx'
import '../styles/foro.css'
import { useForoData } from '../hooks/useForoData.js'
import { useBookBySlug } from '../hooks/useBookBySlug.js'
import { useOnboarding } from '../context/onboarding.jsx'
import { MANUAL_LIBRO_ID } from '../lib/constants.js'

export default function VistaForo({ book: bookProp, user, onGoBack, onGoLectura, onGoBiblioteca, onGoCartelera, isSuperuser = false }) {
  const { book, loading: bookLoading } = useBookBySlug(bookProp)

  // Manual del Explorador: comentarios en solo-lectura (nadie comenta salvo
  // superusuario, que deja el comentario "oficial" del gato). El Chat sí queda
  // abierto: si alguien quiere conversar ahí, bienvenido sea.
  const esManual = book?.libro_id === MANUAL_LIBRO_ID
  const readOnly = esManual && !isSuperuser

  // Tutorial (paso 'foro'): la única salida es Biblioteca (avanza a 'album').
  const onboarding = useOnboarding()
  const tutorialForo = onboarding.active && onboarding.step === 'foro'
  const irBibliotecaFin = () => { onboarding.advance('foro'); onGoBiblioteca?.() }
  // Lógica de datos compartida con ForoMobile (ver src/hooks/useForoData.js)
  const {
    foro, miNombre, loading,
    comentariosCount, setComentariosCount,
    hasSesion, setHasSesion,
  } = useForoData(book, user)

  // Estado de UI/chrome (no compartido)
  const [activeTab, setActiveTab] = useState('comentarios')
  const [navOpen,   setNavOpen]   = useState(false)

  useEffect(() => {
    if (!navOpen) return
    const h = (e) => { if (!e.target.closest('.foro-nav-popup')) setNavOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [navOpen])

  if (bookLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-warm)' }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(139,77,42,0.2)', borderTopColor: '#8b4d2a' }} />
    </div>
  )

  return (
    <div className="foro-root">

      {/* ── Header ── */}
      <header className="foro-header">
        <div style={{ width: 80, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {onGoBack && !tutorialForo && (
            <button type="button" className="foro-arrow-btn" onClick={onGoBack} title="Volver" aria-label="Volver">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
        </div>
        <div className="foro-header-center">
          <h1 className="foro-titulo">{book?.title || 'Foro'}</h1>
          <p className="foro-subtitulo">Foro del libro</p>
        </div>
          <div className="foro-nav-popup" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: 80, flexShrink: 0 }}>
            {navOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60,
                background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 16,
                padding: '10px 14px', display: 'flex', gap: 20, alignItems: 'flex-end',
                boxShadow: '2px 4px 0 rgba(74,54,34,0.22), 0 14px 30px rgba(0,0,0,0.22)',
                whiteSpace: 'nowrap',
              }}>
                {onGoBiblioteca && (
                  <button type="button" onClick={() => { setNavOpen(false); tutorialForo ? irBibliotecaFin() : onGoBiblioteca() }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }}>Biblioteca</span>
                  </button>
                )}
                {onGoLectura && !tutorialForo && (
                  <button type="button" onClick={() => { setNavOpen(false); onGoLectura() }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
                    <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }}>Lectura</span>
                  </button>
                )}
                {onGoCartelera && !tutorialForo && (
                  <button type="button" onClick={() => { setNavOpen(false); onGoCartelera() }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }}>Investigación</span>
                  </button>
                )}
              </div>
            )}
            <button type="button" className="foro-back-btn" onClick={() => setNavOpen(o => !o)} title="Navegar a…">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><path d="M2 12h20"/>
              </svg>
              Explorar
            </button>
          </div>
      </header>

      {/* ── Tabs ── */}
      <div className="foro-tabs">
        <button
          type="button"
          className={clsx('foro-tab', activeTab === 'comentarios' && 'active')}
          onClick={() => setActiveTab('comentarios')}
        >
          Comentarios
          {comentariosCount > 0 && (
            <span className="foro-tab-badge">{comentariosCount}</span>
          )}
        </button>
        <button
          type="button"
          className={clsx('foro-tab', activeTab === 'chat' && 'active')}
          onClick={() => setActiveTab('chat')}
        >
          Chat
          {hasSesion && <span className="foro-tab-dot" />}
        </button>
      </div>

      {/* ── Contenido ── */}
      {loading ? (
        <div className="foro-state-msg" style={{ padding: '72px 0' }}>Cargando…</div>
      ) : !foro ? (
        <div className="foro-state-msg" style={{ padding: '72px 0' }}>No se encontró el foro.</div>
      ) : activeTab === 'comentarios' ? (
        <ForoComentarios
          foro={foro}
          user={user}
          onCountChange={setComentariosCount}
          readOnly={readOnly}
          isSuperuser={isSuperuser}
        />
      ) : (
        <ForoChat
          foro={foro}
          book={book}
          user={user}
          miNombre={miNombre}
          onSesionChange={setHasSesion}
        />
      )}
    </div>
  )
}
