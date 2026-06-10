// Plain JavaScript (.jsx)
import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { supabase } from '../../lib/supabase.js'
import { Avatar, timeAgo } from './foroUtils.jsx'

const FORO_TAGS = [
  'Personajes', 'Trama', 'Ambientación', 'Teoría',
  'Pregunta', 'Cita favorita', 'Final', 'Curiosidad', 'Discusión',
]

const PAGE_SIZE = 15

export default function ForoComentarios({ foro, user, onCountChange }) {
  const [comentarios,     setComentarios]     = useState([])
  const [repliesByParent, setRepliesByParent] = useState({})
  const [perfilesMap,     setPerfilesMap]     = useState({})
  const [loading,         setLoading]         = useState(true)
  const [loadingMore,     setLoadingMore]     = useState(false)
  const [hasMore,         setHasMore]         = useState(false)
  const [offset,          setOffset]          = useState(0)
  const [activeTag,       setActiveTag]       = useState(null)
  const [expandedReplies, setExpandedReplies] = useState(new Set())
  const [replyOpenFor,    setReplyOpenFor]    = useState(null)
  const [replyText,       setReplyText]       = useState('')
  const [showModal,       setShowModal]       = useState(false)
  const [nuevoContenido,  setNuevoContenido]  = useState('')
  const [nuevoTags,       setNuevoTags]       = useState([])
  const [submitting,      setSubmitting]      = useState(false)

  const fetchPage = useCallback(async (pageOffset, tag, reset) => {
    if (reset) setLoading(true)
    else setLoadingMore(true)

    // Root comments: paginados + filtro de tag en servidor
    let rootQuery = supabase
      .from('foros_comentarios')
      .select('id, autor_id, contenido, tags, parent_id, created_at')
      .eq('foro_id', foro.id)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + PAGE_SIZE - 1)
    if (tag) rootQuery = rootQuery.contains('tags', [tag])

    const { data: roots } = await rootQuery
    const rootList = roots || []

    // Respuestas solo para las raíces de esta página
    const newRepliesByParent = {}
    if (rootList.length > 0) {
      const rootIds = rootList.map(c => c.id)
      const { data: replies } = await supabase
        .from('foros_comentarios')
        .select('id, autor_id, contenido, tags, parent_id, created_at')
        .eq('foro_id', foro.id)
        .in('parent_id', rootIds)
        .order('created_at', { ascending: true })
      ;(replies || []).forEach(r => {
        if (!newRepliesByParent[r.parent_id]) newRepliesByParent[r.parent_id] = []
        newRepliesByParent[r.parent_id].push(r)
      })
    }

    // Perfiles de autores de esta página
    const allItems = [...rootList, ...Object.values(newRepliesByParent).flat()]
    const authorIds = [...new Set(allItems.map(c => c.autor_id))]
    if (authorIds.length > 0) {
      const { data: perfiles } = await supabase
        .from('perfiles').select('id, nombre, apellido').in('id', authorIds)
      const newMap = {}
      ;(perfiles || []).forEach(p => { newMap[p.id] = p })
      setPerfilesMap(prev => reset ? newMap : { ...prev, ...newMap })
    }

    setComentarios(prev => reset ? rootList : [...prev, ...rootList])
    setRepliesByParent(prev => reset ? newRepliesByParent : { ...prev, ...newRepliesByParent })
    setHasMore(rootList.length === PAGE_SIZE)

    if (reset) setLoading(false)
    else setLoadingMore(false)
  }, [foro.id])

  // Conteo real de comentarios raíz (para el badge de la pestaña), independiente
  // del tag activo y de la paginación.
  const refreshCount = useCallback(async () => {
    const { count } = await supabase
      .from('foros_comentarios')
      .select('id', { count: 'exact', head: true })
      .eq('foro_id', foro.id)
      .is('parent_id', null)
    onCountChange?.(count || 0)
  }, [foro.id, onCountChange])

  // Re-fetch desde cero cuando cambia el foro o el tag activo
  useEffect(() => {
    setOffset(0)
    fetchPage(0, activeTag, true)
  }, [foro.id, activeTag, fetchPage])

  useEffect(() => { refreshCount() }, [refreshCount])

  function loadMore() {
    const next = offset + PAGE_SIZE
    setOffset(next)
    fetchPage(next, activeTag, false)
  }

  function authorName(authorId) {
    const p = perfilesMap[authorId]
    return p?.nombre ? `${p.nombre} ${p.apellido || ''}`.trim() : 'Lector'
  }

  function toggleReplies(id) {
    setExpandedReplies(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleNuevoTag(tag) {
    setNuevoTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  async function submitComentario() {
    if (!nuevoContenido.trim() || submitting) return
    if (nuevoContenido.trim().length > 2000) return
    setSubmitting(true)
    await supabase.from('foros_comentarios').insert({
      foro_id: foro.id, autor_id: user.id,
      contenido: nuevoContenido.trim(), tags: nuevoTags,
    })
    setNuevoContenido(''); setNuevoTags([]); setShowModal(false)
    setSubmitting(false)
    setOffset(0)
    fetchPage(0, activeTag, true)
    refreshCount()
  }

  async function submitReply(parentId) {
    if (!replyText.trim() || submitting) return
    if (replyText.trim().length > 2000) return
    setSubmitting(true)
    await supabase.from('foros_comentarios').insert({
      foro_id: foro.id, autor_id: user.id,
      contenido: replyText.trim(), tags: [], parent_id: parentId,
    })
    setReplyText(''); setReplyOpenFor(null); setSubmitting(false)
    setOffset(0)
    fetchPage(0, activeTag, true)
    setExpandedReplies(prev => new Set([...prev, parentId]))
  }

  async function eliminarComentario(id) {
    await supabase.from('foros_comentarios').delete().eq('id', id)
    const isRoot = comentarios.some(c => c.id === id)
    if (isRoot) {
      setComentarios(prev => prev.filter(c => c.id !== id))
      setRepliesByParent(prev => { const next = { ...prev }; delete next[id]; return next })
      refreshCount()
    } else {
      setRepliesByParent(prev => {
        const next = { ...prev }
        for (const parentId in next) {
          next[parentId] = next[parentId].filter(r => r.id !== id)
        }
        return next
      })
    }
  }

  return (
    <>
      {/* ── Tag filter bar ── */}
      <div className="foro-tags-bar">
        <button
          type="button"
          className={clsx('foro-tag-pill', !activeTag && 'active')}
          onClick={() => setActiveTag(null)}
        >
          Todos
        </button>
        {FORO_TAGS.map(tag => (
          <button
            key={tag} type="button"
            className={clsx('foro-tag-pill', activeTag === tag && 'active')}
            onClick={() => setActiveTag(prev => prev === tag ? null : tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* ── Lista ── */}
      <main className="foro-main">
        {loading ? (
          <div className="foro-state-msg">Cargando comentarios…</div>
        ) : comentarios.length === 0 ? (
          <div className="foro-state-msg">
            {activeTag
              ? `No hay comentarios con el tag "${activeTag}".`
              : 'Sé el primero en comentar este libro.'
            }
          </div>
        ) : (
          <>
            <div className="foro-lista">
              {comentarios.map(c => {
                const replies     = repliesByParent[c.id] || []
                const nombre      = authorName(c.autor_id)
                const isExpanded  = expandedReplies.has(c.id)
                const isReplyOpen = replyOpenFor === c.id
                return (
                  <div key={c.id} className="foro-comentario">
                    <div className="foro-comentario-header">
                      <Avatar name={nombre} />
                      <div className="foro-comentario-meta">
                        <span className="foro-autor">{nombre}</span>
                        <span className="foro-fecha">{timeAgo(c.created_at)}</span>
                      </div>
                    </div>
                    <p className="foro-contenido">{c.contenido}</p>
                    {c.tags?.length > 0 && (
                      <div className="foro-tags-list">
                        {c.tags.map(t => (
                          <span key={t} className="foro-tag-pill active small">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="foro-acciones">
                      <button
                        type="button" className="foro-accion-btn"
                        onClick={() => { setReplyOpenFor(isReplyOpen ? null : c.id); setReplyText('') }}
                      >
                        Responder
                      </button>
                      {replies.length > 0 && (
                        <button type="button" className="foro-accion-btn" onClick={() => toggleReplies(c.id)}>
                          {isExpanded
                            ? 'Ocultar respuestas'
                            : `Ver ${replies.length} ${replies.length === 1 ? 'respuesta' : 'respuestas'} ▾`
                          }
                        </button>
                      )}
                      {c.autor_id === user.id && (
                        <button type="button" className="foro-accion-btn eliminar" onClick={() => eliminarComentario(c.id)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                    {isReplyOpen && (
                      <div className="foro-reply-form">
                        <textarea
                          className="foro-textarea small"
                          placeholder="Escribe tu respuesta…"
                          maxLength={2000}
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          rows={2}
                        />
                        <div className="foro-reply-actions">
                          <button type="button" className="foro-btn-submit small" onClick={() => submitReply(c.id)} disabled={submitting || !replyText.trim()}>
                            {submitting ? 'Enviando…' : 'Responder'}
                          </button>
                          <button type="button" className="foro-btn-cancel" onClick={() => { setReplyOpenFor(null); setReplyText('') }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                    {isExpanded && replies.length > 0 && (
                      <div className="foro-replies">
                        {replies.map(r => {
                          const rNombre = authorName(r.autor_id)
                          return (
                            <div key={r.id} className="foro-reply">
                              <div className="foro-comentario-header">
                                <Avatar name={rNombre} />
                                <div className="foro-comentario-meta">
                                  <span className="foro-autor">{rNombre}</span>
                                  <span className="foro-fecha">{timeAgo(r.created_at)}</span>
                                </div>
                              </div>
                              <p className="foro-contenido">{r.contenido}</p>
                              {r.autor_id === user.id && (
                                <div className="foro-acciones">
                                  <button type="button" className="foro-accion-btn eliminar" onClick={() => eliminarComentario(r.id)}>
                                    Eliminar
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {hasMore && (
              <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
                <button
                  type="button"
                  className="foro-btn-cancel"
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{ minWidth: 140 }}
                >
                  {loadingMore ? 'Cargando…' : 'Cargar más comentarios'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── FAB ── */}
      <button type="button" className="foro-fab" onClick={() => setShowModal(true)} title="Nuevo comentario">
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
        </svg>
      </button>

      {/* ── Modal nuevo comentario ── */}
      {showModal && (
        <div className="foro-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="foro-modal" onClick={e => e.stopPropagation()}>
            <div className="foro-modal-header">
              <h2 className="foro-modal-titulo">Nuevo comentario</h2>
              <button type="button" className="foro-modal-close" onClick={() => setShowModal(false)}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="foro-modal-body">
              <textarea
                className="foro-textarea"
                placeholder="Comparte tus pensamientos sobre el libro…"
                maxLength={2000}
                value={nuevoContenido}
                onChange={e => setNuevoContenido(e.target.value)}
                rows={5}
                autoFocus
              />
              <div className="foro-modal-tags-label">Tags (opcional)</div>
              <div className="foro-modal-tags">
                {FORO_TAGS.map(tag => (
                  <button
                    key={tag} type="button"
                    className={clsx('foro-tag-pill', nuevoTags.includes(tag) && 'active')}
                    onClick={() => toggleNuevoTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="foro-modal-footer">
              <button type="button" className="foro-btn-submit" onClick={submitComentario} disabled={submitting || !nuevoContenido.trim()}>
                {submitting ? 'Publicando…' : 'Publicar'}
              </button>
              <button type="button" className="foro-btn-cancel" onClick={() => { setShowModal(false); setNuevoContenido(''); setNuevoTags([]) }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
