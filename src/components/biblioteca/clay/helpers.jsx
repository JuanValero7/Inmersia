import React from 'react'
import { INK, inmTint, hashOf, lum, STORYBOOK, spineColor } from '../coverHelpers.shared.js'

// =============================================================
// ACUARELA · helpers + portada generada (face-out).
// Las funciones puras (inmTint, hashOf, lum, STORYBOOK, spineColor,
// INK) viven en ../coverHelpers.shared.js y se re-exportan aquí.
// Este archivo conserva los tamaños de lomo y el BookCover propios
// del desktop. Consume el `book` ya mapeado por el orquestador.
// =============================================================

// tamaños de lomo (variación según páginas + hash → look ilustrado)
const spineW = (b) => Math.max(30, Math.min(60, Math.round((b.pages / 800) * 24 + 32) + (hashOf(b.id) % 7) - 3));
const spineH = (b) => Math.round(96 + (hashOf(b.id + 'h') % 56)); // 96..152

// ─── Portada face-out ───────────────────────────────────────
// Si el libro tiene `cover` (portada_url) usa la imagen; si no,
// genera una portada con título + autor sobre el color del libro.
function BookCover({ book, h = 174, ink = INK }) {
  const w = Math.round(h * 0.66);
  const radius = '5px 7px 7px 5px';
  const frame = {
    width: w, height: h, borderRadius: radius, flexShrink: 0, position: 'relative',
    overflow: 'hidden', background: '#cdbfa8', border: `2px solid ${ink}`,
    boxShadow: `1.6px 2px 0 ${ink}26, 4px 6px 13px rgba(60,42,22,0.16)`,
  };
  if (book.cover) {
    return (
      <div style={frame}>
        <img src={book.cover} alt={book.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'linear-gradient(90deg, rgba(0,0,0,0.22), transparent)' }} />
      </div>
    );
  }
  // ── Portada generada (sin imagen) ──
  const c = book.color || '#8c6838';
  const light = lum(c) > 0.62;
  const fg = light ? 'rgba(40,28,16,0.92)' : 'rgba(255,250,240,0.96)';
  const sub = light ? 'rgba(40,28,16,0.62)' : 'rgba(255,250,240,0.7)';
  return (
    <div style={{ ...frame, background: `linear-gradient(150deg, ${inmTint(c, 0.18)}, ${inmTint(c, -0.16)})`,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '11px 10px 12px' }}>
      <div style={{ position: 'absolute', top: 0, left: 4, width: 3, height: '100%', background: 'rgba(255,255,255,0.18)' }} />
      <div style={{ width: 22, height: 4, borderRadius: 3, background: light ? 'rgba(40,28,16,0.4)' : 'rgba(255,247,225,0.85)' }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: h > 150 ? 13 : 11, lineHeight: 1.12, color: fg,
          display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          textShadow: light ? 'none' : '0 1px 2px rgba(0,0,0,0.35)' }}>{book.title}</div>
        <div style={{ fontSize: 9.5, color: sub, marginTop: 4, fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.author}</div>
      </div>
    </div>
  );
}

export { inmTint, hashOf, lum, STORYBOOK, spineColor, spineW, spineH, BookCover, INK };
