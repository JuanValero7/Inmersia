// Plain JavaScript (.jsx)
// Lector inmersivo — orquestador principal (estética clay / acuarela).
// Solo estado, queries Supabase y composicion de vistas.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import useLocalStorage from '../hooks/useLocalStorage.js'
import { useLectorData } from '../hooks/useLectorData.js'
import { useXrayItems } from '../hooks/useXrayItems.js'
import '../styles/lector.css'

import { paginarParrafos } from '../utils/lectorPagination.js'
import { runGuidedLector1, runGuidedLector2 } from './tutorial.js'
import { getTourPhase, setTourPhase } from './guidedTour.js'
import { BookReader }      from './lector/BookReader.jsx'
import { PolaroidStack }   from './lector/PolaroidStack.jsx'
import { NotebookIcon } from './lector/RecorderPlayer.jsx'
import { Notebook }        from './lector/Notebook.jsx'
import { theme, ClayButton, getReaderPalette } from './lector/clay.jsx'
import SuperuserSoundsPanel from './lector/SuperuserSoundsPanel.jsx'

const READING_FONT_DEFAULT = "'Crimson Text', Georgia, serif"

// Factor de ancho medio de carácter por fuente (para estimar caracteres/línea).
// Baloo 2 y Merriweather son más anchas que Crimson/Lora.
const FONT_WIDTH = {
  "'Crimson Text', Georgia, serif": 0.46,
  "'Lora', Georgia, serif": 0.46,
  "'Merriweather', Georgia, serif": 0.50,
  "'Baloo 2', system-ui, sans-serif": 0.52,
}

// Geometría de página: el libro llena la pantalla.
// El tamaño y la fuente afectan la paginación (caracteres/línea + alto de línea).
function computeGeom(doubleView, fontSize, readingFont) {
  const pageH = Math.min(760, Math.max(430, window.innerHeight - 165))
  const availW = window.innerWidth - 64
  let pageW = doubleView
    ? Math.min(Math.round(pageH * 0.92), Math.floor((availW - 34) / 2))
    : Math.min(Math.round(pageH * 1.6), availW)
  pageW = Math.max(300, pageW)
  const contentW = pageW - Math.round(pageW * 0.22)
  const wf = FONT_WIDTH[readingFont] || 0.46
  const charsPerLine = Math.max(26, Math.floor(contentW / (fontSize * wf)))
  const lineHeight = Math.round(fontSize * 1.85)
  const maxH = Math.round(pageH * 0.79)
  return { pageW, pageH, charsPerLine, lineHeight, maxH }
}

function NavButton({ onClick, title, icon, label, id }) {
  const btnStyle = { display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 13.5, cursor: 'pointer', border: `2px solid ${theme.ink}`, borderRadius: 999, padding: '8px 16px 8px 14px', background: theme.navBg, color: theme.navText, boxShadow: `1.6px 2.4px 0 ${theme.ink}30` }
  return (
    <button id={id} type="button" onClick={onClick} title={title} style={btnStyle}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
      {label}
    </button>
  )
}

function EstrellaLector({ valor, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onChange?.(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          style={{ fontSize: 26, cursor: 'pointer', userSelect: 'none', color: n <= (hover || valor) ? theme.accent : 'rgba(74,54,34,0.2)', transition: 'color 0.1s' }}>★</span>
      ))}
    </div>
  )
}

export default function VistaLectura({ book, onGoBack, onGoCartelera, onGoForo, startWithNotebook, onNotebookStarted, isSuperuser = false }) {
  const [chapterIndex,   setChapterIndex]   = useState(0)
  const [pageIndex,      setPageIndex]      = useState(0)
  const [doubleView,     setDoubleView]     = useState(true)
  const [notebookOpen,   setNotebookOpen]   = useState(false)
  const [pendingChapter, setPendingChapter] = useState(null)
  const [explorarOpen,   setExplorarOpen]   = useState(false)
  const [xrayOpen,       setXrayOpen]       = useState(false)

  // Lógica de datos compartida con LectorMobile (ver src/hooks/useLectorData.js)
  const {
    userId, capitulos, chapterCache, loading, loadingCap, error,
    isLeido, setIsLeido,
    pendingRestore, setPendingRestore, restoredRef,
    setLoadingCap, setError,
    fetchChapter, playSfx, persistChapterAdvance, subrayar,
    quitarMedia, marcarMedia, sugerirMedia, borrarParrafo,
    miResena, resenaForm, setResenaForm, resenaEnviando, submitResena,
  } = useLectorData(book, setChapterIndex, setPageIndex)

  useEffect(() => {
    if (startWithNotebook) {
      setNotebookOpen(true)
      onNotebookStarted?.()
    }
  }, [startWithNotebook])

  useEffect(() => {
    if (!explorarOpen) return
    const h = (e) => { if (!e.target.closest('.inm-explorar-popup')) setExplorarOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [explorarOpen])

  // Preferencias de lectura (persistidas)
  const [fontSize,    setFontSize]    = useLocalStorage('inm_lector_fontSize', 19)
  const [readingFont, setReadingFont] = useLocalStorage('inm_lector_font', READING_FONT_DEFAULT)
  const [readingTheme, setReadingTheme] = useLocalStorage('inm_lector_theme', 'light')
  const [ledColor, setLedColor] = useLocalStorage('inm_lector_ledColor', 'none')
  const pal = getReaderPalette(readingTheme)

  // Tutorial — se lanza la primera vez que el libro carga (después de loading)
  useEffect(() => {
    if (loading || !book?.libro_id) return
    const phase = getTourPhase()
    let t
    if (phase === 'wait_lector') {
      t = setTimeout(() => runGuidedLector1(), 900)
    }
    return () => clearTimeout(t)
  }, [loading, book?.libro_id])

  const [pendingSelection,  setPendingSelection]  = useState(null)
  const [adminPanelOpen,    setAdminPanelOpen]    = useState(false)

  const [geom, setGeom] = useState(() => computeGeom(true, fontSize, readingFont))
  useEffect(() => {
    let raf = 0
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setGeom(computeGeom(doubleView, fontSize, readingFont))) }
    setGeom(computeGeom(doubleView, fontSize, readingFont))
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [doubleView, fontSize, readingFont])
  const pagiOpts = useMemo(() => ({ charsPerLine: geom.charsPerLine, lineHeight: geom.lineHeight, maxH: geom.maxH }), [geom])

  // Estados para medición DOM (el useEffect va después de currentChapData)
  const [measuredHeights, setMeasuredHeights] = useState({})
  const [titleH,          setTitleH]          = useState(0)

  // ── Reseña (UI) ──
  const [resenaOpen, setResenaOpen] = useState(false)

  useEffect(() => {
    const cap = capitulos[chapterIndex]; if (!cap) return
    let cancelled = false
    ;(async () => {
      setError(null)
      try {
        let entry = chapterCache[cap.id]
        if (!entry) { setLoadingCap(true); entry = await fetchChapter(cap) }
        if (cancelled || !entry) return
        if (pendingRestore) {
          const pags = paginarParrafos(entry.parrafos, doubleView, pagiOpts)
          const idx  = pags.findIndex(pg => pg.some(p => p.id === pendingRestore))
          if (idx >= 0) setPageIndex(doubleView ? idx - (idx % 2) : idx)
          setPendingRestore(null); restoredRef.current = true
        }
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoadingCap(false)
      }
    })()
    return () => { cancelled = true }
  }, [chapterIndex, capitulos])

  const currentChapter  = capitulos[chapterIndex] || null
  const currentChapData = currentChapter ? chapterCache[currentChapter.id] : null
  const currentMedia    = currentChapData?.mediaByParrafo || {}
  const currentAmbient  = currentChapData?.ambient || null

  // ── Medición real de alturas desde el DOM ─────────────────────────
  // Va aquí porque necesita currentChapter y currentChapData declarados arriba.
  useEffect(() => {
    const parrafos = currentChapData?.parrafos
    if (!parrafos?.length || !currentChapter) {
      setMeasuredHeights({})
      setTitleH(0)
      return
    }

    const { pageW } = computeGeom(doubleView, fontSize, readingFont)
    const pad      = Math.round(pageW * 0.11)
    const contentW = pageW - 2 * pad

    const container = document.createElement('div')
    container.style.cssText =
      `position:fixed;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;` +
      `width:${contentW}px;font-family:${readingFont};font-size:${fontSize}px;` +
      `line-height:1.85;overflow:visible;`
    document.body.appendChild(container)

    // Encabezado de capítulo (reserva espacio en la primera página)
    const headEl = document.createElement('div')
    headEl.style.marginBottom = '22px'
    const capLabel = document.createElement('div')
    capLabel.style.cssText = `font-family:'Special Elite',monospace;font-size:${fontSize * 0.6}px;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px`
    capLabel.textContent = `Capítulo ${currentChapter.numero ?? ''}`
    const capTitle = document.createElement('div')
    capTitle.style.cssText = `font-family:'Playfair Display',serif;font-size:${fontSize * 1.7}px;font-weight:700;line-height:1.1`
    capTitle.textContent = currentChapter.titulo || ''
    const capLine = document.createElement('div')
    capLine.style.cssText = `width:60px;height:3px;margin-top:14px`
    headEl.appendChild(capLabel)
    headEl.appendChild(capTitle)
    headEl.appendChild(capLine)
    container.appendChild(headEl)

    // Todos los párrafos en una sola pasada (un único reflow del browser)
    const items = parrafos.map(p => {
      const el = document.createElement('p')
      if (p.tipo === 'separador') {
        el.style.cssText = `margin:0;padding:0;text-align:center;letter-spacing:0.4em;`
        el.textContent   = '❧'
      } else {
        el.style.cssText =
          `margin:0;padding:0;white-space:pre-line;text-align:justify;hyphens:auto;` +
          `text-indent:${p.tipo === 'dialogo' ? '0' : '1.2em'};` +
          `font-style:${p.tipo === 'dialogo' ? 'italic' : 'normal'};`
        el.textContent = p.contenido || ''
      }
      container.appendChild(el)
      return { p, el }
    })

    // Lectura única del layout (un solo reflow)
    const measuredTitleH = headEl.offsetHeight
    const heights = {}
    for (const { p, el } of items) heights[p.id] = el.offsetHeight

    document.body.removeChild(container)
    setTitleH(measuredTitleH)
    setMeasuredHeights(heights)
  }, [currentChapData?.parrafos, currentChapter?.id, fontSize, readingFont, doubleView])

  const currentPaginas = useMemo(() => {
    if (!currentChapData?.parrafos) return [[]]
    const { charsPerLine, lineHeight, maxH } = computeGeom(doubleView, fontSize, readingFont)
    const GAP           = Math.round(fontSize * 0.7)
    const firstPageMaxH = Math.max(lineHeight * 3, maxH - titleH)
    const origLens      = {}
    for (const p of currentChapData.parrafos) origLens[p.id] = (p.contenido || '').length
    return paginarParrafos(currentChapData.parrafos, doubleView, {
      charsPerLine,
      lineHeight,
      maxH,
      firstPageMaxH,
      paragraphGap:    GAP,
      measuredHeights: Object.keys(measuredHeights).length > 0 ? measuredHeights : null,
      originalLengths: origLens,
    })
  }, [currentChapData?.parrafos, doubleView, fontSize, readingFont, measuredHeights, titleH])

  // si cambia la geometría, evitar quedar fuera de rango
  useEffect(() => {
    if (pageIndex >= currentPaginas.length) setPageIndex(Math.max(0, currentPaginas.length - (doubleView ? 2 : 1)))
  }, [currentPaginas.length])

  useEffect(() => {
    if (!restoredRef.current || !userId || !book?.libro_id) return
    const cap = capitulos[chapterIndex]; if (!cap || !currentChapData) return
    const firstParr = currentPaginas[pageIndex]?.[0]; if (!firstParr) return
    const t = setTimeout(() => {
      supabase.from('progreso_lectura').upsert({
        user_id: userId, libro_id: book.libro_id,
        ultimo_parrafo_id: firstParr.id, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,libro_id' }).then(() => {})
    }, 600)
    return () => clearTimeout(t)
  }, [chapterIndex, pageIndex, currentPaginas, userId, book?.libro_id, capitulos])

  // Al llegar a la última página del último capítulo → 100 %
  useEffect(() => {
    if (!restoredRef.current || !userId || !book?.libro_id) return
    if (!capitulos.length || chapterIndex !== capitulos.length - 1) return
    if (!currentPaginas.length) return
    const step = doubleView ? 2 : 1
    const isLastPage = pageIndex >= currentPaginas.length - step
    if (!isLastPage) return
    const t = setTimeout(async () => {
      await supabase.from('progreso_lectura')
        .update({ porcentaje: 100, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('libro_id', book.libro_id)
      await supabase.from('bibliotecas_usuarios')
        .update({ leido: true })
        .eq('user_id', userId).eq('libro_id', book.libro_id)
      setIsLeido(true)
    }, 600)
    return () => clearTimeout(t)
  }, [chapterIndex, pageIndex, currentPaginas.length, capitulos.length, doubleView, userId, book?.libro_id])

  const handleTextSelect = useCallback(({ text, parrafoId, rect }) => {
    setPendingSelection({ text, parrafoId, rect })
  }, [])

  async function handleSubrayar() {
    if (!pendingSelection || !userId || !book?.libro_id) return
    await subrayar(pendingSelection.text, pendingSelection.parrafoId, chapterIndex)
    setPendingSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  useEffect(() => {
    if (!pendingSelection) return
    function dismiss(e) { if (!e.target.closest('.subrayado-popup')) setPendingSelection(null) }
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [pendingSelection])

  const visibleImages = useMemo(() => {
    if (!currentChapData) return []
    const lastVisiblePage = pageIndex + (doubleView ? 1 : 0)
    const parrToPage = {}
    currentPaginas.forEach((page, idx) => page.forEach(p => { parrToPage[p.id] = idx }))
    const seen = new Set(); const imgs = []
    for (const p of currentChapData.parrafos) {
      const pgIdx = parrToPage[p.id]
      if (pgIdx === undefined || pgIdx > lastVisiblePage) continue
      for (const m of (currentChapData.mediaByParrafo[p.id] || [])) {
        if (m.tipo === 'imagen' && m.origen === 'explicito' && !seen.has(m.media_id)) {
          seen.add(m.media_id); imgs.push(m)
        }
      }
    }
    return imgs
  }, [currentChapData, currentPaginas, pageIndex, doubleView])

  function handlePrevPage() {
    const step = doubleView ? 2 : 1
    if (pageIndex > 0) { setPageIndex(p => Math.max(0, p - step)); return }
    if (chapterIndex > 0) {
      const prevEntry = chapterCache[capitulos[chapterIndex - 1].id]
      setChapterIndex(chapterIndex - 1)
      if (prevEntry) {
        const prevPages = paginarParrafos(prevEntry.parrafos, doubleView, pagiOpts)
        const last = prevPages.length - 1
        setPageIndex(doubleView ? Math.max(0, last - (last % 2)) : last)
      } else { setPageIndex(0) }
    }
  }
  function handleNextPage() {
    const step = doubleView ? 2 : 1
    const next = pageIndex + step
    if (next < currentPaginas.length) setPageIndex(next)
  }
  const handleNextChapter = useCallback(() => {
    const next = chapterIndex + 1
    if (next >= capitulos.length) return
    if (getTourPhase() === 'wait_chapter') setTourPhase('notebook_1')
    setPendingChapter(next); setNotebookOpen(true)
  }, [chapterIndex, capitulos.length])

  const handleToggleView    = useCallback(() => setDoubleView(v => !v), [])
  const handleChapterSelect = useCallback((idx) => { setChapterIndex(idx); setPageIndex(0); setXrayOpen(false) }, [])

  // X-ray: cierra al cambiar de capítulo; personajes cargados por useXrayItems
  useEffect(() => { setXrayOpen(false) }, [chapterIndex])
  const xrayItems = useXrayItems(xrayOpen, book?.libro_id, currentChapter?.numero ?? chapterIndex + 1)
  async function handleSubmitResena() {
    if (await submitResena()) setResenaOpen(false)
  }

  async function handleCloseNotebook() {
    setNotebookOpen(false)
    if (getTourPhase() === 'lector_2') {
      setTimeout(() => runGuidedLector2(), 500)
    }
    if (pendingChapter !== null) {
      await persistChapterAdvance(pendingChapter)
      setChapterIndex(pendingChapter); setPageIndex(0); setPendingChapter(null)
    }
  }

  const msgStyle = { color: theme.subText, fontFamily: "'Special Elite',monospace", fontSize: 14, textAlign: 'center', padding: 60 }
  const halfBook = (doubleView ? (2 * geom.pageW + 20 + 14) : (geom.pageW + 7)) / 2

  return (
    <div className="desk" style={{ position: 'relative', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: pal.deskBg, fontFamily: "'Baloo 2', sans-serif" }}>
      <div style={{ position: 'absolute', inset: 0, background: pal.vignette, pointerEvents: 'none', zIndex: 1 }} />

      {/* TOP BAR */}
      <header style={{ position: 'relative', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 24px 0' }}>
        <div style={{ background: theme.navBg, border: `2px solid ${theme.ink}`, borderRadius: 14, padding: '9px 15px', display: 'flex', alignItems: 'center', boxShadow: `1.5px 2px 0 ${theme.ink}22`, maxWidth: 320 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#8a7355', fontFamily: "'Baloo 2', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book?.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
          {isSuperuser && !loading && !error && book?.libro_id && (
            <button type="button" onClick={() => setAdminPanelOpen(v => !v)} title="Panel de media (superusuario)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer', border: `2px solid ${adminPanelOpen ? theme.accent : theme.ink}`, borderRadius: 999, padding: '8px 14px', background: adminPanelOpen ? theme.accent : theme.navBg, color: adminPanelOpen ? '#fff' : theme.navText, boxShadow: `1.6px 2.4px 0 ${theme.ink}30` }}>
              ⚙ Media
            </button>
          )}
          {isLeido && book?.libro_id && (
            <NavButton onClick={() => setResenaOpen(true)} title="Escribir reseña"
              icon="M12 3l2.6 5.4L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.4-.6z"
              label="Reseña" />
          )}
          <div className="inm-explorar-popup" style={{ position: 'relative' }}>
            {explorarOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60,
                background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 16,
                padding: '10px 14px', display: 'flex', gap: 20, alignItems: 'flex-end',
                boxShadow: '2px 4px 0 rgba(74,54,34,0.22), 0 14px 30px rgba(0,0,0,0.22)',
                whiteSpace: 'nowrap',
              }}>
                <button type="button" onClick={() => { setExplorarOpen(false); onGoForo() }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/></svg>
                  <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }}>Foro</span>
                </button>
                <button type="button" onClick={() => { if (getTourPhase() === 'wait_cartelera') setTourPhase('cart_portada_1'); setExplorarOpen(false); onGoCartelera() }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }}>Investigación</span>
                </button>
                <button type="button" onClick={() => { setExplorarOpen(false); onGoBack() }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11, color: '#4a3622' }}>Biblioteca</span>
                </button>
              </div>
            )}
            <button id="tutorial-explorar-header" type="button" onClick={() => setExplorarOpen(o => !o)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: theme.navBg, border: `2px solid ${theme.ink}`, borderRadius: 999, padding: '9px 16px', color: theme.ink, fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: `1.5px 2px 0 rgba(74,54,34,0.20)` }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><path d="M2 12h20"/>
              </svg>
              Explorar
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 24px 0' }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          {loading && <div style={msgStyle}>Cargando libro…</div>}
          {!loading && !book?.libro_id && (
            <div style={{ ...msgStyle, maxWidth: 480 }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>📕</div>
              Este libro todavía no está disponible para lectura inmersiva.
            </div>
          )}
          {!loading && error && (
            <div style={{ ...msgStyle, color: 'rgba(180,60,30,0.9)', maxWidth: 480 }}>
              ⚠ Error cargando el libro:<br/><span style={{ opacity: 0.7 }}>{error}</span>
            </div>
          )}
          {!loading && !error && book?.libro_id && currentChapter && (
            loadingCap && !currentChapData
              ? <div style={msgStyle}>Cargando capítulo…</div>
              : <BookReader
                  chapter={currentChapter}
                  chapters={capitulos}
                  chapterIndex={chapterIndex}
                  paginas={currentPaginas}
                  pageIndex={pageIndex}
                  doubleView={doubleView}
                  mediaByParrafo={currentMedia}
                  onPlaySfx={playSfx}
                  onPrevPage={handlePrevPage}
                  onNextPage={handleNextPage}
                  onNextChapter={handleNextChapter}
                  onToggleView={handleToggleView}
                  onChapterSelect={handleChapterSelect}
                  xrayOpen={xrayOpen}
                  xrayItems={xrayItems}
                  onToggleXray={() => setXrayOpen(v => !v)}
                  onXrayItemClick={(itemId) => { setXrayOpen(false); onGoCartelera(itemId) }}
                  onTextSelect={handleTextSelect}
                  pageW={geom.pageW}
                  pageH={geom.pageH}
                  fontSize={fontSize}
                  readingFont={readingFont}
                  onFontSize={setFontSize}
                  onReadingFont={setReadingFont}
                  readingTheme={readingTheme}
                  onReadingTheme={setReadingTheme}
                  ambient={currentAmbient}
                  ledColor={ledColor}
                  onLedColor={setLedColor}
                />
          )}
        </div>

        {/* polaroids: siempre detrás del libro */}
        {!loading && !error && book?.libro_id && (
          <div style={{ position: 'absolute', top: '50%', left: `calc(50% + ${halfBook}px)`, transform: 'translateY(-50%) translateX(-110px)', zIndex: 1 }}>
            <PolaroidStack images={visibleImages} />
          </div>
        )}
      </div>

      {/* BOTTOM BAR */}
      {!loading && !error && book?.libro_id && (
        <div style={{ position: 'relative', zIndex: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '8px 26px 18px' }}>
          <button id="tutorial-cuaderno-btn" type="button" onClick={() => setNotebookOpen(true)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <NotebookIcon />
            <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 11.5, color: theme.textColor }}>Cuaderno</span>
          </button>
        </div>
      )}

      <Notebook
        isOpen={notebookOpen}
        onClose={handleCloseNotebook}
        userId={userId}
        libroId={book?.libro_id}
        capituloNum={capitulos[chapterIndex]?.numero ?? chapterIndex + 1}
        capitulos={capitulos}
      />

      {/* Reseña */}
      {resenaOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(20,12,4,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'linear-gradient(160deg,#fffdf8,#f3ead6)', border: `2px solid ${theme.ink}`, borderRadius: 16, padding: 26, minWidth: 300, maxWidth: 420, width: '90%', boxShadow: `4px 6px 0 ${theme.ink}30, 0 24px 60px rgba(0,0,0,0.4)` }}>
            <h3 style={{ color: theme.ink, fontFamily: "'Playfair Display',serif", fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>
              {miResena ? 'Editar mi reseña' : 'Escribir una reseña'}
            </h3>
            <EstrellaLector valor={resenaForm.rating} onChange={r => setResenaForm(f => ({...f, rating: r}))} />
            <textarea
              style={{ width: '100%', marginTop: 14, boxSizing: 'border-box', background: '#fffdf8', border: `1.5px solid ${theme.ink}55`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: theme.ink, resize: 'vertical', fontFamily: "'Crimson Text',serif", lineHeight: 1.5, outline: 'none' }}
              placeholder="Escribe tu reseña (opcional)…"
              maxLength={1000}
              value={resenaForm.texto}
              onChange={e => setResenaForm(f => ({...f, texto: e.target.value}))}
              rows={4}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <ClayButton onClick={() => setResenaOpen(false)}>Cancelar</ClayButton>
              <ClayButton variant="primary" disabled={!resenaForm.rating || resenaEnviando} onClick={handleSubmitResena}>
                {resenaEnviando ? 'Guardando…' : 'Guardar'}
              </ClayButton>
            </div>
          </div>
        </div>
      )}

      {/* Popup subrayar */}
      {pendingSelection && (
        <div className="subrayado-popup" style={{ position: 'fixed', top: pendingSelection.rect.bottom + 8, left: Math.max(12, pendingSelection.rect.left), zIndex: 1300, background: theme.navBg, border: `2px solid ${theme.ink}`, borderRadius: 12, padding: '7px 10px', display: 'flex', gap: 9, alignItems: 'center', boxShadow: `2px 3px 0 ${theme.ink}30, 0 10px 24px rgba(0,0,0,0.3)` }}>
          <span style={{ fontFamily: "'Crimson Text', serif", fontStyle: 'italic', fontSize: 13, color: theme.navText, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {'"'}{pendingSelection.text.length > 45 ? pendingSelection.text.slice(0, 45) + '...' : pendingSelection.text}{'"'}
          </span>
          <ClayButton variant="primary" onClick={handleSubrayar} style={{ padding: '5px 13px', fontSize: 12 }}>Subrayar</ClayButton>
        </div>
      )}

      {/* Panel de superusuario */}
      {isSuperuser && adminPanelOpen && (
        <SuperuserSoundsPanel
          parrafos={currentChapData?.parrafos || []}
          mediaByParrafo={currentMedia}
          onQuitar={quitarMedia}
          onMarcar={marcarMedia}
          onSugerir={sugerirMedia}
          onBorrarParrafo={borrarParrafo}
          onClose={() => setAdminPanelOpen(false)}
        />
      )}
    </div>
  )
}
