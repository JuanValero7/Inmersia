// src/components/lector/SuperuserSoundsPanel.jsx
// Panel lateral exclusivo del superusuario para gestionar la media del capítulo.
// Pestaña "Ver": lista toda la media explícita del capítulo con botones quitar (✕)
//   y marcar destacado (★). La media de origen 'tag' solo se puede marcar.
// Pestaña "Sugerir": selector de párrafo + búsqueda de biblioteca_media + vincular.
import { useState, useEffect } from 'react'
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
  searchInput: {
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

export default function SuperuserSoundsPanel({ parrafos = [], mediaByParrafo = {}, onQuitar, onMarcar, onSugerir, onClose }) {
  const [tab, setTab]                   = useState('ver')
  const [marcados, setMarcados]         = useState({})
  const [sugerirParrafoId, setSugerirParrafoId] = useState('')
  const [allMedia, setAllMedia]         = useState([])
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [tipoFiltro, setTipoFiltro]     = useState('todos')
  const [busqueda, setBusqueda]         = useState('')

  // Inicializar párrafo destino con el primero que no sea separador
  useEffect(() => {
    const primero = parrafos.find(p => p.tipo !== 'separador')
    if (primero) setSugerirParrafoId(primero.id)
  }, [parrafos])

  // Cargar toda la biblioteca_media al abrir la pestaña Sugerir
  useEffect(() => {
    if (tab !== 'sugerir') return
    setLoadingMedia(true)
    supabase
      .from('biblioteca_media')
      .select('id, slug, tipo, url, titulo, descripcion, tags, destacado')
      .order('tipo').order('titulo')
      .then(({ data }) => { setAllMedia(data || []); setLoadingMedia(false) })
  }, [tab])

  // Toda la media del capítulo: explícita + tag
  const todaMedia = []
  for (const p of parrafos) {
    for (const m of (mediaByParrafo[p.id] || [])) {
      todaMedia.push({ parrafo: p, media: m })
    }
  }

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

  const handleMarcar = async (mediaId) => {
    const ok = await onMarcar(mediaId)
    if (ok) setMarcados(prev => ({ ...prev, [mediaId]: true }))
  }

  const handleVincular = (mediaId) => {
    const p = parrafos.find(p => p.id === sugerirParrafoId)
    if (p) onSugerir(sugerirParrafoId, mediaId, p.capitulo_id)
  }

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

        {/* ── Pestaña VER ────────────────────────────────────────── */}
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

        {/* ── Pestaña SUGERIR ─────────────────────────────────────── */}
        {tab === 'sugerir' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={s.label}>PÁRRAFO DESTINO</label>
              <select value={sugerirParrafoId} onChange={e => setSugerirParrafoId(e.target.value)} style={s.select}>
                {parrafos.filter(p => p.tipo !== 'separador').map(p => (
                  <option key={p.id} value={p.id}>
                    §{p.numero}: {(p.contenido || '').slice(0, 50)}…
                  </option>
                ))}
              </select>
            </div>

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
              style={s.searchInput}
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
                    <button type="button" onClick={() => handleVincular(m.id)} style={s.vincularBtn}>
                      + Vincular
                    </button>
                  </div>
                ))
            }
          </div>
        )}

      </div>
    </div>
  )
}
