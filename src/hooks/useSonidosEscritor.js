// src/hooks/useSonidosEscritor.js
// ─────────────────────────────────────────────────────────────
// Datos del panel de sonidos del escritor (lector, dueño del libro).
// Migración 104:
//   · elementos_interactivos: el dueño vincula/desvincula audios en
//     párrafos de su libro (las funciones sugerirMedia/quitarMedia de
//     useLectorData; la RLS es la que manda).
//   · guardar_ambientes_escritor(capitulo, tramos): los tramos de ambiente.
// La biblioteca de sonidos es la común de Inmersia (solo lectura).
// ─────────────────────────────────────────────────────────────
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'

const TANDA = 1000 // PostgREST no devuelve más de 1000 filas por petición

/**
 * Todos los audios de la biblioteca común, ordenados por título.
 * @returns {import('@tanstack/react-query').UseQueryResult<{ id: string, slug: string, titulo: string|null, url: string, tags: string[] }[]>}
 */
export function useAudiosBiblioteca(activo = true) {
  return useQuery({
    queryKey: ['audiosBiblioteca'],
    enabled: activo,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const todos = []
      for (let desde = 0; ; desde += TANDA) {
        const { data, error } = await supabase
          .from('biblioteca_media')
          .select('id, slug, titulo, url, tags')
          .eq('tipo', 'audio')
          .order('titulo').order('id')
          .range(desde, desde + TANDA - 1)
        if (error) throw error
        todos.push(...(data || []))
        if (!data || data.length < TANDA) break
      }
      return todos
    },
  })
}

/** Mensaje para el escritor según la pista de la base. */
export function mensajeErrorAmbientes(error) {
  if (error?.hint === 'tramos_solapados') return 'Ese tramo se pisa con otro. Quita el otro primero o elige otros párrafos.'
  if (error?.hint === 'formato') return 'Revisa los párrafos: «desde» no puede ser mayor que «hasta».'
  return 'No pudimos guardar el ambiente. Revisa tu conexión e inténtalo de nuevo.'
}

/** Guarda todos los tramos de ambiente de un capítulo. */
export function useGuardarAmbientes() {
  return useMutation({
    mutationFn: async ({ capituloId, tramos }) => {
      const { error } = await supabase.rpc('guardar_ambientes_escritor', {
        p_capitulo: capituloId, p_tramos: tramos,
      })
      if (error) throw error
      return tramos.length ? tramos : null
    },
  })
}

/** Quita acentos y pasa a minúsculas, para buscar. */
export function normalizarBusqueda(texto) {
  return (texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}
