// src/hooks/useCompraLibro.js
// ─────────────────────────────────────────────────────────────
// Primitivas puras de compra, compartidas entre Tienda (desktop +
// mobile) y el panel de libro in-place de Biblioteca (Novedades /
// Recomendaciones). NO tocan estado de UI (userLibros, books) —
// cada caller sincroniza el suyo tras un resultado exitoso, igual
// que las primitivas de useBiblioteca.js.
//
// El límite de lecturas pendientes (LIMITE) se chequea ACÁ, no solo
// en la puerta de la Tienda (CalleEscena) — así cualquier punto de
// entrada respeta la misma regla de negocio, incluso si no pasa
// por esa fachada.
// ─────────────────────────────────────────────────────────────
import { useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { useInvalidateBibliotecaUsuario } from '../lib/queries.js'

export const LIMITE_PENDIENTES = 5

export function useCompraLibro(user, isSuperuser, onOpenBook) {
  const invalidateBiblioteca = useInvalidateBibliotecaUsuario(user?.id)

  const comprar = useCallback(async (libro, { pendientes = 0 } = {}) => {
    if (!user?.id) return { error: 'no-auth' }
    if (!isSuperuser && pendientes >= LIMITE_PENDIENTES) return { error: 'bloqueado' }
    const { error } = await supabase.from('bibliotecas_usuarios').insert({ user_id: user.id, libro_id: libro.id, leido: false })
    if (error) { console.error('No se pudo adquirir el libro:', error.message); return { error: error.message } }
    invalidateBiblioteca()
    return { error: null }
  }, [user, isSuperuser, invalidateBiblioteca])

  const comprarYLeer = useCallback(async (libro, { pendientes = 0, tieneLibro } = {}) => {
    if (!tieneLibro?.(libro.id)) {
      const { error } = await comprar(libro, { pendientes })
      if (error) return { error }
    }
    onOpenBook?.({
      id: libro.id,
      libro_id: libro.id,
      slug: libro.slug,
      title: libro.titulo,
      author: libro.autor || 'Desconocido',
      pages: libro.paginas || 200,
      _baseColor: libro.color || '#cf8a6e',
      summary: libro.descripcion || '',
      cover: libro.portada_url || null,
      es_ficcion: libro.es_ficcion ?? true,
      progress: null,
    })
    return { error: null }
  }, [comprar, onOpenBook])

  return { comprar, comprarYLeer, LIMITE: LIMITE_PENDIENTES }
}
