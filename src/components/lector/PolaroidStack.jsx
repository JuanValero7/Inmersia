// Plain JavaScript (.jsx)
import { useState, useEffect, useRef, memo, forwardRef, useImperativeHandle } from 'react'
import { createPortal } from 'react-dom'
import { theme } from './clay.jsx'

// Fotos ya reveladas al menos una vez: persistidas en localStorage (por
// navegador, no por usuario) para que la animación de "primera vez" no se
// repita en recargas ni sesiones futuras.
const SEEN_KEY = 'inm_polaroid_vistas'
function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) } catch { return new Set() }
}
function persistSeen(set) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])) } catch { /* localStorage no disponible */ }
}

// Polaroids: SIEMPRE detrás del libro (el posicionamiento lo da el padre).
// Brillan cuando hay fotos reveladas en la página actual; al clickear abren
// el visor superpuesto con miniaturas. Recibe `images` (media reales).
//
// La primera vez que una foto se revela, aparece "destacada": encima del
// libro (portal a body), en el centro. Un click o la flecha ►  la amplían
// en el visor; cerrar el visor (o volver a darle a la flecha) la manda
// definitivamente a su lugar habitual en el stack, detrás del libro.
// `interceptForward` (via ref) permite que Lector.jsx consuma la flecha ►
// mientras haya una foto destacada en curso, en vez de pasar de página.
const DISMISS_MS = 380

const PolaroidStack = memo(forwardRef(function PolaroidStack({ images, esNoficcion = false }, ref) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [hasOpened, setHasOpened] = useState(false)
  const [featuredId, setFeaturedId] = useState(null)
  const [dismissing, setDismissing] = useState(false)
  const seenRef = useRef(null)
  if (seenRef.current === null) seenRef.current = loadSeen()
  const featuredOpeningRef = useRef(false)
  const dismissTimerRef = useRef(null)
  const hasImages = images && images.length > 0

  useEffect(() => { if (index >= (images?.length || 0)) setIndex(0) }, [images?.length])
  useEffect(() => { setHasOpened(false) }, [images?.length])
  useEffect(() => () => clearTimeout(dismissTimerRef.current), [])

  // Detecta fotos nunca vistas y las destaca una por una (la siguiente se
  // toma recién cuando la anterior se descarta, vía featuredId en deps).
  useEffect(() => {
    if (!images || featuredId != null) return
    const seen = seenRef.current
    const unseen = images.find(img => img.media_id != null && !seen.has(img.media_id))
    if (unseen) {
      seen.add(unseen.media_id)
      persistSeen(seen)
      setFeaturedId(unseen.media_id)
    }
  }, [images, featuredId])

  // Encoge la foto destacada y, al terminar la animación, la integra
  // definitivamente en el stack normal (detrás del libro).
  function dismissFeatured() {
    setDismissing(true)
    clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = setTimeout(() => {
      setFeaturedId(null)
      setDismissing(false)
    }, DISMISS_MS)
  }

  // Cuando se cierra el visor abierto desde la foto destacada, esta pasa a
  // integrarse permanentemente en el stack normal.
  useEffect(() => {
    if (!open && featuredOpeningRef.current) {
      featuredOpeningRef.current = false
      dismissFeatured()
    }
  }, [open])

  useImperativeHandle(ref, () => ({
    interceptForward() {
      if (featuredId == null || dismissing) return false
      if (!open) {
        const idx = images.findIndex(img => img.media_id === featuredId)
        if (idx === -1) { setFeaturedId(null); return false }
        featuredOpeningRef.current = true
        openAt(idx)
      } else {
        setOpen(false)
        featuredOpeningRef.current = false
        dismissFeatured()
      }
      return true
    },
  }))

  if (!hasImages) return null

  const fan = images.filter(img => img.media_id !== featuredId).slice(0, 3)
  const rots = [-4, 2.5, -1.5]
  const tops = [0, 150, 300]
  const lefts = [12, 20, 6]
  const glowing = hasImages && !hasOpened

  function openAt(i) { setIndex(i); setOpen(true); setHasOpened(true) }
  const cur = images[index] || null
  const featuredImg = featuredId != null ? images.find(img => img.media_id === featuredId) : null
  // Se ubica sobre la mitad de pantalla donde arranca su párrafo (página
  // izquierda/derecha del libro abierto, o centrada en vista de una página).
  const featuredAlign = featuredImg?._lado === 'izq' ? 'flex-start' : featuredImg?._lado === 'der' ? 'flex-end' : 'center'

  return (
    <div style={{ position: 'relative', width: 160, height: 470, flexShrink: 0 }}>
      {featuredImg && createPortal((
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: featuredAlign, padding: '0 7vw', pointerEvents: 'none' }}>
          <div onClick={(e) => { e.stopPropagation(); featuredOpeningRef.current = true; openAt(images.findIndex(img => img.media_id === featuredId)) }}
            className={dismissing ? 'inm-polaroid-shrink' : 'inm-polaroid-pop'} title={featuredImg.titulo || 'Ver foto'}
            style={{ pointerEvents: dismissing ? 'none' : 'auto', cursor: 'pointer', width: 280 }}>
            <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%) rotate(-3deg)', width: 82, height: 28, background: `${theme.accent}cc`, border: `2px solid ${theme.ink}55`, opacity: 0.85, zIndex: 3 }} />
            <div style={{ background: '#f7f4ec', padding: '16px 16px 0', border: `2.5px solid ${theme.ink}`, borderRadius: 6, boxShadow: `4px 6px 0 ${theme.ink}30, 8px 14px 34px rgba(60,42,22,0.45)` }}>
              <div style={{ width: '100%', height: 208, border: `2px solid ${theme.ink}88`, overflow: 'hidden', background: '#e7dcc2' }}>
                <img src={featuredImg.url} alt={featuredImg.titulo || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: theme.ink, textAlign: 'center', padding: '0 6px', lineHeight: 1.15, overflow: 'hidden' }}>{featuredImg.titulo || featuredImg.slug}</div>
            </div>
          </div>
        </div>
      ), document.body)}

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
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(20,12,4,0.80)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {esNoficcion ? (
            <div onClick={e => e.stopPropagation()} style={{ background: theme.navBg, border: `2px solid ${theme.ink}`, borderRadius: 16, padding: 18, width: 'min(900px,94vw)', boxShadow: `4px 6px 0 ${theme.ink}30, 0 30px 70px rgba(0,0,0,0.7)`, position: 'relative' }}>
              <button onClick={() => setOpen(false)} style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: theme.navText, lineHeight: 1, zIndex: 2 }}>✕</button>
              <div style={{ background: '#120d08', borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${theme.ink}44` }}>
                <img src={cur?.url} alt={cur?.titulo || ''} style={{ width: '100%', maxHeight: '72vh', objectFit: 'contain', display: 'block' }} />
              </div>
              {(cur?.titulo || cur?.slug) && (
                <div style={{ textAlign: 'center', marginTop: 14, fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 17, color: theme.navText, lineHeight: 1.3 }}>{cur.titulo || cur.slug}</div>
              )}
              {images.length > 1 && (
                <>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                    {images.map((img, i) => (
                      <button key={img.media_id ?? i} onClick={() => setIndex(i)} title={img.titulo || ''}
                        style={{ width: 54, height: 42, border: `2px solid ${i === index ? theme.accent : `${theme.ink}55`}`, borderRadius: 5, overflow: 'hidden', cursor: 'pointer', opacity: i === index ? 1 : 0.6, padding: 0, background: '#120d08' }}>
                        <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <ClayBtn onClick={() => setIndex(i => (i - 1 + images.length) % images.length)}>← Anterior</ClayBtn>
                    <span style={{ fontFamily: "'Baloo 2',sans-serif", fontWeight: 700, fontSize: 12, color: theme.subText }}>{index + 1} / {images.length}</span>
                    <ClayBtn onClick={() => setIndex(i => (i + 1) % images.length)}>Siguiente →</ClayBtn>
                  </div>
                </>
              )}
            </div>
          ) : (
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
          )}
        </div>
      ), document.body)}
    </div>
  )
}))

export { PolaroidStack }

function ClayBtn({ children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer', border: `2px solid ${theme.ink}`, borderRadius: 999, padding: '6px 14px', background: theme.navBg, color: theme.navText, boxShadow: `1.6px 2.4px 0 ${theme.ink}30` }}>
      {children}
    </button>
  )
}
