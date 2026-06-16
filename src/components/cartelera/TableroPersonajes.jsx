// Formato: Plain JavaScript (.jsx)
// Tablero de Personajes: polaroids que revelan el retrato (imageUrl) según el
// porcentaje de avance. Sólo el lienzo (700×860); el cromo lo pone Cartelera.jsx.
import { useMemo } from 'react'
import { rng } from './carteleraHelpers.js'

const BOARD_W = 700, BOARD_H = 860
const COLS = 5, ROWS = 6, TOTAL = COLS * ROWS // 30
const PAD = 8, CAP = 18

function buildLayout() {
  const r = rng(20260601)
  const cellW = BOARD_W / COLS, cellH = BOARD_H / ROWS
  const items = []
  for (let row = 0; row < ROWS; row++) {
    const rowOff = (r() * 2 - 1) * 8
    for (let col = 0; col < COLS; col++) {
      const jx = (r() * 2 - 1) * 5, jy = (r() * 2 - 1) * 4
      const w = cellW * (0.96 + r() * 0.10)
      const h = cellH * (0.82 + r() * 0.14)
      // Clamp para que ningún frame salga del lienzo (700×860)
      const cx = Math.max(PAD + w / 2, Math.min(BOARD_W - PAD - w / 2, (col + 0.5) * cellW + rowOff + jx))
      const cy = Math.max(PAD + h / 2, Math.min(BOARD_H - CAP - h / 2, (row + 0.5) * cellH + jy))
      const rot = (r() * 2 - 1) * 7
      const tape = r() < 0.55
      const tr = (r() * 2 - 1) * 14
      items.push({ cx, cy, w, h, rot, tape, tr })
    }
  }
  const order = items.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  return { items, order }
}

// 4 esquinas de un rectángulo rotado → subpath para clip-path
function quadPath(cx, cy, w, h, deg) {
  const a = deg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), hw = w / 2, hh = h / 2
  const p = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [cx + x * co - y * si, cy + x * si + y * co])
  return `M ${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)} L ${p[1][0].toFixed(1)} ${p[1][1].toFixed(1)} L ${p[2][0].toFixed(1)} ${p[2][1].toFixed(1)} L ${p[3][0].toFixed(1)} ${p[3][1].toFixed(1)} Z`
}

function Frame({ it }) {
  const w = it.w, h = it.h
  return (
    <div className="cart-frame" style={{
      left: it.cx - (PAD + w / 2), top: it.cy - (PAD + h / 2), width: w, height: h,
      borderWidth: `${PAD}px ${PAD}px ${CAP}px ${PAD}px`,
      transformOrigin: `${PAD + w / 2}px ${PAD + h / 2}px`,
      transform: `rotate(${it.rot}deg)`, '--tr': `${it.tr}deg`,
    }}>
      {it.tape && <span className="cart-tape" />}
    </div>
  )
}

export default function TableroPersonajes({ pct = 0, scale = 1, imageUrl, videoUrl, onOpenList }) {
  const { items, order } = useMemo(buildLayout, [])
  const revealed = Math.round(Math.max(0, Math.min(100, pct)) / 100 * TOTAL)
  const shown = useMemo(() => order.slice(0, revealed), [order, revealed])
  const clip = useMemo(() => shown.length
    ? `path('${shown.map(i => { const it = items[i]; return quadPath(it.cx, it.cy, it.w, it.h, it.rot) }).join(' ')}')`
    : `path('M 0 0 Z')`, [shown, items])

  const containerStyle = { width: BOARD_W, height: BOARD_H, transform: `scale(${scale})`, cursor: onOpenList ? 'pointer' : 'default' }

  if (pct >= 100 && videoUrl) {
    return (
      <div className="cart-canvas" style={containerStyle} onClick={onOpenList} title={onOpenList ? 'Ver la lista' : undefined}>
        <video src={videoUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }

  return (
    <div className="cart-canvas" style={containerStyle} onClick={onOpenList} title={onOpenList ? 'Ver la lista' : undefined}>
      <div className="cart-foto" style={{ clipPath: clip, WebkitClipPath: clip }}>
        {imageUrl ? <img src={imageUrl} alt="" /> : <div className="cart-foto-empty" />}
      </div>
      <div className="cart-frames">
        {shown.map(i => <Frame key={i} it={items[i]} />)}
      </div>
    </div>
  )
}
