import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTiendaData } from '../hooks/useTiendaData.js'
import { LIMITE_PENDIENTES } from '../hooks/useCompraLibro.js'
import { useOnboarding } from '../context/onboarding.jsx'
import { usePistas } from '../context/pistas.jsx'
import TutorialHint from './onboarding/TutorialHint.jsx'
import { TEXTO_TIENDA_LIMITE } from './onboarding/textos.js'
import CalleEscena from './tienda/CalleEscena.jsx'
import CatalogoInterior from './tienda/CatalogoInterior.jsx'
import TiendaPrincipal from './tienda/TiendaPrincipal.jsx'
import '../styles/tienda.css'

// =============================================================
// VistaTienda · la Tienda en escritorio (cáscara de datos y rutas)
//   /tienda            → TiendaPrincipal (portada, salas, carriles)
//   /tienda/catalogo   → CatalogoInterior (todo el catálogo)
//   /tienda/:sala      → la sala (fase 3 del plan)
// La lógica de datos (catálogo, pendientes, compra) vive en useTiendaData,
// compartido con TiendaMobile.jsx.
//
// LA CALLE (CalleEscena) solo aparece al llegar desde la Biblioteca, que
// navega con state.calle. Volver de una sala o del catálogo a /tienda no
// la muestra otra vez: la calle nunca es destino del botón Atrás.
// =============================================================

export default function VistaTienda({ vista = 'principal', onGoBack, user, gatoColor, onOpenBook, isSuperuser = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const porLaCalle = vista === 'principal' && !!user && !!location.state?.calle && !location.state?.entrar
  const [enCalle, setEnCalle] = useState(porLaCalle)
  const [filtroTipo, setFiltroTipo] = useState('todos') // catálogo completo: 'todos' | 'ficcion' | 'noficcion'

  const { catalogo, loading, pendientes, accesoBloqueado, tieneLibro, comprar, comprarYLeer } =
    useTiendaData(user, isSuperuser, onOpenBook)

  // ── Tutorial (paso 'tienda') ──
  // Último paso: el aviso del límite de lecturas pendientes se muestra en la
  // FACHADA, antes de cruzar la puerta, porque ese límite decide qué puede
  // llevarse de adentro. Al cerrarlo el tutorial termina (tienda → done).
  const onboarding = useOnboarding()
  const pistas = usePistas()   // el aviso del tour equivale a la pista 'tienda'
  const showLimiteHint = onboarding.active && onboarding.step === 'tienda' && enCalle

  // Al cruzar la puerta se borra la marca de la calle del historial: recargar
  // o volver a esta entrada no vuelve a enseñar la fachada.
  const entrar = () => {
    setEnCalle(false)
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: {} })
  }

  if (enCalle) {
    return (
      <>
        <CalleEscena
          pendientes={pendientes}
          limite={LIMITE_PENDIENTES}
          bloqueado={accesoBloqueado}
          onEntrar={entrar}
          onGoBack={onGoBack}
        />
        {showLimiteHint && (
          <TutorialHint
            logo
            title={TEXTO_TIENDA_LIMITE.title}
            body={TEXTO_TIENDA_LIMITE.body}
            buttonLabel={TEXTO_TIENDA_LIMITE.buttonLabel}
            onClose={() => { pistas.marcar('tienda'); onboarding.advance('tienda') }}   // tienda → done
          />
        )}
      </>
    )
  }

  if (vista === 'catalogo') {
    return (
      <CatalogoInterior
        catalogo={catalogo}
        loading={loading}
        user={user}
        gatoColor={gatoColor}
        tieneLibro={tieneLibro}
        onComprar={comprar}
        onEmpezarLeer={comprarYLeer}
        onVolver={() => navigate('/tienda')}
        filtroTipo={filtroTipo}
        onFiltroTipo={setFiltroTipo}
        bloqueado={accesoBloqueado}
      />
    )
  }

  if (vista === 'sala') {
    // Fase 3 del plan: la sala con su estantería y su historia.
    return (
      <div className="tp" style={{ display: 'grid', placeItems: 'center', gap: 16, textAlign: 'center', padding: 24 }}>
        <div>
          <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>La sala llega en el siguiente paso</p>
          <button type="button" className="tp-pill" onClick={() => navigate('/tienda')}>Volver a la tienda</button>
        </div>
      </div>
    )
  }

  return (
    <TiendaPrincipal
      catalogo={catalogo}
      loading={loading}
      user={user}
      gatoColor={gatoColor}
      tieneLibro={tieneLibro}
      bloqueado={accesoBloqueado}
      onComprar={comprar}
      onEmpezarLeer={comprarYLeer}
      onSalir={onGoBack}
      onIrCatalogo={() => navigate('/tienda/catalogo')}
      onIrSala={(slug) => navigate(`/tienda/${slug}`)}
      porLaCalle={porLaCalle}
    />
  )
}
