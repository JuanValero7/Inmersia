// src/hooks/useFichaEnUrl.js
// ─────────────────────────────────────────────────────────────
// La ficha abierta vive en la URL: /tienda?libro=<slug>,
// /tienda/catalogo?libro=<slug>… (plan de la tienda, 3.4).
//   · se puede compartir y enlazar (la estantería de la landing, Instagram)
//   · Atrás del navegador o de Android la cierra sin salir de la página
// Sustituye a useFichaPedida (state.libro) y al pushState a mano que
// usaba el catálogo móvil.
//
// No se usa /libro/<slug>: esa ruta ya es el lector.
// ─────────────────────────────────────────────────────────────
import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * @param {Array<{ slug: string }>} catalogo  donde buscar el libro del slug
 * @returns {{ libro: object|null, abrir: (libro: object) => void, cerrar: () => void }}
 */
export function useFichaEnUrl(catalogo) {
  const location = useLocation()
  const navigate = useNavigate()
  const slug = new URLSearchParams(location.search).get('libro')

  const libro = useMemo(
    () => (slug && catalogo?.find(l => l.slug === slug)) || null,
    [slug, catalogo]
  )

  const destino = useCallback((valor) => {
    const p = new URLSearchParams(location.search)
    if (valor) p.set('libro', valor); else p.delete('libro')
    const q = p.toString()
    return { pathname: location.pathname, search: q ? `?${q}` : '' }
  }, [location.pathname, location.search])

  // Abrir apila una entrada en el historial (y la marca), para que Atrás cierre.
  const abrir = useCallback((l) => {
    navigate(destino(l.slug), { state: { ...(location.state || {}), fichaApilada: true } })
  }, [navigate, destino, location.state])

  // Cerrar deshace esa entrada. Si la ficha llegó por un enlace (no la
  // apilamos nosotros), se quita el parámetro sin añadir historial.
  const cerrar = useCallback(() => {
    if (location.state?.fichaApilada) navigate(-1)
    else navigate(destino(null), { replace: true, state: location.state })
  }, [navigate, destino, location.state])

  return { libro, abrir, cerrar }
}
