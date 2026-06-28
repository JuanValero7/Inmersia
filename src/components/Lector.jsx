// Plain JavaScript (.jsx)
// Lector inmersivo — orquestador principal (estética clay / acuarela).
// Solo estado, queries Supabase y composicion de vistas.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import useLocalStorage from '../hooks/useLocalStorage.js'
import { useLectorData } from '../hooks/useLectorData.js'
import { useXrayItems } from '../hooks/useXrayItems.js'
import '../styles/lector.css'

import { paginarParrafosDesktopDOM } from '../utils/lectorPagination.js'
import { runGuidedLector1, runGuidedLector2 } from './tutorial.js'
import { getTourPhase, setTourPhase } from './guidedTour.js'
import { BookReader }      from './lector/BookReader.jsx'
import { PolaroidStack }   from './lector/PolaroidStack.jsx'
import { NotebookIcon } from './lector/RecorderPlayer.jsx'
import { Notebook }        from './lector/Notebook.jsx'
import { theme, ClayButton, getReaderPalette } from './lector/clay.jsx'
import SuperuserSoundsPanel from './lector/SuperuserSoundsPanel.jsx'
import { FONT_WIDTH } from './lector/readerConstants.js'

const READING_FONT_DEFAULT = "'Crimson Text', Georgia, serif"

// Geometría de página: el libro llena la pantalla.
// El tamaño y la fuente afectan la paginación (caracteres/línea + alto de línea).
function computeGeom(doubleView, fontSize, readingFont) {
  const pageH = Math.min(760, Math.max(360, window.innerHeight - 230))
  const availW = Math.max(960, window.innerWidth) - 64
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

export default function VistaLectura({ book, onGoBack, onGoCartelera, onGoForo, startWithNotebook, onNotebookStarted, isSuperuser = false, guestMode = false, onRequestAuth }) {
  const [chapterIndex,   setChapterIndex]   = useState(0)
  const [pageIndex,      setPageIndex]      = useState(0)
  const [goToLastPage,   setGoToLastPage]   = useState(false)
  const [doubleView,     setDoubleView]     = useState(true)
  const [notebookOpen,   setNotebookOpen]   = useState(false)
  const [pendingChapter, setPendingChapter] = useState(null)
  const [explorarOpen,   setExplorarOpen]   = useState(false)
  const [xrayOpen,       setXrayOpen]       = useState(false)
  const [showPaywall,    setShowPaywall]    = useState(false)

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

  // Tutorial — se lanza la primera vez que el libro carga (después de loading).
  // No se dispara para invitados: el localStorage de fases es global y marcaría
  // el tutorial como visto antes de que el usuario se registre.
  useEffect(() => {
    if (guestMode || loading || !book?.libro_id) return
    const phase = getTourPhase()
    let t
    if (phase === 'wait_lector') {
      t = setTimeout(() => runGuidedLector1(), 900)
    }
    return () => clearTimeout(t)
  }, [guestMode, loading, book?.libro_id])

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

  const [currentPaginas, setCurrentPaginas] = useState([[]])

  // Paginación DOM real: misma técnica que el mobile (offsetHeight + búsqueda
  // binaria). Reemplaza el sistema previo de measuredHeights + estimación, que
  // dejaba espacios en blanco al sobreestimar alturas de párrafos fragmentados.
  useEffect(() => {
    const parrafos = currentChapData?.parrafos
    if (!parrafos?.length || !currentChapter) { setCurrentPaginas([[]]); return }
    let cancelled = false
    ;(async () => {
      await document.fonts.ready
      if (cancelled) return
      const pages = paginarParrafosDesktopDOM(parrafos, {
        pageW:       geom.pageW,
        pageH:       geom.pageH,
        fontSize,
        readingFont,
        chapterHead: { numero: currentChapter.numero ?? chapterIndex + 1, titulo: currentChapter.titulo },
      })
      if (!cancelled) setCurrentPaginas(pages)
    })()
    return () => { cancelled = true }
  }, [currentChapData?.parrafos, currentChapter?.id, chapterIndex, fontSize, readingFont, geom.pageW, geom.pageH])

  // Restaurar posición de lectura guardada una vez que currentPaginas está lista.
  useEffect(() => {
    if (!pendingRestore) return
    const idx = currentPaginas.findIndex(pg => pg.some(p => p.id === pendingRestore))
    if (idx < 0) return
    setPageIndex(doubleView ? idx - (idx % 2) : idx)
    setPendingRestore(null)
    restoredRef.current = true
    setGoToLastPage(false)
  }, [pendingRestore, currentPaginas, doubleView])

  // si cambia la geometría, evitar quedar fuera de rango
  useEffect(() => {
    if (pageIndex >= currentPaginas.length) setPageIndex(Math.max(0, currentPaginas.length - (doubleView ? 2 : 1)))
  }, [currentPaginas.length])

  // al navegar hacia atrás entre capítulos, esperar a que currentPaginas
  // corresponda al capítulo actual antes de saltar a la última página
  useEffect(() => {
    if (!goToLastPage || !currentChapData) return
    const firstParrId = currentChapData.parrafos?.[0]?.id
    const paginasReady = !firstParrId || currentPaginas.some(pg => pg.some(p => p.id === firstParrId))
    if (!paginasReady) return
    const last = currentPaginas.length - 1
    if (last < 0) return
    setPageIndex(doubleView ? Math.max(0, last - (last % 2)) : last)
    setGoToLastPage(false)
  }, [goToLastPage, currentPaginas, currentChapData, doubleView])

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

  const handlePrevPage = useCallback(() => {
    const step = doubleView ? 2 : 1
    if (pageIndex > 0) { setPageIndex(p => Math.max(0, p - step)); return }
    if (chapterIndex > 0) {
      setChapterIndex(chapterIndex - 1)
      // Siempre esperar la paginación con measuredHeights reales para calcular
      // la última página correcta, independientemente de si el capítulo está cacheado.
      setGoToLastPage(true)
    }
  }, [doubleView, pageIndex, chapterIndex])

  const handleNextPage = useCallback(() => {
    const step = doubleView ? 2 : 1
    const next = pageIndex + step
    if (next < currentPaginas.length) {
      setPageIndex(next)
    } else if (guestMode && chapterIndex >= capitulos.length - 1) {
      setShowPaywall(true)
    }
  }, [doubleView, pageIndex, currentPaginas.length, guestMode, chapterIndex, capitulos.length])
  const handleNextChapter = useCallback(() => {
    const next = chapterIndex + 1
    if (next >= capitulos.length) {
      if (guestMode) setShowPaywall(true)
      return
    }
    if (guestMode) { setChapterIndex(next); setPageIndex(0); return }
    if (getTourPhase() === 'wait_chapter') setTourPhase('notebook_1')
    setPendingChapter(next); setNotebookOpen(true)
  }, [chapterIndex, capitulos.length, guestMode])

  // ── Teclado: flechas para paginar, espacio para SFX ─────────
  const sfxIndexRef = useRef(0)

  const visibleSfx = useMemo(() => {
    const pages = [currentPaginas[pageIndex] || []]
    if (doubleView) pages.push(currentPaginas[pageIndex + 1] || [])
    const result = []
    for (const p of pages.flat()) {
      for (const m of (currentMedia[p.id] || [])) {
        if (m.origen !== 'explicito' || m.tipo !== 'audio') continue
        const ref = m.metadata?.texto_ref
        if (ref) {
          // Solo incluir si el texto anclado está en el fragmento visible de esta página
          if ((p.contenido || '').toLowerCase().includes(ref.toLowerCase())) result.push(m)
        } else {
          result.push(m)
        }
      }
    }
    return result
  }, [currentPaginas, pageIndex, doubleView, currentMedia])

  useEffect(() => { sfxIndexRef.current = 0 }, [pageIndex, chapterIndex])

  useEffect(() => {
    function handleKeyDown(e) {
      if (notebookOpen || showPaywall || resenaOpen || adminPanelOpen) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const isLastPage = doubleView
          ? pageIndex >= currentPaginas.length - 2
          : pageIndex >= currentPaginas.length - 1
        if (isLastPage) handleNextChapter()
        else handleNextPage()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrevPage()
      } else if (e.key === ' ') {
        if (visibleSfx.length === 0) return
        e.preventDefault()
        playSfx(visibleSfx[sfxIndexRef.current % visibleSfx.length])
        sfxIndexRef.current++
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    notebookOpen, showPaywall, resenaOpen, adminPanelOpen,
    pageIndex, chapterIndex, currentPaginas, doubleView,
    visibleSfx, handleNextPage, handleNextChapter, handlePrevPage, playSfx,
  ])

  const handleToggleView    = useCallback(() => setDoubleView(v => !v), [])
  const handleChapterSelect = useCallback((idx) => { setChapterIndex(idx); setPageIndex(0); setXrayOpen(false); setGoToLastPage(false) }, [])

  // X-ray: cierra al cambiar de capítulo; personajes/glosario cargados por useXrayItems
  const esNoficcion = book?.es_ficcion === false
  useEffect(() => { setXrayOpen(false) }, [chapterIndex])
  const xrayItems = useXrayItems(xrayOpen, book?.libro_id, currentChapter?.numero ?? chapterIndex + 1, esNoficcion ? 'glosario' : 'personajes')
  async function handleSubmitResena() {
    if (await submitResena()) setResenaOpen(false)
  }

  async function handleCloseNotebook() {
    setNotebookOpen(false)
    if (!guestMode && getTourPhase() === 'lector_2') {
      setTimeout(() => runGuidedLector2(), 500)
    }
    if (pendingChapter !== null) {
      await persistChapterAdvance(pendingChapter)
      setGoToLastPage(false)
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
        <div style={{ background: theme.navBg, border: `2px solid ${theme.ink}`, borderRadius: 14, padding: '9px 15px', display: 'flex', alignItems: 'center', boxShadow: `1.5px 2px 0 ${theme.ink}22`, flex: '1 1 auto', minWidth: 0, maxWidth: 320 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#8a7355', fontFamily: "'Baloo 2', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book?.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexShrink: 0 }}>
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
          {guestMode ? (
            <button type="button" onClick={() => onRequestAuth?.('registro')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#cf7b4c', border: '2px solid #4a3622', borderRadius: 999, padding: '9px 16px', color: '#fff', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '1.5px 2px 0 rgba(74,54,34,0.30)' }}>
              Crear cuenta
            </button>
          ) : (
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
          )}
        </div>
      </header>

      {/* CONTENIDO */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
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
                  esNoficcion={esNoficcion}
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
      {!loading && !error && book?.libro_id && !guestMode && (
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

      {/* Paywall de invitado */}
      {showPaywall && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(20,12,4,0.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 20, padding: '40px 48px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '3px 6px 0 rgba(74,54,34,0.25), 0 20px 40px rgba(0,0,0,0.35)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📚</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#2c1a0e', margin: '0 0 12px' }}>
              Seguí leyendo en Inmersia
            </h2>
            <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 15, color: '#6b4c34', lineHeight: 1.55, margin: '0 0 28px' }}>
              Ya leíste los dos capítulos de muestra.<br />
              Creá tu cuenta gratis para continuar.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => onRequestAuth?.('registro')}
                style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#8b4d2a', color: '#fff', border: '2px solid #4a3622', borderRadius: 999, padding: '10px 22px', boxShadow: '2px 3px 0 rgba(74,54,34,0.4)' }}>
                Crear cuenta
              </button>
              <button type="button" onClick={() => onRequestAuth?.('login')}
                style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#fffdf8', color: '#4a3622', border: '2px solid #4a3622', borderRadius: 999, padding: '10px 22px', boxShadow: '2px 3px 0 rgba(74,54,34,0.25)' }}>
                Iniciar sesión
              </button>
            </div>
          </div>
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
