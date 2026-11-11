// src/components/landing/colegios/Pestanas.jsx
// ─────────────────────────────────────────────────────────────
// Pestañas simples: `pestanas` = [[clave, título, tipo?]] (ver Chips.jsx),
// `children(clave)` pinta la elegida.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import Chips from './Chips.jsx'

export default function Pestanas({ pestanas, children }) {
  const [activa, setActiva] = useState(pestanas[0][0])
  return (
    <>
      <Chips opciones={pestanas} valor={activa} onCambio={setActiva} />
      {children(activa)}
    </>
  )
}
