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

// A partir de filas de `sesiones_lectura` (started_at/ended_at) calcula tiempo
// total y sesión más larga. Filas sin ended_at (sesión en curso) se ignoran.
export function computeSesionStats(sesiones) {
  let totalSeg = 0, sesionMasLargaSeg = 0
  for (const s of sesiones) {
    if (!s.ended_at) continue
    const dur = (new Date(s.ended_at) - new Date(s.started_at)) / 1000
    totalSeg += dur
    sesionMasLargaSeg = Math.max(sesionMasLargaSeg, dur)
  }
  return { totalSeg: Math.round(totalSeg), vecesAbierto: sesiones.length, sesionMasLargaSeg: Math.round(sesionMasLargaSeg) }
}

// Estadísticas de UN libro. Solo dispara las queries cuando `enabled` es true
// — en la Cartelera la placa recién tiene sentido cerca del final del libro,
// así que se gatea a partir del 90% de avance (ver TableroDatos/useCartelera).
export function useReadingStats(libroId, userId, enabled) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!enabled || !libroId || !userId) { setStats(null); return }
    let cancelled = false

    async function cargar() {
      const [sesionesRes, anotacionesRes] = await Promise.all([
        supabase.from('sesiones_lectura').select('started_at, ended_at')
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
