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
import { evento } from '../lib/analytics.js'
import { guardar, AVISOS } from '../lib/guardar.js'
import { mapLibro } from '../lib/libros.js'

export const LIMITE_PENDIENTES = 5

/**
 * Añadir un libro a la biblioteca del usuario.
 *
 * El tope de lecturas pendientes (LIMITE_PENDIENTES) es deliberado: a un lector que
 * no lee, una biblioteca de 40 libros sin empezar le da culpa, no ganas. Los
 * superusuarios no lo tienen.
 *
 * @param {{ id: string }|null} user
 * @param {boolean} isSuperuser
 * @param {(libro: object) => void} onOpenBook   qué hacer tras comprar y abrir
 * @returns {object} comprar y comprarYLeer, que devuelven { error } si no se pudo
 */
export function useCompraLibro(user, isSuperuser, onOpenBook) {
  const invalidateBiblioteca = useInvalidateBibliotecaUsuario(user?.id)

  const comprar = useCallback(async (libro, { pendientes = 0 } = {}) => {
    if (!user?.id) return { error: 'no-auth' }
    // Este chequeo es para responder al instante; el que manda es el de
    // adquirir_libro() en la base (migración 076).
    if (!isSuperuser && pendientes >= LIMITE_PENDIENTES) return { error: 'bloqueado' }
    const res = await supabase.rpc('adquirir_libro', { p_libro_id: libro.id })
    if (res.error?.hint === 'limite_pendientes') return { error: 'bloqueado' }
    // El aviso lo enseña <AvisoGuardado>: el catálogo, la tienda principal y la
    // Biblioteca ignoraban el { error } y el botón simplemente no hacía nada.
    const { ok, error } = await guardar(res, { que: 'adquirir libro', aviso: AVISOS.libro })
    if (!ok) return { error: error?.message || 'error' }
    invalidateBiblioteca()
    // "Comprado" es el nombre heredado del checklist; hoy adquirir es gratis.
    evento('libro_comprado', { libro_id: libro.id, slug: libro.slug ?? null })
    return { error: null }
  }, [user, isSuperuser, invalidateBiblioteca])

  const comprarYLeer = useCallback(async (libro, { pendientes = 0, tieneLibro } = {}) => {
    // Invitado: abre la muestra directamente (el lector limita a 2 caps por RLS);
    // no se adquiere nada porque no hay sesión. Usuario: si aún no lo tiene en su
    // biblioteca, lo adquiere antes de abrirlo.
    if (user?.id && !tieneLibro?.(libro.id)) {
      const { error } = await comprar(libro, { pendientes })
      if (error) return { error }
    }
    onOpenBook?.({ ...mapLibro(libro), progress: null })
    return { error: null }
  }, [comprar, onOpenBook, user])

  return { comprar, comprarYLeer, LIMITE: LIMITE_PENDIENTES }
}
