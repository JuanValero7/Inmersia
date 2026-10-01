// Datos + acciones de la Tienda, compartidos entre Tienda.jsx (desktop) y
// TiendaMobile.jsx (mobile) — antes vivían duplicados en ambos archivos, lo
// que ya causó una divergencia real (filtro `visible` solo en desktop).
//
// Catálogo y "libros del usuario" ahora vienen de las queries compartidas
// (src/lib/queries.js) con Biblioteca/Álbum en vez de un fetch propio.
import { useMemo } from 'react'
import { useCatalogoLibrosQuery, useBibliotecaUsuarioQuery } from '../lib/queries.js'
import { useCompraLibro, LIMITE_PENDIENTES } from './useCompraLibro.js'

// El listón "Nuevo" marca los libros que entraron en los últimos 30 días.
// Antes eran "los 5 más recientes", y en octubre de 2026 eso ponía "Nuevo" a
// tratados de julio (revisión de la tienda, 1 oct).
const DIAS_NUEVO = 30
const esNuevo = (creado, ahora) => !!creado && (ahora - new Date(creado)) / 864e5 <= DIAS_NUEVO

/**
 * Catálogo de la Tienda más el estado de compra (que tiene ya el usuario, cuantas
 * lecturas pendientes lleva y si el acceso está bloqueado por el tope).
 *
 * @param {{ id: string }|null} user
 * @param {boolean} isSuperuser
 * @param {(libro: object) => void} onOpenBook
 * @returns {object} catálogo, contadores y las operaciones de compra
 */
export function useTiendaData(user, isSuperuser, onOpenBook) {
  const catalogoQuery = useCatalogoLibrosQuery()
  const bibliotecaQuery = useBibliotecaUsuarioQuery(user?.id)

  const catalogo = useMemo(() => {
    const ahora = Date.now()
    return (catalogoQuery.data || []).map(l => ({ ...l, _nuevo: esNuevo(l.created_at, ahora) }))
  }, [catalogoQuery.data])

  const userLibros = useMemo(
    () => (bibliotecaQuery.data || []).map(r => ({ libro_id: r.libro_id, leido: r.leido })),
    [bibliotecaQuery.data]
  )

  const loading = catalogoQuery.isLoading || bibliotecaQuery.isLoading

  const pendientes      = userLibros.filter(l => !l.leido).length
  const accesoBloqueado = !isSuperuser && pendientes >= LIMITE_PENDIENTES
  const tieneLibro = id => userLibros.some(l => l.libro_id === id)

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

  return { catalogo, loading, pendientes, accesoBloqueado, tieneLibro, comprar, comprarYLeer }
}
