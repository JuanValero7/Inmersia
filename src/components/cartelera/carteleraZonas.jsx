// Formato: Plain JavaScript (.jsx)
// Piezas reutilizables de las carteleras (landing desktop y mobile): los
// renderers de cada "zona rica" (foto pasaporte, documento A4, evidencia,
// plano azul, pin, pop-up) y los helpers de hilos rojos. Todo es prop-driven
// (posición/tamaño llegan de afuera) para que cada landing imponga su propia
// geometría — apaisada en desktop, vertical en mobile — sin duplicar dibujo.
import { useEffect } from 'react'
import { rng } from './carteleraHelpers.js'

// ── Tamaños/tipos intrínsecos a las evidencias de la zona Hechos ──
export const HECHOS_TYPES = ['factura', 'polaroid', 'periodico']
export const HECHOS_SIZE = {
  factura:   { w: 52, h: 94 },
  polaroid:  { w: 74, h: 88 },
  periodico: { w: 104, h: 80 },   // recorte de diario: foto cuadrada + columna de texto
}
export const POLA_COLORS = ['#8fa9b0', '#b79b86', '#9aa6b8', '#a8b59a', '#c2a0a6']  // fondos opacos

// ── Helpers de hilos rojos (puros, sin geometría propia) ──
// Ordena puntos por vecino más cercano desde `start` → camino de hilo prolijo
export function orderNearest(start, pts) {
  const rest = pts.slice(), out = []
  let cur = start
  while (rest.length) {
    let bi = 0, bd = Infinity
    for (let i = 0; i < rest.length; i++) { const d = Math.hypot(rest[i].x - cur.x, rest[i].y - cur.y); if (d < bd) { bd = d; bi = i } }
    cur = rest[bi]; out.push(cur); rest.splice(bi, 1)
  }
  return out
}
// Elige hasta 3 índices "al azar estables" (menor prioridad) entre los visibles
export function pick3(count, priority) {
  return [...Array(count).keys()].sort((a, b) => priority[a] - priority[b]).slice(0, 3)
}
// Curva con "panza" entre dos puntos (mismo estilo que los hilos del corcho)
export function threadD(a, b) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  const sag = Math.min(28, Math.hypot(a.x - b.x, a.y - b.y) * 0.07 + 5)
  return `M ${a.x} ${a.y} Q ${mx} ${my + sag} ${b.x} ${b.y}`
}
// Cadena de segmentos: hoja → puntos elegidos (ordenados por cercanía)
export function threadChain(tie, pts) {
  const chain = [tie, ...orderNearest(tie, pts)]
  return chain.slice(1).map((p, i) => threadD(chain[i], p))
}

// ── Pin de mapa (ubicación) ──
export function Pin({ x, y }) {
  return (
    <svg className="cart-map-dot" viewBox="0 0 24 34" style={{ left: x, top: y }} aria-hidden="true">
      <path d="M12 33 C 12 33 3 19 3 12 A 9 9 0 1 1 21 12 C 21 19 12 33 12 33 Z" fill="#c23b2e" stroke="#7c241b" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.6" fill="#fbeee9" />
    </svg>
  )
}

// Silueta placeholder (sin personaje detrás), estilo foto de pasaporte
function Silueta() {
  return (
    <svg className="cart-pass-sil" viewBox="0 0 100 120" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="120" fill="#cfe0ea" />
      <g fill="#5f86a6">
        <circle cx="50" cy="46" r="21" />
        <path d="M14 120 C 14 90, 32 76, 50 76 C 68 76, 86 90, 86 120 Z" />
      </g>
    </svg>
  )
}

export function PassportPhoto({ s, w = 46, h = 58 }) {
  return (
    <div className="cart-pass" aria-hidden="true"
      style={{ left: s.x, top: s.y, width: w, height: h }}>
      <span className="cart-pass-pin" style={{ background: `radial-gradient(circle at 35% 30%, #fff7, ${s.pin} 62%, rgba(0,0,0,.35))` }} />
      <div className="cart-pass-clip"><Silueta /></div>
    </div>
  )
}

// Documento placeholder A4: nada legible (líneas), con bloques tachados y
// comentarios rojos (elipses a mano). Distinto por seed → la pila no se repite.
function DocSheet({ seed }) {
  const r = rng(seed * 7919 + 13)
  const MX = 12, RIGHT = 100 - MX, MAXW = RIGHT - MX
  const MY_TOP = 16, MY_BOT = 16
  const nb = 2 + Math.floor(r() * 2)
  const blocks = []; let bx = MX
  for (let k = 0; k < nb; k++) {
    const room = RIGHT - bx
    if (room < 12) break
    const w = Math.min(14 + r() * 20, room)
    blocks.push({ x: bx, w }); bx += w + 6
  }
  const yStart = 40, yEnd = 141 - MY_BOT
  const nl = 13 + Math.floor(r() * 4)
  const step = (yEnd - yStart) / (nl - 1)
  const lines = []
  for (let k = 0; k < nl; k++) {
    const w = 30 + r() * (MAXW - 30)
    lines.push({ y: yStart + k * step, w, strike: false })
  }
  const nStrike = 2 + Math.floor(r() * 2)
  for (let k = 0; k < nStrike; k++) lines[Math.floor(r() * lines.length)].strike = true
  const ells = []
  const nEll = 1 + Math.floor(r() * 2)
  for (let k = 0; k < nEll; k++) {
    const ei = 2 + Math.floor(r() * Math.max(1, lines.length - 4))
    const rx = 16 + r() * 9
    const cx = (MX + rx) + r() * ((RIGHT - rx) - (MX + rx))
    ells.push({ cx, cy: lines[ei].y + 3, rx, ry: 6 + r() * 3.5, rot: (r() * 2 - 1) * 12 })
  }
  return (
    <svg className="cart-doc-svg" viewBox="0 0 100 141" preserveAspectRatio="none" aria-hidden="true">
      {blocks.map((b, i) => <rect key={'b' + i} x={b.x} y={MY_TOP} width={b.w} height="7" rx="1.5" fill="#b3ab9b" />)}
      {lines.map((l, i) => (
        <g key={'l' + i}>
          <rect x={MX} y={l.y} width={l.w} height="2.2" rx="1.1" fill="#cbc1ad" />
          {l.strike && <rect x={MX} y={l.y + 0.2} width={l.w} height="1.9" rx="1" fill="#8a7d63" opacity="0.92" />}
        </g>
      ))}
      {ells.map((e, i) => <ellipse key={'e' + i} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="none" stroke="#c23b2e" strokeWidth="1.6"
        transform={`rotate(${e.rot} ${e.cx} ${e.cy})`} />)}
    </svg>
  )
}

// Documento decorativo (no interactivo): el click lo captura la zona única.
export function DocSheetCard({ s, z, w = 112, h = 150 }) {
  return (
    <div className="cart-doc" aria-hidden="true"
      style={{ left: s.x, top: s.y, width: w, height: h, zIndex: z, '--rot': `${s.rot}deg` }}>
      <span className="cart-doc-pin" style={{ background: `radial-gradient(circle at 35% 30%, #fff7, ${s.pin} 62%, rgba(0,0,0,.35))` }} />
      <DocSheet seed={s.seed} />
    </div>
  )
}

// Cara de cada evidencia de la zona Hechos (placeholder, sin contenido real).
function HechoFace({ type, seed, color }) {
  const r = rng(seed * 5077 + 11)
  if (type === 'factura') {
    const nl = 6 + Math.floor(r() * 3)
    const lines = []; let y = 26
    for (let k = 0; k < nl; k++) { lines.push({ y, w: 20 + r() * 22 }); y += 7 }
    const bars = []; let bx = 8
    while (bx < 44) { const bw = 1 + r() * 2.4; bars.push({ x: bx, w: bw }); bx += bw + 1.2 + r() * 2 }
    return (
      <svg viewBox="0 0 52 94" preserveAspectRatio="none" className="hf-svg" aria-hidden="true">
        <rect x="8" y="10" width="36" height="8" rx="1.5" fill="#b3a891" />
        {lines.map((l, i) => <rect key={i} x="8" y={l.y} width={l.w} height="2" rx="1" fill="#cbc1ad" />)}
        {bars.map((b, i) => <rect key={'b' + i} x={b.x} y="80" width={b.w} height="9" fill="#5a4f3d" />)}
      </svg>
    )
  }
  if (type === 'polaroid') {
    return (<>
      <div className="hf-pola-photo" style={{ background: `linear-gradient(135deg, rgba(255,255,255,.22), rgba(0,0,0,.14)), ${color}` }} />
      <span className="hf-pola-cap" />
    </>)
  }
  const colLines = []; let cy = 20
  for (let k = 0; k < 6; k++) { colLines.push({ y: cy, w: 34 + r() * 12 }); cy += 7 }
  const footLines = []; let fy = 64
  for (let k = 0; k < 2; k++) { footLines.push({ y: fy, w: 44 + r() * 50 }); fy += 8 }
  return (
    <svg viewBox="0 0 104 80" preserveAspectRatio="none" className="hf-svg" aria-hidden="true">
      <rect x="6" y="5" width={66 + r() * 24} height="5" rx="1" fill="#4a4235" />
      <rect x="6" y="12" width={40 + r() * 30} height="3" rx="1" fill="#8a8172" />
      <rect x="6" y="20" width="40" height="38" rx="1" fill="#b3ab9b" />
      <path d="M6 52 L18 40 L27 47 L37 35 L46 43 L46 58 L6 58 Z" fill="#8f887a" opacity="0.75" />
      <circle cx="15" cy="30" r="4.2" fill="#cfc8b8" />
      {colLines.map((l, i) => <rect key={i} x="52" y={l.y} width={l.w} height="2" rx="1" fill="#b6ad9b" />)}
      {footLines.map((l, i) => <rect key={'f' + i} x="6" y={l.y} width={l.w} height="2" rx="1" fill="#b6ad9b" />)}
    </svg>
  )
}

// Evidencia decorativa (no interactiva): el click lo captura la zona única.
export function HechoItem({ it }) {
  const { w, h } = HECHOS_SIZE[it.type]
  return (
    <div className={`cart-hecho cart-hecho-${it.type}`} aria-hidden="true"
      style={{ left: it.x, top: it.y, width: w, height: h, '--rot': `${it.rot}deg` }}>
      <span className="cart-hecho-pin" style={{ background: `radial-gradient(circle at 35% 30%, #fff7, ${it.pin} 62%, rgba(0,0,0,.35))` }} />
      <HechoFace type={it.type} seed={it.seed} color={it.color} />
    </div>
  )
}

// Plano azul (blueprint) decorativo detrás de las evidencias de Hechos.
// `rect` = { x, y, w, h, rot } en coords del tablero.
export function BlueprintBg({ rect }) {
  const gv = [], gh = []
  for (let x = 8; x < 100; x += 8) gv.push(x)
  for (let y = 8; y < 70; y += 8) gh.push(y)
  return (
    <div className="cart-plano" aria-hidden="true"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, '--rot': `${rect.rot}deg` }}>
      <svg viewBox="0 0 100 70" preserveAspectRatio="none" className="cart-plano-svg">
        <rect x="0" y="0" width="100" height="70" fill="#1f4f86" />
        <g stroke="rgba(255,255,255,.10)" strokeWidth="1" vectorEffect="non-scaling-stroke">
          {gv.map((x, i) => <line key={'v' + i} x1={x} y1="0" x2={x} y2="70" />)}
          {gh.map((y, i) => <line key={'h' + i} x1="0" y1={y} x2="100" y2={y} />)}
        </g>
        <g fill="none" stroke="rgba(233,240,255,.82)" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
          <rect x="10" y="12" width="80" height="48" />
          <line x1="48" y1="12" x2="48" y2="60" />
          <line x1="10" y1="38" x2="48" y2="38" />
          <rect x="48" y="38" width="42" height="22" />
          <path d="M48 26 A 12 12 0 0 1 36 38" />
          <circle cx="70" cy="24" r="8" />
          <line x1="18" y1="46" x2="40" y2="46" />
          <line x1="18" y1="52" x2="34" y2="52" />
        </g>
        <g stroke="rgba(233,240,255,.5)" strokeWidth="1" vectorEffect="non-scaling-stroke">
          <line x1="10" y1="6" x2="90" y2="6" />
          <line x1="10" y1="4" x2="10" y2="8" /><line x1="90" y1="4" x2="90" y2="8" />
        </g>
      </svg>
    </div>
  )
}

// Pop-up genérico de zona: media grande + título + botón a la lista
export function ZonePopup({ media, title, listLabel, onOpenList, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="cart-map-modal" onClick={onClose}>
      <div className="cart-map-modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cart-map-modal-x" onClick={onClose} aria-label="Cerrar">×</button>
        <div className="cart-map-modal-media">{media}</div>
        <div className="cart-map-modal-foot">
          <span className="cart-map-modal-ttl">{title}</span>
          <button type="button" className="cart-sec-btn" onClick={onOpenList}>{listLabel}</button>
        </div>
      </div>
    </div>
  )
}
