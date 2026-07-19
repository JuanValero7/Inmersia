// Formato: Plain JavaScript (.jsx)
// Hook de datos de la Cartelera. Trae todo on-demand desde Supabase para un
// (libro, usuario): capítulo actual, porcentaje de avance, items por sección,
// las 4 imágenes "principales" (fondo de cada tablero) y las predicciones.
//
// Regla de revelado (igual que los otros tableros):
//   - porcentaje (0..100): fuente única de verdad para el avance.
//   - capituloActual se deriva de pct + total capítulos (inversa de la fórmula
//     de Lector.jsx: pct = round(pendingIdx / total * 100)).
//   - cartelera_items / predicciones: se filtran en servidor con capitulo < capActual.
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useReadingStats } from '../../hooks/useReadingStats.js'

// A partir de qué avance se cargan las estadísticas de lectura para la placa
// del tablero "Datos"/"Resumen" (ver TableroDatos.jsx). Recién cerca del final
// del libro tiene sentido pagar esas dos queries extra (sesiones + notas).
const STATS_FROM_PCT = 90

export function useCartelera(libroId, userId, isSuperuser = false) {
  const [loading, setLoading]       = useState(true)
  const [capituloActual, setCap]    = useState(0)
  const [porcentaje, setPorcentaje] = useState(0)
  const [itemsBySeccion, setItems]  = useState({})
  const [principal, setPrincipal]   = useState({})
  const stats = useReadingStats(libroId, userId, porcentaje > STATS_FROM_PCT)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setLoading(true)

      if (!libroId || !userId) {
        if (!cancelled) {
          setCap(0); setPorcentaje(0); setItems({}); setPrincipal({})
          setLoading(false)
        }
        return
      }

      // 1) progreso + total capítulos en paralelo (necesarios para derivar capActual
      //    antes de filtrar items en servidor)
      const [{ data: prog }, chapsRes] = await Promise.all([
        supabase.from('progreso_lectura')
          .select('porcentaje')
          .eq('user_id', userId)
          .eq('libro_id', libroId)
          .maybeSingle(),
        supabase.from('capitulos')
          .select('id', { count: 'exact', head: true })
          .eq('libro_id', libroId),
      ])

      const pct = Math.max(0, Math.min(100, prog?.porcentaje ?? 0))

      // capActual derivado de pct: inversa de round(pendingIdx / total * 100)
      // donde pendingIdx (0-based) = número de capítulo (1-based) ya completado.
      const totalChaps = chapsRes.count ?? 0
      const capActual = (pct > 0 && totalChaps > 0)
        ? Math.round(pct / 100 * totalChaps) + 1
        : 0

      // 2) En paralelo: items + imágenes + predicciones, filtrados en servidor
      let itemsQuery = supabase.from('cartelera_items')
        .select('id, seccion, nombre, descripcion, capitulo_numero, metadata, imagen:biblioteca_media!imagen_media_id(url, slug, titulo)')
        .eq('libro_id', libroId)
        .order('capitulo_numero', { ascending: true })
      if (!isSuperuser) itemsQuery = itemsQuery.lt('capitulo_numero', capActual)

      let predQuery = supabase.from('predicciones_usuario')
        .select('capitulo_num, contenido')
        .eq('user_id', userId).eq('libro_id', libroId)
        .order('capitulo_num', { ascending: true })
      if (!isSuperuser) predQuery = predQuery.lt('capitulo_num', capActual)

      const [carteleraRes, principalRes, prediccionesRes] = await Promise.all([
        itemsQuery,
        supabase.from('cartelera_principal')
          .select('seccion, imagen:biblioteca_media!imagen_media_id(url, titulo), video:biblioteca_media!video_media_id(url)')
          .eq('libro_id', libroId),
        predQuery,
      ])

      // Agrupar por nombre canónico para evitar duplicados.
      // Items llegan ya filtrados desde Supabase (no hay filtro client-side).
      const agrupado = {}
      const keys = {}  // `${seccion}:::${canonico}` → index en agrupado[seccion]
      for (const it of (carteleraRes.data || [])) {
        if (!agrupado[it.seccion]) agrupado[it.seccion] = []
        const canonico = it.nombre
        const key = `${it.seccion}:::${canonico}`
        if (key in keys) {
          const ex = agrupado[it.seccion][keys[key]]
          ex.allIds.push(it.id)
          ex.entradas.push({ capitulo_numero: it.capitulo_numero, descripcion: it.descripcion })
          if (!ex.imagen?.url && it.imagen?.url) ex.imagen = it.imagen
          if (it.metadata) ex.metadata = it.metadata
        } else {
          keys[key] = agrupado[it.seccion].length
          agrupado[it.seccion].push({
            ...it,
            nombre: canonico,
            allIds: [it.id],
            entradas: [{ capitulo_numero: it.capitulo_numero, descripcion: it.descripcion }],
          })
        }
      }

      // predicciones del usuario → sección "notas" (una por capítulo, sin agrupar)
      const notas = []
      for (const p of (prediccionesRes.data || [])) {
        if (!p.contenido) continue
        notas.push({
          id: p.capitulo_num,
          allIds: [p.capitulo_num],
          nombre: `Capítulo ${p.capitulo_num}`,
          capitulo_numero: p.capitulo_num,
          descripcion: p.contenido,
          metadata: {},
          entradas: [{ capitulo_numero: p.capitulo_num, descripcion: p.contenido }],
        })
      }
      if (notas.length) agrupado.notas = notas

      const imgs = {}
      for (const row of (principalRes.data || [])) {
        if (row.imagen?.url || row.video?.url) {
          imgs[row.seccion] = { ...row.imagen, videoUrl: row.video?.url || null }
        }
      }

      if (!cancelled) {
        setCap(capActual)
        setPorcentaje(pct)
        setItems(agrupado)
        setPrincipal(imgs)
        setLoading(false)
      }
    }

    cargar()
    return () => { cancelled = true }
  }, [libroId, userId, isSuperuser])

  return { loading, capituloActual, porcentaje, itemsBySeccion, principal, stats }
}
