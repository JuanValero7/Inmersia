// src/hooks/useFichaPedida.js
// ─────────────────────────────────────────────────────────────
// Abre la ficha de un libro al llegar a /tienda con `state.libro` (slug).
// Lo usa la estantería de la landing: tocar una portada lleva a su ficha.
// Se aplica una sola vez por navegación (location.key): si el catálogo se
// vuelve a pedir, la ficha no se reabre sola tras cerrarla.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * @param {Array<{slug: string}>} catalogo
 * @param {(libro: object) => void} abrir  normalmente el setter del libro seleccionado
 */
export function useFichaPedida(catalogo, abrir) {
  const location = useLocation()
  const slug = location.state?.libro
  const aplicada = useRef(null)

  useEffect(() => {
    if (!slug || !catalogo?.length || aplicada.current === location.key) return
    const libro = catalogo.find((l) => l.slug === slug)
    if (!libro) return
    aplicada.current = location.key
    abrir(libro)
  }, [slug, catalogo, abrir, location.key])
}
