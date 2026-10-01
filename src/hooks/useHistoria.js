// src/hooks/useHistoria.js
// ─────────────────────────────────────────────────────────────
// Reproducción de la historia (el avance en escenas de un libro):
// escena actual, avance automático y el audio de cada escena.
// Sustituye a la lógica que vivía dentro de LibroReel.
//
// El componente que lo usa se monta con `key={libro.id}`: cambiar de
// libro es montar uno nuevo, así que la escena vuelve a 0 sola.
//
// Audio: el navegador solo deja sonar después de un gesto del usuario.
// La historia siempre se abre con un toque (un libro, «Ver el avance»),
// así que el primer play() entra dentro de ese gesto.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { imgUrl, preloadImages } from '../lib/img.js'

export const SEGUNDOS_POR_ESCENA = 6
// Ancho pedido a Storage: tarjeta de ~460 px en escritorio a 2x, o un móvil.
export const ANCHO_ESCENA = 900

/**
 * @param {Array<{ imagen_url?: string, audio_url?: string }>} escenas
 * @param {{ pausada?: boolean }} [opciones]  pausada: congela el avance y el audio
 *   (p. ej. mientras la ficha tapa la historia)
 */
export function useHistoria(escenas, { pausada = false } = {}) {
  const [escena, setEscena] = useState(0)
  const total = escenas.length

  // Todas las escenas de una vez: al pasar de escena ya están en caché.
  useEffect(() => {
    preloadImages(escenas.map(e => imgUrl(e.imagen_url, { width: ANCHO_ESCENA })))
  }, [escenas])

  // Avance automático. En la última escena se queda quieta.
  useEffect(() => {
    if (pausada || !total || escena >= total - 1) return
    const t = setTimeout(() => setEscena(i => Math.min(i + 1, total - 1)), SEGUNDOS_POR_ESCENA * 1000)
    return () => clearTimeout(t)
  }, [escena, total, pausada])

  // Audio: solo se reinicia si cambia la URL (varias escenas comparten pista).
  const audioRef = useRef(null)
  const urlRef = useRef(null)
  const url = pausada ? null : (escenas[escena]?.audio_url || null)
  useEffect(() => {
    if (url && url === urlRef.current) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    audioRef.current = null
    urlRef.current = null
    if (!url) return
    const audio = new Audio(url)
    audio.loop = true
    audioRef.current = audio
    urlRef.current = url
    audio.play().catch(() => {})
  }, [url])
  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
  }, [])

  const ir = useCallback((delta) => {
    setEscena(i => Math.max(0, Math.min(total - 1, i + delta)))
  }, [total])

  return {
    escena,
    total,
    actual: escenas[escena] || null,
    siguiente: useCallback(() => ir(1), [ir]),
    anterior: useCallback(() => ir(-1), [ir]),
  }
}
