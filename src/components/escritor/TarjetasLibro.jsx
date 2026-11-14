// Tarjetas del estudio (pedido de Juan, 13 nov 2026): en vez de cinco
// botones planos, una tarjeta por sala con la miniatura de su fondo.
// Mis lectores va a la derecha, con el pie en naranja. Sin cifras ni
// estados (Juan probó con «34 efectos · 12 ambientes» y no le gustó).

const MINI = '/assets/escritor/mini/'

function Tarjeta({ img, titulo, on, onClick, clase = '' }) {
  return (
    <button type="button" className={'esc-tarjeta ' + clase + (on ? ' on' : '')} onClick={onClick}>
      <span className="esc-tarjeta-img" style={{ backgroundImage: `url(${MINI}${img}.webp)` }} />
      <span className="esc-tarjeta-txt"><b>{titulo}</b></span>
    </button>
  )
}

/**
 * @param {object} props
 * @param {(sala: 'sonido'|'imagenes'|'analisis'|'juegos') => void} props.onSala
 * @param {() => void} props.onLectores
 * @param {boolean} props.infoRuidos  la tarjeta de Sonido (no ficción) está abierta
 */
export default function TarjetasLibro({ onSala, onLectores, infoRuidos }) {
  return (
    <div className="esc-tarjetas">
      <Tarjeta img="estudio" titulo="Sonido" on={infoRuidos} onClick={() => onSala('sonido')} />
      <Tarjeta img="taller" titulo="Imágenes" onClick={() => onSala('imagenes')} />
      <Tarjeta img="despacho" titulo="Análisis" onClick={() => onSala('analisis')} />
      <Tarjeta img="juegos" titulo="Juegos" onClick={() => onSala('juegos')} />
      <Tarjeta img="lectores" titulo="Mis lectores" clase="esc-tarjeta-lectores" onClick={onLectores} />
    </div>
  )
}
