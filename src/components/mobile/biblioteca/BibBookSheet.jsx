// =============================================================
// INMERSIA · Biblioteca mobile — detalle del libro (bottom-sheet).
// MISMAS conexiones que BibBookModal (reseñas en `resenas_libros`,
// abrir libro, ir al foro, ir al cuaderno, mover de categoría).
// Presentación mobile: hoja inferior deslizante. SIN notas privadas.
// Patrón de entrada: base = visible; clase `.entering` (oculto)
// removida tras montar → robusto aunque se pausen las animaciones.
// =============================================================
import React from 'react'
import { INK, ACCENT, inmTint, BookCover } from './bibmHelpers.jsx'
import { useResena } from '../../../hooks/useResena.js'
import { getTourPhase } from '../../guidedTour.js'
import { runGuidedModalMobile } from '../../tutorial.mobile.js'

function Estrellas({ valor, onChange }) {
  const [hover, setHover] = React.useState(0)
  const interactiva = !!onChange
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} onClick={() => onChange && onChange(n)}
          onMouseEnter={() => interactiva && setHover(n)} onMouseLeave={() => interactiva && setHover(0)}
          style={{ fontSize: 24, cursor: interactiva ? 'pointer' : 'default', color: n <= (hover || valor) ? '#f0a83a' : 'rgba(74,54,34,0.22)', transition: 'color 0.1s', userSelect: 'none' }}>★</span>
      ))}
    </div>
  )
}

function SheetBody({ book, user, categories, onOpenBook, onGoForo, onGoNotebook, onAssignCategory }) {
  const esManual = book.id === 'manual'
  const c = book.color || '#5a3d28'
  const hasProgress = typeof book.progress === 'number'
  const pct = hasProgress ? Math.round(book.progress * 100) : 0

  const [moving, setMoving] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // reseña (lógica compartida con BibBookModal, ver src/hooks/useResena.js)
  const { miResena, form, setForm, modoForm, setModoForm, enviando, submitResena } = useResena(book, user, esManual)

  async function assign(catId) {
    if (esManual) return
    setSaving(true)
    await onAssignCategory(book.id, catId)
    setSaving(false); setMoving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, filter: `drop-shadow(3px 6px 9px ${INK}38)` }}>
          <BookCover book={book} h={148} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.12, letterSpacing: '-0.01em', color: INK, overflowWrap: 'break-word' }}>{book.title}</div>
          <div style={{ color: 'rgba(74,54,34,0.62)', fontSize: 13.5, marginTop: 5, fontWeight: 600 }}>{book.author}</div>
          {book.categoryName && (
            <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 11, background: c, color: '#fff', fontWeight: 700, fontSize: 11.5, padding: '4px 12px', borderRadius: 999, border: `2px solid ${INK}`, boxShadow: `1.2px 1.6px 0 ${INK}33`, textShadow: '0 1px 1px rgba(0,0,0,0.22)' }}>{book.categoryName}</span>
          )}
          <div style={{ fontSize: 12.5, color: 'rgba(74,54,34,0.55)', fontWeight: 600, marginTop: 10 }}>{book.pages.toLocaleString()} páginas</div>
        </div>
      </div>

      {hasProgress && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: INK }}>{pct}% <span style={{ fontSize: 12, color: 'rgba(74,54,34,0.55)', fontWeight: 600 }}>leído</span></span>
            <span style={{ fontSize: 12, color: 'rgba(74,54,34,0.55)', fontWeight: 600 }}>pág. {Math.round(book.pages * book.progress)} / {book.pages}</span>
          </div>
          <div style={{ height: 11, borderRadius: 8, background: 'rgba(74,54,34,0.15)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 8, background: `linear-gradient(90deg, ${ACCENT}, ${inmTint(ACCENT, 0.2)})` }} />
          </div>
        </div>
      )}

      {book.summary && (
        <div>
          <div className="bibm-lbl">Resumen</div>
          <p style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.6, color: 'rgba(74,54,34,0.85)' }}>{book.summary}</p>
        </div>
      )}

      {!esManual && (
        <div>
          <button className="bibm-row" onClick={() => setMoving(m => !m)} disabled={saving}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: c, border: `1.5px solid ${INK}55` }} />
              Mover a otra categoría
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" style={{ transform: moving ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {moving && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
              <button className="bibm-chip" onClick={() => assign(null)}>Sin categoría</button>
              {categories.map(cat => (
                <button key={cat.id} className="bibm-chip" onClick={() => assign(cat.id)}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: cat.color, marginRight: 7, border: `1px solid ${INK}55` }} />
                  {cat.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bibm-actions">
        <button id="tutorial-m-abrir-libro" className="bibm-btn" onClick={() => onOpenBook(book)}>
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4"><path d="M12 6.04A8.97 8.97 0 006 3.75c-1.05 0-2.06.18-3 .51v14.25A9 9 0 016 18c2.3 0 4.4.87 6 2.29m0-14.25A8.97 8.97 0 0118 3.75c1.05 0 2.06.18 3 .51v14.25A9 9 0 0018 18a8.97 8.97 0 00-6 2.29m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {hasProgress ? 'Continuar' : 'Abrir libro'}
        </button>
        {!esManual && (
          <button className="bibm-btn ghost foro" onClick={() => onGoForo(book)}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3"><path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-1.41-.59m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.59-.59z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Foro
          </button>
        )}
        {!esManual && (
          <button className="bibm-btn ghost cuad" onClick={() => onGoNotebook(book)}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Cuaderno
          </button>
        )}
      </div>

      {book.leido && !esManual && (
        <div style={{ borderTop: `2px solid ${INK}1f`, paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="bibm-lbl" style={{ marginBottom: 0 }}>Mi reseña</div>
            {!modoForm && <button className="bibm-link" onClick={() => setModoForm(true)}>{miResena ? 'Editar' : '+ Añadir'}</button>}
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
              <textarea className="bibm-ta" rows={3} maxLength={1000} placeholder="Escribe tu reseña (opcional)…" value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="bibm-btn" style={{ padding: '8px 18px', fontSize: 13.5 }} onClick={submitResena} disabled={!form.rating || enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
                <button className="bibm-btn ghost" style={{ padding: '8px 16px', fontSize: 13.5 }} onClick={() => setModoForm(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BibBookSheet({ book, user, categories, onClose, onOpenBook, onGoForo, onGoNotebook, onAssignCategory, transparentBackdrop = false }) {
  const [entering, setEntering] = React.useState(true)
  React.useEffect(() => { const t = setTimeout(() => setEntering(false), 20); return () => clearTimeout(t) }, [])
  // Tour: resalta "Abrir libro" al abrir la ficha durante la fase wait_modal
  React.useEffect(() => {
    if (getTourPhase() === 'wait_modal') {
      const t = setTimeout(() => runGuidedModalMobile(), 500)
      return () => clearTimeout(t)
    }
  }, [])
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="bibm-backdrop" onClick={onClose} style={transparentBackdrop ? { background: 'transparent', backdropFilter: 'none' } : undefined}>
      <div className={'bibm-sheet' + (entering ? ' entering' : '')} onClick={e => e.stopPropagation()}>
        <div className="bibm-grip" />
        <div className="bibm-sheet-head">
          <span className="bibm-sheet-title">Detalle del libro</span>
          <button className="bibm-close" onClick={onClose} aria-label="Cerrar">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="bibm-noscroll" style={{ overflowY: 'auto', padding: '4px 18px 26px', maxHeight: 'calc(100% - 64px)' }}>
          <SheetBody book={book} user={user} categories={categories}
            onOpenBook={onOpenBook} onGoForo={onGoForo} onGoNotebook={onGoNotebook} onAssignCategory={onAssignCategory} />
        </div>
      </div>
    </div>
  )
}
