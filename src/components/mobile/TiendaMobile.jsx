import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import CalleEscena from '../tienda/CalleEscena.jsx'
import CatalogoInteriorMobile from './tienda/CatalogoInteriorMobile.jsx'
import '../../styles/tienda.css'
import { runGuidedTiendaCalle, runGuidedTiendaInterior } from '../tutorial.js'
import { getTourPhase, setTourPhase } from '../guidedTour.js'

const LIMITE = 5
const NUEVOS = 5

export default function VistaTiendaMobile({ onGoBack, user, onOpenBook, isSuperuser = false }) {
  const [subView,    setSubView]    = useState(!user ? 'catalogo' : 'calle')
  const [catalogo,   setCatalogo]   = useState([])
  const [userLibros, setUserLibros] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('todos')

  const pendientes      = userLibros.filter(l => !l.leido).length
  const accesoBloqueado = !isSuperuser && pendientes >= LIMITE
  const tieneLibro = id => userLibros.some(l => l.libro_id === id)
  const libroLeido = id => userLibros.some(l => l.libro_id === id && l.leido)

  const COLS_BASE = 'id, slug, titulo, autor, paginas, descripcion, color, portada_url, anio, categorias, moods, es_ficcion'

  const reqIdRef = useRef(0)
  useEffect(() => () => { reqIdRef.current++ }, [])

  const fetchTienda = useCallback(async () => {
    const myId = ++reqIdRef.current
    setLoading(true)

    let tieneFecha = true
    let catRes = await supabase
      .from('libros')
      .select(`${COLS_BASE}, created_at`)
      .order('created_at', { ascending: false })
    if (catRes.error) {
      tieneFecha = false
      catRes = await supabase.from('libros').select(COLS_BASE)
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

  useEffect(() => {
    const t = setTimeout(() => { if (getTourPhase() === 'tienda_calle') runGuidedTiendaCalle() }, 700)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (subView !== 'catalogo') return
    if (getTourPhase() === 'tienda_interior') {
      const t = setTimeout(() => runGuidedTiendaInterior(), 700)
      return () => clearTimeout(t)
    }
  }, [subView])

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

  const handleEntrar = () => {
    if (getTourPhase() === 'tienda_calle') setTourPhase('tienda_interior')
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

  return (
    <>
      <CatalogoInteriorMobile
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
