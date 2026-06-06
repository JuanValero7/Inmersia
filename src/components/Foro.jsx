// Plain JavaScript (.jsx)
import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase.js'
import { fetchNombre } from './foro/foroUtils.jsx'
import ForoComentarios from './foro/ForoComentarios.jsx'
import ForoChat from './foro/ForoChat.jsx'
import '../styles/foro.css'
import { runGuidedForo1 } from './tutorial.js'
import { getTourPhase, setTourPhase } from './guidedTour.js'

export default function VistaForo({ book, user, onGoBack, onGoLectura, onGoBiblioteca, onGoCartelera }) {
  const [activeTab,        setActiveTab]        = useState('comentarios')
  const [foro,             setForo]             = useState(null)
  const [miNombre,         setMiNombre]         = useState('Lector')
  const [loading,          setLoading]          = useState(true)
  const [comentariosCount, setComentariosCount] = useState(0)
  const [hasSesion,        setHasSesion]        = useState(false)
  const [navOpen,          setNavOpen]          = useState(false)

  useEffect(() => {
    if (!navOpen) return
    const h = (e) => { if (!e.target.closest('.foro-nav-popup')) setNavOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [navOpen])

  useEffect(() => {
    if (!book?.libro_id) { setLoading(false); return }
    supabase.from('foros').select('id').eq('libro_id', book.libro_id).maybeSingle()
      .then(({ data }) => { setForo(data || null); setLoading(false) })
  }, [book?.libro_id])

  useEffect(() => {
    fetchNombre(user.id).then(setMiNombre)
  }, [user.id])

  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => { if (getTourPhase() === 'foro_1') runGuidedForo1() }, 700)
    return () => clearTimeout(t)
  }, [loading])

  return (
    <div className="foro-root">

      {/* ── Header ── */}
      <header className="foro-header">
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
                {onGoLectura && (
                  <button type="button" onClick={() => { setNavOpen(false); onGoLectura() }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
                    <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }}>Lectura</span>
                  </button>
                )}
                {onGoBiblioteca && (
                  <button type="button" onClick={() => { if (getTourPhase() === 'wait_bib_2') setTourPhase('bib_2'); setNavOpen(false); onGoBiblioteca() }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }}>Biblioteca</span>
                  </button>
                )}
                {onGoCartelera && (
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
      <div id="tutorial-foro-tabs" className="foro-tabs">
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
