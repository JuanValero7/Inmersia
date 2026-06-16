// Formato: Plain JavaScript (.jsx)
// Hook de datos de la Cartelera. Trae todo on-demand desde Supabase para un
// (libro, usuario): capítulo actual, porcentaje de avance, items por sección,
// las 4 imágenes "principales" (fondo de cada tablero) y las predicciones.
//
// Regla de revelado (igual que los otros tableros):
//   - porcentaje (0..100): fuente única de verdad para el avance.
//   - capituloActual se deriva de pct + total capítulos (inversa de la fórmula
//     de Lector.jsx: pct = round(pendingIdx / total * 100)).
//   - cartelera_items / predicciones: se filtran client-side con capitulo < capActual.
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

const VACIO = { personajes: [], lugares: [], hechos: [], datos: [] }

export function useCartelera(libroId, userId) {
  const [loading, setLoading]       = useState(true)
  const [capituloActual, setCap]    = useState(0)
  const [porcentaje, setPorcentaje] = useState(0)
  const [itemsBySeccion, setItems]  = useState(VACIO)
  const [principal, setPrincipal]   = useState({})

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setLoading(true)

      if (!libroId || !userId) {
        if (!cancelled) {
          setCap(0); setPorcentaje(0); setItems(VACIO); setPrincipal({})
          setLoading(false)
        }
        return
      }

      // 1) progreso → porcentaje (fuente única de verdad)
      const { data: prog } = await supabase
        .from('progreso_lectura')
        .select('porcentaje')
        .eq('user_id', userId)
        .eq('libro_id', libroId)
        .maybeSingle()

      const pct = Math.max(0, Math.min(100, prog?.porcentaje ?? 0))

      // 2) En paralelo: items + imágenes + total capítulos
      const [carteleraRes, principalRes, chapsRes] = await Promise.all([
        supabase.from('cartelera_items')
          .select('id, seccion, nombre, descripcion, capitulo_numero, metadata, imagen:biblioteca_media!imagen_media_id(url, slug, titulo)')
          .eq('libro_id', libroId)
          .order('capitulo_numero', { ascending: true }),
        supabase.from('cartelera_principal')
          .select('seccion, imagen:biblioteca_media!imagen_media_id(url, titulo), video:biblioteca_media!video_media_id(url)')
          .eq('libro_id', libroId),
        supabase.from('capitulos')
          .select('id', { count: 'exact', head: true })
          .eq('libro_id', libroId),
      ])

      // capActual derivado de pct: inversa de round(pendingIdx / total * 100)
      // donde pendingIdx (0-based) = número de capítulo (1-based) ya completado.
      const totalChaps = chapsRes.count ?? 0
      const capActual = (pct > 0 && totalChaps > 0)
        ? Math.round(pct / 100 * totalChaps) + 1
        : 0

      // Filtrar y agrupar por nombre canónico para evitar duplicados
      // Items llegan ordenados por capitulo_numero ASC desde Supabase
      const agrupado = { personajes: [], lugares: [], hechos: [], datos: [] }
      const keys = {}  // `${seccion}:::${canonico}` → index en agrupado[seccion]
      for (const it of (carteleraRes.data || [])) {
        if (!(capActual > 0 && it.capitulo_numero < capActual)) continue
        if (!agrupado[it.seccion]) continue
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
  }, [libroId, userId])

  return { loading, capituloActual, porcentaje, itemsBySeccion, principal }
}
