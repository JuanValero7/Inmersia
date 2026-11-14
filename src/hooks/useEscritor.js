// src/hooks/useEscritor.js
// ─────────────────────────────────────────────────────────────
// Datos del Rincón del escritor (/escritor). El esquema vive en la
// migración 103. Lo que importa aquí:
//   · escritores: si la cuenta tiene el modo escritor (lo activa Juan a
//     mano por ahora) y el saldo del cupón. Solo se lee la fila propia.
//   · libros con propietario_id = yo: la repisa. Un libro sin publicar
//     solo lo ve su dueño; eso lo impone la base, no esta pantalla.
//   · crear_libro_escritor / borrar_libro_escritor: el navegador nunca
//     escribe en libros, capitulos ni parrafos directamente.
// ─────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

const STALE_TIME = 60_000

/** Mensaje para el escritor según la pista (HINT) que devuelve la base. */
export function mensajeErrorEscritor(error, generico) {
  switch (error?.hint) {
    case 'no_escritor': return 'Tu cuenta no tiene el modo escritor.'
    case 'limite_libros': return 'Ya tienes 20 libros en tu repisa. Borra alguno para subir otro.'
    case 'demasiado_largo': return 'El libro es demasiado largo para subirlo de una vez. Escríbenos y lo vemos.'
    case 'datos_libro': return 'Falta el título o el nombre de autor.'
    case 'libro_invalido': return 'Ese libro ya no está en tu repisa.'
    case 'saldo_insuficiente': return 'Tu cupón no alcanza. Baja el tope de efectos o pon los sonidos a mano, que es gratis.'
    case 'trabajo_en_curso': return 'Ya le estamos poniendo sonido a este libro.'
    case 'no_ficcion': return 'Los libros de no ficción no llevan efectos.'
    case 'formato': return error.message || generico
    case 'imagen_invalida': return 'Esa imagen ya no está.'
    case 'limite_imagenes': return error.message || generico
    case 'duplicado': return error.message || generico
    case 'item_invalido': return 'Esa entrada ya no está. Recarga la página.'
    case 'ficcion': return error.message || generico
    case 'sin_cartelera': return error.message || generico
    default: return generico
  }
}

/**
 * La fila de escritores del usuario, o null si no tiene el modo escritor.
 * @returns {import('@tanstack/react-query').UseQueryResult<{ saldo_cupon: number }|null>}
 */
export function useEscritorQuery(userId) {
  return useQuery({
    queryKey: queryKeys.escritor(userId),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escritores').select('saldo_cupon').eq('user_id', userId).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/**
 * Los libros del escritor, del más nuevo al más viejo, con capítulos y palabras.
 * @returns {import('@tanstack/react-query').UseQueryResult<{ id: string, slug: string, titulo: string, autor: string, es_ficcion: boolean, portada_url: string|null, visible: boolean, capitulos: number, palabras: number }[]>}
 */
export function useLibrosEscritorQuery(userId, activo = true) {
  return useQuery({
    queryKey: queryKeys.librosEscritor(userId),
    enabled: !!userId && activo,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('libros')
        .select('id, slug, titulo, autor, es_ficcion, portada_url, visible, created_at, capitulos(palabras)')
        .eq('propietario_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []).map(({ capitulos, ...l }) => ({
        ...l,
        capitulos: capitulos?.length || 0,
        palabras: (capitulos || []).reduce((s, c) => s + (c.palabras || 0), 0),
      }))
    },
  })
}

/** Guarda el libro confirmado en la vista previa. Devuelve el id nuevo. */
export function useCrearLibroEscritor(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ titulo, autor, esFiccion, capitulos }) => {
      const { data, error } = await supabase.rpc('crear_libro_escritor', {
        p_titulo: titulo, p_autor: autor, p_es_ficcion: esFiccion, p_capitulos: capitulos,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.librosEscritor(userId) }),
  })
}

/** Borra un libro del escritor con todo lo que tiene. */
export function useBorrarLibroEscritor(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (libroId) => {
      const { error } = await supabase.rpc('borrar_libro_escritor', { p_libro: libroId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.librosEscritor(userId) }),
  })
}

// ── Sonido automático (migración 105) ─────────────────────────

/** Precios del Rincón (precios_escritor(), la misma cifra que cobra la base). */
export function usePreciosEscritor() {
  return useQuery({
    queryKey: ['preciosEscritor'],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('precios_escritor')
      if (error) throw error
      return data
    },
  })
}

const EN_MARCHA = ['pendiente', 'en_proceso']

/**
 * El último trabajo de un tipo para el libro («sonido», «portada», «fondo»…).
 * Mientras está en marcha se vuelve a pedir cada 10 s (sin Realtime,
 * decisión de Juan).
 */
export function useTrabajo(libroId, tipo) {
  return useQuery({
    queryKey: ['trabajo', libroId, tipo],
    enabled: !!libroId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trabajos')
        .select('id, estado, parametros, progreso, resultado, error, reservado, costo, creado, terminado')
        .eq('libro_id', libroId).eq('tipo', tipo)
        .order('creado', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      return data
    },
    refetchInterval: (q) => (EN_MARCHA.includes(q.state.data?.estado) ? 10_000 : false),
  })
}

export const useTrabajoSonido = (libroId) => useTrabajo(libroId, 'sonido')

/** Pide un trabajo a la cola. La base reserva del cupón lo que cueste. */
export function usePedirTrabajo(userId, libroId, tipo) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (parametros) => {
      const { data, error } = await supabase.rpc('pedir_trabajo', {
        p_libro: libroId, p_tipo: tipo, p_parametros: parametros,
      })
      if (error) throw error
      return data
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['trabajo', libroId, tipo] })
      qc.invalidateQueries({ queryKey: queryKeys.escritor(userId) })
    },
  })
}

/** Pide el sonido automático (migración 105). */
export function usePedirSonido(userId, libroId) {
  const m = usePedirTrabajo(userId, libroId, 'sonido')
  return { ...m, mutateAsync: ({ maxEfectos, ambientes }) => m.mutateAsync({ max_efectos: maxEfectos, ambientes }) }
}

// ── Imágenes (migración 106) ──────────────────────────────────

/**
 * Las imágenes del libro (borradores y guardadas), de la más nueva a la más vieja.
 * @returns {import('@tanstack/react-query').UseQueryResult<{ id: string, tipo: string, estado: 'borrador'|'guardada', url: string, url_movil: string|null, descripcion: string|null, nombre: string|null, capitulo: number|null, pie: string|null, creado: string }[]>}
 */
export function useImagenesLibro(libroId) {
  return useQuery({
    queryKey: ['imagenesLibro', libroId],
    enabled: !!libroId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('imagenes_escritor')
        .select('id, tipo, estado, url, url_movil, descripcion, nombre, capitulo, pie, creado, propuesta_id, datos')
        .eq('libro_id', libroId)
        .order('creado', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

function useAccionImagen(userId, libroId, rpc) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (imagenId) => {
      const { error } = await supabase.rpc(rpc, { p_imagen: imagenId })
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['imagenesLibro', libroId] })
      qc.invalidateQueries({ queryKey: queryKeys.librosEscritor(userId) })
    },
  })
}

/** Guardar: la portada o el fondo pasan al libro (y reemplazan al anterior). */
export const useGuardarImagen = (userId, libroId) => useAccionImagen(userId, libroId, 'guardar_imagen_escritor')
/** Descartar un borrador o quitar una imagen guardada. */
export const useDescartarImagen = (userId, libroId) => useAccionImagen(userId, libroId, 'descartar_imagen_escritor')

// ── Mis imágenes (migración 107) ──────────────────────────────

/** Capítulos del libro (número y título) para elegir dónde va una imagen. */
export function useCapitulosLibro(libroId) {
  return useQuery({
    queryKey: ['capitulosLibro', libroId],
    enabled: !!libroId,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capitulos').select('numero, titulo').eq('libro_id', libroId).order('numero')
      if (error) throw error
      return data || []
    },
  })
}

/**
 * Textos de unos párrafos del libro, por capítulo y número (para mostrar en
 * los editores de juegos el párrafo real o el de antes de un falso).
 * @param {string} libroId
 * @param {{ cap: number, parrafo: number }[]} donde
 * @returns {import('@tanstack/react-query').UseQueryResult<Record<string, string>>}  clave «cap:parrafo»
 */
export function useParrafosLibro(libroId, donde) {
  const claves = [...new Set(donde.map(d => `${d.cap}:${d.parrafo}`))].sort()
  return useQuery({
    queryKey: ['parrafosLibro', libroId, claves.join(',')],
    enabled: !!libroId && claves.length > 0,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data: caps, error: e1 } = await supabase
        .from('capitulos').select('id, numero').eq('libro_id', libroId).in('numero', [...new Set(donde.map(d => d.cap))])
      if (e1) throw e1
      const numDe = new Map((caps || []).map(c => [c.id, c.numero]))
      const { data, error } = await supabase.from('parrafos').select('capitulo_id, numero, contenido')
        .in('capitulo_id', [...numDe.keys()]).in('numero', [...new Set(donde.map(d => d.parrafo))])
      if (error) throw error
      const salida = {}
      for (const p of data || []) salida[`${numDe.get(p.capitulo_id)}:${p.numero}`] = p.contenido
      return salida
    },
  })
}

/**
 * ¿Está esta frase tal cual en ese capítulo? Devuelve el párrafo (o lanza el
 * error de la base, ya en llano). Para añadir pistas a Método Anderson (116).
 */
export async function ubicarCitaEscritor(libroId, cap, cita) {
  const { data, error } = await supabase.rpc('ubicar_cita_escritor', { p_libro: libroId, p_cap: cap, p_cita: cita })
  if (error) throw error
  return data
}

/**
 * Sube una imagen propia (ya en WebP) a la carpeta del escritor y la apunta.
 * La base comprueba que es suya y el tope de 20.
 */
export function useSubirImagenPropia(userId, libroId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ blob, capitulo, pie }) => {
      const ruta = `${userId}/${libroId}/${crypto.randomUUID()}.webp`
      const { error: e1 } = await supabase.storage.from('escritores')
        .upload(ruta, blob, { contentType: 'image/webp', upsert: false })
      if (e1) throw e1
      const url = supabase.storage.from('escritores').getPublicUrl(ruta).data.publicUrl
      const { data, error } = await supabase.rpc('registrar_imagen_propia', {
        p_libro: libroId, p_ruta: ruta, p_url: url, p_capitulo: capitulo ?? null, p_pie: pie || null,
      })
      if (error) throw error
      return data
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['imagenesLibro', libroId] }),
  })
}

/** Cambiar a qué capítulo va una imagen y su pie. */
export function useActualizarImagen(libroId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, capitulo, pie }) => {
      const { error } = await supabase.rpc('actualizar_imagen_escritor', {
        p_imagen: id, p_capitulo: capitulo ?? null, p_pie: pie || null,
      })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['imagenesLibro', libroId] }),
  })
}

// ── Propuestas de ilustración (migración 109) ─────────────────

/** La lista del autor: personajes, lugares y escenas que se pueden dibujar. */
export function usePropuestasIlustracion(libroId) {
  return useQuery({
    queryKey: ['propuestasIlustracion', libroId],
    enabled: !!libroId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ilustraciones_propuestas')
        .select('id, tipo, nombre, capitulo, descripcion, rol, editado, origen, creado')
        .eq('libro_id', libroId)
        .order('creado')
      if (error) throw error
      return data || []
    },
  })
}

/** Crear (id null) o editar una propuesta. */
export function useGuardarPropuesta(libroId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, tipo, nombre, capitulo, descripcion }) => {
      const { data, error } = await supabase.rpc('guardar_propuesta_ilustracion', {
        p_libro: libroId, p_id: id, p_tipo: tipo, p_nombre: nombre || null,
        p_capitulo: tipo === 'escena' ? capitulo : null, p_descripcion: descripcion,
      })
      if (error) throw error
      return data
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['propuestasIlustracion', libroId] }),
  })
}

export function useBorrarPropuesta(libroId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.rpc('borrar_propuesta_ilustracion', { p_id: id })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['propuestasIlustracion', libroId] }),
  })
}

// ── Análisis = cartelera editable (migración 111) ─────────────

/**
 * Toda la cartelera del libro (el dueño la lee entera; la base lo impone).
 * En tandas de 1000 (tope de PostgREST).
 */
export function useCarteleraEscritor(libroId) {
  return useQuery({
    queryKey: ['carteleraEscritor', libroId],
    enabled: !!libroId,
    queryFn: async () => {
      const filas = []
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase
          .from('cartelera_items')
          .select('id, seccion, nombre, descripcion, capitulo_numero, metadata, imagen:biblioteca_media!imagen_media_id(url)')
          .eq('libro_id', libroId)
          .order('capitulo_numero').order('id')
          .range(desde, desde + 999)
        if (error) throw error
        filas.push(...(data || []))
        if (!data || data.length < 1000) break
      }
      return filas
    },
  })
}

/**
 * Una RPC de edición de la cartelera (guardar_item_cartelera, borrar_item_cartelera,
 * renombrar_ficha_cartelera, borrar_ficha_cartelera, imagen_ficha_cartelera).
 * Recibe los parámetros sin p_libro.
 */
export function useEditarCartelera(libroId, rpc) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params) => {
      const { data, error } = await supabase.rpc(rpc, { p_libro: libroId, ...params })
      if (error) throw error
      return data
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['carteleraEscritor', libroId] }),
  })
}

/** Imagen principal de cada panel del tablero (cartelera_principal; migración 112). */
export function useCarteleraPrincipalEscritor(libroId) {
  return useQuery({
    queryKey: ['carteleraPrincipalEscritor', libroId],
    enabled: !!libroId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cartelera_principal')
        .select('seccion, imagen:biblioteca_media!imagen_media_id(url)')
        .eq('libro_id', libroId)
      if (error) throw error
      return Object.fromEntries((data || []).map(r => [r.seccion, r.imagen?.url || null]))
    },
  })
}

/** Elegir (o quitar, p_imagen null) la imagen principal de un panel. */
export function useImagenPrincipal(libroId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ seccion, imagen }) => {
      const { error } = await supabase.rpc('imagen_principal_cartelera', { p_libro: libroId, p_seccion: seccion, p_imagen: imagen })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['carteleraPrincipalEscritor', libroId] }),
  })
}

// ── Juegos (migración 113) ────────────────────────────────────

/** Pedidos de juegos de un libro (el escritor ve los suyos; el superusuario, todos). */
export function usePedidosJuegos(libroId) {
  return useQuery({
    queryKey: ['pedidosJuegos', libroId],
    enabled: !!libroId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos_juegos').select('id, juego, estado, nota, creado, actualizado')
        .eq('libro_id', libroId).order('creado')
      if (error) throw error
      return data || []
    },
  })
}

/** Pide juegos (array de ids). Devuelve lo que se cobró. */
export function usePedirJuegos(userId, libroId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (juegos) => {
      const { data, error } = await supabase.rpc('pedir_juegos', { p_libro: libroId, p_juegos: juegos })
      if (error) throw error
      return data
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['pedidosJuegos', libroId] })
      qc.invalidateQueries({ queryKey: queryKeys.escritor(userId) })
    },
  })
}

export function useCancelarJuego(userId, libroId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc('cancelar_juego', { p_id: id })
      if (error) throw error
      return data
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['pedidosJuegos', libroId] })
      qc.invalidateQueries({ queryKey: queryKeys.escritor(userId) })
    },
  })
}

/** Superusuario: todos los pedidos, con el libro. */
export function useTodosPedidosJuegos(activo) {
  return useQuery({
    queryKey: ['pedidosJuegosTodos'],
    enabled: !!activo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos_juegos')
        .select('id, libro_id, juego, estado, nota, creado, actualizado, libro:libros(titulo, autor, slug, es_ficcion)')
        .order('creado', { ascending: false }).limit(300)
      if (error) throw error
      return data || []
    },
  })
}

export function useActualizarPedidoJuego() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, estado, nota }) => {
      const { error } = await supabase.rpc('actualizar_pedido_juego', { p_id: id, p_estado: estado, p_nota: nota ?? null })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['pedidosJuegosTodos'] }),
  })
}

// ── Editar juegos (migración 114) ─────────────────────────────

/** El JSON de un juego del libro ({ datos, editado }). Solo el dueño. */
export function useJuegoEscritor(libroId, juego, activo = true) {
  return useQuery({
    queryKey: ['juegoEscritor', libroId, juego],
    enabled: !!libroId && !!juego && activo,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('juego_escritor', { p_libro: libroId, p_juego: juego })
      if (error) throw error
      return data
    },
  })
}

/**
 * Guardar un juego editado: rpc = 'editar_corazonadas' (p_items) o
 * 'editar_capsula' (p_preguntas); o 'restaurar_juego' (p_juego).
 */
export function useGuardarJuego(libroId, juego, rpc) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params) => {
      const { error } = await supabase.rpc(rpc, { p_libro: libroId, ...params })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['juegoEscritor', libroId, juego] }),
  })
}

/** Cambiar título y texto de una escena del avance de la tienda (migración 119). Gratis. */
export function useGuardarTextoAvance(libroId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orden, titulo, subtexto }) => {
      const { error } = await supabase.rpc('guardar_texto_avance', {
        p_libro: libroId, p_orden: orden, p_titulo: titulo, p_subtexto: subtexto,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.libroReels(libroId) }),
  })
}
