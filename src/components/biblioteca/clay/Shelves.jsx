import React from 'react'
import { inmTint, hashOf, spineColor, spineW, spineH, BookCover } from './helpers.jsx'

// =============================================================
// ACUARELA · estantería ilustrada plana (reemplaza los cajones).
// Una tabla de madera dibujada por fila, lomos parados con
// contorno de tinta, adornos (plantas) en los huecos y un muro
// de fondo que crea el nicho. 3 categorías por fila.
//   <FlatShelves groups activeCat onOpen />   groups: [{cat, books}]
//   <CoverShelf books />                       portadas face-out
// Exporta: window.FlatShelves, ShSpine, CartoonPlank, CoverShelf
// =============================================================

if (typeof document !== 'undefined' && !document.getElementById('inm-shelf-css')) {
  const s = document.createElement('style');
  s.id = 'inm-shelf-css';
  s.textContent =
    '.inm-bk{transition:transform .2s cubic-bezier(.34,1.45,.5,1),filter .18s;will-change:transform;cursor:pointer;}' +
    '.inm-bk:hover{transform:translateY(-14px) scale(1.035);z-index:40;filter:brightness(1.04) saturate(1.05);}' +
    '.inm-bk-ttl{writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);white-space:nowrap;' +
    'overflow:hidden;text-overflow:ellipsis;padding:6px 0;max-height:100%;}';
  document.head.appendChild(s);
}

const ACUA = {
  ink: '#4a3622',
  wall: { backgroundColor: '#b0bdca',
    backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(40,30,18,0.07)), repeating-linear-gradient(92deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 7px), radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.14), transparent 60%)' },
  wood: { body: 'linear-gradient(180deg,#d8a86a,#c98f4f)', under: '#9c6a36', grain: 'rgba(120,80,40,0.22)' },
};
const INNER_GAP = 0;
const BOOK_AREA = 160;
const SHELF_W = 1216;
const DECOR_N = 4;

function Band({ c, w = '62%', t = 1.8 }) {
  return <div style={{ width: w, height: t, background: c, borderRadius: 2 }} />;
}

// ── Lomo (contorno de tinta + relleno acuarela claro) ───────
function ShSpine({ book, color, onOpen }) {
  const wsp = spineW(book), h = spineH(book);
  const hh = hashOf(book.id);
  const ink = ACUA.ink;
  const click = onOpen ? (e) => onOpen(book, e.currentTarget.getBoundingClientRect()) : undefined;
  const bg = inmTint(color, 0.44);
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
        maxWidth: wsp - 4, color: '#37260f', letterSpacing: '0.01em' }}>{book.title}</span>
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

// ── Estantería: 3 categorías por fila, repartidas ───────────
function FlatShelves({ groups, activeCat, onOpen }) {
  const ink = ACUA.ink;
  const catRows = [];
  for (let i = 0; i < groups.length; i += 3) catRows.push(groups.slice(i, i + 3));

  const rows = catRows.map((cats, ri) => {
    const catW = cats.map(g => g.books.reduce((s, b, i) => s + spineW(b) + (i ? INNER_GAP : 0), 0));
    const totalCatW = catW.reduce((a, b) => a + b, 0);
    const gap = (SHELF_W - totalCatW) / (cats.length + 1);
    let x = gap;
    const placed = cats.map((g) => {
      const start = x;
      let bx = start;
      const books = g.books.map((b) => {
        const bk = { book: b, color: spineColor(b), x: bx, w: spineW(b) };
        bx += spineW(b);
        return bk;
      });
      const item = { cat: g.cat, count: g.books.length, x: start, end: bx, books };
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: -10, right: -10, bottom: 12, height: BOOK_AREA + 14, borderRadius: '10px 10px 4px 4px',
            ...ACUA.wall, border: `2px solid ${ink}`, borderBottom: 'none',
            boxShadow: 'inset 0 10px 18px -10px rgba(40,30,18,0.4), inset 0 0 0 6px rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'relative', height: BOOK_AREA }}>
            {row.decor.map((d, di) => {
              const dim = !!activeCat;
              const boxW = Math.min(d.h, d.w - 8);
              return (
                <div key={'dec' + di} style={{ position: 'absolute', left: d.cx - boxW / 2, bottom: -4, width: boxW, height: d.h, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', opacity: dim ? 0.3 : 1, transition: 'opacity .2s', pointerEvents: 'none' }}>
                  <img src={`/assets/decor/m${d.idx}.webp`} alt="" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(2px 4px 4px rgba(60,42,22,0.18))' }} />
                </div>
              );
            })}
            {row.placed.map(c => {
              const dim = !!activeCat && c.cat.id !== activeCat;
              return (
                <React.Fragment key={c.cat.id}>
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
              <span key={'L' + c.cat.id} style={{ position: 'absolute', left: c.x, top: BOOK_AREA - 1, zIndex: 6, maxWidth: c.maxW, overflow: 'hidden', opacity: dim ? 0.3 : 1, transition: 'opacity .2s', ...cartoonTag(c.cat, ink) }}>
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

// ── Repisa de portadas face-out ─────────────────────────────
function CoverShelf({ books, onOpen }) {
  const ink = ACUA.ink, H = 174;
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: -10, right: -10, bottom: 12, height: H + 22, borderRadius: '10px 10px 4px 4px',
        ...ACUA.wall, border: `2px solid ${ink}`, borderBottom: 'none',
        boxShadow: 'inset 0 10px 18px -10px rgba(40,30,18,0.4), inset 0 0 0 6px rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 22px' }}>
        {books.map((b) => (
          <div key={b.id} className="inm-bk" onClick={onOpen ? (e) => onOpen(b, e.currentTarget.getBoundingClientRect()) : undefined}>
            <BookCover book={b} h={H} ink={ink} />
          </div>
        ))}
      </div>
      <CartoonPlank />
    </div>
  );
}

// Memoizados: el orquestador re-renderiza al teclear en el buscador / abrir
// filtros, pero estos solo dependen de groups/books (memos estables) y onOpen
// (useCallback), así que se saltan esos re-renders.
const FlatShelvesMemo = React.memo(FlatShelves)
const CoverShelfMemo = React.memo(CoverShelf)

export { FlatShelvesMemo as FlatShelves, ShSpine, CartoonPlank, CoverShelfMemo as CoverShelf };
