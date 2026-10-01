import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { useHistoria, ANCHO_ESCENA } from '../../hooks/useHistoria.js'
import { useLibroReelsQuery } from '../../lib/queries.js'
import { imgUrl } from '../../lib/img.js'
import '../../styles/historia.css'

// =============================================================
// Historia · el avance de un libro contado en escenas (formato 9:16)
// Sustituye a LibroReel. Un mismo núcleo para:
//   · el avance que se abre desde la ficha (AvanceLibro, abajo)
//   · el panel de la sala en escritorio y la pantalla completa en móvil
//     (fases 3 y 5 del plan de la tienda)
//
// Se monta con key={libro.id}: cambiar de libro = historia nueva.
//
// Props de Historia:
//   libro      · fila de `libros`
//   escenas    · filas de libro_reels (ya cargadas)
//   pausada    · congela avance y audio (la ficha la tapa)
//   onCerrar   · muestra la X si viene
//   lateral    · botones de la columna derecha (móvil, sala)
//   children   · acciones de abajo (Comenzar a leer, Desliza…)
//   alSalir    · al desmontarse, con { escenasVistas, deTotal } (analítica)
// =============================================================

const IconoCerrar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12" /><path d="M18 6L6 18" />
  </svg>
)

export default function Historia({ libro, escenas, pausada = false, onCerrar, lateral, children, className, alSalir }) {
  const { escena, total, actual, siguiente, anterior } = useHistoria(escenas, { pausada })

  // Hasta qué escena llegó, para contarlo al salir (cambiar de libro o cerrar).
  const visto = useRef({ max: 0, total: 0 })
  useEffect(() => { visto.current = { max: Math.max(visto.current.max, escena), total } }, [escena, total])
  const alSalirRef = useRef(alSalir)
  useEffect(() => { alSalirRef.current = alSalir })
  useEffect(() => () => {
    if (visto.current.total) alSalirRef.current?.({ escenasVistas: visto.current.max + 1, deTotal: visto.current.total })
  }, [])

  if (!actual) return null
  const categorias = (libro.categorias || []).join(', ')

  return (
    <div className={clsx('hist', className)}>
      <img key={escena} className="hist-escena" src={imgUrl(actual.imagen_url, { width: ANCHO_ESCENA })} alt={actual.titulo || ''} />
      <div className="hist-sombra" />

      <div className="hist-segs" aria-hidden="true">
        {escenas.map((_, i) => (
          <i key={i} className={clsx(i < escena && 'hecho', i === escena && !pausada && 'ahora', i === escena && pausada && 'hecho')}>
            <b key={i === escena ? escena : undefined} />
          </i>
        ))}
      </div>

      {onCerrar && (
        <button type="button" className="hist-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <IconoCerrar />
        </button>
      )}

      {/* Toques tipo stories en la mitad de arriba: izquierda atrás, derecha adelante */}
      <button type="button" className="hist-toque hist-toque-izq" onClick={anterior} aria-label="Escena anterior" />
      <button type="button" className="hist-toque hist-toque-der" onClick={siguiente} aria-label="Escena siguiente" />

      {lateral && <div className="hist-lateral">{lateral}</div>}

      <div className="hist-pie">
        {actual.titulo && <h3 className="hist-titulo">{actual.titulo}</h3>}
        {actual.subtexto && <p className="hist-sub">{actual.subtexto}</p>}
        <div className="hist-libro">
          {libro.portada_url && <img src={imgUrl(libro.portada_url, { width: 80 })} alt="" />}
          <span>
            <b>{libro.titulo}</b>
            <span>{libro.autor}{categorias ? ` · ${categorias}` : ''}</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}

const IconoPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
)

/**
 * El avance que se abre desde la ficha: la historia sobre un velo, con
 * «Comenzar a leer» abajo. En escritorio va centrada en 9:16; en móvil
 * (`movil`) ocupa la pantalla. La tecla Escape la gestiona la ficha (ver
 * FichaLibro): así cierra solo el avance y no las dos capas a la vez.
 */
export function AvanceLibro({ libro, onCerrar, onComenzar, comenzarDeshabilitado = false, movil = false }) {
  const { data: escenas = [], isLoading } = useLibroReelsQuery(libro.id)

  // Mientras el avance está abierto, la página de atrás no se desplaza.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const cerrarFuera = (e) => { if (e.target === e.currentTarget) onCerrar() }

  return (
    <div className={clsx('hist-velo', movil && 'hist-velo-movil')} onClick={cerrarFuera} role="dialog" aria-modal="true" aria-label={`Avance de ${libro.titulo}`}>
      <div className="hist-marco">
        {isLoading ? (
          <p className="hist-estado">Cargando avance…</p>
        ) : escenas.length === 0 ? (
          <div className="hist-estado">
            <p>Aún no hay avance para este libro.</p>
            <button type="button" className="hist-btn-sec" onClick={onCerrar}>Volver</button>
          </div>
        ) : (
          <Historia key={libro.id} libro={libro} escenas={escenas} onCerrar={onCerrar}>
            <button type="button" className="hist-btn-leer" onClick={onComenzar} disabled={comenzarDeshabilitado}>
              <IconoPlay /> Comenzar a leer
            </button>
          </Historia>
        )}
      </div>
    </div>
  )
}
