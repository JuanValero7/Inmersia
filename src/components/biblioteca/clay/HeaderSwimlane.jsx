import React from 'react'
import { INK, inmTint, BookCover } from './helpers.jsx'

// =============================================================
// ACUARELA · Header (logo + buscador + nav) y Swimlane (hero).
// Header cableado: search, Tienda, Perfil, Salir.
// Swimlane: "Seguir leyendo" (libro destacado) + Novedades /
// Recomendaciones (vacías hasta que existan los campos en Supabase).
// Exporta: window.InmHeader, Swimlane
// =============================================================

function InmHeader({ search, onSearch, onSearchKeyDown, displayName, inicial, onGoPerfil, onGoTienda, onSignOut }) {
  const ink = INK;
  const bar = {
    display: 'flex', alignItems: 'center', gap: 16, borderRadius: 22, padding: '13px 17px',
    backgroundColor: '#b3bdc8',
    backgroundImage: 'url(/assets/wallpapers/acuarela-pattern.webp)',
    backgroundRepeat: 'repeat',
    border: `2px solid ${ink}`,
    boxShadow: `5px 7px 0 ${ink}12, inset 0 1px 0 rgba(255,255,255,0.5)`,
  };
  const navBtn = {
    display: 'flex', alignItems: 'center', gap: 8, background: '#fffdf8', color: ink,
    border: `2px solid ${ink}`, borderRadius: 999, padding: '8px 16px', fontFamily: 'inherit',
    fontWeight: 700, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: `1.5px 2px 0 ${ink}1f`,
  };
  return (
    <div style={{ padding: '22px 32px 0' }}>
      <div style={bar}>
        <div style={{ background: '#fffdf8', border: `2px solid ${ink}`, borderRadius: 14, padding: '9px 15px', display: 'flex', alignItems: 'center', boxShadow: `1.5px 2px 0 ${ink}1f`, flexShrink: 0 }}>
          <img src="/assets/inmersia-logo.png" alt="Inmersia" style={{ height: 34, width: 'auto' }} />
        </div>
        <div style={{ flex: 1, maxWidth: 460, marginLeft: 6, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,253,247,0.9)', border: `2px solid ${ink}`, borderRadius: 999, padding: '10px 18px', boxShadow: `1.5px 2px 0 ${ink}14` }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={ink} strokeWidth="2.4"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => onSearch(e.target.value)} onKeyDown={onSearchKeyDown} placeholder="Buscar por título, autor… (Enter para buscar)"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 600, fontSize: 15, color: ink }} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
          <button id="tutorial-tienda-btn" onClick={onGoTienda} style={navBtn} title="Tienda">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4m1.6 8L5 5H3m4 8a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Tienda
          </button>
          <button onClick={onGoPerfil} style={{ ...navBtn, padding: '7px 15px 7px 8px' }} title="Mi perfil">
            <span style={{ width: 27, height: 27, borderRadius: '50%', background: 'linear-gradient(135deg, #cf7b4c, #6f9457)', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, border: `2px solid ${ink}` }}>{inicial}</span>
            <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
          </button>
          <button onClick={onSignOut} style={{ ...navBtn, padding: '8px 13px' }} title="Salir">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Swimlane (hero + tabs) ──────────────────────────────────
const SWIM_TABS = [
  { id: 'seguir', label: 'Seguir leyendo' },
  { id: 'novedades', label: 'Novedades' },
  { id: 'recom', label: 'Recomendaciones' },
];

function EmptyLane({ msg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, padding: '20px', textAlign: 'center' }}>
      <div style={{ color: 'rgba(74,54,34,0.55)', fontWeight: 600, fontSize: 15, maxWidth: 360, lineHeight: 1.5 }}>{msg}</div>
    </div>
  );
}

function HeroFeatured({ book, onOpen }) {
  const ink = INK, accent = '#cf7b4c';
  const [hov, setHov] = React.useState(false);
  const cat = book.categoryName;
  const hasProgress = typeof book.progress === 'number';
  const pct = hasProgress ? Math.round(book.progress * 100) : 0;
  return (
    <div style={{ display: 'flex', gap: 48, alignItems: 'center', padding: '16px 14px 26px' }}>
      <div onClick={(e) => onOpen(book, e.currentTarget.getBoundingClientRect())}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ cursor: 'pointer', flexShrink: 0, transform: hov ? 'rotate(0deg) translateY(-5px)' : 'rotate(-6deg)', transformOrigin: 'center bottom', transition: 'transform .35s cubic-bezier(.2,.75,.3,1)', filter: `drop-shadow(5px 12px 16px ${ink}3a)` }}>
        <BookCover book={book} h={300} ink={ink} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 42, lineHeight: 1.04, letterSpacing: '-0.015em', color: ink,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</div>
        <div style={{ color: 'rgba(74,54,34,0.64)', fontSize: 19, marginTop: 10, fontWeight: 600 }}>{book.author}{cat ? ` · ${cat}` : ''}</div>

        <div style={{ marginTop: 26, maxWidth: 520 }}>
          {hasProgress ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 21, color: ink }}>{pct}% <span style={{ fontSize: 15, color: 'rgba(74,54,34,0.6)', fontWeight: 600 }}>completado</span></span>
              </div>
              <div style={{ height: 14, borderRadius: 9, background: 'rgba(74,54,34,0.16)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 9, background: `linear-gradient(90deg, ${accent}, ${inmTint(accent, 0.2)})` }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 17, color: 'rgba(74,54,34,0.6)', fontWeight: 600, lineHeight: 1.5 }}>
              Aún no registramos tu progreso de lectura.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 28 }}>
          <button id="tutorial-empezar-leer-btn" onClick={(e) => onOpen(book, e.currentTarget.getBoundingClientRect())}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: accent, color: '#fff', border: `2px solid ${ink}`, borderRadius: 999, padding: '16px 32px', fontWeight: 700, fontSize: 18, fontFamily: 'inherit', cursor: 'pointer', textShadow: '0 1px 1px rgba(0,0,0,0.2)', boxShadow: `2px 2.8px 0 ${ink}33` }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            {hasProgress ? 'Continuar' : 'Empezar a leer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Swimlane({ featured, onOpen }) {
  const ink = INK;
  const [tab, setTab] = React.useState('seguir');
  const surface = {
    position: 'relative', overflow: 'hidden', borderRadius: 30, padding: '20px 22px 10px', marginTop: 20, minHeight: 440,
    backgroundColor: '#f1e8d4', border: `2px solid ${ink}`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 5px 8px 0 ${ink}17, 10px 16px 30px ${ink}26`,
  };
  const tabBtn = (active) => ({
    border: `2px solid ${active ? ink : 'transparent'}`, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
    padding: '8px 18px', borderRadius: 999, background: active ? '#cf7b4c' : 'transparent', color: active ? '#fff' : 'rgba(74,54,34,0.6)',
    whiteSpace: 'nowrap', textShadow: active ? '0 1px 1px rgba(0,0,0,0.2)' : 'none', boxShadow: active ? `1.4px 1.8px 0 ${ink}33` : 'none', transition: 'all .15s',
  });
  return (
    <div id="tutorial-swimlane" style={surface}>
      {tab === 'seguir' && (
        <>
          <img src="/assets/wallpapers/hero-cat.webp" alt="" style={{ position: 'absolute', right: 0, bottom: 0, height: '100%', width: 'auto', maxWidth: '72%', objectFit: 'contain', objectPosition: 'right bottom', pointerEvents: 'none', zIndex: 0, opacity: 1 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #f1e8d4 28%, rgba(241,232,212,0.55) 46%, rgba(241,232,212,0) 66%)', zIndex: 0, pointerEvents: 'none' }} />
        </>
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'inline-flex', gap: 4, padding: 5, borderRadius: 999, background: 'rgba(255,253,247,0.7)', boxShadow: `inset 0 0 0 2px ${ink}38`, marginBottom: 6 }}>
          {SWIM_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={tabBtn(tab === t.id)}>{t.label}</button>
          ))}
        </div>
        {tab === 'seguir'
          ? (featured ? <HeroFeatured book={featured} onOpen={onOpen} /> : <EmptyLane msg="Cuando empieces a leer un libro aparecerá acá para que retomes donde lo dejaste." />)
          : tab === 'novedades'
            ? <EmptyLane msg="Pronto verás acá los libros recién llegados a la biblioteca." />
            : <EmptyLane msg="Estamos preparando recomendaciones a tu medida. ¡Vuelve pronto!" />}
      </div>
    </div>
  );
}

export { InmHeader, Swimlane };
