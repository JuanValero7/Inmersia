// src/hooks/useMisLectores.js
// ─────────────────────────────────────────────────────────────
// «Mis lectores» del Rincón del escritor (migración 118).
// Todo llega ya sumado de la función mis_lectores(): aquí no se cuenta
// nada ni se ve a ningún lector suelto. Grupos de menos de 10 personas
// llegan como null y la pantalla dice «todavía pocos lectores».
// ─────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'

/** Periodos del filtro → días hacia atrás (null = todo). */
export const PERIODOS = [
  { id: '30', dias: 30, texto: '30 días' },
  { id: '90', dias: 90, texto: '3 meses' },
  { id: 'todo', dias: null, texto: 'Desde siempre' },
]

function desdeDe(periodo) {
  const p = PERIODOS.find(x => x.id === periodo)
  if (!p?.dias) return null
  // Al día (no al milisegundo), para que la clave de la caché no cambie
  // cada vez que se pinta.
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - p.dias)
  return d.toISOString()
}

/**
 * Resumen de lectores de un libro (dueño o superusuario).
 * @param {string|null} libroId
 * @param {'30'|'90'|'todo'} periodo
 */
export function useMisLectores(libroId, periodo) {
  const desde = desdeDe(periodo)
  return useQuery({
    queryKey: ['misLectores', libroId, desde],
    enabled: !!libroId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const { data, error } = await supabase.rpc('mis_lectores', { p_libro: libroId, p_desde: desde, p_zona: zona })
      if (error) throw error
      return data
    },
  })
}

/**
 * Libros del catálogo (para el superusuario, que puede ver cualquiera).
 * @param {boolean} activo
 */
export function useLibrosCatalogoLectores(activo) {
  return useQuery({
    queryKey: ['misLectoresCatalogo'],
    enabled: activo,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('libros').select('id, titulo')
        .is('propietario_id', null).eq('visible', true)
        .order('titulo')
      if (error) throw error
      return data
    },
  })
}
