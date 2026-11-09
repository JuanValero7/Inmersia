// @ts-check
// Tienda de recompensas (migraciones 095 y 097: bote de la clase).
//
// Alumno: la tienda entera en una llamada (tienda_recompensas): libros con
// los que puede pagar, saldo, vales de su profe, expedientes y sus canjes.
// Todo lo decide la base de datos (precios, límites, saldo); la página solo
// muestra. Tras canjear se vuelve a pedir la tienda y se avisa a los juegos
// del lector, que enseñan el mismo saldo de ovillos.
//
// Profe: la pestaña «Recompensas» del Salón (recompensas_aula) y sus acciones.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'
import { evento } from '../lib/analytics.js'

/**
 * @typedef {{ id: string, titulo: string, de_aula: boolean }} LibroTienda
 * @typedef {{ id: string, titulo: string, precio: number, limite: string, aula: string,
 *   bloqueo: null|'ya_canjeado'|'esta_semana'|'agotado'|'lleno'|'entregado', desde: string|null,
 *   juntado: number|null, mio: number|null }} Vale   juntado/mio solo en botes
 * @typedef {{ id: string, titulo: string, descripcion: string, precio: number, comprado: boolean }} Expediente
 * @typedef {{ tipo: 'vale'|'expediente'|'bote', id: string, titulo: string, precio: number,
 *   estado: 'pendiente'|'entregado'|'devuelto'|'abierto'|'aportado'|'lleno', fecha: string }} Canje
 * @typedef {{ libros: LibroTienda[], libro_id: string|null, saldo?: number, solo_leyendo?: number,
 *   recompensas?: Vale[], expedientes?: Expediente[], canjes?: Canje[] }} Tienda
 */

// Los juegos del lector guardan el saldo en su propia caché.
const JUEGOS = ['mesaInvestigacion', 'corazonadas', 'concurso', 'mapaTesoro']

/**
 * @param {string|null|undefined} userId
 * @param {string|null} libroId   null = el que elija la base de datos (el del aula)
 */
export function useTiendaRecompensas(userId, libroId) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.tiendaRecompensas(userId, libroId),
    enabled: !!userId,
    retry: false,   // sin la 095 aplicada la función no existe
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tienda_recompensas', { p_libro: libroId })
      if (error) throw error
      return /** @type {Tienda} */ (data)
    },
  })

  const despues = (/** @type {string|null} */ libro) => {
    queryClient.invalidateQueries({ queryKey: ['tiendaRecompensas', userId] })
    for (const k of JUEGOS) queryClient.invalidateQueries({ queryKey: [k, libro] })
  }

  const canjearVale = useMutation({
    mutationFn: async (/** @type {Vale} */ v) => {
      const { data, error } = await supabase.rpc('recompensa_canjear', { p_recompensa: v.id })
      if (error) throw error
      return data
    },
    onSuccess: () => evento('recompensa_canjeada'),
    // También si falla (otro se llevó el vale único): la tienda vuelve a pedir el estado.
    onSettled: () => despues(query.data?.libro_id ?? null),
  })

  const comprarExpediente = useMutation({
    mutationFn: async (/** @type {Expediente} */ e) => {
      const { data, error } = await supabase.rpc('expediente_comprar', { p_libro: query.data?.libro_id, p_expediente: e.id })
      if (error) throw error
      return data
    },
    onSuccess: () => evento('expediente_comprado'),
    onSettled: () => despues(query.data?.libro_id ?? null),
  })

  // Bote de la clase: pone los ovillos que quiera (si pide más de lo que falta, pone lo que falta).
  const aportarBote = useMutation({
    mutationFn: async (/** @type {{ vale: Vale, cantidad: number }} */ { vale, cantidad }) => {
      const { data, error } = await supabase.rpc('recompensa_aportar', { p_recompensa: vale.id, p_cantidad: cantidad })
      if (error) throw error
      return /** @type {{ saldo: number, puesto: number, juntado: number, lleno: boolean }} */ (data)
    },
    onSuccess: () => evento('bote_aportado'),
    onSettled: () => despues(query.data?.libro_id ?? null),
  })

  return { tienda: query.data ?? null, cargando: query.isLoading, error: query.isError, canjearVale, comprarExpediente, aportarBote }
}

/**
 * El texto de un expediente comprado: solo cuando se abre.
 * @param {string|null} libroId
 * @param {string|null} id
 */
export function useExpediente(libroId, id) {
  return useQuery({
    queryKey: queryKeys.expediente(libroId, id),
    enabled: !!libroId && !!id,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('expediente_leer', { p_libro: libroId, p_expediente: id })
      if (error) throw error
      return /** @type {{ titulo: string, descripcion: string, parrafos: string[] }} */ (data)
    },
  })
}

// ── Profe ────────────────────────────────────────────────────

/** @param {string|null|undefined} aulaId */
export function useRecompensasAula(aulaId) {
  return useQuery({
    queryKey: queryKeys.recompensasAula(aulaId),
    enabled: !!aulaId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('recompensas_aula', { p_aula: aulaId })
      if (error) throw error
      return data
    },
  })
}

/** @param {string|null|undefined} aulaId */
export function useGestionRecompensas(aulaId) {
  const queryClient = useQueryClient()
  const refrescar = () => queryClient.invalidateQueries({ queryKey: queryKeys.recompensasAula(aulaId) })
  const opciones = (/** @type {string} */ fn, /** @type {string} */ ev) => ({
    mutationFn: async (/** @type {Record<string, unknown>} */ args) => {
      const { data, error } = await supabase.rpc(fn, args)
      if (error) throw error
      return data
    },
    onSuccess: () => { refrescar(); evento(ev) },
  })
  const crear = useMutation(opciones('recompensa_crear', 'recompensa_creada'))
  const activar = useMutation(opciones('recompensa_activar', 'recompensa_activada'))
  const borrar = useMutation(opciones('recompensa_borrar', 'recompensa_borrada'))
  const resolver = useMutation(opciones('canje_resolver', 'canje_resuelto'))
  const entregarBote = useMutation(opciones('bote_entregar', 'bote_entregado'))
  return { crear, activar, borrar, resolver, entregarBote }
}
