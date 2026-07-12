import React from 'react'
import { INK, BookCover } from './helpers.jsx'

// =============================================================
// ACUARELA · Novedades — vista "Spotlight + carrusel".
// Reemplaza a <CatalogRow> SOLO para la pestaña "Novedades" del
// Swimlane. Un recién llegado en grande (portada real + reseña +
// acciones) y el resto en una tira lateral "También llegaron".
//
// Contrato idéntico al de las otras vistas del Swimlane:
//   onOpen(libro, rect)  → abre la ficha / "Ver detalle"
//   onPreview(libro)     → abre el modal de preview
//
// `novedades` son filas crudas de la Tienda (titulo/autor/
// portada_url/color/paginas/descripcion en español); se mapean al
// shape de BookCover (title/author/cover) solo para pintar.
// =============================================================

const bookShape = (l) => ({
  id: l.id, title: l.titulo, author: l.autor,
  cover: l.portada_url, color: l.color, pages: l.paginas,
})

// icono ojo (mismo que usa Preview en el resto de la biblioteca)
function EyeIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function NovedadesSpotlight({ novedades = [], onOpen, onPreview }) {
  const ink = INK
  const [idx, setIdx] = React.useState(0)
  React.useEffect(() => { if (idx >= novedades.length) setIdx(0) }, [novedades.length, idx])
  if (!novedades.length) return null

  const libro = novedades[idx]
  const otros = novedades.filter((_, i) => i !== idx)

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 32, padding: '16px 14px 26px' }}>

      {/* ── Spotlight ── */}
      <div style={{ flex: '1.15', minWidth: 0, display: 'flex', gap: 34, alignItems: 'center' }}>
        <div onClick={(e) => onOpen(libro, e.currentTarget.getBoundingClientRect())}
          style={{ cursor: 'pointer', flexShrink: 0, transform: 'rotate(-4deg)', filter: `drop-shadow(4px 12px 14px ${ink}4d)` }}>
          <BookCover book={bookShape(libro)} h={300} />
        </div>

        <div style={{ flex: 1, minWidth: 0, height: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ alignSelf: 'flex-start', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, background: ink, color: '#fff',
            borderRadius: 999, padding: '5px 14px', fontWeight: 700, fontSize: 12.5,
            textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}>✦ Recién llegado</span>

          <div style={{ flexShrink: 0, fontWeight: 800, fontSize: 24, lineHeight: 1.15, color: ink,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{libro.titulo}</div>
          <div style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'rgba(74,54,34,0.65)' }}>{libro.autor}</div>

          {libro.descripcion && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#fdf6e3', border: `2px solid ${ink}`, borderRadius: '4px 16px 16px 4px',
              padding: '12px 15px', fontSize: 14, lineHeight: 1.5, color: ink }}>
              {libro.descripcion}
            </div>
          )}

          <div style={{ flexShrink: 0, display: 'flex', gap: 11 }}>
            <button onClick={(e) => onOpen(libro, e.currentTarget.getBoundingClientRect())}
              style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#cf7b4c', color: '#fff',
                border: `2px solid ${ink}`, borderRadius: 999, padding: '13px 26px', fontWeight: 700, fontSize: 15,
                fontFamily: 'inherit', cursor: 'pointer', textShadow: '0 1px 1px rgba(0,0,0,0.2)', boxShadow: `2px 2.8px 0 ${ink}33` }}>
              Ver detalle
            </button>
            <button onClick={() => onPreview(libro)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fffdf8', color: ink,
                border: `2px solid ${ink}`, borderRadius: 999, padding: '13px 20px', fontWeight: 700, fontSize: 14,
                fontFamily: 'inherit', cursor: 'pointer', boxShadow: `1.6px 2px 0 ${ink}33` }}>
              <EyeIcon /> Preview
            </button>
          </div>
        </div>
      </div>

      {/* ── Carrusel "También llegaron" ── */}
      {otros.length > 0 && (
        <div style={{ flex: '.6', minWidth: 210, maxWidth: 320, height: 300, display: 'flex', flexDirection: 'column',
          gap: 14, borderLeft: `2px solid ${ink}1f`, paddingLeft: 26 }}>
          <div style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em',
            color: 'rgba(74,54,34,0.55)' }}>También llegaron</div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4 }}>
            {novedades.map((l, i) => i === idx ? null : (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div onClick={() => setIdx(i)} style={{ cursor: 'pointer', flexShrink: 0 }} title="Ver en el spot principal">
                  <BookCover book={bookShape(l)} h={64} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: ink, lineHeight: 1.2,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.titulo}</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                    <button onClick={(e) => onOpen(l, e.currentTarget.getBoundingClientRect())}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
                        fontWeight: 700, fontSize: 11.5, color: '#b5613a' }}>Ver detalle</button>
                    <button onClick={() => onPreview(l)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0,
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 11.5, color: 'rgba(74,54,34,0.6)' }}>
                      <EyeIcon size={12} /> Preview
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { NovedadesSpotlight }
