// Piezas compartidas de Comunidades entre el menú de escritorio
// (ComunidadesMenu), la pantalla móvil (ComunidadesMobile) y la página
// provisional de una comunidad. Los estilos van en comunidades.css.
import { useState, useEffect } from 'react'
import { imgUrl } from '../../lib/img.js'
import { MasDenunciar } from './DenunciarComunidad.jsx'

// Valor con retraso, para no lanzar una búsqueda por cada tecla.
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

// Portada pequeña del libro de la comunidad. Sin libro elegido, un lomo
// liso del color de la marca.
export function PortadaMini({ c, grande = false }) {
  const cls = 'com-cover' + (grande ? ' grande' : '')
  if (c.libroPortada) {
    return <img className={cls} src={imgUrl(c.libroPortada, { width: grande ? 160 : 80 })} alt="" loading="lazy" />
  }
  return <span className={cls} style={{ background: c.libroColor || 'var(--accent)' }} aria-hidden="true" />
}

export function Etiquetas({ c }) {
  return (
    <span className="com-chips">
      {c.rol === 'moderador' && <span className="com-chip mod">Moderas</span>}
      <span className={'com-chip ' + (c.privada ? 'priv' : 'pub')}>{c.privada ? 'Privada' : 'Pública'}</span>
    </span>
  )
}

export function textoMiembros(n) {
  return `${n} ${n === 1 ? 'miembro' : 'miembros'}`
}

// Línea "Libro · N miembros" (el libro puede no estar elegido todavía).
export function MetaComunidad({ c }) {
  return (
    <span className="com-meta">
      {c.libroTitulo ? `${c.libroTitulo} · ` : 'Sin libro elegido · '}{textoMiembros(c.miembros)}
    </span>
  )
}

// Fila de "Mis comunidades": toda la fila es el botón para entrar.
export function FilaMiComunidad({ c, onOpen }) {
  return (
    <button type="button" className="com-row" onClick={() => onOpen(c.id)}>
      <PortadaMini c={c} />
      <span className="com-body">
        <span className="com-name">{c.nombre}</span>
        <MetaComunidad c={c} />
        <Etiquetas c={c} />
      </span>
      <span className="com-chev" aria-hidden="true">›</span>
    </button>
  )
}

// Fila de resultado del buscador, con su botón a la derecha.
//   · ya soy miembro → "Entrar"
//   · llegué al tope → "Unirme" desactivado (el aviso va debajo de la lista)
//   · onDenunciar → ⋯ con "Denunciar comunidad" (ver DenunciarComunidad.jsx)
export function FilaResultado({ c, onUnirse, onOpen, pendiente, enTope, onDenunciar }) {
  return (
    <div className="com-res">
      <PortadaMini c={c} />
      <span className="com-body">
        <span className="com-name">{c.nombre}</span>
        <MetaComunidad c={c} />
      </span>
      {c.soyMiembro
        ? <button type="button" className="com-btn sm" onClick={() => onOpen(c.id)}>Entrar</button>
        : <button type="button" className="com-btn sm" disabled={enTope || pendiente === c.id} onClick={() => onUnirse(c.id)}>
            {pendiente === c.id ? 'Uniendo…' : 'Unirme'}
          </button>}
      {onDenunciar && <MasDenunciar onDenunciar={() => onDenunciar(c)} />}
    </div>
  )
}

// ── Sello: iniciales + color, para reconocer una comunidad de un vistazo
// (botón de la barra, "Leer como", panel). El color sale del id, así que
// es estable y no hay que guardarlo.
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a', 'un', 'una'])
const COLORES_SELLO = ['#b9d3e8', '#e7b98f', '#cfe0c3', '#d8c3e3', '#f3d38c', '#a9c5c0', '#f0b8a8', '#c9d59a']

export function inicialesComunidad(nombre) {
  const palabras = (nombre || '').trim().split(/\s+/).filter(Boolean)
  const utiles = palabras.filter(p => !PALABRAS_VACIAS.has(p.toLowerCase()))
  const base = utiles.length ? utiles : palabras
  const ini = base.length >= 2 ? base[0][0] + base[base.length - 1][0] : (base[0] || '?').slice(0, 2)
  return ini.toUpperCase()
}

// Color estable a partir de un id (comunidad o persona). Tonos claros:
// el texto va en tinta encima.
export function colorDeId(id) {
  let h = 0
  for (const ch of id || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORES_SELLO.at(h % COLORES_SELLO.length)
}

export function Sello({ c, tam = 'md' }) {
  return (
    <span className={'com-sello ' + tam} style={{ background: colorDeId(c.id) }} aria-hidden="true">
      {inicialesComunidad(c.nombre)}
    </span>
  )
}

// ── Fechas ──
// 'YYYY-MM-DD' → "31 de octubre". En hora local: new Date('2026-10-31')
// lo leería en UTC y podría caer en el día anterior.
export function fechaLarga(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'long' })
}

export function fechaEncuentro(ts) {
  return new Date(ts).toLocaleString('es', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export function diaMes(ts) {
  const d = new Date(ts)
  return { dia: d.getDate(), mes: d.toLocaleDateString('es', { month: 'short' }).replace('.', '') }
}

export const IconoComunidad = (props) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...props}>
    <circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9.5" r="2.5" />
    <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15 14.3c2.6-.3 4.9 1.2 5.5 4.2" />
  </svg>
)

export const IconoLupa = (props) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...props}>
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
)
