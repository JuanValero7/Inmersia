import { useState, useEffect, useRef } from 'react'

export function useAmbientPlayer(ambientUrl) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)

  useEffect(() => {
    const a = new Audio(); a.loop = true; a.volume = 0.5; audioRef.current = a
    return () => { a.pause(); a.src = '' }
  }, [])

  useEffect(() => {
    const a = audioRef.current; if (!a) return
    const wasPlaying = playing
    a.pause()
    if (ambientUrl) {
      a.src = ambientUrl; a.load()
      if (wasPlaying) a.play().catch(() => setPlaying(false))
    } else { a.src = ''; setPlaying(false) }
  }, [ambientUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    const a = audioRef.current; if (!a || !ambientUrl) return
    if (playing) { a.pause(); setPlaying(false) }
    else a.play().then(() => setPlaying(true)).catch(() => {})
  }

  function setVol(v) { setVolume(v); if (audioRef.current) audioRef.current.volume = v }

  return { playing, volume, toggle, setVol }
}
