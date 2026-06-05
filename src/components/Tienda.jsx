import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import LibroReel from './tienda/LibroReel.jsx'
import CalleEscena from './tienda/CalleEscena.jsx'
import CatalogoInterior from './tienda/CatalogoInterior.jsx'
import '../styles/tienda.css'

// =============================================================
// VistaTienda · Tienda Inmersia (estilo "Calle con imágenes")
// Cáscara de datos + orquestación. Conserva TODA la lógica real:
//   · fetch de catálogo (`libros`) y biblioteca del usuario
//   · bloqueo por lecturas pendientes (>= LIMITE)
//   · alta de compra en `bibliotecas_usuarios`
//   · preview con LibroReel
// La fachada (CalleEscena) y el interior (CatalogoInterior + PanelLibro)
// son solo presentación.
// =============================================================

const LIMITE = 5   // tope de lecturas pendientes
const NUEVOS = 5   // cuántos libros recientes llevan el listón "Nuevo"
const PAGE_SIZE = 20

export default function VistaTienda({ onGoBack, user }) {
  const [subView,       setSubView]       = useState('calle')   // 'calle' | 'catalogo'
  const [catalogo,      setCatalogo]      = useState([])
  const [userLibros,    setUserLibros]    = useState([])
  const [loading,       setLoading]       = useState(false)
  const [loadingMore,   setLoadingMore]   = useState(false)
  const [hasMore,       setHasMore]       = useState(false)
  const [catalogOffset, setCatalogOffset] = useState(0)
  const [reelLibro,     setReelLibro]     = useState(null)

  const pendientes      = userLibros.filter(l => !l.leido).length
  const accesoBloqueado = pendientes >= LIMITE
  const tieneLibro = id => userLibros.some(l => l.libro_id === id)
  const libroLeido = id => userLibros.some(l => l.libro_id === id && l.leido)

  const COLS_BASE = 'id, titulo, autor, paginas, descripcion, color, portada_url, anio, categorias, moods'

  const fetchPage = useCallback(async (offset, reset) => {
    if (reset) setLoading(true)
    else setLoadingMore(true)

    let tieneFecha = true
    let catRes = await supabase
      .from('libros')
      .select(`${COLS_BASE}, created_at`)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (catRes.error) {
      tieneFecha = false
      catRes = await supabase.from('libros').select(COLS_BASE)
        .range(offset, offset + PAGE_SIZE - 1)
    }

    const libros = catRes.data || []
    const nuevosIds = (reset && tieneFecha)
      ? new Set(libros.slice(0, NUEVOS).map(l => l.id))
      : new Set()
    const mapped = libros.map(l => ({ ...l, _nuevo: nuevosIds.has(l.id) }))

    setCatalogo(prev => reset ? mapped : [...prev, ...mapped])
    setHasMore(libros.length === PAGE_SIZE)

    if (reset) {
      const { data: ub } = await supabase
        .from('bibliotecas_usuarios').select('libro_id, leido').eq('user_id', user.id)
      setUserLibros(ub || [])
      setLoading(false)
    } else {
      setLoadingMore(false)
    }
  }, [user.id])

  const fetchTienda = useCallback(() => {
    setCatalogOffset(0)
    fetchPage(0, true)
  }, [fetchPage])

  const loadMore = useCallback(() => {
    const next = catalogOffset + PAGE_SIZE
    setCatalogOffset(next)
    fetchPage(next, false)
  }, [catalogOffset, fetchPage])

  useEffect(() => { fetchTienda() }, [fetchTienda])

  async function comprar(libro) {
    await supabase.from('bibliotecas_usuarios').insert({ user_id: user.id, libro_id: libro.id, leido: false })
    setUserLibros(prev => [...prev, { libro_id: libro.id, leido: false }])
  }

  // ── Fachada (calle) ─────────────────────────────────────────────
  if (subView === 'calle') {
    return (
      <CalleEscena
        pendientes={pendientes}
        limite={LIMITE}
        bloqueado={accesoBloqueado}
        onEntrar={() => setSubView('catalogo')}
        onGoBack={onGoBack}
      />
    )
  }

  // ── Interior (catálogo) ─────────────────────────────────────────
  return (
    <>
      <CatalogoInterior
        catalogo={catalogo}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        user={user}
        tieneLibro={tieneLibro}
        libroLeido={libroLeido}
        onComprar={comprar}
        onPreview={setReelLibro}
        onVolver={onGoBack}
      />

      {reelLibro && (
        <LibroReel libro={reelLibro} onClose={() => setReelLibro(null)} />
      )}
    </>
  )
}
