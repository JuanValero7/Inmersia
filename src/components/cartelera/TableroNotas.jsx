// Formato: Plain JavaScript (.jsx)
// Tablero de Notas: corcho con las 4 miniaturas EN VIVO de los otros tableros,
// notas decorativas (sin datos) que se revelan con el avance del libro (pct),
// e hilos rojos. La cantidad visible = round(pct/100 * TOTAL_NOTES).
import { useMemo } from 'react'
import { rng } from './carteleraHelpers.js'
import TableroPersonajes from './TableroPersonajes.jsx'
import TableroLugares from './TableroLugares.jsx'
import TableroHechos from './TableroHechos.jsx'
import TableroDatos from './TableroDatos.jsx'

const BOARD_W = 700, BOARD_H = 860
const MINI_W = 150
const MINI_SCALE = MINI_W / BOARD_W
const MINI_H = Math.round(BOARD_H * MINI_SCALE)
const TOTAL_NOTES = 60

const TABLEROS_FICCION = {
  personajes: TableroPersonajes,
  lugares: TableroLugares,
  hechos: TableroHechos,
  datos: TableroDatos,
}
const TABLEROS_NOFICCION = {
  glosario: TableroPersonajes,
  datos: TableroLugares,
  referencias: TableroHechos,
  resumen: TableroDatos,
}

// Posiciones idénticas en ficción y no ficción (mismo layout del corcho)
const EMBEDS_FICCION = [
  { key: 'personajes', label: 'Personajes', cx: 150, cy: 178, rot: -4, pin: '#c23b2e' },
  { key: 'hechos',     label: 'Hechos',     cx: 552, cy: 190, rot: 4,  pin: '#e0b256' },
  { key: 'lugares',    label: 'Lugares',    cx: 154, cy: 672, rot: 3,  pin: '#5a8a78' },
  { key: 'datos',      label: 'Datos',      cx: 548, cy: 684, rot: -4, pin: '#7d8db5' },
]
const EMBEDS_NOFICCION = [
  { key: 'glosario',    label: 'Glosario',    cx: 150, cy: 178, rot: -4, pin: '#c23b2e' },
  { key: 'referencias', label: 'Referencias', cx: 552, cy: 190, rot: 4,  pin: '#e0b256' },
  { key: 'datos',       label: 'Datos',       cx: 154, cy: 672, rot: 3,  pin: '#5a8a78' },
  { key: 'resumen',     label: 'Resumen',     cx: 548, cy: 684, rot: -4, pin: '#7d8db5' },
]

// Usado solo para el cálculo de exclusión de notas (mismas posiciones en ambos tipos)
const EMBEDS = EMBEDS_FICCION

const CENTER = { cx: BOARD_W * 0.5, cy: BOARD_H * 0.5, w: 214, h: 234, rot: -3 }

const PALETTES = ['#f6f0df', '#f7e6ef', '#eef2f8', '#f0f4e8', '#f7f0d8']
const PINS     = ['#c23b2e', '#cf8ea4', '#e0b256', '#7d8db5', '#5a8a78', '#9e7dbf']

// Posiciones y estilos de las 60 notas: calculados UNA VEZ al cargar el módulo
// (seed fijo → siempre el mismo resultado). No dependen de datos de Supabase.
const ALL_NOTAS = (() => {
  const r = rng(20260606)
  const cols = 9, rows = 10
  const cellW = BOARD_W / cols, cellH = BOARD_H / rows
  const cells = Array.from({ length: cols * rows }, (_, i) => i)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]]
  }
  const out = []
  for (const cell of cells) {
    if (out.length >= TOTAL_NOTES) break
    const col = cell % cols, row = Math.floor(cell / cols)
    // Consumir r() ANTES de saber si la celda es válida → secuencia siempre igual
    const fx = r(), fy = r()
    const frot = r(), fbg = r(), fw = r(), fh = r(), fdeco = r(), fpin = r()
    const x = (col + 0.1 + fx * 0.8) * cellW
    const y = (row + 0.1 + fy * 0.8) * cellH
    const onEmbed  = EMBEDS.some(e => Math.abs(x - e.cx) < 95 && Math.abs(y - e.cy) < 105)
    const onCenter = Math.abs(x - CENTER.cx) < CENTER.w * 0.48 && Math.abs(y - CENTER.cy) < CENTER.h * 0.48
    if (onEmbed || onCenter) continue
    out.push({
      x, y,
      rot:  (frot * 2 - 1) * 13,
      bg:   PALETTES[Math.floor(fbg  * PALETTES.length)],
      w:    80 + Math.floor(fw  * 6) * 8,   // 80 | 88 | 96 | 104 | 112 | 120
      h:    60 + Math.floor(fh  * 6) * 8,   // 60 | 68 | 76 | 84  |  92 | 100
      deco: fdeco < 0.28 ? 'bar' : fdeco < 0.52 ? 'circle' : 'none',
      pin:  PINS[Math.floor(fpin * PINS.length)],
    })
  }
  return out
})()

function Miniatura({ e, pct, imageUrl, onClick, tableros }) {
  const Tablero = tableros[e.key]
  return (
    <div className="cart-embed" style={{ left: e.cx, top: e.cy, transform: `translate(-50%,-50%) rotate(${e.rot}deg)` }}>
      <button type="button" className="embox" onClick={onClick} aria-label={`Abrir ${e.label}`}>
        <span className="tape" />
        <div className="embox-clip" style={{ width: MINI_W, height: MINI_H }}>
          <Tablero pct={pct} scale={MINI_SCALE} imageUrl={imageUrl} />
        </div>
        <div className="veil" />
        <div className="lab">{e.label}</div>
      </button>
    </div>
  )
}

export default function TableroNotas({ pct = 0, scale = 1, principal = {}, onOpenSection, esNoficcion = false }) {
  const embeds   = esNoficcion ? EMBEDS_NOFICCION : EMBEDS_FICCION
  const tableros = esNoficcion ? TABLEROS_NOFICCION : TABLEROS_FICCION
  const visibleCount = Math.round(Math.max(0, Math.min(100, pct)) / 100 * TOTAL_NOTES)
  const visibleNotas = ALL_NOTAS.slice(0, visibleCount)

  // hilos: loop entre las 4 miniaturas + cada nota a la miniatura más cercana
  const links = useMemo(() => {
    const out = []
    for (let k = 0; k < embeds.length; k++) out.push([embeds[k], embeds[(k + 1) % embeds.length]])
    for (const n of visibleNotas) {
      let best = embeds[0], bd = Infinity
      for (const e of embeds) { const d = Math.hypot(n.x - e.cx, n.y - e.cy); if (d < bd) { bd = d; best = e } }
      out.push([{ cx: n.x, cy: n.y }, best])
    }
    return out
  }, [visibleCount, esNoficcion])

  return (
    <div className="cart-canvas cart-cork" style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${scale})` }}>
      {/* hoja rayada plana al centro */}
      <div className="cart-flatsheet" style={{ left: CENTER.cx, top: CENTER.cy, width: CENTER.w, height: CENTER.h, transform: `translate(-50%,-50%) rotate(${CENTER.rot}deg)` }} />

      {/* notas decorativas (sin datos, reveladas por pct) */}
      {visibleNotas.map((n, i) => (
        <div key={i} className="cart-nota" style={{
          left: n.x, top: n.y,
          transform: `translate(-50%,-50%) rotate(${n.rot}deg)`,
          width: n.w, minHeight: n.h,
          background: n.bg,
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0 13px, rgba(74,90,140,.16) 13px 14px)`,
        }}>
          <span className="cart-pin" style={{ background: `radial-gradient(circle at 35% 30%, #fff7, ${n.pin} 62%, rgba(0,0,0,.35))` }} />
          {n.deco === 'bar' && (
            <div style={{ width: '68%', height: 3, background: 'rgba(194,59,46,.55)', borderRadius: 2, margin: '9px 0 5px' }} />
          )}
          {n.deco === 'circle' && (
            <div style={{ width: 15, height: 15, borderRadius: '50%', border: '1.5px solid rgba(100,80,60,.32)', margin: '7px 0 3px' }} />
          )}
        </div>
      ))}

      {/* hilos rojos */}
      <svg className="cart-threads" width={BOARD_W} height={BOARD_H}>
        {links.map(([a, b], k) => {
          const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2
          const sag = Math.min(28, Math.hypot(a.cx - b.cx, a.cy - b.cy) * 0.07 + 5)
          return <path key={k} d={`M ${a.cx} ${a.cy} Q ${mx} ${my + sag} ${b.cx} ${b.cy}`} fill="none" stroke="#c23b2e" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
        })}
      </svg>

      {/* miniaturas en vivo */}
      {embeds.map(e => (
        <Miniatura key={e.key} e={e} pct={pct} imageUrl={principal[e.key]?.url}
          tableros={tableros}
          onClick={() => onOpenSection && onOpenSection(e.key)} />
      ))}
    </div>
  )
}
