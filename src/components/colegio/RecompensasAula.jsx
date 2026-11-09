// Pestaña «Recompensas» del Salón (migraciones 095 y 097, maqueta 5YpgxrcjrXGv2QGQo5SLAX).
//   Izquierda: lo que puso el profe en la tienda (vales y botes de la clase;
//   encender/apagar, borrar) y el formulario para crear uno, con la cuenta
//   de cuántos ovillos junta un alumno en el libro y precios sugeridos. El
//   precio lo pone el profe a su gusto: Inmersia solo sugiere.
//   Derecha: lo que tiene que entregar (o devolver), los expedientes de
//   Inmersia (cuántos lo abrieron, sin nombres) y lo resuelto en 30 días.
// Se paga con los ovillos del libro que lee el aula. En un bote, cada alumno
// pone lo que quiera; al llenarse le aparece al profe para entregar, y si lo
// borra antes, a cada uno se le devuelve lo suyo.
import { useState } from 'react'
import { useRecompensasAula, useGestionRecompensas } from '../../hooks/useRecompensas.js'
import {
  LIMITES, PRECIO_MAX, PARTES_OVILLOS, textoLimite, sinPrefijo, nombreJuego,
  redondear, preciosSugeridos, boteSugerido,
} from '../../utils/recompensas.js'
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
  const borrar = (r) => {
    const devolver = r.limite === 'bote' && r.juntado > 0
    const msg = devolver
      ? `¿Borrar «${r.titulo}»? A cada alumno se le devuelve lo que puso (${plural(r.juntado, 'ovillo', 'ovillos')} en total).`
      : `¿Borrar «${r.titulo}»?`
    if (window.confirm(msg)) hacer(g.borrar, { p_recompensa: r.id })
  }

  if (isLoading) return <p className="com-dd-msg">Cargando las recompensas…</p>
  if (isError || !d) return <p className="com-dd-msg">No pudimos cargar las recompensas. Revisa tu conexión.</p>

  const botesLlenos = d.botes_por_entregar ?? []
  const porEntregar = d.pendientes.length + botesLlenos.length

  return (
    <div className="col-grid-2 rcp">
      <div className="col-columna">
        <section className="col-tarjeta">
          <h3>Tus recompensas</h3>
          <p className="col-sub">Las ve toda la clase en la tienda, la de la izquierda en la calle. Las apagas sin borrarlas.</p>
          {d.recompensas.length === 0
            ? <p className="col-vacio col-vacio-bloque">Todavía no hay ninguna. Crea la primera aquí abajo.</p>
            : <div className="rcp-lista">
                {d.recompensas.map(r => {
                  const bote = r.limite === 'bote'
                  const sePuedeBorrar = bote ? !r.entregado_at : r.canjes === 0
                  return (
                    <div key={r.id} className={`rcp-rec ${r.activa ? '' : 'is-off'}`}>
                      <div className="rcp-rec-txt">
                        <b>{r.titulo}</b>
                        <small>
                          {!bote ? textoLimite(r.limite)
                            : r.entregado_at ? 'Bote de la clase · entregado'
                            : `Bote de la clase · ${r.juntado} de ${r.precio}`}
                        </small>
                        {bote && !r.entregado_at && <Barra juntado={r.juntado} precio={r.precio} />}
                        {bote && r.aportes?.length > 0 && (
                          <details className="rcp-aportes">
                            <summary>Quién puso cuánto</summary>
                            <ul>{r.aportes.map((a, i) => <li key={i}><span>{a.alumno}</span><b>{a.cantidad}</b></li>)}</ul>
                          </details>
                        )}
                      </div>
                      <span className="rcp-precio">{plural(r.precio, 'ovillo', 'ovillos')}</span>
                      <small className="rcp-n">{bote ? plural(r.canjes, 'aportó', 'aportaron') : plural(r.canjes, 'canje', 'canjes')}</small>
                      <button type="button" role="switch" aria-checked={r.activa} aria-label={`${r.titulo}: en la tienda`}
                        className={`rcp-sw ${r.activa ? 'is-on' : ''}`} disabled={g.activar.isPending}
                        onClick={() => hacer(g.activar, { p_recompensa: r.id, p_activa: !r.activa })}><span /></button>
                      {sePuedeBorrar && (
                        <button type="button" className="rcp-borrar" aria-label={`Borrar «${r.titulo}»`} title="Borrar"
                          disabled={g.borrar.isPending} onClick={() => borrar(r)}>×</button>
                      )}
                    </div>
                  )
                })}
              </div>}
        </section>

        <NuevaRecompensa aulaId={aulaId} d={d} libroTitulo={libroTitulo} crear={g.crear} onFallo={setFallo} />
        {fallo && <p className="rcp-fallo" role="alert">{fallo}</p>}
      </div>

      <div className="col-columna">
        <section className="col-tarjeta">
          <h3>Por entregar {porEntregar > 0 && <span className="col-tag naranja">{porEntregar}</span>}</h3>
          <p className="col-sub">Lo que canjearon y todavía no les diste. Si no puedes darlo, «Devolver» les regresa los ovillos.</p>
          {porEntregar === 0
            ? <p className="col-vacio col-vacio-bloque">Nada pendiente.</p>
            : <div className="rcp-canjes">
                {botesLlenos.map(b => (
                  <div key={b.id} className="rcp-cj">
                    <span className="col-alerta-ini rcp-ini-clase" aria-hidden="true">★</span>
                    <div className="rcp-cj-txt"><b>Toda la clase</b><span>{b.titulo} · bote lleno entre {b.aportaron}</span></div>
                    <div className="rcp-cj-btns">
                      <button type="button" className="com-btn sm" disabled={g.borrar.isPending}
                        onClick={() => window.confirm(`¿Devolver «${b.titulo}»? A cada alumno se le regresa lo que puso y el bote se borra.`)
                          && hacer(g.borrar, { p_recompensa: b.id })}>Devolver</button>
                      <button type="button" className="com-btn sm solid" disabled={g.entregarBote.isPending}
                        onClick={() => hacer(g.entregarBote, { p_recompensa: b.id })}>Entregado</button>
                    </div>
                  </div>
                ))}
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
                  <span className="col-alerta-ini" aria-hidden="true">{c.alumno === 'Toda la clase' ? '★' : iniciales(c.alumno)}</span>
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

// Cuánto lleva juntado un bote.
function Barra({ juntado, precio }) {
  const pct = Math.min(100, Math.round((juntado / precio) * 100))
  return (
    <span className="rcp-barra" role="progressbar" aria-valuemin={0} aria-valuemax={precio} aria-valuenow={juntado}
      aria-label={`${juntado} de ${precio} ovillos`}>
      <span style={{ width: `${pct}%` }} />
    </span>
  )
}

function NuevaRecompensa({ aulaId, d, libroTitulo, crear, onFallo }) {
  const ref = d.referencia
  const solo = ref?.solo_leyendo ?? null
  const sugeridoVale = solo ? redondear(solo) : 20
  const sugeridoBote = solo ? boteSugerido(solo, d.alumnos) : 200
  const [tipo, setTipo] = useState('vale')            // 'vale' | 'bote'
  const [titulo, setTitulo] = useState('')
  const [precio, setPrecio] = useState(String(sugeridoVale))
  const [limite, setLimite] = useState('alumno')
  const n = Number(precio)
  const valido = titulo.trim().length >= 3 && Number.isInteger(n) && n >= 1 && n <= PRECIO_MAX
  const bote = tipo === 'bote'

  const cambiarTipo = (t) => {
    if (t === tipo) return
    setTipo(t)
    setPrecio(String(t === 'bote' ? sugeridoBote : sugeridoVale))
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!valido) return
    onFallo(null)
    try {
      await crear.mutateAsync({ p_aula: aulaId, p_titulo: titulo.trim(), p_precio: n, p_limite: bote ? 'bote' : limite })
      setTitulo('')
    } catch (err) { onFallo(err?.message || 'No se pudo crear. Prueba otra vez.') }
  }

  const sugeridos = !solo ? [] : bote ? [['Sugerido', sugeridoBote]] : preciosSugeridos(solo)

  return (
    <section className="col-tarjeta">
      <h3>Nueva recompensa</h3>
      <p className="col-sub">Algo que puedas dar tú en clase.</p>
      <form className="rcp-form" onSubmit={enviar}>
        <div className="rcp-tipo" role="radiogroup" aria-label="Tipo de recompensa">
          <button type="button" role="radio" aria-checked={!bote} className={!bote ? 'is-on' : ''} onClick={() => cambiarTipo('vale')}>
            Vale
          </button>
          <button type="button" role="radio" aria-checked={bote} className={bote ? 'is-on' : ''} onClick={() => cambiarTipo('bote')}>
            Bote de la clase
          </button>
        </div>
        {bote && (
          <p className="rcp-tipo-txt">
            Todos ponen los ovillos que quieran hasta llenarlo. Cuando se llena, te aparece aquí para entregarlo.
            Si lo borras antes, a cada uno se le devuelve lo suyo.
          </p>
        )}
        <label>Qué es
          <input type="text" value={titulo} maxLength={120} onChange={e => setTitulo(e.target.value)}
            placeholder={bote ? 'Ej.: ver la película del libro en clase' : 'Ej.: entregar la tarea un día después'} />
        </label>
        <div className={bote ? '' : 'rcp-fila'}>
          <label>{bote ? 'Precio del bote, entre todos' : 'Precio en ovillos'}
            <input type="number" inputMode="numeric" min="1" max={PRECIO_MAX} value={precio} onChange={e => setPrecio(e.target.value)} />
          </label>
          {!bote && (
            <label>Cuántas veces
              <select value={limite} onChange={e => setLimite(e.target.value)}>
                {LIMITES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </label>
          )}
        </div>
        {sugeridos.length > 0 && (
          <div className="rcp-sugeridos">
            <span>Te sugerimos:</span>
            {sugeridos.map(([t, v]) => (
              <button key={t} type="button" className={`rcp-sug ${n === v ? 'is-on' : ''}`} onClick={() => setPrecio(String(v))}>
                {t} · {v}
              </button>
            ))}
            <small>El precio lo pones tú.</small>
          </div>
        )}
        {ref && <Referencia ref_={ref} libroTitulo={libroTitulo} alumnos={d.alumnos} bote={bote} />}
        <button type="submit" className="com-btn solid rcp-agregar" disabled={!valido || crear.isPending}>
          {crear.isPending ? 'Agregando…' : 'Agregar a la tienda'}
        </button>
      </form>
    </section>
  )
}

// Cuántos ovillos junta un alumno en el libro del aula, con el desglose por juego (097).
function Referencia({ ref_: ref, libroTitulo, alumnos, bote }) {
  const maximo = ref.maximo ?? ref.jugando
  const partes = ref.desglose ? PARTES_OVILLOS.filter(([k]) => ref.desglose[k] > 0) : []
  const apagados = (ref.apagados ?? []).map(nombreJuego)
  return (
    <div className="rcp-ref">
      <p>
        En <i>{libroTitulo}</i> un alumno junta <b>{ref.solo_leyendo} ovillos solo leyendo</b>
        {maximo > ref.solo_leyendo && <> y, como mucho, <b>unos {maximo}</b> si no se equivoca nunca</>}.
        Nadie llega a tanto: equivocarse y gastar en los juegos también cuenta.
      </p>
      {bote && alumnos > 0 && (
        <p>Entre los {alumnos} alumnos juntan {ref.solo_leyendo * alumnos} ovillos solo leyendo.</p>
      )}
      {partes.length > 0 && (
        <details className="rcp-desglose">
          <summary>De dónde salen</summary>
          <ul>
            {partes.map(([k, t]) => (
              <li key={k}><span>{t}</span><b>{k === 'concurso' ? `unos ${ref.desglose[k]}` : ref.desglose[k]}</b></li>
            ))}
            <li className="rcp-desglose-total"><span>Sin equivocarse nunca</span><b>{maximo}</b></li>
          </ul>
          {ref.desglose.concurso > 0 && ref.concurso_rango && (
            <small>Frases difíciles: a cada alumno le tocan 1 o 2 por capítulo, así que va de {ref.concurso_rango[0]} a {ref.concurso_rango[1]}.</small>
          )}
          {apagados.length > 0 && (
            <small>No cuenta {apagados.join(' ni ')} porque {apagados.length === 1 ? 'lo apagaste' : 'los apagaste'} en tu aula.</small>
          )}
          <small>El desafío del gato no da ovillos.</small>
        </details>
      )}
    </div>
  )
}
