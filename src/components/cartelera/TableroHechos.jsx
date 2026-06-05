// Formato: Plain JavaScript (.jsx)
// Tablero de Hechos: fachada nocturna; las persianas de cada ventana se enrollan
// (se "abren") según el porcentaje y dejan ver el dibujo de fondo (imageUrl). Sólo el lienzo.
import { useMemo } from 'react'
import clsx from 'clsx'
import { rng } from './carteleraHelpers.js'

const BOARD_W = 700, BOARD_H = 860
const COLS = 4, ROWS = 5, TOTAL = COLS * ROWS // 20
const GLASS_W = 116, GLASS_H = 128

const GLOWS = [
  '#e9a23a', '#2f7f76', '#c95566', '#3f72b8', '#5a8a5a', '#8a5aa6',
  '#d98f3a', '#4a6f9a', '#cf6b4c', '#3f8f86', '#b5557a', '#c9a23a',
]

function buildWindows() {
  const r = rng(20260603)
  const cellW = BOARD_W / COLS, cellH = BOARD_H / ROWS
  const items = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cx = (col + 0.5) * cellW, cy = (row + 0.5) * cellH
      items.push({
        cellW, cellH, left: col * cellW, top: row * cellH,
        glassLeft: cx - GLASS_W / 2, glassTop: cy - GLASS_H / 2,
        glow: GLOWS[(row * COLS + col) % GLOWS.length],
      })
    }
  }
  const order = items.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  const rank = new Array(items.length)
  order.forEach((idx, pos) => { rank[idx] = pos })
  return { items, rank }
}

function Window({ it, open, imageUrl }) {
  const paneStyle = {
    backgroundSize: `${BOARD_W}px ${BOARD_H}px`,
    backgroundPosition: `${-it.glassLeft}px ${-it.glassTop}px`,
  }
  if (imageUrl) paneStyle.backgroundImage = `url("${imageUrl}")`
  return (
    <div className={clsx('cart-win', open && 'open')}
      style={{ left: it.left, top: it.top, width: it.cellW, height: it.cellH, '--glow': it.glow }}>
      <div className="lintel" style={{ width: GLASS_W + 30 }} />
      <div className="frame">
        <div className="glass" style={{ width: GLASS_W, height: GLASS_H }}>
          <div className="pane" style={paneStyle} />
          <div className="tint" style={{ background: it.glow }} />
          <div className="bloom" />
          <div className="mull-v" /><div className="mull-h" />
          <div className="blind" />
        </div>
      </div>
      <div className="sill" style={{ width: GLASS_W + 36 }} />
    </div>
  )
}

export default function TableroHechos({ pct = 0, scale = 1, imageUrl, onOpenList }) {
  const { items, rank } = useMemo(buildWindows, [])
  const openCount = Math.round(Math.max(0, Math.min(100, pct)) / 100 * TOTAL)
  return (
    <div className="cart-canvas cart-building" style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${scale})`, cursor: onOpenList ? 'pointer' : 'default' }}
      onClick={onOpenList} title={onOpenList ? 'Ver la lista' : undefined}>
      {items.map((it, i) => <Window key={i} it={it} open={rank[i] < openCount} imageUrl={imageUrl} />)}
    </div>
  )
}
