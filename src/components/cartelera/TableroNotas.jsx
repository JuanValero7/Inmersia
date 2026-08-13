// Formato: Plain JavaScript (.jsx)
// Tablero de Notas / corcho: las 4 miniaturas EN VIVO de los otros tableros,
// notas decorativas (sin datos) que se revelan con el avance del libro (pct),
// e hilos rojos. La cantidad visible = round(pct/100 * TOTAL_NOTES).
// Geometría parametrizable: por defecto es el corcho vertical (700×860) usado
// como sección; el landing lo reusa en formato apaisado pasando boardW/boardH,
// cols/rows, embeds y center propios.
import { useMemo } from 'react'
import { rng } from './carteleraHelpers.js'
import TableroPersonajes from './TableroPersonajes.jsx'
import TableroLugares from './TableroLugares.jsx'
import TableroHechos from './TableroHechos.jsx'
import TableroDatos from './TableroDatos.jsx'

// Tamaño nativo de cada mini-tablero (todos los tableros dibujan a 700×860).
const SUB_W = 700
const MINI_W = 150
const MINI_SCALE = MINI_W / SUB_W
const MINI_H = Math.round(860 * MINI_SCALE)
const TOTAL_NOTES = 60

// Geometría por defecto (corcho vertical de la sección "Notas")
const DEF_BOARD_W = 700, DEF_BOARD_H = 860
const DEF_COLS = 9, DEF_ROWS = 10

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

// Posiciones por defecto (vertical). El landing pasa las suyas por props.
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

const DEF_CENTER = { cx: DEF_BOARD_W * 0.5, cy: DEF_BOARD_H * 0.5, w: 214, h: 234, rot: -3 }

const PALETTES = ['#f6f0df', '#f7e6ef', '#eef2f8', '#f0f4e8', '#f7f0d8']
const PINS     = ['#c23b2e', '#cf8ea4', '#e0b256', '#7d8db5', '#5a8a78', '#9e7dbf']

// Posiciones y estilos de las notas: seed fijo → mismo resultado siempre.
// No dependen de datos de Supabase. Se recalcula solo si cambia la geometría.
function buildNotas({ boardW, boardH, cols, rows, embeds, center, excludeRects = [] }) {
  const r = rng(20260606)
  const cellW = boardW / cols, cellH = boardH / rows
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
    const onEmbed  = embeds.some(e => Math.abs(x - e.cx) < 95 && Math.abs(y - e.cy) < 105)
    const onCenter = Math.abs(x - center.cx) < center.w * 0.48 && Math.abs(y - center.cy) < center.h * 0.48
    const onExcluded = excludeRects.some(rc => Math.abs(x - rc.cx) < rc.halfW && Math.abs(y - rc.cy) < rc.halfH)
    if (onEmbed || onCenter || onExcluded) continue
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
}

function Miniatura({ e, pct, imageUrl, stats, onClick, tableros }) {
  const Tablero = tableros[e.key]
  return (
    <div className="cart-embed" style={{ left: e.cx, top: e.cy, transform: `translate(-50%,-50%) rotate(${e.rot}deg)` }}>
      <button type="button" className="embox" onClick={onClick} aria-label={`Abrir ${e.label}`}>
        <span className="tape" />
        <div className="embox-clip" style={{ width: MINI_W, height: MINI_H }}>
          <Tablero pct={pct} scale={MINI_SCALE} imageUrl={imageUrl} stats={stats} />
        </div>
        <div className="veil" />
        <div className="lab">{e.label}</div>
      </button>
    </div>
  )
}

// Sello de goma del expediente: cambia con el avance de lectura.
function fileStamp(pct) {
  if (pct >= 100) return { txt: 'Expediente completo', cls: 'is-done' }
  if (pct > 0)    return { txt: 'Caso abierto',        cls: 'is-open' }
  return                 { txt: 'Sin pistas aún',      cls: 'is-empty' }
}

// Expediente central: carpeta SIEMPRE cerrada. Muestra la pestaña rotulada, un
// clip, el sello por avance (uno de tres) y un contador de teorías anotadas. El
// clic sobre ella abre las predicciones del Cuaderno (onOpenNotas), sin desplegar
// nada aquí. Se mantiene simple a propósito.
function FlatsheetContent({ items, pct = 0 }) {
  const stamp = fileStamp(pct)
  const n = items.length
  const countTxt = n === 0 ? 'Aún sin teorías'
    : n === 1 ? '1 teoría anotada' : `${n} teorías anotadas`
  return (
    <>
      <span className="cart-file-peek" aria-hidden="true" />
      <span className="cart-file-tab">Mis teorías</span>
      <span className="cart-file-clip" aria-hidden="true" />
      <span className={`cart-file-stamp ${stamp.cls}`}>{stamp.txt}</span>
      <span className="cart-file-face">
        <span className="cart-file-count">{countTxt}</span>
        <span className="cart-file-open">Toca para abrir →</span>
      </span>
    </>
  )
}

export default function TableroNotas({
  pct = 0, scale = 1, principal = {}, stats, onOpenSection, esNoficcion = false,
  notasItems = [], onOpenNotas,
  boardW = DEF_BOARD_W, boardH = DEF_BOARD_H, cols = DEF_COLS, rows = DEF_ROWS,
  embeds: embedsProp, center = DEF_CENTER, excludeRects, decorNotas = true, threads = true,
}) {
  const embeds   = embedsProp || (esNoficcion ? EMBEDS_NOFICCION : EMBEDS_FICCION)
  const tableros = esNoficcion ? TABLEROS_NOFICCION : TABLEROS_FICCION
  const visibleCount = Math.round(Math.max(0, Math.min(100, pct)) / 100 * TOTAL_NOTES)

  const allNotas = useMemo(
    () => decorNotas ? buildNotas({ boardW, boardH, cols, rows, embeds, center, excludeRects }) : [],
    [decorNotas, boardW, boardH, cols, rows, embeds, center, excludeRects]
  )
  const visibleNotas = allNotas.slice(0, visibleCount)

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
  }, [visibleCount, embeds, visibleNotas])

  return (
    <div className="cart-canvas cart-cork" style={{ width: boardW, height: boardH, transform: `scale(${scale})` }}>
      {/* hoja rayada plana al centro: predicciones reales del usuario */}
      <button type="button" className="cart-flatsheet" onClick={() => onOpenNotas?.()}
        style={{ left: center.cx, top: center.cy, width: center.w, height: center.h, transform: `translate(-50%,-50%) rotate(${center.rot}deg)` }}
        aria-label="Ver tus predicciones">
        <FlatsheetContent items={notasItems} pct={pct} />
      </button>

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

      {/* hilos rojos (el landing los apaga y dibuja los suyos propios) */}
      {threads && (
        <svg className="cart-threads" width={boardW} height={boardH}>
          {links.map(([a, b], k) => {
            const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2
            const sag = Math.min(28, Math.hypot(a.cx - b.cx, a.cy - b.cy) * 0.07 + 5)
            return <path key={k} d={`M ${a.cx} ${a.cy} Q ${mx} ${my + sag} ${b.cx} ${b.cy}`} fill="none" stroke="#c23b2e" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
          })}
        </svg>
      )}

      {/* miniaturas en vivo (los embeds "phantom" sólo tejen hilos, no se dibujan) */}
      {embeds.filter(e => !e.phantom).map(e => (
        <Miniatura key={e.key} e={e} pct={pct} imageUrl={principal[e.key]?.url} stats={stats}
          tableros={tableros}
          onClick={() => onOpenSection && onOpenSection(e.key)} />
      ))}
    </div>
  )
}
