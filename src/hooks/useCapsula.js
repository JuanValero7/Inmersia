// @ts-check
// Datos de la cápsula del tiempo de un libro de no ficción (migración 098).
//
// Al empezar el libro el alumno responde unas preguntas abiertas y la cápsula
// se sella; al terminarlo responde lo mismo sin ver lo de antes, y entonces la
// base de datos le devuelve las dos respuestas. Sin IA y sin ovillos.
// Aquí sí se guarda lo que escribe el alumno: lo lee su profe (y lo sabe).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

/**
 * @typedef {import('../utils/capsula.js').EstadoCapsula} EstadoCapsula
 */

/** Error con el código fijo de la base de datos (ya_sellada, ya_empezaste…). */
export class ErrorCapsula extends Error {
  /** @param {string} codigo */
  constructor(codigo) { super(codigo); this.codigo = codigo }
}

const CODIGOS = ['ya_sellada', 'ya_empezaste', 'sin_sellar', 'ya_abierta', 'respuestas_incompletas', 'respuesta_larga']

/** @param {{ message?: string }} error */
const aError = (error) => new ErrorCapsula(CODIGOS.find(c => error?.message?.includes(c)) || 'no_se_puede')

/**
 * @param {string|null} libroId
 * @param {string|null} userId   sin usuario (invitado) no hay cápsula
 */
export function useCapsula(libroId, userId) {
  const queryClient = useQueryClient()
  const key = queryKeys.capsula(libroId, userId)

  const query = useQuery({
    queryKey: key,
    enabled: !!libroId && !!userId,
    // Sin la 098 aplicada la función no existe: se trata como «sin cápsula», sin reintentar.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('capsula_libro', { p_libro: libroId })
      if (error) throw error
      return /** @type {EstadoCapsula|null} */ (data)
    },
  })

  const guardar = useMutation({
    mutationFn: async (/** @type {{ paso: 'sellar'|'abrir', respuestas: string[] }} */ { paso, respuestas }) => {
      const { data, error } = await supabase.rpc(paso === 'sellar' ? 'capsula_sellar' : 'capsula_abrir',
        { p_libro: libroId, p_respuestas: respuestas })
      if (error) throw aError(error)
      return /** @type {EstadoCapsula} */ (data)
    },
    onSuccess: (estado) => queryClient.setQueryData(key, estado),
    // Si ya estaba sellada o abierta (otra pestaña), se trae lo de verdad.
    onError: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  return {
    /** @type {EstadoCapsula|null} */
    estado: query.data ?? null,
    listo: !libroId || !userId || query.isFetched || query.isError,
    /** @type {(respuestas: string[]) => Promise<EstadoCapsula>} */
    sellar: (respuestas) => guardar.mutateAsync({ paso: 'sellar', respuestas }),
    /** @type {(respuestas: string[]) => Promise<EstadoCapsula>} */
    abrir: (respuestas) => guardar.mutateAsync({ paso: 'abrir', respuestas }),
    ocupado: guardar.isPending,
  }
}
