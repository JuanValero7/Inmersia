// Formato: Plain JavaScript (.jsx)
// Vista principal de la Cartelera. Orquesta: Landing → Ficha (cuaderno).
// El mural suelto por sección ya no existe: las imágenes que se desbloquean
// viven en las placas del landing. Lee todo de Supabase con useCartelera.
//   <CartelaView onGoBack book user onGoForo />
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBookBySlug } from '../hooks/useBookBySlug.js'

const VALID_SECCIONES = ['personajes', 'lugares', 'hechos', 'datos', 'notas', 'glosario', 'referencias', 'resumen']
import { useCartelera } from './cartelera/useCartelera.js'
import { getSecciones } from './cartelera/carteleraHelpers.js'
import CarteleraLanding from './cartelera/CarteleraLanding.jsx'
import Ficha from './cartelera/Ficha.jsx'
import '../styles/cartelera.css'

function Filters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="mesaGrain"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" stitchTiles="stitch" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.0" /></filter>
    </svg>
  )
}

export default function CartelaView({ onGoBack, book: bookProp, user, onGoForo, onGoBiblioteca, jumpToItemId, onJumpConsumed, isSuperuser = false, gatoColor = 'negro' }) {
  const { book, loading: bookLoading } = useBookBySlug(bookProp)
  const esNoficcion = book?.es_ficcion === false
  const secciones  = getSecciones(esNoficcion)
  const data = useCartelera(book?.libro_id || null, user?.id || null, isSuperuser)
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState(() => {
    const s = searchParams.get('seccion')
    return s && VALID_SECCIONES.includes(s) ? { kind: 'ficha', key: s } : { kind: 'landing', key: null }
  })
  const [fichaInitItemId, setFichaInitItemId] = useState(null)

  useEffect(() => {
    if (view.key) setSearchParams({ seccion: view.key }, { replace: true })
    else setSearchParams({}, { replace: true })
  }, [view.key, setSearchParams])

  useEffect(() => {
    if (!jumpToItemId || bookLoading) return
    setFichaInitItemId(jumpToItemId)
    setView({ kind: 'ficha', key: esNoficcion ? 'glosario' : 'personajes' })
    onJumpConsumed?.()
  }, [jumpToItemId, bookLoading])

  if (bookLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-warm)' }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(139,77,42,0.2)', borderTopColor: '#8b4d2a' }} />
    </div>
  )

  let content
  if (view.kind === 'landing') {
    content = <CarteleraLanding subtitle={book?.title} data={data} esNoficcion={esNoficcion}
      onOpenSection={(k) => setView({ kind: 'ficha', key: k })}
      onOpenList={(k) => setView({ kind: 'ficha', key: k })}
      onGoBack={onGoBack} onGoForo={onGoForo} onGoBiblioteca={onGoBiblioteca} />
  } else {
    content = <Ficha key={view.key} section={secciones.find(s => s.key === view.key)} items={data.itemsBySeccion[view.key] || []}
      initialItemId={fichaInitItemId}
      secciones={secciones}
      gatoColor={gatoColor}
      onBackPortada={() => setView({ kind: 'landing', key: null })}
      onGoBack={onGoBack}
      onGoForo={onGoForo}
      onGoBiblioteca={onGoBiblioteca}
      onOpenList={(k) => setView({ kind: 'ficha', key: k })} />
  }

  return (
    <div className="cart-root">
      <Filters />
      {content}
    </div>
  )
}
