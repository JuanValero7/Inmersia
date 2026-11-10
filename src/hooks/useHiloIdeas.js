// @ts-check
// Datos del hilo de ideas (no ficción) de un libro.
//
// Todo pasa por las funciones de la migración 100, como la mesa de Anderson:
// el contenido lleva las respuestas (qué pistas van en cada idea, cuáles son
// señuelos) y los ovillos se canjean por recompensas del profe, así que el
// navegador no decide nada. Recibe el tablero con lo que el alumno ya puede
// ver y, tras cada jugada, el tablero nuevo, que se guarda tal cual en la caché.
//
// Reglas del juego: Documentation/colegios/hilo-prompt.md.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

/** @typedef {import('../utils/hilo.js').EstadoHilo} EstadoHilo */

/**
 * @param {string|null} libroId
 * @param {string|null} userId
 */
export function useHiloIdeas(libroId, userId) {
  const queryClient = useQueryClient()
  const key = queryKeys.hiloIdeas(libroId, userId)

  const query = useQuery({
    queryKey: key,
    enabled: !!libroId && !!userId,
    // Sin la 100 aplicada la función no existe: se trata como «sin hilo», sin reintentar.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('hilo_tablero', { p_libro: libroId })
      if (error) throw error
      return /** @type {EstadoHilo|null} */ (data)
    },
  })

  const guardarEstado = (/** @type {{ estado: EstadoHilo }} */ r) => queryClient.setQueryData(key, r.estado)

  const jugar = useMutation({
    mutationFn: async (/** @type {{ idea: string, pistas: string[] }} */ { idea, pistas }) => {
      const { data, error } = await supabase.rpc('hilo_jugar', { p_libro: libroId, p_idea: idea, p_pistas: pistas })
      if (error) throw error
      return /** @type {{ resultado: 'acierto'|'casi'|'no_encajan', pareja?: string[], armadas: string[], premio: number, estado: EstadoHilo }} */ (data)
    },
    onSuccess: guardarEstado,
  })

  const ayuda = useMutation({
    mutationFn: async (/** @type {string} */ idea) => {
      const { data, error } = await supabase.rpc('hilo_ayuda', { p_libro: libroId, p_idea: idea })
      if (error) throw error
      return /** @type {{ estado: EstadoHilo }} */ (data)
    },
    onSuccess: guardarEstado,
  })

  return {
    /** @type {EstadoHilo|null} */
    estado: query.data ?? null,
    cargando: query.isLoading,
    // Sin contenido cargado para el libro (o sin la 100): la carpeta queda de relleno.
    tieneHilo: !!query.data,
    jugar: jugar.mutateAsync,
    pedirAyuda: ayuda.mutateAsync,
    ocupado: jugar.isPending || ayuda.isPending,
  }
}
