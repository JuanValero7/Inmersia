// Plain JavaScript (.jsx)
// Lector inmersivo — orquestador principal (estética clay / acuarela).
// Solo estado, queries Supabase y composicion de vistas.

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import useLocalStorage from '../hooks/useLocalStorage.js'
import '../styles/lector.css'

import { paginarParrafos } from '../utils/lectorPagination.js'
import { BookReader }      from './lector/BookReader.jsx'
import { PolaroidStack }   from './lector/PolaroidStack.jsx'
import { RecorderPlayer, NotebookIcon } from './lector/RecorderPlayer.jsx'
import { Notebook }        from './lector/Notebook.jsx'
import { theme, ClayButton } from './lector/clay.jsx'

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
  const pageH = Math.min(700, Math.max(430, window.innerHeight - 222))
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

// Menú colapsado (arriba a la derecha)
function MenuButton({ items }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!e.target.closest('.inm-menu')) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="inm-menu" style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} title="Ir a…"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 13.5, cursor: 'pointer', border: `2px solid ${theme.ink}`, borderRadius: 999, padding: '8px 16px 8px 14px', background: open ? theme.accent : theme.navBg, color: open ? '#fff' : theme.navText, boxShadow: `1.6px 2.4px 0 ${theme.ink}30` }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        Menú
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '116%', right: 0, zIndex: 60, minWidth: 200, background: theme.navBg, border: `2px solid ${theme.ink}`, borderRadius: 16, padding: 6, boxShadow: `2px 4px 0 ${theme.ink}26, 0 14px 30px rgba(0,0,0,0.25)` }}>
          {items.map(it => (
            <button key={it.label} type="button" onClick={() => { setOpen(false); it.onClick?.() }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '10px 13px', border: 'none', borderRadius: 10, cursor: 'pointer', background: 'transparent', color: theme.navText, fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 13.5 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(207,123,76,0.14)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={it.icon}/></svg>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
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

export default function VistaLectura({ book, onGoBack, onGoCartelera, onGoForo }) {
  const [chapterIndex,   setChapterIndex]   = useState(0)
  const [pageIndex,      setPageIndex]      = useState(0)
  const [doubleView,     setDoubleView]     = useState(true)
  const [notebookOpen,   setNotebookOpen]   = useState(false)
  const [pendingChapter, setPendingChapter] = useState(null)

  // Preferencias de lectura (persistidas)
  const [fontSize,    setFontSize]    = useLocalStorage('inm_lector_fontSize', 19)
  const [readingFont, setReadingFont] = useLocalStorage('inm_lector_font', READING_FONT_DEFAULT)

  const [capitulos,  setCapitulos]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [loadingCap, setLoadingCap] = useState(false)
  const [error,      setError]      = useState(null)

  const [chapterCache,      setChapterCache]      = useState({})
  const [userId,            setUserId]            = useState(null)
  const [pendingRestore,    setPendingRestore]    = useState(null)
  const [pendingSelection,  setPendingSelection]  = useState(null)
  const restoredRef = useRef(false)

  const [geom, setGeom] = useState(() => computeGeom(true, fontSize, readingFont))
  useEffect(() => {
    const onResize = () => setGeom(computeGeom(doubleView, fontSize, readingFont))
    setGeom(computeGeom(doubleView, fontSize, readingFont))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [doubleView, fontSize, readingFont])
  const pagiOpts = useMemo(() => ({ charsPerLine: geom.charsPerLine, lineHeight: geom.lineHeight, maxH: geom.maxH }), [geom])

  // Estados para medición DOM (el useEffect va después de currentChapData)
  const [measuredHeights, setMeasuredHeights] = useState({})
  const [titleH,          setTitleH]          = useState(0)

  // ── Reseña ────────────────────────────────────────────────
  const [isLeido,       setIsLeido]       = useState(book?.leido ?? false)
  const [resenaOpen,    setResenaOpen]    = useState(false)
  const [resenaForm,    setResenaForm]    = useState({ rating: 0, texto: '' })
  const [resenaEnviando, setResenaEnviando] = useState(false)
  const [miResena,      setMiResena]      = useState(null)

  useEffect(() => {
    if (!userId || !book?.libro_id || !isLeido) return
    supabase.from('resenas_libros').select('rating, texto')
      .eq('user_id', userId).eq('libro_id', book.libro_id).maybeSingle()
      .then(({ data }) => {
        setMiResena(data || null)
        if (data) setResenaForm({ rating: data.rating, texto: data.texto || '' })
      })
  }, [userId, book?.libro_id, isLeido])

  async function submitResenaLector() {
    if (!resenaForm.rating) return
    if ((resenaForm.texto?.length ?? 0) > 1000) return
    setResenaEnviando(true)
    await supabase.from('resenas_libros').upsert(
      { user_id: userId, libro_id: book.libro_id, rating: resenaForm.rating, texto: resenaForm.texto || null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,libro_id' }
    )
    setMiResena({ rating: resenaForm.rating, texto: resenaForm.texto })
    setResenaOpen(false)
    setResenaEnviando(false)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null))
  }, [])

  useEffect(() => {
    if (!book?.libro_id) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      setLoading(true); setError(null); setChapterCache({})
      restoredRef.current = false; setPendingRestore(null)
      try {
        const { data: caps, error: e } = await supabase
          .from('capitulos').select('id, numero, titulo')
          .eq('libro_id', book.libro_id).order('numero')
        if (e) throw e
        if (!caps || caps.length === 0) throw new Error('Este libro no tiene capítulos cargados.')

        let startChapter = 0; let pendingParrafo = null
        if (userId) {
          const { data: prog } = await supabase.from('progreso_lectura')
            .select('ultimo_parrafo_id').eq('user_id', userId).eq('libro_id', book.libro_id).maybeSingle()
          if (prog?.ultimo_parrafo_id) {
            const { data: parr } = await supabase.from('parrafos')
              .select('capitulo_id').eq('id', prog.ultimo_parrafo_id).maybeSingle()
            if (parr?.capitulo_id) {
              const idx = caps.findIndex(c => c.id === parr.capitulo_id)
              if (idx >= 0) { startChapter = idx; pendingParrafo = prog.ultimo_parrafo_id }
            }
          }
        }

        if (cancelled) return
        setCapitulos(caps); setChapterIndex(startChapter); setPageIndex(0)
        setPendingRestore(pendingParrafo)
        if (!pendingParrafo) restoredRef.current = true
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [book?.libro_id, userId])

  async function fetchChapter(cap) {
    if (!cap) return null
    if (chapterCache[cap.id]) return chapterCache[cap.id]
    const [{ data: parrafos, error: e1 }, { data: mediaRows, error: e2 }] = await Promise.all([
      supabase.from('parrafos')
        .select('id, capitulo_id, numero, contenido, tipo, escena_tags, tiene_interactivo')
        .eq('capitulo_id', cap.id).order('numero'),
      supabase.from('media_por_parrafo')
        .select('parrafo_id, media_id, slug, tipo, url, titulo, descripcion, metadata, origen')
        .eq('capitulo_id', cap.id),
    ])
    if (e1) throw e1; if (e2) throw e2

    const mediaByParrafo = {}
    for (const m of (mediaRows || [])) {
      if (!mediaByParrafo[m.parrafo_id]) mediaByParrafo[m.parrafo_id] = []
      mediaByParrafo[m.parrafo_id].push(m)
    }
    const seen = new Set(); const ambients = []
    for (const p of (parrafos || [])) {
      for (const m of (mediaByParrafo[p.id] || [])) {
        if (m.origen === 'tag' && m.tipo === 'audio' && !seen.has(m.slug)) {
          seen.add(m.slug); ambients.push(m)
        }
      }
    }
    const entry = { parrafos: parrafos || [], mediaByParrafo, ambient: ambients[0] || null }
    setChapterCache(prev => ({ ...prev, [cap.id]: entry }))
    return entry
  }

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

  const playSfx = useCallback((mediaList) => {
    const m = mediaList[0]; if (!m?.url) return
    const a = new Audio(m.url); a.volume = 0.85; a.play().catch(() => {})
  }, [])

  const handleTextSelect = useCallback(({ text, parrafoId, rect }) => {
    setPendingSelection({ text, parrafoId, rect })
  }, [])

  async function handleSubrayar() {
    if (!pendingSelection || !userId || !book?.libro_id) return
    const cap = capitulos[chapterIndex]
    await supabase.from('subrayados_usuario').insert({
      user_id: userId, libro_id: book.libro_id,
      capitulo_num: cap?.numero ?? chapterIndex + 1,
      texto_original: pendingSelection.text,
      parrafo_id: pendingSelection.parrafoId || null,
    })
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
    setPendingChapter(next); setNotebookOpen(true)
  }, [chapterIndex, capitulos.length])

  const handleToggleView    = useCallback(() => setDoubleView(v => !v), [])
  const handleChapterSelect = useCallback((idx) => { setChapterIndex(idx); setPageIndex(0) }, [])
  async function handleCloseNotebook() {
    setNotebookOpen(false)
    if (pendingChapter !== null) {
      if (userId && book?.libro_id) {
        const newPct = Math.round((pendingChapter / capitulos.length) * 100)
        await supabase.from('progreso_lectura')
          .update({ porcentaje: newPct, updated_at: new Date().toISOString() })
          .eq('user_id', userId).eq('libro_id', book.libro_id).lt('porcentaje', newPct)
        if (newPct >= 90) {
          await supabase.from('bibliotecas_usuarios').update({ leido: true })
            .eq('user_id', userId).eq('libro_id', book.libro_id)
          setIsLeido(true)
        }
      }
      setChapterIndex(pendingChapter); setPageIndex(0); setPendingChapter(null)
    }
  }

  const menuItems = [
    { label: 'Cartelera', icon: 'M4 5h16M4 12h16M4 19h10', onClick: onGoCartelera },
    { label: 'Foro', icon: 'M4 5h16v10H9l-4 4V5z', onClick: onGoForo },
    ...(isLeido && book?.libro_id ? [{ label: 'Reseña', icon: 'M12 3l2.6 5.4L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.4-.6z', onClick: () => setResenaOpen(true) }] : []),
    { label: 'Biblioteca', icon: 'M5 4h5v16H5zM10 4h4v16h-4zM14 5l4 1-3 14-4-1', onClick: onGoBack },
  ]

  const msgStyle = { color: theme.subText, fontFamily: "'Special Elite',monospace", fontSize: 14, textAlign: 'center', padding: 60 }
  const halfBook = (doubleView ? (2 * geom.pageW + 20 + 14) : (geom.pageW + 7)) / 2

  return (
    <div className="desk" style={{ position: 'relative', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: theme.deskBg, fontFamily: "'Baloo 2', sans-serif" }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.vignette, pointerEvents: 'none', zIndex: 1 }} />

      {/* TOP BAR */}
      <header style={{ position: 'relative', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 24px 0' }}>
        <div style={{ background: theme.navBg, border: `2px solid ${theme.ink}`, borderRadius: 14, padding: '9px 15px', display: 'flex', alignItems: 'center', boxShadow: `1.5px 2px 0 ${theme.ink}22` }}>
          <img src="/assets/inmersia-logo.png" alt="Inmersia" style={{ height: 34, width: 'auto', display: 'block' }} />
        </div>
        <MenuButton items={menuItems} />
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
                  onTextSelect={handleTextSelect}
                  pageW={geom.pageW}
                  pageH={geom.pageH}
                  fontSize={fontSize}
                  readingFont={readingFont}
                  onFontSize={setFontSize}
                  onReadingFont={setReadingFont}
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
        <div style={{ position: 'relative', zIndex: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '8px 26px 18px', gap: 16 }}>
          <RecorderPlayer ambient={currentAmbient} />
          <button type="button" onClick={() => setNotebookOpen(true)} title="Abrir cuaderno de notas"
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
              <ClayButton variant="primary" disabled={!resenaForm.rating || resenaEnviando} onClick={submitResenaLector}>
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
            “{pendingSelection.text.length > 45 ? pendingSelection.text.slice(0, 45) + '…' : pendingSelection.text}”
          </span>
          <ClayButton variant="primary" onClick={handleSubrayar} style={{ padding: '5px 13px', fontSize: 12 }}>Subrayar</ClayButton>
        </div>
      )}
    </div>
  )
}
