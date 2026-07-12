import { useState } from 'react'
import { useTiendaData } from '../../hooks/useTiendaData.js'
import { LIMITE_PENDIENTES } from '../../hooks/useCompraLibro.js'
import CalleEscena from '../tienda/CalleEscena.jsx'
import CatalogoInteriorMobile from './tienda/CatalogoInteriorMobile.jsx'
import '../../styles/tienda.css'

export default function VistaTiendaMobile({ onGoBack, user, gatoColor, onOpenBook, isSuperuser = false }) {
  const [subView,    setSubView]    = useState(!user ? 'catalogo' : 'calle')
  const [filtroTipo, setFiltroTipo] = useState('todos')

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
  )
}
