// src/hooks/useFichaEnUrl.js
// ─────────────────────────────────────────────────────────────
// Un libro abierto que vive en la URL (plan de la tienda, 3.4):
//   · la ficha:    /tienda?libro=<slug>, /tienda/catalogo?libro=<slug>…
//   · la historia: /tienda/<sala>?historia=<slug> (sala en el móvil)
// Así se puede compartir y enlazar (la estantería de la landing,
// Instagram), y Atrás del navegador o de Android cierra la capa de
// arriba sin salir de la página: primero la ficha, luego la historia.
// Sustituye a useFichaPedida (state.libro) y al pushState a mano que
// usaba el catálogo móvil.
//
// No se usa /libro/<slug>: esa ruta ya es el lector.
// ─────────────────────────────────────────────────────────────
import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * @param {Array<{ slug: string }>} libros  donde buscar el libro del slug
 * @param {string} param                    nombre del parámetro de la URL
 * @returns {{ libro: object|null, abrir: (libro: object) => void,
 *   cambiar: (libro: object) => void, cerrar: () => void }}
 */
export function useLibroEnUrl(libros, param) {
  const location = useLocation()
  const navigate = useNavigate()
  const slug = new URLSearchParams(location.search).get(param)
  const marca = `apilado_${param}`

  const libro = useMemo(
    () => (slug && libros?.find(l => l.slug === slug)) || null,
    [slug, libros]
  )

  const destino = useCallback((valor) => {
    const p = new URLSearchParams(location.search)
    if (valor) p.set(param, valor); else p.delete(param)
    const q = p.toString()
    return { pathname: location.pathname, search: q ? `?${q}` : '' }
  }, [location.pathname, location.search, param])

  // Abrir apila una entrada en el historial (y la marca), para que Atrás cierre.
  const abrir = useCallback((l) => {
    navigate(destino(l.slug), { state: { ...(location.state || {}), [marca]: true } })
  }, [navigate, destino, location.state, marca])

  // Cambiar de libro sin abrir otra capa (deslizar en la historia):
  // reemplaza la entrada, así Atrás sigue cerrando de una vez.
  const cambiar = useCallback((l) => {
    navigate(destino(l.slug), { replace: true, state: location.state })
  }, [navigate, destino, location.state])

  // Cerrar deshace esa entrada. Si llegó por un enlace (no la apilamos
  // nosotros), se quita el parámetro sin añadir historial.
  const cerrar = useCallback(() => {
    if (location.state?.[marca]) navigate(-1)
    else navigate(destino(null), { replace: true, state: location.state })
  }, [navigate, destino, location.state, marca])

  return { libro, abrir, cambiar, cerrar }
}

/** La ficha abierta (?libro=<slug>). */
export function useFichaEnUrl(catalogo) {
  return useLibroEnUrl(catalogo, 'libro')
}
