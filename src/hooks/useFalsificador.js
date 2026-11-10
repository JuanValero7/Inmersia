// @ts-check
// Datos del falsificador de un libro (no ficción, migración 099).
//
// El navegador recibe los párrafos sospechosos SIN saber cuáles son falsos ni
// qué dice el libro: eso llega al responder (falsificador_responder). Los
// falsos traen su texto, porque el lector los mete en el capítulo.
// Reglas del juego: Documentation/colegios/falsificador-prompt.md.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

/**
 * @typedef {import('../utils/falsificador.js').Item} Item
 * @typedef {{ saldo: number, autor: string, items: Item[] }} EstadoFalsificador
 * @typedef {{ acierto: boolean, premio: number, estado: EstadoFalsificador }} Veredicto
 */

/**
 * @param {string|null} libroId
 * @param {string|null} userId   sin usuario (invitado) no hay falsificador
 */
export function useFalsificador(libroId, userId) {
  const queryClient = useQueryClient()
  const key = queryKeys.falsificador(libroId, userId)
  const activo = !!libroId && !!userId

  const query = useQuery({
    queryKey: key,
    enabled: activo,
    // Sin la 099 aplicada la función no existe: se trata como «sin falsificador», sin reintentar.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('falsificador_libro', { p_libro: libroId })
      if (error) throw error
      return /** @type {EstadoFalsificador|null} */ (data)
    },
  })

  const responder = useMutation({
    mutationFn: async (/** @type {{ id: string, dice: 'autor'|'gato' }} */ { id, dice }) => {
      const { data, error } = await supabase.rpc('falsificador_responder', { p_libro: libroId, p_item: id, p_dice: dice })
      if (error) throw error
      return /** @type {Veredicto} */ (data)
    },
    // Los ovillos son los mismos de los otros juegos del libro.
    onSuccess: (r) => {
      queryClient.setQueryData(key, r.estado)
      queryClient.invalidateQueries({ queryKey: queryKeys.mesaInvestigacion(libroId, userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.corazonadas(libroId, userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.concurso(libroId, userId) })
    },
  })

  return {
    /** @type {EstadoFalsificador|null} */
    estado: query.data ?? null,
    // El lector espera a esto para paginar (el falso ocupa sitio en la página).
    // Sin usuario, sin la 099 o con error: listo enseguida y sin falsos.
    listo: !activo || query.isFetched || query.isError,
    responder: responder.mutateAsync,
    ocupado: responder.isPending,
  }
}
