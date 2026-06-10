import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { supabase } from '../../lib/supabase.js'

export default function LibroReel({ libro, onClose }) {
  const [reels,   setReels]   = useState([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const audioRef    = useRef(null)
  const audioUrlRef = useRef(null)
  const touchStartY = useRef(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('libro_reels')
      .select('id, orden, imagen_url, audio_url, titulo, subtexto')
      .eq('libro_id', libro.id)
      .order('orden')
      .then(({ data }) => {
        if (cancelled) return
        setReels(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [libro.id])

  // Audio: solo reinicia si la URL cambia
  useEffect(() => {
    const slide = reels[current]
    const newUrl = slide?.audio_url || null

    if (newUrl && newUrl === audioUrlRef.current) return

    const prev = audioRef.current
    if (prev) { prev.pause(); prev.src = '' }
    audioRef.current = null
    audioUrlRef.current = null

    if (newUrl) {
      const audio = new Audio(newUrl)
      audio.loop = true
      audioRef.current = audio
      audioUrlRef.current = newUrl
      audio.play().catch(() => {})
    }
  }, [current, reels])

  useEffect(() => () => { audioRef.current?.pause() }, [])

  function goTo(idx) {
    setCurrent(Math.max(0, Math.min(reels.length - 1, idx)))
  }

  function handleTouchStart(e) {
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e) {
    if (touchStartY.current === null) return
    const delta = touchStartY.current - e.changedTouches[0].clientY
    if (Math.abs(delta) > 50) goTo(current + (delta > 0 ? 1 : -1))
    touchStartY.current = null
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  if (loading) return (
    <div className="reel-overlay">
      <div className="reel-card reel-card-center">
        <p className="reel-status-txt">Cargando preview…</p>
      </div>
    </div>
  )

  if (reels.length === 0) return (
    <div className="reel-overlay" onClick={handleBackdropClick}>
      <div className="reel-card reel-card-center">
        <button className="reel-close" onClick={onClose}>×</button>
        <p className="reel-status-txt">Aún no hay preview para este libro.</p>
      </div>
    </div>
  )

  const slide = reels[current]

  return (
    <div
      className="reel-overlay"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="reel-card">
        {/* Cerrar */}
        <button className="reel-close" onClick={onClose}>×</button>

        {/* Progreso tipo stories */}
        <div className="reel-progress">
          {reels.map((_, i) => (
            <div
              key={i}
              className={clsx('reel-seg', i < current ? 'pasado' : i === current && 'actual')}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        {/* Slide */}
        <div
          key={current}
          className="reel-slide"
          style={{
            backgroundImage: slide.imagen_url ? `url(${slide.imagen_url})` : undefined,
            backgroundColor: libro.color || '#2a1a0a',
          }}
        >
          <div className="reel-slide-gradiente" />
          <div className="reel-slide-contenido">
            {slide.titulo   && <h2 className="reel-slide-titulo">{slide.titulo}</h2>}
            {slide.subtexto && <p  className="reel-slide-subtexto">{slide.subtexto}</p>}
          </div>
        </div>

        {/* Navegación vertical */}
        <div className="reel-nav">
          <button className="reel-nav-btn" onClick={() => goTo(current - 1)} disabled={current === 0}>↑</button>
          <span className="reel-nav-counter">{current + 1} / {reels.length}</span>
          <button className="reel-nav-btn" onClick={() => goTo(current + 1)} disabled={current === reels.length - 1}>↓</button>
        </div>
      </div>
    </div>
  )
}
