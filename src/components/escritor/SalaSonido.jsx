// Sala de sonido (maqueta, pantalla 4; fondo = estudio de grabación).
// Dos caminos para un libro de ficción (nombres de Juan, 13 nov):
//   · Sonidos con Inmersia — el servicio (fase 2b, migración 105): un trabajo «sonido» en
//     la cola. Se reserva el máximo del cupón y, al terminar, se cobra solo
//     el análisis + los sonidos NUEVOS; lo demás vuelve al saldo.
//   · Edita a tu antojo: abre el libro con el panel de sonidos (fase 2a), gratis.
// Precios: precios_escritor() en la base (la misma cifra que cobra).
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queries.js'
import { usePreciosEscritor, useTrabajoSonido, usePedirSonido, mensajeErrorEscritor } from '../../hooks/useEscritor.js'

const dinero = (n) => `${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`

/**
 * @param {object} props
 * @param {{ id: string }} props.user
 * @param {{ id: string, slug: string, titulo: string, capitulos: number }} props.libro
 * @param {number} props.saldo          saldo del cupón
 * @param {() => void} props.onVolver
 * @param {() => void} props.onAbrirLibro
 */
export default function SalaSonido({ user, libro, saldo, onVolver, onAbrirLibro }) {
  const qc = useQueryClient()
  const { data: precios } = usePreciosEscritor()
  const { data: trabajo, isLoading } = useTrabajoSonido(libro.id)
  const pedir = usePedirSonido(user?.id, libro.id)
  const [maxEfectos, setMaxEfectos] = useState(5)
  const [ambientes, setAmbientes] = useState(true)
  const [error, setError] = useState('')
  const [otraVez, setOtraVez] = useState(false)

  // Al terminar, la base ya devolvió lo que sobró: refrescar el saldo.
  const estado = trabajo?.estado
  useEffect(() => {
    if (estado === 'hecho' || estado === 'error') qc.invalidateQueries({ queryKey: queryKeys.escritor(user?.id) })
  }, [estado, qc, user?.id])

  const enMarcha = estado === 'pendiente' || estado === 'en_proceso'
  const analisis = Number(precios?.sonido_analisis ?? 0)
  const porSonido = Number(precios?.sonido_nuevo ?? 0)
  const tope = Number(precios?.sonido_max_efectos ?? 12)
  const maxNuevos = libro.capitulos * maxEfectos
  const total = analisis + maxNuevos * porSonido
  const alcanza = saldo >= total

  const pedirSonido = async () => {
    setError('')
    try {
      await pedir.mutateAsync({ maxEfectos, ambientes })
      setOtraVez(false)
    } catch (e) {
      setError(mensajeErrorEscritor(e, 'No pudimos pedirlo. Revisa tu conexión e inténtalo de nuevo.'))
    }
  }

  const mostrarFormulario = !isLoading && !enMarcha && (estado !== 'hecho' || otraVez)

  return (
    <div className="esc-estudio">
      <div className="esc-estudio-in">
        <div>
          <button type="button" className="esc-volver" onClick={onVolver}>← Volver al estudio</button>
          <h1>Sala de sonido</h1>
          <p className="esc-estudio-sub">{libro.titulo} · {libro.capitulos} capítulos</p>

          {enMarcha && <EnMarcha trabajo={trabajo} />}
          {estado === 'hecho' && !otraVez && (
            <Listo trabajo={trabajo} onAbrirLibro={onAbrirLibro} onOtraVez={() => setOtraVez(true)} />
          )}
          {estado === 'error' && !otraVez && (
            <div className="esc-vidrio esc-estado-error">
              <h2>No pudimos terminar</h2>
              <p>{trabajo.error || 'Algo falló.'} Puedes volver a intentarlo.</p>
            </div>
          )}

          {mostrarFormulario && (
            <section className="esc-vidrio">
              <h2>Sonidos con Inmersia</h2>
              <p>Leemos tu libro y le ponemos efectos y ambientes por ti.</p>
              <div className="esc-etapas">
                <div className="esc-etapa"><div className="esc-num">1</div>
                  <div><h3>Análisis</h3><p>Leemos cada capítulo y marcamos dónde suena qué: una puerta, la lluvia, un disparo.</p></div>
                  <span className="esc-chip">Siempre</span></div>
                <div className="esc-etapa"><div className="esc-num">2</div>
                  <div><h3>Efectos</h3><p>Usamos los que ya tenemos en la biblioteca de Inmersia y creamos los que falten.</p></div>
                  <span className="esc-chip">Siempre</span></div>
                <label className="esc-etapa"><div className="esc-num">3</div>
                  <div><h3>Ambientes</h3><p>Un fondo continuo por tramos: mar, bosque, taberna… de nuestro catálogo.</p></div>
                  <input type="checkbox" checked={ambientes} onChange={(e) => setAmbientes(e.target.checked)} /></label>
              </div>

              <div className="esc-control">
                <div className="esc-control-fila">
                  <label htmlFor="esc-max">Máximo de efectos por capítulo</label>
                  <output htmlFor="esc-max">{maxEfectos}</output>
                </div>
                <input id="esc-max" type="range" min="1" max={tope} value={maxEfectos}
                  onChange={(e) => setMaxEfectos(Number(e.target.value))} />
                <small>Es un tope: si un capítulo no lo pide, lleva menos. Menos efectos = lectura más tranquila.</small>
              </div>

              <table className="esc-cuenta"><tbody>
                <tr><td>Análisis <span className="esc-gris">· {libro.capitulos} capítulos</span></td><td>{dinero(analisis)}</td></tr>
                <tr><td>Efectos nuevos <span className="esc-gris">· hasta {maxNuevos} × {dinero(porSonido)}</span></td><td>hasta {dinero(maxNuevos * porSonido)}</td></tr>
                <tr><td>Ambientes <span className="esc-gris">· del catálogo</span></td><td>{ambientes ? 'incluido' : '—'}</td></tr>
                <tr className="esc-cupon"><td>Cupón de bienvenida</td><td>−{dinero(Math.min(total, saldo))}</td></tr>
                <tr className="esc-total"><td>Pagas hoy</td><td>{dinero(Math.max(0, total - saldo))}</td></tr>
              </tbody></table>
              <div className="esc-cupon-caja">🎟 <span>Cupón de bienvenida · te quedan <b>{dinero(saldo)}</b></span></div>
              <p className="esc-letra">Solo cuentan los efectos que haya que crear. Los que ya existen en nuestra biblioteca no se cobran, así que lo normal es que salga bastante menos: reservamos el máximo y te devolvemos lo que no se use.</p>
              {!alcanza && <p className="esc-letra esc-falta">Tu cupón no alcanza para este tope. Bájalo o pon los sonidos a mano, que es gratis.</p>}
              {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
              <button type="button" className="esc-pill esc-naranja esc-grande esc-ancho" disabled={!precios || !alcanza || pedir.isPending}
                onClick={pedirSonido}>
                {pedir.isPending ? 'Pidiendo…' : 'Ponerle sonido a mi libro'}
              </button>
              {estado === 'hecho' && <p className="esc-letra">Si lo repites, los sonidos nuevos se suman a los que ya tiene.</p>}
            </section>
          )}
          <section className="esc-vidrio esc-a-mano">
            <div>
              <h2>Edita a tu antojo</h2>
              <p>Abre tu libro y pon, cambia o quita cada efecto y cada ambiente, de nuestra biblioteca. Gratis y sin límite.</p>
            </div>
            <button type="button" className="esc-pill" onClick={onAbrirLibro}>Abrir mi libro</button>
          </section>
        </div>

        <div className="esc-der-estudio">
          <div className="esc-bocadillo">
            {enMarcha
              ? 'Puedes cerrar esta ventana. Cuando termine, tu libro ya sonará.'
              : 'Cuando termine, abre tu libro: lo verás como tus lectores y puedes cambiar cualquier sonido que no te guste.'}
          </div>
          <img src="/assets/landing/gatos/blanco-6.webp" alt="" />
        </div>
      </div>
    </div>
  )
}

function EnMarcha({ trabajo }) {
  const p = trabajo.progreso
  const pct = p?.paso && p?.de ? Math.round(((p.paso - 1) / p.de) * 100 + 100 / p.de / 2) : 4
  return (
    <section className="esc-vidrio">
      <h2>{trabajo.estado === 'pendiente' ? 'En la cola' : 'Poniéndole sonido a tu libro'}</h2>
      <p>
        {trabajo.estado === 'pendiente'
          ? 'Empezamos en cuanto podamos. Puede tardar un rato: puedes cerrar esta ventana.'
          : `Paso ${p?.paso ?? 1} de ${p?.de ?? '…'}: ${p?.texto ?? 'empezando'}…`}
      </p>
      <div className="esc-riel"><i style={{ width: `${trabajo.estado === 'pendiente' ? 2 : pct}%` }} /></div>
      <p className="esc-letra">Reservado de tu cupón: {dinero(trabajo.reservado)}. Al terminar te devolvemos lo que no se use.</p>
    </section>
  )
}

function Listo({ trabajo, onAbrirLibro, onOtraVez }) {
  const r = trabajo.resultado || {}
  return (
    <section className="esc-vidrio">
      <h2>¡Tu libro ya suena!</h2>
      <p>
        {r.efectos ?? 0} efectos colocados ({r.nuevos ?? 0} creados para tu libro, {r.reutilizados ?? 0} de nuestra biblioteca)
        {r.capitulos_con_ambiente ? ` y ambiente en ${r.capitulos_con_ambiente} capítulos` : ''}.
        {' '}Se cobraron {dinero(trabajo.costo)} de tu cupón.
      </p>
      <div className="esc-fila-botones">
        <button type="button" className="esc-pill esc-naranja" onClick={onAbrirLibro}>Ver mi libro con sonido</button>
        <button type="button" className="esc-pill esc-plana" onClick={onOtraVez}>Hacerlo otra vez</button>
      </div>
    </section>
  )
}
