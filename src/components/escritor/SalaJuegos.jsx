// Sala de juegos (maqueta, pantalla 8; fondo = estudio de juegos de mesa).
// Fase 5 (migración 113), decisiones de Juan (13 nov 2026):
//   · No es automático: el escritor pide, Juan los prepara con las skills y
//     marca el pedido como listo. Se le dice que tarda unos días.
//   · Tres juegos por tipo de libro (Juan, 13 nov: El concurso, El desafío del
//     gato y Explícaselo son de colegio, no para escritores).
//   · Precio por libro en escalera, acumulado: 1 = 3 $, 2 = 5,40, 3 = 7,80
//     (precios_escritor().juegos). Cancelar (mientras no
//     se haya empezado) devuelve el último escalón.
//   · Requisito: la cartelera (los juegos salen de ella).
//   · «Ver cómo es» abre la demo del juego en otra pestaña:
//     public/demos/juegos/ficcion.html y noficcion.html, con capturas reales
//     del lector en teléfono y computadora (13 nov 2026; demo.js las pinta).
//   · Listo el juego, «Revisar y editar» (114, 115): por ahora Corazonadas,
//     Cápsula y El falsificador; el resto, mismo patrón (EditoresJuegos.jsx).
import { useState } from 'react'
import EditorJuego, { JUEGOS_EDITABLES } from './EditoresJuegos.jsx'
import { useCarteleraEscritor, usePreciosEscritor, usePedidosJuegos, usePedirJuegos, useCancelarJuego, mensajeErrorEscritor } from '../../hooks/useEscritor.js'

const dinero = (n) => `${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`

export const JUEGOS_FIC = [
  { id: 'anderson', nombre: 'Método Anderson', mide: 'entender a los personajes', demo: '/demos/juegos/ficcion.html#mesa',
    texto: 'El lector arma el perfil de cada personaje con frases del libro, separando lo cierto de las pistas falsas.' },
  { id: 'corazonadas', nombre: 'Corazonadas', mide: 'anticipar e inferir', demo: '/demos/juegos/ficcion.html#corazonada',
    texto: 'En los momentos de suspenso el lector apuesta qué va a pasar. Cuando el libro lo resuelve, cobra o pierde.' },
  { id: 'mapa', nombre: 'El mapa del tesoro', mide: 'fijarse y localizar', demo: '/demos/juegos/ficcion.html#mapa',
    texto: 'Al empezar el capítulo recibe una lista de detalles que buscar. Un poco antes de cada uno, el libro brilla.' },
]
export const JUEGOS_NOF = [
  { id: 'hilo', nombre: 'Hilo de ideas', mide: 'seguir el argumento', demo: '/demos/juegos/noficcion.html#hilo',
    texto: 'Al terminar cada capítulo llegan pistas. El lector las combina para destapar las ideas del libro, hasta la conclusión.' },
  { id: 'falsificador', nombre: 'El falsificador', mide: 'leer con atención', demo: '/demos/juegos/noficcion.html#falsificador',
    texto: 'Entre párrafos reales aparece uno falso, casi igual. El lector tiene que descubrir cuál no es tuyo.' },
  { id: 'capsula', nombre: 'Cápsula del tiempo', mide: 'qué le dejó el libro', demo: '/demos/juegos/noficcion.html#capsula',
    texto: 'Preguntas de opinión al empezar y al terminar el libro. Al final ve si cambió de opinión.' },
]
export const ESTADOS_JUEGO = {
  pedido: 'Pedido · en la cola',
  en_curso: 'Lo estamos preparando',
  listo: 'Listo en tu libro',
  cancelado: 'Cancelado',
}

/**
 * @param {object} props
 * @param {{ id: string }} props.user
 * @param {{ id: string, titulo: string, capitulos: number, es_ficcion: boolean }} props.libro
 * @param {number} props.saldo
 * @param {() => void} props.onVolver
 * @param {() => void} props.onIrAnalisis
 */
export default function SalaJuegos({ user, libro, saldo, onVolver, onIrAnalisis }) {
  const { data: precios } = usePreciosEscritor()
  const { data: cartelera = [], isLoading: cargandoCartelera } = useCarteleraEscritor(libro.id)
  const { data: pedidos = [] } = usePedidosJuegos(libro.id)
  const pedir = usePedirJuegos(user?.id, libro.id)
  const cancelar = useCancelarJuego(user?.id, libro.id)
  const [marcados, setMarcados] = useState([])
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState('')
  const [editando, setEditando] = useState(null)   // juego abierto en el editor

  const juegos = libro.es_ficcion ? JUEGOS_FIC : JUEGOS_NOF
  const activos = pedidos.filter(p => p.estado !== 'cancelado')
  const estadoDe = (id) => activos.find(p => p.juego === id)
  const escalera = precios?.juegos || [0, 3, 5.4, 7.8, 9.6, 12]
  const precioN = (n) => Number(escalera[Math.min(n, escalera.length - 1)] || 0)
  const costo = precioN(activos.length + marcados.length) - precioN(activos.length)
  const hayCartelera = cartelera.length > 0

  const alternar = (id) => setMarcados(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]))
  const enviar = async () => {
    setError(''); setHecho('')
    try {
      const cobrado = await pedir.mutateAsync(marcados)
      setHecho(`Pedido hecho (${dinero(cobrado)}). Los preparamos leyendo tu libro: no es inmediato, suele tardar unos días. Aquí verás cuando estén listos.`)
      setMarcados([])
    } catch (e) {
      setError(mensajeErrorEscritor(e, 'No pudimos hacer el pedido. Inténtalo de nuevo.'))
    }
  }
  const quitar = async (p) => {
    if (!window.confirm('¿Cancelar este juego? Te devolvemos lo que costó.')) return
    setError(''); setHecho('')
    try { await cancelar.mutateAsync(p.id) } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos cancelarlo.')) }
  }

  return (
    <div className="esc-estudio esc-salajuegos">
      <div className="esc-estudio-in esc-una-col">
        <div>
          <button type="button" className="esc-volver" onClick={onVolver}>← Volver al estudio</button>
          <h1>Sala de juegos</h1>
          <p className="esc-estudio-sub">{libro.titulo} · {libro.capitulos} capítulos</p>

          <section className="esc-vidrio">
            {!cargandoCartelera && (hayCartelera ? (
              <div className="esc-requisito ok"><b>✓ Cartelera lista.</b> Los juegos salen de tu libro y de tu cartelera.</div>
            ) : (
              <div className="esc-requisito">
                <b>Primero, la cartelera.</b> Los juegos salen de tu libro y de tu cartelera, así que tiene que estar hecha.
                <button type="button" className="esc-pill esc-naranja esc-chica" onClick={onIrAnalisis}>Ir a la Sala de análisis</button>
              </div>
            ))}
            <p>Elige los juegos que tendrán tus lectores. Cada uno lo preparamos a mano leyendo tu libro entero, así que <b>no es inmediato</b>: suele tardar unos días y aquí verás cuando esté listo.</p>

            <div className="esc-juegos">
              {juegos.map(j => {
                const p = estadoDe(j.id)
                const on = marcados.includes(j.id)
                return (
                  <label key={j.id} className={'esc-juego' + (on ? ' on' : '') + (p ? ' pedido' : '')}>
                    <input type="checkbox" checked={on || !!p} disabled={!!p || !hayCartelera} onChange={() => alternar(j.id)} />
                    <div>
                      <h3>{j.nombre}</h3>
                      <p>{j.texto}</p>
                      <small>Mide: {j.mide}</small>
                      <div className="esc-fila-botones">
                        <a className="esc-ver-demo" href={j.demo} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Ver cómo es ↗</a>
                        {p && <span className={'esc-estado-juego ' + p.estado}>{p.estado === 'listo' ? '✓ ' : ''}{ESTADOS_JUEGO[p.estado]}</span>}
                        {p?.estado === 'listo' && (JUEGOS_EDITABLES.includes(j.id)
                          ? <button type="button" className="esc-pill esc-naranja esc-chica"
                            onClick={(e) => { e.preventDefault(); setEditando(j) }}>Revisar y editar</button>
                          : <span className="esc-t-nota">La edición de este juego llega pronto.</span>)}
                        {p?.estado === 'pedido' && (
                          <button type="button" className="esc-borrar" disabled={cancelar.isPending}
                            onClick={(e) => { e.preventDefault(); quitar(p) }}>Cancelar</button>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="esc-pie-tab">
              <span className="esc-gris">
                Precio por libro: 1 juego {dinero(precioN(1))}, 2 {dinero(precioN(2))}, los 3 {dinero(precioN(3))}.
                {activos.length > 0 && ` Ya tienes ${activos.length}: los nuevos se suman con el mismo descuento.`}
                {marcados.length > 0 && <> Ahora: <b>{dinero(costo)}</b> · {saldo >= costo ? 'lo cubre tu cupón' : 'tu cupón no alcanza'} (te quedan {dinero(saldo)}).</>}
              </span>
              <button type="button" className="esc-pill esc-naranja" onClick={enviar}
                disabled={!marcados.length || pedir.isPending || saldo < costo || !hayCartelera}>
                {pedir.isPending ? 'Pidiendo…' : marcados.length ? `Pedir ${marcados.length === 1 ? '1 juego' : `${marcados.length} juegos`} · ${dinero(costo)}` : 'Marca los juegos'}
              </button>
            </div>
            {hecho && <div className="esc-alerta esc-ok"><span>✓</span><span>{hecho}</span></div>}
            {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
            {activos.some(p => p.nota) && (
              <ul className="esc-vinetas">
                {activos.filter(p => p.nota).map(p => <li key={p.id}><b>{juegos.find(j => j.id === p.juego)?.nombre}:</b> {p.nota}</li>)}
              </ul>
            )}
            {pedidos.some(p => p.estado === 'cancelado' && p.nota) && (
              <ul className="esc-vinetas">
                {pedidos.filter(p => p.estado === 'cancelado' && p.nota).map(p => (
                  <li key={p.id}><b>{juegos.find(j => j.id === p.juego)?.nombre} (cancelado, te devolvimos el dinero):</b> {p.nota}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      {editando && <EditorJuego libro={libro} juego={editando.id} nombre={editando.nombre} onCerrar={() => setEditando(null)} />}
    </div>
  )
}
