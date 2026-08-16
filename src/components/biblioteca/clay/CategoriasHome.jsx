import React from 'react'
import { INK, inmTint, hashOf, BookCover } from './helpers.jsx'
import { CartoonPlank } from './Shelves.jsx'
import { SIN_CATEGORIA_ID } from '../constants.js'

// =============================================================
// ACUARELA · "Tu colección" desktop en formato mosaico (mismo
// patrón que mobile, ver BibCategoryBrowserMobile):
//   Nivel 1 — fila de mosaicos de categoría con paginación
//     ‹ 1 2 … › (sin envolver a otra fila). Cada mosaico lleva de
//     fondo el hero (acuarela IA) de algún libro de la categoría,
//     nombre + conteo al centro y un marco de "lomos" abajo (rects
//     tintados con el color de la categoría).
//   Nivel 2 — al abrir un mosaico, sus portadas (face-out) apoyadas
//     en estantes de madera, con plantas de decoración intercaladas
//     entre los libros, y un botón para volver.
//   <CategoriasHome groups activeCat onOpen />   groups: [{cat, books}]
// =============================================================

const WALL = '#f1e8d4'
const TILE_H = 388     // x2 del alto anterior (194)
const MIN_TILE_W = 348 // ~x1.5 del ancho anterior (238)
const GRID_GAP = 20
const PER_ROW = 6      // slots por repisa en el drill-in
const COVER_H = 150

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out.length ? out : [[]]
}

// ── Nivel 1: mosaico ────────────────────────────────────────
// Marco inferior de lomos, determinista por categoría.
function buildFrame(cat) {
  const seed = hashOf(cat.id || 'x')
  const n = 13
  const items = []
  for (let i = 0; i < n; i++) {
    items.push({
      g: 0.7 + (((seed >> i) & 3) * 0.16),
      h: 30 + ((seed * (i + 3)) % 46),
      t: (((i % 3) - 1) * 0.09),
    })
  }
  return items
}

function SpineFrame({ cat }) {
  const color = cat.color || '#8c6838'
  const items = React.useMemo(() => buildFrame(cat), [cat.id, cat.color]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1, display: 'flex', gap: 2, alignItems: 'flex-end', pointerEvents: 'none' }}>
      {items.map((it, i) => (
        <span key={i} style={{
          flexGrow: it.g, flexBasis: 0, height: it.h, background: inmTint(color, it.t),
          border: `1.6px solid ${INK}`, borderBottom: 'none', borderRadius: '3px 3px 0 0',
          boxShadow: 'inset -2px 0 0 rgba(0,0,0,0.09), inset 2px 0 0 rgba(255,255,255,0.12)',
        }} />
      ))}
    </div>
  )
}

function CategoryTile({ group, onOpen }) {
  const { cat, books } = group
  const [hov, setHov] = React.useState(false)
  const conHero = books.find(b => b.heroUrl)
  const bg = conHero?.heroUrl || null
  return (
    <button onClick={() => onOpen(cat.id)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      position: 'relative', overflow: 'hidden', height: TILE_H,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      background: WALL, border: `2px solid ${INK}`, borderRadius: 20, padding: 20, cursor: 'pointer', fontFamily: 'inherit',
      boxShadow: hov ? `1.4px 2px 0 ${INK}33` : `3px 4.5px 0 ${INK}26`, transform: hov ? 'translateY(1.6px)' : 'none',
      transition: 'box-shadow .12s, transform .12s',
    }}>
      {bg && (
        <>
          <img src={bg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(241,232,212,0.66) 0%, rgba(241,232,212,0.8) 100%)' }} />
        </>
      )}
      <div style={{ position: 'relative', zIndex: 2, maxWidth: '100%' }}>
        <div style={{ fontWeight: 800, fontSize: 24, color: '#3a2b1c', lineHeight: 1.14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{cat.nombre}</div>
        <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: 'rgba(74,54,34,0.6)' }}>{books.length} {books.length === 1 ? 'libro' : 'libros'}</div>
      </div>
      <SpineFrame cat={cat} />
    </button>
  )
}

// Números de página con elipsis: [0, …, cur-1, cur, cur+1, …, last]
function pageList(total, cur) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const keep = new Set([0, total - 1, cur, cur - 1, cur + 1])
  const arr = [...keep].filter(i => i >= 0 && i < total).sort((a, b) => a - b)
  const out = []
  let prev = -1
  for (const i of arr) {
    if (i - prev > 1) out.push('…')
    out.push(i)
    prev = i
  }
  return out
}

function CategoryPager({ groups, onOpen }) {
  const wrapRef = React.useRef(null)
  const [perPage, setPerPage] = React.useState(3)
  const [page, setPage] = React.useState(0)

  React.useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const calc = () => setPerPage(Math.max(1, Math.floor((el.clientWidth + GRID_GAP) / (MIN_TILE_W + GRID_GAP))))
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pages = React.useMemo(() => chunk(groups, perPage), [groups, perPage])
  React.useEffect(() => { if (page > pages.length - 1) setPage(0) }, [pages.length, page])
  const cur = Math.min(page, pages.length - 1)

  const navBtn = (disabled) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 12,
    background: '#fffdf8', color: INK, border: `2px solid ${INK}`, cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1, boxShadow: `1.5px 2px 0 ${INK}26`, fontFamily: 'inherit',
  })
  const numBtn = (active) => ({
    minWidth: 38, height: 38, padding: '0 12px', borderRadius: 12, fontFamily: 'inherit', fontWeight: 800, fontSize: 15,
    background: active ? '#F2792A' : '#fffdf8', color: active ? '#fff' : INK, border: `2px solid ${INK}`, cursor: 'pointer',
    boxShadow: active ? `1px 1.4px 0 ${INK}33` : `1.5px 2px 0 ${INK}26`, textShadow: active ? '0 1px 1px rgba(0,0,0,0.2)' : 'none',
  })

  return (
    <div ref={wrapRef}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${perPage}, 1fr)`, gap: GRID_GAP }}>
        {pages[cur].map(g => <CategoryTile key={g.cat.id} group={g} onOpen={onOpen} />)}
      </div>
      {pages.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 }}>
          <button style={navBtn(cur === 0)} disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Anterior">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {pageList(pages.length, cur).map((p, i) => p === '…'
            ? <span key={`e${i}`} style={{ padding: '0 4px', color: 'rgba(74,54,34,0.5)', fontWeight: 800 }}>…</span>
            : <button key={p} style={numBtn(p === cur)} onClick={() => setPage(p)}>{p + 1}</button>)}
          <button style={navBtn(cur === pages.length - 1)} disabled={cur === pages.length - 1} onClick={() => setPage(cur + 1)} aria-label="Siguiente">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Nivel 2: portadas face-out + plantas intercaladas ───────
// Arma las repisas: solo ALGUNAS llevan una planta, y cuando la llevan va
// en una posición INTERIOR (entre dos libros de esa misma repisa), nunca al
// inicio ni una por cada repisa nueva. Cada repisa mantiene ≤ PER_ROW slots.
function buildRows(books, catId) {
  const seed = hashOf(catId || 'x')
  const rows = []
  let i = 0, r = 0
  while (i < books.length) {
    const hasPlant = ((seed + r * 3) % 5) < 2 // ~2 de cada 5 repisas
    const cap = hasPlant ? PER_ROW - 1 : PER_ROW
    const covers = books.slice(i, i + cap).map(b => ({ type: 'cover', book: b }))
    i += covers.length
    if (hasPlant && covers.length >= 2) {
      const pos = 1 + ((seed + r) % (covers.length - 1)) // interior: 1..len-1
      covers.splice(pos, 0, { type: 'plant', idx: 1 + ((seed + r) % 4), key: `p${r}` })
    }
    rows.push(covers)
    r++
  }
  return rows.length ? rows : [[]]
}

function CoverShelfRow({ items, onOpen, last }) {
  return (
    <div style={{ position: 'relative', marginBottom: last ? 0 : 26 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 12, borderRadius: '10px 10px 4px 4px', backgroundColor: WALL, border: `2px solid ${INK}`, borderBottom: 'none', boxShadow: 'inset 0 10px 18px -10px rgba(40,30,18,0.4)' }} />
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${PER_ROW}, 1fr)`, alignItems: 'end', gap: 16, padding: '0 18px', minHeight: COVER_H + 18 }}>
        {items.map(it => it.type === 'plant'
          ? (
            <div key={it.key} style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', pointerEvents: 'none' }}>
              <img src={`/assets/decor/m${it.idx}.webp`} alt="" loading="lazy" style={{ maxHeight: 128, maxWidth: '90%', width: 'auto', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(2px 4px 4px rgba(60,42,22,0.18))' }} />
            </div>
          )
          : (
            <div key={it.book.id} className="inm-bk" onClick={(e) => onOpen(it.book, e.currentTarget.getBoundingClientRect())} style={{ display: 'flex', justifyContent: 'center' }}>
              <BookCover book={it.book} h={COVER_H} />
            </div>
          ))}
      </div>
      <CartoonPlank />
    </div>
  )
}

function CategoriasHome({ groups, activeCat, onOpen }) {
  const [openedId, setOpenedId] = React.useState(null)
  // "Sin categoría" NO es una categoría: sus libros van como colección base
  // (repisa de portadas sin título ni mosaico). El resto son categorías reales.
  const sinCat = groups.find(g => g.cat.id === SIN_CATEGORIA_ID)
  const realGroups = groups.filter(g => g.cat.id !== SIN_CATEGORIA_ID)

  // Si el filtro superior fija una categoría (real), la abrimos directo.
  const targetId = activeCat || openedId
  const opened = targetId ? realGroups.find(g => g.cat.id === targetId) : null

  if (!groups.length) {
    return <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(74,54,34,0.5)', fontWeight: 600, fontSize: 16 }}>No hay libros que mostrar.</div>
  }

  if (opened) {
    const { cat, books } = opened
    const rows = buildRows(books, cat.id)
    return (
      <div>
        {!activeCat && (
          <button onClick={() => setOpenedId(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fffdf8', color: '#5a4632', border: `2px solid ${INK}`, borderRadius: 12, padding: '8px 15px', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: `1.5px 2px 0 ${INK}2e`, marginBottom: 18 }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Categorías
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
          <span style={{ width: 13, height: 13, borderRadius: '50%', background: cat.color, border: `2px solid ${INK}`, flexShrink: 0 }} />
          <span style={{ fontWeight: 800, fontSize: 22, color: '#3a2b1c' }}>{cat.nombre}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(74,54,34,0.5)' }}>· {books.length}</span>
        </div>
        {rows.map((r, i) => <CoverShelfRow key={i} items={r} onOpen={onOpen} last={i === rows.length - 1} />)}
      </div>
    )
  }

  // Nivel superior: colección base (libros sin categoría, en repisa y SIN
  // título) + mosaico de categorías reales debajo.
  const baseRows = sinCat && sinCat.books.length ? buildRows(sinCat.books, SIN_CATEGORIA_ID) : []
  const tieneBase = baseRows.length > 0
  const tieneCats = realGroups.length > 0
  return (
    <div>
      {tieneBase && (
        <div style={{ marginBottom: tieneCats ? 40 : 0 }}>
          {baseRows.map((r, i) => <CoverShelfRow key={i} items={r} onOpen={onOpen} last={i === baseRows.length - 1} />)}
        </div>
      )}
      {tieneCats && (
        <>
          {tieneBase && <div style={{ fontWeight: 800, fontSize: 18, color: '#3a2b1c', margin: '0 0 16px' }}>Mis categorías</div>}
          <CategoryPager groups={realGroups} onOpen={setOpenedId} />
        </>
      )}
    </div>
  )
}

const CategoriasHomeMemo = React.memo(CategoriasHome)
export { CategoriasHomeMemo as CategoriasHome }
