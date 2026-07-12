import React from 'react'
import { INK, inmTint, hashOf, spineColor, tituloFontSize, autorFontSize } from '../coverHelpers.shared.js'

// =============================================================
// ACUARELA · helpers + portada generada (face-out).
// Las funciones puras (inmTint, hashOf, spineColor,
// INK) viven en ../coverHelpers.shared.js y se re-exportan aquí.
// Este archivo conserva los tamaños de lomo y el BookCover propios
// del desktop. Consume el `book` ya mapeado por el orquestador.
// =============================================================

// tamaños de lomo (variación según páginas + hash → look ilustrado)
const spineW = (b) => Math.max(30, Math.min(60, Math.round((b.pages / 800) * 24 + 32) + (hashOf(b.id) % 7) - 3));
const spineH = (b) => Math.round(96 + (hashOf(b.id + 'h') % 56)); // 96..152

// ─── Portada face-out ───────────────────────────────────────
// Misma estética ilustrada que la Tienda (.book/.book-cover/...):
// portada + lomo/base + canto de páginas, con título y autor
// superpuestos. El ancho se deriva de `h` para no romper los
// tamaños ya afinados en cada sitio (hero, repisa...).
function BookCover({ book, h = 174 }) {
  const w = Math.round(h * 210 / 305);
  const c = book.color || '#8c6838';
  return (
    <div className="book" style={{ '--cov': c, width: w }}>
      <div className="book-cover">
        {book.cover
          ? <img className="book-art-img" src={book.cover} alt={book.title} loading="lazy" />
          : <div className="book-art-empty" />}
        <span className="book-scribble" style={{ fontSize: autorFontSize(w, book.author) }}>{book.author}</span>
        <span className="book-title" style={{ fontSize: tituloFontSize(w, book.title) }}>{book.title}</span>
      </div>
      <div className="book-base" />
      <div className="book-pages" />
    </div>
  );
}

export { inmTint, hashOf, spineColor, spineW, spineH, BookCover, INK };
