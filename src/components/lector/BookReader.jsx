// Plain JavaScript (.jsx)
import { useState, useEffect, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { theme, tint, getReaderPalette } from './clay.jsx'
import { READING_FONTS } from './readerConstants.js'
import '../../styles/lector.css'

// Divide texto en frases conservando la puntuación y espacios intermedios.
function splitSentences(text) {
  const re = /[^.!?…]*[.!?…]+\s*/g
  const parts = []
  let m, last = 0
  while ((m = re.exec(text)) !== null) { parts.push(m[0]); last = m.index + m[0].length }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : [text]
}

// ── Contenido de una página (datos reales) ──────────────────
const PageContent = memo(function PageContent({ parrafos, mediaByParrafo, onPlaySfx, onTextSelect, fontSize, readingFont, isFirst, chapterTitle, chapterNum, pal = getReaderPalette('light') }) {
  function handleMouseUp() {
    if (!onTextSelect) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return
    const text = sel.toString().trim()
    const anchorEl = sel.anchorNode?.parentElement?.closest('[data-parrafo-id]')
    const parrafoId = anchorEl?.dataset?.parrafoId || null
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    onTextSelect({ text, parrafoId, rect })
  }

  return (
    <div onMouseUp={handleMouseUp} onContextMenu={(e) => e.preventDefault()} translate="no" style={{ fontFamily: readingFont || "'Crimson Text', Georgia, serif", fontSize, lineHeight: 1.85, color: pal.pageInk }}>
      {isFirst && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: fontSize * 0.6, letterSpacing: '0.18em', textTransform: 'uppercase', color: pal.pageMeta }}>Capítulo {chapterNum}</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: fontSize * 1.7, fontWeight: 700, lineHeight: 1.1, color: pal.pageInk, marginTop: 6 }}>{chapterTitle}</div>
          <div style={{ width: 60, height: 3, borderRadius: 2, background: theme.accent, marginTop: 14 }} />
        </div>
      )}
      {parrafos.map((p, pIdx) => {
        const sfx = (mediaByParrafo[p.id] || []).filter(m => m.origen === 'explicito' && m.tipo === 'audio')
        if (p.tipo === 'separador')
          return <div key={p.id ?? `sep-${pIdx}`} style={{ textAlign: 'center', color: pal.pageMeta, margin: '20px 0', letterSpacing: '0.4em' }}>❧</div>
        const isDlg = p.tipo === 'dialogo'
        const sfxTextoRef = sfx.length ? (sfx.find(s => s.metadata?.texto_ref)?.metadata?.texto_ref ?? null) : null
        let sentences = null, sfxSentenceIdx = -1
        if (sfxTextoRef) {
          sentences = splitSentences(p.contenido)
          sfxSentenceIdx = sentences.findIndex(s => s.toLowerCase().includes(sfxTextoRef.toLowerCase()))
        }
        const paraGlow = sfx.length > 0 && sfxSentenceIdx === -1
        const handleSfxClick = sfx.length ? (e) => { e.stopPropagation(); onPlaySfx(sfx) } : undefined
        return (
          <p key={p.id ?? `p-${pIdx}`} data-parrafo-id={p.id}
            onClick={paraGlow ? handleSfxClick : undefined}
            className={paraGlow ? 'sfx-glow' : undefined}
            style={{ whiteSpace: 'pre-line', margin: '0 0 0.7em', textAlign: 'justify', hyphens: 'auto', textIndent: isDlg ? 0 : '1.2em', fontStyle: isDlg ? 'italic' : 'normal', color: pal.pageInk }}>
            {sfx.length > 0 && sfxSentenceIdx !== -1
              ? sentences.map((s, si) =>
                  si === sfxSentenceIdx
                    ? <span key={si} className="sfx-glow" onClick={handleSfxClick}>{s}</span>
                    : <span key={si}>{s}</span>
                )
              : p.contenido
            }
          </p>
        )
      })}
    </div>
  )
})

// ── Selector de capítulo (slim) ─────────────────────────────
function ChapterSelect({ chapters, chapterIndex, onChapterSelect }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const current = chapters[chapterIndex]

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      const inBtn = btnRef.current && btnRef.current.contains(e.target)
      const inMenu = menuRef.current && menuRef.current.contains(e.target)
      if (!inBtn && !inMenu) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function handleClick() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
    }
    setOpen(o => !o)
  }

  const label = current ? `Cap. ${current.numero ?? chapterIndex + 1}${current.titulo ? ` · ${current.titulo}` : ''}` : 'Capítulo'

  return (
    <>
      <button id="tutorial-chapter-btn" ref={btnRef} type="button" onClick={handleClick}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: 320, fontFamily: "'Baloo 2', sans-serif", fontWeight: 600, fontSize: 12, cursor: 'pointer', border: `1.5px solid ${theme.ink}`, borderRadius: 999, padding: '4px 12px', background: theme.navBg, color: theme.navText, boxShadow: `1px 1.5px 0 ${theme.ink}26` }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 8, opacity: 0.6, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000, minWidth: 250, background: theme.navBg, border: `2px solid ${theme.ink}`, borderRadius: 14, boxShadow: `2px 4px 0 ${theme.ink}26, 0 12px 28px rgba(0,0,0,0.28)`, overflow: 'auto', maxHeight: 320, padding: 5 }}>
          {chapters.map((c, i) => (
            <button key={c.id} type="button" onClick={() => { onChapterSelect(i); setOpen(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: "'Baloo 2', sans-serif", fontWeight: i === chapterIndex ? 800 : 600, fontSize: 12.5, background: i === chapterIndex ? theme.accent : 'transparent', color: i === chapterIndex ? '#fff' : theme.navText, marginBottom: 2 }}>
              Cap. {c.numero ?? i + 1}{c.titulo ? ` · ${c.titulo}` : ''}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

// ── Control de tipografía (tamaño + fuente) ─────────────────
function TypographyControl({ fontSize, onFontSize, readingFont, onReadingFont, readingTheme = 'light', onReadingTheme }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const MIN = 16, MAX = 24

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      const inBtn = btnRef.current && btnRef.current.contains(e.target)
      const inMenu = menuRef.current && menuRef.current.contains(e.target)
      if (!inBtn && !inMenu) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function handleClick() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
    }
    setOpen(o => !o)
  }

  const stepBtn = {
    width: 30, height: 30, borderRadius: 9, border: `1.5px solid ${theme.ink}`, background: theme.navBg,
    color: theme.navText, cursor: 'pointer', fontFamily: "'Crimson Text', serif", fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, lineHeight: 1,
  }

  return (
    <>
      <button id="tutorial-typography-btn" ref={btnRef} type="button" onClick={handleClick} title="Tamaño y fuente del texto"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Crimson Text', Georgia, serif", fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${theme.ink}`, borderRadius: 999, padding: '4px 12px', background: open ? theme.accent : theme.navBg, color: open ? '#fff' : theme.navText, boxShadow: `1px 1.5px 0 ${theme.ink}26` }}>
        <span style={{ fontSize: 12, lineHeight: 1 }}>A</span>
        <span style={{ fontSize: 17, lineHeight: 1 }}>A</span>
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000, width: 232, background: theme.navBg, border: `2px solid ${theme.ink}`, borderRadius: 16, boxShadow: `2px 4px 0 ${theme.ink}26, 0 12px 28px rgba(0,0,0,0.28)`, padding: 14 }}>
          {/* Tamaño */}
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.pageMeta, marginBottom: 9 }}>Tamaño</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
            <button type="button" onClick={() => onFontSize(Math.max(MIN, fontSize - 1))} disabled={fontSize <= MIN} style={{ ...stepBtn, opacity: fontSize <= MIN ? 0.4 : 1, fontSize: 14 }}>A</button>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(120,90,50,0.18)', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${((fontSize - MIN) / (MAX - MIN)) * 100}%`, background: theme.accent, borderRadius: 3 }} />
            </div>
            <button type="button" onClick={() => onFontSize(Math.min(MAX, fontSize + 1))} disabled={fontSize >= MAX} style={{ ...stepBtn, opacity: fontSize >= MAX ? 0.4 : 1, fontSize: 20 }}>A</button>
          </div>
          {/* Fuente */}
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.pageMeta, marginBottom: 9 }}>Fuente</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {READING_FONTS.map(f => {
              const active = f.css === readingFont
              return (
                <button key={f.label} type="button" onClick={() => onReadingFont(f.css)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '8px 10px', cursor: 'pointer', border: `1.5px solid ${active ? theme.accent : theme.ink}`, borderRadius: 11, background: active ? 'rgba(207,123,76,0.12)' : 'transparent', textAlign: 'left' }}>
                  <span style={{ fontFamily: f.css, fontSize: 21, lineHeight: 1, color: theme.navText }}>Ag</span>
                  <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: active ? theme.accent : theme.pageMeta }}>{f.label}</span>
                </button>
              )
            })}
          </div>
          {/* Tema de lectura */}
          {onReadingTheme && (
            <>
              <div style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.pageMeta, margin: '16px 0 9px' }}>Tema</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {[{ id: 'light', label: 'Claro', bg: '#f7efde', fg: '#3a2a18' }, { id: 'dark', label: 'Noche', bg: '#1d1813', fg: '#e9ddc7' }].map(t => {
                  const active = readingTheme === t.id
                  return (
                    <button key={t.id} type="button" onClick={() => onReadingTheme(t.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', border: `1.5px solid ${active ? theme.accent : theme.ink}`, borderRadius: 11, background: active ? 'rgba(207,123,76,0.12)' : 'transparent' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: t.bg, border: `1.5px solid ${theme.ink}`, color: t.fg, fontFamily: "'Crimson Text', serif", fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>A</span>
                      <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 12, color: active ? theme.accent : theme.navText }}>{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

// ── Lateral clicable (pasa página) + esquina que se dobla ───
function SideTurn({ side, onClick, kind, pal = getReaderPalette('light') }) {
  const [hov, setHov] = useState(false)
  const outer = side === 'left' ? 'left' : 'right'
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      title={kind === 'next-chapter' ? 'Siguiente capítulo →' : (side === 'left' ? '← Página anterior' : 'Página siguiente →')}
      style={{ position: 'absolute', top: 0, bottom: 0, [outer]: 0, width: 56, cursor: 'pointer', zIndex: 6, background: hov ? `linear-gradient(${side === 'left' ? '90deg' : '270deg'}, rgba(120,80,30,0.10), transparent)` : 'transparent', transition: 'background .15s' }}>
      <div style={{ position: 'absolute', top: '50%', [outer]: 14, transform: 'translateY(-50%)', fontSize: 18, color: pal.pageMeta, opacity: hov ? 0.9 : 0, transition: 'opacity .15s' }}>
        {kind === 'next-chapter' ? '✦' : (side === 'left' ? '‹' : '›')}
      </div>
      <div style={{ position: 'absolute', bottom: 0, [outer]: 0, width: 0, height: 0, transition: 'border-width .18s ease', borderStyle: 'solid', borderWidth: `0 0 ${hov ? 50 : 0}px ${hov ? 50 : 0}px`, borderColor: `transparent transparent ${pal.pageEdge} transparent`, transform: side === 'left' ? 'scaleX(-1)' : 'none', filter: 'drop-shadow(0 -2px 3px rgba(0,0,0,0.22))' }} />
    </div>
  )
}

const Leaf = memo(function Leaf({ parrafos, side, pageNum, fontSize, readingFont, pageW, pageH, mediaByParrafo, onPlaySfx, onTextSelect, onPrev, onNext, nextKind, chapterTitle, chapterNum, isFirst, empty, pal = getReaderPalette('light') }) {
  const radius = side === 'left' ? '5px 2px 2px 5px' : side === 'right' ? '2px 5px 5px 2px' : '5px'
  const innerShadow = side === 'left' ? 'inset -16px 0 26px -14px rgba(60,35,12,0.38)' : side === 'right' ? 'inset 16px 0 26px -14px rgba(60,35,12,0.30)' : 'none'
  const pad = Math.round(pageW * 0.11)
  return (
    <div style={{ position: 'relative', width: pageW, height: pageH, background: pal.pageBg, borderRadius: radius, boxShadow: `${innerShadow}, 0 0 0 1px rgba(60,35,12,0.12)`, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent ${fontSize*1.85-1}px, ${pal.lineRGBA} ${fontSize*1.85-1}px, ${pal.lineRGBA} ${fontSize*1.85}px)` }} />
      <div style={{ position: 'absolute', inset: 0, padding: `${Math.round(pageH*0.075)}px ${pad}px ${Math.round(pageH*0.085)}px`, overflow: 'hidden' }}>
        {empty
          ? <div style={{ color: pal.pageMeta, fontFamily: "'Special Elite', monospace", fontSize: 14, textAlign: 'center', marginTop: pageH/2 - 80 }}>— fin del capítulo —</div>
          : <PageContent parrafos={parrafos} mediaByParrafo={mediaByParrafo} onPlaySfx={onPlaySfx} onTextSelect={onTextSelect} fontSize={fontSize} readingFont={readingFont} isFirst={isFirst} chapterTitle={chapterTitle} chapterNum={chapterNum} pal={pal} />}
      </div>
      {pageNum && <div style={{ position: 'absolute', bottom: 20, [side === 'right' ? 'right' : 'left']: pad, fontSize: 11, color: pal.pageMeta, fontFamily: "'Special Elite', monospace" }}>{pageNum}</div>}
      {(side === 'left' || side === 'single') && onPrev && <SideTurn side="left" onClick={onPrev} kind="prev" pal={pal} />}
      {(side === 'right' || side === 'single') && onNext && <SideTurn side="right" onClick={onNext} kind={nextKind} pal={pal} />}
    </div>
  )
})

export const BookReader = memo(function BookReader({
  chapter, chapters, chapterIndex, paginas, pageIndex, doubleView,
  mediaByParrafo, onPlaySfx, onPrevPage, onNextPage, onNextChapter,
  onToggleView, onChapterSelect, onTextSelect,
  onFontSize, onReadingFont, readingTheme = 'light', onReadingTheme,
  pageW = 470, pageH = 560, fontSize = 18, readingFont = "'Crimson Text', Georgia, serif",
  xrayOpen = false, xrayItems = [], onToggleXray, onXrayItemClick,
}) {
  const xrayInitial = s => (s || '').replace(/^(El|La|Los|Las)\s+/i, '').charAt(0).toUpperCase()
  const pal = getReaderPalette(readingTheme)
  const total = paginas.length
  const isLast = doubleView ? pageIndex >= total - 2 : pageIndex >= total - 1
  const left = paginas[pageIndex] || []
  const right = paginas[pageIndex + 1] || []
  const showRight = doubleView && right.length > 0
  const edge = (radius) => ({ width: 7, alignSelf: 'stretch', margin: '3px 0', background: `repeating-linear-gradient(0deg, ${pal.pageEdge}, ${pal.pageEdge} 1px, ${tint(pal.pageEdge,-0.12)} 2px, ${tint(pal.pageEdge,-0.12)} 3px)`, borderRadius: radius, flexShrink: 0 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 12, padding: '0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChapterSelect chapters={chapters || []} chapterIndex={chapterIndex} onChapterSelect={onChapterSelect} />
          <TypographyControl fontSize={fontSize} onFontSize={onFontSize} readingFont={readingFont} onReadingFont={onReadingFont} readingTheme={readingTheme} onReadingTheme={onReadingTheme} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* X-ray */}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={onToggleXray}
              style={{ whiteSpace: 'nowrap', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer', border: `1.5px solid ${theme.ink}`, borderRadius: 999, padding: '4px 12px', background: xrayOpen ? theme.ink : theme.navBg, color: xrayOpen ? '#fffdf8' : theme.navText, boxShadow: `1px 1.5px 0 ${theme.ink}26` }}>
              X-ray
            </button>
            {xrayOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60, background: '#fffdf8', border: `2px solid ${theme.ink}`, borderRadius: 16, padding: '12px 16px', minWidth: 210, maxWidth: 290, maxHeight: 320, overflowY: 'auto', boxShadow: `2px 4px 0 ${theme.ink}22, 0 14px 30px rgba(0,0,0,0.22)`, fontFamily: "'Baloo 2', sans-serif" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(74,54,34,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Personajes · hasta cap. {chapter.numero ?? chapterIndex + 1}
                </div>
                {xrayItems.length === 0
                  ? <p style={{ fontSize: 13, color: 'rgba(74,54,34,0.5)', fontStyle: 'italic', margin: 0 }}>Sin personajes hasta este capítulo.</p>
                  : xrayItems.map(it => (
                    <button key={it.id} onClick={() => onXrayItemClick?.(it.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(74,54,34,0.08)', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: '#d56a52', color: '#fff', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(74,54,34,0.35)' }}>
                        {xrayInitial(it.nombre)}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#4a3622', lineHeight: 1.2 }}>{it.nombre}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
          {/* Toggle 1p / 2p */}
          <button type="button" onClick={onToggleView}
            style={{ whiteSpace: 'nowrap', fontFamily: "'Baloo 2', sans-serif", fontWeight: 600, fontSize: 12, cursor: 'pointer', border: `1.5px solid ${theme.ink}`, borderRadius: 999, padding: '4px 12px', background: theme.navBg, color: theme.navText, boxShadow: `1px 1.5px 0 ${theme.ink}26` }}>
            {doubleView ? '▢ Una página' : '▢▢ Doble página'}
          </button>
        </div>
      </div>

      <div className="book-shadow" style={{ display: 'flex', position: 'relative', filter: 'drop-shadow(0 16px 30px rgba(70,46,20,0.4))' }}>
        {doubleView && <div style={edge('5px 0 0 5px')} />}
        <Leaf parrafos={left} side={doubleView ? 'left' : 'single'} pageNum={pageIndex + 1} fontSize={fontSize} readingFont={readingFont} pageW={pageW} pageH={pageH} mediaByParrafo={mediaByParrafo} onPlaySfx={onPlaySfx} onTextSelect={onTextSelect} onPrev={onPrevPage} onNext={!doubleView ? (isLast ? onNextChapter : onNextPage) : undefined} nextKind={isLast ? 'next-chapter' : 'next'} isFirst={pageIndex === 0} chapterTitle={chapter.titulo} chapterNum={chapter.numero ?? chapterIndex + 1} pal={pal} />
        {doubleView && <div style={{ width: 20, height: pageH, background: 'linear-gradient(to right, rgba(0,0,0,0.34) 0%, rgba(90,55,20,0.12) 45%, rgba(0,0,0,0.28) 100%)', boxShadow: 'inset 0 0 12px rgba(0,0,0,0.42)', flexShrink: 0 }} />}
        {doubleView && (
          <Leaf parrafos={right} side="right" pageNum={showRight ? pageIndex + 2 : ''} fontSize={fontSize} readingFont={readingFont} pageW={pageW} pageH={pageH} mediaByParrafo={mediaByParrafo} onPlaySfx={onPlaySfx} onTextSelect={onTextSelect} onNext={isLast ? onNextChapter : onNextPage} nextKind={isLast ? 'next-chapter' : 'next'} isFirst={false} empty={!showRight} pal={pal} />
        )}
        <div style={edge('0 5px 5px 0')} />
      </div>
    </div>
  )
})
