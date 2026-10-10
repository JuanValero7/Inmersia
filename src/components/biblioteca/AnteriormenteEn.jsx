import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { imgUrl, preloadImages } from '../../lib/img.js'
import { evento } from '../../lib/analytics.js'
import { useRepasoQuery } from '../../lib/queries.js'
import { ANCHO_ESCENA } from '../../hooks/useHistoria.js'
import { MANUAL_LIBRO_ID } from './constants.js'
import '../../styles/historia.css'
import '../../styles/repaso.css'

// =============================================================
// «Anteriormente en…» · repaso de los últimos capítulos terminados,
// desde la ficha de la Biblioteca (BibBookModal y BibBookSheet).
// Datos: useRepasoQuery (lib/queries.js). Mockup aprobado el 2 oct 2026:
// https://claude.ai/artifact/Wguved16rVvL6pf5DsWBwe
//
//   AvisoAnteriormente · la fila de la ficha, debajo de Foro y Cuaderno.
//     Discreta; tarjeta destacada si lleva DIAS_DESTACADO días sin leer.
//   RepasoHistorias · las stories. Reusa el aspecto del avance de la
//     Tienda (historia.css) sin tocar Historia.jsx: aquí no hay avance
//     automático ni audio. Se pasa con flechas (escritorio, también las
//     del teclado) o tocando a izquierda/derecha. Escape lo gestiona la
//     ficha, que cierra primero las stories.
// =============================================================

export const DIAS_DESTACADO = 5

/**
 * Lo que la ficha necesita: los capítulos del repaso y si las stories
 * están abiertas. `hay` = false → la ficha no pinta el aviso (ningún
 * capítulo terminado, libro al 100 %, Manual o sin datos aún).
 */
export function useAnteriormente(book, user) {
  const esManual = book.id === MANUAL_LIBRO_ID
  const { data } = useRepasoQuery(user?.id, esManual ? null : book.id, book.capitulosCompletados ?? 0, book.es_ficcion !== false)
  const [abierto, setAbierto] = useState(false)
  const cerrar = useCallback(() => setAbierto(false), [])
  const capitulos = data?.capitulos || []
  const diasSinLeer = data?.diasSinLeer ?? null

  const abrir = () => {
    evento('anteriormente_abierto', {
      libro: book.slug, capitulos: capitulos.length, dias_sin_leer: diasSinLeer,
      destacado: diasSinLeer != null && diasSinLeer >= DIAS_DESTACADO,
    })
    setAbierto(true)
  }
  return { hay: capitulos.length > 0, capitulos, diasSinLeer, abierto, abrir, cerrar }
}

const IconoCerrar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12" /><path d="M18 6L6 18" />
  </svg>
)
const IconoPlay = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
)
const Flecha = ({ dir }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir < 0 ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
  </svg>
)
const IconoLugar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
  </svg>
)
const IconoPersonaje = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>
)

const rangoTexto = (caps) => {
  const a = caps[0].numero
  const b = caps[caps.length - 1].numero
  return a === b ? `el cap. ${a}` : `los caps. ${a} a ${b}`
}

// Círculo tipo story con la imagen del capítulo (papel: círculo crema).
function Anillo({ cap, size }) {
  return (
    <span className="rep-anillo" style={{ width: size, height: size }}>
      {cap.imagen
        ? <img src={imgUrl(cap.imagen, { width: size * 2 })} alt="" />
        : <span className="rep-anillo-papel" />}
    </span>
  )
}

/**
 * @param {{ titulo: string, capitulos: object[], diasSinLeer: number|null, onAbrir: () => void }} props
 */
export function AvisoAnteriormente({ titulo, capitulos, diasSinLeer, onAbrir }) {
  const destacado = diasSinLeer != null && diasSinLeer >= DIAS_DESTACADO
  const ultimos = capitulos.slice(-3)

  if (!destacado) {
    const a = capitulos[0].numero
    const b = capitulos[capitulos.length - 1].numero
    return (
      <button type="button" className="rep-aviso" onClick={onAbrir}>
        <Anillo cap={capitulos[capitulos.length - 1]} size={38} />
        <span className="rep-aviso-texto">
          <b>Anteriormente en {titulo}</b>
          <span>{a === b ? `Cap. ${a}` : `Caps. ${a} a ${b}`}</span>
        </span>
        <Flecha dir={1} />
      </button>
    )
  }

  return (
    <button type="button" className="rep-aviso-dest" onClick={onAbrir}>
      <span className="rep-aviso-dias">Hace {diasSinLeer} días que no lo abres</span>
      <span className="rep-aviso-fila">
        <span className="rep-anillos">
          {ultimos.map(c => <Anillo key={c.numero} cap={c} size={42} />)}
        </span>
        <span className="rep-aviso-texto">
          <b>Anteriormente en {titulo}</b>
          <span>Ponte al día con {rangoTexto(capitulos)} antes de seguir</span>
        </span>
        <span className="rep-aviso-play"><IconoPlay size={13} /></span>
      </span>
    </button>
  )
}

function Titulares({ titulares }) {
  if (!titulares?.length) return null
  return (
    <ul className="rep-titulares">
      {titulares.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  )
}

/**
 * @param {{ titulo: string, capitulos: object[], movil?: boolean,
 *   onCerrar: () => void, onSeguir: () => void }} props
 */
export function RepasoHistorias({ titulo, capitulos, movil = false, onCerrar, onSeguir }) {
  const [i, setI] = useState(0)
  const total = capitulos.length
  const cap = capitulos.at(i)
  const ultima = i === total - 1
  const anterior = () => setI(n => Math.max(0, n - 1))
  const siguiente = () => setI(n => Math.min(total - 1, n + 1))

  // Todas las imágenes de una vez: al pasar ya están en caché.
  useEffect(() => {
    preloadImages(capitulos.map(c => c.imagen && imgUrl(c.imagen, { width: ANCHO_ESCENA })))
  }, [capitulos])

  // Mientras está abierto, la página de atrás no se desplaza.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Flechas del teclado, solo mientras las stories están abiertas.
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowLeft') setI(n => Math.max(0, n - 1))
      else if (e.key === 'ArrowRight') setI(n => Math.min(total - 1, n + 1))
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [total])

  const cerrarFuera = (e) => { if (e.target === e.currentTarget) onCerrar() }
  const papel = cap.tipo === 'papel'
  const Icono = cap.etiqueta?.seccion === 'personajes' ? IconoPersonaje : IconoLugar

  // Hay capítulos cuyo título es solo «Capítulo N»: entonces ese va grande
  // y la etiqueta de arriba no lo repite.
  const tituloPropio = cap.titulo && !/^cap[ií]tulo\s+\d+\.?$/i.test(cap.titulo.trim())
  const nombreCap = tituloPropio ? cap.titulo : `Capítulo ${cap.numero}`
  const textoEtiqueta = tituloPropio
    ? `Capítulo ${cap.numero}${ultima ? ' · Donde lo dejaste' : ''}`
    : (ultima ? 'Donde lo dejaste' : null)
  const etiquetaCap = textoEtiqueta && <span className="rep-cap">{textoEtiqueta}</span>
  const tituloCap = <h3 className="rep-titulo">{nombreCap}</h3>
  const alSeguir = () => {
    evento('anteriormente_seguir', { capitulos: total })
    onSeguir()
  }
  const seguir = ultima && (
    <button type="button" className="hist-btn-leer" onClick={alSeguir}>
      <IconoPlay /> Seguir leyendo
    </button>
  )

  // Portal a <body>: la hoja móvil tiene transform y encerraría el velo
  // dentro de ella. Los clics siguen subiendo por el árbol de React hasta
  // la ficha, que los frena (stopPropagation) antes de su fondo.
  return createPortal(
    <div className={clsx('hist-velo', movil && 'hist-velo-movil')} onClick={cerrarFuera}
      role="dialog" aria-modal="true" aria-label={`Anteriormente en ${titulo}`}>
      <div className="rep-fila" onClick={cerrarFuera}>
        {!movil && (
          <button type="button" className="rep-flecha" onClick={anterior} disabled={i === 0} aria-label="Capítulo anterior">
            <Flecha dir={-1} />
          </button>
        )}

        <div className="hist-marco">
          <div className={clsx('hist', 'rep', `rep-${cap.tipo}`, ultima && 'rep-ultima')}>
            {cap.tipo === 'imagen' && (
              <>
                <img key={i} className="hist-escena" src={imgUrl(cap.imagen, { width: ANCHO_ESCENA })} alt="" />
                <div className="hist-sombra rep-sombra" />
              </>
            )}

            <div className="hist-segs" aria-hidden="true">
              {capitulos.map((_, n) => <i key={n} className={clsx(n <= i && 'hecho')}><b /></i>)}
            </div>

            <button type="button" className="rep-toque rep-toque-izq" onClick={anterior} aria-label="Capítulo anterior" />
            <button type="button" className="rep-toque rep-toque-der" onClick={siguiente} aria-label="Capítulo siguiente" />

            <div className="rep-cabecera">
              <span className="rep-de">
                <span>Anteriormente en</span>
                <b>{titulo}</b>
              </span>
              <button type="button" className="hist-cerrar rep-cerrar" onClick={onCerrar} aria-label="Cerrar">
                <IconoCerrar />
              </button>
            </div>

            {cap.tipo === 'infografia' && (
              <div className="rep-info-marco">
                <img key={i} src={imgUrl(cap.imagen, { width: ANCHO_ESCENA })} alt={`Infografía del capítulo ${cap.numero}`} />
              </div>
            )}

            {papel ? (
              <div className="rep-papel-cuerpo">
                <div className="rep-papel-cabeza">
                  {etiquetaCap}
                  {tituloCap}
                  <span className="rep-papel-raya" />
                </div>
                {cap.titulares.length > 0 && (
                  <div className="rep-notas">
                    {cap.titulares.map((t, n) => <div key={n} className="rep-nota">{t}</div>)}
                  </div>
                )}
                {seguir}
              </div>
            ) : (
              <div className="rep-pie">
                {cap.etiqueta && (
                  <span className={clsx('rep-etiqueta', `rep-etiqueta-${cap.etiqueta.seccion}`)}>
                    <Icono />{cap.etiqueta.nombre}
                  </span>
                )}
                <div className="rep-encabezado">
                  {etiquetaCap}
                  {tituloCap}
                </div>
                <Titulares titulares={cap.titulares} />
                {seguir}
              </div>
            )}
          </div>
        </div>

        {!movil && (
          <button type="button" className="rep-flecha" onClick={siguiente} disabled={ultima} aria-label="Capítulo siguiente">
            <Flecha dir={1} />
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}
