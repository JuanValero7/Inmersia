// @ts-check
// Datos de las corazonadas de un libro (predicciones con ovillos en mitad de
// la lectura).
//
// Todo pasa por las funciones de la migración 089: el contenido lleva las
// respuestas y los ovillos se canjean por recompensas del profe, así que el
// navegador no decide nada. Recibe un «estado» con lo que el alumno puede ver
// (sin la correcta hasta que cobra) y, tras cada jugada, el estado nuevo, que
// se guarda tal cual en la caché.
//
// Reglas del juego: Documentation/colegios/corazonadas-prompt.md.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

/**
 * @typedef {{ cap: number, parrafo: number }} Lugar
 * @typedef {{ id: string, sorpresa: boolean, pregunta: string, contexto: string, opciones: string[],
 *   chip: Lugar, rev: Lugar, estado: null|'jugada'|'cobrada'|'perdida', opcion: number|null, ovillos: number|null,
 *   acierto?: boolean, correcta?: number, resultado?: string, pistas?: string[] }} Corazonada
 * @typedef {{ version: number, saldo: number, corazonadas: Corazonada[] }} EstadoCorazonadas
 */

/**
 * @param {string|null} libroId
 * @param {string|null} userId   sin usuario (invitado) no hay corazonadas
 */
export function useCorazonadas(libroId, userId) {
  const queryClient = useQueryClient()
  const key = queryKeys.corazonadas(libroId, userId)
  const activa = !!libroId && !!userId

  const query = useQuery({
    queryKey: key,
    enabled: activa,
    // Sin la 089 aplicada la función no existe: se trata como «sin corazonadas», sin reintentar.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('corazonadas_libro', { p_libro: libroId })
      if (error) throw error
      return /** @type {EstadoCorazonadas|null} */ (data)
    },
  })

  // Los ovillos son los mismos que gasta la mesa de investigación.
  const guardarEstado = (/** @type {{ estado: EstadoCorazonadas }} */ r) => {
    queryClient.setQueryData(key, r.estado)
    queryClient.invalidateQueries({ queryKey: queryKeys.mesaInvestigacion(libroId, userId) })
  }

  const jugar = useMutation({
    mutationFn: async (/** @type {{ id: string, opcion: number, ovillos: number }} */ { id, opcion, ovillos }) => {
      const { data, error } = await supabase.rpc('corazonada_jugar', { p_libro: libroId, p_corazonada: id, p_opcion: opcion, p_ovillos: ovillos })
      if (error) throw error
      return data
    },
    onSuccess: guardarEstado,
  })

  const llegar = useMutation({
    mutationFn: async (/** @type {string} */ id) => {
      const { data, error } = await supabase.rpc('corazonada_llegar', { p_libro: libroId, p_corazonada: id })
      if (error) throw error
      return data
    },
    onSuccess: (r) => queryClient.setQueryData(key, r.estado),
  })

  const cobrar = useMutation({
    mutationFn: async (/** @type {string} */ id) => {
      const { data, error } = await supabase.rpc('corazonada_cobrar', { p_libro: libroId, p_corazonada: id })
      if (error) throw error
      return /** @type {{ acierto: boolean, premio: number, estado: EstadoCorazonadas }} */ (data)
    },
    onSuccess: guardarEstado,
  })

  return {
    /** @type {EstadoCorazonadas|null} */
    estado: query.data ?? null,
    // El lector espera a esto para paginar (el chip ocupa sitio en la página).
    // Sin usuario, sin la 089 o con error: listo enseguida y sin chips.
    listo: !activa || query.isFetched || query.isError,
    jugar: jugar.mutateAsync,
    llegar: llegar.mutate,
    cobrar: cobrar.mutateAsync,
    ocupado: jugar.isPending || cobrar.isPending,
  }
}
