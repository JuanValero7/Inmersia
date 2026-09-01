import React from 'react'
import { INK, inmTint, BookCover, CornerMounts, Skel, useAnchoContenedor } from './helpers.jsx'
import { NovedadesSpotlight } from './NovedadesSpotlight.jsx'
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

// Anchos mínimos de la caja del spotlight (NO del viewport: esta columna
// es `flex:3` de la fila superior, ~60% del ancho útil).
//   portada 300px de alto = 207px de ancho (aspect-ratio 210/305)
//   la fila de botones "Ver detalle"+"Preview" no baja de 234px
// Con la lista lateral: 207 + 40 + 250 + 40 + 300 + 28 de padding ≈ 865.
// Sin ella:              207 + 40 + 250 + 28                      ≈ 525.
// La lista va AL LADO solo si entra sin estrujar el texto:
//   207 (portada) + 40 + 234 (los dos botones) + 40 + 300 + 28 de padding ≈ 849.
// Debajo de eso baja a una tira horizontal bajo el spotlight. Se probó una
// talla intermedia (lista de 200px, para que un portátil de 1440 la tuviera
// al lado) y se descartó: entra por geometría pero deja la reseña en una sola
// línea y los botones apilados. La tira se lee mejor.
const REC_ANCHO_LATERAL = 880
// Debajo de esto además se compactan tipografías y botones, para que los dos
// ("Ver detalle" + "Preview") sigan entrando en una sola línea.
const REC_ANCHO_COMPACTO = 560

function RecomendacionSpotlight({ recomendaciones, idx, setIdx, onOpen, onPreview }) {
  const ink = INK
  const [cajaRef, ancho] = useAnchoContenedor()
  if (!recomendaciones.length) return null

  const libro = recomendaciones[idx]
  const bookShape = (l) => ({ id: l.id, title: l.titulo, author: l.autor, cover: l.portada_url, color: l.color, pages: l.paginas })
  // ancho 0 = todavía sin medir; asumimos holgado para no parpadear.
  const holgado  = ancho === 0 || ancho >= REC_ANCHO_LATERAL
  const estrecho = ancho !== 0 && ancho < REC_ANCHO_COMPACTO
  // En modo tira la portada baja a 220 aunque haya sitio a lo ancho: la tira
  // suma ~90px de alto y la tarjeta del Swimlane mide 500 fijos.
  const portadaH = holgado ? 300 : 220

  return (
    <div ref={cajaRef} style={{ display: 'flex', alignItems: 'center', gap: estrecho ? 26 : 40, padding: '16px 14px 26px', flexWrap: 'wrap' }}>
      <div onClick={(e) => onOpen(libro, e.currentTarget.getBoundingClientRect())}
        style={{ cursor: 'pointer', flexShrink: 0, transform: 'rotate(-5deg)', filter: `drop-shadow(4px 10px 12px ${ink}48)` }}>
        <BookCover book={bookShape(libro)} h={portadaH} />
      </div>

      {/* En modo tira el alto lo manda el contenido, no la portada: si se fija
          en portadaH (220) la reseña queda cortada a media línea. */}
      <div style={{ flex: 1, minWidth: 0, height: holgado ? portadaH : 'auto', display: 'flex', flexDirection: 'column', gap: estrecho ? 8 : 10 }}>
        <span style={{ alignSelf: 'flex-start', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#cf9b3f', color: '#fff',
          border: `2px solid ${ink}`, borderRadius: 999, padding: '4px 13px', fontWeight: 700, fontSize: 12.5,
          textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}>★ Para ti</span>
        <div style={{ flexShrink: 0, fontWeight: 800, fontSize: 22, lineHeight: 1.15, color: ink,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{libro.titulo}</div>
        <div style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'rgba(74,54,34,0.6)' }}>{libro.autor}</div>

        {libro.descripcion && (
          <div style={{ flex: holgado ? 1 : '0 1 auto', minHeight: 0, maxHeight: holgado ? undefined : 104, overflowY: 'auto',
            background: '#fdf6e3', border: `2px solid ${ink}`, borderRadius: '4px 16px 16px 4px',
            padding: '12px 15px', fontSize: 14, lineHeight: 1.5, color: ink, fontFamily: "'Poppins', system-ui, sans-serif" }}>
            {libro.descripcion}
          </div>
        )}

        <div style={{ flexShrink: 0, display: 'flex', gap: 11, flexWrap: 'wrap' }}>
          <button onClick={(e) => onOpen(libro, e.currentTarget.getBoundingClientRect())}
            style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#F2792A', color: '#fff', border: `2px solid ${ink}`,
              borderRadius: 999, padding: estrecho ? '11px 19px' : '13px 26px', fontWeight: 700, fontSize: estrecho ? 14 : 15, fontFamily: 'inherit', cursor: 'pointer',
              textShadow: '0 1px 1px rgba(0,0,0,0.2)', boxShadow: `2px 2.8px 0 ${ink}33` }}>
            Ver detalle
          </button>
          <button onClick={() => onPreview(libro)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fffdf8', color: ink, border: `2px solid ${ink}`,
              borderRadius: 999, padding: estrecho ? '11px 15px' : '13px 20px', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
              boxShadow: `1.6px 2px 0 ${ink}33` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" /></svg>
            Preview
          </button>
        </div>
      </div>

      {recomendaciones.length > 1 && (
        <div style={holgado
          ? { flexShrink: 0, width: 300, height: 300, display: 'flex', flexDirection: 'column', gap: 12 }
          : { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'rgba(74,54,34,0.55)' }}>
            Otras recomendaciones
          </div>
          <div style={holgado
            ? { flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, justifyItems: 'center', alignContent: 'start' }
            : { display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
            {recomendaciones.map((l, i) => i === idx ? null : (
              <div key={l.id} onClick={() => setIdx(i)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                <BookCover book={bookShape(l)} h={holgado ? 110 : 78} />
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



// Debajo de este ancho de caja la portada de 300px (207 de ancho) más el
// título de 42px no dejan sitio para el botón "Continuar" (~180px).
const HERO_ANCHO_ESTRECHO = 560

function HeroFeatured({ book, onOpen }) {
  const ink = INK, accent = '#F2792A';
  const [hov, setHov] = React.useState(false);
  const [cajaRef, ancho] = useAnchoContenedor();
  const cat = book.categoryName;
  const hasProgress = typeof book.progress === 'number';
  const pct = hasProgress ? Math.round(book.progress * 100) : 0;
  // ancho 0 = todavía sin medir; asumimos holgado para no parpadear.
  const estrecho = ancho !== 0 && ancho < HERO_ANCHO_ESTRECHO;
  return (
    <div ref={cajaRef} style={{ display: 'flex', gap: estrecho ? 26 : 48, alignItems: 'center', padding: '16px 14px 26px' }}>
      <div onClick={(e) => onOpen(book, e.currentTarget.getBoundingClientRect())}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ cursor: 'pointer', flexShrink: 0, marginLeft: estrecho ? 0 : 24, transform: hov ? 'rotate(0deg) translateY(-5px)' : 'rotate(-6deg)', transformOrigin: 'center bottom', transition: 'transform .35s cubic-bezier(.2,.75,.3,1)', filter: `drop-shadow(5px 12px 16px ${ink}3a)` }}>
        <BookCover book={book} h={estrecho ? 220 : 300} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: estrecho ? 30 : 42, lineHeight: 1.04, letterSpacing: '-0.015em', color: ink,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</div>
        <div style={{ color: 'rgba(74,54,34,0.64)', fontSize: estrecho ? 16 : 19, marginTop: 10, fontWeight: 600 }}>{book.author}{cat ? ` · ${cat}` : ''}</div>

        <div style={{ marginTop: estrecho ? 16 : 26, maxWidth: 520 }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: estrecho ? 18 : 28, flexWrap: 'wrap' }}>
          <button onClick={(e) => onOpen(book, e.currentTarget.getBoundingClientRect())}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: accent, color: '#fff', border: `2px solid ${ink}`, borderRadius: 999, padding: estrecho ? '13px 22px' : '16px 32px', fontWeight: 700, fontSize: estrecho ? 15 : 18, fontFamily: 'inherit', cursor: 'pointer', textShadow: '0 1px 1px rgba(0,0,0,0.2)', boxShadow: `2px 2.8px 0 ${ink}33` }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            {hasProgress ? 'Continuar' : 'Empezar a leer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Geometría y estilos del hero ────────────────────────────
// A nivel de módulo (no dependen de props) para que <SwimlaneSkeleton>
// pinte EXACTAMENTE el mismo marco mientras cargan los libros.
const ink = INK;
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
// Contenedor de las tres píldoras (Seguir / Novedades / Recomendaciones).
const tabsWrap = {
  display: 'flex', flexWrap: 'wrap', alignSelf: 'flex-start', maxWidth: '100%', gap: 4, padding: 5,
  borderRadius: 22, background: 'rgba(255,253,247,0.7)', boxShadow: `inset 0 0 0 2px ${ink}38`, marginBottom: 6, flexShrink: 0,
};
// Velo crema de legibilidad del fallback (sin imagen de fondo).
const veloCrema = {
  position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
  background: 'linear-gradient(90deg, #f1e8d4 28%, rgba(241,232,212,0.55) 46%, rgba(241,232,212,0) 66%)',
};

function Swimlane({ featured, onOpen, novedades = [], recomendaciones = [], onOpenLibro, onPreviewLibro, gatoColor = 'negro' }) {
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

  return (
    <div style={{ position: 'relative', marginTop: 20 }}>
      <div style={surface}>
        {heroUrl && (
          // Fondo alegórico del libro en foco (acuarela IA), a sangre, con el
          // MISMO tratamiento difuminado + velo crema que las fichas de "Últimos
          // abiertos": queda desaturado al fondo para que el contenido resalte.
          // Cambia con la pestaña y con el libro en foco.
          <>
            <img key={heroUrl} src={imgUrl(heroUrl, { width: 1000 })} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', filter: 'blur(0.75px)', transform: 'scale(1.03)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(241,232,212,0.28) 0%, rgba(241,232,212,0.5) 48%, rgba(241,232,212,0.62) 100%)' }} />
          </>
        )}
        {tab === 'seguir' && (
          <img src={`/assets/wallpapers/gato-${gatoColor}-7.webp`} alt="" style={gatoStyle} />
        )}
        {/* Velo crema para legibilidad: solo en el fallback (sin imagen de fondo). */}
        {!heroUrl && (
          <div style={veloCrema} />
        )}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          {/* Las tres píldoras suman 428px; en una caja angosta (~422px a 860px
              de viewport) envuelven a una segunda línea en vez de salirse. */}
          <div style={tabsWrap}>
            {SWIM_TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={tabBtn(tab === t.id)}>{t.label}</button>
            ))}
          </div>
          {/* `margin: auto 0` en el hijo, NO `justifyContent: center` en el padre:
              centra igual cuando sobra sitio, pero si el contenido pasa de
              CARD_H el centrado deja la parte de ARRIBA fuera de alcance del
              scroll (bug conocido de flexbox) y se comía la píldora del título. */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ margin: 'auto 0', width: '100%' }}>
            {tab === 'seguir'
              ? (featured ? <HeroFeatured book={featured} onOpen={onOpen} /> : <EmptyLane msg="Cuando empieces a leer un libro aparecerá acá para que retomes donde lo dejaste." />)
              : tab === 'novedades'
                ? (novedades.length > 0
                    ? <NovedadesSpotlight novedades={novedades} idx={novIdx} setIdx={setNovIdx} onOpen={onOpenLibro} onPreview={onPreviewLibro} />
                    : <EmptyLane msg="Pronto verás acá los libros recién llegados a la biblioteca." />)
                : (recomendaciones.length > 0 ? <RecomendacionSpotlight recomendaciones={recomendaciones} idx={recIdx} setIdx={setRecIdx} onOpen={onOpenLibro} onPreview={onPreviewLibro} /> : <EmptyLane msg="Estamos preparando recomendaciones a tu medida. ¡Vuelve pronto!" />)}
            </div>
          </div>
        </div>
        {/* Cantoneras que marcan los límites de la imagen de fondo. */}
        <CornerMounts size={46} />
      </div>
    </div>
  );
}

// ── Esqueleto del hero ──────────────────────────────────────
// El marco de la tarjeta (fondo crema, pestañas, gato y cantoneras) no
// depende de ningún dato: se pinta ya, y solo la portada + los textos del
// libro destacado esperan como bloques. Las pestañas van inertes: sin datos
// no hay nada que mostrar detrás de Novedades / Recomendaciones.
function SwimlaneSkeleton({ gatoColor = 'negro' }) {
  return (
    <div style={{ position: 'relative', marginTop: 20 }}>
      <div style={surface}>
        <img src={`/assets/wallpapers/gato-${gatoColor}-7.webp`} alt="" style={gatoStyle} />
        <div style={veloCrema} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <div style={tabsWrap} aria-hidden="true">
            {SWIM_TABS.map(t => <span key={t.id} style={{ ...tabBtn(t.id === 'seguir'), cursor: 'default' }}>{t.label}</span>)}
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 48, padding: '16px 14px 26px' }}>
            {/* mismas medidas que <HeroFeatured>: portada de 300px de alto
                (207 de ancho por el aspect-ratio 210/305) y su inclinación */}
            <Skel w={207} h={300} r={14} style={{ marginLeft: 24, transform: 'rotate(-6deg)' }} />
            <div style={{ flex: 1, minWidth: 0, maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skel w="78%" h={40} />
              <Skel w="45%" h={20} />
              <Skel w="30%" h={16} style={{ marginTop: 14 }} />
              <Skel w="100%" h={14} r={9} />
              <Skel w={230} h={56} r={999} style={{ marginTop: 16 }} />
            </div>
          </div>
        </div>
        <CornerMounts size={46} />
      </div>
    </div>
  );
}

export { InmHeader, Swimlane, SwimlaneSkeleton };
