// La repisa del estudio (maqueta, pantallas 1 y 3): los libros del
// escritor sobre la balda y, al final, el hueco punteado para agregar otro.
// El libro elegido lleva el contorno naranja; debajo se ven sus herramientas.

/**
 * @param {object} props
 * @param {{ id: string, titulo: string, autor: string, portada_url: string|null }[]} props.libros
 * @param {boolean} props.cargando
 * @param {string|undefined} props.elegidoId
 * @param {(id: string) => void} props.onElegir
 * @param {() => void} props.onAgregar
 */
export default function Repisa({ libros, cargando, elegidoId, onElegir, onAgregar }) {
  return (
    <div className="esc-mueble">
      <div className="esc-balda">
        {!cargando && libros.map(l => (
          <button key={l.id} type="button"
            className={'esc-libro' + (l.id === elegidoId ? ' on' : '') + (l.portada_url ? ' con-portada' : '')}
            onClick={() => onElegir(l.id)} aria-pressed={l.id === elegidoId} title={l.titulo}>
            {l.portada_url ? (
              <img src={l.portada_url} alt={l.titulo} />
            ) : (
              <>
                <div><h3>{l.titulo}</h3><small>{l.autor}</small></div>
                <div className="esc-sin-portada">Sin portada · la haces en Imágenes</div>
              </>
            )}
          </button>
        ))}
        {!cargando && (
          <button type="button" className="esc-hueco-libro" onClick={onAgregar}>
            <div><span>＋</span>{libros.length ? 'Otro libro' : 'Tu primer libro'}</div>
          </button>
        )}
      </div>
      <div className="esc-tabla" />
    </div>
  )
}
