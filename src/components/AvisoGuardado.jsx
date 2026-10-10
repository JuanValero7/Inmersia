// src/components/AvisoGuardado.jsx
// ─────────────────────────────────────────────────────────────
// Aviso global de "no pudimos guardar X".
//
// Es el hermano de <AvisoRed> (que cubre las LECTURAS que fallan): este cubre
// las ESCRITURAS que pasan por guardar() de src/lib/guardar.js. Se monta una
// sola vez en App.jsx y escucha a guardar(); no hace falta pasar nada por
// props ni por contexto.
//
// Discreto a propósito: el lector está leyendo. Se va solo a los 6 s, y el
// mismo texto no vuelve a salir hasta pasados 30 s, así que un progreso que
// falla en cada página (sin conexión en el metro) avisa una vez, no veinte.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { escucharAvisos } from '../lib/guardar.js'

const DURACION_MS = 6000
const SILENCIO_MS = 30_000

export default function AvisoGuardado() {
  const [texto, setTexto] = useState(null)
  const mostradoEn = useRef({})   // texto → cuándo se enseñó por última vez

  useEffect(() => escucharAvisos((t) => {
    const ahora = Date.now()
    if (ahora - (mostradoEn.current[t] || 0) < SILENCIO_MS) return
    mostradoEn.current[t] = ahora
    setTexto(t)
  }), [])

  useEffect(() => {
    if (!texto) return
    const id = setTimeout(() => setTexto(null), DURACION_MS)
    return () => clearTimeout(id)
  }, [texto])

  if (!texto) return null

  return (
    <div className="aviso-flotante" role="status" aria-live="polite">
      <div className="aviso-flotante__caja">
        <span className="aviso-flotante__icono" aria-hidden="true">⚠️</span>
        <p>{texto}</p>
        <button type="button" onClick={() => setTexto(null)} aria-label="Cerrar">×</button>
      </div>
    </div>
  )
}
