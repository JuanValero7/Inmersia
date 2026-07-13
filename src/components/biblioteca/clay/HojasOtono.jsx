import React from 'react'
import useIsMobile from '../../../hooks/useIsMobile.js'

// =============================================================
// ACUARELA · Hojas de otoño cayendo + cama acumulada en la base,
// capa ambiental del hero "Seguir leyendo" (solo desktop ≥1024px).
// Handoff: Documentation/design_handoff_hero_hojas_otono. Viento
// fijo en "calma" y paleta de otoño fija (únicas variantes que
// se aprobaron). La densidad progresa sola durante la sesión.
// =============================================================

const MAPLE = [
  { d: 'M32 4 Q37 13 41 19 Q47 11 56 20 Q53 30 45 33 Q37 39 33 47 Q29 39 19 33 Q11 30 8 20 Q17 11 23 19 Q27 13 32 4 Z', fill: 'currentColor' },
  { d: 'M32 47 Q31 54 29 60', fill: 'none', stroke: 'rgba(74,54,34,0.45)', strokeWidth: 1.6, strokeLinecap: 'round' },
  { d: 'M32 10 L32 44 M32 30 L17 22 M32 30 L47 22', fill: 'none', stroke: 'rgba(74,54,34,0.30)', strokeWidth: 1.2, strokeLinecap: 'round' },
]
const OVATE = [
  { d: 'M32 4 Q50 18 49 34 Q47 48 32 52 Q17 48 15 34 Q14 18 32 4 Z', fill: 'currentColor' },
  { d: 'M32 52 Q31 57 29 61', fill: 'none', stroke: 'rgba(74,54,34,0.45)', strokeWidth: 1.6, strokeLinecap: 'round' },
  { d: 'M32 9 L32 49 M32 22 L22 27 M32 22 L42 27 M32 34 L23 39 M32 34 L41 39', fill: 'none', stroke: 'rgba(74,54,34,0.30)', strokeWidth: 1.2, strokeLinecap: 'round' },
]
const SHAPES = [MAPLE, OVATE]
const COLORS = ['#e0a94a', '#b5613a', '#c96f2e', '#c25f32', '#8fae5f', '#d98a4a', '#cf9b3f', '#9c4a28', '#6f9457', '#d99a3f', '#e08a45', '#cf7b3a']

// viento fijo en "calma": caída lenta, vaivén suave (única variante aprobada)
const SPEED_MULT = 1.35, SWAY_MULT = 0.75

const DENSITY = {
  ligera: { falling: 12, pile: 32 },
  abundante: { falling: 24, pile: 64 },
  torrencial: { falling: 40, pile: 100 }, // topado por rendimiento, no subir sin medir en dispositivo real
}

const SESSION_KEY = 'inmersia-hero-session-start'
const FIVE_MIN = 5 * 60 * 1000, THIRTY_MIN = 30 * 60 * 1000
const POLL_MS = 15000

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function currentStage() {
  const start = Number(sessionStorage.getItem(SESSION_KEY) || Date.now())
  const elapsed = Date.now() - start
  if (elapsed >= THIRTY_MIN) return 'torrencial'
  if (elapsed >= FIVE_MIN) return 'abundante'
  return 'ligera'
}

function LeafShape({ shapeIdx }) {
  return SHAPES[shapeIdx].map((p, i) => <path key={i} {...p} />)
}

function buildFalling(n) {
  const rnd = mulberry32(1337)
  const leaves = []
  for (let i = 0; i < n; i++) {
    const left = rnd() * 94 + 2
    const size = Math.round(15 + rnd() * 18)
    const color = COLORS[Math.floor(rnd() * COLORS.length)]
    const sign = rnd() < 0.5 ? -1 : 1
    const drift = Math.round(rnd() * 24 + 14) * sign * SWAY_MULT
    const sway = Math.round(rnd() * 20 + 14) * sign * SWAY_MULT
    const spin = Math.round(190 + rnd() * 140) * SWAY_MULT
    const dur = (6.4 + rnd() * 3.6) * SPEED_MULT
    const delay = rnd() * 8.5
    leaves.push({ key: i, left, size, color, drift, sway, spin, dur, delay, shapeIdx: i % 2 })
  }
  return leaves.map(lf => (
    <svg key={lf.key} className="hero-leaf" viewBox="0 0 64 64" style={{
      left: `${lf.left.toFixed(1)}%`, width: lf.size, height: lf.size, color: lf.color,
      '--drift': `${lf.drift.toFixed(1)}px`, '--sway': `${lf.sway.toFixed(1)}px`, '--spin': `${lf.spin.toFixed(1)}deg`,
      animationDuration: `${lf.dur.toFixed(1)}s`, animationDelay: `${lf.delay.toFixed(1)}s`,
    }}>
      <LeafShape shapeIdx={lf.shapeIdx} />
    </svg>
  ))
}

function buildPile(n) {
  const rnd = mulberry32(4242)
  const leaves = []
  for (let i = 0; i < n; i++) {
    const left = rnd() * 100
    const t = (left - 50) / 60
    const moundHeight = 27 * Math.exp(-t * t * 2.1)
    const bottom = moundHeight * (0.1 + rnd() * 1.05) - 5
    const size = Math.round(14 + rnd() * 22)
    const color = COLORS[Math.floor(rnd() * COLORS.length)]
    const rot = Math.round(rnd() * 360)
    leaves.push({ bottom, left, size, color, rot, shapeIdx: Math.floor(rnd() * 2) })
  }
  leaves.sort((a, b) => a.bottom - b.bottom)
  return leaves.map((lf, i) => (
    <svg key={i} viewBox="0 0 64 64" style={{
      left: `${lf.left.toFixed(1)}%`, bottom: `${lf.bottom.toFixed(1)}px`,
      width: lf.size, height: lf.size, color: lf.color, transform: `rotate(${lf.rot}deg)`,
    }}>
      <LeafShape shapeIdx={lf.shapeIdx} />
    </svg>
  ))
}

// Capa puramente decorativa: hojas cayendo + cama acumulada en la base
// del hero. Se monta detrás del gato y del degradado (ver HeaderSwimlane.jsx,
// se renderiza antes que ellos en el DOM, mismo z-index) para que no
// interfiera visualmente ni con el gato ni con el contenido del hero.
function HojasOtono() {
  const isBelowDesktop = useIsMobile(1023) // desktop real = ancho > 1023, ver handoff (min-width:1024px)
  const desktop = !isBelowDesktop
  const [stage, setStage] = React.useState(null)

  React.useEffect(() => {
    if (!desktop) { setStage(null); return }
    if (!sessionStorage.getItem(SESSION_KEY)) sessionStorage.setItem(SESSION_KEY, String(Date.now()))
    const tick = () => setStage(currentStage())
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => clearInterval(id)
  }, [desktop])

  const density = stage ? DENSITY[stage] : null
  const falling = React.useMemo(() => density ? buildFalling(density.falling) : null, [density])
  const pile = React.useMemo(() => density ? buildPile(density.pile) : null, [density])

  if (!desktop || !density) return null

  return (
    <>
      <div className="hero-leaves-layer">{falling}</div>
      <div className="hero-leaf-bed">{pile}</div>
    </>
  )
}

export { HojasOtono }
