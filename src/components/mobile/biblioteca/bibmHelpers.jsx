// =============================================================
// INMERSIA · Biblioteca mobile — helpers visuales + portada.
// Espeja la capa "acuarela" del desktop con proporciones afinadas
// para mobile. Las funciones puras (inmTint, hashOf, spineColor, INK)
// se re-exportan desde ../../biblioteca/coverHelpers.shared.js;
// aquí viven solo los tamaños de lomo y el BookCover propios de mobile.
// Consume el `book` ya mapeado por el orquestador.
// =============================================================
import React from 'react'
import { INK, inmTint, hashOf, spineColor, tituloFontSize, autorFontSize } from '../../biblioteca/coverHelpers.shared.js'

export { INK, inmTint, hashOf, spineColor }

export const ACCENT = '#F2792A'
export const GREEN = '#6f9457'
export const WALL = '#f1e8d4' // mismo fondo de estante que la versión desktop

// tamaños de lomo (variación según páginas + hash → look ilustrado)
export const spineW = (b) => Math.max(26, Math.min(52, Math.round((b.pages / 800) * 22 + 28) + (hashOf(b.id) % 7) - 3))
export const spineH = (b) => Math.round(112 + (hashOf(b.id + 'h') % 44)) // 112..156

// ─── Portada face-out (generada o real) ─────────────────────
// Misma estética ilustrada que la Tienda (.book/.book-cover/...):
// portada + lomo/base + canto de páginas, con título y autor
// superpuestos. El ancho se deriva de `h` para no romper los
// tamaños ya afinados en cada sitio (hero, carrusel, ficha...).
export function BookCover({ book, h = 150 }) {
  const w = Math.round(h * 210 / 305)
  const c = book.color || '#8c6838'
  return (
    <div className="book" style={{ '--cov': c, width: w }}>
      <div className="book-cover">
        {book.cover
          ? <img className="book-art-img" src={book.cover} alt={book.title} />
          : <div className="book-art-empty" />}
        <span className="book-scribble" style={{ fontSize: autorFontSize(w, book.author) }}>{book.author}</span>
        <span className="book-title" style={{ fontSize: tituloFontSize(w, book.title) }}>{book.title}</span>
      </div>
      <div className="book-base" />
      <div className="book-pages" />
    </div>
  )
}
