import React from 'react'
import { inmTint, hashOf, spineColor, spineW, spineH } from './helpers.jsx'

// =============================================================
// ACUARELA · estantería ilustrada plana (reemplaza los cajones).
// Una tabla de madera dibujada por fila, lomos parados con
// contorno de tinta, adornos (plantas) en los huecos y un muro
// de fondo que crea el nicho. 3 categorías por fila.
//   <FlatShelves groups activeCat onOpen />   groups: [{cat, books}]
// Exporta: FlatShelves, ShSpine, CartoonPlank
// Las reglas .inm-bk / .inm-bk-ttl se inyectaban aquí en un <style>;
// viven en styles/biblioteca.css desde que hay CSP (ver vercel.json).
// =============================================================

const ACUA = {
  ink: '#4a3622',
  wall: { backgroundColor: '#f1e8d4' },
  wood: { body: 'linear-gradient(180deg,#d8a86a,#c98f4f)', under: '#9c6a36', grain: 'rgba(120,80,40,0.22)' },
};
const INNER_GAP = 0;
const BOOK_AREA = 160;
const SHELF_W = 1216;
const DECOR_N = 4;

function Band({ c, w = '62%', t = 1.8 }) {
  return <div style={{ width: w, height: t, background: c, borderRadius: 2 }} />;
}

// ── Lomo (contorno de tinta + relleno = color asignado del libro) ───────
function ShSpine({ book, color, onOpen }) {
  const wsp = spineW(book), h = spineH(book);
  const hh = hashOf(book.id);
  const ink = ACUA.ink;
  const click = onOpen ? (e) => onOpen(book, e.currentTarget.getBoundingClientRect()) : undefined;
  const bg = color;
  const accentCol = inmTint(color, -0.34);
  const round = `${8 + (hh % 4)}px ${7 + (hh % 5)}px 1px 1px`;
  return (
    <div className="inm-bk" title={`${book.title} — ${book.author}`} onClick={click}
      style={{ position: 'relative', flexShrink: 0, width: wsp, height: h, background: bg,
        border: `2px solid ${ink}`, borderRadius: round, boxShadow: `1.6px 2px 0 ${ink}22`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 9, paddingBottom: 9,
        justifyContent: 'space-between', overflow: 'hidden' }}>
      <Band c={accentCol} />
      <span className="inm-bk-ttl" style={{ position: 'relative', fontSize: 12.5, fontWeight: 800,
        maxWidth: wsp - 4, color: '#fff', letterSpacing: '0.01em' }}>{book.title}</span>
      <Band c={accentCol} />
    </div>
  );
}

// ── Tabla de madera dibujada ────────────────────────────────
function CartoonPlank() {
  const { wood, ink } = { wood: ACUA.wood, ink: ACUA.ink };
  return (
    <div style={{ position: 'relative', width: '100%', height: 22 }}>
      <div style={{ position: 'absolute', inset: 0, background: wood.body, border: `2px solid ${ink}`, borderRadius: '4px 4px 6px 6px', boxShadow: '0 12px 18px -10px rgba(70,46,20,0.4)' }}>
        <div style={{ position: 'absolute', top: 6, left: 0, right: 0, height: 2, background: ink, opacity: 0.32 }} />
        <div style={{ position: 'absolute', top: 11, left: '6%', width: '40%', height: 1.5, background: wood.grain, borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: 15, left: '52%', width: '32%', height: 1.5, background: wood.grain, borderRadius: 2 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '34%', background: wood.under, opacity: 0.55, borderRadius: '0 0 5px 5px' }} />
      </div>
    </div>
  );
}

function cartoonTag(cat, ink) {
  return { display: 'inline-flex', alignItems: 'center', background: cat.color, color: '#fff',
    fontWeight: 700, fontSize: 12, padding: '4px 13px 5px', borderRadius: 11, whiteSpace: 'nowrap',
    border: `2px solid ${ink}`, boxShadow: `1.5px 2px 0 ${ink}33`, textShadow: '0 1px 1px rgba(0,0,0,0.25)' };
}

// Parte los libros de una categoría en tramos donde cada tramo
// no supera maxW px de ancho de lomos. Igual que chunkByCount
// en mobile pero basado en ancho real en lugar de cantidad.
function chunkByWidth(books, maxW) {
  const chunks = []
  let current = [], w = 0
  for (const book of books) {
    const bw = spineW(book)
    if (current.length > 0 && w + bw > maxW) {
      chunks.push(current); current = [book]; w = bw
    } else { current.push(book); w += bw }
  }
  if (current.length) chunks.push(current)
  return chunks.length ? chunks : [[]]
}

// ── Estantería: 3 categorías por fila, repartidas ───────────
function FlatShelves({ groups, activeCat, onOpen }) {
  const ink = ACUA.ink;
  // Pre-procesar: categorías con muchos libros se parten en varios
  // tramos; cada tramo se trata como grupo independiente en el
  // algoritmo de 3-por-fila pero mantiene el mismo cat para la etiqueta.
  const flatGroups = groups.flatMap(g => {
    const chunks = chunkByWidth(g.books, SHELF_W)
    return chunks.map((books, ci) => ({ cat: g.cat, books, _chunkKey: `${g.cat.id}-${ci}` }))
  })
  const catRows = [];
  for (let i = 0; i < flatGroups.length; i += 3) catRows.push(flatGroups.slice(i, i + 3));

  const rows = catRows.map((cats, ri) => {
    const catW = cats.map(g => g.books.reduce((s, b, i) => s + spineW(b) + (i ? INNER_GAP : 0), 0));
    const totalCatW = catW.reduce((a, b) => a + b, 0);
    const gap = Math.max(0, (SHELF_W - totalCatW) / (cats.length + 1));
    let x = gap;
    const placed = cats.map((g) => {
      const start = x;
      let bx = start;
      const books = g.books.map((b) => {
        const bk = { book: b, color: spineColor(b), x: bx, w: spineW(b) };
        bx += spineW(b);
        return bk;
      });
      const item = { cat: g.cat, count: g.books.length, x: start, end: bx, books, _chunkKey: g._chunkKey };
      x = bx + gap;
      return item;
    });
    placed.forEach((c, i) => {
      const nextX = i + 1 < placed.length ? placed[i + 1].x : SHELF_W;
      c.maxW = Math.max(72, Math.min(260, nextX - c.x - 8));
    });
    // adornos en los huecos entre grupos
    const decor = [];
    const regions = [];
    for (let i = 0; i < placed.length - 1; i++) regions.push({ a: placed[i].end, b: placed[i + 1].x });
    regions.forEach((rg, gi) => {
      const w = rg.b - rg.a;
      const seed = hashOf('d' + ri + '-' + gi);
      if (w >= 66) decor.push({ cx: rg.a + w / 2, h: 104 + (seed % 22), w, seed });
    });
    return { placed, decor };
  });

  // reparto balanceado de las 4 plantas
  const _dc = new Array(DECOR_N).fill(0);
  rows.forEach(r => r.decor.forEach(slot => {
    const min = Math.min(..._dc);
    const cand = [];
    for (let k = 0; k < DECOR_N; k++) if (_dc[k] === min) cand.push(k);
    const pick = cand[slot.seed % cand.length];
    _dc[pick]++;
    slot.idx = pick + 1;
  }));

  return (
    <div style={{ minWidth: SHELF_W, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 12, borderRadius: '10px 10px 4px 4px',
              ...ACUA.wall, border: `2px solid ${ink}`, borderBottom: 'none',
              boxShadow: 'inset 0 10px 18px -10px rgba(40,30,18,0.4), inset 0 0 0 6px rgba(255,255,255,0.04)' }} />
            <div style={{ position: 'relative', height: BOOK_AREA }}>
              {row.decor.map((d, di) => {
                const dim = !!activeCat;
                const boxW = Math.min(d.h, d.w - 8);
                return (
                  <div key={'dec' + di} style={{ position: 'absolute', left: d.cx - boxW / 2, bottom: -4, width: boxW, height: d.h, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', opacity: dim ? 0.3 : 1, transition: 'opacity .2s', pointerEvents: 'none' }}>
                    <img src={`/assets/decor/m${d.idx}.webp`} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(2px 4px 4px rgba(60,42,22,0.18))' }} />
                  </div>
                );
              })}
              {row.placed.map(c => {
                const dim = !!activeCat && c.cat.id !== activeCat;
                return (
                  <React.Fragment key={c._chunkKey}>
                    {c.books.map(bk => (
                      <div key={bk.book.id} style={{ position: 'absolute', left: bk.x, bottom: 0, opacity: dim ? 0.26 : 1, transition: 'opacity .2s', pointerEvents: dim ? 'none' : 'auto' }}>
                        <ShSpine book={bk.book} color={bk.color} onOpen={onOpen} />
                      </div>
                    ))}
                  </React.Fragment>
                );
              })}
            </div>
            <CartoonPlank />
            {row.placed.map(c => {
              const dim = !!activeCat && c.cat.id !== activeCat;
              return (
                <span key={'L' + c._chunkKey} style={{ position: 'absolute', left: c.x, top: BOOK_AREA - 1, zIndex: 6, maxWidth: c.maxW, overflow: 'hidden', opacity: dim ? 0.3 : 1, transition: 'opacity .2s', ...cartoonTag(c.cat, ink) }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{c.cat.nombre}</span>
                  <span style={{ marginLeft: 6, opacity: 0.78, fontWeight: 500, flexShrink: 0 }}>· {c.count}</span>
                </span>
              );
            })}
          </div>
        ))}
    </div>
  );
}

// Memoizado: el orquestador re-renderiza al teclear en el buscador / abrir
// filtros, pero este solo depende de groups (memo estable) y onOpen
// (useCallback), así que se salta esos re-renders.
const FlatShelvesMemo = React.memo(FlatShelves)

export { FlatShelvesMemo as FlatShelves, ShSpine, CartoonPlank };
