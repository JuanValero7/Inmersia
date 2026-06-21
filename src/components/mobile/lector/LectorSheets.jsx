import { useState } from 'react'
import { ACCENT, INK } from '../../lector/clay.jsx'
import { READING_FONTS } from '../../lector/readerConstants.js'
import { useWhiteNoise, TIPOS_RUIDO, AMBIENCIAS } from '../../../hooks/useWhiteNoise.js'

const IcClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
)

function EstrellaLector({ valor, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onChange?.(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          style={{ fontSize: 34, cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', color: n <= (hover || valor) ? ACCENT : 'rgba(74,54,34,0.2)', transition: 'color 0.1s' }}>★</span>
      ))}
    </div>
  )
}

export function XraySheet({ items, chapterNum, esNoficcion, onClose, onItemClick }) {
  const ini = s => (s || '').replace(/^(El|La|Los|Las)\s+/i, '').charAt(0).toUpperCase()
  return (
    <div className="lm-backdrop" onClick={onClose}>
      <div className="lm-sheet" onClick={e => e.stopPropagation()}>
        <div className="lm-grip" />
        <div className="lm-sheet-head">
          <span className="lm-sheet-title">X-ray · cap. {chapterNum}</span>
          <button className="lm-close" onClick={onClose}><IcClose /></button>
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 18px 28px' }}>
          {items.length === 0
            ? <p style={{ fontSize: 14, color: 'rgba(74,54,34,0.5)', fontStyle: 'italic', marginTop: 12 }}>{esNoficcion ? 'Sin términos en este capítulo.' : 'Sin personajes en este capítulo.'}</p>
            : items.map(it => (
              <button key={it.id} onClick={() => onItemClick?.(it.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(74,54,34,0.08)', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: '#d56a52', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(74,54,34,0.3)' }}>
                  {ini(it.nombre)}
                </span>
                <span style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 15, color: '#4a3622' }}>{it.nombre}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

export function ChapterSheet({ chapters, current, onPick, onClose }) {
  return (
    <div className="lm-backdrop" onClick={onClose}>
      <div className="lm-sheet" onClick={e=>e.stopPropagation()}>
        <div className="lm-grip" />
        <div className="lm-sheet-head"><span className="lm-sheet-title">Capítulos</span>
          <button className="lm-close" onClick={onClose}><IcClose /></button></div>
        <div className="lm-chap-list">
          {chapters.map((c, i) => (
            <button key={c.id ?? i} className={'lm-chap-row' + (i===current?' active':'')} onClick={() => onPick(i)}>
              <span className="lm-chap-num">{String(c.numero ?? i+1).padStart(2,'0')}</span>
              <span className="lm-chap-meta">
                <span className="t">{c.titulo || `Capítulo ${c.numero ?? i+1}`}</span>
              </span>
              {i===current && <span className="lm-reading-badge">Leyendo</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TypoSheet({ fontSize, onFontSize, readingFont, onReadingFont, readingTheme = 'light', onReadingTheme, onClose }) {
  const MIN = 16, MAX = 24
  return (
    <div className="lm-backdrop" onClick={onClose}>
      <div className="lm-sheet" onClick={e=>e.stopPropagation()}>
        <div className="lm-grip" />
        <div className="lm-sheet-head"><span className="lm-sheet-title">Texto</span>
          <button className="lm-close" onClick={onClose}><IcClose /></button></div>
        <div className="lm-typo-body">
          <div className="lm-typo-label">Tamaño</div>
          <div className="lm-size-row">
            <button className="lm-size-btn" style={{ fontSize: 15 }} disabled={fontSize<=MIN} onClick={() => onFontSize(Math.max(MIN, fontSize-1))}>A</button>
            <div className="lm-size-track"><div className="lm-size-fill" style={{ width: `${((fontSize-MIN)/(MAX-MIN))*100}%` }} /></div>
            <button className="lm-size-btn" style={{ fontSize: 22 }} disabled={fontSize>=MAX} onClick={() => onFontSize(Math.min(MAX, fontSize+1))}>A</button>
          </div>
          <div className="lm-typo-label">Fuente</div>
          <div className="lm-font-grid">
            {READING_FONTS.map((f) => (
              <button key={f.label} className={'lm-font-card' + (f.css===readingFont?' active':'')} onClick={() => onReadingFont(f.css)}>
                <span className="ag" style={{ fontFamily: f.css }}>Ag</span>
                <span className="nm">{f.label}</span>
              </button>
            ))}
          </div>
          {onReadingTheme && (<>
            <div className="lm-typo-label">Tema</div>
            <div className="lm-theme-row">
              {[{ id: 'light', label: 'Claro' }, { id: 'dark', label: 'Noche' }].map(t => (
                <button key={t.id} className={'lm-theme-card ' + t.id + (readingTheme===t.id?' active':'')} onClick={() => onReadingTheme(t.id)}>
                  <span className="sw">A</span>
                  <span className="nm">{t.label}</span>
                </button>
              ))}
            </div>
          </>)}
        </div>
      </div>
    </div>
  )
}

export function WhiteNoiseSheet({ onClose }) {
  const { tipo, setTipo, volNoise, setVolNoise, ambiente, setAmbiente, volAmb, setVolAmb } = useWhiteNoise()
  const pill = (active) => ({
    fontSize: 12, fontWeight: 700, padding: '5px 13px', borderRadius: 999,
    border: `1.5px solid ${active ? ACCENT : `${INK}44`}`,
    background: active ? ACCENT : 'transparent',
    color: active ? '#fff' : INK, cursor: 'pointer',
  })
  return (
    <div className="lm-backdrop" onClick={onClose}>
      <div className="lm-sheet" onClick={e => e.stopPropagation()}>
        <div className="lm-grip" />
        <div className="lm-sheet-head">
          <span className="lm-sheet-title">Ambiente sonoro</span>
          <button className="lm-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '4px 18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: `${INK}77`, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Ruido</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {TIPOS_RUIDO.map(({ key, label }) => (
                <button key={key} type="button" style={pill(tipo === key)} onClick={() => setTipo(key)}>{label}</button>
              ))}
            </div>
            <div className="lm-vol" style={{ opacity: tipo === 'off' ? 0.35 : 1 }}>
              <div className="lm-vol-row">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M11 5L6 9H3v6h3l5 4z" strokeLinejoin="round"/></svg>
                <input className="lm-range" type="range" min="0" max="1" step="0.01"
                  value={volNoise} disabled={tipo === 'off'}
                  onChange={e => setVolNoise(parseFloat(e.target.value))} />
                <span style={{ fontSize: 11, minWidth: 30, color: INK }}>{Math.round(volNoise * 100)}%</span>
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: `${INK}18` }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: `${INK}77`, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Ambiente</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {AMBIENCIAS.map(({ key, label }) => (
                <button key={key} type="button" style={pill(ambiente === key)} onClick={() => setAmbiente(key)}>{label}</button>
              ))}
            </div>
            <div className="lm-vol" style={{ opacity: ambiente === 'ninguno' ? 0.35 : 1 }}>
              <div className="lm-vol-row">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M11 5L6 9H3v6h3l5 4z" strokeLinejoin="round"/></svg>
                <input className="lm-range" type="range" min="0" max="1" step="0.01"
                  value={volAmb} disabled={ambiente === 'ninguno'}
                  onChange={e => setVolAmb(parseFloat(e.target.value))} />
                <span style={{ fontSize: 11, minWidth: 30, color: INK }}>{Math.round(volAmb * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AudioSheet({ ambient, playing, volume, onToggle, onVolume, onClose }) {
  const disabled = !ambient?.url
  return (
    <div className="lm-backdrop" onClick={onClose}>
      <div className="lm-sheet" onClick={e=>e.stopPropagation()}>
        <div className="lm-grip" />
        <div className="lm-sheet-head"><span className="lm-sheet-title">Ambiente</span>
          <button className="lm-close" onClick={onClose}><IcClose /></button></div>
        <div className="lm-audio-body">
          <div className="lm-audio-track">♪ {ambient ? (ambient.titulo || ambient.slug || 'ambiente') : 'sin ambiente en este capítulo'}</div>
          <div className="lm-reels">
            <div className={'lm-reel' + (playing?' spin':'')} />
            <div className={'lm-reel' + (playing?' spin':'')} />
          </div>
          <div className="lm-meter">
            {Array.from({length:18}).map((_,i) => {
              const on = playing && i < Math.round(volume*18)
              return <i key={i} className={on?'on':''} style={{ height: 6 + (i%5)*4 }} />
            })}
          </div>
          <div className="lm-audio-ctrls">
            <button className="lm-play" disabled={disabled} onClick={onToggle}>{playing?'❚❚':'▶'}</button>
            <div className="lm-vol">
              <div className="lm-vol-row">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M11 5L6 9H3v6h3l5 4z" strokeLinejoin="round"/></svg>
                <input className="lm-range" type="range" min="0" max="1" step="0.01" value={volume} onChange={e=>onVolume(parseFloat(e.target.value))} />
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H3v6h3l5 4z" strokeLinejoin="round"/><path d="M16 9a3 3 0 010 6" strokeLinecap="round"/><path d="M19 6.5a6.5 6.5 0 010 11" strokeLinecap="round"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NavSheet({ onGoForo, onGoCartelera, onGoBiblioteca, onClose }) {
  const items = [
    { label:'Biblioteca',    act: onGoBiblioteca, icon:<g><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></g> },
    { label:'Investigación', act: onGoCartelera,  icon:<g><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></g> },
    { label:'Foro',          act: onGoForo,       icon:<path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/> },
  ]
  return (
    <div className="lm-backdrop" onClick={onClose}>
      <div className="lm-sheet" onClick={e=>e.stopPropagation()}>
        <div className="lm-grip" />
        <div className="lm-sheet-head"><span className="lm-sheet-title">Ir a…</span>
          <button className="lm-close" onClick={onClose}><IcClose /></button></div>
        <div className="lm-nav-grid">
          {items.map(it => (
            <button key={it.label} onClick={() => { onClose(); it.act?.() }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{it.icon}</svg>
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ImageOverlay({ images, chapter, chapterIndex, onClose, autoImages, onToggleAutoImages }) {
  const [idx, setIdx] = useState(0)
  const cur = images[idx] || null
  return (
    <div className="lm-img-overlay" onClick={onClose}>
      <div className="lm-polaroid" onClick={e=>e.stopPropagation()}>
        <div className="pic">
          {cur?.url ? <img src={cur.url} alt={cur.titulo || ''} /> : <span className="ph-label">sin imagen para este capítulo</span>}
        </div>
        <div className="cap">{cur ? (cur.titulo || cur.slug || 'escena') : '—'}</div>
      </div>
      {images.length > 1 && (
        <div className="lm-img-thumbs" onClick={e=>e.stopPropagation()}>
          {images.map((img, i) => (
            <button key={img.media_id ?? i} className={'lm-img-thumb' + (i===idx?' active':'')} onClick={() => setIdx(i)}>
              <img src={img.url} alt="" />
            </button>
          ))}
        </div>
      )}
      <div className="lm-img-meta">Capítulo {chapter?.numero ?? chapterIndex + 1}{chapter?.titulo ? ` · ${chapter.titulo}` : ''}</div>
      <div className="lm-img-bottom" onClick={e=>e.stopPropagation()}>
        <button className={`lm-img-autotoggle${autoImages ? ' on' : ''}`} onClick={onToggleAutoImages}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4"/></svg>
          Aparecer automático
        </button>
        <button className="lm-img-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  )
}

export function ResenaSheet({ form, setForm, enviando, miResena, onSubmit, onClose }) {
  return (
    <div className="lm-backdrop" onClick={onClose}>
      <div className="lm-sheet" onClick={e=>e.stopPropagation()}>
        <div className="lm-grip" />
        <div className="lm-sheet-head"><span className="lm-sheet-title">{miResena ? 'Editar mi reseña' : 'Escribir una reseña'}</span>
          <button className="lm-close" onClick={onClose}><IcClose /></button></div>
        <div className="lm-resena-body">
          <EstrellaLector valor={form.rating} onChange={r => setForm(f => ({ ...f, rating: r }))} />
          <textarea className="lm-resena-ta" rows={4} maxLength={1000}
            placeholder="Escribe tu reseña (opcional)…"
            value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} />
          <div className="lm-resena-actions">
            <button className="lm-resena-cancel" onClick={onClose}>Cancelar</button>
            <button className="lm-resena-save" disabled={!form.rating || enviando} onClick={onSubmit}>{enviando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ConfirmSubrayadoSheet({ segmentos, pendingConfirm, onDescartar, onContinuar, onGuardar, guardando }) {
  const textoAcumulado = segmentos.map(s => s.text).join(' ')
  return (
    <div className="lm-backdrop" onClick={onDescartar}>
      <div className="lm-sheet" onClick={e => e.stopPropagation()}>
        <div className="lm-grip" />
        <div className="lm-sheet-head">
          <span className="lm-sheet-title">Subrayado</span>
          <button className="lm-close" onClick={onDescartar}><IcClose /></button>
        </div>
        <div className="lm-csub-body">
          {segmentos.length > 0 && (
            <div className="lm-csub-prev">
              <span className="lm-csub-label">Página{segmentos.length > 1 ? 's' : ''} anterior{segmentos.length > 1 ? 'es' : ''}</span>
              <p className="lm-csub-text lm-csub-text--prev">{textoAcumulado}</p>
            </div>
          )}
          <div>
            {segmentos.length > 0 && <span className="lm-csub-label">Esta página</span>}
            <p className="lm-csub-text">{pendingConfirm.text}</p>
          </div>
        </div>
        <div className="lm-csub-actions">
          <button className="lm-csub-btn lm-csub-btn--discard" onClick={onDescartar}>Descartar</button>
          <button className="lm-csub-btn lm-csub-btn--continue" onClick={onContinuar}>+ Sig. página</button>
          <button className="lm-csub-btn lm-csub-btn--save" onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
