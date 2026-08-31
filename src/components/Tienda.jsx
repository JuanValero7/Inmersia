import { useState } from 'react'
import { useTiendaData } from '../hooks/useTiendaData.js'
import { LIMITE_PENDIENTES } from '../hooks/useCompraLibro.js'
import { useOnboarding } from '../context/onboarding.jsx'
import TutorialHint from './onboarding/TutorialHint.jsx'
import { TEXTO_TIENDA_LIMITE } from './onboarding/textos.js'
import CalleEscena from './tienda/CalleEscena.jsx'
import CatalogoInterior from './tienda/CatalogoInterior.jsx'
import '../styles/tienda.css'

// =============================================================
// VistaTienda · Tienda Inmersia (estilo "Calle con imágenes")
// Cáscara de datos + orquestación. La lógica real (fetch de catálogo,
// bloqueo por lecturas pendientes, alta de compra) vive en useTiendaData,
// compartido con TiendaMobile.jsx.
// La fachada (CalleEscena) y el interior (CatalogoInterior + PanelLibro)
// son solo presentación.
// =============================================================

export default function VistaTienda({ onGoBack, user, gatoColor, onOpenBook, isSuperuser = false }) {
  const [subView,    setSubView]    = useState(!user ? 'catalogo' : 'calle')   // 'calle' | 'catalogo'
  const [filtroTipo, setFiltroTipo] = useState('todos') // 'todos' | 'ficcion' | 'noficcion'

  const { catalogo, loading, pendientes, accesoBloqueado, tieneLibro, libroLeido, comprar, comprarYLeer } =
    useTiendaData(user, isSuperuser, onOpenBook)

  // ── Tutorial (paso 'tienda') ──
  // Último paso: el aviso del límite de lecturas pendientes se muestra en la
  // FACHADA, antes de cruzar la puerta, porque ese límite decide qué puede
  // llevarse de adentro. Al cerrarlo el tutorial termina (tienda → done).
  const onboarding = useOnboarding()
  const showLimiteHint = onboarding.active && onboarding.step === 'tienda' && subView === 'calle'

  const handleEntrar = () => setSubView('catalogo')

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
            onClose={() => onboarding.advance('tienda')}   // tienda → done
          />
        )}
      </>
    )
  }

  return (
    <CatalogoInterior
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
  )
}
