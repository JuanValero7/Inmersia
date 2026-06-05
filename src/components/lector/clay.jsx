// src/components/lector/clay.jsx
// Tokens y helpers de la estética "clay / acuarela" del lector.
// Mantiene coherencia con el resto de Inmersia (Baloo 2, tinta #4a3622,
// acento terracota, bordes con sombra offset).
import { useState } from 'react'

export const INK = '#4a3622'
export const ACCENT = '#cf7b4c'

// mezcla un hex con blanco (amt>0) o negro (amt<0)
export function tint(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt)
  const mix = (c) => Math.round((t - c) * p + c)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}

// Tema único (Ilustrado / acuarela)
export const theme = {
  ink: INK,
  accent: ACCENT,
  deskBg:
    'radial-gradient(130% 100% at 50% 0%, rgba(255,255,255,0.5), transparent 55%),' +
    'linear-gradient(180deg,#f3ede0 0%,#efe6d2 60%,#e7dcc2 100%)',
  vignette: 'radial-gradient(95% 80% at 50% 38%, transparent 60%, rgba(120,90,50,0.10) 100%)',
  textColor: INK,
  subText: 'rgba(74,54,34,0.6)',
  pageBg: 'radial-gradient(ellipse at 22% 8%, #fffdf6 0%, #f7efde 48%, #f0e4c8 100%)',
  pageInk: '#3a2a18',
  pageMeta: 'rgba(120,80,30,0.5)',
  pageEdge: '#e3d6b4',
  navBg: '#fffdf8',
  navBorder: INK,
  navText: INK,
  navHoverBg: '#fff',
  meter: ACCENT,
}

// Botón clay (pill con borde de tinta + sombra offset)
export function ClayButton({ children, onClick, variant = 'ghost', style = {}, title, disabled }) {
  const [hov, setHov] = useState(false)
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Baloo 2', sans-serif",
    fontWeight: 700, fontSize: 13.5, cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
    border: `2px solid ${INK}`, borderRadius: 999, padding: '8px 16px',
    transition: 'transform .12s, filter .15s, background .15s',
    boxShadow: `1.6px 2.4px 0 ${INK}30`, opacity: disabled ? 0.45 : 1,
    transform: hov && !disabled ? 'translateY(-1.5px)' : 'none',
  }
  const skin = variant === 'primary'
    ? { background: ACCENT, color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,0.22)' }
    : { background: hov ? theme.navHoverBg : theme.navBg, color: theme.navText }
  return (
    <button type="button" title={title} disabled={disabled} onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...base, ...skin, ...style }}>
      {children}
    </button>
  )
}
