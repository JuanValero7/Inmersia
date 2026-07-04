import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
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

export default function VistaTienda({ onGoBack, user, onOpenBook, isSuperuser = false }) {
  const [subView,    setSubView]    = useState(!user ? 'catalogo' : 'calle')   // 'calle' | 'catalogo'
  const [catalogo,   setCatalogo]   = useState([])
  const [userLibros, setUserLibros] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('todos') // 'todos' | 'ficcion' | 'noficcion'

  const pendientes      = userLibros.filter(l => !l.leido).length
  const accesoBloqueado = !isSuperuser && pendientes >= LIMITE
  const tieneLibro = id => userLibros.some(l => l.libro_id === id)
  const libroLeido = id => userLibros.some(l => l.libro_id === id && l.leido)

  const COLS_BASE = 'id, slug, titulo, autor, paginas, descripcion, color, portada_url, anio, categorias, moods, es_ficcion, visible'

  const reqIdRef = useRef(0)
  useEffect(() => () => { reqIdRef.current++ }, [])

  const fetchTienda = useCallback(async () => {
    const myId = ++reqIdRef.current
    setLoading(true)

    let tieneFecha = true
    let catRes = await supabase
      .from('libros')
      .select(`${COLS_BASE}, created_at`)
      .eq('visible', true)
      .order('created_at', { ascending: false })
    if (catRes.error) {
      tieneFecha = false
      catRes = await supabase.from('libros').select(COLS_BASE).eq('visible', true)
    }
    if (myId !== reqIdRef.current) return

    const libros = catRes.data || []
    const nuevosIds = tieneFecha ? new Set(libros.slice(0, NUEVOS).map(l => l.id)) : new Set()
    setCatalogo(libros.map(l => ({ ...l, _nuevo: nuevosIds.has(l.id) })))

    if (user?.id) {
      const { data: ub } = await supabase
        .from('bibliotecas_usuarios').select('libro_id, leido').eq('user_id', user.id)
      if (myId !== reqIdRef.current) return
      setUserLibros(ub || [])
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => { fetchTienda() }, [fetchTienda])

  async function comprar(libro) {
    if (!user?.id) return
    const { error } = await supabase.from('bibliotecas_usuarios').insert({ user_id: user.id, libro_id: libro.id, leido: false })
    if (error) { console.error('No se pudo adquirir el libro:', error.message); return }
    setUserLibros(prev => [...prev, { libro_id: libro.id, leido: false }])
  }

  async function comprarYLeer(libro) {
    if (!tieneLibro(libro.id)) await comprar(libro)
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
  }

  // ── Fachada (calle) ─────────────────────────────────────────────
  const handleEntrar = () => {
    setSubView('catalogo')
  }

  if (subView === 'calle') {
    return (
      <CalleEscena
        pendientes={pendientes}
        limite={LIMITE}
        bloqueado={accesoBloqueado}
        onEntrar={handleEntrar}
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
        user={user}
        tieneLibro={tieneLibro}
        libroLeido={libroLeido}
        onComprar={comprar}
        onEmpezarLeer={comprarYLeer}
        onVolver={onGoBack}
        filtroTipo={filtroTipo}
        onFiltroTipo={setFiltroTipo}
      />

    </>
  )
}
