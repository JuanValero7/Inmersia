import { useState } from 'react'
import clsx from 'clsx'
import { useOpenAuth } from '../../context/authModal.jsx'
import { evento } from '../../lib/analytics.js'
import { imgUrl } from '../../lib/img.js'
import { CAT_COLOR } from './tiendaHelpers.jsx'

// =============================================================
// Piezas de la ficha de un libro, compartidas por FichaLibro
// (escritorio) y FichaLibroMobile. Estilos en styles/ficha.css (.fp-*).
// =============================================================

const ICONOS = {
  tiempo: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  ilustraciones: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 17l-5-5-9 8" /></>,
  sonidos: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  fichas: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 4.5a3.5 3.5 0 010 7" /><path d="M18 14a6 6 0 013.5 6" /></>,
}

/** Portada sola (sin título ni autor impresos: ya están al lado). */
export function PortadaSola({ libro, ancho = 176 }) {
  return (
    <span className="fp-portada" style={{ width: ancho, background: libro.color || 'var(--accent)' }}>
      {libro.portada_url && (
        <img src={imgUrl(libro.portada_url, { width: ancho * 2 })} alt={`Portada de ${libro.titulo}`} />
      )}
    </span>
  )
}

export function EtiquetasCategoria({ categorias = [] }) {
  if (!categorias.length) return null
  return (
    <div className="fp-etiquetas">
      {categorias.map(c => (
        <span key={c} className="fp-etiqueta">
          <span className="fp-punto" style={{ background: CAT_COLOR[c] || 'var(--accent)' }} />{c}
        </span>
      ))}
    </div>
  )
}

/** «Así empieza»: plegable y abierto al entrar. */
export function AsiEmpieza({ texto }) {
  const [abierto, setAbierto] = useState(true)
  if (!texto) return null
  return (
    <figure className={clsx('fp-inicio', !abierto && 'cerrado')}>
      <button type="button" className="fp-inicio-cab" onClick={() => setAbierto(v => !v)} aria-expanded={abierto}>
        <span>Así empieza</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {abierto && <blockquote>«{texto}»</blockquote>}
    </figure>
  )
}

/** «Lo que trae en Inmersia»: solo las tarjetas con algo que contar. */
export function Teselas({ teselas, deslizable = false }) {
  if (!teselas.length) return null
  return (
    <section className="fp-trae" aria-label="Lo que trae en Inmersia">
      <h3 className="fp-h">Lo que trae en Inmersia</h3>
      <div className={clsx('fp-teselas', deslizable && 'fp-teselas-desliza')}>
        {teselas.map(t => (
          <div key={t.clave} className="fp-tesela">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONOS[t.clave]}</svg>
            <b>{t.valor}</b>
            <span>{t.texto}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Sinopsis: el gancho en negrita y el resto con «Leer más». */
export function Sinopsis({ entrada, resto, corte = 300 }) {
  const [mas, setMas] = useState(false)
  if (!entrada && !resto) return null
  const largo = resto.length > corte
  const visible = largo && !mas ? resto.slice(0, corte).replace(/\s+\S*$/, '') + '…' : resto
  return (
    <section className="fp-sinopsis">
      <h3 className="fp-h">Sinopsis</h3>
      {entrada && <p className="fp-gancho">{entrada}</p>}
      {resto && <p className="fp-texto">{visible}</p>}
      {largo && (
        <button type="button" className="fp-mas" onClick={() => setMas(v => !v)}>{mas ? 'Leer menos' : 'Leer más'}</button>
      )}
    </section>
  )
}

/**
 * Lo que hacen los botones de la ficha, igual en escritorio y móvil.
 * El límite de 5 lecturas pendientes llega como `bloqueado` (useTiendaData).
 */
export function useAccionesFicha({ libro, user, yaAdquirido, bloqueado, onComprar, onEmpezarLeer, origen }) {
  const openAuth = useOpenAuth()
  const limite = !!user && bloqueado && !yaAdquirido

  return {
    comenzar: () => {
      evento('cta_comenzar', { libro: libro.slug, origen })
      onEmpezarLeer?.()
    },
    // Un invitado no tiene biblioteca: guardar es la puerta al registro.
    guardar: () => {
      if (!user) { openAuth('registro'); return }
      onComprar?.()
    },
    comenzarDeshabilitado: limite,
    guardarDeshabilitado: yaAdquirido || limite,
    etiquetaGuardar: yaAdquirido ? '✓ Ya está en tu biblioteca' : '+ A mi biblioteca',
    aviso: limite
      ? 'Termina tus lecturas pendientes antes de sumar libros nuevos.'
      : !user ? 'Los dos primeros capítulos, sin crear cuenta.' : '',
  }
}
