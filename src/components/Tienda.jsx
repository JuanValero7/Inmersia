import { useState } from 'react'
import { useTiendaData } from '../hooks/useTiendaData.js'
import { LIMITE_PENDIENTES } from '../hooks/useCompraLibro.js'
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

  const handleEntrar = () => setSubView('catalogo')

  if (subView === 'calle') {
    return (
      <CalleEscena
        pendientes={pendientes}
        limite={LIMITE_PENDIENTES}
        bloqueado={accesoBloqueado}
        onEntrar={handleEntrar}
        onGoBack={onGoBack}
      />
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
