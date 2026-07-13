// Carga todos los datos del Álbum para el usuario:
// por cada libro en su biblioteca arma las barajitas agrupadas por sección
// (Personajes · Lugares · Capítulos), estadísticas de sesiones, notas y audio.
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { useBibliotecaUsuarioQuery } from '../lib/queries.js'

// Misma fórmula que useCartelera: inversa de round(pendingIdx / total * 100)
function derivarCapActual(pct, totalCaps) {
  if (pct <= 0 || totalCaps <= 0) return 0
  return Math.round(pct / 100 * totalCaps) + 1
}

export function formatSeg(seg) {
  if (!seg || seg < 60) return seg ? `${Math.round(seg)} s` : '—'
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

// Cuántos slots como máximo mostramos por sección (el resto = "+N más").
const MAX_SLOTS = 20

// Supabase/PostgREST corta cada query a 1000 filas por defecto. Con muchos
// libros curados, una query `.in('libro_id', libroIds)` sobre toda la
// biblioteca puede superar eso y truncarse en silencio (algunos libros
// quedan afuera del batch sin ningún error). `fetchAllRows` pagina con
// `.range()` hasta agotar los resultados reales.
const PAGE_SIZE = 1000

async function fetchAllRows(buildQuery) {
  let all = []
  let from = 0
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: all, error }
    all = all.concat(data || [])
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return { data: all, error: null }
}

// Arma una sección: dedup + orden por capítulo + marca desbloqueadas.
// `total`/`unlocked` son los números reales (para el "X de Y" y los vacíos).
// Las filas ya vienen filtradas por imagen desde la query (solo se cuentan
// items con imagen real vinculada — ver el filtro imagen_media_id.not.is.null).
// `heroItem`: imagen de cartelera_principal que ocupa la posición 0 (hero/video)
// — queda siempre pegada, fuera del mecanismo de "pegar barajitas".
// `pegadaSet`: claves `${libroId}::${seccion}::${itemKey}` ya pegadas por el usuario.
function buildSeccion(rows, capActual, { heroItem = null, libroId, seccion, pegadaSet } = {}) {
  const seen = new Set()
  const uniq = []
  for (const r of rows) {
    const key = r.slug || r.url || r.titulo || r.nombre
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    uniq.push(r)
  }
  uniq.sort((a, b) => (a.capitulo_numero ?? 0) - (b.capitulo_numero ?? 0))

  const all = uniq.map(r => {
    const key = r.slug || r.url || r.titulo || r.nombre || ''
    const unlocked = (r.capitulo_numero ?? 0) < capActual
    return {
      key,
      url: r.url || null,
      name: r.titulo || r.nombre || '',
      unlocked,
      pegada: unlocked && pegadaSet.has(`${libroId}::${seccion}::${key}`),
    }
  })

  const total    = all.length
  const unlocked = all.filter(i => i.unlocked).length

  const slotsForItems = heroItem ? MAX_SLOTS - 1 : MAX_SLOTS
  const displayItems  = all.slice(0, slotsForItems)
  const extra         = all.length > slotsForItems ? all.length - slotsForItems : 0
  const items         = heroItem
    ? [{ key: null, url: heroItem.url, name: heroItem.name, unlocked: true, pegada: true }, ...displayItems]
    : displayItems

  return { total, unlocked, items, extra }
}

export function useAlbum(user) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Libros del usuario: query compartida con Biblioteca/Tienda (ver
  // src/lib/queries.js) en vez de un fetch propio de bibliotecas_usuarios.
  const bibliotecaQuery = useBibliotecaUsuarioQuery(user?.id)
  const libros = useMemo(() => (bibliotecaQuery.data || []).filter(r => r.libros).map(r => ({
    id:          r.libros.id,
    libro_id:    r.libros.id,
    slug:        r.libros.slug,
    title:       r.libros.titulo,
    author:      r.libros.autor || 'Desconocido',
    pages:       r.libros.paginas || 200,
    _baseColor:  r.libros.color || '#cf8a6e',
    cover:       r.libros.portada_url || null,
    es_ficcion:  r.libros.es_ficcion ?? true,
    leido:       r.leido,
  })), [bibliotecaQuery.data])

  useEffect(() => {
    if (!user?.id) { setItems([]); setLoading(false); return }
    if (bibliotecaQuery.isLoading) { setLoading(true); return }
    if (!libros.length) { setItems([]); setLoading(false); return }
    let cancelled = false

    async function cargar() {
      setLoading(true)

      const libroIds = libros.map(l => l.libro_id)

      // Todas las queries en paralelo
      const [
        progresosRes,
        capsRes,
        sesionesRes,
        anotacionesRes,
        carteleraImgRes,
        parrafoImgRes,
        reelsRes,
        principalRes,
        pegadasRes,
      ] = await Promise.all([
        fetchAllRows(() => supabase.from('progreso_lectura')
          .select('libro_id, porcentaje')
          .eq('user_id', user.id)
          .in('libro_id', libroIds)),

        fetchAllRows(() => supabase.from('capitulos')
          .select('libro_id')
          .in('libro_id', libroIds)),

        fetchAllRows(() => supabase.from('sesiones_lectura')
          .select('libro_id, started_at, ended_at')
          .eq('user_id', user.id)
          .in('libro_id', libroIds)),

        fetchAllRows(() => supabase.from('anotaciones_usuario')
          .select('libro_id')
          .eq('user_id', user.id)
          .in('libro_id', libroIds)),

        // Items de cartelera (personajes · lugares · hechos · datos) que YA
        // tienen imagen vinculada — filtro server-side (ver índice parcial
        // idx_cartelera_items_libro_con_imagen en la migración 028).
        fetchAllRows(() => supabase.from('cartelera_items')
          .select('libro_id, seccion, capitulo_numero, nombre, imagen:biblioteca_media!imagen_media_id(url, titulo, slug)')
          .in('libro_id', libroIds)
          .not('imagen_media_id', 'is', null)),

        // Imágenes de escena por párrafo (vista album_imagenes) → sección Capítulos
        fetchAllRows(() => supabase.from('album_imagenes')
          .select('libro_id, capitulo_numero, url, titulo, slug')
          .in('libro_id', libroIds)),

        // Preview de audio: primero por orden en libro_reels
        fetchAllRows(() => supabase.from('libro_reels')
          .select('libro_id, audio_url, orden')
          .in('libro_id', libroIds)
          .not('audio_url', 'is', null)
          .order('orden', { ascending: true })),

        // Imagen principal por sección (hero/video de cada tablero).
        fetchAllRows(() => supabase.from('cartelera_principal')
          .select('libro_id, seccion, imagen:biblioteca_media!imagen_media_id(url, titulo)')
          .in('libro_id', libroIds)),

        // Barajitas que el usuario ya pegó a mano (persistente, ver Barajita.jsx).
        fetchAllRows(() => supabase.from('album_barajitas_pegadas')
          .select('libro_id, seccion, item_key')
          .eq('user_id', user.id)),
      ])

      if (cancelled) return

      // Índices por libro_id
      const progresoMap = Object.fromEntries((progresosRes.data || []).map(p => [p.libro_id, p.porcentaje]))

      const totalCapsMap = {}
      for (const c of (capsRes.data || [])) {
        totalCapsMap[c.libro_id] = (totalCapsMap[c.libro_id] || 0) + 1
      }

      const sesionesMap = {}
      for (const s of (sesionesRes.data || [])) {
        if (!sesionesMap[s.libro_id]) sesionesMap[s.libro_id] = []
        sesionesMap[s.libro_id].push(s)
      }

      const notasMap = {}
      for (const a of (anotacionesRes.data || [])) {
        notasMap[a.libro_id] = (notasMap[a.libro_id] || 0) + 1
      }

      // Primer audio por libro (ya vienen ordenados por orden ASC)
      const reelMap = {}
      for (const r of (reelsRes.data || [])) {
        if (!reelMap[r.libro_id]) reelMap[r.libro_id] = r.audio_url
      }

      // Imagen principal (hero) por libro y sección
      const principalMap = {}
      for (const row of (principalRes.data || [])) {
        if (!row.imagen?.url) continue
        if (!principalMap[row.libro_id]) principalMap[row.libro_id] = {}
        principalMap[row.libro_id][row.seccion] = { url: row.imagen.url, name: row.imagen.titulo || '' }
      }

      // Barajitas ya pegadas por el usuario
      const pegadaSet = new Set(
        (pegadasRes.data || []).map(p => `${p.libro_id}::${p.seccion}::${p.item_key}`)
      )

      // Construir un item por libro
      const result = libros.map(libro => {
        const pct       = Math.max(0, Math.min(100, progresoMap[libro.libro_id] ?? 0))
        const totalCaps = totalCapsMap[libro.libro_id] ?? 0
        const capActual = derivarCapActual(pct, totalCaps)

        // Filas de este libro
        const cartRows = (carteleraImgRes.data || []).filter(r => r.libro_id === libro.libro_id)
          .map(r => ({
            seccion: r.seccion,
            capitulo_numero: r.capitulo_numero,
            nombre: r.nombre,
            url: r.imagen?.url || null,
            titulo: r.imagen?.titulo || r.nombre,
            slug: r.imagen?.slug || r.nombre,
          }))
        const parrRows = (parrafoImgRes.data || []).filter(r => r.libro_id === libro.libro_id)

        const principal = principalMap[libro.libro_id] || {}
        const cartPersonajes = cartRows.filter(r => r.seccion === 'personajes')
        const cartLugares    = cartRows.filter(r => r.seccion === 'lugares')

        // No ficción: no hay personajes/lugares reales — una única sección
        // "Infografías" agrupa todo lo curado (mismas filas, sin la etiqueta ficticia).
        const secciones = libro.es_ficcion === false
          ? {
              infografias: buildSeccion([...cartPersonajes, ...cartLugares, ...parrRows], capActual, {
                heroItem: principal.personajes || principal.lugares || null,
                libroId: libro.libro_id, seccion: 'infografias', pegadaSet,
              }),
            }
          : {
              personajes: buildSeccion(cartPersonajes, capActual, {
                heroItem: principal.personajes || null, libroId: libro.libro_id, seccion: 'personajes', pegadaSet,
              }),
              lugares:    buildSeccion(cartLugares,    capActual, {
                heroItem: principal.lugares    || null, libroId: libro.libro_id, seccion: 'lugares', pegadaSet,
              }),
              capitulos:  buildSeccion(parrRows, capActual, {
                libroId: libro.libro_id, seccion: 'capitulos', pegadaSet,
              }),
            }

        const totalBarajitas    = Object.values(secciones).reduce((s, sec) => s + sec.total, 0)
        const unlockedBarajitas = Object.values(secciones).reduce((s, sec) => s + sec.unlocked, 0)

        // Stats de sesiones
        const sesiones = sesionesMap[libro.libro_id] || []
        let totalSeg = 0, sesionMasLargaSeg = 0
        for (const s of sesiones) {
          if (!s.ended_at) continue
          const dur = (new Date(s.ended_at) - new Date(s.started_at)) / 1000
          totalSeg         += dur
          sesionMasLargaSeg = Math.max(sesionMasLargaSeg, dur)
        }

        return {
          libro,
          pct,
          capActual,
          totalCaps,
          secciones,
          totalBarajitas,
          unlockedBarajitas,
          stats: {
            totalSeg:         Math.round(totalSeg),
            vecesAbierto:     sesiones.length,
            sesionMasLargaSeg: Math.round(sesionMasLargaSeg),
            notas:            notasMap[libro.libro_id] || 0,
          },
          previewAudio: reelMap[libro.libro_id] || null,
        }
      })

      if (!cancelled) { setItems(result); setLoading(false) }
    }

    cargar()
    return () => { cancelled = true }
  }, [user?.id, libros, bibliotecaQuery.isLoading])

  // Marca una barajita desbloqueada como pegada — optimista + persistido.
  async function pegar(libroId, seccion, itemKey) {
    if (!itemKey) return

    const setPegada = (value) => setItems(prev => prev.map(entry => {
      if (entry.libro.libro_id !== libroId) return entry
      const sec = entry.secciones[seccion]
      if (!sec) return entry
      return {
        ...entry,
        secciones: {
          ...entry.secciones,
          [seccion]: { ...sec, items: sec.items.map(it => it.key === itemKey ? { ...it, pegada: value } : it) },
        },
      }
    }))

    setPegada(true)

    const { error } = await supabase.from('album_barajitas_pegadas')
      .insert({ user_id: user.id, libro_id: libroId, seccion, item_key: itemKey })

    if (error && error.code !== '23505') setPegada(false)
  }

  return { items, loading, pegar }
}
