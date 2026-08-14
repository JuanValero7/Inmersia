// =============================================================
// INMERSIA · Biblioteca mobile — tarjetas de la tira inferior.
// Análogo a UltimosAbiertos.jsx (desktop) pero apiladas una debajo
// de otra (columna) en vez de en fila, para el ancho angosto mobile.
//
// Dos variantes con el MISMO chasis visual (BibCard):
//  · UltimosAbiertosMobile → libros del usuario (con progreso, abre la
//    hoja de la biblioteca).
//  · LibroCardsMobile → libros del catálogo (Novedades / Para ti, aún
//    no adquiridos; abre el Preview/Panel como en la Tienda).
// Ambas pintan de fondo el hero acuarela del libro (heroUrlMobile) con
// un velo crema para mantener legible el texto.
// =============================================================
import React from 'react'
import { INK, BookCover } from './bibmHelpers.jsx'

// Chasis común: portada + fondo acuarela del libro + contenido a la derecha.
function BibCard({ book, heroUrl, onClick, children }) {
  return (
    <div onClick={onClick} style={{
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
      background: '#f1e8d4', border: `2px solid ${INK}`, borderRadius: 16,
      padding: '12px 16px', boxShadow: `2px 5px 0 ${INK}1a`,
    }}>
      {heroUrl && (
        <>
          <img src={heroUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 0, pointerEvents: 'none' }} />
          {/* Velo crema: más denso hacia la derecha, donde va el texto. */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(241,232,212,0.5) 0%, rgba(241,232,212,0.82) 52%, rgba(241,232,212,0.92) 100%)', zIndex: 0, pointerEvents: 'none' }} />
        </>
      )}
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
        <BookCover book={book} h={100} />
      </div>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}

export function UltimosAbiertosMobile({ books, onOpen }) {
  if (!books.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {books.map(b => {
        const hasProgress = typeof b.progress === 'number'
        const pct = hasProgress ? Math.round(b.progress * 100) : null
        return (
          <BibCard key={b.id} book={b} heroUrl={b.heroUrlMobile}
            onClick={(e) => onOpen(b, e.currentTarget.getBoundingClientRect())}>
            <div style={{ fontWeight: 800, fontSize: 14, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(74,54,34,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.author}</div>
            {hasProgress ? (
              <div style={{ marginTop: 9 }}>
                <div className="bibm-bar"><div style={{ width: `${pct}%` }} /></div>
                <div style={{ marginTop: 4, fontSize: 10.5, fontWeight: 700, color: 'rgba(74,54,34,0.5)' }}>{pct}% leído</div>
              </div>
            ) : (
              <div style={{ marginTop: 9, fontSize: 11, fontWeight: 600, color: 'rgba(74,54,34,0.45)' }}>Sin progreso registrado</div>
            )}
          </BibCard>
        )
      })}
    </div>
  )
}

// Novedades / Para ti: filas crudas del catálogo (titulo/autor/portada_url/
// color/metadata). Se mapean al shape de BookCover para pintar y al tocar
// abren el Preview/Panel (onOpen = setReelLibro).
const libroShape = (l) => ({ id: l.id, title: l.titulo, author: l.autor, cover: l.portada_url, color: l.color })

export function LibroCardsMobile({ libros, onOpen, badge }) {
  if (!libros?.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {libros.map(l => (
        <BibCard key={l.id} book={libroShape(l)} heroUrl={l.metadata?.hero_url_mobile}
          onClick={() => onOpen(l)}>
          {badge && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(74,54,34,0.1)', color: INK, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 999, marginBottom: 5 }}>{badge}</span>
          )}
          <div style={{ fontWeight: 800, fontSize: 14, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.titulo}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(74,54,34,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.autor}</div>
          <div style={{ marginTop: 9, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: 'var(--accent, #F2792A)' }}>
            Ver libro
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </BibCard>
      ))}
    </div>
  )
}
