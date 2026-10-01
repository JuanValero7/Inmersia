import { useState } from 'react'
import { useLocation, Navigate } from 'react-router-dom'
import { useTiendaData } from '../../hooks/useTiendaData.js'
import { LIMITE_PENDIENTES } from '../../hooks/useCompraLibro.js'
import { useOnboarding } from '../../context/onboarding.jsx'
import { usePistas } from '../../context/pistas.jsx'
import TutorialHint from '../onboarding/TutorialHint.jsx'
import { TEXTO_TIENDA_LIMITE } from '../onboarding/textos.js'
import CalleEscena from '../tienda/CalleEscena.jsx'
import CatalogoInteriorMobile from './tienda/CatalogoInteriorMobile.jsx'
import '../../styles/tienda.css'

// Hasta la fase 4 del plan de la tienda, el móvil conserva su recorrido de
// siempre (calle → catálogo). De las rutas nuevas solo entiende
// /tienda/catalogo (directo al catálogo); /tienda/:sala vuelve a /tienda.
export default function VistaTiendaMobile({ vista = 'principal', onGoBack, user, gatoColor, onOpenBook, isSuperuser = false }) {
  // "Empezar a leer" (bienvenida) llega con state.entrar: se salta la fachada.
  const location = useLocation()
  const [subView,    setSubView]    = useState(vista === 'catalogo' || !user || location.state?.entrar ? 'catalogo' : 'calle')
  const [filtroTipo, setFiltroTipo] = useState('todos')

  const { catalogo, loading, pendientes, accesoBloqueado, tieneLibro, comprar, comprarYLeer } =
    useTiendaData(user, isSuperuser, onOpenBook)

  // ── Tutorial (paso 'tienda') ──
  // Último paso: el aviso del límite de lecturas pendientes se muestra en la
  // FACHADA, antes de cruzar la puerta, porque ese límite decide qué puede
  // llevarse de adentro. Al cerrarlo el tutorial termina (tienda → done).
  const onboarding = useOnboarding()
  const pistas = usePistas()   // el aviso del tour equivale a la pista 'tienda'
  const showLimiteHint = onboarding.active && onboarding.step === 'tienda' && subView === 'calle'

  const handleEntrar = () => setSubView('catalogo')

  if (vista === 'sala') return <Navigate to="/tienda" replace />

  if (subView === 'calle') {
    return (
      <>
        <CalleEscena
          pendientes={pendientes}
          limite={LIMITE_PENDIENTES}
          bloqueado={accesoBloqueado}
          onEntrar={handleEntrar}
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

  return (
    <CatalogoInteriorMobile
      catalogo={catalogo}
      loading={loading}
      user={user}
      gatoColor={gatoColor}
      tieneLibro={tieneLibro}
      onComprar={comprar}
      onEmpezarLeer={comprarYLeer}
      onVolver={onGoBack}
      filtroTipo={filtroTipo}
      onFiltroTipo={setFiltroTipo}
      bloqueado={accesoBloqueado}
    />
  )
}
