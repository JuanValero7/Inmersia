// src/hooks/useLectorComun.js
// ─────────────────────────────────────────────────────────────
// Lo que el lector de escritorio (Lector.jsx) y el de móvil (LectorMobile.jsx)
// hacen IGUAL. Antes estaba copiado en los dos y ya habían empezado a divergir
// (la pista "Ver mi investigación" se saltaba el tutorial solo en escritorio).
// Un arreglo aquí vale para los dos.
//
//   useLectorComun     estado de navegación, datos (useLectorData), modo
//                      muestra y su muro, puerta del tutorial, preferencias de
//                      lectura, capítulo actual + precarga del siguiente,
//                      reseña, cuaderno y tira de predicción.
//   useGuardarProgreso dónde va (cada página) y libro terminado (última página
//                      del último capítulo). Se llama DESPUÉS de paginar.
//
// Lo que NO está aquí, a propósito: la paginación (lectorPagination*.js) y la
// restauración de página, la geometría, la navegación y toda la maquetación.
// Eso es distinto en cada uno y es la razón de que haya dos archivos.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { useInvalidateBibliotecaUsuario } from '../lib/queries.js'
import { guardar, guardarTodo, AVISOS } from '../lib/guardar.js'
import { anotarMuestra, anotarPosicion } from '../lib/progresoInvitado.js'
import { MANUAL_LIBRO_ID } from '../lib/constants.js'
import { offsetDeAnclaje } from '../utils/readerHelpers.js'
import { useOnboarding } from '../context/onboarding.jsx'
import { usePistas } from '../context/pistas.jsx'
import useLocalStorage from './useLocalStorage.js'
import { useLectorData } from './useLectorData.js'
import { useWhiteNoise } from './useWhiteNoise.js'
import { useSesionLectura } from './useSesionLectura.js'

export const READING_FONT_DEFAULT = "'Crimson Text', Georgia, serif"
const EMPTY_SUBRAYADOS = []
const EMPTY_MEDIA = {}

/**
 * @param {object} p
 * @param {object} p.book
 * @param {boolean} p.guestMode              muestra: invitado o libro sin adquirir
 * @param {boolean} p.startWithNotebook
 * @param {() => void} [p.onNotebookStarted]
 * @param {(itemId?: string) => void} p.onGoCartelera
 */
export function useLectorComun({ book, guestMode, startWithNotebook, onNotebookStarted, onGoCartelera }) {
  // ── Navegación y capas ──
  const [chapterIndex, setChapterIndex] = useState(0)
  const [pageIndex,    setPageIndex]    = useState(0)
  const [goToLastPage, setGoToLastPage] = useState(false)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [resenaOpen,   setResenaOpen]   = useState(false)
  const [adminPanelOpen, setAdminPanelOpen] = useState(false)
  const [showPaywall,  setShowPaywall]  = useState(false)
  // Capítulo cuya tira de predicción ya se cerró (con × o al anotar).
  const [tiraCerrada,  setTiraCerrada]  = useState(null)

  const datos = useLectorData(book, setChapterIndex, setPageIndex, guestMode)
  const { userId, capitulos, chapterCache, subrayadosPorCap, setError, setLoadingCap,
    fetchChapter, peekChapter, precargarSiguiente, playSfx, submitResena } = datos

  useSesionLectura(userId, book, guestMode)

  // Modo muestra: se anota cuánto lleva leído el invitado para que la
  // adquisición lo rescate al entrar (ver lib/progresoInvitado.js).
  useEffect(() => {
    if (guestMode) anotarMuestra(book?.libro_id, chapterIndex)
  }, [guestMode, chapterIndex, book?.libro_id])

  // Muro: se cierra con Escape. Y si entra (guestMode pasa a false) se oculta
  // para que no quede atascado encima del lector desbloqueado.
  useEffect(() => {
    if (!showPaywall) return
    const onKey = (e) => { if (e.key === 'Escape') setShowPaywall(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showPaywall])
  useEffect(() => { if (!guestMode) setShowPaywall(false) }, [guestMode])

  // Onboarding: durante el paso 'manual' del tutorial, Explorar ni siquiera
  // aparece hasta llegar al capítulo 2 (el texto del manual lo anuncia ahí), y
  // cuando aparece su única salida es Investigación.
  const onboarding = useOnboarding()
  const tutorialManual = onboarding.active && onboarding.step === 'manual'
  const explorarVisible = !tutorialManual || chapterIndex >= 1
  const [manualHintVisto, setManualHintVisto] = useState(false)
  const irCartelera = useCallback((itemId) => {
    if (tutorialManual) onboarding.advance('manual')   // manual → investigacion
    onGoCartelera(itemId)
  }, [tutorialManual, onboarding, onGoCartelera])

  // Arranque directo en el cuaderno (desde Biblioteca → "abrir cuaderno").
  useEffect(() => {
    if (startWithNotebook) { setNotebookOpen(true); onNotebookStarted?.() }
  }, [startWithNotebook, onNotebookStarted])

  // Ruido ambiental (no ficción): vive aquí —no en el panel— para que siga
  // sonando al cerrarlo y solo pare al salir del lector o al apagarlo.
  const whiteNoise = useWhiteNoise()

  // Preferencias de lectura, compartidas entre escritorio y móvil.
  const [fontSize,     setFontSize]     = useLocalStorage('inm_lector_fontSize', 16)
  const [readingFont,  setReadingFont]  = useLocalStorage('inm_lector_font', READING_FONT_DEFAULT)
  const [readingTheme, setReadingTheme] = useLocalStorage('inm_lector_theme', 'light')
  // Cómo se ve el progreso en el pie: 'pagina' (como siempre), 'capitulo' o 'libro'.
  const [modoProgreso, setModoProgreso] = useLocalStorage('inm_lector_progreso', 'pagina')

  // ── Capítulo actual ──
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
  }, [chapterIndex, capitulos, fetchChapter, peekChapter, setError, setLoadingCap])

  // Con el capítulo actual ya en pantalla, se trae el siguiente en segundo
  // plano para que pasar de capítulo no espere a la red.
  const capituloCargado = !!(capitulos[chapterIndex] && chapterCache[capitulos[chapterIndex].id])
  useEffect(() => {
    if (!capituloCargado) return
    return precargarSiguiente(chapterIndex)
  }, [capituloCargado, chapterIndex, precargarSiguiente])

  const currentChapter  = capitulos[chapterIndex] || null
  const currentChapData = currentChapter ? chapterCache[currentChapter.id] : null
  const currentMedia    = currentChapData?.mediaByParrafo || EMPTY_MEDIA
  const currentAmbient  = currentChapData?.ambient || null
  const currentCapNum   = currentChapter?.numero ?? chapterIndex + 1
  // Solo los textos: es lo que necesita el render para anclar la marca.
  const currentSubrayados = useMemo(
    () => (subrayadosPorCap[currentCapNum] || EMPTY_SUBRAYADOS).map(s => s.texto),
    [subrayadosPorCap, currentCapNum])

  // ── Reseña, cuaderno, sonidos ──
  async function handleSubmitResena() {
    if (await submitResena()) setResenaOpen(false)
  }
  const handleCloseNotebook = () => setNotebookOpen(false)
  // Desde la tira el Cuaderno se abre en el capítulo que se está terminando
  // (todavía es el actual) y la tira de ese capítulo ya no vuelve a salir.
  function anotarDesdeTira() {
    setTiraCerrada(chapterIndex)
    setNotebookOpen(true)
  }
  const pistas = usePistas()
  const marcarPista = pistas.marcar   // estable (useCallback del controlador)
  // Sonido: tocar un texto que suena ya cuenta como haber visto su pista.
  const tocarSfx = useCallback((m) => { marcarPista('sonido'); playSfx(m) }, [marcarPista, playSfx])

  const esManual = book?.libro_id === MANUAL_LIBRO_ID
  // Tira de predicción: en la ÚLTIMA página de cada capítulo, antes de pasar al
  // siguiente. No en la muestra, ni en el Manual, ni en el último capítulo.
  // Avanzar no la espera: el siguiente toque pasa de capítulo. `finDeCapitulo`
  // lo sabe cada lector, según su paginación.
  const tiraSi = (finDeCapitulo) =>
    !guestMode && !esManual && !datos.loading && finDeCapitulo
      && chapterIndex < capitulos.length - 1 && tiraCerrada !== chapterIndex
      ? { capNum: capitulos[chapterIndex]?.numero ?? chapterIndex + 1 }
      : null

  return {
    ...datos,
    chapterIndex, setChapterIndex, pageIndex, setPageIndex, goToLastPage, setGoToLastPage,
    notebookOpen, setNotebookOpen, resenaOpen, setResenaOpen, adminPanelOpen, setAdminPanelOpen,
    showPaywall, setShowPaywall, setTiraCerrada,
    onboarding, tutorialManual, explorarVisible, manualHintVisto, setManualHintVisto, irCartelera,
    whiteNoise,
    fontSize, setFontSize, readingFont, setReadingFont, readingTheme, setReadingTheme, modoProgreso, setModoProgreso,
    capituloCargado, currentChapter, currentChapData, currentMedia, currentAmbient, currentCapNum, currentSubrayados,
    handleSubmitResena, handleCloseNotebook, anotarDesdeTira,
    pistas, marcarPista, tocarSfx, esManual, tiraSi,
  }
}

/**
 * Guarda dónde va el lector y marca el libro como terminado. Se llama después
 * de paginar: necesita las páginas del capítulo actual.
 *
 * @param {ReturnType<typeof useLectorComun> & { book: object, guestMode: boolean }} lector
 * @param {Array<Array<{id: string}>>} paginas   páginas del capítulo actual
 * @param {boolean} esUltimaPagina   en la última página del capítulo (en doble
 *                                   página, la de la derecha)
 */
export function useGuardarProgreso(lector, paginas, esUltimaPagina) {
  const { book, guestMode, userId, capitulos, chapterIndex, pageIndex,
    restoredRef, capituloCargado, recordarPosicion, setIsLeido } = lector
  const invalidateBiblioteca = useInvalidateBibliotecaUsuario(userId)

  // Dónde va (debounce). Depende de `capituloCargado` y no del objeto del
  // capítulo: ese se recrea cuando llegan sus sonidos e imágenes, y eso
  // dispararía una escritura extra. Sin sesión no hay fila de progreso: la
  // posición se anota para que, si entra desde el muro, siga en esta misma
  // página (ver lib/rescatarMuestra.js).
  useEffect(() => {
    if (!restoredRef.current || !book?.libro_id || !capituloCargado) return
    if (!userId && !guestMode) return
    const firstParr = paginas[pageIndex]?.[0]; if (!firstParr) return
    const offset = offsetDeAnclaje(paginas, pageIndex, firstParr.id)
    recordarPosicion(chapterIndex, firstParr.id, offset)
    const t = setTimeout(() => {
      if (!userId) { anotarPosicion(book.libro_id, firstParr.id, offset); return }
      guardar(supabase.from('progreso_lectura').upsert({
        user_id: userId, libro_id: book.libro_id,
        ultimo_parrafo_id: firstParr.id,
        ultimo_parrafo_offset: offset,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,libro_id' }), { que: 'progreso', aviso: AVISOS.progreso })
    }, 600)
    return () => clearTimeout(t)
  }, [chapterIndex, pageIndex, paginas, userId, guestMode, book?.libro_id, capituloCargado, restoredRef, recordarPosicion])

  // Última página del último capítulo → 100 % y leído. En muestra no: el
  // último capítulo de la muestra no es el del libro.
  useEffect(() => {
    if (!restoredRef.current || !userId || !book?.libro_id || guestMode) return
    if (!capitulos.length || chapterIndex !== capitulos.length - 1) return
    if (!esUltimaPagina) return
    const t = setTimeout(async () => {
      const { ok } = await guardarTodo([
        supabase.from('progreso_lectura')
          .update({ porcentaje: 100, capitulos_completados: capitulos.length, updated_at: new Date().toISOString() })
          .eq('user_id', userId).eq('libro_id', book.libro_id),
        supabase.from('bibliotecas_usuarios')
          .update({ leido: true })
          .eq('user_id', userId).eq('libro_id', book.libro_id),
      ], { que: 'libro terminado', aviso: AVISOS.terminado })
      // Si falló no se marca: se reintenta la próxima vez que llegue a la última página.
      if (!ok) return
      setIsLeido(true)
      invalidateBiblioteca()
    }, 600)
    return () => clearTimeout(t)
  }, [chapterIndex, esUltimaPagina, capitulos.length, userId, book?.libro_id, guestMode, restoredRef, setIsLeido, invalidateBiblioteca])
}
