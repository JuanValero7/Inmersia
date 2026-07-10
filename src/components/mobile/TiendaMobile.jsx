import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useCompraLibro, LIMITE_PENDIENTES } from '../../hooks/useCompraLibro.js'
import CalleEscena from '../tienda/CalleEscena.jsx'
import CatalogoInteriorMobile from './tienda/CatalogoInteriorMobile.jsx'
import '../../styles/tienda.css'

const LIMITE = LIMITE_PENDIENTES
const NUEVOS = 5

export default function VistaTiendaMobile({ onGoBack, user, gatoColor, onOpenBook, isSuperuser = false }) {
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

  const { comprar: comprarLibro, comprarYLeer: comprarYLeerLibro } = useCompraLibro(user, isSuperuser, onOpenBook)

  async function comprar(libro) {
    const { error } = await comprarLibro(libro, { pendientes })
    if (!error) setUserLibros(prev => [...prev, { libro_id: libro.id, leido: false }])
  }

  async function comprarYLeer(libro) {
    const yaLoTenia = tieneLibro(libro.id)
    const { error } = await comprarYLeerLibro(libro, { pendientes, tieneLibro })
    if (!error && !yaLoTenia) setUserLibros(prev => [...prev, { libro_id: libro.id, leido: false }])
  }

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

  return (
    <>
      <CatalogoInteriorMobile
        catalogo={catalogo}
        loading={loading}
        user={user}
        gatoColor={gatoColor}
        tieneLibro={tieneLibro}
        libroLeido={libroLeido}
        onComprar={comprar}
        onEmpezarLeer={comprarYLeer}
        onVolver={onGoBack}
        filtroTipo={filtroTipo}
        onFiltroTipo={setFiltroTipo}
        bloqueado={accesoBloqueado}
      />
    </>
  )
}
