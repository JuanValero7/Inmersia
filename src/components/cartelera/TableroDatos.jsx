// Formato: Plain JavaScript (.jsx)
// Tablero de Datos/Resumen: los libros cubren la placa de estadísticas de
// lectura y se retiran al azar a medida que el usuario se acerca al final.
import { useMemo } from 'react'
import { rng } from './carteleraHelpers.js'
import Placa from '../album/Placa.jsx'
import '../../styles/album.css'

const BOARD_W = 700, BOARD_H = 860
const COLS = 6, ROWS = 8

// Las stats (useReadingStats) solo se cargan a partir de este avance — ver
// STATS_FROM_PCT en useCartelera.js. El retiro de libros se remapea al mismo
// tramo para que no quede un lienzo vacío entre medio (libros ya idos, placa
// todavía sin datos): antes del umbral no se retira ningún libro.
const REVEAL_FROM_PCT = 90

const COVERS = [
  '#df9c63', '#d4866f', '#e4bd6e', '#c97a47', '#b96440', '#e0a878',
  '#df9c63', '#d4866f', '#e4bd6e', '#c97a47',
  '#aebb9c', '#9aa3bd', '#c39ab4', '#8f9fb0',
]

// dos grillas entrelazadas + libros sobredimensionados → cubren todo al 0%.
// Orden de remoción aleatorio → al avanzar se retiran al azar.
function buildBooks() {
  const r = rng(20260604)
  const cellW = BOARD_W / COLS, cellH = BOARD_H / ROWS
  const books = []
  for (const p of [{ ox: 0, oy: 0 }, { ox: 0.5, oy: 0.5 }]) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = (col + 0.5 + p.ox) * cellW + (r() * 2 - 1) * cellW * 0.12
        const y = (row + 0.5 + p.oy) * cellH + (r() * 2 - 1) * cellH * 0.12
        const open = r() < 0.30
        const s = 1.9 + r() * 0.5
        const rot = (r() * 2 - 1) * 10
        const cov = COVERS[Math.floor(r() * COVERS.length)]
        const front = r() < 0.45
        const dur = (4.2 + r() * 4).toFixed(2) + 's'
        const del = (-r() * 5).toFixed(2) + 's'
        books.push({ x, y, open, s, rot, cov, front, dur, del })
      }
    }
  }
  const removal = books.map((_, i) => i)
  for (let i = removal.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [removal[i], removal[j]] = [removal[j], removal[i]] }
  const remRank = new Array(books.length)
  removal.forEach((bi, pos) => { remRank[bi] = pos })
  return { books, remRank }
}

function Book({ b, visible }) {
  const t = `rotate(${b.rot}deg) scale(${visible ? b.s : b.s * 0.5})`
  const shape = b.open
    ? (<div className="cart-bk-open" style={{ width: 78, height: 58 }}>
        <div className="cov" style={{ width: 86, height: 64, background: b.cov }} />
        <div className="pg l" /><div className="pg r" />
      </div>)
    : (<div className="cart-bk-closed" style={{ width: 56, height: 74, background: b.cov }}>
        <div className="edge" />
      </div>)
  return (
    <div className="cart-bk" style={{ left: b.x, top: b.y, opacity: visible ? 1 : 0, transform: t,
      zIndex: b.front ? 15 : 5, marginLeft: -39, marginTop: -37 }}>
      <div className="cart-drift" style={{ '--dur': b.dur, '--del': b.del }}>{shape}</div>
    </div>
  )
}

export default function TableroDatos({ pct = 0, scale = 1, stats, onOpenList }) {
  const { books, remRank } = useMemo(buildBooks, [])
  const total = books.length
  const revealPct = pct > REVEAL_FROM_PCT ? (pct - REVEAL_FROM_PCT) / (100 - REVEAL_FROM_PCT) * 100 : 0
  const removed = Math.round(Math.max(0, Math.min(100, revealPct)) / 100 * total)
  return (
    <div className="cart-canvas cart-well" style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${scale})`, cursor: onOpenList ? 'pointer' : 'default' }}
      onClick={onOpenList} title={onOpenList ? 'Ver la lista' : undefined}>
      <div className="cart-foto cart-foto-placa" style={{ zIndex: 1 }}>
        {stats ? <Placa pct={pct} leido={pct >= 100} stats={stats} /> : <div className="cart-foto-empty" />}
      </div>
      {books.map((b, i) => <Book key={i} b={b} visible={remRank[i] >= removed} />)}
    </div>
  )
}
