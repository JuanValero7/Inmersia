// src/components/lector/SuperuserSoundsPanel.jsx
// Panel lateral exclusivo del superusuario para gestionar la media del capítulo.
// Pestaña "Ver": lista toda la media explícita + tag del capítulo con ★ y ✕.
// Pestaña "Sugerir": búsqueda de párrafo + anclar frase + borrar párrafo + vincular media.
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import { theme } from './clay.jsx'

const TIPOS = ['todos', 'audio', 'imagen', 'video']

const s = {
  panel: {
    position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, zIndex: 1200,
    background: theme.navBg, borderLeft: `2px solid ${theme.ink}`,
    boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'Baloo 2', sans-serif",
  },
  header: {
    padding: '14px 16px 10px', borderBottom: `1.5px solid ${theme.ink}22`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  tabBar: { display: 'flex', borderBottom: `1.5px solid ${theme.ink}22` },
  body: { flex: 1, overflowY: 'auto', padding: '12px 14px' },
  card: {
    marginBottom: 8, padding: '8px 10px',
    border: `1.5px solid ${theme.ink}22`, borderRadius: 10,
    background: 'rgba(255,255,255,0.38)',
  },
  metaRow: { fontSize: 10, color: `${theme.ink}77`, marginBottom: 5 },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  tipo: (t) => ({
    fontSize: 11, fontWeight: 700, minWidth: 32, flexShrink: 0,
    color: t === 'audio' ? '#8B4D2A' : t === 'imagen' ? '#4a7c59' : '#3a5f9a',
  }),
  nombre: {
    flex: 1, fontSize: 12, color: theme.ink,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  iconBtn: (active) => ({
    width: 26, height: 26, flexShrink: 0,
    border: `1.5px solid ${active ? theme.accent : `${theme.ink}44`}`,
    borderRadius: 6, cursor: 'pointer', fontSize: 12,
    background: active ? theme.accent : 'transparent',
    color: active ? '#fff' : theme.ink,
  }),
  deleteBtn: {
    width: 26, height: 26, flexShrink: 0,
    border: `1.5px solid ${theme.ink}44`, borderRadius: 6,
    cursor: 'pointer', fontSize: 12,
    background: 'transparent', color: '#c0392b',
  },
  empty: { color: `${theme.ink}77`, fontSize: 13, textAlign: 'center', marginTop: 28 },
  label: { fontSize: 11, fontWeight: 700, color: `${theme.ink}88`, display: 'block', marginBottom: 4 },
  select: {
    width: '100%', padding: '6px 8px',
    border: `1.5px solid ${theme.ink}44`, borderRadius: 8,
    fontFamily: "'Baloo 2', sans-serif", fontSize: 12,
    background: theme.navBg, color: theme.ink,
  },
  filterRow: { display: 'flex', gap: 5, marginBottom: 8 },
  filterBtn: (active) => ({
    flex: 1, padding: '4px 0',
    border: `1.5px solid ${active ? theme.accent : `${theme.ink}33`}`,
    borderRadius: 7, cursor: 'pointer', fontSize: 10.5, fontWeight: 700,
    background: active ? theme.accent : 'transparent',
    color: active ? '#fff' : theme.ink,
  }),
  input: {
    width: '100%', padding: '7px 10px',
    border: `1.5px solid ${theme.ink}44`, borderRadius: 8,
    fontFamily: "'Baloo 2', sans-serif", fontSize: 12,
    background: 'rgba(255,255,255,0.6)', color: theme.ink,
    boxSizing: 'border-box',
  },
  mediaCard: {
    padding: '7px 10px', marginBottom: 6,
    border: `1.5px solid ${theme.ink}22`, borderRadius: 9,
    background: 'rgba(255,255,255,0.35)',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  vincularBtn: {
    padding: '4px 9px', flexShrink: 0,
    border: `1.5px solid ${theme.accent}`, borderRadius: 7,
    background: theme.accent, color: '#fff',
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
  },
  playBtn: (active) => ({
    width: 22, height: 22, flexShrink: 0,
    border: `1.5px solid ${active ? '#c0392b' : `${theme.ink}44`}`,
    borderRadius: 5, cursor: 'pointer', fontSize: 10,
    background: active ? '#c0392b22' : 'transparent',
    color: active ? '#c0392b' : `${theme.ink}88`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  }),
  aviso: {
    fontSize: 11, color: '#c0392b', marginTop: 4,
    padding: '4px 8px', background: '#c0392b11', borderRadius: 6,
    border: '1px solid #c0392b33',
  },
  borrarBtn: {
    padding: '5px 12px', alignSelf: 'flex-start',
    border: '1.5px solid #c0392b', borderRadius: 7,
    background: 'transparent', color: '#c0392b',
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
  },
  confirmRow: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 10px', borderRadius: 7,
    background: '#c0392b11', border: '1px solid #c0392b33',
  },
  divider: {
    borderTop: `1px solid ${theme.ink}18`, marginTop: 4, paddingTop: 10,
  },
}

function TabBtn({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
      borderBottom: `2.5px solid ${active ? theme.accent : 'transparent'}`,
      background: 'transparent',
      color: active ? theme.accent : theme.navText,
      fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 12.5,
    }}>{label}</button>
  )
}

function tipoIcon(tipo) {
  if (tipo === 'audio') return '♪'
  if (tipo === 'imagen') return '🖼'
  return '▶'
}

export default function SuperuserSoundsPanel({
  parrafos = [], mediaByParrafo = {},
  onQuitar, onMarcar, onSugerir, onBorrarParrafo, onClose,
}) {
  const [tab, setTab]               = useState('ver')
  const [marcados, setMarcados]     = useState({})

  // Sugerir tab state
  const [parrafoBusqueda, setParrafoBusqueda] = useState('')
  const [sugerirParrafoId, setSugerirParrafoId] = useState('')
  const [textoRef, setTextoRef]     = useState('')
  const [textoRefAviso, setTextoRefAviso] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Media browser state
  const [allMedia, setAllMedia]     = useState([])
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [busqueda, setBusqueda]     = useState('')

  // Audio preview
  const [playingId, setPlayingId]   = useState(null)
  const audioRef = useRef(null)

  // Sync selection with visible options (accounts for search filter and deletions)
  useEffect(() => {
    const visibles = parrafos.filter(p => {
      if (p.tipo === 'separador') return false
      if (!parrafoBusqueda) return true
      return (p.contenido || '').toLowerCase().includes(parrafoBusqueda.toLowerCase())
    })
    if (!sugerirParrafoId || !visibles.find(p => p.id === sugerirParrafoId)) {
      setSugerirParrafoId(visibles[0]?.id || '')
    }
  }, [parrafos, parrafoBusqueda])

  // Load all biblioteca_media when Sugerir tab opens
  useEffect(() => {
    if (tab !== 'sugerir') return
    setLoadingMedia(true)
    supabase
      .from('biblioteca_media')
      .select('id, slug, tipo, url, titulo, descripcion, tags, destacado')
      .order('tipo').order('titulo')
      .then(({ data }) => { setAllMedia(data || []); setLoadingMedia(false) })
  }, [tab])

  // Stop audio on unmount or tab change away from sugerir
  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }
  }, [])

  useEffect(() => {
    if (tab !== 'sugerir' && audioRef.current) {
      audioRef.current.pause(); audioRef.current = null
      setPlayingId(null)
    }
  }, [tab])

  // Clear texto_ref warning when phrase or paragraph changes
  useEffect(() => { setTextoRefAviso('') }, [textoRef, sugerirParrafoId])

  // Clear delete confirmation when paragraph changes
  useEffect(() => { setConfirmDelete(null) }, [sugerirParrafoId])

  // ── Computed ──────────────────────────────────────────────

  const todaMedia = []
  for (const p of parrafos) {
    for (const m of (mediaByParrafo[p.id] || [])) {
      todaMedia.push({ parrafo: p, media: m })
    }
  }

  const parrafosFiltered = parrafos.filter(p => {
    if (p.tipo === 'separador') return false
    if (!parrafoBusqueda) return true
    return (p.contenido || '').toLowerCase().includes(parrafoBusqueda.toLowerCase())
  })

  const mediaFiltrada = allMedia.filter(m => {
    if (tipoFiltro !== 'todos' && m.tipo !== tipoFiltro) return false
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      (m.titulo || '').toLowerCase().includes(q) ||
      m.slug.toLowerCase().includes(q) ||
      (m.tags || []).some(t => t.toLowerCase().includes(q))
    )
  })

  // ── Handlers ──────────────────────────────────────────────

  const handleMarcar = async (mediaId) => {
    const ok = await onMarcar(mediaId)
    if (ok) setMarcados(prev => ({ ...prev, [mediaId]: true }))
  }

  const handleVincular = (mediaId) => {
    const p = parrafos.find(p => p.id === sugerirParrafoId)
    if (!p) return
    const phrase = textoRef.trim()
    let finalTextoRef = null
    if (phrase) {
      if ((p.contenido || '').includes(phrase)) {
        finalTextoRef = phrase
      } else {
        setTextoRefAviso('Frase no encontrada en el párrafo — el sonido se vincula al párrafo completo.')
      }
    }
    onSugerir(sugerirParrafoId, mediaId, p.capitulo_id, finalTextoRef)
  }

  const handlePlay = (m) => {
    if (playingId === m.id) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
      setPlayingId(null)
      return
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    const audio = new Audio(m.url)
    audio.volume = 0.85
    audio.onended = () => { audioRef.current = null; setPlayingId(null) }
    audio.play().catch(() => {})
    audioRef.current = audio
    setPlayingId(m.id)
  }

  const handleBorrar = async (parrafoId) => {
    if (confirmDelete !== parrafoId) { setConfirmDelete(parrafoId); return }
    setConfirmDelete(null)
    const p = parrafos.find(q => q.id === parrafoId)
    if (!p) return
    const ok = await onBorrarParrafo(parrafoId, p.capitulo_id)
    if (ok && sugerirParrafoId === parrafoId) {
      const remaining = parrafos.filter(q => q.tipo !== 'separador' && q.id !== parrafoId)
      setSugerirParrafoId(remaining[0]?.id || '')
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={{ fontWeight: 800, fontSize: 13.5, color: theme.ink }}>⚙ Media del capítulo</span>
        <button type="button" onClick={onClose} style={{
          width: 24, height: 24, border: `1.5px solid ${theme.ink}55`,
          borderRadius: 7, background: 'transparent', cursor: 'pointer',
          color: theme.ink, fontWeight: 700, fontSize: 14, lineHeight: 1,
        }}>×</button>
      </div>

      <div style={s.tabBar}>
        <TabBtn label="Ver / Gestionar" active={tab === 'ver'} onClick={() => setTab('ver')} />
        <TabBtn label="Sugerir" active={tab === 'sugerir'} onClick={() => setTab('sugerir')} />
      </div>

      <div style={s.body}>

        {/* ── Pestaña VER ──────────────────────────────────── */}
        {tab === 'ver' && (
          todaMedia.length === 0
            ? <p style={s.empty}>No hay media en este capítulo.</p>
            : todaMedia.map(({ parrafo: p, media: m }, i) => (
              <div key={i} style={s.card}>
                <div style={s.metaRow}>
                  §{p.numero} · {(p.contenido || '').slice(0, 45)}…
                  {m.origen === 'tag' && <span style={{ marginLeft: 6, opacity: 0.6 }}>[auto]</span>}
                </div>
                <div style={s.row}>
                  <span style={s.tipo(m.tipo)}>{tipoIcon(m.tipo)} {m.tipo}</span>
                  <span style={s.nombre}>{m.titulo || m.slug}</span>
                  <button
                    type="button"
                    title={marcados[m.media_id] ? 'Ya marcado como destacado' : 'Marcar como destacado'}
                    onClick={() => handleMarcar(m.media_id)}
                    style={s.iconBtn(marcados[m.media_id])}
                  >★</button>
                  <button
                    type="button"
                    title={m.origen === 'explicito' ? 'Quitar vínculo' : 'Solo se pueden quitar vínculos explícitos'}
                    disabled={m.origen !== 'explicito'}
                    onClick={() => m.origen === 'explicito' && onQuitar(p.id, m.media_id, p.capitulo_id)}
                    style={{ ...s.deleteBtn, opacity: m.origen === 'explicito' ? 1 : 0.35, cursor: m.origen === 'explicito' ? 'pointer' : 'default' }}
                  >✕</button>
                </div>
              </div>
            ))
        )}

        {/* ── Pestaña SUGERIR ──────────────────────────────── */}
        {tab === 'sugerir' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Búsqueda de párrafo */}
            <div>
              <label style={s.label}>BUSCAR PÁRRAFO</label>
              <input
                type="text"
                placeholder="Filtrar por texto del párrafo…"
                value={parrafoBusqueda}
                onChange={e => setParrafoBusqueda(e.target.value)}
                style={s.input}
              />
            </div>

            {/* Selector de párrafo */}
            <div>
              <label style={s.label}>PÁRRAFO DESTINO {parrafoBusqueda ? `(${parrafosFiltered.length})` : ''}</label>
              <select value={sugerirParrafoId} onChange={e => setSugerirParrafoId(e.target.value)} style={s.select}>
                {parrafosFiltered.length === 0
                  ? <option value="">Sin resultados</option>
                  : parrafosFiltered.map(p => (
                    <option key={p.id} value={p.id}>
                      §{p.numero}: {(p.contenido || '').slice(0, 50)}…
                    </option>
                  ))
                }
              </select>
              {(() => {
                const sel = parrafos.find(p => p.id === sugerirParrafoId)
                if (!sel) return null
                return (
                  <div style={{ fontSize: 10.5, color: `${theme.ink}88`, marginTop: 4, padding: '4px 8px', background: 'rgba(255,255,255,0.4)', borderRadius: 6, fontStyle: 'italic' }}>
                    §{sel.numero}: {(sel.contenido || '').slice(0, 90)}{(sel.contenido || '').length > 90 ? '…' : ''}
                  </div>
                )
              })()}
            </div>

            {/* Anclar a frase */}
            <div>
              <label style={s.label}>ANCLAR A FRASE (opcional)</label>
              <input
                type="text"
                placeholder="Fragmento exacto del párrafo…"
                value={textoRef}
                onChange={e => setTextoRef(e.target.value)}
                style={s.input}
              />
              {textoRefAviso && <div style={s.aviso}>⚠ {textoRefAviso}</div>}
            </div>

            {/* Borrar párrafo */}
            {sugerirParrafoId && (
              confirmDelete === sugerirParrafoId
                ? (
                  <div style={s.confirmRow}>
                    <span style={{ fontSize: 11, color: '#c0392b', flex: 1, fontWeight: 700 }}>
                      ¿Borrar este párrafo permanentemente?
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBorrar(sugerirParrafoId)}
                      style={{ ...s.borrarBtn, background: '#c0392b', color: '#fff', border: 'none' }}
                    >Sí</button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      style={{ ...s.borrarBtn, border: `1.5px solid ${theme.ink}44`, color: theme.ink }}
                    >No</button>
                  </div>
                )
                : (
                  <button type="button" onClick={() => handleBorrar(sugerirParrafoId)} style={s.borrarBtn}>
                    🗑 Borrar párrafo
                  </button>
                )
            )}

            {/* Buscador de media + lista */}
            <div style={s.divider}>
              <div style={s.filterRow}>
                {TIPOS.map(t => (
                  <button key={t} type="button" onClick={() => setTipoFiltro(t)} style={s.filterBtn(tipoFiltro === t)}>
                    {t}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Buscar por título, slug o tag…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ ...s.input, marginBottom: 8 }}
              />

              {loadingMedia
                ? <p style={{ ...s.empty, marginTop: 16 }}>Cargando…</p>
                : mediaFiltrada.length === 0
                  ? <p style={{ ...s.empty, marginTop: 16 }}>Sin resultados.</p>
                  : mediaFiltrada.map(m => (
                    <div key={m.id} style={s.mediaCard}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{tipoIcon(m.tipo)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.titulo || m.slug}
                        </div>
                        <div style={{ fontSize: 10, color: `${theme.ink}66` }}>{m.slug}</div>
                      </div>
                      {m.tipo === 'audio' && (
                        <button
                          type="button"
                          title={playingId === m.id ? 'Detener' : 'Escuchar'}
                          onClick={() => handlePlay(m)}
                          style={s.playBtn(playingId === m.id)}
                        >
                          {playingId === m.id ? '■' : '▶'}
                        </button>
                      )}
                      <button type="button" onClick={() => handleVincular(m.id)} style={s.vincularBtn}>
                        + Vincular
                      </button>
                    </div>
                  ))
              }
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
