import React from 'react'
import { INK, BookCover, CornerMounts } from './helpers.jsx'
import { imgUrl } from '../../../lib/img.js'

// =============================================================
// ACUARELA · Lateral del home de Biblioteca (desktop).
// Va a la derecha del hero (Swimlane), ocupando el ~40% del ancho
// de la fila superior, con la MISMA altura que el hero. De arriba
// a abajo:
//   · 2 fichas "últimos abiertos" apiladas, horizontales (portada a
//     un lado + nombre/progreso al otro), estilo hero adaptado. No
//     incluyen el libro que ya sale en el hero (lo filtra el
//     orquestador).
//   · fila de accesos a Tienda y Álbum (antes en la head bar).
// Reutiliza el BookCover ilustrado de siempre.
// =============================================================

// Debe calzar con CARD_H del Swimlane (HeaderSwimlane.jsx).
const PANEL_H = 500

function CoverCard({ book, onOpen }) {
  const ink = INK
  const hasProgress = typeof book.progress === 'number'
  const pct = hasProgress ? Math.round(book.progress * 100) : null
  return (
    <div onClick={(e) => onOpen(book, e.currentTarget.getBoundingClientRect())} style={{
      position: 'relative', overflow: 'hidden', cursor: 'pointer', flex: 1, minHeight: 0,
      display: 'flex', alignItems: 'center', gap: 16,
      background: '#f1e8d4', borderRadius: 16, padding: '12px 16px',
      boxShadow: `0 8px 20px ${ink}1c`,
    }}>
      {book.heroUrl && (
        <>
          <img src={imgUrl(book.heroUrl, { width: 640 })} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(241,232,212,0.5) 0%, rgba(241,232,212,0.82) 48%, rgba(241,232,212,0.92) 100%)', zIndex: 0, pointerEvents: 'none' }} />
        </>
      )}
      <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <BookCover book={book} h={132} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.15, color: ink,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</div>
        <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 600, color: 'rgba(74,54,34,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.author}</div>
        {hasProgress ? (
          <div style={{ marginTop: 12 }}>
            <div className="inm-bar" style={{ maxWidth: 130 }}><div style={{ width: `${pct}%` }} /></div>
            <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: 'rgba(74,54,34,0.5)' }}>{pct}% leído</div>
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600, color: 'rgba(74,54,34,0.45)' }}>Sin progreso registrado</div>
        )}
      </div>
      <CornerMounts size={30} />
    </div>
  )
}

function EmptyCard({ msg }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 16,
      background: 'rgba(255,253,247,0.5)', border: `2px dashed ${INK}40`, borderRadius: 16,
      color: 'rgba(74,54,34,0.45)', fontWeight: 600, fontSize: 13,
    }}>{msg}</div>
  )
}

// Acceso crema (mismo tono que las demás fichas) con marca de agua del propio
// ícono al fondo para dar profundidad. `renderIcon(size)` dibuja el ícono en
// dos tamaños: nítido delante, marca de agua detrás.
function AccessTile({ renderIcon, label, onClick }) {
  const ink = INK
  const [hov, setHov] = React.useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      position: 'relative', overflow: 'hidden', flex: 1,
      display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 14,
      background: '#f1e8d4', color: ink, border: `2px solid ${ink}`, borderRadius: 16, cursor: 'pointer',
      fontFamily: 'inherit', fontWeight: 800, fontSize: 18, padding: '10px 16px',
      boxShadow: hov ? `1px 1.4px 0 ${ink}33` : `2.4px 3.2px 0 ${ink}26`,
      transform: hov ? 'translateY(1.4px)' : 'none', transition: 'box-shadow .12s, transform .12s',
    }}>
      <span style={{ position: 'absolute', right: -14, bottom: -18, opacity: 0.10, transform: 'rotate(-12deg)', pointerEvents: 'none', color: ink }}>
        {renderIcon(88)}
      </span>
      <span style={{ position: 'relative', display: 'flex' }}>{renderIcon(44)}</span>
      <span style={{ position: 'relative' }}>{label}</span>
    </button>
  )
}

const IconTienda = (s) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.1"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4m1.6 8L5 5H3m4 8a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const IconAlbum = (s) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.1"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

function LateralHome({ books = [], onOpen, onGoTienda, onGoAlbum }) {
  const slots = [books[0], books[1]]
  return (
    <div style={{ height: PANEL_H, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ flexShrink: 0, fontWeight: 800, fontSize: 19, color: '#3a2b1c', whiteSpace: 'nowrap' }}>Últimos abiertos</div>

      {slots.map((b, i) => b
        ? <CoverCard key={b.id} book={b} onOpen={onOpen} />
        : <EmptyCard key={`e${i}`} msg={i === 0 ? 'Aún no has abierto ningún libro' : 'Tus últimas lecturas aparecerán aquí'} />)}

      <div style={{ flexShrink: 0, height: 86, display: 'flex', gap: 14 }}>
        <AccessTile onClick={onGoTienda} label="Tienda" renderIcon={IconTienda} />
        <AccessTile onClick={onGoAlbum} label="Álbum" renderIcon={IconAlbum} />
      </div>
    </div>
  )
}

const LateralHomeMemo = React.memo(LateralHome)
export { LateralHomeMemo as LateralHome }
