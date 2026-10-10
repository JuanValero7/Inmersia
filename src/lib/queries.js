// src/lib/queries.js
// ─────────────────────────────────────────────────────────────
// Queries de Supabase compartidas via React Query entre Biblioteca,
// Tienda, Álbum y Perfil — antes cada hook las pedía por separado
// (mismo perfil/catálogo/libros del usuario, 3-4 round trips al
// navegar entre secciones). Ahora una sola query cacheada por key,
// deduplicada automáticamente si dos componentes montan a la vez.
//
// staleTime moderado (60s): suficiente para no re-pedir en navegación
// rápida entre secciones, pero corto para que un dato desactualizado
// (compra, cambio de categoría, libro terminado) no quede pegado
// mucho tiempo aun si algún caller se olvida de invalidar a mano.
// Los mutation sites igual invalidan explícitamente para el caso
// típico (ver useCompraLibro, useBiblioteca, usePerfilData, Lector).
// ─────────────────────────────────────────────────────────────
import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase.js'
import { computeSesionStats } from '../hooks/useReadingStats.js'

const STALE_TIME = 60_000

export const queryKeys = {
  perfil: (userId) => ['perfil', userId],
  catalogoLibros: () => ['catalogoLibros'],
  bibliotecaUsuario: (userId) => ['bibliotecaUsuario', userId],
  // Comunidades (ver src/hooks/useComunidades.js)
  misComunidades: (userId) => ['misComunidades', userId],
  buscarComunidades: (texto) => ['buscarComunidades', texto],
  puedeCrearComunidad: (userId) => ['puedeCrearComunidad', userId],
  comunidad: (id) => ['comunidad', id],
  comunidadActiva: (userId) => ['comunidadActiva', userId],
  progresoComunidad: (id) => ['progresoComunidad', id],
  lecturasAnteriores: (id) => ['lecturasAnteriores', id],
  // Capa de comunidad en el lector (ver src/hooks/useCapaComunidad.js)
  comunidadesDelLibro: (userId, libroId, mias) => ['comunidadesDelLibro', userId, libroId, mias],
  miembrosCapa: (comunidadId) => ['miembrosCapa', comunidadId],
  comentariosCapa: (comunidadId, capituloId) => ['comentariosCapa', comunidadId, capituloId],
  mensajitosCapa: (comunidadId, libroId, userId) => ['mensajitosCapa', comunidadId, libroId, userId],
  // Denuncias (ver src/hooks/useDenuncias.js)
  denuncias: (pendientes) => ['denuncias', pendientes],
  // Hero "Seguir leyendo" de la Biblioteca (ver useBiblioteca)
  tiempoLibro: (userId, libroId) => ['tiempoLibro', userId, libroId],
  investigacionReciente: (libroId, completados) => ['investigacionReciente', libroId, completados],
  // «Anteriormente en…» de la ficha (ver useRepasoQuery)
  repaso: (userId, libroId, completados) => ['repaso', userId, libroId, completados],
  // Tienda (ver Documentation/tienda/plan-implementacion.md)
  salas: () => ['salas'],
  libroResumen: (libroId) => ['libroResumen', libroId],
  librosPalabras: () => ['librosPalabras'],
  libroReels: (libroId) => ['libroReels', libroId],
}

// perfiles.nombre/apellido — Biblioteca (saludo) y Perfil (formulario)
export function usePerfilQuery(userId) {
  return useQuery({
    queryKey: queryKeys.perfil(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfiles').select('nombre, apellido').eq('id', userId).maybeSingle()
      if (error) throw error
      return data || null
    },
    enabled: !!userId,
    staleTime: STALE_TIME,
  })
}

// libros visible=true, en el ORDEN CURADO por el autor (`libros.orden`, ver
// migración 047) — Tienda (catálogo completo) y Biblioteca (Novedades/
// Recomendaciones, un subconjunto del mismo dato).
//
// `orden` va NULLS LAST: un libro recién cargado, todavía sin puesto asignado,
// cae al final en vez de colarse arriba, y entre los que no tienen puesto manda
// el más reciente. `created_at` sigue viniendo porque de él —y no de la posición
// en esta lista— salen el listón "Nuevo" de la Tienda y las Novedades de la
// Biblioteca.
const CATALOGO_LIBROS_COLS =
  'id, slug, titulo, autor, paginas, descripcion, color, portada_url, metadata, anio, anio_texto, categorias, moods, es_ficcion, visible, created_at, orden'

export function useCatalogoLibrosQuery() {
  return useQuery({
    queryKey: queryKeys.catalogoLibros(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('libros').select(CATALOGO_LIBROS_COLS)
        .eq('visible', true)
        .order('orden', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data || []
    },
    staleTime: STALE_TIME,
  })
}

// Salas de la Tienda (migración 066) con los ids de sus libros en orden.
// Pocas filas y casi estáticas: se cachean igual que el catálogo y la ficha
// las usa para decir en qué sala está un libro.
export function useSalasQuery() {
  return useQuery({
    queryKey: queryKeys.salas(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salas')
        .select('id, slug, nombre, genero, linea, color, tipo, orden, desde, hasta, imagen_url, sala_libros(libro_id, orden)')
        .order('orden', { ascending: true })
      if (error) throw error
      return (data || []).map(s => ({
        ...s,
        libros: [...(s.sala_libros || [])].sort((a, b) => a.orden - b.orden).map(x => x.libro_id),
      }))
    },
    staleTime: STALE_TIME,
  })
}

// Lo que trae un libro (vista libros_resumen, migraciones 067 y 069):
// capítulos, palabras, ilustraciones, momentos con sonido, fichas y primera
// línea. Se pide por libro al abrir la ficha (~85 ms).
export function useLibroResumenQuery(libroId) {
  return useQuery({
    queryKey: queryKeys.libroResumen(libroId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('libros_resumen').select('*').eq('libro_id', libroId).maybeSingle()
      if (error) throw error
      return data || null
    },
    enabled: !!libroId,
    staleTime: 10 * 60_000,
  })
}

// Palabras de cada libro (libros_resumen): el carril «Se leen en una tarde»
// de la Tienda. Solo esa columna: la vista no calcula las demás (~60 ms).
export function useLibrosPalabrasQuery() {
  return useQuery({
    queryKey: queryKeys.librosPalabras(),
    queryFn: async () => {
      const { data, error } = await supabase.from('libros_resumen').select('libro_id, palabras')
      if (error) throw error
      return Object.fromEntries((data || []).map(r => [r.libro_id, r.palabras]))
    },
    staleTime: 10 * 60_000,
  })
}

// Escenas del avance de un libro (libro_reels): las usan la ficha (imagen de
// cabecera y número de escenas) y la historia.
export function useLibroReelsQuery(libroId) {
  return useQuery({
    queryKey: queryKeys.libroReels(libroId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('libro_reels')
        .select('id, orden, imagen_url, audio_url, titulo, subtexto')
        .eq('libro_id', libroId)
        .order('orden')
      if (error) throw error
      return data || []
    },
    enabled: !!libroId,
    staleTime: 10 * 60_000,
  })
}

// bibliotecas_usuarios ⋈ libros — "qué libros tiene el usuario", la query
// más repetida de la app (Biblioteca, Tienda, Álbum). Selecciona el
// superset de columnas que necesita cada consumidor.
const BIBLIOTECA_USUARIO_COLS =
  'libro_id, leido, categoria_id, libros(id, slug, titulo, autor, paginas, descripcion, color, portada_url, metadata, es_ficcion)'

export function useBibliotecaUsuarioQuery(userId) {
  return useQuery({
    queryKey: queryKeys.bibliotecaUsuario(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bibliotecas_usuarios').select(BIBLIOTECA_USUARIO_COLS).eq('user_id', userId)
      if (error) throw error
      return data || []
    },
    enabled: !!userId,
    staleTime: STALE_TIME,
  })
}

// Tiempo leído de un libro (segundos), para el chip "Llevas…" del hero.
// staleTime 0: se vuelve a pedir cada vez que se monta la Biblioteca, que es
// justo al salir del lector, cuando el tiempo acaba de cambiar. Mientras
// tanto se pinta el valor anterior de la caché.
export function useTiempoLibroQuery(userId, libroId) {
  return useQuery({
    queryKey: queryKeys.tiempoLibro(userId, libroId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sesiones_lectura').select('started_at, ended_at, segundos_activos')
        .eq('user_id', userId).eq('libro_id', libroId)
      if (error) throw error
      return computeSesionStats(data || []).totalSeg
    },
    enabled: !!userId && !!libroId,
    staleTime: 0,
  })
}

// Fichas de la Cartelera desbloqueadas con el último capítulo terminado
// (capitulo_numero = capítulo actual − 1): la nota "Nuevo en la
// investigación" del hero. No guarda qué vio el usuario: muestra siempre lo
// último desbloqueado, y cambia al terminar el siguiente capítulo.
// La clave lleva los capítulos completados, así que solo se vuelve a pedir si avanzó.
export function useInvestigacionRecienteQuery(libroId, completados) {
  return useQuery({
    queryKey: queryKeys.investigacionReciente(libroId, completados),
    queryFn: async () => {
      const capitulo = completados
      if (capitulo < 1) return { capitulo: 0, items: [] }
      const { data, error } = await supabase
        .from('cartelera_items').select('nombre, seccion')
        .eq('libro_id', libroId).eq('capitulo_numero', capitulo)
      if (error) throw error
      return { capitulo, items: data || [] }
    },
    enabled: !!libroId && completados > 0,
    staleTime: STALE_TIME,
  })
}

// «Anteriormente en…» de la ficha de la Biblioteca: los últimos capítulos
// TERMINADOS (hasta REPASO_MAX_CAPS), con lo que ya desbloqueó la Cartelera,
// así que no hay spoilers. Sin tabla propia; se pide al abrir la ficha y la
// clave lleva los capítulos completados, así que solo se vuelve a pedir si avanzó.
//   · Ficción: imagen + titulares de hasta 3 hechos. Imagen: una escena del
//     capítulo al azar → si no hay, un personaje o lugar que aparece en él →
//     si tampoco, null (la story se pinta como tarjeta de papel).
//   · No ficción: solo la infografía del capítulo; sin ella, el capítulo no entra.
// diasSinLeer: desde la última sesión de este libro (null si no hay ninguna).
export const REPASO_MAX_CAPS = 5

const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)]

export function useRepasoQuery(userId, libroId, completados, esFiccion) {
  return useQuery({
    queryKey: queryKeys.repaso(userId, libroId, completados),
    queryFn: async () => {
      const [capsRes, sesionRes] = await Promise.all([
        supabase.from('capitulos').select('id, numero, titulo').eq('libro_id', libroId).order('numero'),
        supabase.from('sesiones_lectura').select('started_at, ended_at')
          .eq('user_id', userId).eq('libro_id', libroId)
          .order('started_at', { ascending: false }).limit(1),
      ])
      if (capsRes.error) throw capsRes.error
      if (sesionRes.error) throw sesionRes.error

      const caps = capsRes.data || []
      const ultima = sesionRes.data?.[0]
      const marca = ultima ? new Date(ultima.ended_at || ultima.started_at).getTime() : null
      const diasSinLeer = marca ? Math.floor((Date.now() - marca) / 86_400_000) : null

      // Libro terminado: ya no hay nada que repasar.
      if (completados >= caps.length) return { capitulos: [], diasSinLeer }
      const hasta = completados
      const rango = caps.filter(c => c.numero >= hasta - REPASO_MAX_CAPS + 1 && c.numero <= hasta)
      if (!rango.length) return { capitulos: [], diasSinLeer }

      const [itemsRes, escenasRes] = await Promise.all([
        esFiccion
          ? supabase.from('cartelera_items')
            .select('seccion, nombre, capitulo_numero, imagen:biblioteca_media!imagen_media_id(url)')
            .eq('libro_id', libroId).lte('capitulo_numero', hasta)
            .in('seccion', ['hechos', 'personajes', 'lugares'])
          : { data: [] },
        supabase.from('elementos_interactivos')
          .select('media:biblioteca_media!inner(url, tipo), parrafo:parrafos!inner(capitulo_id)')
          .in('parrafo.capitulo_id', rango.map(c => c.id))
          .eq('media.tipo', 'imagen'),
      ])
      if (itemsRes.error) throw itemsRes.error
      if (escenasRes.error) throw escenasRes.error

      const items = itemsRes.data || []
      // Imagen de cada personaje/lugar: puede venir en cualquiera de sus filas
      // ya desbloqueadas, no necesariamente en la de este capítulo.
      const imagenDe = {}
      for (const it of items) {
        if (it.seccion !== 'hechos' && it.imagen?.url) imagenDe[`${it.seccion}:${it.nombre}`] ??= it.imagen.url
      }

      const capitulos = rango.map(c => {
        const escenas = (escenasRes.data || []).filter(e => e.parrafo.capitulo_id === c.id).map(e => e.media.url)
        const base = { numero: c.numero, titulo: c.titulo }
        if (!esFiccion) return escenas.length ? { ...base, tipo: 'infografia', imagen: escenas[0] } : null

        const titulares = items.filter(it => it.seccion === 'hechos' && it.capitulo_numero === c.numero)
          .slice(0, 3).map(it => it.nombre)
        if (escenas.length) return { ...base, tipo: 'imagen', imagen: alAzar(escenas), titulares }

        const conImagen = items.filter(it => it.seccion !== 'hechos' && it.capitulo_numero === c.numero
          && imagenDe[`${it.seccion}:${it.nombre}`])
        if (conImagen.length) {
          const it = alAzar(conImagen)
          return { ...base, tipo: 'imagen', imagen: imagenDe[`${it.seccion}:${it.nombre}`], titulares,
            etiqueta: { nombre: it.nombre, seccion: it.seccion } }
        }
        return { ...base, tipo: 'papel', titulares }
      }).filter(Boolean)

      return { capitulos, diasSinLeer }
    },
    enabled: !!userId && !!libroId && completados > 0,
    staleTime: STALE_TIME,
  })
}

// Invalidación a mano tras una escritura (compra, cambio de categoría,
// libro marcado leído/terminado desde el Lector) — no todos esos sitios
// pasan por los hooks de arriba, así que se expone suelta.
export function useInvalidateBibliotecaUsuario(userId) {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.bibliotecaUsuario(userId) }),
    [queryClient, userId]
  )
}
