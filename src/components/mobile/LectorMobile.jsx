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
// NO se duplica la lógica de negocio: reutiliza TAL CUAL el <Notebook> y el
// theme del Lector de escritorio. La paginación SÍ es propia de mobile
// (paginarParrafosMobileDOM), porque sus restricciones de alto/desborde difieren.
// Solo se replica el wiring de datos Supabase (capítulos,
// párrafos, media, progreso de lectura, subrayados), idéntico a Lector.jsx.
//
// Mismo contrato de props que Lector.jsx (VistaLectura):
//   { book, onGoBack, onGoCartelera, onGoForo, startWithNotebook, onNotebookStarted }
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useInvalidateBibliotecaUsuario } from '../../lib/queries.js'
import useLocalStorage from '../../hooks/useLocalStorage.js'
import { useLectorData } from '../../hooks/useLectorData.js'
import { useXrayItems } from '../../hooks/useXrayItems.js'
import { useSesionLectura } from '../../hooks/useSesionLectura.js'
import { useOnboarding } from '../../context/onboarding.jsx'
import { anotarMuestra } from '../../lib/progresoInvitado.js'
import { paginarParrafosMobileDOM } from '../../utils/lectorPaginationMobile.js'
import { offsetDeAnclaje, paginaDeAnclaje } from '../../utils/readerHelpers.js'
import { Notebook } from '../lector/Notebook.jsx'          // ← cuaderno REUTILIZADO (igual al de PC)
import { INK, ACCENT } from '../lector/clay.jsx'
import SuperuserSoundsPanel from '../lector/SuperuserSoundsPanel.jsx'
import { useAmbientPlayer } from '../../hooks/useAmbientPlayer.js'
import { useWhiteNoise } from '../../hooks/useWhiteNoise.js'
import { AMBIENTE_FICCION_ACTIVO } from '../lector/readerConstants.js'
import MobileBookPage from './lector/MobileBookPage.jsx'
import { XraySheet, ChapterSheet, TypoSheet, WhiteNoiseSheet, AudioSheet, NavSheet, ImageOverlay, FotoAsomada, ResenaSheet, ConfirmSubrayadoSheet } from './lector/LectorSheets.jsx'
import '../../styles/lector.mobile.css'

const READING_FONT_DEFAULT = "'Crimson Text', Georgia, serif"
const LINE = 1.72  // alto de línea (coincide con .lm-para en el CSS)
// Referencia estable para los capítulos sin subrayados: un [] nuevo en cada
// render invalidaría el memo de las páginas del libro.
const EMPTY_SUBRAYADOS = []

// ── Iconos lineales ──────────────────────────────────────────
const Compass = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><path d="M2 12h20"/>
  </svg>
)
const IcStar = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.6 5.4L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.4-.6z"/></svg>
)

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
function HighlighterIcon({ active }) {
  const bodyFill = active ? '#f9d96e' : ACCENT
  const lineFill = active ? '#f5e87a' : '#fbeed4'
  return (
    <span style={{ width: 48, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <rect x="5" y="3" width="24" height="15" rx="4" fill={bodyFill} stroke={INK} strokeWidth="2"/>
        <polygon points="5,18 29,18 22,30 12,30" fill="#c68f3a" stroke={INK} strokeWidth="2" strokeLinejoin="round"/>
        <rect x="1" y="31" width="32" height="4" rx="2" fill={lineFill} stroke={`${INK}66`} strokeWidth="1.5"/>
        <rect x="9" y="5" width="7" height="3" rx="1.5" fill="rgba(255,255,255,0.45)"/>
      </svg>
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function LectorMobile({ book, onGoBack, onGoCartelera, onGoForo, startWithNotebook, onNotebookStarted, isSuperuser = false, guestMode = false, muestraMotivo = 'invitado', onRequestAuth, onGoTienda, gatoColor = 'negro' }) {
  // ── Estado de navegación de lectura (UI) ──
  const [chapterIndex, setChapterIndex] = useState(0)
  const [pageIndex,    setPageIndex]    = useState(0)
  const [goToLastPage, setGoToLastPage] = useState(false)
  const [sheet,        setSheetRaw]     = useState(null)   // 'chapters' | 'typo' | 'audio' | 'nav'
  const [imageOpen,    setImageOpen]    = useState(false)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [catOpen,        setCatOpen]        = useState(false)

  useEffect(() => {
    if (!catOpen) return
    const handleOutside = (e) => { if (!e.target.closest('.lm-cat-dock')) setCatOpen(false) }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [catOpen])
  const [pendingChapter, setPendingChapter] = useState(null)
  const [adminPanelOpen, setAdminPanelOpen] = useState(false)
  const [showPaywall,    setShowPaywall]    = useState(false)

  // Lógica de datos compartida con el Lector de escritorio (ver src/hooks/useLectorData.js)
  const {
    userId, capitulos, chapterCache, loading, loadingCap, error,
    isLeido, setIsLeido, subrayadosPorCap, olvidarSubrayado,
    pendingRestore, setPendingRestore, restoredRef,
    setLoadingCap, setError,
    fetchChapter, peekChapter, playSfx, persistChapterAdvance, subrayar,
    quitarMedia, marcarMedia, sugerirMedia, borrarParrafo,
    miResena, resenaForm, setResenaForm, resenaEnviando, submitResena,
  } = useLectorData(book, setChapterIndex, setPageIndex, guestMode)

  // Modo muestra: se anota cuánto lleva leído el invitado para que la
  // adquisición lo rescate al registrarse (ver lib/progresoInvitado.js).
  useEffect(() => {
    if (guestMode) anotarMuestra(book?.libro_id, chapterIndex)
  }, [guestMode, chapterIndex, book?.libro_id])

  useSesionLectura(userId, book, guestMode)
  const invalidateBiblioteca = useInvalidateBibliotecaUsuario(userId)

  // Paywall: cerrar con Escape. Y si el invitado se autentica (guestMode pasa a
  // false) lo ocultamos para que no quede atascado encima del lector desbloqueado.
  useEffect(() => {
    if (!showPaywall) return
    const onKey = (e) => { if (e.key === 'Escape') setShowPaywall(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showPaywall])
  useEffect(() => { if (!guestMode) setShowPaywall(false) }, [guestMode])

  // Onboarding: durante el paso 'manual' del tutorial, el botón Explorar ni
  // siquiera aparece hasta llegar al capítulo 2 (el texto del manual lo anuncia
  // ahí), y cuando aparece su única salida es Investigación.
  const onboarding = useOnboarding()
  const tutorialManual = onboarding.active && onboarding.step === 'manual'
  const explorarVisible = !tutorialManual || chapterIndex >= 1
  const irCartelera = useCallback((itemId) => {
    if (tutorialManual) onboarding.advance('manual')   // manual → investigacion
    onGoCartelera(itemId)
  }, [tutorialManual, onboarding, onGoCartelera])

  // ── Reseña (UI) ──
  const [resenaOpen, setResenaOpen] = useState(false)

  // Preferencias de lectura (compartidas con el escritorio vía localStorage)
  const [fontSize,    setFontSize]    = useLocalStorage('inm_lector_fontSize', 16)
  const [readingFont, setReadingFont] = useLocalStorage('inm_lector_font', READING_FONT_DEFAULT)
  const [readingTheme, setReadingTheme] = useLocalStorage('inm_lector_theme', 'light')

  // ── Estado de UI no compartido ──
  const [modoSubrayado,  setModoSubrayado]  = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState(null)   // { text, parrafoId }
  const [segmentos,      setSegmentos]      = useState([])     // acumulado de páginas anteriores
  const [guardandoSub,   setGuardandoSub]   = useState(false)
  const selTimerRef   = useRef(null)
  const screenRef     = useRef(null)
  const pageAnchorRef = useRef(null)

  const setSheet   = (v) => { setSheetRaw(v); setCatOpen(false) }
  const openNotebook = () => { setNotebookOpen(true); setCatOpen(false) }

  // arranque directo en cuaderno (desde Biblioteca → "abrir cuaderno")
  useEffect(() => {
    if (startWithNotebook) { setNotebookOpen(true); onNotebookStarted?.() }
  }, [startWithNotebook])

  // cargar capítulo actual cuando cambia
  useEffect(() => {
    const cap = capitulos[chapterIndex]; if (!cap) return
    let cancelled = false
    ;(async () => {
      setError(null)
      try {
        // peekChapter mira el caché sin pedir nada, para no encender el
        // spinner en un capítulo ya cargado. Es estable, igual que
        // fetchChapter (ver el espejo en ref de useLectorData), así que este
        // efecto solo corre cuando cambia de verdad el capítulo.
        let entry = peekChapter(cap.id)
        if (!entry) { setLoadingCap(true); entry = await fetchChapter(cap) }
        if (cancelled || !entry) return
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoadingCap(false)
      }
    })()
    return () => { cancelled = true }
  }, [chapterIndex, capitulos, fetchChapter, peekChapter])

  const currentChapter  = capitulos[chapterIndex] || null
  const esNoficcion = book?.es_ficcion === false
  const xrayItems = useXrayItems(sheet === 'xray', book?.libro_id, currentChapter?.numero ?? chapterIndex + 1, esNoficcion ? 'glosario' : 'personajes')
  const currentChapData = currentChapter ? chapterCache[currentChapter.id] : null
  const currentMedia    = currentChapData?.mediaByParrafo || {}
  const currentAmbient  = currentChapData?.ambient || null
  const currentCapNum   = currentChapter?.numero ?? chapterIndex + 1
  // Solo los textos: es lo que necesita el render para anclar la marca.
  const currentSubrayados = useMemo(
    () => (subrayadosPorCap[currentCapNum] || EMPTY_SUBRAYADOS).map(s => s.texto),
    [subrayadosPorCap, currentCapNum])
  const { playing: ambientPlaying, volume: ambientVol, toggle: toggleAmbient, setVol } = useAmbientPlayer(currentAmbient?.url)
  // Ruido ambiental (no ficción): el hook vive aquí —no dentro del sheet— para
  // que el sonido siga al cerrar el sheet y solo pare al salir del lector o al
  // apagarlo en el panel. Inerte hasta que el usuario lo activa.
  const whiteNoise = useWhiteNoise()

  // ── Paginación a prueba de fallos (medida del DOM real) ──
  // No estimamos: paginarParrafosMobileDOM maqueta el texto en un contenedor
  // oculto y corta donde el offsetHeight real supera el alto disponible, así una
  // página NUNCA desborda. `paginas` es estado (no memo) porque la cómputa un
  // efecto que toca el DOM. `paginadoChap` = id del capítulo ya paginado: la
  // restauración de progreso espera a que la paginación de ESTE capítulo exista.
  const [paginas,      setPaginas]      = useState([[]])
  const [paginadoChap, setPaginadoChap] = useState(null)

  // ── Geometría de página (medida del DOM) ──
  const [geom, setGeom] = useState({ lineHeight: Math.round(19*LINE), maxH: 480, titleH: 90 })
  const measureGeom = useCallback(() => {
    const box = screenRef.current?.querySelector('[data-lm-pagebox]')
    if (!box) return
    const cs = window.getComputedStyle(box)
    const padBottom = parseFloat(cs.paddingBottom)
    const padY    = parseFloat(cs.paddingTop) + padBottom
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

    // Alto ESTABLE entre aperturas: .lm-screen es fixed/inset:0, así que la
    // caja hereda el viewport del momento — y la barra de URL móvil lo cambia
    // (colapsada ≈ +60-100px vs visible). Cada apertura media distinto → otra
    // paginación → los números de página bailaban. Referimos siempre al
    // viewport pequeño (100svh = barra visible, constante) descontando el
    // exceso cuando la barra está colapsada; si svh no está soportado, la
    // sonda mide 0 y no se descuenta nada (comportamiento previo).
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)
    const svh = probe.offsetHeight
    document.body.removeChild(probe)
    if (svh > 0) contentH -= Math.max(0, window.innerHeight - svh)

    contentH = Math.max(160, contentH)
    const lineHeight = Math.round(fontSize * LINE)
    const titleH = Math.round(fontSize * 0.6) + Math.round(fontSize * 1.55 * 1.25) + 38
    setGeom(g => {
      if (g.lineHeight === lineHeight && Math.abs(g.maxH - contentH) < 2 && g.titleH === titleH) return g
      return { lineHeight, maxH: contentH, titleH }
    })
  }, [fontSize])

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
    // orientationchange dispara ANTES de que el layout se actualice; reseteamos
    // lastW para que el resize posterior forzosamente remida aunque el ancho
    // coincida (algunos browsers envían valores intermedios durante la animación).
    const onOrient = () => { lastW = -1; clearTimeout(timer); timer = setTimeout(measureGeom, 400) }
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', onOrient)
    return () => { clearTimeout(timer); window.removeEventListener('resize', on); window.removeEventListener('orientationchange', onOrient) }
  }, [measureGeom])

  // ── Paginación a prueba de fallos (maqueta el DOM real y corta donde toca) ──
  // Lee el ancho de texto real de la hoja, lo pasa a paginarParrafosMobileDOM y
  // guarda el resultado en estado. Se re-ejecuta cuando cambian capítulo, fuente
  // o geometría. Antes de medir espera SOLO las caras de fuente que la medición
  // usa (lectura normal/itálica + Playfair del encabezado): así se pagina UNA
  // vez con métricas definitivas, en vez de paginar con la fuente de respaldo
  // y repaginar en fonts.ready — que hacía que el número de página saltara y
  // difiriera entre aperturas según el estado de la caché de fuentes.
  const measuredReady = paginadoChap === currentChapter?.id

  useEffect(() => {
    const parrafos = currentChapData?.parrafos
    if (!parrafos?.length || !currentChapter) { setPaginas([[]]); setPaginadoChap(null); return }
    const box = screenRef.current?.querySelector('[data-lm-pagebox]')
    if (!box) return
    const cs   = window.getComputedStyle(box)
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    const contentW = Math.max(120, box.clientWidth - padX)
    const chapId   = currentChapter.id
    let cancelled  = false

    const paginar = () => {
      if (cancelled) return
      const pages = paginarParrafosMobileDOM(parrafos, {
        contentW,
        maxH: geom.maxH,
        fontSize,
        readingFont,
        lineHeightRatio: LINE,
        lineHeight: geom.lineHeight,
        chapterHead: { kicker: `Capítulo ${currentChapter.numero ?? ''}`, titulo: currentChapter.titulo || '' },
      })
      if (cancelled) return
      setPaginas(pages)
      setPaginadoChap(chapId)
    }

    ;(async () => {
      if (document.fonts?.load) {
        await Promise.all([
          document.fonts.load(`${fontSize}px ${readingFont}`),
          document.fonts.load(`italic ${fontSize}px ${readingFont}`),
          document.fonts.load(`${Math.round(fontSize * 0.6)}px 'Playfair Display'`),
          document.fonts.load(`700 ${Math.round(fontSize * 1.55)}px 'Playfair Display'`),
        ]).catch(() => {})
      }
      paginar()
    })()
    return () => { cancelled = true }
  }, [currentChapData?.parrafos, currentChapter?.id, fontSize, readingFont, geom.maxH, geom.lineHeight])

  // restaurar página exacta al volver.
  // Espera a que la paginación DEFINITIVA (medida) esté lista: con la paginación
  // transitoria los límites de página difieren y restaurábamos mal (o nos
  // rendíamos dejando al lector en la página 0 = inicio del capítulo).
  // El ancla es { parrafoId, offset }: el primer párrafo visible de la página
  // donde quedó el usuario y en qué carácter del párrafo empieza su fragmento;
  // paginaDeAnclaje localiza la página que cubre ese punto del texto (ver
  // comentario equivalente en Lector.jsx).
  useEffect(() => {
    if (!pendingRestore || !currentChapData || !measuredReady) return
    const idx = paginaDeAnclaje(paginas, pendingRestore.parrafoId, pendingRestore.offset)
    if (idx >= 0) setPageIndex(idx)
    setPendingRestore(null); restoredRef.current = true
    setGoToLastPage(false)
  }, [pendingRestore, currentChapData, paginas, measuredReady])

  // al navegar hacia atrás entre capítulos, esperar la paginación real del DOM
  // para saltar a la última página correcta del capítulo anterior
  useEffect(() => {
    if (!goToLastPage) return
    if (paginadoChap !== currentChapter?.id) return
    const last = paginas.length - 1
    if (last < 0) return
    setPageIndex(last)
    setGoToLastPage(false)
  }, [goToLastPage, paginas, paginadoChap, currentChapter?.id])

  // preservar párrafo visible cuando la geometría cambia (e.g. URL bar móvil)
  useEffect(() => {
    if (pendingRestore) return
    if (pageAnchorRef.current) {
      const newIdx = paginaDeAnclaje(paginas, pageAnchorRef.current.parrafoId, pageAnchorRef.current.offset)
      if (newIdx >= 0) { if (newIdx !== pageIndex) setPageIndex(newIdx); return }
    }
    if (pageIndex >= paginas.length) setPageIndex(Math.max(0, paginas.length - 1))
  }, [paginas]) // eslint-disable-line react-hooks/exhaustive-deps

  // mantener ancla actualizada tras cada navegación del usuario
  useEffect(() => {
    const p = paginas[pageIndex]?.[0]
    if (p) pageAnchorRef.current = { parrafoId: p.id, offset: offsetDeAnclaje(paginas, pageIndex, p.id) }
  }, [pageIndex, paginas])

  // ── Guardar progreso (debounce) ──
  useEffect(() => {
    if (!restoredRef.current || !userId || !book?.libro_id || !currentChapData) return
    const firstParr = paginas[pageIndex]?.[0]; if (!firstParr) return
    const t = setTimeout(() => {
      supabase.from('progreso_lectura').upsert({
        user_id: userId, libro_id: book.libro_id,
        ultimo_parrafo_id: firstParr.id,
        ultimo_parrafo_offset: offsetDeAnclaje(paginas, pageIndex, firstParr.id),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,libro_id' }).then(({ error }) => { if (error) console.error('No se pudo guardar el progreso de lectura:', error) })
    }, 600)
    return () => clearTimeout(t)
  }, [chapterIndex, pageIndex, paginas, userId, book?.libro_id, currentChapData])

  // 100% al llegar al final del último capítulo
  useEffect(() => {
    if (!restoredRef.current || !userId || !book?.libro_id) return
    if (!capitulos.length || chapterIndex !== capitulos.length - 1) return
    if (!paginas.length || pageIndex < paginas.length - 1) return
    const t = setTimeout(async () => {
      await Promise.all([
        supabase.from('progreso_lectura').update({ porcentaje: 100, updated_at: new Date().toISOString() })
          .eq('user_id', userId).eq('libro_id', book.libro_id),
        supabase.from('bibliotecas_usuarios').update({ leido: true })
          .eq('user_id', userId).eq('libro_id', book.libro_id),
      ])
      setIsLeido(true)
      invalidateBiblioteca()
    }, 600)
    return () => clearTimeout(t)
  }, [chapterIndex, pageIndex, paginas.length, capitulos.length, userId, book?.libro_id])

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

  // La imagen NO se abre sola: espera en <FotoAsomada>, abajo, hasta que la
  // toquen. Antes irrumpía a pantalla completa al llegar a su página —cortando
  // la lectura justo donde el lector estaba metido— y hubo que darle una
  // preferencia para apagarla; quitado el automatismo, la preferencia sobra.

  // ── Navegación de páginas ──
  const total = paginas.length
  const atStart = chapterIndex === 0 && pageIndex === 0
  const atEndOfBook = chapterIndex === capitulos.length - 1 && pageIndex >= total - 1
  const atChapterEnd = pageIndex >= total - 1

  function handlePrev() {
    setCatOpen(false)
    if (pageIndex > 0) { setPageIndex(p => p - 1); return }
    if (chapterIndex > 0) {
      const prevCap = capitulos[chapterIndex - 1]
      const prevEntry = chapterCache[prevCap.id]
      setChapterIndex(chapterIndex - 1)
      if (prevEntry) {
        // Capítulo cacheado: paginar sincrónicamente para saltar a la última página
        const box = screenRef.current?.querySelector('[data-lm-pagebox]')
        const cs  = box ? window.getComputedStyle(box) : null
        const padX = cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : 60
        const contentW = box ? Math.max(120, box.clientWidth - padX) : 320
        const prevPages = paginarParrafosMobileDOM(prevEntry.parrafos, {
          contentW, maxH: geom.maxH, fontSize, readingFont, lineHeightRatio: LINE, lineHeight: geom.lineHeight,
          chapterHead: { kicker: `Capítulo ${prevCap?.numero ?? ''}`, titulo: prevCap?.titulo || '' },
        })
        setPageIndex(Math.max(0, prevPages.length - 1))
      } else {
        // Capítulo no cacheado: flag para saltar a la última página cuando cargue
        setGoToLastPage(true)
      }
    }
  }
  function handleNext() {
    setCatOpen(false)
    if (pageIndex < total - 1) { setPageIndex(p => p + 1); return }
    // fin del capítulo → abrir cuaderno antes de avanzar (igual que el escritorio)
    if (chapterIndex < capitulos.length - 1) {
      if (guestMode) { setChapterIndex(chapterIndex + 1); setPageIndex(0); return }
      setPendingChapter(chapterIndex + 1); setNotebookOpen(true)
      return
    }
    if (guestMode) { anotarMuestra(book?.libro_id, chapterIndex + 1); setShowPaywall(true) }
  }
  function pickChapter(i) { setChapterIndex(i); setPageIndex(0); setSheet(null); setGoToLastPage(false) }

  // ── Cuaderno: al cerrar, persistir avance de capítulo si venía de "fin de capítulo" ──
  async function handleSubmitResena() {
    if (await submitResena()) setResenaOpen(false)
  }

  async function handleCloseNotebook() {
    setNotebookOpen(false)
    if (pendingChapter !== null) {
      await persistChapterAdvance(pendingChapter)
      setGoToLastPage(false)
      setChapterIndex(pendingChapter); setPageIndex(0); setPendingChapter(null)
    }
  }

  // ── Modo subrayado mobile ──
  useEffect(() => {
    if (!modoSubrayado || pendingConfirm) return
    function onSelChange() {
      clearTimeout(selTimerRef.current)
      selTimerRef.current = setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || !sel.toString().trim()) return
        const bookBox = screenRef.current?.querySelector('[data-lm-pagebox]')
        if (!bookBox?.contains(sel.anchorNode)) return
        const text = sel.toString().trim()
        const parrafoId = sel.anchorNode?.parentElement?.closest('[data-parrafo-id]')?.dataset?.parrafoId || null
        window.getSelection()?.removeAllRanges()
        setPendingConfirm({ text, parrafoId })
      }, 1500) // 1.5s: tiempo para arrastrar los handles de Chrome; al capturar, limpia la selección para restaurar la navegación
    }
    document.addEventListener('selectionchange', onSelChange)
    return () => { document.removeEventListener('selectionchange', onSelChange); clearTimeout(selTimerRef.current) }
  }, [modoSubrayado, pendingConfirm])

  function activarModoSubrayado() {
    const activating = !modoSubrayado
    setModoSubrayado(activating)
    if (!activating) { setSegmentos([]); setPendingConfirm(null); window.getSelection()?.removeAllRanges() }
    setCatOpen(false)
  }
  function descartarSubrayado() {
    setModoSubrayado(false); setSegmentos([]); setPendingConfirm(null)
    window.getSelection()?.removeAllRanges()
  }
  function continuarSiguientePagina() {
    setSegmentos(prev => [...prev, pendingConfirm])
    setPendingConfirm(null)
    window.getSelection()?.removeAllRanges()
    // Con las flechas ocultas durante el subrayado, este botón también hace de "siguiente página".
    if (pageIndex < total - 1) setPageIndex(p => p + 1)
  }
  async function guardarSubrayado() {
    if (!userId || !book?.libro_id) return
    setGuardandoSub(true)
    try {
      const todos = [...segmentos, pendingConfirm]
      await subrayar(todos.map(s => s.text).join(' '), todos[0].parrafoId, chapterIndex)
    } finally {
      setGuardandoSub(false); setModoSubrayado(false); setSegmentos([]); setPendingConfirm(null)
      window.getSelection()?.removeAllRanges()
    }
  }

  const CAT_ITEMS = [
    // Audio: en ficción está oculto (ver AMBIENTE_FICCION_ACTIVO); en no ficción
    // abre el ruido ambiental.
    ...(esNoficcion || AMBIENTE_FICCION_ACTIVO ? [{ key: 'audio', label: 'Audio', icon: <CassetteIcon />, act: () => setSheet('audio') }] : []),
    ...(!guestMode ? [{ key: 'cuaderno', label: 'Cuaderno', icon: <SpiralNotebookIcon />, act: openNotebook }] : []),
    ...(!guestMode ? [{ key: 'subrayar', label: modoSubrayado ? 'Apagar ✏' : 'Subrayar', icon: <HighlighterIcon active={modoSubrayado} />, act: activarModoSubrayado }] : []),
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
        {guestMode ? (
          <button type="button" className="lm-explore lm-create-account-btn" onClick={() => onRequestAuth?.('registro')} title="Crear cuenta">
            Crear cuenta
          </button>
        ) : explorarVisible && (
          <button className="lm-explore" onClick={() => setSheet('nav')} title="Explorar"><Compass /></button>
        )}
        {isLeido && book?.libro_id && (
          <button className="lm-explore lm-resena-btn" onClick={() => { setSheetRaw(null); setCatOpen(false); setResenaOpen(true) }} title="Escribir reseña" aria-label="Escribir reseña"><IcStar /></button>
        )}
        {isSuperuser && !loading && !error && book?.libro_id && (
          <button className="lm-explore" onClick={() => setAdminPanelOpen(v => !v)} title="Panel de media" style={{ fontSize: 14, fontWeight: 700, background: adminPanelOpen ? '#8b4d2a' : undefined, color: adminPanelOpen ? '#fff' : undefined }}>⚙</button>
        )}
      </header>

      {/* Controles */}
      <div className="lm-controls">
        <button className="lm-ctrl cap" onClick={() => { if (!tutorialManual) setSheet('chapters') }}
          disabled={tutorialManual} title={tutorialManual ? 'Durante el tutorial la lectura es en orden' : undefined}
          style={tutorialManual ? { opacity: 0.55 } : undefined}>
          <span className="lm-ctrl-label">Cap. {currentChapter?.numero ?? chapterIndex + 1}{currentChapter?.titulo ? ` · ${currentChapter.titulo}` : ''}</span>
          <span className="chev">{tutorialManual ? '🔒' : '▼'}</span>
        </button>
        <button className="lm-ctrl xray" onClick={() => setSheet('xray')} title="X-ray">X-ray</button>
        <button className="lm-ctrl typo" onClick={() => setSheet('typo')} title="Texto">
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
            : <MobileBookPage
                chapter={currentChapter} chapterIndex={chapterIndex}
                parrafos={page} mediaByParrafo={currentMedia} subrayados={currentSubrayados}
                isFirst={pageIndex===0} pageNum={pageIndex+1}
                fontSize={fontSize} font={readingFont}
                atStart={atStart} nextIsChapter={atChapterEnd && !atEndOfBook}
                onPrev={handlePrev}
                onNext={atEndOfBook && !guestMode ? undefined : handleNext}
                hideArrows={modoSubrayado}
                onPlaySfx={playSfx}
              />
        )}

        {/* Mascota (gato) + bandeja horizontal de herramientas */}
        {!loading && !error && book?.libro_id && (
          <div className="lm-cat-dock">
            <button className="lm-cat-btn" onClick={() => setCatOpen(o => !o)} title="Herramientas" aria-label="Herramientas">
              <img className="lm-cat-img" src={`/assets/lector/gato-${gatoColor}-6.webp`} alt="Mascota de Inmersia" onLoad={measureGeom} />
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
            {/* Al final del dock y solo con la bandeja CERRADA: las herramientas
                se abren hacia la derecha y ocupan esta misma franja, así que la
                foto se retira mientras dure y vuelve al cerrarla — la bandeja no
                pierde ancho y los botones no se aprietan.
                Se muestra la última imagen revelada; si hay varias, el visor las
                lista todas en sus miniaturas. */}
            {!catOpen && (
              <FotoAsomada image={visibleImages[visibleImages.length - 1]} onOpen={() => setImageOpen(true)} />
            )}
          </div>
        )}

        {/* Banner de modo subrayado */}
        {modoSubrayado && !pendingConfirm && (
          <div className="lm-sub-banner">
            <span>
              {segmentos.length > 0
                ? `${segmentos.length} segmento${segmentos.length > 1 ? 's' : ''} · selecciona el siguiente`
                : '✏ Selecciona el texto a subrayar'}
            </span>
            <button onClick={descartarSubrayado}>&#x2715;</button>
          </div>
        )}

      </div>

      {/* Sheet de confirmación de subrayado */}
      {pendingConfirm && (
        <ConfirmSubrayadoSheet
          segmentos={segmentos}
          pendingConfirm={pendingConfirm}
          onDescartar={descartarSubrayado}
          onContinuar={continuarSiguientePagina}
          onGuardar={guardarSubrayado}
          guardando={guardandoSub}
        />
      )}

      {/* Sheets */}
      {sheet==='xray'     && <XraySheet items={xrayItems} chapterNum={currentChapter?.numero ?? chapterIndex + 1} esNoficcion={esNoficcion} bloqueado={onboarding.active} onClose={() => setSheet(null)} onItemClick={(itemId) => { setSheet(null); irCartelera(itemId) }} />}
      {sheet==='chapters' && <ChapterSheet chapters={capitulos} current={chapterIndex} onPick={pickChapter} onClose={()=>setSheet(null)} />}
      {sheet==='typo' && <TypoSheet fontSize={fontSize} onFontSize={setFontSize} readingFont={readingFont} onReadingFont={setReadingFont} readingTheme={readingTheme} onReadingTheme={setReadingTheme} onClose={()=>setSheet(null)} />}
      {sheet==='audio' && (book?.es_ficcion === false
        ? <WhiteNoiseSheet noise={whiteNoise} onClose={() => setSheet(null)} />
        : <AudioSheet ambient={currentAmbient} playing={ambientPlaying} volume={ambientVol} onToggle={toggleAmbient} onVolume={setVol} onClose={() => setSheet(null)} />
      )}
      {sheet==='nav' && <NavSheet onGoForo={onGoForo} onGoCartelera={irCartelera} onGoBiblioteca={onGoBack} onClose={()=>setSheet(null)} soloInvestigacion={tutorialManual} />}

      {/* Overlay imagen */}
      {imageOpen && <ImageOverlay images={visibleImages} chapter={currentChapter} chapterIndex={chapterIndex} onClose={()=>setImageOpen(false)} esNoficcion={esNoficcion} />}

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
        gatoColor={gatoColor}
        onSubrayadoBorrado={olvidarSubrayado}
      />

      {/* Paywall de invitado */}
      {showPaywall && (
        <div onClick={() => setShowPaywall(false)} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(20,12,4,0.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 20, padding: '36px 32px', maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '3px 6px 0 rgba(74,54,34,0.25), 0 20px 40px rgba(0,0,0,0.35)' }}>
            <button type="button" onClick={() => setShowPaywall(false)} aria-label="Cerrar" title="Cerrar"
              style={{ position: 'absolute', top: 10, right: 12, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1.5px solid rgba(74,54,34,0.3)', color: '#9a6a4a', borderRadius: '50%', cursor: 'pointer', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 20, lineHeight: 1 }}>×</button>
            <img src="/assets/inmersia-logo.png" alt="Inmersia" style={{ display: 'block', height: 40, width: 'auto', margin: '0 auto 16px' }} />
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: '#2c1a0e', margin: '0 0 10px' }}>
              {muestraMotivo === 'sin-adquirir' ? 'Suma este libro a tu biblioteca' : 'Sigue leyendo en Inmersia'}
            </h2>
            <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 14, color: '#6b4c34', lineHeight: 1.55, margin: '0 0 24px' }}>
              {muestraMotivo === 'sin-adquirir' ? (
                <>Ya leíste los dos capítulos de muestra.<br />Agrégalo desde la Tienda para continuar.</>
              ) : (
                <>Ya leíste los dos capítulos de muestra.<br />Crea tu cuenta gratis para continuar.</>
              )}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {muestraMotivo === 'sin-adquirir' ? (
                <>
                  <button type="button" onClick={() => onGoTienda?.()}
                    style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#F2792A', color: '#fff', border: '2px solid #4a3622', borderRadius: 999, padding: '10px 20px', boxShadow: '2px 3px 0 rgba(74,54,34,0.4)' }}>
                    Ir a la Tienda
                  </button>
                  <button type="button" onClick={() => onGoBack?.()}
                    style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#ffffff', color: '#000', border: '2px solid #4a3622', borderRadius: 999, padding: '10px 20px', boxShadow: '2px 3px 0 rgba(74,54,34,0.25)' }}>
                    Volver a mi biblioteca
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => onRequestAuth?.('registro')}
                    style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#F2792A', color: '#fff', border: '2px solid #4a3622', borderRadius: 999, padding: '10px 20px', boxShadow: '2px 3px 0 rgba(74,54,34,0.4)' }}>
                    Crear cuenta
                  </button>
                  <button type="button" onClick={() => onRequestAuth?.('login')}
                    style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#ffffff', color: '#000', border: '2px solid #4a3622', borderRadius: 999, padding: '10px 20px', boxShadow: '2px 3px 0 rgba(74,54,34,0.25)' }}>
                    Iniciar sesión
                  </button>
                </>
              )}
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
