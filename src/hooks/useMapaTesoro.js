// @ts-check
// Datos del mapa del tesoro de un libro (encontrar frases del capítulo
// subrayándolas).
//
// Todo pasa por las funciones de la migración 091: las frases buenas nunca
// llegan al navegador. Recibe un «estado» con las fichas, los brillos y lo ya
// encontrado y, tras cada subrayado, el estado nuevo, que se guarda tal cual en
// la caché.
//
// Reglas del juego: Documentation/colegios/mapa-tesoro-prompt.md.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

/**
 * @typedef {{ id: string, cap: number, tipo: 'vista'|'escondido', spoiler: boolean, pregunta: string,
 *   brillo: [number, number], encontrado: boolean, parrafo?: number, cita?: string, porque?: string }} Tesoro
 * @typedef {{ version: number, saldo: number, tesoros: Tesoro[] }} EstadoMapa
 * @typedef {'tesoro'|'ya_encontrado'|'cerca'|'no'} Resultado
 */

/**
 * @param {string|null} libroId
 * @param {string|null} userId   sin usuario (invitado) no hay mapa
 */
export function useMapaTesoro(libroId, userId) {
  const queryClient = useQueryClient()
  const key = queryKeys.mapaTesoro(libroId, userId)
  const activa = !!libroId && !!userId

  const query = useQuery({
    queryKey: key,
    enabled: activa,
    // Sin la 091 aplicada la función no existe: se trata como «sin mapa», sin reintentar.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mapa_libro', { p_libro: libroId })
      if (error) throw error
      return /** @type {EstadoMapa|null} */ (data)
    },
  })

  const subrayar = useMutation({
    mutationFn: async (/** @type {{ cap: number, parrafo: number, texto: string }} */ { cap, parrafo, texto }) => {
      const { data, error } = await supabase.rpc('mapa_subrayar', { p_libro: libroId, p_capitulo: cap, p_parrafo: parrafo, p_texto: texto })
      if (error) throw error
      return /** @type {{ resultado: Resultado, tesoro?: string, ovillos: number, estado: EstadoMapa }} */ (data)
    },
    // Los ovillos son los mismos que gastan la mesa, las corazonadas y el concurso.
    onSuccess: (r) => {
      queryClient.setQueryData(key, r.estado)
      queryClient.invalidateQueries({ queryKey: queryKeys.mesaInvestigacion(libroId, userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.corazonadas(libroId, userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.concurso(libroId, userId) })
    },
  })

  return {
    /** @type {EstadoMapa|null} */
    estado: query.data ?? null,
    subrayar: subrayar.mutateAsync,
    ocupado: subrayar.isPending,
  }
}
