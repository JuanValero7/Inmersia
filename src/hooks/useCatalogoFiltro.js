// Búsqueda + filtro por categoría/tipo + paginación del catálogo de la
// Tienda, compartido entre la tienda principal (resultados), el catálogo
// completo de escritorio y el móvil.
// La presentación del filtro (chips inline vs. hoja inferior) sí difiere
// entre pantallas y queda en cada componente.
import { useState, useMemo, useEffect, useRef } from 'react'
import { PG_SIZE } from '../components/tienda/catalogoShared.jsx'
import { evento } from '../lib/analytics.js'

// Sin tildes ni mayúsculas: «platon» encuentra a Platón y «fantasia» a Fantasía.
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Una búsqueda se registra cuando el lector deja de escribir, no letra a letra.
const ESPERA_ANALITICA_MS = 1200

/**
 * Buscador, filtro por categorías y paginación del catálogo de la Tienda.
 * Todo el trabajo es en memoria sobre el catálogo ya cargado: no consulta nada.
 *
 * @param {object[]} catalogo                         catálogo completo
 * @param {'todos'|'ficcion'|'noficcion'} filtroTipo  filtro de la barra superior
 * @param {(id: string) => boolean} tieneLibro        si el usuario ya tiene ese libro
 * @param {object} [opciones]
 * @param {boolean} [opciones.amplia]    busca también en categorías y sinopsis
 *                                       («piratas», «fantasma»); el catálogo
 *                                       completo busca solo título y autor
 * @param {string}  [opciones.qInicial]  búsqueda con la que arranca (?q= de la sala)
 * @param {string}  [opciones.donde]     pantalla, para la analítica de búsquedas
 * @returns {object} estado del filtro y la lista ya paginada (paginatedList)
 */
export function useCatalogoFiltro(catalogo, filtroTipo, tieneLibro, { amplia = false, qInicial = '', donde = '' } = {}) {
  const [selCats, setSelCats] = useState(new Set())
  const [q, setQ] = useState(qInicial)
  const [page, setPage] = useState(1)
  const gridRef = useRef(null)

  const availableCats = useMemo(() => [...new Set(catalogo.flatMap(b => b.categorias || []))].sort(), [catalogo])
  const query = normalizar(q).trim()

  const toggleCat = (c) => setSelCats(prev => {
    const next = new Set(prev)
    if (next.has(c)) next.delete(c); else next.add(c)
    return next
  })

  // La búsqueda es en vivo: con unas decenas de libros en memoria es instantánea.
  const handleQChange = (value) => setQ(value)
  const handleQKeyDown = (e) => { if (e.key === 'Escape') setQ('') }

  const list = useMemo(() => {
    const filtered = catalogo.filter(b => {
      const okCat  = selCats.size === 0 || (b.categorias || []).some(c => selCats.has(c))
      const campos = amplia
        ? [b.titulo, b.autor, (b.categorias || []).join(' '), b.descripcion]
        : [b.titulo, b.autor]
      const okQ    = !query || campos.some(f => normalizar(f).includes(query))
      const okTipo = filtroTipo === 'todos' ||
        (filtroTipo === 'ficcion' ? b.es_ficcion !== false : b.es_ficcion === false)
      return okCat && okQ && okTipo
    })
    return filtered.sort((a, b) => (tieneLibro(a.id) ? 1 : 0) - (tieneLibro(b.id) ? 1 : 0))
  }, [catalogo, selCats, query, filtroTipo, tieneLibro, amplia])

  useEffect(() => { setPage(1) }, [query, filtroTipo, selCats])

  // Las búsquedas sin resultado dicen qué falta en el catálogo.
  const total = list.length
  useEffect(() => {
    if (!donde || !query) return
    const t = setTimeout(() => evento('tienda_busqueda', { termino: query, resultados: total, donde }), ESPERA_ANALITICA_MS)
    return () => clearTimeout(t)
  }, [query, total, donde])

  const paginatedList = list.slice((page - 1) * PG_SIZE, page * PG_SIZE)

  function goToPage(p) {
    setPage(p)
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const clearCats = () => setSelCats(new Set())

  // onFiltroTipo se pasa acá (en vez de recibirlo el hook por prop propia)
  // porque solo hace falta en el momento de limpiar filtros.
  const resetFiltro = (onFiltroTipo) => { clearCats(); setQ(''); onFiltroTipo?.('todos') }

  return {
    selCats, toggleCat, clearCats,
    q, handleQChange, handleQKeyDown,
    availableCats, list, paginatedList, page, goToPage, gridRef, resetFiltro,
  }
}
