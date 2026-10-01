import { useState, useEffect } from 'react'
import { useFichaLibro } from '../../../hooks/useFichaLibro.js'
import { imgUrl } from '../../../lib/img.js'
import { evento } from '../../../lib/analytics.js'
import { AvanceLibro } from '../../tienda/Historia.jsx'
import { PortadaSola, EtiquetasCategoria, AsiEmpieza, Teselas, Sinopsis, useAccionesFicha } from '../../tienda/fichaPiezas.jsx'
import '../../../styles/ficha.css'
import '../../../styles/ficha.mobile.css'

// =============================================================
// FichaLibroMobile · ficha de un libro en el teléfono
// Hoja a pantalla completa con el mismo contenido que FichaLibro
// (escritorio): cabecera con la escena del avance → portada y título →
// «Así empieza» → «Lo que trae en Inmersia» (tarjetas deslizables) →
// sinopsis. «Comenzar a leer» y guardar van fijos abajo.
//
// El botón Atrás de Android lo resuelve quien la monta (ver el pushState
// de CatalogoInteriorMobile): aquí solo se cierra con la X.
// Mismas props que FichaLibro.
// =============================================================

const IconoCerrar = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
)
const IconoPlay = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
)
const IconoGuardar = ({ lleno }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={lleno ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
)

export default function FichaLibroMobile({ libro, user, yaAdquirido = false, bloqueado = false, onComprar, onEmpezarLeer, onCerrar, origen = 'catalogo' }) {
  const datos = useFichaLibro(libro)
  const acciones = useAccionesFicha({ libro, user, yaAdquirido, bloqueado, onComprar, onEmpezarLeer, origen })
  const [avance, setAvance] = useState(false)

  useEffect(() => { evento('ficha_abierta', { libro: libro.slug, origen }) }, [libro.slug, origen])

  const abrirAvance = () => {
    evento('avance_abierto', { libro: libro.slug, origen: 'ficha' })
    setAvance(true)
  }
  const cabecera = datos.imagenCabecera
    ? { backgroundImage: `url("${imgUrl(datos.imagenCabecera, { width: 800 })}")` }
    : { background: libro.color || 'var(--brown-mid)' }

  return (
    <div className="flm" role="dialog" aria-modal="true" aria-labelledby="flm-titulo">
      <div className="flm-scroll">
        <div className="flm-cabecera" style={cabecera}>
          {datos.sala && <span className="flm-sala">{datos.sala.nombre}</span>}
          <button type="button" className="flm-cerrar" onClick={onCerrar} aria-label="Cerrar la ficha"><IconoCerrar /></button>
          {datos.escenas.length > 0 && (
            <button type="button" className="flm-avance" onClick={abrirAvance}>
              <i><IconoPlay /></i>Ver avance
            </button>
          )}
        </div>

        <div className="flm-fila">
          <PortadaSola libro={libro} ancho={112} />
          <div>
            <h2 id="flm-titulo" className="flm-titulo">{libro.titulo}</h2>
            <p className="flm-autor">{libro.autor}{datos.anio ? ` · ${datos.anio}` : ''}</p>
          </div>
        </div>
        <div className="flm-bloque"><EtiquetasCategoria categorias={libro.categorias} /></div>

        <div className="flm-bloque"><AsiEmpieza texto={datos.primeraLinea} /></div>
        <div className="flm-bloque flm-trae"><Teselas teselas={datos.teselas} deslizable /></div>
        <div className="flm-bloque flm-sinopsis"><Sinopsis entrada={datos.sinopsis.entrada} resto={datos.sinopsis.resto} corte={240} /></div>
      </div>

      <div className="flm-barra">
        <div className="flm-barra-fila">
          <button type="button" className="fp-btn fp-btn-leer" onClick={acciones.comenzar} disabled={acciones.comenzarDeshabilitado}>
            <IconoPlay size={14} /> Comenzar a leer
          </button>
          <button type="button" className="flm-guardar" onClick={acciones.guardar} disabled={acciones.guardarDeshabilitado}
            aria-label={yaAdquirido ? 'Ya está en tu biblioteca' : 'Añadir a mi biblioteca'}>
            <IconoGuardar lleno={yaAdquirido} />
          </button>
        </div>
        {acciones.aviso && <p className="fp-aviso">{acciones.aviso}</p>}
      </div>

      {avance && (
        <AvanceLibro
          libro={libro}
          movil
          onCerrar={() => setAvance(false)}
          onComenzar={acciones.comenzar}
          comenzarDeshabilitado={acciones.comenzarDeshabilitado}
        />
      )}
    </div>
  )
}
