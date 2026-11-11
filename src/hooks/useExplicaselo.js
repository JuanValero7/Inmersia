// @ts-check
// Datos de Explícaselo a… de un libro (no ficción): una charla a mitad y otra
// al final, cada una con el personaje que tocó en la ruleta.
//
// El estado se lee con `explicaselo_libro` y la ruleta se gira con
// `explicaselo_girar` (migración 101: el personaje lo sortea la base de datos).
// Cada mensaje del alumno va a la función del servidor `explicaselo-evaluar`
// (supabase/functions/explicaselo-evaluar), que habla con Gemini, guarda los
// dos mensajes y devuelve el estado nuevo. Los puntos clave y la referencia
// solo llegan con la charla terminada.
//
// Se guarda lo que escribe el alumno: la charla la lee su profe.
// Reglas: Documentation/colegios/explicaselo-prompt.md.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

/**
 * @typedef {import('../utils/explicaselo.js').MomentoEx} MomentoEx
 * @typedef {{ version: number, max_turnos: number, con_profe: boolean, saldo: number, momentos: MomentoEx[] }} EstadoExplicaselo
 * @typedef {{ mensaje: string, terminada: boolean, resultado: null|'entendio'|'casi'|'igual', premio: number, estado: EstadoExplicaselo }} RespuestaPersonaje
 */

/** Error con el código de la función del servidor o de la base de datos (vuelve_manana, regla_frases, sin_ovillos…). */
export class ErrorExplicaselo extends Error {
  /** @param {string} codigo @param {string} [raiz] */
  constructor(codigo, raiz) { super(codigo); this.codigo = codigo; this.raiz = raiz }
}

/**
 * @param {string|null} libroId
 * @param {string|null} userId   sin usuario (invitado) no hay juego
 */
export function useExplicaselo(libroId, userId) {
  const queryClient = useQueryClient()
  const key = queryKeys.explicaselo(libroId, userId)

  const query = useQuery({
    queryKey: key,
    enabled: !!libroId && !!userId,
    // Sin la 101 aplicada la función no existe: se trata como «sin juego», sin reintentar.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('explicaselo_libro', { p_libro: libroId })
      if (error) throw error
      return /** @type {EstadoExplicaselo|null} */ (data)
    },
  })

  // Los ovillos son los mismos de los otros juegos del libro.
  const refrescarOvillos = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.hiloIdeas(libroId, userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.falsificador(libroId, userId) })
  }

  const girar = useMutation({
    mutationFn: async (/** @type {string} */ momento) => {
      const { data, error } = await supabase.rpc('explicaselo_girar', { p_libro: libroId, p_momento: momento })
      if (error) throw new ErrorExplicaselo(error.message?.includes('sin_ovillos') ? 'sin_ovillos' : 'no_se_puede')
      return /** @type {{ personaje: string, estado: EstadoExplicaselo }} */ (data)
    },
    onSuccess: (r) => { queryClient.setQueryData(key, r.estado); refrescarOvillos() },
  })

  const enviar = useMutation({
    mutationFn: async (/** @type {{ momento: string, texto: string }} */ { momento, texto }) => {
      const { data, error } = await supabase.functions.invoke('explicaselo-evaluar', {
        body: { libro: libroId, momento, texto },
      })
      if (error) {
        // La función contesta { error: 'codigo' } con un estado HTTP de error.
        let cuerpo = { error: 'no_se_puede', raiz: undefined }
        try { cuerpo = { ...cuerpo, ...(await error.context.json()) } } catch { /* sin cuerpo: red caída */ }
        throw new ErrorExplicaselo(cuerpo.error, cuerpo.raiz)
      }
      return /** @type {RespuestaPersonaje} */ (data)
    },
    onSuccess: (r) => { queryClient.setQueryData(key, r.estado); if (r.premio) refrescarOvillos() },
  })

  return {
    /** @type {EstadoExplicaselo|null} */
    estado: query.data ?? null,
    girar: girar.mutateAsync,
    enviar: enviar.mutateAsync,
    ocupado: girar.isPending || enviar.isPending,
  }
}
