import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTiendaData } from '../../hooks/useTiendaData.js'
import { LIMITE_PENDIENTES } from '../../hooks/useCompraLibro.js'
import { useOnboarding } from '../../context/onboarding.jsx'
import { usePistas } from '../../context/pistas.jsx'
import TutorialHint from '../onboarding/TutorialHint.jsx'
import { TEXTO_TIENDA_LIMITE } from '../onboarding/textos.js'
import CalleEscena from '../tienda/CalleEscena.jsx'
import CatalogoInteriorMobile from './tienda/CatalogoInteriorMobile.jsx'
import TiendaPrincipalMobile from './tienda/TiendaPrincipalMobile.jsx'
import SalaMobile from './tienda/SalaMobile.jsx'
import '../../styles/tienda.css'

// =============================================================
// VistaTiendaMobile · la Tienda en el teléfono (cáscara de datos y rutas)
//   /tienda            → TiendaPrincipalMobile (portada, salas, carriles)
//   /tienda/catalogo   → CatalogoInteriorMobile (todo el catálogo)
//   /tienda/:sala      → SalaMobile (baldas e historia a pantalla completa)
// Datos compartidos con escritorio: useTiendaData.
//
// LA CALLE solo aparece al llegar desde la Biblioteca (state.calle),
// igual que en escritorio (Tienda.jsx): nunca es destino de Atrás.
// =============================================================

export default function VistaTiendaMobile({ vista = 'principal', onGoBack, user, gatoColor, onOpenBook, isSuperuser = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { sala: salaSlug } = useParams()
  const porLaCalle = vista === 'principal' && !!user && !!location.state?.calle && !location.state?.entrar
  const [enCalle, setEnCalle] = useState(porLaCalle)
  const [filtroTipo, setFiltroTipo] = useState('todos') // catálogo completo

  const { catalogo, loading, pendientes, accesoBloqueado, tieneLibro, comprar, comprarYLeer } =
    useTiendaData(user, isSuperuser, onOpenBook)

  // ── Tutorial (paso 'tienda') ──
  // Último paso: el aviso del límite de lecturas pendientes se muestra en la
  // FACHADA, antes de cruzar la puerta, porque ese límite decide qué puede
  // llevarse de adentro. Al cerrarlo el tutorial termina (tienda → done).
  const onboarding = useOnboarding()
  const pistas = usePistas()   // el aviso del tour equivale a la pista 'tienda'
  const showLimiteHint = onboarding.active && onboarding.step === 'tienda' && enCalle

  // Al cruzar la puerta se borra la marca de la calle del historial.
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
      <CatalogoInteriorMobile
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
    // key: pasar a otra sala desde «Otras salas» monta una sala nueva.
    return (
      <SalaMobile
        key={salaSlug}
        slug={salaSlug}
        catalogo={catalogo}
        loading={loading}
        user={user}
        tieneLibro={tieneLibro}
        pendientes={pendientes}
        bloqueado={accesoBloqueado}
        onComprar={comprar}
        onEmpezarLeer={comprarYLeer}
        onVolver={() => navigate('/tienda')}
        onIrSala={(slug) => navigate(`/tienda/${slug}`)}
      />
    )
  }

  return (
    <TiendaPrincipalMobile
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
