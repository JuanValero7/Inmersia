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
import { useInvalidateBibliotecaUsuario } from '../lib/queries.js'
import { CAPITULOS_MUESTRA } from '../lib/constants.js'
import { evento } from '../lib/analytics.js'

// Filas de subrayados_usuario → { [capitulo_num]: [{ id, texto }, ...] }
function agruparSubrayados(filas) {
  const porCap = {}
  for (const f of filas || []) {
    if (!f.texto_original) continue
    const cap = f.capitulo_num
    if (!porCap[cap]) porCap[cap] = []
    porCap[cap].push({ id: f.id, texto: f.texto_original })
  }
  return porCap
}

// `setChapterIndex` y `setPageIndex` son los setters de UI de cada componente:
// la carga de la lista de capítulos los usa para reposicionar al restaurar
// progreso. Son setters de useState (estables), por eso no van en deps.
// `muestra` = el lector está en modo muestra (invitado, o usuario autenticado que
// no adquirió el libro). Recorta la lista de capítulos a CAPITULOS_MUESTRA: para el
// rol `anon` la RLS ya devuelve solo esos dos, pero para `authenticated` no, así que
// sin este tope un usuario logueado leía el libro entero abriéndolo por URL.
export function useLectorData(book, setChapterIndex, setPageIndex, muestra = false) {
  const [capitulos, setCapitulos] = useState([])
  // El caché es estado porque el render lo lee (currentChapData), pero
  // fetchChapter NO puede depender de él: cambiaría de identidad en cada
  // capítulo y obligaría a los efectos que lo consumen a excluirlo con un
  // eslint-disable. De ahí el espejo en un ref, que es lo que consultan
  // fetchChapter y peekChapter para poder quedarse con deps vacías.
  const [chapterCache, setChapterCache] = useState({})
  const chapterCacheRef = useRef({})
  const [userId, setUserId] = useState(null)
  const [userReady, setUserReady] = useState(false)  // ya resolvimos quién es el usuario (o anónimo)
  const [loading, setLoading] = useState(true)
  const [loadingCap, setLoadingCap] = useState(false)
  const [error, setError] = useState(null)
  const [isLeido, setIsLeido] = useState(book?.leido ?? false)
  const [pendingRestore, setPendingRestore] = useState(null)
  const restoredRef = useRef(false)
  const invalidateBiblioteca = useInvalidateBibliotecaUsuario(userId)

  // ── Subrayados del usuario (para pintarlos sobre el texto) ──
  // Se traen de una sola vez para todo el libro y se agrupan por capítulo: son
  // filas cortas y así cambiar de capítulo no dispara una consulta nueva.
  const [subrayadosPorCap, setSubrayadosPorCap] = useState({})

  // ── Reseña ──
  const [resenaForm, setResenaForm] = useState({ rating: 0, texto: '' })
  const [resenaEnviando, setResenaEnviando] = useState(false)
  const [miResena, setMiResena] = useState(null)

  // usuario — getSession() lee el token local (0 ms); getUser() haría un
  // viaje de red al servidor de Auth que bloqueaba toda la carga del libro.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data?.session?.user?.id || null)
      setUserReady(true)
    })
  }, [])

  // Subrayados: todos los del usuario en este libro, agrupados por capítulo
  useEffect(() => {
    if (!userId || !book?.libro_id) { setSubrayadosPorCap({}); return }
    let cancelado = false
    supabase.from('subrayados_usuario')
      .select('id, texto_original, capitulo_num')
      .eq('user_id', userId).eq('libro_id', book.libro_id)
      .limit(500)
      .then(({ data, error: err }) => {
        if (cancelado) return
        if (err) { console.error('subrayados:', err.message); return }
        setSubrayadosPorCap(agruparSubrayados(data))
      })
    return () => { cancelado = true }
  }, [userId, book?.libro_id])

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
    const { error } = await supabase.from('resenas_libros').upsert(
      { user_id: userId, libro_id: book.libro_id, rating: resenaForm.rating, texto: resenaForm.texto || null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,libro_id' }
    )
    setResenaEnviando(false)
    if (error) { console.error('submitResena:', error.message); return false }
    setMiResena({ rating: resenaForm.rating, texto: resenaForm.texto })
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
      setLoading(true); setError(null); actualizarCache(() => ({}))
      restoredRef.current = false; setPendingRestore(null)
      try {
        // capitulos y progreso_lectura son independientes (progreso solo
        // depende de userId/libro_id, ya conocidos) → se piden en paralelo.
        // El embed parrafos!ultimo_parrafo_id trae el capitulo_id del párrafo
        // de progreso en la misma respuesta (FK ultimo_parrafo_id → parrafos.id),
        // evitando un viaje extra secuencial a `parrafos`.
        const [{ data: capsTodos, error: e }, { data: prog }] = await Promise.all([
          supabase.from('capitulos').select('id, numero, titulo')
            .eq('libro_id', book.libro_id).order('numero'),
          userId
            ? supabase.from('progreso_lectura')
                .select('ultimo_parrafo_id, ultimo_parrafo_offset, parrafos!ultimo_parrafo_id(capitulo_id)')
                .eq('user_id', userId).eq('libro_id', book.libro_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ])
        if (e) throw e
        if (!capsTodos || capsTodos.length === 0) throw new Error('Este libro no tiene capítulos cargados.')
        // Modo muestra → solo los primeros capítulos. `caps` es de acá en adelante
        // la lista VISIBLE: el índice de restauración de progreso y el tope que
        // dispara el paywall se calculan sobre ella.
        const caps = muestra ? capsTodos.slice(0, CAPITULOS_MUESTRA) : capsTodos

        // pendingRestore = { parrafoId, offset }: el offset (caracteres dentro
        // del párrafo) afina la restauración cuando el párrafo es largo y está
        // dividido en varias páginas (ver paginaDeAnclaje en readerHelpers).
        let startChapter = 0, pendingAnchor = null
        if (prog?.ultimo_parrafo_id && prog?.parrafos?.capitulo_id) {
          const idx = caps.findIndex(c => c.id === prog.parrafos.capitulo_id)
          if (idx >= 0) {
            startChapter = idx
            pendingAnchor = { parrafoId: prog.ultimo_parrafo_id, offset: prog.ultimo_parrafo_offset || 0 }
          }
        }
        if (cancelled) return
        setCapitulos(caps); setChapterIndex(startChapter); setPageIndex(0)
        setPendingRestore(pendingAnchor)
        if (!pendingAnchor) restoredRef.current = true
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [book?.libro_id, userReady, muestra])

  // TODA escritura del caché pasa por aquí. El ref es lo que se consulta y el
  // estado es lo que se pinta: si se tocan por separado se desincronizan, y un
  // párrafo borrado por el superusuario reaparecería al volver al capítulo.
  const actualizarCache = useCallback((fn) => {
    chapterCacheRef.current = fn(chapterCacheRef.current)
    setChapterCache(chapterCacheRef.current)
  }, [])

  // Traer un capítulo (párrafos + media + ambiente), con caché
  const fetchChapter = useCallback(async (cap) => {
    if (!cap) return null
    const cacheado = chapterCacheRef.current[cap.id]
    if (cacheado) return cacheado
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
    actualizarCache(prev => ({ ...prev, [cap.id]: entry }))
    return entry
  }, [actualizarCache])

  // Mirar el caché sin disparar la petición. Estable, para que los efectos que
  // cargan el capítulo actual solo se reejecuten cuando cambia el capítulo.
  const peekChapter = useCallback((capId) => chapterCacheRef.current[capId] || null, [])

  // SFX puntual (botón ♪ en párrafo)
  const playSfx = useCallback((media) => {
    if (!media?.url) return
    const a = new Audio(media.url); a.volume = 0.85; a.play().catch(() => {})
  }, [])

  // Persistir avance de capítulo al cerrar el cuaderno (idéntico en ambos)
  async function persistChapterAdvance(pendingChapter) {
    if (!userId || !book?.libro_id) return
    const newPct = Math.round((pendingChapter / capitulos.length) * 100)
    const updates = [
      supabase.from('progreso_lectura')
        .update({ porcentaje: newPct, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('libro_id', book.libro_id).lt('porcentaje', newPct),
    ]
    if (newPct >= 90) {
      updates.push(
        supabase.from('bibliotecas_usuarios').update({ leido: true })
          .eq('user_id', userId).eq('libro_id', book.libro_id)
      )
    }
    await Promise.all(updates)
    // `pendingChapter` es cuántos capítulos lleva completados, no el número
    // del capítulo — de ahí el nombre de la propiedad.
    evento('capitulo_terminado', {
      libro_id: book.libro_id,
      capitulos_completados: pendingChapter,
      porcentaje: newPct,
      libro_terminado: newPct >= 90,
    })
    if (newPct >= 90) { setIsLeido(true); invalidateBiblioteca() }
  }

  // Insertar un subrayado (el guard de selección/usuario lo hace cada componente)
  async function subrayar(text, parrafoId, chapterIndex) {
    const cap = capitulos[chapterIndex]
    const capNum = cap?.numero ?? chapterIndex + 1
    const texto = text.slice(0, 1000)
    const { data, error } = await supabase.from('subrayados_usuario').insert({
      user_id: userId, libro_id: book.libro_id,
      capitulo_num: capNum,
      texto_original: texto,
      parrafo_id: parrafoId || null,
    }).select('id').single()
    // Si el insert falla no se pinta nada. Antes se pintaba la marca amarilla
    // con id: null sobre un subrayado que no existía en la base: el Cuaderno
    // salía sin él y esa marca no se podía borrar (el Cuaderno borra por id).
    if (error || !data?.id) {
      console.error('subrayar:', error?.message || 'el insert no devolvió id')
      return false
    }
    // Sin recargar: la marca amarilla aparece en cuanto se guarda.
    setSubrayadosPorCap(prev => ({
      ...prev,
      [capNum]: [...(prev[capNum] || []), { id: data.id, texto }],
    }))
    return true
  }

  // El Cuaderno es quien borra en Supabase; acá solo se retira la marca del
  // texto para que el libro no siga mostrando un subrayado que ya no existe.
  const olvidarSubrayado = useCallback((id) => {
    setSubrayadosPorCap(prev => {
      const out = {}
      for (const [cap, lista] of Object.entries(prev)) out[cap] = lista.filter(s => s.id !== id)
      return out
    })
  }, [])

  // ── Operaciones de superusuario ───────────────────────────────

  // Elimina el vínculo explícito entre un párrafo y un media.
  // Actualiza el cache local para reflejar el cambio sin recargar.
  async function quitarMedia(parrafoId, mediaId, capituloId) {
    const { error } = await supabase
      .from('elementos_interactivos')
      .delete()
      .eq('parrafo_id', parrafoId)
      .eq('media_id', mediaId)
    if (error) { console.error('quitarMedia:', error.message); return false }
    actualizarCache(prev => {
      const entry = prev[capituloId]
      if (!entry) return prev
      const updated = { ...entry.mediaByParrafo }
      if (updated[parrafoId]) {
        updated[parrafoId] = updated[parrafoId].filter(m => m.media_id !== mediaId)
      }
      return { ...prev, [capituloId]: { ...entry, mediaByParrafo: { ...updated } } }
    })
    return true
  }

  // Marca un media como destacado en biblioteca_media.
  async function marcarMedia(mediaId) {
    const { error } = await supabase
      .from('biblioteca_media')
      .update({ destacado: true })
      .eq('id', mediaId)
    if (error) { console.error('marcarMedia:', error.message); return false }
    return true
  }

  // Crea un vínculo explícito entre un párrafo y un media.
  // textoRef (opcional): frase exacta del párrafo a la que anclar el audio.
  // Actualiza el cache local para reflejar el cambio sin recargar.
  async function sugerirMedia(parrafoId, mediaId, capituloId, textoRef = null) {
    const payload = { parrafo_id: parrafoId, media_id: mediaId }
    if (textoRef) payload.metadata = { texto_ref: textoRef }
    const { error } = await supabase
      .from('elementos_interactivos')
      .insert(payload)
    if (error) { console.error('sugerirMedia:', error.message); return false }
    const { data: m } = await supabase
      .from('biblioteca_media')
      .select('id, slug, tipo, url, titulo, descripcion, metadata')
      .eq('id', mediaId)
      .single()
    if (m) {
      actualizarCache(prev => {
        const entry = prev[capituloId]
        if (!entry) return prev
        const updated = { ...entry.mediaByParrafo }
        const mergedMeta = textoRef ? { ...(m.metadata || {}), texto_ref: textoRef } : (m.metadata || {})
        const nuevo = { parrafo_id: parrafoId, media_id: m.id, slug: m.slug, tipo: m.tipo, url: m.url, titulo: m.titulo, descripcion: m.descripcion, metadata: mergedMeta, origen: 'explicito' }
        updated[parrafoId] = [...(updated[parrafoId] || []), nuevo]
        return { ...prev, [capituloId]: { ...entry, mediaByParrafo: { ...updated } } }
      })
    }
    return true
  }

  // Elimina un párrafo permanentemente via RPC (SECURITY DEFINER).
  // La función de DB actualiza progreso_lectura antes de borrar.
  async function borrarParrafo(parrafoId, capituloId) {
    const { error } = await supabase.rpc('delete_parrafo_superuser', { p_id: parrafoId })
    if (error) { console.error('borrarParrafo:', error.message); return false }
    actualizarCache(prev => {
      const entry = prev[capituloId]
      if (!entry) return prev
      const parrafos = entry.parrafos.filter(p => p.id !== parrafoId)
      const mediaByParrafo = { ...entry.mediaByParrafo }
      delete mediaByParrafo[parrafoId]
      return { ...prev, [capituloId]: { ...entry, parrafos, mediaByParrafo } }
    })
    return true
  }

  return {
    // datos
    userId, capitulos, chapterCache, loading, loadingCap, error,
    isLeido, setIsLeido, subrayadosPorCap, olvidarSubrayado,
    pendingRestore, setPendingRestore, restoredRef,
    setLoadingCap, setError,
    // operaciones
    fetchChapter, peekChapter, playSfx, persistChapterAdvance, subrayar,
    // superusuario
    quitarMedia, marcarMedia, sugerirMedia, borrarParrafo,
    // reseña
    miResena, resenaForm, setResenaForm, resenaEnviando, submitResena,
  }
}
