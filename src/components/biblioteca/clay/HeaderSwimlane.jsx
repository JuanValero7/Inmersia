import React from 'react'
import { INK, inmTint, BookCover, CornerMounts } from './helpers.jsx'
import { NovedadesSpotlight } from './NovedadesSpotlight.jsx'
import { HojasOtono } from './HojasOtono.jsx'
import { imgUrl } from '../../../lib/img.js'
// =============================================================
// ACUARELA · Header (logo + buscador + nav) y Swimlane (hero).
// Header cableado: search, Tienda, Perfil, Salir.
// Swimlane: "Seguir leyendo" (libro destacado) + Novedades /
// Recomendaciones (vacías hasta que existan los campos en Supabase).
// Exporta: window.InmHeader, Swimlane
// =============================================================

function InmHeader({ search, onSearch, onSearchKeyDown, displayName, inicial, onGoPerfil, onSignOut }) {
  const ink = INK;
  const bar = {
    display: 'flex', alignItems: 'center', gap: 16, borderRadius: 22, padding: '13px 17px',
    backgroundColor: '#F2792A',
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
        <img src="/assets/inmersia-logo2.png" alt="Inmersia" style={{ height: 40, width: 'auto', flexShrink: 0, marginLeft: 4 }} />
        <div style={{ flex: 1, maxWidth: 620, marginLeft: 6, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,253,247,0.9)', border: `2px solid ${ink}`, borderRadius: 999, padding: '10px 18px', boxShadow: `1.5px 2px 0 ${ink}14` }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={ink} strokeWidth="2.4"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => onSearch(e.target.value)} onKeyDown={onSearchKeyDown} placeholder="Buscar por título, autor… (Enter para buscar)"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 600, fontSize: 15, color: ink }} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
          <button onClick={onGoPerfil} style={{ ...navBtn, padding: '7px 15px 7px 8px' }} title="Mi perfil">
            <span style={{ width: 27, height: 27, borderRadius: '50%', background: 'linear-gradient(135deg, #F2792A, #6f9457)', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, border: `2px solid ${ink}` }}>{inicial}</span>
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

function RecomendacionSpotlight({ recomendaciones, idx, setIdx, onOpen, onPreview }) {
  const ink = INK
  if (!recomendaciones.length) return null

  const libro = recomendaciones[idx]
  const bookShape = (l) => ({ id: l.id, title: l.titulo, author: l.autor, cover: l.portada_url, color: l.color, pages: l.paginas })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 40, padding: '16px 14px 26px' }}>
      <div onClick={(e) => onOpen(libro, e.currentTarget.getBoundingClientRect())}
        style={{ cursor: 'pointer', flexShrink: 0, transform: 'rotate(-5deg)', filter: `drop-shadow(4px 10px 12px ${ink}48)` }}>
        <BookCover book={bookShape(libro)} h={300} />
      </div>

      <div style={{ flex: 1, minWidth: 0, height: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ alignSelf: 'flex-start', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#cf9b3f', color: '#fff',
          border: `2px solid ${ink}`, borderRadius: 999, padding: '4px 13px', fontWeight: 700, fontSize: 12.5,
          textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}>★ Para ti</span>
        <div style={{ flexShrink: 0, fontWeight: 800, fontSize: 22, lineHeight: 1.15, color: ink,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{libro.titulo}</div>
        <div style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'rgba(74,54,34,0.6)' }}>{libro.autor}</div>

        {libro.descripcion && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#fdf6e3', border: `2px solid ${ink}`, borderRadius: '4px 16px 16px 4px',
            padding: '12px 15px', fontSize: 14, lineHeight: 1.5, color: ink, fontFamily: "'Poppins', system-ui, sans-serif" }}>
            {libro.descripcion}
          </div>
        )}

        <div style={{ flexShrink: 0, display: 'flex', gap: 11 }}>
          <button onClick={(e) => onOpen(libro, e.currentTarget.getBoundingClientRect())}
            style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#F2792A', color: '#fff', border: `2px solid ${ink}`,
              borderRadius: 999, padding: '13px 26px', fontWeight: 700, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer',
              textShadow: '0 1px 1px rgba(0,0,0,0.2)', boxShadow: `2px 2.8px 0 ${ink}33` }}>
            Ver detalle
          </button>
          <button onClick={() => onPreview(libro)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fffdf8', color: ink, border: `2px solid ${ink}`,
              borderRadius: 999, padding: '13px 20px', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
              boxShadow: `1.6px 2px 0 ${ink}33` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" /></svg>
            Preview
          </button>
        </div>
      </div>

      {recomendaciones.length > 1 && (
        <div style={{ flexShrink: 0, width: 300, height: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'rgba(74,54,34,0.55)' }}>
            Otras recomendaciones
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, justifyItems: 'center', alignContent: 'start' }}>
            {recomendaciones.map((l, i) => i === idx ? null : (
              <div key={l.id} onClick={() => setIdx(i)} style={{ cursor: 'pointer' }}>
                <BookCover book={bookShape(l)} h={110} />
              </div>
            ))}
          </div>
          <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'rgba(74,54,34,0.5)', lineHeight: 1.4 }}>
            Click en una portada → pasa al spot principal con su propia reseña.
          </div>
        </div>
      )}
    </div>
  )
}



function HeroFeatured({ book, onOpen }) {
  const ink = INK, accent = '#F2792A';
  const [hov, setHov] = React.useState(false);
  const cat = book.categoryName;
  const hasProgress = typeof book.progress === 'number';
  const pct = hasProgress ? Math.round(book.progress * 100) : 0;
  return (
    <div style={{ display: 'flex', gap: 48, alignItems: 'center', padding: '16px 14px 26px' }}>
      <div onClick={(e) => onOpen(book, e.currentTarget.getBoundingClientRect())}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ cursor: 'pointer', flexShrink: 0, marginLeft: 24, transform: hov ? 'rotate(0deg) translateY(-5px)' : 'rotate(-6deg)', transformOrigin: 'center bottom', transition: 'transform .35s cubic-bezier(.2,.75,.3,1)', filter: `drop-shadow(5px 12px 16px ${ink}3a)` }}>
        <BookCover book={book} h={300} />
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
          <button onClick={(e) => onOpen(book, e.currentTarget.getBoundingClientRect())}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: accent, color: '#fff', border: `2px solid ${ink}`, borderRadius: 999, padding: '16px 32px', fontWeight: 700, fontSize: 18, fontFamily: 'inherit', cursor: 'pointer', textShadow: '0 1px 1px rgba(0,0,0,0.2)', boxShadow: `2px 2.8px 0 ${ink}33` }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            {hasProgress ? 'Continuar' : 'Empezar a leer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Swimlane({ featured, onOpen, novedades = [], recomendaciones = [], onOpenLibro, onPreviewLibro, gatoColor = 'negro' }) {
  const ink = INK;
  const [tab, setTab] = React.useState('seguir');
  // Índice del libro en foco dentro de cada spotlight (Novedades /
  // Recomendaciones). Vive acá para que el fondo hero pueda cambiar al
  // libro seleccionado cuando el usuario clickea otra portada de la lista.
  const [novIdx, setNovIdx] = React.useState(0);
  const [recIdx, setRecIdx] = React.useState(0);
  React.useEffect(() => { if (novIdx >= novedades.length) setNovIdx(0) }, [novedades.length, novIdx]);
  React.useEffect(() => { if (recIdx >= recomendaciones.length) setRecIdx(0) }, [recomendaciones.length, recIdx]);

  // Fondo hero del libro que está en foco en la pestaña activa.
  const heroUrl =
    tab === 'seguir' ? (featured?.heroUrl || null)
    : tab === 'novedades' ? (novedades[novIdx]?.metadata?.hero_url || null)
    : (recomendaciones[recIdx]?.metadata?.hero_url || null);

  const CARD_H = 500;
  const CARD_R = 26;   // radio de la tarjeta (las esquineras lo siguen)
  const GATO_H = 230;  // gato contenido dentro del hero (más pequeño, sin sangrado)
  // Sin borde-marco: la imagen de fondo va a sangre y solo las 4 ESQUINERAS
  // (abajo) marcan sus límites. Sombra suave (no plana) para dar profundidad
  // sin el look de "slab/diapositiva".
  const surface = {
    position: 'relative', overflow: 'hidden', borderRadius: CARD_R, padding: '20px 22px 22px', height: CARD_H,
    display: 'flex', flexDirection: 'column',
    backgroundColor: '#f1e8d4', boxShadow: `0 10px 26px ${ink}1f`,
  };
  const tabBtn = (active) => ({
    border: `2px solid ${active ? ink : 'transparent'}`, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
    padding: '8px 18px', borderRadius: 999, background: active ? '#F2792A' : 'transparent', color: active ? '#fff' : 'rgba(74,54,34,0.6)',
    whiteSpace: 'nowrap', textShadow: active ? '0 1px 1px rgba(0,0,0,0.2)' : 'none', boxShadow: active ? `1.4px 1.8px 0 ${ink}33` : 'none', transition: 'all .15s',
  });
  // Gato contenido dentro del hero (sin sangrado por debajo): asoma en la
  // esquina inferior derecha, detrás del contenido (zIndex 0).
  const gatoStyle = {
    position: 'absolute', right: 6, bottom: 0, height: GATO_H, width: 'auto', maxWidth: '46%',
    objectFit: 'contain', objectPosition: 'right bottom', pointerEvents: 'none', zIndex: 0, opacity: 1,
  };
  return (
    <div style={{ position: 'relative', marginTop: 20 }}>
      <div style={surface}>
        {heroUrl ? (
          // Fondo alegórico del libro en foco (acuarela IA), a sangre, con el
          // MISMO tratamiento difuminado + velo crema que las fichas de "Últimos
          // abiertos": queda desaturado al fondo para que el contenido resalte.
          // Cambia con la pestaña y con el libro en foco.
          <>
            <img key={heroUrl} src={imgUrl(heroUrl, { width: 1000 })} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', filter: 'blur(0.75px)', transform: 'scale(1.03)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(241,232,212,0.28) 0%, rgba(241,232,212,0.5) 48%, rgba(241,232,212,0.62) 100%)' }} />
          </>
        ) : (
          // Sin imagen todavía: capa ambiental de hojas de otoño (fallback).
          <HojasOtono />
        )}
        {tab === 'seguir' && (
          <img src={`/assets/wallpapers/gato-${gatoColor}-7.webp`} alt="" style={gatoStyle} />
        )}
        {/* Velo crema para legibilidad: solo en el fallback (sin imagen de fondo). */}
        {!heroUrl && (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #f1e8d4 28%, rgba(241,232,212,0.55) 46%, rgba(241,232,212,0) 66%)', zIndex: 0, pointerEvents: 'none' }} />
        )}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <div style={{ display: 'inline-flex', alignSelf: 'flex-start', gap: 4, padding: 5, borderRadius: 999, background: 'rgba(255,253,247,0.7)', boxShadow: `inset 0 0 0 2px ${ink}38`, marginBottom: 6, flexShrink: 0 }}>
            {SWIM_TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={tabBtn(tab === t.id)}>{t.label}</button>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {tab === 'seguir'
              ? (featured ? <HeroFeatured book={featured} onOpen={onOpen} /> : <EmptyLane msg="Cuando empieces a leer un libro aparecerá acá para que retomes donde lo dejaste." />)
              : tab === 'novedades'
                ? (novedades.length > 0
                    ? <NovedadesSpotlight novedades={novedades} idx={novIdx} setIdx={setNovIdx} onOpen={onOpenLibro} onPreview={onPreviewLibro} />
                    : <EmptyLane msg="Pronto verás acá los libros recién llegados a la biblioteca." />)
                : (recomendaciones.length > 0 ? <RecomendacionSpotlight recomendaciones={recomendaciones} idx={recIdx} setIdx={setRecIdx} onOpen={onOpenLibro} onPreview={onPreviewLibro} /> : <EmptyLane msg="Estamos preparando recomendaciones a tu medida. ¡Vuelve pronto!" />)}
          </div>
        </div>
        {/* Cantoneras que marcan los límites de la imagen de fondo. */}
        <CornerMounts size={46} />
      </div>
    </div>
  );
}

export { InmHeader, Swimlane };
