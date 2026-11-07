// @ts-check
// Datos del concurso de un libro («¿qué quiso decir aquí?»).
//
// Las frases, los comodines y el 50/50 pasan por las funciones de la migración
// 090. La respuesta escrita va a la función del servidor `concurso-evaluar`
// (supabase/functions/concurso-evaluar), la única que habla con Gemini. El
// navegador no decide nada: recibe un «estado» con lo que el alumno puede ver
// (sin la referencia hasta el veredicto) y, tras cada jugada, el estado nuevo.
//
// Lo que escribe el alumno no se guarda en ningún sitio (decisión de Juan).
// Reglas del juego: Documentation/colegios/concurso-prompt.md.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

/**
 * @typedef {{ parrafo: number, cita: string }} Contexto
 * @typedef {{ id: string, cap: number, parrafo: number, cita: string, pregunta: string,
 *   estado: 'abierta'|'evaluando'|'resuelta', contexto: Contexto|null, opciones: string[]|null,
 *   veredicto: null|'correcto'|'casi'|'no', referencia?: string, correcta?: number|null }} Frase
 * @typedef {{ version: number, saldo: number, frases: Frase[] }} EstadoConcurso
 * @typedef {{ veredicto: 'correcto'|'casi'|'no', premio: number, explicacion?: string|null, estado: EstadoConcurso }} Veredicto
 */

/** Error con el código que devuelve la función del servidor (vuelve_manana, ia_no_disponible…). */
export class ErrorConcurso extends Error {
  /** @param {string} codigo */
  constructor(codigo) { super(codigo); this.codigo = codigo }
}

/**
 * @param {string|null} libroId
 * @param {string|null} userId   sin usuario (invitado) no hay concurso
 */
export function useConcurso(libroId, userId) {
  const queryClient = useQueryClient()
  const key = queryKeys.concurso(libroId, userId)

  const query = useQuery({
    queryKey: key,
    enabled: !!libroId && !!userId,
    // Sin la 090 aplicada la función no existe: se trata como «sin concurso», sin reintentar.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('concurso_libro', { p_libro: libroId })
      if (error) throw error
      return /** @type {EstadoConcurso|null} */ (data)
    },
  })

  // Los ovillos son los mismos de la mesa de investigación y las corazonadas.
  const guardarEstado = (/** @type {{ estado: EstadoConcurso }} */ r) => {
    queryClient.setQueryData(key, r.estado)
    queryClient.invalidateQueries({ queryKey: queryKeys.mesaInvestigacion(libroId, userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.corazonadas(libroId, userId) })
  }

  const comodin = useMutation({
    mutationFn: async (/** @type {{ id: string, cual: 'contexto'|'cincuenta' }} */ { id, cual }) => {
      const { data, error } = await supabase.rpc('concurso_comodin', { p_libro: libroId, p_frase: id, p_cual: cual })
      if (error) throw error
      return data
    },
    onSuccess: guardarEstado,
  })

  const elegir = useMutation({
    mutationFn: async (/** @type {{ id: string, opcion: number }} */ { id, opcion }) => {
      const { data, error } = await supabase.rpc('concurso_elegir', { p_libro: libroId, p_frase: id, p_opcion: opcion })
      if (error) throw error
      return /** @type {Veredicto} */ (data)
    },
    onSuccess: guardarEstado,
  })

  const evaluar = useMutation({
    mutationFn: async (/** @type {{ id: string, respuesta: string }} */ { id, respuesta }) => {
      const { data, error } = await supabase.functions.invoke('concurso-evaluar', {
        body: { libro: libroId, frase: id, respuesta },
      })
      if (error) {
        // La función contesta { error: 'codigo' } con un estado HTTP de error.
        let codigo = 'ia_no_disponible'
        try { codigo = (await error.context.json()).error || codigo } catch { /* sin cuerpo: red caída */ }
        throw new ErrorConcurso(codigo)
      }
      return /** @type {Veredicto} */ (data)
    },
    onSuccess: guardarEstado,
  })

  return {
    /** @type {EstadoConcurso|null} */
    estado: query.data ?? null,
    comodin: comodin.mutateAsync,
    elegir: elegir.mutateAsync,
    evaluar: evaluar.mutateAsync,
    ocupado: comodin.isPending || elegir.isPending || evaluar.isPending,
  }
}
