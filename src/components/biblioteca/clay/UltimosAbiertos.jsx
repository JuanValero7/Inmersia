// src/components/biblioteca/clay/UltimosAbiertos.jsx
// ═══════════════════════════════════════════════════════════
// ARCHIVO NUEVO — pegar tal cual en esa ruta.
//
// Reemplaza a <CoverShelf> para la sección "Últimos abiertos" del
// home de Biblioteca (desktop). Antes, "Últimos abiertos" reusaba
// el mismo nicho de pared + tabla de madera que "Tu colección", así
// que ambas secciones se confundían visualmente. Esta versión es
// horizontal, sin pared/estante: fichas planas con la portada real
// (BookCover, sin tocar) + título/autor + barra de progreso.
//
// Usa el BookCover ilustrado de siempre — portada generada o
// portada_url si existe — no se reemplaza ni se reinterpreta cómo
// se ven las portadas.
// ═══════════════════════════════════════════════════════════
import React from 'react'
import { INK, BookCover } from './helpers.jsx'
import { imgUrl } from '../../../lib/img.js'

function UltimosAbiertos({ books, onOpen }) {
  const ink = INK
  if (!books.length) return null
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'stretch', flexWrap: 'wrap' }}>
      {books.map(b => {
        const hasProgress = typeof b.progress === 'number'
        const pct = hasProgress ? Math.round(b.progress * 100) : null
        return (
          <div key={b.id} onClick={(e) => onOpen(b, e.currentTarget.getBoundingClientRect())} style={{
            position: 'relative', overflow: 'hidden',
            flex: '1 1 240px', minWidth: 240, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
            background: '#f1e8d4', border: `2px solid ${ink}`, borderRadius: 16,
            padding: '12px 16px', boxShadow: `2px 5px 0 ${ink}1a`,
          }}>
            {b.heroUrl && (
              <>
                {/* Fondo alegórico del libro (acuarela IA), a sangre dentro de la ficha. */}
                <img src={imgUrl(b.heroUrl, { width: 520 })} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 0, pointerEvents: 'none' }} />
                {/* Velo crema: más denso hacia la derecha, donde va el texto. */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(241,232,212,0.55) 0%, rgba(241,232,212,0.82) 55%, rgba(241,232,212,0.9) 100%)', zIndex: 0, pointerEvents: 'none' }} />
              </>
            )}
            <div className="inm-bk" style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
              <BookCover book={b} h={110} />
            </div>
            <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(74,54,34,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.author}</div>
              {hasProgress ? (
                <div style={{ marginTop: 9 }}>
                  <div className="inm-bar"><div style={{ width: `${pct}%` }} /></div>
                  <div style={{ marginTop: 4, fontSize: 10.5, fontWeight: 700, color: 'rgba(74,54,34,0.5)' }}>{pct}% leído</div>
                </div>
              ) : (
                <div style={{ marginTop: 9, fontSize: 11, fontWeight: 600, color: 'rgba(74,54,34,0.45)' }}>Sin progreso registrado</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const UltimosAbiertosMemo = React.memo(UltimosAbiertos)
export { UltimosAbiertosMemo as UltimosAbiertos }
