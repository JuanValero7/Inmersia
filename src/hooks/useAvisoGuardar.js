// src/hooks/useAvisoGuardar.js
// ─────────────────────────────────────────────────────────────
// Guardar un libro en la biblioteca con un aviso que se borra solo
// (plan de la tienda, 1.6): «quedó en tu biblioteca · N de 5», o por
// qué no se pudo. Lo usan las salas (escritorio y móvil).
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { LIMITE_PENDIENTES } from './useCompraLibro.js'

const DURACION_MS = 2800

/**
 * @param {(libro: object) => Promise<{ error: string|null }>} onComprar
 * @param {number} pendientes  lecturas pendientes antes de guardar
 * @returns {{ aviso: string, guardar: (libro: object) => Promise<void> }}
 */
export function useAvisoGuardar(onComprar, pendientes) {
  const [aviso, setAviso] = useState('')
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), DURACION_MS)
    return () => clearTimeout(t)
  }, [aviso])

  const guardar = async (libro) => {
    const { error } = await onComprar(libro)
    if (error === 'bloqueado') setAviso(`Ya tienes ${LIMITE_PENDIENTES} lecturas pendientes. Termina una para sumar otra.`)
    // Un fallo de escritura ya lo enseña <AvisoGuardado> (ver useCompraLibro):
    // repetirlo aquí daría dos avisos a la vez.
    else if (error) return
    else {
      const n = pendientes + 1
      setAviso(`«${libro.titulo}» quedó en tu biblioteca${n <= LIMITE_PENDIENTES ? ` · ${n} de ${LIMITE_PENDIENTES}` : ''}`)
    }
  }

  return { aviso, guardar }
}
