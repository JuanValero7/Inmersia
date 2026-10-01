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
import { capituloActualDesdePct } from '../components/cartelera/carteleraHelpers.js'

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
  investigacionReciente: (libroId, pct) => ['investigacionReciente', libroId, pct],
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
  'id, slug, titulo, autor, paginas, descripcion, color, portada_url, metadata, anio, categorias, moods, es_ficcion, visible, created_at, orden'

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
// La clave lleva el porcentaje, así que solo se vuelve a pedir si avanzó.
export function useInvestigacionRecienteQuery(libroId, pct) {
  return useQuery({
    queryKey: queryKeys.investigacionReciente(libroId, pct),
    queryFn: async () => {
      const { count, error: errCaps } = await supabase
        .from('capitulos').select('id', { count: 'exact', head: true }).eq('libro_id', libroId)
      if (errCaps) throw errCaps
      const capitulo = capituloActualDesdePct(pct, count ?? 0) - 1
      if (capitulo < 1) return { capitulo: 0, items: [] }
      const { data, error } = await supabase
        .from('cartelera_items').select('nombre, seccion')
        .eq('libro_id', libroId).eq('capitulo_numero', capitulo)
      if (error) throw error
      return { capitulo, items: data || [] }
    },
    enabled: !!libroId && pct > 0,
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
