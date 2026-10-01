// =============================================================
// Piezas de las salas de la Tienda: el portal (la puerta con luz) y
// la tarjeta de sala. Las usan la tienda principal y el pasillo de
// cada sala. Estilos en styles/tienda-principal.css (.sp-*).
// =============================================================

// Mezcla `hex` hacia `destino` (0 = hex, 1 = destino). Devuelve rgb().
export function mezclar(hex, destino, t) {
  const rgb = (h) => {
    const n = parseInt(String(h).replace('#', ''), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const a = rgb(hex), b = rgb(destino)
  return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(',')})`
}

// YYYY-MM-DD en la hora del lector, para comparar con desde/hasta de la temporada.
function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Si una sala se puede visitar hoy: las salas siempre; la temporada solo
 * entre sus fechas. Los carriles (tipo 'carril') no son salas que se visiten.
 */
export function esVisitable(sala) {
  if (sala.tipo === 'sala') return true
  if (sala.tipo !== 'temporada') return false
  const hoy = hoyLocal()
  return (!sala.desde || sala.desde <= hoy) && (!sala.hasta || hoy <= sala.hasta)
}

// La tinta de la marca (#4a3622, --ink): de aquí salen los fondos oscuros.
const TINTA = '#2a1d14'

/** Fondo de una tarjeta de sala: su color, oscurecido para que el texto claro se lea. */
export function fondoSala(color) {
  return `linear-gradient(160deg, ${mezclar(color, TINTA, 0.25)}, ${mezclar(color, TINTA, 0.45)})`
}

/** La puerta iluminada de una sala, teñida con su color. */
export function Portal({ color, className = '' }) {
  return (
    <span className={`sp-portal ${className}`} aria-hidden="true" style={{
      background: `radial-gradient(circle at 50% 78%, ${mezclar(color, '#ffe7b0', 0.8)}, ${mezclar(color, '#ffc978', 0.45)} 42%, ${mezclar(color, '#1b120c', 0.45)} 100%)`,
      boxShadow: `inset 0 0 16px ${mezclar(color, '#ffd08a', 0.6)}, 0 0 22px rgba(255,200,120,.35)`,
    }} />
  )
}

/**
 * Tarjeta de sala: portal, nombre y «género · N libros».
 * @param {{ sala: object, numLibros: number, onAbrir: () => void, compacta?: boolean }} props
 */
export function SalaCard({ sala, numLibros, onAbrir, compacta = false }) {
  return (
    <button type="button" className={`sp-sala ${compacta ? 'sp-sala-compacta' : ''}`} onClick={onAbrir}
      style={{ background: fondoSala(sala.color) }}>
      <Portal color={sala.color} />
      <span className="sp-sala-texto">
        <b>{sala.nombre}</b>
        <span>{sala.genero ? `${sala.genero} · ` : ''}{numLibros} {numLibros === 1 ? 'libro' : 'libros'}</span>
      </span>
    </button>
  )
}
