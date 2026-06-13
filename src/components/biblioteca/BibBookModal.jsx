import React from 'react'
import { inmTint } from './clay/helpers.jsx'
import { getTourPhase } from '../guidedTour.js'
import { runGuidedModal } from '../tutorial.js'
import { useResena } from '../../hooks/useResena.js'

// =============================================================
// ACUARELA · BibBookModal — MISMAS conexiones que el real
// (reseñas, notas, asignar categoría, abrir libro, ir al foro).
// Solo cambia la estética a acuarela/clay.
// =============================================================

const _MK_INK = '#4a3622';
const _MK_ACCENT = '#cf7b4c';
const _MK_PANEL = '#fffdf8';
const COLOR_BOOK_FALLBACK = '#5a3d28';

function Estrellas({ valor, onChange }) {
  const [hover, setHover] = React.useState(0);
  const interactiva = !!onChange;
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} onClick={() => onChange?.(n)}
          onMouseEnter={() => interactiva && setHover(n)} onMouseLeave={() => interactiva && setHover(0)}
          style={{ fontSize: 22, cursor: interactiva ? 'pointer' : 'default', color: n <= (hover || valor) ? '#f0a83a' : 'rgba(74,54,34,0.25)', transition: 'color 0.1s', userSelect: 'none' }}>★</span>
      ))}
    </div>
  );
}

function BibBookModal({ book, user, onClose, onOpenBook, onGoForo, onGoNotebook, categories, onAssignCategory }) {
  const bg = book.color || COLOR_BOOK_FALLBACK;
  const [saving, setSaving] = React.useState(false);
  const esManual = book.id === 'manual';

  // Reseña (lógica compartida con BibBookSheet, ver src/hooks/useResena.js)
  const { miResena, form, setForm, modoForm, setModoForm, enviando, submitResena } = useResena(book, user, esManual);

  React.useEffect(() => {
    if (getTourPhase() === 'wait_modal') {
      const t = setTimeout(() => runGuidedModal(), 600)
      return () => clearTimeout(t)
    }
  }, [])

  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleCategoryChange(e) {
    if (esManual) return;
    const next = e.target.value || null;
    setSaving(true);
    await onAssignCategory(book.id, next);
    setSaving(false);
  }

  const ink = _MK_INK;
  const label = { fontSize: 11, fontWeight: 800, color: 'rgba(74,54,34,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 };
  const primary = { display: 'flex', alignItems: 'center', gap: 8, background: _MK_ACCENT, color: '#fff', border: `2px solid ${ink}`, borderRadius: 14, padding: '11px 20px', fontFamily: 'inherit', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', textShadow: '0 1px 1px rgba(0,0,0,0.2)', boxShadow: `1.8px 2.4px 0 ${ink}33` };
  const ghost = { background: _MK_PANEL, color: '#5a4632', border: `2px solid ${ink}`, borderRadius: 14, padding: '11px 18px', fontFamily: 'inherit', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', boxShadow: `1.8px 2.4px 0 ${ink}26` };
  const inputBase = { width: '100%', background: '#f4ecda', border: `2px solid ${ink}`, borderRadius: 12, padding: '10px 13px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: ink, outline: 'none', boxSizing: 'border-box' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Baloo 2', cursive", background: 'rgba(20,12,6,0.5)', backdropFilter: 'blur(8px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', background: _MK_PANEL, borderRadius: 26, border: `2px solid ${ink}`, boxShadow: `3px 5px 0 ${ink}1f, 14px 20px 40px rgba(40,26,12,0.3)`, color: ink }}>
        {/* Banda superior con el color del libro */}
        <div style={{ padding: '22px 24px 18px', borderRadius: '24px 24px 0 0', borderBottom: `2px solid ${ink}`, background: `linear-gradient(135deg, ${bg} 0%, ${inmTint(bg, -0.12)} 100%)` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ color: '#fff', fontSize: 23, fontWeight: 800, lineHeight: 1.18, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{book.title}</h2>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4, fontWeight: 600 }}>{book.author}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {book.categoryName && <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 999, fontSize: 11.5, fontWeight: 700, padding: '3px 11px', border: '1.5px solid rgba(255,255,255,0.4)' }}>{book.categoryName}</span>}
                <span style={{ background: 'rgba(0,0,0,0.16)', color: 'rgba(255,255,255,0.92)', borderRadius: 999, fontSize: 11.5, fontWeight: 700, padding: '3px 11px' }}>{book.pages.toLocaleString()} páginas</span>
              </div>
            </div>
            <button onClick={onClose} style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.2)', border: '2px solid rgba(255,255,255,0.45)', cursor: 'pointer', color: '#fff', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {book.summary && (
            <div>
              <div style={label}>Resumen</div>
              <p style={{ fontSize: 14.5, color: '#4a2510', lineHeight: 1.65, fontWeight: 500 }}>{book.summary}</p>
            </div>
          )}

          {!esManual && (
            <div>
              <div style={label}>Categoría</div>
              <select value={book.categoria_id || ''} disabled={saving} onChange={handleCategoryChange}
                style={{ ...inputBase, appearance: 'none', WebkitAppearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234a3622' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, cursor: 'pointer' }}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button id="tutorial-abrir-libro-btn" style={{ ...primary, justifyContent: 'center', padding: '14px 24px', fontSize: 16.5 }} onClick={() => onOpenBook(book)}>
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Abrir libro
            </button>
            {!esManual && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...ghost, flex: 1, justifyContent: 'center', color: '#3d6b8a', fontSize: 13.5, padding: '9px 14px' }} onClick={() => onGoForo(book)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4"><path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Ir al Foro
                  </span>
                </button>
                <button style={{ ...ghost, flex: 1, justifyContent: 'center', color: '#5a7a4a', fontSize: 13.5, padding: '9px 14px' }} onClick={() => onGoNotebook(book)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Cuaderno
                  </span>
                </button>
              </div>
            )}
          </div>

          {book.leido && !esManual && (
            <div style={{ borderTop: `2px solid ${ink}1f`, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ ...label, marginBottom: 0 }}>Mi Reseña</div>
                {!modoForm && <button onClick={() => setModoForm(true)} style={{ fontSize: 13, color: _MK_ACCENT, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontWeight: 700 }}>{miResena ? 'Editar' : '+ Añadir'}</button>}
              </div>
              {!modoForm && miResena && (
                <div>
                  <Estrellas valor={miResena.rating} />
                  {miResena.texto && <p style={{ fontSize: 14, color: '#4a2510', marginTop: 6, lineHeight: 1.55, fontWeight: 500 }}>{miResena.texto}</p>}
                </div>
              )}
              {!modoForm && !miResena && <p style={{ fontSize: 13.5, color: 'rgba(74,54,34,0.5)', fontStyle: 'italic', fontWeight: 600 }}>Aún no has escrito una reseña.</p>}
              {modoForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Estrellas valor={form.rating} onChange={r => setForm(f => ({ ...f, rating: r }))} />
                  <textarea rows={3} placeholder="Escribe tu reseña (opcional)…" maxLength={1000} value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} style={{ ...inputBase, resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...primary, padding: '7px 16px', fontSize: 13 }} onClick={submitResena} disabled={!form.rating || enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
                    <button style={{ ...ghost, padding: '7px 16px', fontSize: 13 }} onClick={() => setModoForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BibBookModal;
