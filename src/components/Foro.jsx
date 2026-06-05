// Plain JavaScript (.jsx)
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase.js'
import { fetchNombre } from './foro/foroUtils.jsx'
import ForoComentarios from './foro/ForoComentarios.jsx'
import ForoChat from './foro/ForoChat.jsx'
import '../styles/foro.css'

export default function VistaForo({ book, user, onGoBack }) {
  const [activeTab,        setActiveTab]        = useState('comentarios')
  const [foro,             setForo]             = useState(null)
  const [miNombre,         setMiNombre]         = useState('Lector')
  const [loading,          setLoading]          = useState(true)
  const [comentariosCount, setComentariosCount] = useState(0)
  const [hasSesion,        setHasSesion]        = useState(false)

  useEffect(() => {
    if (!book?.libro_id) { setLoading(false); return }
    supabase.from('foros').select('id').eq('libro_id', book.libro_id).maybeSingle()
      .then(({ data }) => { setForo(data || null); setLoading(false) })
  }, [book?.libro_id])

  useEffect(() => {
    fetchNombre(user.id).then(setMiNombre)
  }, [user.id])

  return (
    <div className="foro-root">

      {/* ── Header ── */}
      <header className="foro-header">
        <button type="button" className="foro-back-btn" onClick={onGoBack}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Volver
        </button>
        <div className="foro-header-center">
          <h1 className="foro-titulo">{book?.title || 'Foro'}</h1>
          <p className="foro-subtitulo">Foro del libro</p>
        </div>
        <div style={{ width: 80, flexShrink: 0 }} />
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
