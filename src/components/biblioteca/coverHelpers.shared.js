// src/components/biblioteca/coverHelpers.shared.js
// ─────────────────────────────────────────────────────────────
// Helpers de color/portada COMUNES a desktop (clay/helpers.jsx) y
// mobile (mobile/biblioteca/bibmHelpers.jsx). Solo las funciones
// puras idénticas viven aquí; cada capa conserva su propio BookCover
// y sus tamaños de lomo (spineW/spineH), que difieren entre desktop
// y mobile a propósito.
// ─────────────────────────────────────────────────────────────

export const INK = '#4a3622'

// mezcla un hex con blanco (amt>0) o negro (amt<0)
export function inmTint(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt)
  const mix = (c) => Math.round((t - c) * p + c)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}

export function hashOf(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }

export function lum(hex) { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255 }

// Paleta "libro de cuento": variada y suave (clave del look acuarela)
export const STORYBOOK = ['#e7dcc2', '#a7c4d2', '#86ad9e', '#d98b5f', '#d56a52', '#e0b256', '#7d8db5', '#cf8ea4', '#b9cf94', '#cf9a86', '#e9cf9b', '#9cb0c8', '#c98b6b', '#8fb6ad']

export const spineColor = (b) => STORYBOOK[hashOf(b.id) % STORYBOOK.length]
