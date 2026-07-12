// Búsqueda + filtro por categoría/tipo + paginación del catálogo de la
// Tienda, compartido entre CatalogoInterior.jsx (desktop) y
// CatalogoInteriorMobile.jsx (mobile) — antes duplicado idéntico en ambos.
// La presentación del filtro (chips inline vs. overlay a pantalla completa)
// sí difiere entre plataformas y queda en cada componente.
import { useState, useMemo, useEffect, useRef } from 'react'
import { PG_SIZE } from '../components/tienda/catalogoShared.jsx'

export function useCatalogoFiltro(catalogo, filtroTipo, tieneLibro) {
  const [selCats, setSelCats] = useState(new Set())
  const [qInput,  setQInput]  = useState('')
  const [q,       setQ]       = useState('')
  const [page,    setPage]    = useState(1)
  const gridRef = useRef(null)

  const availableCats = useMemo(() => [...new Set(catalogo.flatMap(b => b.categorias || []))].sort(), [catalogo])
  const query = q.trim().toLowerCase()

  const toggleCat = (c) => setSelCats(prev => {
    const next = new Set(prev)
    if (next.has(c)) next.delete(c); else next.add(c)
    return next
  })

  const handleQChange = (value) => {
    setQInput(value)
    if (!value) setQ('')
  }
  const handleQKeyDown = (e) => {
    if (e.key === 'Enter') setQ(qInput)
    if (e.key === 'Escape') { setQInput(''); setQ('') }
  }

  const list = useMemo(() => {
    const filtered = catalogo.filter(b => {
      const okCat  = selCats.size === 0 || (b.categorias || []).some(c => selCats.has(c))
      const okQ    = !query ||
        (b.titulo || '').toLowerCase().includes(query) ||
        (b.autor  || '').toLowerCase().includes(query)
      const okTipo = filtroTipo === 'todos' ||
        (filtroTipo === 'ficcion' ? b.es_ficcion !== false : b.es_ficcion === false)
      return okCat && okQ && okTipo
    })
    return filtered.sort((a, b) => (tieneLibro(a.id) ? 1 : 0) - (tieneLibro(b.id) ? 1 : 0))
  }, [catalogo, selCats, query, filtroTipo, tieneLibro])

  useEffect(() => { setPage(1) }, [q, filtroTipo, selCats])

  const paginatedList = list.slice((page - 1) * PG_SIZE, page * PG_SIZE)

  function goToPage(p) {
    setPage(p)
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const clearCats = () => setSelCats(new Set())

  // onFiltroTipo se pasa acá (en vez de recibirlo el hook por prop propia)
  // porque solo hace falta en el momento de limpiar filtros.
  const resetFiltro = (onFiltroTipo) => { clearCats(); setQ(''); setQInput(''); onFiltroTipo?.('todos') }

  return {
    selCats, toggleCat, clearCats, qInput, q, handleQChange, handleQKeyDown,
    availableCats, list, paginatedList, page, goToPage, gridRef, resetFiltro,
  }
}
