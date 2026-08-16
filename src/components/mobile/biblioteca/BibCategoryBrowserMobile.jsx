// =============================================================
// INMERSIA · Biblioteca mobile — "Tu colección" estilo Kindle.
// Dos niveles:
//  1) Mosaicos de categoría: 6 por pantalla (2×3). Cada mosaico es de fondo
//     crema (como las estanterías), con un marco de lomos de libros arriba y
//     abajo teñidos con el color de la categoría, y en el centro el nombre +
//     el conteo. Si hay más de 6, se desliza a la página siguiente; los
//     puntitos de abajo indican en cuál estás (solo si hay más de una página).
//  2) Al tocar un mosaico, esa vista se reemplaza por las portadas de la
//     categoría apoyadas en estantes de madera (4 por repisa), con un
//     botón "‹ Categorías" para volver.
// =============================================================
import React from 'react'
import { INK, inmTint, BookCover, WALL } from './bibmHelpers.jsx'
import { imgUrl } from '../../../lib/img.js'
import { SIN_CATEGORIA_ID } from '../../biblioteca/constants.js'

const PER_PAGE = 6
const PER_SHELF = 4    // portadas por repisa en el drill-in
const ROW_H = 134      // alto de la zona de portadas de cada repisa

// Lomos del marco inferior (grow = ancho relativo, h = alto en px, t = tinte
// del color de categoría). Varían para dar el look dibujado a mano.
const BOTTOM_SPINES = [
  { g: 1.0, h: 36, t: 0.08 }, { g: 0.8, h: 28, t: -0.08 }, { g: 1.2, h: 48, t: 0.14 }, { g: 0.7, h: 24, t: -0.04 },
  { g: 1.1, h: 42, t: 0.04 }, { g: 0.9, h: 50, t: -0.12 }, { g: 1.0, h: 34, t: 0.10 }, { g: 0.75, h: 30, t: 0.16 },
]

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out.length ? out : [[]]
}

function SpineFrame({ color, spines, place }) {
  return (
    <div className={`bibm-cat-spines ${place}`}>
      {spines.map((s, i) => (
        <span key={i} style={{ flexGrow: s.g, flexBasis: 0, height: s.h, background: inmTint(color, s.t) }} />
      ))}
    </div>
  )
}

// ── Nivel 1: mosaico de categoría ───────────────────────────
function CategoryTile({ group, onOpen }) {
  const { cat, books } = group
  const color = cat.color || '#8c6838'
  // Fondo: hero acuarela de algún libro de la categoría, difuminado + velo
  // crema (mismo tratamiento que las tarjetas de "Últimos abiertos").
  const conHero = books.find(b => b.heroUrlMobile || b.heroUrl)
  const bg = conHero?.heroUrlMobile || conHero?.heroUrl || null
  return (
    <button className="bibm-cat-tile" onClick={() => onOpen(cat.id)}>
      {bg && (
        <>
          <img className="bibm-cat-bg" src={imgUrl(bg, { width: 640 })} alt="" />
          <div className="bibm-cat-veil" />
        </>
      )}
      <div className="bibm-cat-meta">
        <div className="bibm-cat-name">{cat.nombre}</div>
        <div className="bibm-cat-count">{books.length} {books.length === 1 ? 'libro' : 'libros'}</div>
      </div>
      <SpineFrame color={color} spines={BOTTOM_SPINES} place="bottom" />
    </button>
  )
}

function CategoryPager({ groups, onOpen }) {
  const pages = React.useMemo(() => chunk(groups, PER_PAGE), [groups])
  const [page, setPage] = React.useState(0)
  const ref = React.useRef(null)

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    setPage(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <div>
      <div className="bibm-cat-pager bibm-noscroll" ref={ref} onScroll={onScroll}>
        {pages.map((pg, i) => (
          <div className="bibm-cat-page" key={i}>
            {pg.map(g => <CategoryTile key={g.cat.id} group={g} onOpen={onOpen} />)}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="bibm-dots">
          {pages.map((_, i) => <span key={i} className={'bibm-dot' + (i === page ? ' on' : '')} />)}
        </div>
      )}
    </div>
  )
}

// ── Nivel 2: portadas sobre estantes de madera ──────────────
function Plank() {
  return (
    <div style={{ position: 'relative', width: '100%', height: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#d8a86a,#c98f4f)', border: `2px solid ${INK}`, borderRadius: '4px 4px 6px 6px', boxShadow: '0 11px 16px -10px rgba(70,46,20,0.42)' }}>
        <div style={{ position: 'absolute', top: 5, left: 0, right: 0, height: 2, background: INK, opacity: 0.3 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '32%', background: '#9c6a36', opacity: 0.5, borderRadius: '0 0 5px 5px' }} />
      </div>
    </div>
  )
}

function ShelfRow({ books, onOpen, last }) {
  return (
    <div style={{ position: 'relative', marginBottom: last ? 0 : 14 }}>
      {/* Nicho de pared detrás de las portadas */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 9, height: ROW_H + 12, borderRadius: '10px 10px 4px 4px', backgroundColor: WALL, border: `2px solid ${INK}`, borderBottom: 'none', boxShadow: 'inset 0 10px 18px -10px rgba(40,30,18,0.4)' }} />
      <div style={{ position: 'relative', height: ROW_H, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', alignItems: 'end', gap: 10, padding: '0 12px' }}>
        {books.map(b => (
          <div key={b.id} className="bibm-bk" style={{ cursor: 'pointer' }}
            onClick={(e) => onOpen(b, e.currentTarget.getBoundingClientRect())}>
            <BookCover book={b} fill fillW={78} />
          </div>
        ))}
      </div>
      <Plank />
    </div>
  )
}

function ShelfCovers({ books, onOpen }) {
  const rows = chunk(books, PER_SHELF)
  return (
    <div>
      {rows.map((r, i) => (
        <ShelfRow key={i} books={r} onOpen={onOpen} last={i === rows.length - 1} />
      ))}
    </div>
  )
}

export function MobileCategoryBrowser({ groups, onOpen }) {
  const [openedId, setOpenedId] = React.useState(null)
  // "Sin categoría" no es una categoría: sus libros van como colección base
  // (repisa sin título) y las categorías reales como mosaico debajo.
  const sinCat = groups.find(g => g.cat.id === SIN_CATEGORIA_ID)
  const realGroups = groups.filter(g => g.cat.id !== SIN_CATEGORIA_ID)
  const opened = realGroups.find(g => g.cat.id === openedId)

  if (!groups.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(74,54,34,0.5)', fontWeight: 600, fontSize: 14 }}>No hay libros que mostrar.</div>
  }

  if (opened) {
    const { cat, books } = opened
    return (
      <div>
        <button className="bibm-cat-back" onClick={() => setOpenedId(null)}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Categorías
        </button>
        <div className="bibm-cat-open-head">
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: cat.color, border: `2px solid ${INK}`, flexShrink: 0 }} />
          <span style={{ fontWeight: 800, fontSize: 17, color: '#3a2b1c' }}>{cat.nombre}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(74,54,34,0.5)' }}>· {books.length}</span>
        </div>
        <ShelfCovers books={books} onOpen={onOpen} />
      </div>
    )
  }

  // Nivel superior: colección base (sin categoría, sin título) + mosaico de
  // categorías reales debajo.
  const tieneBase = sinCat && sinCat.books.length > 0
  const tieneCats = realGroups.length > 0
  return (
    <div>
      {tieneBase && (
        <div style={{ marginBottom: tieneCats ? 28 : 0 }}>
          <ShelfCovers books={sinCat.books} onOpen={onOpen} />
        </div>
      )}
      {tieneCats && (
        <>
          {tieneBase && <div style={{ fontWeight: 800, fontSize: 15, color: '#3a2b1c', margin: '0 0 12px' }}>Mis categorías</div>}
          <CategoryPager groups={realGroups} onOpen={setOpenedId} />
        </>
      )}
    </div>
  )
}
