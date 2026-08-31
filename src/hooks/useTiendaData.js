// Datos + acciones de la Tienda, compartidos entre Tienda.jsx (desktop) y
// TiendaMobile.jsx (mobile) — antes vivían duplicados en ambos archivos, lo
// que ya causó una divergencia real (filtro `visible` solo en desktop).
//
// Catálogo y "libros del usuario" ahora vienen de las queries compartidas
// (src/lib/queries.js) con Biblioteca/Álbum en vez de un fetch propio.
import { useMemo } from 'react'
import { useCatalogoLibrosQuery, useBibliotecaUsuarioQuery } from '../lib/queries.js'
import { useCompraLibro, LIMITE_PENDIENTES } from './useCompraLibro.js'

const NUEVOS = 5   // cuántos libros recientes llevan el listón "Nuevo"

// Los N libros de alta más reciente. Antes era `libros.slice(0, NUEVOS)`, que
// solo funcionaba porque el catálogo venía ordenado por fecha: desde que manda
// el orden curado (libros.orden, migración 047) esa versión marcaba como
// "Nuevo" a los cinco primeros del estante — hoy El Principito y compañía.
function idsMasNuevos(libros, n) {
  return new Set(
    [...libros]
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, n)
      .map(l => l.id)
  )
}

export function useTiendaData(user, isSuperuser, onOpenBook) {
  const catalogoQuery = useCatalogoLibrosQuery()
  const bibliotecaQuery = useBibliotecaUsuarioQuery(user?.id)

  const catalogo = useMemo(() => {
    const libros = catalogoQuery.data || []
    const nuevosIds = idsMasNuevos(libros, NUEVOS)
    return libros.map(l => ({ ...l, _nuevo: nuevosIds.has(l.id) }))
  }, [catalogoQuery.data])

  const userLibros = useMemo(
    () => (bibliotecaQuery.data || []).map(r => ({ libro_id: r.libro_id, leido: r.leido })),
    [bibliotecaQuery.data]
  )

  const loading = catalogoQuery.isLoading || bibliotecaQuery.isLoading

  const pendientes      = userLibros.filter(l => !l.leido).length
  const accesoBloqueado = !isSuperuser && pendientes >= LIMITE_PENDIENTES
  const tieneLibro = id => userLibros.some(l => l.libro_id === id)
  const libroLeido = id => userLibros.some(l => l.libro_id === id && l.leido)

  const { comprar: comprarLibro, comprarYLeer: comprarYLeerLibro } = useCompraLibro(user, isSuperuser, onOpenBook)

  // comprarLibro/comprarYLeerLibro ya invalidan la query compartida al
  // escribir en bibliotecas_usuarios (ver useCompraLibro.js) — no hace
  // falta sincronizar estado local acá, el refetch actualiza `userLibros`.
  async function comprar(libro) {
    const { error } = await comprarLibro(libro, { pendientes })
    return { error }
  }

  async function comprarYLeer(libro) {
    const { error } = await comprarYLeerLibro(libro, { pendientes, tieneLibro })
    return { error }
  }

  return { catalogo, loading, pendientes, accesoBloqueado, tieneLibro, libroLeido, comprar, comprarYLeer }
}
