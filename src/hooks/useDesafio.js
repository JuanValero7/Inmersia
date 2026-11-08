// @ts-check
// Datos del desafío del gato de un libro: una charla a mitad y otra al final.
//
// La charla se lee con `desafio_libro` (migración 092). Cada mensaje del
// alumno va a la función del servidor `desafio-evaluar`
// (supabase/functions/desafio-evaluar), que habla con Gemini, guarda los dos
// mensajes y devuelve el estado nuevo. El navegador nunca ve la hoja del gato
// ni el resumen para el profe.
//
// Aquí sí se guarda lo que escribe el alumno: la charla la lee su profe.
// Reglas: Documentation/colegios/desafio-prompt.md.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

/**
 * @typedef {import('../utils/desafio.js').Momento} Momento
 * @typedef {{ version: number, max_turnos: number, con_profe: boolean, momentos: Momento[] }} EstadoDesafio
 * @typedef {{ mensaje: string, terminada: boolean, estado: EstadoDesafio }} RespuestaGato
 */

/** Error con el código que devuelve la función del servidor (vuelve_manana, muy_corta…). */
export class ErrorDesafio extends Error {
  /** @param {string} codigo */
  constructor(codigo) { super(codigo); this.codigo = codigo }
}

/**
 * @param {string|null} libroId
 * @param {string|null} userId   sin usuario (invitado) no hay desafío
 */
export function useDesafio(libroId, userId) {
  const queryClient = useQueryClient()
  const key = queryKeys.desafio(libroId, userId)

  const query = useQuery({
    queryKey: key,
    enabled: !!libroId && !!userId,
    // Sin la 092 aplicada la función no existe: se trata como «sin desafío», sin reintentar.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('desafio_libro', { p_libro: libroId })
      if (error) throw error
      return /** @type {EstadoDesafio|null} */ (data)
    },
  })

  const enviar = useMutation({
    mutationFn: async (/** @type {{ momento: string, texto: string }} */ { momento, texto }) => {
      const { data, error } = await supabase.functions.invoke('desafio-evaluar', {
        body: { libro: libroId, momento, texto },
      })
      if (error) {
        // La función contesta { error: 'codigo' } con un estado HTTP de error.
        let codigo = 'no_se_puede'
        try { codigo = (await error.context.json()).error || codigo } catch { /* sin cuerpo: red caída */ }
        throw new ErrorDesafio(codigo)
      }
      return /** @type {RespuestaGato} */ (data)
    },
    onSuccess: (r) => queryClient.setQueryData(key, r.estado),
  })

  return {
    /** @type {EstadoDesafio|null} */
    estado: query.data ?? null,
    enviar: enviar.mutateAsync,
    ocupado: enviar.isPending,
  }
}
