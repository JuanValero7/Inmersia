// src/hooks/useLectorData.js
// ─────────────────────────────────────────────────────────────
// Lógica de datos compartida del Lector inmersivo.
// La consumen Lector.jsx (desktop) y LectorMobile.jsx, que aportan
// su propia geometría, paginación, navegación y chrome.
//
// Va aquí (datos idénticos en ambos, sin acoplar a la UI):
//   · userId
//   · capítulos + caché + carga de lista con restauración de progreso
//   · fetchChapter (párrafos + media + ambiente)
//   · reseña (carga + submit)
//   · playSfx
//   · persistChapterAdvance (avance de capítulo al cerrar el cuaderno)
//   · subrayar (insert del subrayado)
//
// Se queda en cada componente (acoplado a su paginación/geometría o
// divergente entre desktop y mobile): carga del capítulo ACTUAL,
// guardado de progreso por página, marcar 100%, audio de ambiente,
// selección de texto y todo el chrome/tour.
//
// Refactor puro: comportamiento idéntico al previo.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

// `setChapterIndex` y `setPageIndex` son los setters de UI de cada componente:
// la carga de la lista de capítulos los usa para reposicionar al restaurar
// progreso. Son setters de useState (estables), por eso no van en deps.
export function useLectorData(book, setChapterIndex, setPageIndex) {
  const [capitulos, setCapitulos] = useState([])
  const [chapterCache, setChapterCache] = useState({})
  const [userId, setUserId] = useState(null)
  const [userReady, setUserReady] = useState(false)  // ya resolvimos quién es el usuario (o anónimo)
  const [loading, setLoading] = useState(true)
  const [loadingCap, setLoadingCap] = useState(false)
  const [error, setError] = useState(null)
  const [isLeido, setIsLeido] = useState(book?.leido ?? false)
  const [pendingRestore, setPendingRestore] = useState(null)
  const restoredRef = useRef(false)

  // ── Reseña ──
  const [resenaForm, setResenaForm] = useState({ rating: 0, texto: '' })
  const [resenaEnviando, setResenaEnviando] = useState(false)
  const [miResena, setMiResena] = useState(null)

  // usuario
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id || null)
      setUserReady(true)
    })
  }, [])

  // Reseña: traer la mía cuando el libro está terminado
  useEffect(() => {
    if (!userId || !book?.libro_id || !isLeido) return
    supabase.from('resenas_libros').select('rating, texto')
      .eq('user_id', userId).eq('libro_id', book.libro_id).maybeSingle()
      .then(({ data }) => {
        setMiResena(data || null)
        if (data) setResenaForm({ rating: data.rating, texto: data.texto || '' })
      })
  }, [userId, book?.libro_id, isLeido])

  // submit → true si se guardó, false si no pasó las validaciones.
  // (Cada componente cierra su propio modal/sheet de reseña según el resultado.)
  async function submitResena() {
    if (!resenaForm.rating) return false
    if ((resenaForm.texto?.length ?? 0) > 1000) return false
    setResenaEnviando(true)
    await supabase.from('resenas_libros').upsert(
      { user_id: userId, libro_id: book.libro_id, rating: resenaForm.rating, texto: resenaForm.texto || null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,libro_id' }
    )
    setMiResena({ rating: resenaForm.rating, texto: resenaForm.texto })
    setResenaEnviando(false)
    return true
  }

  // Cargar lista de capítulos (+ restaurar capítulo/párrafo de progreso).
  // Espera a `userReady` para no correr dos veces (con userId=null y luego
  // con el id real), lo que reseteaba caché/posición de lectura.
  useEffect(() => {
    if (!userReady) return
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

        let startChapter = 0, pendingParrafo = null
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
  }, [book?.libro_id, userReady])

  // Traer un capítulo (párrafos + media + ambiente), con caché
  const fetchChapter = useCallback(async (cap) => {
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
        if (m.origen === 'tag' && m.tipo === 'audio' && !seen.has(m.slug)) { seen.add(m.slug); ambients.push(m) }
      }
    }
    const entry = { parrafos: parrafos || [], mediaByParrafo, ambient: ambients[0] || null }
    setChapterCache(prev => ({ ...prev, [cap.id]: entry }))
    return entry
  }, [chapterCache])

  // SFX puntual (botón ♪ en párrafo)
  const playSfx = useCallback((media) => {
    if (!media?.url) return
    const a = new Audio(media.url); a.volume = 0.85; a.play().catch(() => {})
  }, [])

  // Persistir avance de capítulo al cerrar el cuaderno (idéntico en ambos)
  async function persistChapterAdvance(pendingChapter) {
    if (!userId || !book?.libro_id) return
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

  // Insertar un subrayado (el guard de selección/usuario lo hace cada componente)
  async function subrayar(text, parrafoId, chapterIndex) {
    const cap = capitulos[chapterIndex]
    await supabase.from('subrayados_usuario').insert({
      user_id: userId, libro_id: book.libro_id,
      capitulo_num: cap?.numero ?? chapterIndex + 1,
      texto_original: text,
      parrafo_id: parrafoId || null,
    })
  }

  return {
    // datos
    userId, capitulos, chapterCache, loading, loadingCap, error,
    isLeido, setIsLeido,
    pendingRestore, setPendingRestore, restoredRef,
    setLoadingCap, setError,
    // operaciones
    fetchChapter, playSfx, persistChapterAdvance, subrayar,
    // reseña
    miResena, resenaForm, setResenaForm, resenaEnviando, submitResena,
  }
}
