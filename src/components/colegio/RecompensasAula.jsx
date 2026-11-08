// Pestaña «Recompensas» del Salón (migración 095, maqueta 5YpgxrcjrXGv2QGQo5SLAX).
//   Izquierda: los vales del profe (encender/apagar, borrar si nadie lo
//   canjeó) y el formulario para crear uno, con la referencia de cuántos
//   ovillos junta un alumno en el libro.
//   Derecha: lo que tiene que entregar (o devolver), los expedientes de
//   Inmersia (cuántos lo abrieron, sin nombres) y lo resuelto en 30 días.
// Los vales se pagan con los ovillos del libro que lee el aula.
import { useState } from 'react'
import { useRecompensasAula, useGestionRecompensas } from '../../hooks/useRecompensas.js'
import { LIMITES, textoLimite, sinPrefijo } from '../../utils/recompensas.js'
import { iniciales, fechaCorta } from './graficos.jsx'

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

export default function RecompensasAula({ aulaId, libroTitulo }) {
  const { data: d, isLoading, isError } = useRecompensasAula(aulaId)
  const g = useGestionRecompensas(aulaId)
  const [fallo, setFallo] = useState(null)

  const hacer = async (m, args) => {
    setFallo(null)
    try { await m.mutateAsync(args) } catch (e) { setFallo(e?.message || 'No se pudo guardar. Prueba otra vez.') }
  }

  if (isLoading) return <p className="com-dd-msg">Cargando las recompensas…</p>
  if (isError || !d) return <p className="com-dd-msg">No pudimos cargar las recompensas. Revisa tu conexión.</p>

  return (
    <div className="col-grid-2 rcp">
      <div className="col-columna">
        <section className="col-tarjeta">
          <h3>Tus recompensas</h3>
          <p className="col-sub">Las ve toda la clase en la tienda, la de la izquierda en la calle. Las apagas sin borrarlas.</p>
          {d.recompensas.length === 0
            ? <p className="col-vacio col-vacio-bloque">Todavía no hay ninguna. Crea la primera aquí abajo.</p>
            : <div className="rcp-lista">
                {d.recompensas.map(r => (
                  <div key={r.id} className={`rcp-rec ${r.activa ? '' : 'is-off'}`}>
                    <div className="rcp-rec-txt"><b>{r.titulo}</b><small>{textoLimite(r.limite)}</small></div>
                    <span className="rcp-precio">{plural(r.precio, 'ovillo', 'ovillos')}</span>
                    <small className="rcp-n">{plural(r.canjes, 'canje', 'canjes')}</small>
                    <button type="button" role="switch" aria-checked={r.activa} aria-label={`${r.titulo}: en la tienda`}
                      className={`rcp-sw ${r.activa ? 'is-on' : ''}`} disabled={g.activar.isPending}
                      onClick={() => hacer(g.activar, { p_recompensa: r.id, p_activa: !r.activa })}><span /></button>
                    {r.canjes === 0 && (
                      <button type="button" className="rcp-borrar" aria-label={`Borrar «${r.titulo}»`} title="Borrar"
                        disabled={g.borrar.isPending}
                        onClick={() => window.confirm(`¿Borrar «${r.titulo}»?`) && hacer(g.borrar, { p_recompensa: r.id })}>×</button>
                    )}
                  </div>
                ))}
              </div>}
        </section>

        <NuevaRecompensa aulaId={aulaId} d={d} libroTitulo={libroTitulo} crear={g.crear} onFallo={setFallo} />
        {fallo && <p className="rcp-fallo" role="alert">{fallo}</p>}
      </div>

      <div className="col-columna">
        <section className="col-tarjeta">
          <h3>Por entregar {d.pendientes.length > 0 && <span className="col-tag naranja">{d.pendientes.length}</span>}</h3>
          <p className="col-sub">Lo que canjearon y todavía no les diste. Si no puedes darlo, «Devolver» les regresa los ovillos.</p>
          {d.pendientes.length === 0
            ? <p className="col-vacio col-vacio-bloque">Nada pendiente.</p>
            : <div className="rcp-canjes">
                {d.pendientes.map(c => (
                  <div key={c.id} className="rcp-cj">
                    <span className="col-alerta-ini" aria-hidden="true">{iniciales(c.alumno)}</span>
                    <div className="rcp-cj-txt"><b>{c.alumno}</b><span>{c.titulo} · {fechaCorta(c.fecha)}</span></div>
                    <div className="rcp-cj-btns">
                      <button type="button" className="com-btn sm" disabled={g.resolver.isPending}
                        onClick={() => hacer(g.resolver, { p_canje: c.id, p_estado: 'devuelto' })}>Devolver</button>
                      <button type="button" className="com-btn sm solid" disabled={g.resolver.isPending}
                        onClick={() => hacer(g.resolver, { p_canje: c.id, p_estado: 'entregado' })}>Entregado</button>
                    </div>
                  </div>
                ))}
              </div>}
        </section>

        <section className="col-tarjeta">
          <h3>Expedientes de Inmersia</h3>
          <p className="col-sub">Los pone Inmersia para cada libro: el autor, la época. No hace falta que hagas nada.</p>
          {d.expedientes.length === 0
            ? <p className="col-vacio col-vacio-bloque">Este libro todavía no tiene expedientes.</p>
            : d.expedientes.map(x => (
                <div key={x.id} className="rcp-exp">
                  <span>{sinPrefijo(x.titulo)}</span>
                  <small>{x.abrieron} de {d.alumnos} lo abrieron</small>
                </div>
              ))}
        </section>

        {d.entregados.length > 0 && (
          <section className="col-tarjeta">
            <h3>Entregados</h3>
            <p className="col-sub">Últimos 30 días.</p>
            <div className="rcp-canjes">
              {d.entregados.map(c => (
                <div key={c.id} className="rcp-cj">
                  <span className="col-alerta-ini" aria-hidden="true">{iniciales(c.alumno)}</span>
                  <div className="rcp-cj-txt"><b>{c.alumno}</b><span>{c.titulo} · {fechaCorta(c.fecha)}</span></div>
                  <span className={`col-estado ${c.estado === 'entregado' ? 'ok' : 'warn'}`}>
                    {c.estado === 'entregado' ? 'Entregado' : 'Devuelto'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function NuevaRecompensa({ aulaId, d, libroTitulo, crear, onFallo }) {
  const [titulo, setTitulo] = useState('')
  const [precio, setPrecio] = useState('20')
  const [limite, setLimite] = useState('alumno')
  const n = Number(precio)
  const valido = titulo.trim().length >= 3 && Number.isInteger(n) && n >= 1 && n <= 999

  const enviar = async (e) => {
    e.preventDefault()
    if (!valido) return
    onFallo(null)
    try {
      await crear.mutateAsync({ p_aula: aulaId, p_titulo: titulo.trim(), p_precio: n, p_limite: limite })
      setTitulo('')
    } catch (err) { onFallo(err?.message || 'No se pudo crear. Prueba otra vez.') }
  }

  return (
    <section className="col-tarjeta">
      <h3>Nueva recompensa</h3>
      <p className="col-sub">Algo que puedas dar tú en clase.</p>
      <form className="rcp-form" onSubmit={enviar}>
        <label>Qué es
          <input type="text" value={titulo} maxLength={120} onChange={e => setTitulo(e.target.value)}
            placeholder="Ej.: entregar la tarea un día después" />
        </label>
        <div className="rcp-fila">
          <label>Precio en ovillos
            <input type="number" inputMode="numeric" min="1" max="999" value={precio} onChange={e => setPrecio(e.target.value)} />
          </label>
          <label>Cuántas veces
            <select value={limite} onChange={e => setLimite(e.target.value)}>
              {LIMITES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </label>
        </div>
        {d.referencia && (
          <p className="rcp-ref">
            Como referencia: en <i>{libroTitulo}</i> un alumno junta <b>{d.referencia.solo_leyendo} ovillos solo leyendo</b>
            {d.referencia.jugando > d.referencia.solo_leyendo && <> y <b>hasta unos {d.referencia.jugando}</b> si juega a todo y le va bien</>}.
            Gastar en un juego también cuenta: nadie llega con todo.
          </p>
        )}
        <button type="submit" className="com-btn solid rcp-agregar" disabled={!valido || crear.isPending}>
          {crear.isPending ? 'Agregando…' : 'Agregar a la tienda'}
        </button>
      </form>
    </section>
  )
}
