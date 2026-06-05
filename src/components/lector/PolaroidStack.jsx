// Plain JavaScript (.jsx)
import { useState, useEffect, memo } from 'react'
import { createPortal } from 'react-dom'
import { theme } from './clay.jsx'

// Polaroids: SIEMPRE detrás del libro (el posicionamiento lo da el padre).
// Brillan cuando hay fotos reveladas en la página actual; al clickear abren
// el visor superpuesto con miniaturas. Recibe `images` (media reales).
const PolaroidStack = memo(function PolaroidStack({ images }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [hasOpened, setHasOpened] = useState(false)
  const hasImages = images && images.length > 0

  useEffect(() => { if (index >= (images?.length || 0)) setIndex(0) }, [images?.length])
  useEffect(() => { setHasOpened(false) }, [images?.length])

  if (!hasImages) return null

  const fan = images.slice(0, 3)
  const rots = [-4, 2.5, -1.5]
  const tops = [0, 150, 300]
  const lefts = [12, 20, 6]
  const glowing = hasImages && !hasOpened

  function openAt(i) { setIndex(i); setOpen(true); setHasOpened(true) }
  const cur = images[index] || null

  return (
    <div style={{ position: 'relative', width: 160, height: 470, flexShrink: 0 }}>
      {fan.map((img, i) => (
        <div key={img.media_id ?? i} onClick={(e) => { e.stopPropagation(); openAt(i) }}
          className={glowing ? 'inm-glow' : ''} title={img.titulo || 'Ver foto'}
          style={{ position: 'absolute', top: tops[i], left: lefts[i], width: 138, cursor: 'pointer', transform: `rotate(${rots[i]}deg)`, transition: 'transform .2s', zIndex: i + 1 }}>
          <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%) rotate(-3deg)', width: 50, height: 18, background: `${theme.accent}cc`, border: `1.5px solid ${theme.ink}55`, opacity: 0.85, zIndex: 3 }} />
          <div style={{ background: '#f7f4ec', padding: '9px 9px 0', border: `2px solid ${theme.ink}`, borderRadius: 3, boxShadow: `2px 3px 0 ${theme.ink}26, 3px 5px 12px rgba(60,42,22,0.28)` }}>
            <div style={{ width: '100%', height: 100, border: `1.5px solid ${theme.ink}88`, overflow: 'hidden', background: '#e7dcc2' }}>
              <img src={img.url} alt={img.titulo || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Baloo 2', sans-serif", fontSize: 10.5, fontWeight: 700, color: theme.ink, textAlign: 'center', padding: '0 4px', lineHeight: 1.1, overflow: 'hidden' }}>{img.titulo || img.slug}</div>
          </div>
        </div>
      ))}

      {open && createPortal((
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(20,12,4,0.62)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: theme.navBg, border: `2px solid ${theme.ink}`, borderRadius: 20, padding: 22, width: 'min(460px,92vw)', boxShadow: `4px 6px 0 ${theme.ink}30, 0 30px 70px rgba(0,0,0,0.6)`, position: 'relative' }}>
            <button onClick={() => setOpen(false)} style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: theme.navText, lineHeight: 1 }}>✕</button>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18, color: theme.navText, marginBottom: 14 }}>Escenas del capítulo</div>
            <div style={{ background: '#f7f4ec', padding: '14px 14px 18px', border: `2px solid ${theme.ink}`, borderRadius: 5, width: 'fit-content', margin: '0 auto', boxShadow: `3px 4px 0 ${theme.ink}26` }}>
              <div style={{ width: 330, height: 244, border: `1.5px solid ${theme.ink}88`, overflow: 'hidden', background: '#e7dcc2' }}>
                <img src={cur?.url} alt={cur?.titulo || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 10, fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 14, color: theme.ink }}>{cur?.titulo || cur?.slug}</div>
            </div>
            {images.length > 1 && (
              <>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                  {images.map((img, i) => (
                    <button key={img.media_id ?? i} onClick={() => setIndex(i)} title={img.titulo || ''}
                      style={{ width: 54, height: 42, border: `2px solid ${i === index ? theme.accent : `${theme.ink}55`}`, borderRadius: 5, overflow: 'hidden', cursor: 'pointer', opacity: i === index ? 1 : 0.6, padding: 0, background: '#e7dcc2', boxShadow: i === index ? `1.2px 1.6px 0 ${theme.ink}33` : 'none' }}>
                      <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <ClayBtn onClick={() => setIndex(i => (i - 1 + images.length) % images.length)}>← Anterior</ClayBtn>
                  <span style={{ fontFamily: "'Baloo 2',sans-serif", fontWeight: 700, fontSize: 12, color: theme.subText }}>{index + 1} / {images.length}</span>
                  <ClayBtn onClick={() => setIndex(i => (i + 1) % images.length)}>Siguiente →</ClayBtn>
                </div>
              </>
            )}
          </div>
        </div>
      ), document.body)}
    </div>
  )
})

export { PolaroidStack }

function ClayBtn({ children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer', border: `2px solid ${theme.ink}`, borderRadius: 999, padding: '6px 14px', background: theme.navBg, color: theme.navText, boxShadow: `1.6px 2.4px 0 ${theme.ink}30` }}>
      {children}
    </button>
  )
}
