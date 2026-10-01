// src/components/landing/Gato.jsx
// ─────────────────────────────────────────────────────────────
// Un gato de la landing con su bocadillo.
//
// `useGato(texto)` guarda lo que dice y la animación en curso; <Gato> lo pinta.
// El estado vive en Landing.jsx (no aquí) porque a cada gato le hablan otras
// piezas: la estantería, el acertijo, la barajita, el botón de sonido…
//
// Las animaciones se reinician cambiando la `key` del elemento: React lo vuelve
// a montar y la animación CSS arranca de cero (la imagen ya está en caché).
// ─────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef } from 'react'

export function useGato(textoInicial) {
  const [texto, setTexto] = useState(textoInicial)
  const [tono, setTono] = useState(null)        // null | 'ok' | 'mal' (fondo del bocadillo)
  const [vez, setVez] = useState(0)              // sube con cada frase → re-anima el bocadillo
  const [anim, setAnim] = useState({ tipo: null, vez: 0 })

  const decir = useCallback((t, nuevoTono = null) => {
    setTexto(t); setTono(nuevoTono); setVez(n => n + 1)
  }, [])
  const mover = useCallback((tipo) => setAnim(a => ({ tipo, vez: a.vez + 1 })), [])
  const repetir = useCallback(() => setVez(n => n + 1), [])

  return { texto, tono, vez, anim, decir, mover, repetir }
}

/**
 * @param gato       lo que devuelve useGato()
 * @param src        imagen del pose actual
 * @param alt        descripción del gato
 * @param nombre     para el aria-label del botón ("Hablar con Yuri")
 * @param className  posición (inm-cat-hero, inm-cat-estante…)
 * @param cola       hacia dónde apunta la cola del bocadillo: abajo | abajo-der | der | izq
 * @param onToca     al tocar el gato
 */
export function Gato({ gato, src, alt, nombre, className = '', cola = 'abajo', onToca }) {
  const ref = useRef(null)
  const { mover, repetir } = gato

  // Salta una vez al entrar en pantalla.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      mover('pop'); repetir()
      io.disconnect()
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [mover, repetir])

  return (
    <button
      ref={ref}
      type="button"
      className={`inm-cat ${className}`.trim()}
      onClick={onToca}
      aria-label={nombre ? `Hablar con ${nombre}` : 'Hablar con el gato'}
    >
      <img
        key={`img-${gato.anim.vez}`}
        className={gato.anim.tipo ? `is-${gato.anim.tipo}` : undefined}
        src={src}
        alt={alt}
        decoding="async"
      />
      {gato.texto && (
        <span
          key={`dice-${gato.vez}`}
          className={`inm-bubble cola-${cola} ${gato.tono ? `is-${gato.tono}` : ''} ${gato.vez ? 'is-say' : ''}`}
          aria-live="polite"
        >
          {gato.texto}
        </span>
      )}
    </button>
  )
}
