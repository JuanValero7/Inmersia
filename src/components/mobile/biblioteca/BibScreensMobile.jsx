// =============================================================
// INMERSIA · Biblioteca mobile — pantallas Filtros y Gestionar.
// Entran a pantalla completa desde la derecha. "Gestionar" usa el
// MISMO contrato async que ManageCategoriasModal: onCreate/onUpdate/
// onDelete devuelven err|null y el orquestador los manda a Supabase.
// Patrón de entrada: base = visible; `.entering` removido tras montar.
// =============================================================
import React from 'react'
import { INK, ACCENT } from './bibmHelpers.jsx'

const PALETTE = ['#7d5bbe', '#3d7ea6', '#e0913f', '#d8553f', '#2fa18d', '#4f93c4', '#6e5f93', '#d56f97', '#5a8c5a', '#bd6a34']
const SIN_CATEGORIA_ID = '__sin_categoria'

function ScreenShell({ title, onClose, children, footer }) {
  const [entering, setEntering] = React.useState(true)
  React.useEffect(() => { const t = setTimeout(() => setEntering(false), 20); return () => clearTimeout(t) }, [])
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className={'bibm-screen-ov' + (entering ? ' entering' : '')}>
      <div className="bibm-full-head">
        <button className="bibm-back" onClick={onClose}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Biblioteca
        </button>
        <span className="bibm-full-title">{title}</span>
        <span style={{ width: 92 }} />
      </div>
      <div className="bibm-noscroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 40px' }}>{children}</div>
      {footer}
    </div>
  )
}

// ── Pantalla de Filtros ─────────────────────────────────────
export function FilterScreen({ categories, counts, active, hasSinCategoria, onPick, onClose }) {
  const rows = [{ id: null, nombre: 'Todos los libros', color: ACCENT }, ...categories]
  if (hasSinCategoria) rows.push({ id: SIN_CATEGORIA_ID, nombre: 'Sin categoría', color: '#7a4a28' })
  return (
    <ScreenShell title="Filtrar" onClose={onClose}
      footer={active != null && (
        <div className="bibm-screen-foot">
          <button className="bibm-btn ghost" style={{ width: '100%' }} onClick={() => onPick(null)}>Quitar filtro</button>
        </div>
      )}>
      <div className="bibm-lbl" style={{ marginBottom: 12 }}>Mostrar por categoría</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map(c => {
          const isActive = active === c.id
          const n = c.id == null ? counts.__all : (counts[c.id] || 0)
          return (
            <button key={c.id || 'all'} className={'bibm-filter-row' + (isActive ? ' active' : '')}
              onClick={() => { onPick(c.id); onClose() }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: c.color, flexShrink: 0, border: `2px solid ${INK}` }} />
                <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(74,54,34,0.5)' }}>{n}</span>
                {isActive && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
            </button>
          )
        })}
      </div>
    </ScreenShell>
  )
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {PALETTE.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={c}
          style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
            border: value === c ? `2px solid ${INK}` : '1px solid rgba(0,0,0,0.15)',
            boxShadow: value === c ? `0 0 0 2px #fffdf8, 0 0 0 4px ${c}` : 'none' }} />
      ))}
    </div>
  )
}

// ── Pantalla Gestionar tu colección ────────────────────────
export function ManageScreen({ categories, counts, onCreate, onUpdate, onDelete, onClose }) {
  const [nombre, setNombre] = React.useState('')
  const [color, setColor] = React.useState(PALETTE[0])
  const [editingId, setEditingId] = React.useState(null)
  const [editNombre, setEditNombre] = React.useState('')
  const [editColor, setEditColor] = React.useState(PALETTE[0])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)

  async function create(e) {
    e.preventDefault()
    const n = nombre.trim(); if (!n) return
    setBusy(true); setError(null)
    const err = await onCreate(n, color)
    setBusy(false)
    if (err) { setError(err); return }
    setNombre(''); setColor(PALETTE[0])
  }
  async function save() {
    const n = editNombre.trim(); if (!n) return
    setBusy(true); setError(null)
    const err = await onUpdate(editingId, { nombre: n, color: editColor })
    setBusy(false)
    if (err) { setError(err); return }
    setEditingId(null)
  }
  async function del(cat) {
    if (!window.confirm(`¿Borrar la categoría "${cat.nombre}"?\n\nLos libros que la tenían quedan sin categoría — no se borran.`)) return
    setBusy(true); setError(null)
    const err = await onDelete(cat.id)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <ScreenShell title="Gestionar tu colección" onClose={onClose}>
      <form onSubmit={create} className="bibm-card" style={{ marginBottom: 18 }}>
        <div className="bibm-lbl" style={{ marginBottom: 10 }}>Nueva categoría</div>
        <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
          <input className="bibm-input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Para releer" maxLength={60} />
          <button type="submit" className="bibm-btn" disabled={busy} style={{ padding: '10px 16px', fontSize: 14, opacity: nombre.trim() ? 1 : 0.5 }}>+ Crear</button>
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </form>

      {error && <div style={{ color: '#b4452e', fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{error}</div>}

      <div className="bibm-lbl" style={{ marginBottom: 11 }}>Tus categorías</div>
      {categories.length === 0
        ? <div style={{ color: 'rgba(74,54,34,0.55)', fontSize: 14, textAlign: 'center', padding: '20px 0', fontWeight: 600 }}>Todavía no tenés categorías.</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {categories.map(cat => (
              <div key={cat.id} className="bibm-cat-row">
                {editingId === cat.id ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
                    <input className="bibm-input" value={editNombre} onChange={e => setEditNombre(e.target.value)} maxLength={60} />
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="bibm-btn" disabled={busy} style={{ padding: '8px 16px', fontSize: 13.5 }} onClick={save}>Guardar</button>
                      <button className="bibm-btn ghost" style={{ padding: '8px 14px', fontSize: 13.5 }} onClick={() => setEditingId(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: cat.color, flexShrink: 0, border: `2px solid ${INK}` }} />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, fontSize: 15.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.nombre}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(74,54,34,0.5)' }}>{counts[cat.id] || 0} {(counts[cat.id] || 0) === 1 ? 'libro' : 'libros'}</span>
                    </span>
                    <button className="bibm-link" disabled={busy} onClick={() => { setEditingId(cat.id); setEditNombre(cat.nombre); setEditColor(cat.color || PALETTE[0]); setError(null) }}>Editar</button>
                    <button className="bibm-link danger" disabled={busy} onClick={() => del(cat)}>Borrar</button>
                  </>
                )}
              </div>
            ))}
          </div>}
    </ScreenShell>
  )
}
