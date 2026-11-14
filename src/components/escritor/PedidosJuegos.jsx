// Pedidos de juegos de los escritores — solo superusuario (Juan).
// Ruta /escritor/pedidos. El aviso de cada pedido nuevo te salta en el PC
// (worker_escritor.py); aquí los mueves: «Empezar» → «Listo», o «Cancelar»
// con una nota para el escritor (le devuelve el dinero, migración 113).
// Para prepararlos: /juegos-ficcion o /juegos-noficcion sobre la carpeta
// Documents/escritores/<libro_id>/ que baja el worker.
import { useState } from 'react'
import { useTodosPedidosJuegos, useActualizarPedidoJuego, mensajeErrorEscritor } from '../../hooks/useEscritor.js'
import { JUEGOS_FIC, JUEGOS_NOF, ESTADOS_JUEGO } from './SalaJuegos.jsx'
import '../../styles/escritor.css'

const NOMBRE = Object.fromEntries([...JUEGOS_FIC, ...JUEGOS_NOF].map(j => [j.id, j.nombre]))
const fecha = (iso) => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * @param {object} props
 * @param {boolean} props.isSuperuser
 * @param {() => void} props.onGoBack
 */
export default function PedidosJuegos({ isSuperuser, onGoBack }) {
  const { data: pedidos = [], isLoading } = useTodosPedidosJuegos(isSuperuser)
  const actualizar = useActualizarPedidoJuego()
  const [verCerrados, setVerCerrados] = useState(false)
  const [error, setError] = useState('')
  // Sin redirigir: el permiso llega un momento después de abrir la página.
  if (!isSuperuser) return <div className="esc-page"><main className="esc-rincon esc-pedidos"><p className="esc-gris">Solo para administración.</p></main></div>

  const mover = async (p, estado) => {
    let nota = null
    if (estado === 'cancelado') {
      nota = window.prompt('¿Por qué no se puede? (lo verá el escritor; se le devuelve el dinero)')
      if (nota === null) return
    }
    setError('')
    try { await actualizar.mutateAsync({ id: p.id, estado, nota }) } catch (e) { setError(mensajeErrorEscritor(e, 'No se pudo cambiar.')) }
  }
  const lista = pedidos.filter(p => verCerrados || ['pedido', 'en_curso'].includes(p.estado))

  return (
    <div className="esc-page">
      <main className="esc-rincon esc-pedidos">
        <button type="button" className="esc-volver esc-volver-oscuro" onClick={onGoBack}>← Volver</button>
        <h1>Pedidos de juegos</h1>
        <p className="esc-letra">Los prepara Juan con las skills sobre la carpeta <code>Documents/escritores/&lt;libro_id&gt;/</code>. Cancelar devuelve el dinero al escritor.</p>
        <label className="esc-letra"><input type="checkbox" checked={verCerrados} onChange={(e) => setVerCerrados(e.target.checked)} /> Ver también listos y cancelados</label>
        {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
        {isLoading ? <p className="esc-gris">Cargando…</p> : lista.length === 0 ? <p className="esc-gris">No hay pedidos pendientes.</p> : (
          <table className="esc-tabla-pedidos">
            <thead><tr><th>Libro</th><th>Juego</th><th>Pedido</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {lista.map(p => (
                <tr key={p.id}>
                  <td><b>{p.libro?.titulo || '—'}</b><small>{p.libro?.autor} · {p.libro?.es_ficcion ? 'ficción' : 'no ficción'}<br /><code>{p.libro_id}</code></small></td>
                  <td>{NOMBRE[p.juego] || p.juego}</td>
                  <td>{fecha(p.creado)}</td>
                  <td>{ESTADOS_JUEGO[p.estado]}{p.nota && <small>{p.nota}</small>}</td>
                  <td className="esc-fila-botones">
                    {p.estado === 'pedido' && <button type="button" className="esc-pill esc-chica" disabled={actualizar.isPending} onClick={() => mover(p, 'en_curso')}>Empezar</button>}
                    {['pedido', 'en_curso'].includes(p.estado) && <button type="button" className="esc-pill esc-naranja esc-chica" disabled={actualizar.isPending} onClick={() => mover(p, 'listo')}>Listo</button>}
                    {['pedido', 'en_curso', 'listo'].includes(p.estado) && <button type="button" className="esc-borrar" disabled={actualizar.isPending} onClick={() => mover(p, 'cancelado')}>Cancelar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
