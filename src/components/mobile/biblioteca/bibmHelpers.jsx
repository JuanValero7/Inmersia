// =============================================================
// INMERSIA · Biblioteca mobile — helpers visuales + portada.
// Espeja la capa "acuarela" del desktop (clay/helpers.jsx) con
// proporciones afinadas para mobile. Sin dependencias de datos:
// consume el `book` ya mapeado por el orquestador.
// =============================================================
import React from 'react'

export const INK = '#4a3622'
export const ACCENT = '#cf7b4c'
export const GREEN = '#6f9457'
export const WALL = '#b0bdca'

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

// Paleta "libro de cuento" — relleno cuando el libro no trae color de categoría
export const STORYBOOK = ['#e7dcc2', '#a7c4d2', '#86ad9e', '#d98b5f', '#d56a52', '#e0b256', '#7d8db5', '#cf8ea4', '#b9cf94', '#cf9a86', '#e9cf9b', '#9cb0c8', '#c98b6b', '#8fb6ad']
export const spineColor = (b) => STORYBOOK[hashOf(b.id) % STORYBOOK.length]

// tamaños de lomo (variación según páginas + hash → look ilustrado)
export const spineW = (b) => Math.max(26, Math.min(52, Math.round((b.pages / 800) * 22 + 28) + (hashOf(b.id) % 7) - 3))
export const spineH = (b) => Math.round(112 + (hashOf(b.id + 'h') % 44)) // 112..156

// ─── Portada face-out (generada o real) ─────────────────────
export function BookCover({ book, h = 150 }) {
  const w = Math.round(h * 0.66)
  const radius = '5px 7px 7px 5px'
  const frame = {
    width: w, height: h, borderRadius: radius, flexShrink: 0, position: 'relative',
    overflow: 'hidden', border: `2px solid ${INK}`,
    boxShadow: `1.6px 2px 0 ${INK}26, 4px 6px 13px rgba(60,42,22,0.16)`,
  }
  // portada real (si el libro la trae)
  if (book.cover) {
    return (
      <div style={{ ...frame, background: '#cdbfa8' }}>
        <img src={book.cover} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }
  const c = book.color || '#8c6838'
  const light = lum(c) > 0.62
  const fg = light ? 'rgba(40,28,16,0.92)' : 'rgba(255,250,240,0.96)'
  const sub = light ? 'rgba(40,28,16,0.62)' : 'rgba(255,250,240,0.7)'
  return (
    <div style={{ ...frame, background: `linear-gradient(150deg, ${inmTint(c, 0.18)}, ${inmTint(c, -0.16)})`,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '11px 10px 12px' }}>
      <div style={{ position: 'absolute', top: 0, left: 4, width: 3, height: '100%', background: 'rgba(255,255,255,0.18)' }} />
      <div style={{ width: 22, height: 4, borderRadius: 3, background: light ? 'rgba(40,28,16,0.4)' : 'rgba(255,247,225,0.85)' }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: h > 150 ? 13 : 11.5, lineHeight: 1.12, color: fg,
          display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          textShadow: light ? 'none' : '0 1px 2px rgba(0,0,0,0.35)' }}>{book.title}</div>
        <div style={{ fontSize: 9.5, color: sub, marginTop: 4, fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.author}</div>
      </div>
    </div>
  )
}
