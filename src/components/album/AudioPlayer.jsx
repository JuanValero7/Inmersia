import { useState, useRef } from 'react'

// Banda sonora del libro (preview de audio real). Estilo "banda" con ecualizador
// que se anima al reproducir. Si no hay audio, queda deshabilitada.
export default function AudioPlayer({ url }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const disabled = !url

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play().catch(() => {}); setPlaying(true) }
  }

  return (
    <div className={`album-music${playing ? ' playing' : ''}${disabled ? ' disabled' : ''}`}
      onClick={disabled ? undefined : toggle}
      title={disabled ? 'Sin banda sonora' : (playing ? 'Pausar' : 'Escuchar preview')}>
      {url && <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} preload="none" />}
      <span className="album-music-btn">
        {playing
          ? <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          : <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
      </span>
      <span className="album-music-txt">
        <span className="album-music-lab">Banda sonora</span>
        <span className="album-music-name">{disabled ? 'Sin preview disponible' : (playing ? 'Reproduciendo…' : 'Preview musical')}</span>
      </span>
      <span className="album-wave">{Array.from({ length: 7 }).map((_, i) => (
        <i key={i} style={{ animationDelay: `${(-i * 0.13).toFixed(2)}s`, animationDuration: `${(0.9 + ((i * 7) % 5) * 0.12).toFixed(2)}s` }} />
      ))}</span>
    </div>
  )
}
