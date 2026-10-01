// Estadísticas de lectura de un libro (tiempo total, veces abierto, sesión más
// larga, notas). Cálculo compartido entre useAlbum (batch, toda la biblioteca)
// y useReadingStats (un solo libro, usado por la Cartelera).
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function formatSeg(seg) {
  if (!seg || seg < 60) return seg ? `${Math.round(seg)} s` : '—'
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

// Las filas anteriores a la migración 061 no tienen tiempo activo y su
// duración sale de las marcas, que incluyen pestañas olvidadas abiertas
// toda la noche. Ninguna cuenta más que esto.
const TOPE_SESION_ANTIGUA_SEG = 2 * 3600

// Duración de una fila de `sesiones_lectura`: segundos_activos si lo tiene
// (filas desde la 061); si no, ended_at − started_at con tope. Una fila
// antigua sin ended_at (nunca se cerró) no suma.
function duracionSesion(s) {
  if (s.segundos_activos != null) return s.segundos_activos
  if (!s.ended_at) return 0
  return Math.min((new Date(s.ended_at) - new Date(s.started_at)) / 1000, TOPE_SESION_ANTIGUA_SEG)
}

// A partir de filas de `sesiones_lectura` (started_at, ended_at,
// segundos_activos) calcula tiempo total y sesión más larga.
export function computeSesionStats(sesiones) {
  let totalSeg = 0, sesionMasLargaSeg = 0
  for (const s of sesiones) {
    const dur = duracionSesion(s)
    totalSeg += dur
    sesionMasLargaSeg = Math.max(sesionMasLargaSeg, dur)
  }
  return { totalSeg: Math.round(totalSeg), vecesAbierto: sesiones.length, sesionMasLargaSeg: Math.round(sesionMasLargaSeg) }
}

// Estadísticas de UN libro. Solo dispara las queries cuando `enabled` es true
// — en la Cartelera la placa recién tiene sentido cerca del final del libro,
// así que se gatea a partir del 90% de avance (ver TableroDatos/useCartelera).
/**
 * Estadísticas de lectura de un libro para un usuario, a partir de sesiones_lectura.
 * @param {string} libroId
 * @param {string|null} userId
 * @param {boolean} enabled   con false no consulta
 * @returns {object} totales ya formateados
 */
export function useReadingStats(libroId, userId, enabled) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!enabled || !libroId || !userId) { setStats(null); return }
    let cancelled = false

    async function cargar() {
      const [sesionesRes, anotacionesRes] = await Promise.all([
        supabase.from('sesiones_lectura').select('started_at, ended_at, segundos_activos')
          .eq('user_id', userId).eq('libro_id', libroId),
        supabase.from('anotaciones_usuario').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).eq('libro_id', libroId),
      ])
      if (cancelled) return
      setStats({ ...computeSesionStats(sesionesRes.data || []), notas: anotacionesRes.count || 0 })
    }

    cargar()
    return () => { cancelled = true }
  }, [libroId, userId, enabled])

  return stats
}
