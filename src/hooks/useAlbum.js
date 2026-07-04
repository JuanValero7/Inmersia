// Carga todos los datos del Álbum para el usuario:
// por cada libro en su biblioteca arma las barajitas agrupadas por sección
// (Personajes · Lugares · Capítulos), estadísticas de sesiones, notas y audio.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

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

// Arma una sección: dedup + orden por capítulo + marca desbloqueadas.
// `total`/`unlocked` son los números reales (para el "X de Y" y los vacíos);
// `items` son los slots que efectivamente se pintan (capados a MAX_SLOTS).
// `filterByImage`: si true, excluye items sin imagen (para personajes/lugares).
// `heroItem`: imagen de cartelera_principal que ocupa la posición 0 (hero/video).
function buildSeccion(rows, capActual, { filterByImage = false, heroItem = null } = {}) {
  const seen = new Set()
  const uniq = []
  for (const r of rows) {
    const key = r.slug || r.url || r.titulo || r.nombre
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    uniq.push(r)
  }
  uniq.sort((a, b) => (a.capitulo_numero ?? 0) - (b.capitulo_numero ?? 0))

  const all = (filterByImage ? uniq.filter(r => r.url) : uniq).map(r => ({
    url: r.url || null,
    name: r.titulo || r.nombre || '',
    unlocked: (r.capitulo_numero ?? 0) < capActual,
  }))

  const total    = all.length
  const unlocked = all.filter(i => i.unlocked).length

  const slotsForItems = heroItem ? MAX_SLOTS - 1 : MAX_SLOTS
  const displayItems  = all.slice(0, slotsForItems)
  const extra         = all.length > slotsForItems ? all.length - slotsForItems : 0
  const items         = heroItem
    ? [{ url: heroItem.url, name: heroItem.name, unlocked: true }, ...displayItems]
    : displayItems

  return { total, unlocked, items, extra }
}

export function useAlbum(user) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) { setItems([]); setLoading(false); return }
    let cancelled = false

    async function cargar() {
      setLoading(true)

      // 1. Libros del usuario con datos de perfil del libro
      const { data: bibData } = await supabase
        .from('bibliotecas_usuarios')
        .select('libro_id, leido, libros(id, slug, titulo, autor, portada_url, color, paginas, es_ficcion)')
        .eq('user_id', user.id)

      const libros = (bibData || []).filter(r => r.libros).map(r => ({
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
      }))

      if (!libros.length) {
        if (!cancelled) { setItems([]); setLoading(false) }
        return
      }

      const libroIds = libros.map(l => l.libro_id)

      // 2. Todas las queries en paralelo
      const [
        progresosRes,
        capsRes,
        sesionesRes,
        anotacionesRes,
        carteleraImgRes,
        parrafoImgRes,
        reelsRes,
        principalRes,
      ] = await Promise.all([
        supabase.from('progreso_lectura')
          .select('libro_id, porcentaje')
          .eq('user_id', user.id)
          .in('libro_id', libroIds),

        supabase.from('capitulos')
          .select('libro_id')
          .in('libro_id', libroIds),

        supabase.from('sesiones_lectura')
          .select('libro_id, started_at, ended_at')
          .eq('user_id', user.id)
          .in('libro_id', libroIds),

        supabase.from('anotaciones_usuario')
          .select('libro_id')
          .eq('user_id', user.id)
          .in('libro_id', libroIds),

        // Items de cartelera (personajes · lugares · hechos · datos).
        // Traemos TODOS (con o sin imagen) para poder contar los slots vacíos.
        supabase.from('cartelera_items')
          .select('libro_id, seccion, capitulo_numero, nombre, imagen:biblioteca_media!imagen_media_id(url, titulo, slug)')
          .in('libro_id', libroIds),

        // Imágenes de escena por párrafo (vista album_imagenes) → sección Capítulos
        supabase.from('album_imagenes')
          .select('libro_id, capitulo_numero, url, titulo, slug')
          .in('libro_id', libroIds),

        // Preview de audio: primero por orden en libro_reels
        supabase.from('libro_reels')
          .select('libro_id, audio_url, orden')
          .in('libro_id', libroIds)
          .not('audio_url', 'is', null)
          .order('orden', { ascending: true }),

        // Imagen principal por sección (hero/video de cada tablero).
        supabase.from('cartelera_principal')
          .select('libro_id, seccion, imagen:biblioteca_media!imagen_media_id(url, titulo)')
          .in('libro_id', libroIds),
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
        const secciones = {
          personajes: buildSeccion(cartRows.filter(r => r.seccion === 'personajes'), capActual, { filterByImage: true, heroItem: principal.personajes || null }),
          lugares:    buildSeccion(cartRows.filter(r => r.seccion === 'lugares'),    capActual, { filterByImage: true, heroItem: principal.lugares    || null }),
          capitulos:  buildSeccion(parrRows, capActual),
        }

        const totalBarajitas = secciones.personajes.total + secciones.lugares.total + secciones.capitulos.total
        const unlockedBarajitas = secciones.personajes.unlocked + secciones.lugares.unlocked + secciones.capitulos.unlocked

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
  }, [user?.id])

  return { items, loading }
}
