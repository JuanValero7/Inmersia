// @ts-check
// Qué juegos de lectura están encendidos (migraciones 093 y 098).
//
// Fuera del aula manda el usuario (su Perfil); en un aula que lee ese libro,
// el profe. La regla vive en la base de datos (juegos_libro): aquí solo se
// pregunta. Por defecto, en ficción: mesa, corazonadas y mapa encendidos;
// concurso y desafío apagados. En no ficción (libros.es_ficcion = false):
// cápsula e hilo encendidos; falsificador y explícaselo apagados.
// Apagar un juego solo lo esconde: lo jugado no se borra. Un juego solo sale
// si el libro tiene su contenido cargado.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

/** @typedef {'mesa'|'corazonadas'|'mapa'|'concurso'|'desafio'|'capsula'|'hilo'|'falsificador'|'explicaselo'} Juego */
/** @typedef {Record<Juego, boolean>} Juegos */

/**
 * Los juegos que ya existen, en el orden del Perfil. `noficcion` = de los
 * libros de no ficción. Explícaselo ya tiene su interruptor en la base de
 * datos; se suma aquí cuando esté hecho.
 */
export const JUEGOS = /** @type {const} */ ([
  { id: 'mesa', nombre: 'Mesa de investigación', texto: 'Arma el perfil de los personajes con las pistas del libro.', noficcion: false },
  { id: 'corazonadas', nombre: 'Corazonadas', texto: 'Apuesta ovillos a lo que crees que va a pasar.', noficcion: false },
  { id: 'mapa', nombre: 'Mapa del tesoro', texto: 'Encuentra las frases escondidas de cada capítulo.', noficcion: false },
  { id: 'concurso', nombre: 'El concurso', texto: 'Explica con tus palabras una frase difícil.', noficcion: false },
  { id: 'desafio', nombre: 'Desafío del gato', texto: 'Una charla con tu gato a mitad del libro y al final.', noficcion: false },
  { id: 'capsula', nombre: 'Cápsula del tiempo', texto: 'Guarda lo que piensas antes de leer y compáralo al terminar.', noficcion: true },
  { id: 'hilo', nombre: 'Hilo de ideas', texto: 'Une las pistas de cada capítulo hasta llegar a la idea del libro.', noficcion: true },
  { id: 'falsificador', nombre: 'El falsificador', texto: 'El gato coló párrafos inventados en el libro: descubre cuáles.', noficcion: true },
])

/** Lo mismo que _juegos_por_defecto() de la 098: se usa mientras llega la respuesta. */
export const JUEGOS_POR_DEFECTO = /** @type {Juegos} */ ({
  mesa: true, corazonadas: true, mapa: true, concurso: false, desafio: false,
  capsula: true, hilo: true, falsificador: false, explicaselo: false,
})

/**
 * Los juegos de un libro. Mientras carga, los valores por defecto; `listo`
 * dice cuándo ya son los de verdad (el lector espera para paginar, porque
 * los chips de corazonada ocupan sitio).
 * @param {string|null} libroId
 * @param {string|null} userId   sin usuario (invitado) no hay juegos
 */
export function useJuegosLibro(libroId, userId) {
  const activa = !!libroId && !!userId
  const query = useQuery({
    queryKey: queryKeys.juegosLibro(libroId, userId),
    enabled: activa,
    // Sin la 093 aplicada la función no existe: valores por defecto, sin reintentar.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('juegos_libro', { p_libro: libroId })
      if (error) throw error
      return /** @type {Juegos & { fuente: 'aula'|'perfil' }} */ (data)
    },
  })
  const { fuente = 'perfil', ...juegos } = query.data ?? { ...JUEGOS_POR_DEFECTO }
  return {
    /** @type {Juegos} */
    juegos: /** @type {Juegos} */ (juegos),
    /** @type {'aula'|'perfil'} */
    fuente,
    listo: !activa || query.isFetched || query.isError,
  }
}

/**
 * Lo del Perfil: los interruptores. Solo lo usa la sección de juegos del Perfil.
 * @param {string|null} userId
 */
export function useMisJuegos(userId) {
  const queryClient = useQueryClient()
  const key = queryKeys.misJuegos(userId)

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mis_juegos')
      if (error) throw error
      return /** @type {{ juegos: Juegos, en_aula: boolean }} */ (data)
    },
  })

  const cambiar = useMutation({
    mutationFn: async (/** @type {{ juego: Juego, encendido: boolean }} */ { juego, encendido }) => {
      const { data, error } = await supabase.rpc('juegos_guardar', { p_juego: juego, p_encendido: encendido })
      if (error) throw error
      return data
    },
    // El interruptor se mueve al momento; si falla, vuelve atrás.
    onMutate: async ({ juego, encendido }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const antes = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (/** @type {any} */ d) => d && { ...d, juegos: { ...d.juegos, [juego]: encendido } })
      return { antes }
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(key, ctx?.antes),
    onSuccess: (data) => queryClient.setQueryData(key, data),
    // Los libros ya abiertos vuelven a preguntar qué juegos tienen.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['juegos', 'libro'] }),
  })

  return {
    /** @type {Juegos|null} */
    juegos: query.data?.juegos ?? null,
    enAula: !!query.data?.en_aula,
    error: query.isError,
    cambiar: (/** @type {Juego} */ juego, /** @type {boolean} */ encendido) => cambiar.mutate({ juego, encendido }),
    fallo: cambiar.isError,
  }
}
