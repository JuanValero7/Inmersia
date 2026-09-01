import React from 'react'
import { INK, inmTint, hashOf, spineColor, tituloBaseFontSize, autorFontSize } from '../coverHelpers.shared.js'
import CoverTitle from '../../CoverTitle.jsx'
import { imgUrl } from '../../../lib/img.js'

// =============================================================
// ACUARELA · helpers + portada generada (face-out).
// Las funciones puras (inmTint, hashOf, spineColor,
// INK) viven en ../coverHelpers.shared.js y se re-exportan aquí.
// Este archivo conserva los tamaños de lomo y el BookCover propios
// del desktop. Consume el `book` ya mapeado por el orquestador.
// =============================================================

// tamaños de lomo (variación según páginas + hash → look ilustrado)
const spineW = (b) => Math.max(30, Math.min(60, Math.round((b.pages / 800) * 24 + 32) + (hashOf(b.id) % 7) - 3));
const spineH = (b) => Math.round(96 + (hashOf(b.id + 'h') % 56)); // 96..152

// ─── Portada face-out ───────────────────────────────────────
// Misma estética ilustrada que la Tienda (.book/.book-cover/...):
// portada + lomo/base + canto de páginas, con título y autor
// superpuestos. El ancho se deriva de `h` para no romper los
// tamaños ya afinados en cada sitio (hero, repisa...).
function BookCover({ book, h = 174 }) {
  const w = Math.round(h * 210 / 305);
  const c = book.color || '#8c6838';
  return (
    <div className="book" style={{ '--cov': c, width: w }}>
      <div className="book-cover">
        {book.cover
          ? <img className="book-art-img" src={imgUrl(book.cover, { width: Math.round(w * 2) })} alt={book.title} loading="lazy" />
          : <div className="book-art-empty" />}
        <span className="book-scribble" style={{ fontSize: autorFontSize(w, book.author) }}>{book.author}</span>
        <CoverTitle title={book.title} size={tituloBaseFontSize(w)} />
      </div>
      <div className="book-base" />
      <div className="book-pages" />
    </div>
  );
}

// ─── Cantoneras de cuero (estilo álbum de fotos) ────────────
// Cuatro triángulos rellenos, uno por esquina, como los soportes
// donde se calza una foto: la imagen parece meterse por debajo. La
// punta exterior la redondea el propio contenedor (que debe ser
// position:relative + overflow:hidden + border-radius). Uso
// compartido: hero (Swimlane) y fichas de "últimos abiertos"
// (LateralHome), variando solo `size`.
function CornerMounts({ size = 46 }) {
  const mount = (v, h) => {
    const clip = v === 'top'
      ? (h === 'left' ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(0 0, 100% 0, 100% 100%)')
      : (h === 'left' ? 'polygon(0 0, 0 100%, 100% 100%)' : 'polygon(100% 0, 100% 100%, 0 100%)');
    // luz desde el exterior de cada esquina → la hipotenusa (interior) más oscura
    const angle = v === 'top' ? (h === 'left' ? 135 : 225) : (h === 'left' ? 45 : 315);
    const sx = h === 'left' ? 1.4 : -1.4, sy = v === 'top' ? 1.4 : -1.4;
    return {
      position: 'absolute', [v]: 0, [h]: 0, width: size, height: size, zIndex: 3, pointerEvents: 'none',
      background: `linear-gradient(${angle}deg, #6b4f31 0%, #4a3622 52%, #34261a 100%)`,
      clipPath: clip, WebkitClipPath: clip,
      filter: `drop-shadow(${sx}px ${sy}px 1.3px rgba(40,26,14,0.42))`,
    };
  };
  return (
    <>
      <div style={mount('top', 'left')} />
      <div style={mount('top', 'right')} />
      <div style={mount('bottom', 'left')} />
      <div style={mount('bottom', 'right')} />
    </>
  );
}


// ─── Bloque del esqueleto de carga ──────────────────────────
// Ocupa el sitio de lo que SÍ depende de la query de libros (portadas,
// títulos, fichas) mientras el marco de la página ya está pintado.
// El brillo que lo recorre vive en styles/biblioteca.css (.bib-skel).
function Skel({ w = '100%', h = 14, r = 10, style }) {
  return <div className="bib-skel" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}


// ── Ancho del contenedor ────────────────────────────────────
// Los spotlights del Swimlane viven en una columna cuyo ancho NO es
// el del viewport (es `flex:3` de la fila superior, ~60%), así que una
// media query no sirve: hay que medir la caja real. Devuelve [ref, w];
// w vale 0 hasta el primer layout, y los consumidores tratan ese 0
// como "todavía no sé" quedándose con la variante completa.
function useAnchoContenedor() {
  const ref = React.useRef(null)
  const [ancho, setAncho] = React.useState(0)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setAncho(el.clientWidth)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, ancho]
}

export { inmTint, hashOf, spineColor, spineW, spineH, BookCover, CornerMounts, Skel, useAnchoContenedor, INK };
