// Plain JavaScript (.jsx)
import { useState, useEffect, useRef, memo } from 'react'
import { theme } from './clay.jsx'

// Grabadora de ambiente — clay. Conserva la lógica de audio real (ambient.url),
// sin carretes girando y con opción de minimizar.
const RecorderPlayer = memo(function RecorderPlayer({ ambient }) {
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [min, setMin] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    const a = new Audio(); a.loop = true; a.volume = volume; audioRef.current = a
    return () => { a.pause(); a.src = '' }
  }, [])

  useEffect(() => {
    const a = audioRef.current; if (!a) return
    const wasPlaying = playing
    a.pause()
    if (ambient?.url) {
      a.src = ambient.url; a.load()
      if (wasPlaying) a.play().catch(() => setPlaying(false))
    } else {
      a.src = ''; setPlaying(false)
    }
  }, [ambient?.url])

  function toggle() {
    const a = audioRef.current; if (!a || !ambient?.url) return
    if (playing) { a.pause(); setPlaying(false) }
    else a.play().then(() => setPlaying(true)).catch(() => {})
  }
  function handleVolume(e) {
    const v = parseFloat(e.target.value); setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  const disabled = !ambient?.url

  if (min) {
    return (
      <button type="button" onClick={() => setMin(false)} title="Ajustar ambiente"
        style={{ width: 48, height: 48, borderRadius: 14, background: theme.navBg, border: `2px solid ${theme.ink}`, boxShadow: `2px 3px 0 ${theme.ink}26`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <span style={{ fontSize: 18, color: theme.accent }}>♪</span>
        {playing && <span style={{ position: 'absolute', top: 4, right: 5, width: 8, height: 8, borderRadius: '50%', background: theme.accent, boxShadow: `0 0 5px ${theme.accent}` }} />}
      </button>
    )
  }

  return (
    <div style={{ background: theme.navBg, border: `2px solid ${theme.ink}`, boxShadow: `2px 3px 0 ${theme.ink}26`, borderRadius: 16, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 14, width: 330, opacity: disabled ? 0.6 : 1, position: 'relative' }}>
      <button type="button" onClick={() => setMin(true)} title="Minimizar"
        style={{ position: 'absolute', top: 6, right: 8, width: 18, height: 18, borderRadius: 6, border: `1.5px solid ${theme.ink}55`, background: 'transparent', color: theme.ink, fontSize: 11, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>–</button>
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1].map(k => (
          <div key={k} style={{ width: 30, height: 30, borderRadius: '50%', border: `2.5px solid ${theme.ink}`, background: '#efe7d4', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: '50% auto auto 50%', width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: '50%', background: theme.ink }} />
            <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', border: `1px dashed ${theme.ink}44` }} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10.5, color: theme.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 16 }}>{ambient ? (ambient.titulo || ambient.slug || 'ambiente') : 'sin ambiente'}</div>
        <div style={{ display: 'flex', gap: 2, marginTop: 7, height: 9, alignItems: 'flex-end' }}>
          {Array.from({ length: 14 }).map((_, i) => {
            const on = playing && i < Math.round(volume * 14)
            return <div key={i} style={{ flex: 1, height: 3 + (i % 4) * 1.6, background: on ? theme.meter : 'rgba(74,54,34,0.16)', borderRadius: 1, transition: 'background .12s' }} />
          })}
        </div>
        <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolume} className="inm-vol" style={{ width: '100%', marginTop: 8, color: theme.accent }} />
      </div>
      <button type="button" disabled={disabled} onClick={toggle} title={playing ? 'Pausar' : 'Reproducir'}
        style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', border: `2px solid ${theme.ink}`, background: theme.accent, color: '#fff', fontSize: 14, cursor: disabled ? 'default' : 'pointer', boxShadow: `1.6px 2.4px 0 ${theme.ink}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {playing ? '❚❚' : '▶'}
      </button>
    </div>
  )
})

export { RecorderPlayer }

// Cuaderno espiral inclinado (ícono del lanzador). Hover lo endereza.
export function NotebookIcon() {
  const [hov, setHov] = useState(false)
  const W = 74, H = 84
  return (
    <span onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'block', position: 'relative', width: W, height: H, transform: `rotate(${hov ? 0 : -7}deg) translateY(${hov ? -3 : 0}px)`, transformOrigin: 'bottom center', transition: 'transform .22s cubic-bezier(.3,1.3,.5,1)' }}>
      <span style={{ position: 'absolute', bottom: -13, left: '50%', transform: 'translateX(-50%)', width: 16, height: 22, background: '#e6b54a', border: `1.5px solid ${theme.ink}`, clipPath: 'polygon(0 0,100% 0,100% 100%,50% 78%,0 100%)', zIndex: 0 }} />
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg,#b9854f,#9c6a36)', borderRadius: '4px 9px 9px 4px', border: `2px solid ${theme.ink}`, boxShadow: `2px 3px 0 ${theme.ink}33` }} />
      <span style={{ position: 'absolute', top: 6, left: 13, right: 6, bottom: 7, background: '#fbf6ea', borderRadius: '2px 4px 4px 2px', border: `1.5px solid ${theme.ink}66`, overflow: 'hidden' }}>
        {[0, 1, 2, 3].map(i => <span key={i} style={{ position: 'absolute', left: 5, right: 5, top: 11 + i * 13, height: 1.5, background: 'rgba(74,54,34,0.22)' }} />)}
      </span>
      <span style={{ position: 'absolute', top: -5, left: 9, display: 'flex', gap: 4 }}>
        {[0, 1, 2, 3, 4].map(i => <span key={i} style={{ width: 8, height: 13, borderRadius: 6, border: `2px solid #caa24f`, borderBottomColor: theme.ink, background: 'transparent' }} />)}
      </span>
      <span style={{ position: 'absolute', right: -7, top: 18, width: 7, height: 40, background: 'linear-gradient(180deg,#e6b54a,#d49a2c)', border: `1.5px solid ${theme.ink}`, borderRadius: 3, transform: 'rotate(24deg)' }}>
        <span style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '3.5px solid transparent', borderRight: '3.5px solid transparent', borderTop: `5px solid ${theme.ink}` }} />
      </span>
    </span>
  )
}
