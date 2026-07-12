// =============================================================
// INMERSIA · Biblioteca mobile — "Últimos abiertos" en tarjetas.
// Análogo a UltimosAbiertos.jsx (desktop) pero apiladas una debajo
// de otra (columna) en vez de en fila, para el ancho angosto mobile.
// =============================================================
import React from 'react'
import { INK, BookCover } from './bibmHelpers.jsx'

export function UltimosAbiertosMobile({ books, onOpen }) {
  if (!books.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {books.map(b => {
        const hasProgress = typeof b.progress === 'number'
        const pct = hasProgress ? Math.round(b.progress * 100) : null
        return (
          <div key={b.id} onClick={(e) => onOpen(b, e.currentTarget.getBoundingClientRect())} style={{
            display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
            background: '#f1e8d4', border: `2px solid ${INK}`, borderRadius: 16,
            padding: '12px 16px', boxShadow: `2px 5px 0 ${INK}1a`,
          }}>
            <div style={{ flexShrink: 0 }}>
              <BookCover book={b} h={100} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
