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

const STALE_TIME = 60_000

export const queryKeys = {
  perfil: (userId) => ['perfil', userId],
  catalogoLibros: () => ['catalogoLibros'],
  bibliotecaUsuario: (userId) => ['bibliotecaUsuario', userId],
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
