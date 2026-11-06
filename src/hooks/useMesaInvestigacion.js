// @ts-check
// Datos de la mesa de investigación (método Anderson) de un libro.
//
// Todo pasa por las funciones de la migración 087: el contenido lleva las
// respuestas (qué pistas van juntas, cuál es la conclusión correcta) y los
// ovillos se canjean por recompensas del profe, así que el navegador no decide
// nada. Recibe un «estado» con lo que el alumno ya puede ver y, tras cada
// jugada, el estado nuevo, que se guarda tal cual en la caché.
//
// Reglas del juego: Documentation/colegios/anderson-prompt.md.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

/**
 * @typedef {{ id: string, nombre: string, corto: string, total: number, hechas: number,
 *   por_descubrir: number, mas_adelante: number, nuevas: number,
 *   deducciones: { id: string, texto: string, confirman: number }[] }} PersonajeMesa
 * @typedef {{ id: string, pj: string, cap: number, parrafo: number, resumen: string, cita: string }} PistaMesa
 * @typedef {{ jugada: string, personaje: string, pistas: string[], opciones: string[], tachadas: number[] }} JugadaAbierta
 * @typedef {{ version: number, capitulos_completados: number, total_capitulos: number, saldo: number,
 *   personajes: PersonajeMesa[], pistas: PistaMesa[], cartas: { id: string, pj: string, texto: string }[],
 *   parejas: string[][], abierta: JugadaAbierta|null,
 *   faltaron: { pj: string, texto: string, pistas: string[] }[]|null }} EstadoMesa
 */

/**
 * @param {string|null} libroId
 * @param {string|null} userId
 */
export function useMesaInvestigacion(libroId, userId) {
  const queryClient = useQueryClient()
  const key = queryKeys.mesaInvestigacion(libroId, userId)

  const query = useQuery({
    queryKey: key,
    enabled: !!libroId && !!userId,
    // Sin la 087 aplicada la función no existe: se trata como «sin mesa», sin reintentar.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('anderson_mesa', { p_libro: libroId })
      if (error) throw error
      return /** @type {EstadoMesa|null} */ (data)
    },
  })

  const guardarEstado = (/** @type {{ estado: EstadoMesa }} */ r) => queryClient.setQueryData(key, r.estado)

  const jugar = useMutation({
    mutationFn: async (/** @type {{ personaje: string, pistas: string[] }} */ { personaje, pistas }) => {
      const { data, error } = await supabase.rpc('anderson_jugar', { p_libro: libroId, p_personaje: personaje, p_pistas: pistas })
      if (error) throw error
      return data
    },
    onSuccess: guardarEstado,
  })

  const elegir = useMutation({
    mutationFn: async (/** @type {{ jugada: string, opcion: number }} */ { jugada, opcion }) => {
      const { data, error } = await supabase.rpc('anderson_elegir', { p_jugada: jugada, p_opcion: opcion })
      if (error) throw error
      return data
    },
    onSuccess: guardarEstado,
  })

  return {
    /** @type {EstadoMesa|null} */
    estado: query.data ?? null,
    cargando: query.isLoading,
    // Sin contenido cargado para el libro (o sin la 087): la carpeta queda de relleno.
    tieneMesa: !!query.data,
    jugar: jugar.mutateAsync,
    elegir: elegir.mutateAsync,
    ocupado: jugar.isPending || elegir.isPending,
  }
}

/**
 * Lo que enseña la carpeta del centro del tablero.
 * @param {EstadoMesa|null} estado
 */
export function resumenMesa(estado) {
  if (!estado) return null
  const ps = estado.personajes
  const suma = (/** @type {keyof PersonajeMesa} */ k) => ps.reduce((n, p) => n + /** @type {number} */ (p[k]), 0)
  const hechas = suma('hechas'), total = suma('total')
  const porDescubrir = suma('por_descubrir')
  const terminado = estado.total_capitulos > 0 && estado.capitulos_completados >= estado.total_capitulos
  const sello = ps.length === 0 ? { txt: 'Sin pistas aún', cls: 'is-empty' }
    : terminado && hechas === total ? { txt: 'Expediente completo', cls: 'is-done' }
    : { txt: 'Caso abierto', cls: 'is-open' }
  return { hechas, total, porDescubrir, sello, hayPersonajes: ps.length > 0 }
}
