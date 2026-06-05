// =============================================================
// INMERSIA — Transición al abrir un libro
// Formato: Plain JavaScript (.jsx)
//
// Flujo:
//   1) Recibe el rect del libro clickeado y el color del libro.
//      Renderiza un "panel" del color del libro en ESA posición.
//   2) En el siguiente frame, el panel transiciona a fullscreen
//      (250 ms). El dim background hace fade-in al mismo tiempo.
//   3) Al terminar la expansión, se monta lottie-web sobre el
//      panel y arranca la animación.
//   4) Cuando la animación termina (o el usuario hace click para
//      saltar), llama a onComplete. El overlay NO se desmonta:
//      mantiene la animación congelada en el último frame como
//      "foto" de fondo. El padre se encarga de mostrar el modal
//      encima y de desmontar todo al cerrarlo.
//
// La animación se carga lazy con import dinámico — Vite la pone
// en su propio chunk y solo se descarga la primera vez. Para
// sumar más animaciones, agregar entradas a ANIM_LOADERS y un
// campo `animation_key` por libro para elegir cuál juega.
// =============================================================

import { useEffect, useRef, useState } from 'react'

const ANIM_LOADERS = {
  libro_01: () => import('../../assets/animations/libro_01.json'),
}

const DEFAULT_KEY = 'libro_01'
const EXPAND_MS   = 250

export default function BookOpenTransition({ book, startRect, onComplete }) {
  const [animationData, setAnimationData] = useState(null)
  const [expanded, setExpanded]           = useState(!startRect) // si no hay rect, ya arrancamos fullscreen
  const [animReady, setAnimReady]         = useState(false)      // lottie listo para montar
  const [finished, setFinished]           = useState(false)

  const containerRef  = useRef(null)
  const animRef       = useRef(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Cargar el JSON
  useEffect(() => {
    let activo = true
    const key = ANIM_LOADERS[book?.animation_key] ? book.animation_key : DEFAULT_KEY
    ANIM_LOADERS[key]()
      .then(mod => { if (activo) setAnimationData(mod.default || mod) })
      .catch(err => {
        console.error('[BookOpenTransition] falló la carga del JSON:', err)
        if (activo) onCompleteRef.current?.()
      })
    return () => { activo = false }
  }, [book])

  // Disparar la expansión en el próximo frame para que la transición CSS corra
  useEffect(() => {
    if (!startRect) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setExpanded(true)))
    return () => cancelAnimationFrame(id)
  }, [startRect])

  // Cuando termina la expansión, marcar que lottie puede montarse
  useEffect(() => {
    if (!expanded) return
    const t = setTimeout(() => setAnimReady(true), EXPAND_MS + 20)
    return () => clearTimeout(t)
  }, [expanded])

  // Inicializar lottie-web cuando estén el JSON, el contenedor, y la expansión haya terminado.
  // lottie-web se carga dinámicamente la primera vez que un usuario abre un libro.
  useEffect(() => {
    if (!animationData || !animReady || !containerRef.current) return
    let activo = true
    let anim   = null

    import('lottie-web').then(mod => {
      if (!activo || !containerRef.current) return
      const lottie = mod.default
      anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData,
      })
      animRef.current = anim

      const onAnimComplete = () => {
        setFinished(true)
        onCompleteRef.current?.()
      }
      anim.addEventListener('complete', onAnimComplete)
    })

    return () => {
      activo = false
      if (animRef.current) {
        animRef.current.destroy()
        animRef.current = null
      }
    }
  }, [animationData, animReady])

  function handleSkip() {
    if (finished) return
    const anim = animRef.current
    if (anim) anim.goToAndStop(anim.totalFrames - 1, true)
    setFinished(true)
    onCompleteRef.current?.()
  }

  // Estilos del panel: del rect del libro a fullscreen
  const panelStyle = expanded
    ? { top: 0, left: 0, width: '100vw', height: '100vh' }
    : startRect
      ? { top: startRect.top, left: startRect.left, width: startRect.width, height: startRect.height }
      : { top: 0, left: 0, width: '100vw', height: '100vh' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150, pointerEvents: finished ? 'none' : 'auto' }} onClick={handleSkip}>
      {/* Capa 1: fondo oscuro que hace fade-in y se vuelve transparente al terminar */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(20, 12, 6, 0.82)',
        opacity: finished ? 0 : (expanded ? 1 : 0),
        transition: `opacity ${EXPAND_MS}ms ease-out`,
        pointerEvents: 'none',
      }}/>

      {/* Capa 2: panel que se expande del libro a fullscreen, y luego aloja la animación */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          ...panelStyle,
          background: animReady ? 'transparent' : (book?.color || '#5a3d28'),
          transition: `top ${EXPAND_MS}ms ease-out, left ${EXPAND_MS}ms ease-out, width ${EXPAND_MS}ms ease-out, height ${EXPAND_MS}ms ease-out, background ${EXPAND_MS}ms ease-out`,
        }}
      />

      {/* Hint de skip — solo mientras corre la animación */}
      {animReady && !finished && (
        <div style={{
          position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center',
          color: 'rgba(255,220,160,0.55)', fontSize: 12, fontFamily: "'Playfair Display',serif",
          letterSpacing: '0.05em', pointerEvents: 'none',
        }}>
          click para saltar
        </div>
      )}
    </div>
  )
}
