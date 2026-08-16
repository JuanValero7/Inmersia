// Una barajita: la primera de cada sección es "hero" (2×2), la imagen principal
// del tablero (cartelera_principal). Si está desbloqueada y pegada muestra su
// imagen; si está desbloqueada pero sin pegar, un slot "lista para pegar"
// clickeable; si no, un slot vacío.
import { useState } from 'react'

const SlotIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15l4-4 3 3 4-5 7 7" /><circle cx="8.5" cy="9" r="1.4" />
  </svg>
)
const StickIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3v4M15 3v4M4 8h16M6 8v11a2 2 0 002 2h8a2 2 0 002-2V8" /><path d="M9.5 13.5l2 2 3-3.5" />
  </svg>
)
const GhostIcon = () => (
  <svg width="46" height="46" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3a7 7 0 00-7 7v10l2.5-1.5L10 20l2-1.5 2 1.5 2.5-1.5L19 20V10a7 7 0 00-7-7zm-2.5 8a1.3 1.3 0 110-2.6 1.3 1.3 0 010 2.6zm5 0a1.3 1.3 0 110-2.6 1.3 1.3 0 010 2.6z" />
  </svg>
)

export default function Barajita({ item, color, idx, onPegar }) {
  const [pegando, setPegando] = useState(false)
  const hero  = idx === 0
  const num   = String(idx + 1).padStart(2, '0')
  const heroCls = hero ? ' hero' : ''

  // ── casilla vacía / bloqueada ──
  if (!item || !item.unlocked) {
    return (
      <div className={`album-barajita empty${heroCls}`}>
        <div className="eghost"><GhostIcon /></div>
        <div className="eslot">
          <SlotIcon />
          <span>Pega tu barajita</span>
        </div>
      </div>
    )
  }

  // ── desbloqueada pero todavía sin pegar ──
  if (!item.pegada) {
    const handleClick = () => {
      if (pegando) return
      setPegando(true)
      onPegar?.(item.key)
      setTimeout(() => setPegando(false), 500)
    }
    return (
      <div className={`album-barajita pending${heroCls}${pegando ? ' pegando' : ''}`} onClick={handleClick}>
        <div className="eslot pend">
          <StickIcon />
          <span>Tienes una barajita para pegar</span>
        </div>
      </div>
    )
  }

  // ── casilla desbloqueada (recién pegada anima acá, ver handleClick arriba) ──
  return (
    <div className={`album-barajita card${heroCls}${pegando ? ' pegando' : ''}`} style={{ '--c': color }} title={item.name || ''}>
      {item.url
        ? <div className="album-barajita-img"><img src={item.url} alt={item.name || ''} loading="lazy" /></div>
        : <div className="album-placeholder-fill" style={{ background: color }}><span>{(item.name || '?').charAt(0)}</span></div>}
      <div className="vig" />
      <div className="foil" />
      <div className="cbadge">{num}</div>
      {item.name && <p className="album-barajita-caption">{item.name}</p>}
    </div>
  )
}
