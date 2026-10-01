// Piezas de presentación del catálogo, compartidas entre CatalogoInterior.jsx
// (desktop) y CatalogoInteriorMobile.jsx (mobile) — antes duplicadas idénticas
// en ambos archivos.
import clsx from 'clsx'
import { itint, autorSizeClass } from './tiendaHelpers.jsx'
import CoverTitle from '../CoverTitle.jsx'
import { imgUrl } from '../../lib/img.js'

export const PG_SIZE = 15

export const TIPOS = [
  { key: 'todos',     label: 'Todos' },
  { key: 'ficcion',   label: 'Ficción' },
  { key: 'noficcion', label: 'No ficción' },
]

export function Pagination({ page, total, onChange }) {
  const totalPages = Math.ceil(total / PG_SIZE)
  if (totalPages <= 1) return null

  const nums = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) nums.push(i)
  } else if (page <= 4) {
    nums.push(1, 2, 3, 4, 5, '…', totalPages)
  } else if (page >= totalPages - 3) {
    nums.push(1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
  } else {
    nums.push(1, '…', page - 1, page, page + 1, '…', totalPages)
  }

  return (
    <div className="pg-bar">
      <button className="pg-btn" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Anterior">←</button>
      {nums.map((p, i) =>
        p === '…'
          ? <span key={`el-${i}`} className="pg-ellipsis">…</span>
          : <button key={p} className={clsx('pg-btn', p === page && 'on')} onClick={() => onChange(p)}>{p}</button>
      )}
      <button className="pg-btn" onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Siguiente">→</button>
    </div>
  )
}

// `grande`: la portada de las tarjetas del catálogo y de los carriles (150 px).
export function CoverCard({ libro, grande = false }) {
  const c = libro.color || 'var(--accent)'
  return (
    <div className={clsx('book', grande && 'book-lg')} style={{ '--cov': c }}>
      <div className="book-cover">
        {libro.portada_url
          ? <img className="book-art-img" src={imgUrl(libro.portada_url, { width: 300 })} alt={libro.titulo} loading="lazy" />
          : <div className="book-art-empty" />}
        <span className={clsx('book-scribble', autorSizeClass(libro.autor))}>{libro.autor}</span>
        <CoverTitle title={libro.titulo} />
      </div>
      <div className="book-base" />
      <div className="book-pages" />
    </div>
  )
}

// Tarjeta del catálogo: solo el libro. Título y autor ya van en la portada,
// así que no se repiten debajo (plan de la tienda, 1.5).
export function BookCard({ libro, adquirido, onOpen }) {
  const c = libro.color || '#F2792A'
  return (
    <button className={clsx('bk-card', adquirido && 'bk-card-owned')} type="button"
      title={`${libro.titulo} — ${libro.autor}`}
      aria-label={`${libro.titulo}, ${libro.autor}${adquirido ? ' (ya está en tu biblioteca)' : ''}`}
      onClick={() => onOpen(libro)}>
      {libro._nuevo && <span className="bk-ribbon">Nuevo</span>}
      <div className="bk-inner">
        {adquirido && <span className="bk-check" aria-hidden="true">✓</span>}
        <div className="bk-stage" style={{ background: `linear-gradient(180deg, ${itint(c, 0.82)}, ${itint(c, 0.66)})` }}>
          <span className="bk-glow" style={{ background: `radial-gradient(circle, ${itint(c, 0.28)}, transparent 66%)` }} />
          <span className="bk-podium" />
          <CoverCard libro={libro} grande />
          <span className="bk-shelf" />
        </div>
      </div>
    </button>
  )
}
