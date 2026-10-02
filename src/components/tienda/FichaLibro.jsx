import { useState, useEffect, useRef } from 'react'
import { useFichaLibro } from '../../hooks/useFichaLibro.js'
import { imgUrl } from '../../lib/img.js'
import { evento } from '../../lib/analytics.js'
import { AvanceLibro } from './Historia.jsx'
import { PortadaSola, EtiquetasCategoria, AsiEmpieza, Teselas, Sinopsis, useAccionesFicha } from './fichaPiezas.jsx'
import '../../styles/ficha.css'

// =============================================================
// FichaLibro · ficha de un libro en escritorio (modal centrado)
// Sustituye a PanelLibro (plan de la tienda, 1.4). Orden:
//   cabecera con la escena del avance → portada + título + botones →
//   izquierda «Así empieza» y «Lo que trae en Inmersia», derecha sinopsis.
// Sin reseñas ni frases subrayadas: hoy no hay volumen (siguen en la
// Biblioteca, BibBookModal).
//
// Props:
//   libro        · fila de `libros` (catálogo)
//   user         · usuario auth (null = invitado)
//   yaAdquirido  · ya está en su biblioteca
//   bloqueado    · llegó al tope de lecturas pendientes
//   onComprar    · añadir a la biblioteca
//   onEmpezarLeer· comenzar a leer (con sesión lo añade antes de abrirlo)
//   onCerrar     · cerrar la ficha
//   origen       · desde dónde se abrió, para la analítica
// =============================================================

const IconoCerrar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
)
const IconoPlay = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
)

export default function FichaLibro({ libro, user, yaAdquirido = false, bloqueado = false, onComprar, onEmpezarLeer, onCerrar, origen = 'catalogo' }) {
  const datos = useFichaLibro(libro)
  const acciones = useAccionesFicha({ libro, user, yaAdquirido, bloqueado, onComprar, onEmpezarLeer, origen })
  const [avance, setAvance] = useState(false)
  // En la sala el avance ya se está viendo (la historia), así que la ficha no lo ofrece.
  const conAvance = origen !== 'sala' && datos.escenas.length > 0
  const cerrarRef = useRef(null)

  useEffect(() => { evento('ficha_abierta', { libro: libro.slug, origen }) }, [libro.slug, origen])
  useEffect(() => { cerrarRef.current?.focus() }, [])

  // Escape cierra primero el avance y, si no hay, la ficha.
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape') return
      if (avance) setAvance(false)
      else onCerrar()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [avance, onCerrar])

  const abrirAvance = () => {
    evento('avance_abierto', { libro: libro.slug, origen: 'ficha' })
    setAvance(true)
  }
  const cerrarFuera = (e) => { if (e.target === e.currentTarget) onCerrar() }
  const cabecera = datos.imagenCabecera
    ? { backgroundImage: `url("${imgUrl(datos.imagenCabecera, { width: 1200 })}")` }
    : { background: libro.color || 'var(--brown-mid)' }

  return (
    <div className="fl-velo" onClick={cerrarFuera}>
      <article className="fl" role="dialog" aria-modal="true" aria-labelledby="fl-titulo">
        <div className="fl-cabecera" style={cabecera}>
          {datos.sala && <span className="fl-sala">{datos.sala.nombre}</span>}
          <button ref={cerrarRef} type="button" className="fl-cerrar" onClick={onCerrar} aria-label="Cerrar la ficha">
            <IconoCerrar />
          </button>
          {conAvance && (
            <button type="button" className="fl-avance" onClick={abrirAvance}>
              <i><IconoPlay /></i>
              Ver el avance · {datos.escenas.length} escenas
            </button>
          )}
        </div>

        <div className="fl-fila">
          <PortadaSola libro={libro} ancho={176} />
          <div className="fl-meta">
            <h2 id="fl-titulo" className="fl-titulo">{libro.titulo}</h2>
            <p className="fl-autor">{libro.autor}{datos.anio ? ` · ${datos.anio}` : ''}</p>
            <EtiquetasCategoria categorias={libro.categorias} />
          </div>
          <div className="fl-cta">
            <button type="button" className="fp-btn fp-btn-leer" onClick={acciones.comenzar} disabled={acciones.comenzarDeshabilitado}>
              <IconoPlay size={15} /> Comenzar a leer
            </button>
            <button type="button" className="fp-btn fp-btn-guardar" onClick={acciones.guardar} disabled={acciones.guardarDeshabilitado}>
              {acciones.etiquetaGuardar}
            </button>
            {acciones.aviso && <p className="fp-aviso">{acciones.aviso}</p>}
          </div>
        </div>

        <div className="fl-cuerpo">
          <div className="fl-izq">
            <AsiEmpieza texto={datos.primeraLinea} />
            <Teselas teselas={datos.teselas} />
          </div>
          <div className="fl-der">
            <Sinopsis entrada={datos.sinopsis.entrada} resto={datos.sinopsis.resto} />
          </div>
        </div>
      </article>

      {avance && (
        <AvanceLibro
          libro={libro}
          onCerrar={() => setAvance(false)}
          onComenzar={acciones.comenzar}
          comenzarDeshabilitado={acciones.comenzarDeshabilitado}
        />
      )}
    </div>
  )
}
