import React from 'react'

// =============================================================
// ACUARELA · ManageCategoriasModal — MISMO contrato async
// (onCreate/onUpdate/onDelete devuelven err|null y van a Supabase
// vía VistaBiblioteca). Solo cambia la estética.
// =============================================================

const _CAT_INK = '#4a3622';
const _CAT_ACCENT = '#cf7b4c';
const SUGGESTED_PALETTE = ['#7d5bbe', '#3d7ea6', '#e0913f', '#d8553f', '#2fa18d', '#4f93c4', '#6e5f93', '#d56f97', '#5a8c5a', '#bd6a34'];

function ClayColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 34, height: 30, border: `2px solid ${_CAT_INK}`, borderRadius: 9, cursor: 'pointer', padding: 0, background: 'transparent' }} />
      {SUGGESTED_PALETTE.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)} title={c}
          style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
            border: value === c ? `2px solid ${_CAT_INK}` : '1px solid rgba(0,0,0,0.15)',
            boxShadow: value === c ? `0 0 0 2px #fffdf8, 0 0 0 4px ${c}` : 'none' }} />
      ))}
    </div>
  );
}

function ManageCategoriasModal({ categories, onClose, onCreate, onUpdate, onDelete }) {
  const [nuevoNombre, setNuevoNombre] = React.useState('');
  const [nuevoColor, setNuevoColor] = React.useState(SUGGESTED_PALETTE[0]);
  const [editingId, setEditingId] = React.useState(null);
  const [editNombre, setEditNombre] = React.useState('');
  const [editColor, setEditColor] = React.useState(SUGGESTED_PALETTE[0]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const ink = _CAT_INK;
  const inputStyle = { flex: 1, minWidth: 0, background: '#f4ecda', borderRadius: 12, padding: '10px 14px', border: `2px solid ${ink}`, color: ink, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, outline: 'none' };
  const btnAccent = { background: _CAT_ACCENT, color: '#fff', border: `2px solid ${ink}`, borderRadius: 13, padding: '9px 17px', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', textShadow: '0 1px 1px rgba(0,0,0,0.2)', boxShadow: `1.6px 2px 0 ${ink}33` };
  const btnGhost = { background: '#fffdf8', color: '#5a4632', border: `2px solid ${ink}`, borderRadius: 12, padding: '8px 14px', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: `1.6px 2px 0 ${ink}26` };

  async function handleCreate(e) {
    e.preventDefault();
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    setBusy(true); setError(null);
    const err = await onCreate(nombre, nuevoColor);
    setBusy(false);
    if (err) { setError(err); return; }
    setNuevoNombre(''); setNuevoColor(SUGGESTED_PALETTE[0]);
  }
  async function saveEdit() {
    const nombre = editNombre.trim();
    if (!nombre) return;
    setBusy(true); setError(null);
    const err = await onUpdate(editingId, { nombre, color: editColor });
    setBusy(false);
    if (err) { setError(err); return; }
    setEditingId(null);
  }
  async function del(cat) {
    if (!window.confirm(`¿Borrar la categoría "${cat.nombre}"?\n\nLos libros que la tenían van a quedar sin categoría — no se borran.`)) return;
    setBusy(true); setError(null);
    const err = await onDelete(cat.id);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(50,34,18,0.45)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Baloo 2', cursive" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '100%', maxHeight: '86vh', overflowY: 'auto', background: '#fffdf8', borderRadius: 26, border: `2px solid ${ink}`, padding: 26, boxShadow: `3px 5px 0 ${ink}1f, 14px 20px 40px rgba(40,26,12,0.3)`, color: ink }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 23 }}>Gestiona tu colección</div>
          <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: '50%', background: '#f4ecda', border: `2px solid ${ink}`, cursor: 'pointer', color: 'rgba(74,54,34,0.7)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleCreate} style={{ padding: 16, background: '#f4ecda', borderRadius: 16, marginBottom: 18, border: `2px solid ${ink}22` }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: 'rgba(74,54,34,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Nueva categoría</div>
          <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
            <input style={inputStyle} value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Ej: Para releer" maxLength={60} />
            <button type="submit" disabled={busy} style={{ ...btnAccent, opacity: nuevoNombre.trim() ? 1 : 0.5 }}>+ Crear</button>
          </div>
          <ClayColorPicker value={nuevoColor} onChange={setNuevoColor} />
        </form>

        {error && <div style={{ color: '#b4452e', fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{error}</div>}

        {categories.length === 0
          ? <div style={{ color: 'rgba(74,54,34,0.6)', fontSize: 14, textAlign: 'center', padding: '16px 0', fontWeight: 600 }}>Todavía no tenés categorías.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 14, background: '#f4ecda', border: `2px solid ${ink}1f` }}>
                  {editingId === cat.id ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <input style={inputStyle} value={editNombre} onChange={e => setEditNombre(e.target.value)} maxLength={60} />
                      <ClayColorPicker value={editColor} onChange={setEditColor} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={saveEdit} disabled={busy} style={{ ...btnAccent, padding: '7px 14px', fontSize: 13 }}>Guardar</button>
                        <button onClick={() => setEditingId(null)} style={btnGhost}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: cat.color, flexShrink: 0, border: `2px solid ${ink}` }} />
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{cat.nombre}</span>
                      <button onClick={() => { setEditingId(cat.id); setEditNombre(cat.nombre); setEditColor(cat.color || SUGGESTED_PALETTE[0]); setError(null); }} disabled={busy} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: _CAT_ACCENT, fontWeight: 700, fontSize: 13, padding: '4px 8px', fontFamily: 'inherit' }}>Editar</button>
                      <button onClick={() => del(cat)} disabled={busy} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#b4452e', fontWeight: 700, fontSize: 13, padding: '4px 8px', fontFamily: 'inherit' }}>Borrar</button>
                    </>
                  )}
                </div>
              ))}
            </div>}
      </div>
    </div>
  );
}

export default ManageCategoriasModal;
