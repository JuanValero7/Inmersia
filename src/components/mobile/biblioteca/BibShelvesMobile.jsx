// =============================================================
// INMERSIA · Biblioteca mobile — estantes + carrusel de portadas.
// Estante por categoría: lomos en scroll-H, cap 15 por fila; si
// la categoría supera el cap, se crea otra fila de la misma
// categoría. Nicho de pared + tabla de madera + planta + etiqueta.
// =============================================================
import React from 'react'
import { INK, WALL, inmTint, hashOf, spineColor, spineW, spineH, BookCover } from './bibmHelpers.jsx'

const WALL_STYLE = {
  backgroundColor: WALL,
  backgroundImage:
    'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(40,30,18,0.07)),' +
    'repeating-linear-gradient(92deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 7px),' +
    'radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.14), transparent 60%)',
}
const WOOD = { body: 'linear-gradient(180deg,#d8a86a,#c98f4f)', under: '#9c6a36', grain: 'rgba(120,80,40,0.22)' }
const BOOK_AREA = 168
const CAP = 15 // máximo de lomos por fila

function Band({ c, w = '62%', t = 1.7 }) {
  return <div style={{ width: w, height: t, background: c, borderRadius: 2 }} />
}

function Spine({ book, onOpen }) {
  const w = spineW(book), h = spineH(book)
  const hh = hashOf(book.id)
  const bg = inmTint(spineColor(book), 0.44)
  const accentCol = inmTint(spineColor(book), -0.34)
  const round = `${8 + (hh % 4)}px ${7 + (hh % 5)}px 1px 1px`
  return (
    <div className="bibm-bk" title={`${book.title} — ${book.author}`}
      onClick={onOpen ? (e) => onOpen(book, e.currentTarget.getBoundingClientRect()) : undefined}
      style={{ position: 'relative', flexShrink: 0, width: w, height: h, background: bg,
        border: `2px solid ${INK}`, borderRadius: round, boxShadow: `1.5px 2px 0 ${INK}22`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0',
        justifyContent: 'space-between', overflow: 'hidden' }}>
      <Band c={accentCol} />
      <span className="bibm-bk-ttl" style={{ position: 'relative', fontSize: 11.5, fontWeight: 800,
        maxWidth: w - 4, color: '#37260f', letterSpacing: '0.01em' }}>{book.title}</span>
      <Band c={accentCol} />
    </div>
  )
}

function Plank() {
  return (
    <div style={{ position: 'relative', width: '100%', height: 18 }}>
      <div style={{ position: 'absolute', inset: 0, background: WOOD.body, border: `2px solid ${INK}`, borderRadius: '4px 4px 6px 6px', boxShadow: '0 11px 16px -10px rgba(70,46,20,0.42)' }}>
        <div style={{ position: 'absolute', top: 5, left: 0, right: 0, height: 2, background: INK, opacity: 0.3 }} />
        <div style={{ position: 'absolute', top: 10, left: '6%', width: '40%', height: 1.5, background: WOOD.grain, borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: 13, left: '54%', width: '30%', height: 1.5, background: WOOD.grain, borderRadius: 2 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '32%', background: WOOD.under, opacity: 0.55, borderRadius: '0 0 5px 5px' }} />
      </div>
    </div>
  )
}

function Plant({ idx, h = 92 }) {
  return (
    <div style={{ flexShrink: 0, height: h, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', alignSelf: 'flex-end', pointerEvents: 'none', paddingLeft: 4, paddingRight: 2 }}>
      <img src={`/assets/decor/m${idx}.webp`} alt="" style={{ maxHeight: '100%', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(2px 4px 4px rgba(60,42,22,0.18))' }} />
    </div>
  )
}

function cartoonTag(cat) {
  return { display: 'inline-flex', alignItems: 'center', background: cat.color, color: '#fff',
    fontWeight: 700, fontSize: 12, padding: '4px 12px 5px', borderRadius: 11, whiteSpace: 'nowrap',
    border: `2px solid ${INK}`, boxShadow: `1.4px 2px 0 ${INK}33`, textShadow: '0 1px 1px rgba(0,0,0,0.25)',
    maxWidth: '74%', overflow: 'hidden' }
}

function PlankRow({ books, plant, onOpen, last }) {
  return (
    <div style={{ position: 'relative', marginBottom: last ? 0 : 16 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 11, height: BOOK_AREA + 12, borderRadius: '10px 10px 4px 4px',
        ...WALL_STYLE, border: `2px solid ${INK}`, borderBottom: 'none',
        boxShadow: 'inset 0 10px 18px -10px rgba(40,30,18,0.4), inset 0 0 0 5px rgba(255,255,255,0.04)' }} />
      <div className="bibm-noscroll" style={{ position: 'relative', height: BOOK_AREA,
        display: 'flex', alignItems: 'flex-end', gap: 6, padding: '0 14px',
        overflowX: 'auto', overflowY: 'visible', scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}>
        {books.map(b => (
          <div key={b.id} style={{ scrollSnapAlign: 'start' }}>
            <Spine book={b} onOpen={onOpen} />
          </div>
        ))}
        {plant && <Plant idx={plant} />}
      </div>
      <Plank />
    </div>
  )
}

function chunkByCount(books, cap = CAP) {
  const rows = []
  for (let i = 0; i < books.length; i += cap) rows.push(books.slice(i, i + cap))
  return rows.length ? rows : [[]]
}

function ShelfCategory({ group, plantIdx, onOpen }) {
  const { cat, books } = group
  const rows = chunkByCount(books, CAP)
  return (
    <div style={{ position: 'relative', marginBottom: 30 }}>
      {rows.map((rowBooks, i) => (
        <PlankRow key={i} books={rowBooks} plant={i === rows.length - 1 ? plantIdx : null}
          onOpen={onOpen} last={i === rows.length - 1} />
      ))}
      <span style={{ position: 'absolute', left: 14, bottom: -13, zIndex: 6, ...cartoonTag(cat) }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{cat.nombre}</span>
        <span style={{ marginLeft: 6, opacity: 0.8, fontWeight: 500, flexShrink: 0 }}>· {books.length}</span>
      </span>
    </div>
  )
}

export function MobileShelves({ groups, onOpen }) {
  if (!groups.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(74,54,34,0.5)', fontWeight: 600, fontSize: 14 }}>No hay libros que mostrar.</div>
  }
  return (
    <div>
      {groups.map((g, i) => (
        <ShelfCategory key={g.cat.id} group={g} plantIdx={(i % 4) + 1} onOpen={onOpen} />
      ))}
    </div>
  )
}

// ─── Carrusel de portadas (Últimos abiertos, máx 3) ─────────
export function CoverCarousel({ books, onOpen }) {
  const H = 158
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 11, height: H + 18, borderRadius: '10px 10px 4px 4px',
        ...WALL_STYLE, border: `2px solid ${INK}`, borderBottom: 'none',
        boxShadow: 'inset 0 10px 18px -10px rgba(40,30,18,0.4), inset 0 0 0 5px rgba(255,255,255,0.04)' }} />
      <div className="bibm-noscroll" style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 14,
        padding: '0 16px', overflowX: 'auto', scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}>
        {books.map(b => (
          <div key={b.id} className="bibm-bk" style={{ scrollSnapAlign: 'start' }}
            onClick={onOpen ? (e) => onOpen(b, e.currentTarget.getBoundingClientRect()) : undefined}>
            <BookCover book={b} h={H} />
          </div>
        ))}
      </div>
      <Plank />
    </div>
  )
}
