// src/components/mobile/LectorMobile.jsx
// ─────────────────────────────────────────────────────────────
// CÁSCARA MOBILE DEL LECTOR INMERSIVO (estética clay / acuarela).
//
// Reescribe SOLO el chrome: en vez del escritorio de doble página con
// barras flotantes, usa un layout vertical de teléfono que ocupa todo el
// viewport SIN scroll:
//   · header compacto      → nombre del libro + autor + botón Explorar (globo)
//   · controles compactos  → selector de capítulo (naranja) + tipografía,
//                            cada uno abre una pantalla de detalle (sheet)
//   · libro a una sola página → se avanza tocando los laterales de la hoja
//   · mascota (gato) abajo-izq → al tocarla despliega, en horizontal y sobre
//                            fondo blanco, los 3 accesos: Audio · Imagen · Cuaderno
//
// NO se duplica la lógica de negocio: reutiliza TAL CUAL el <Notebook>, la
// utilidad paginarParrafos(), READING_FONTS y el theme del Lector de
// escritorio. Solo se replica el wiring de datos Supabase (capítulos,
// párrafos, media, progreso de lectura, subrayados), idéntico a Lector.jsx.
//
// Mismo contrato de props que Lector.jsx (VistaLectura):
//   { book, onGoBack, onGoCartelera, onGoForo, startWithNotebook, onNotebookStarted }
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import useLocalStorage from '../../hooks/useLocalStorage.js'
import { useLectorData } from '../../hooks/useLectorData.js'
import { useXrayItems } from '../../hooks/useXrayItems.js'
import { paginarParrafos } from '../../utils/lectorPagination.js'
import { READING_FONTS } from '../lector/readerConstants.js'
import { Notebook } from '../lector/Notebook.jsx'          // ← cuaderno REUTILIZADO (igual al de PC)
import { INK, ACCENT } from '../lector/clay.jsx'
import { getTourPhase, setTourPhase } from '../guidedTour.js'
import { runGuidedLector1Mobile, runGuidedLector2Mobile } from '../tutorial.mobile.js'
import '../../styles/lector.mobile.css'

const READING_FONT_DEFAULT = "'Crimson Text', Georgia, serif"

// Divide texto en frases conservando la puntuación y espacios intermedios.
function splitSentences(text) {
  const re = /[^.!?…]*[.!?…]+\s*/g
  const parts = []
  let m, last = 0
  while ((m = re.exec(text)) !== null) { parts.push(m[0]); last = m.index + m[0].length }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : [text]
}

function findPrefixAtEnd(text, ref, minLen = 5) {
  const tl = text.toLowerCase(), rl = ref.toLowerCase()
  for (let len = rl.length - 1; len >= minLen; len--)
    if (tl.endsWith(rl.slice(0, len))) return text.length - len
  return -1
}
function findSuffixAtStart(text, ref, minLen = 5) {
  const tl = text.toLowerCase(), rl = ref.toLowerCase()
  for (let offset = 1; offset <= rl.length - minLen; offset++)
    if (tl.startsWith(rl.slice(offset))) return rl.length - offset
  return -1
}

// Factor de ancho medio de carácter por fuente (estima caracteres/línea).
const FONT_WIDTH = {
  "'Crimson Text', Georgia, serif": 0.46,
  "'Lora', Georgia, serif": 0.46,
  "'Merriweather', Georgia, serif": 0.50,
  "'Baloo 2', system-ui, sans-serif": 0.52,
}
const LINE = 1.72  // alto de línea (coincide con .lm-para en el CSS)

// ── Iconos lineales ──────────────────────────────────────────
const Compass = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><path d="M2 12h20"/>
  </svg>
)
const IcClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
)
const IcStar = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.6 5.4L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.4-.6z"/></svg>
)

// Estrellas de rating (mismo comportamiento que el escritorio)
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

// ── Iconos ilustrados clay (con volumen) ─────────────────────
function CassetteIcon() {
  return (
    <span className="lm-illus" style={{ width: 54, height: 44 }}>
      <span style={{ position: 'absolute', left: 2, top: 7, width: 50, height: 34, borderRadius: 8, background: 'linear-gradient(150deg,#e7bd76,#c68f3a)', border: `2px solid ${INK}`, boxShadow: `2px 3px 0 ${INK}33` }}>
        <span style={{ position: 'absolute', left: 5, top: 4, right: 5, height: 8, borderRadius: 3, background: '#fbf3e0', border: `1px solid ${INK}55` }} />
        <span style={{ position: 'absolute', left: 6, bottom: 5, right: 6, height: 15, borderRadius: 3, background: '#3a2a18', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#efe7d4', boxShadow: 'inset 0 0 0 2px #c68f3a' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#efe7d4', boxShadow: 'inset 0 0 0 2px #c68f3a' }} />
        </span>
      </span>
    </span>
  )
}
function PolaroidsIcon() {
  const card = (rot, left, top, z, tape) => (
    <span style={{ position: 'absolute', left, top, width: 30, height: 36, background: '#f7f4ec', border: `2px solid ${INK}`, borderRadius: 3, transform: `rotate(${rot}deg)`, boxShadow: `1.5px 2px 0 ${INK}26`, zIndex: z, padding: '3px 3px 0' }}>
      <span style={{ display: 'block', width: '100%', height: 21, border: `1px solid ${INK}66`, background: 'linear-gradient(135deg,#e7a877,#cf7b4c)' }} />
      {tape && <span style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%) rotate(-4deg)', width: 18, height: 7, background: `${ACCENT}cc`, border: `1px solid ${INK}55` }} />}
    </span>
  )
  return (
    <span className="lm-illus" style={{ width: 54, height: 46 }}>
      {card(-10, 3, 7, 1, false)}
      {card(8, 20, 5, 2, true)}
    </span>
  )
}
function SpiralNotebookIcon() {
  return (
    <span className="lm-illus" style={{ width: 50, height: 46 }}>
      <span style={{ position: 'absolute', left: 6, top: 5, width: 38, height: 38, background: 'linear-gradient(150deg,#b9854f,#9c6a36)', borderRadius: '4px 8px 8px 4px', border: `2px solid ${INK}`, boxShadow: `2px 3px 0 ${INK}33` }}>
        <span style={{ position: 'absolute', top: 3, left: 7, right: 2.5, bottom: 3, background: '#fbf6ea', borderRadius: '2px 4px 4px 2px', border: `1.5px solid ${INK}66`, overflow: 'hidden' }}>
          {[0,1,2,3].map(i => <span key={i} style={{ position: 'absolute', left: 4, right: 4, top: 6 + i*7, height: 1.5, background: 'rgba(74,54,34,0.25)' }} />)}
        </span>
      </span>
      <span style={{ position: 'absolute', top: 1, left: 9, display: 'flex', gap: 3 }}>
        {[0,1,2,3].map(i => <span key={i} style={{ width: 6, height: 11, borderRadius: 5, border: '2px solid #caa24f', borderBottomColor: INK, background: 'transparent' }} />)}
      </span>
    </span>
  )
}

// ── Página del libro (una sola hoja) ─────────────────────────
function BookPage({ chapter, chapterIndex, parrafos, mediaByParrafo, isFirst, pageNum, fontSize, font,
                    atStart, nextIsChapter, onPrev, onNext, onPlaySfx, onSelectText }) {
  const lineH = Math.round(fontSize * LINE)
  const innerRef = useRef(null)

  function handleSel() {
    // Delay de 50ms: deja que el navegador finalice la selección antes de leerla,
    // especialmente necesario en touch donde la selección no está 100% lista al touchend.
    setTimeout(() => {
      if (!onSelectText) return
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return
      if (!innerRef.current?.contains(sel.anchorNode)) return
      const text = sel.toString().trim()
      const anchorEl = sel.anchorNode?.parentElement?.closest('[data-parrafo-id]')
      const parrafoId = anchorEl?.dataset?.parrafoId || null
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      onSelectText({ text, parrafoId, rect })
    }, 50)
  }

  return (
    <div className="lm-page" data-screen-label={`Lector cap ${chapter?.numero ?? chapterIndex + 1}`}>
      <div className="lm-page-lines" style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent ${lineH-1}px, rgba(150,110,60,0.05) ${lineH-1}px, rgba(150,110,60,0.05) ${lineH}px)` }} />
      <div className="lm-page-inner" data-lm-pagebox ref={innerRef} translate="no" style={{ fontSize, lineHeight: LINE }} onMouseUp={handleSel} onTouchEnd={handleSel} onContextMenu={(e) => e.preventDefault()}>
        {isFirst && (
          <div className="lm-chap-head">
            <div className="lm-chap-kicker" style={{ fontSize: fontSize*0.6 }}>Capítulo {chapter?.numero ?? chapterIndex + 1}</div>
            <div className="lm-chap-title" style={{ fontSize: fontSize*1.55 }}>{chapter?.titulo}</div>
            <div className="lm-chap-rule" />
          </div>
        )}
        {parrafos.length === 0 && <div className="lm-page-msg">— fin del capítulo —</div>}
        {parrafos.map((p, i) => {
          if (p.tipo === 'separador') return <div key={p.id ?? `s${i}`} className="lm-sep">❧</div>
          const sfx = (mediaByParrafo[p.id] || []).filter(m => m.origen === 'explicito' && m.tipo === 'audio')
          const text = p.contenido || ''
          const textLower = text.toLowerCase()
          const anchors = []
          const sfxUnanchored = []
          for (const s of sfx) {
            const ref = s.metadata?.texto_ref
            if (ref) {
              const pos = textLower.indexOf(ref.toLowerCase())
              if (pos !== -1) {
                anchors.push({ start: pos, end: pos + ref.length, s })
              } else {
                const partialStart = findPrefixAtEnd(text, ref)
                if (partialStart !== -1) {
                  anchors.push({ start: partialStart, end: text.length, s })
                } else {
                  const partialEnd = findSuffixAtStart(text, ref)
                  if (partialEnd !== -1) anchors.push({ start: 0, end: partialEnd, s })
                }
              }
            } else {
              sfxUnanchored.push(s)
            }
          }
          anchors.sort((a, b) => a.start - b.start)
          let sfxContent = null
          if (anchors.length > 0) {
            sfxContent = []
            let last = 0
            for (const { start, end, s } of anchors) {
              if (last < start) sfxContent.push(<span key={`t${last}`}>{text.slice(last, start)}</span>)
              sfxContent.push(<span key={`s${start}`} className="sfx-glow" onClick={(e) => { e.stopPropagation(); onPlaySfx(s) }}>{text.slice(start, end)}</span>)
              last = end
            }
            if (last < text.length) sfxContent.push(<span key={`t${last}`}>{text.slice(last)}</span>)
          }
          const paraGlow = sfxUnanchored.length > 0 && anchors.length === 0
          const handleParaClick = paraGlow ? (e) => { e.stopPropagation(); onPlaySfx(sfxUnanchored[0]) } : undefined
          return (
            <p key={p.id ?? `p${i}`} data-parrafo-id={p.id}
              onClick={paraGlow ? handleParaClick : undefined}
              className={'lm-para' + (p.tipo==='dialogo'?' dlg':'') + (paraGlow ? ' sfx-glow' : '')}
              style={{ fontFamily: font }}>
              {sfxContent ?? p.contenido}
            </p>
          )
        })}
      </div>
      <div className="lm-pagenum">{pageNum}</div>
      <div className={'lm-turn left' + (atStart?' disabled':'')} onClick={atStart?undefined:onPrev}>
        <span>‹</span><div className="corner" />
      </div>
      <div className={'lm-turn right' + (onNext?'':' disabled') + (nextIsChapter?' next-chapter':'')} onClick={onNext || undefined}>
        <span>{nextIsChapter ? '✦' : '›'}</span><div className="corner" />
      </div>
    </div>
  )
}

// ── Sheet: selector de capítulo ──────────────────────────────
function XraySheet({ items, chapterNum, onClose, onItemClick }) {
  const ini = s => (s || '').replace(/^(El|La|Los|Las)\s+/i, '').charAt(0).toUpperCase()
  return (
    <div className="lm-backdrop" onClick={onClose}>
      <div className="lm-sheet" onClick={e => e.stopPropagation()}>
        <div className="lm-grip" />
        <div className="lm-sheet-head">
          <span className="lm-sheet-title">X-ray · hasta cap. {chapterNum}</span>
          <button className="lm-close" onClick={onClose}><IcClose /></button>
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 18px 28px' }}>
          {items.length === 0
            ? <p style={{ fontSize: 14, color: 'rgba(74,54,34,0.5)', fontStyle: 'italic', marginTop: 12 }}>Sin personajes hasta este capítulo.</p>
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

function ChapterSheet({ chapters, current, onPick, onClose }) {
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

// ── Sheet: tipografía ────────────────────────────────────────
function TypoSheet({ fontSize, onFontSize, readingFont, onReadingFont, readingTheme = 'light', onReadingTheme, onClose }) {
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

// ── Sheet: audio (ambiente del capítulo) ─────────────────────
function AudioSheet({ ambient, playing, volume, onToggle, onVolume, onClose }) {
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

// ── Sheet: navegación (Explorar) ─────────────────────────────
function NavSheet({ onGoForo, onGoCartelera, onGoBiblioteca, onClose }) {
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

// ── Overlay: imagen(es) del capítulo ─────────────────────────
function ImageOverlay({ images, chapter, chapterIndex, onClose, autoImages, onToggleAutoImages }) {
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

// ── Sheet: reseña (aparece al terminar el libro) ─────────────
function ResenaSheet({ form, setForm, enviando, miResena, onSubmit, onClose }) {
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

// ═══════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function LectorMobile({ book, onGoBack, onGoCartelera, onGoForo, startWithNotebook, onNotebookStarted }) {
  // ── Estado de navegación de lectura (UI) ──
  const [chapterIndex, setChapterIndex] = useState(0)
  const [pageIndex,    setPageIndex]    = useState(0)
  const [sheet,        setSheetRaw]     = useState(null)   // 'chapters' | 'typo' | 'audio' | 'nav'
  const [imageOpen,    setImageOpen]    = useState(false)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [catOpen,      setCatOpen]      = useState(false)
  const [pendingChapter, setPendingChapter] = useState(null)

  // Lógica de datos compartida con el Lector de escritorio (ver src/hooks/useLectorData.js)
  const {
    userId, capitulos, chapterCache, loading, loadingCap, error,
    isLeido, setIsLeido,
    pendingRestore, setPendingRestore, restoredRef,
    setLoadingCap, setError,
    fetchChapter, playSfx, persistChapterAdvance, subrayar,
    miResena, resenaForm, setResenaForm, resenaEnviando, submitResena,
  } = useLectorData(book, setChapterIndex, setPageIndex)

  // ── Reseña (UI) ──
  const [resenaOpen, setResenaOpen] = useState(false)

  // Preferencias de lectura (compartidas con el escritorio vía localStorage)
  const [fontSize,    setFontSize]    = useLocalStorage('inm_lector_fontSize', 19)
  const [readingFont, setReadingFont] = useLocalStorage('inm_lector_font', READING_FONT_DEFAULT)
  const [readingTheme, setReadingTheme] = useLocalStorage('inm_lector_theme', 'light')
  const [autoImages,  setAutoImages]  = useLocalStorage('inm_auto_img', true)

  // ── Estado de UI no compartido ──
  const [pendingSelection, setPendingSelection] = useState(null)  // { text, parrafoId, rect }
  const screenRef = useRef(null)
  const pageAnchorRef = useRef(null)

  // ── Audio de ambiente (real, solo mobile) ──
  const audioRef = useRef(null)
  const [ambientPlaying, setAmbientPlaying] = useState(false)
  const [ambientVol, setAmbientVol] = useState(0.5)

  const setSheet   = (v) => { setSheetRaw(v); setCatOpen(false) }
  const openImage  = () => { setImageOpen(true); setCatOpen(false) }
  const openNotebook = () => { setNotebookOpen(true); setCatOpen(false) }

  // arranque directo en cuaderno (desde Biblioteca → "abrir cuaderno")
  useEffect(() => {
    if (startWithNotebook) { setNotebookOpen(true); onNotebookStarted?.() }
  }, [startWithNotebook])

  // Tutorial mobile — al cargar el libro, si venimos de la fase wait_lector
  useEffect(() => {
    if (loading || !book?.libro_id) return
    if (getTourPhase() === 'wait_lector') {
      const t = setTimeout(() => runGuidedLector1Mobile(), 900)
      return () => clearTimeout(t)
    }
  }, [loading, book?.libro_id])

  // cargar capítulo actual cuando cambia
  useEffect(() => {
    const cap = capitulos[chapterIndex]; if (!cap) return
    let cancelled = false
    ;(async () => {
      setError(null)
      try {
        let entry = chapterCache[cap.id]
        if (!entry) { setLoadingCap(true); entry = await fetchChapter(cap) }
        if (cancelled || !entry) return
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoadingCap(false)
      }
    })()
    return () => { cancelled = true }
  }, [chapterIndex, capitulos])

  const currentChapter  = capitulos[chapterIndex] || null
  const xrayItems = useXrayItems(sheet === 'xray', book?.libro_id, currentChapter?.numero ?? chapterIndex + 1)
  const currentChapData = currentChapter ? chapterCache[currentChapter.id] : null
  const currentMedia    = currentChapData?.mediaByParrafo || {}
  const currentAmbient  = currentChapData?.ambient || null

  // ── Geometría de página (medida del DOM) ──
  const [geom, setGeom] = useState({ charsPerLine: 38, lineHeight: Math.round(19*LINE), maxH: 480, titleH: 90 })
  const measureGeom = useCallback(() => {
    const box = screenRef.current?.querySelector('[data-lm-pagebox]')
    if (!box) return
    const cs = getComputedStyle(box)
    const padX    = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    const padBottom = parseFloat(cs.paddingBottom)
    const padY    = parseFloat(cs.paddingTop) + padBottom
    const contentW = Math.max(120, box.clientWidth - padX)
    let   contentH = box.clientHeight - padY

    // El botón del gato flota sobre la página (z-index alto, position:absolute
    // en lm-book-area) y tapa visualmente la parte inferior del contenido.
    // Medimos el solapamiento real y lo descontamos de contentH para que el
    // paginador no coloque texto en esa zona oculta.
    const catBtn = screenRef.current?.querySelector('.lm-cat-btn')
    if (catBtn) {
      const contentBottom = box.getBoundingClientRect().bottom - padBottom
      const catTop        = catBtn.getBoundingClientRect().top
      contentH -= Math.max(0, contentBottom - catTop)
    }

    contentH = Math.max(160, contentH)
    const wf = FONT_WIDTH[readingFont] || 0.46
    const charsPerLine = Math.max(20, Math.floor(contentW / (fontSize * wf)))
    const lineHeight = Math.round(fontSize * LINE)
    const titleH = Math.round(fontSize * 0.6) + Math.round(fontSize * 1.55 * 1.25) + 38
    setGeom(g => {
      if (g.charsPerLine === charsPerLine && g.lineHeight === lineHeight && Math.abs(g.maxH - contentH) < 2 && g.titleH === titleH) return g
      return { charsPerLine, lineHeight, maxH: contentH, titleH }
    })
  }, [fontSize, readingFont])

  // Medir solo cuando puede cambiar la geometría (fuente/viewport vía measureGeom,
  // fin de carga, cambio de capítulo) en vez de en CADA render. measureGeom ya
  // hace no-op si los valores no cambian, así que esto solo recorta reflows.
  useLayoutEffect(() => { measureGeom() }, [measureGeom, loading, currentChapData])
  useEffect(() => {
    let timer = null
    let lastW = screenRef.current?.querySelector('[data-lm-pagebox]')?.clientWidth ?? window.innerWidth
    const on = () => {
      const box = screenRef.current?.querySelector('[data-lm-pagebox]')
      const w = box ? box.clientWidth : window.innerWidth
      if (w === lastW) return  // solo cambió el alto (URL bar móvil) → no repaginar
      lastW = w
      clearTimeout(timer); timer = setTimeout(measureGeom, 350)
    }
    window.addEventListener('resize', on)
    return () => { clearTimeout(timer); window.removeEventListener('resize', on) }
  }, [measureGeom])

  // ── Paginación (una sola página) ──
  const paginas = useMemo(() => {
    if (!currentChapData?.parrafos) return [[]]
    const GAP = Math.round(fontSize * 0.7)
    const maxH = Math.min(geom.maxH, 17 * geom.lineHeight)
    const firstPageMaxH = Math.max(geom.lineHeight * 3, maxH - geom.titleH)
    return paginarParrafos(currentChapData.parrafos, false, {
      charsPerLine: geom.charsPerLine,
      lineHeight: geom.lineHeight,
      maxH,
      firstPageMaxH,
      paragraphGap: GAP,
    })
  }, [currentChapData?.parrafos, fontSize, geom])

  // restaurar página exacta al volver
  useEffect(() => {
    if (!pendingRestore || !currentChapData) return
    const idx = paginas.findIndex(pg => pg.some(p => p.id === pendingRestore))
    if (idx >= 0) setPageIndex(idx)
    setPendingRestore(null); restoredRef.current = true
  }, [pendingRestore, currentChapData, paginas])

  // preservar párrafo visible cuando la geometría cambia (e.g. URL bar móvil)
  useEffect(() => {
    if (pendingRestore) return
    if (pageAnchorRef.current) {
      const newIdx = paginas.findIndex(pg => pg.some(p => p.id === pageAnchorRef.current))
      if (newIdx >= 0) { if (newIdx !== pageIndex) setPageIndex(newIdx); return }
    }
    if (pageIndex >= paginas.length) setPageIndex(Math.max(0, paginas.length - 1))
  }, [paginas]) // eslint-disable-line react-hooks/exhaustive-deps

  // mantener ancla actualizada tras cada navegación del usuario
  useEffect(() => {
    const p = paginas[pageIndex]?.[0]
    if (p) pageAnchorRef.current = p.id
  }, [pageIndex, paginas])

  // ── Guardar progreso (debounce) ──
  useEffect(() => {
    if (!restoredRef.current || !userId || !book?.libro_id || !currentChapData) return
    const firstParr = paginas[pageIndex]?.[0]; if (!firstParr) return
    const t = setTimeout(() => {
      supabase.from('progreso_lectura').upsert({
        user_id: userId, libro_id: book.libro_id,
        ultimo_parrafo_id: firstParr.id, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,libro_id' }).then(() => {})
    }, 600)
    return () => clearTimeout(t)
  }, [chapterIndex, pageIndex, paginas, userId, book?.libro_id, currentChapData])

  // 100% al llegar al final del último capítulo
  useEffect(() => {
    if (!restoredRef.current || !userId || !book?.libro_id) return
    if (!capitulos.length || chapterIndex !== capitulos.length - 1) return
    if (!paginas.length || pageIndex < paginas.length - 1) return
    const t = setTimeout(async () => {
      await supabase.from('progreso_lectura').update({ porcentaje: 100, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('libro_id', book.libro_id)
      await supabase.from('bibliotecas_usuarios').update({ leido: true })
        .eq('user_id', userId).eq('libro_id', book.libro_id)
      setIsLeido(true)
    }, 600)
    return () => clearTimeout(t)
  }, [chapterIndex, pageIndex, paginas.length, capitulos.length, userId, book?.libro_id])

  // ── Audio ambiente: vincular al url del capítulo ──
  useEffect(() => {
    const a = new Audio(); a.loop = true; a.volume = ambientVol; audioRef.current = a
    return () => { a.pause(); a.src = '' }
  }, [])
  useEffect(() => {
    const a = audioRef.current; if (!a) return
    const wasPlaying = ambientPlaying
    a.pause()
    if (currentAmbient?.url) {
      a.src = currentAmbient.url; a.load()
      if (wasPlaying) a.play().catch(() => setAmbientPlaying(false))
    } else { a.src = ''; setAmbientPlaying(false) }
  }, [currentAmbient?.url])
  function toggleAmbient() {
    const a = audioRef.current; if (!a || !currentAmbient?.url) return
    if (ambientPlaying) { a.pause(); setAmbientPlaying(false) }
    else a.play().then(() => setAmbientPlaying(true)).catch(() => {})
  }
  function setVol(v) { setAmbientVol(v); if (audioRef.current) audioRef.current.volume = v }


  // ── Imágenes visibles en la página actual (y anteriores del capítulo) ──
  const visibleImages = useMemo(() => {
    if (!currentChapData) return []
    const parrToPage = {}
    paginas.forEach((page, idx) => page.forEach(p => { parrToPage[p.id] = idx }))
    const seen = new Set(); const imgs = []
    for (const p of currentChapData.parrafos) {
      const pg = parrToPage[p.id]
      if (pg === undefined || pg > pageIndex) continue
      for (const m of (currentChapData.mediaByParrafo[p.id] || [])) {
        if (m.tipo === 'imagen' && m.origen === 'explicito' && !seen.has(m.media_id)) { seen.add(m.media_id); imgs.push(m) }
      }
    }
    return imgs
  }, [currentChapData, paginas, pageIndex])

  // ── Imágenes de la página exacta actual (para auto-mostrar) ──
  const currentPageNewImages = useMemo(() => {
    if (!currentChapData) return []
    const parrToPage = {}
    paginas.forEach((page, idx) => page.forEach(p => { parrToPage[p.id] = idx }))
    const seen = new Set(); const imgs = []
    for (const p of currentChapData.parrafos) {
      if (parrToPage[p.id] !== pageIndex) continue
      for (const m of (currentChapData.mediaByParrafo[p.id] || [])) {
        if (m.tipo === 'imagen' && m.origen === 'explicito' && !seen.has(m.media_id)) { seen.add(m.media_id); imgs.push(m) }
      }
    }
    return imgs
  }, [currentChapData, paginas, pageIndex])

  // Auto-abrir imagen invasiva al llegar a una página con imagen
  useEffect(() => {
    if (autoImages && currentPageNewImages.length > 0) setImageOpen(true)
  }, [pageIndex, chapterIndex, autoImages])

  // ── Navegación de páginas ──
  const total = paginas.length
  const atStart = chapterIndex === 0 && pageIndex === 0
  const atEndOfBook = chapterIndex === capitulos.length - 1 && pageIndex >= total - 1
  const atChapterEnd = pageIndex >= total - 1

  function handlePrev() {
    setPendingSelection(null); setCatOpen(false)
    if (pageIndex > 0) { setPageIndex(p => p - 1); return }
    if (chapterIndex > 0) {
      const prevCap = capitulos[chapterIndex - 1]
      const prevEntry = chapterCache[prevCap.id]
      setChapterIndex(chapterIndex - 1)
      if (prevEntry) {
        const prevPages = paginarParrafos(prevEntry.parrafos, false, { charsPerLine: geom.charsPerLine, lineHeight: geom.lineHeight, maxH: geom.maxH, firstPageMaxH: Math.max(geom.lineHeight*3, geom.maxH - geom.titleH), paragraphGap: Math.round(fontSize*0.7) })
        setPageIndex(Math.max(0, prevPages.length - 1))
      } else setPageIndex(0)
    }
  }
  function handleNext() {
    setPendingSelection(null); setCatOpen(false)
    if (pageIndex < total - 1) { setPageIndex(p => p + 1); return }
    // fin del capítulo → abrir cuaderno antes de avanzar (igual que el escritorio)
    if (chapterIndex < capitulos.length - 1) {
      if (getTourPhase() === 'wait_chapter') setTourPhase('notebook_1')
      setPendingChapter(chapterIndex + 1); setNotebookOpen(true)
    }
  }
  function pickChapter(i) { setChapterIndex(i); setPageIndex(0); setSheet(null); setPendingSelection(null) }

  // ── Cuaderno: al cerrar, persistir avance de capítulo si venía de "fin de capítulo" ──
  async function handleSubmitResena() {
    if (await submitResena()) setResenaOpen(false)
  }

  async function handleCloseNotebook() {
    setNotebookOpen(false)
    if (getTourPhase() === 'lector_2') {
      setTimeout(() => runGuidedLector2Mobile(), 500)
    }
    if (pendingChapter !== null) {
      await persistChapterAdvance(pendingChapter)
      setChapterIndex(pendingChapter); setPageIndex(0); setPendingChapter(null)
    }
  }

  // ── Subrayado desde la selección de texto ──
  function handleSelectText(info) {
    if (!info) { setPendingSelection(null); return }
    setPendingSelection(info)
  }
  async function confirmSubrayar() {
    if (!pendingSelection || !userId || !book?.libro_id) { setPendingSelection(null); return }
    await subrayar(pendingSelection.text, pendingSelection.parrafoId, chapterIndex)
    setPendingSelection(null)
    window.getSelection()?.removeAllRanges()
  }
  // posición del popup de subrayado, relativa al viewport
  const selPos = useMemo(() => {
    if (!pendingSelection?.rect) return null
    const r = pendingSelection.rect
    return { left: Math.max(80, Math.min(r.left + r.width / 2, window.innerWidth - 80)), top: r.bottom + 8 }
  }, [pendingSelection])

  const CAT_ITEMS = [
    { key: 'audio',    label: 'Audio',    icon: <CassetteIcon />,       act: () => setSheet('audio') },
    { key: 'imagen',   label: 'Imagen',   icon: <PolaroidsIcon />,      act: openImage },
    { key: 'cuaderno', label: 'Cuaderno', icon: <SpiralNotebookIcon />, act: openNotebook },
  ]

  const page = paginas[pageIndex] || []

  return (
    <div className={'lm-screen' + (readingTheme === 'dark' ? ' night' : '')} ref={screenRef}>
      {/* Header */}
      <header className="lm-header">
        <div className="lm-title">
          <h1>{book?.title || 'Libro'}</h1>
          <p>{book?.author || ''}</p>
        </div>
        <button id="tutorial-m-explorar" className="lm-explore" onClick={() => setSheet('nav')} title="Explorar"><Compass /></button>
        {isLeido && book?.libro_id && (
          <button className="lm-explore lm-resena-btn" onClick={() => { setSheetRaw(null); setCatOpen(false); setResenaOpen(true) }} title="Escribir reseña" aria-label="Escribir reseña"><IcStar /></button>
        )}
      </header>

      {/* Controles */}
      <div className="lm-controls">
        <button id="tutorial-m-cap" className="lm-ctrl cap" onClick={() => setSheet('chapters')}>
          <span className="lm-ctrl-label">Cap. {currentChapter?.numero ?? chapterIndex + 1}{currentChapter?.titulo ? ` · ${currentChapter.titulo}` : ''}</span>
          <span className="chev">▼</span>
        </button>
        <button className="lm-ctrl xray" onClick={() => setSheet('xray')} title="X-ray">X-ray</button>
        <button id="tutorial-m-typo" className="lm-ctrl typo" onClick={() => setSheet('typo')} title="Texto">
          <span className="a-sm">A</span><span className="a-lg">A</span>
        </button>
      </div>

      {/* Libro */}
      <div className="lm-book-area">
        {loading && <div className="lm-page"><div className="lm-page-inner" data-lm-pagebox><div className="lm-page-msg">Cargando libro…</div></div></div>}
        {!loading && !book?.libro_id && <div className="lm-page"><div className="lm-page-inner" data-lm-pagebox><div className="lm-page-msg">Este libro todavía no está disponible para lectura inmersiva.</div></div></div>}
        {!loading && error && <div className="lm-page"><div className="lm-page-inner" data-lm-pagebox><div className="lm-page-msg">⚠ {error}</div></div></div>}
        {!loading && !error && book?.libro_id && currentChapter && (
          loadingCap && !currentChapData
            ? <div className="lm-page"><div className="lm-page-inner" data-lm-pagebox><div className="lm-page-msg">Cargando capítulo…</div></div></div>
            : <BookPage
                chapter={currentChapter} chapterIndex={chapterIndex}
                parrafos={page} mediaByParrafo={currentMedia}
                isFirst={pageIndex===0} pageNum={pageIndex+1}
                fontSize={fontSize} font={readingFont}
                atStart={atStart} nextIsChapter={atChapterEnd && !atEndOfBook}
                onPrev={handlePrev}
                onNext={atEndOfBook ? undefined : handleNext}
                onPlaySfx={playSfx} onSelectText={handleSelectText}
              />
        )}

        {/* Mascota (gato) + bandeja horizontal de herramientas */}
        {!loading && !error && book?.libro_id && (
          <div className="lm-cat-dock">
            <button id="tutorial-m-dock" className="lm-cat-btn" onClick={() => setCatOpen(o => !o)} title="Herramientas" aria-label="Herramientas">
              {/* La mascota negra de Inmersia. Ruta servida desde /public. */}
              <img className="lm-cat-img" src="/assets/lector/cat-mascot.png" alt="Mascota de Inmersia" />
            </button>
            {catOpen && (
              <div className="lm-cat-tray">
                {CAT_ITEMS.map(it => (
                  <button key={it.key} className="lm-cat-tool" onClick={() => { it.act(); setCatOpen(false) }}>
                    <span className="tile">{it.icon}</span>
                    <span className="lbl">{it.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Popup de subrayado */}
      {pendingSelection && selPos && (
        <div className="lm-sel-pop" style={{ left: selPos.left, top: selPos.top }}>
          <span className="q">“{pendingSelection.text.length > 28 ? pendingSelection.text.slice(0,28)+'…' : pendingSelection.text}”</span>
          <button onClick={confirmSubrayar}>Subrayar</button>
        </div>
      )}

      {/* Sheets */}
      {sheet==='xray'     && <XraySheet items={xrayItems} chapterNum={currentChapter?.numero ?? chapterIndex + 1} onClose={() => setSheet(null)} onItemClick={(itemId) => { setSheet(null); onGoCartelera(itemId) }} />}
      {sheet==='chapters' && <ChapterSheet chapters={capitulos} current={chapterIndex} onPick={pickChapter} onClose={()=>setSheet(null)} />}
      {sheet==='typo' && <TypoSheet fontSize={fontSize} onFontSize={setFontSize} readingFont={readingFont} onReadingFont={setReadingFont} readingTheme={readingTheme} onReadingTheme={setReadingTheme} onClose={()=>setSheet(null)} />}
      {sheet==='audio' && <AudioSheet ambient={currentAmbient} playing={ambientPlaying} volume={ambientVol} onToggle={toggleAmbient} onVolume={setVol} onClose={()=>setSheet(null)} />}
      {sheet==='nav' && <NavSheet onGoForo={onGoForo} onGoCartelera={() => { if (getTourPhase() === 'wait_cartelera') setTourPhase('cart_portada_1'); onGoCartelera() }} onGoBiblioteca={onGoBack} onClose={()=>setSheet(null)} />}

      {/* Overlay imagen */}
      {imageOpen && <ImageOverlay images={visibleImages} chapter={currentChapter} chapterIndex={chapterIndex} onClose={()=>setImageOpen(false)} autoImages={autoImages} onToggleAutoImages={() => setAutoImages(v => !v)} />}

      {/* Reseña (aparece al terminar el libro) */}
      {resenaOpen && <ResenaSheet form={resenaForm} setForm={setResenaForm} enviando={resenaEnviando} miResena={miResena} onSubmit={handleSubmitResena} onClose={()=>setResenaOpen(false)} />}

      {/* Cuaderno — REUTILIZA el componente de escritorio (tipos arriba, solapas a la derecha) */}
      <Notebook
        isOpen={notebookOpen}
        onClose={handleCloseNotebook}
        userId={userId}
        libroId={book?.libro_id}
        capituloNum={capitulos[chapterIndex]?.numero ?? chapterIndex + 1}
        capitulos={capitulos}
      />
    </div>
  )
}
