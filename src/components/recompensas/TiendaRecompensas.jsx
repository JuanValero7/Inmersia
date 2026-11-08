// Tienda de recompensas · el local de la izquierda en la calle de la Tienda
// (migración 095, maqueta 5YpgxrcjrXGv2QGQo5SLAX).
//
// Dos estantes: «De tu profe» (vales que crea el profe en el Salón; solo con
// el libro de su aula) y «Expedientes» (de autor y época, los pone Inmersia).
// Se paga con los ovillos de un libro: arriba, «Pagas con…» elige cuál.
// Antes de canjear, la cuenta: tienes / cuesta / te quedan, con aviso si se
// queda con pocos para jugar. No lo impide: gastar es decisión del alumno.
//
// «Mis canjes»: lo del profe queda pendiente hasta que lo entrega; los
// expedientes se leen aquí mismo. En el móvil son dos pestañas; en
// escritorio, dos columnas.
import { useState, useEffect } from 'react'
import { useTiendaRecompensas, useExpediente } from '../../hooks/useRecompensas.js'
import { cuentaCanje, textoBloqueo, textoLimite, ovillos, sinPrefijo } from '../../utils/recompensas.js'
import { fechaCorta } from '../colegio/graficos.jsx'
import '../../styles/recompensas.css'

function Ovillo() {
  return (
    <svg className="rc-ovillo" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M33 33 q5 9 13 7" className="rc-ovillo-hebra" />
      <circle cx="22" cy="22" r="17" className="rc-ovillo-bola" />
      <g className="rc-ovillo-hebra"><path d="M8 16 q14 -7 27 5" /><path d="M6 24 q16 -9 31 4" /><path d="M10 32 q13 -10 25 -1" /><path d="M17 6 q-7 15 2 32" /><path d="M26 6 q-8 15 0 32" /></g>
    </svg>
  )
}

const ESTADO = {
  pendiente: ['warn', 'Pendiente'],
  entregado: ['ok', 'Entregado'],
  devuelto: ['none', 'Devuelto'],
  abierto: ['ok', 'Abierto'],
}

export default function TiendaRecompensas({ user, gatoColor = 'negro', onVolver }) {
  const [libroId, setLibroId] = useState(null)
  const { tienda, cargando, error, canjearVale, comprarExpediente } = useTiendaRecompensas(user?.id, libroId)
  const [elegido, setElegido] = useState(null)      // {tipo: 'vale'|'expediente', item}
  const [leyendo, setLeyendo] = useState(null)      // id del expediente abierto
  const [pestana, setPestana] = useState('tienda')
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(() => setAviso(null), 2600)
    return () => clearTimeout(t)
  }, [aviso])

  const libro = tienda?.libros?.find(l => l.id === tienda.libro_id) ?? null
  const saldo = tienda?.saldo ?? 0
  const pendientes = (tienda?.canjes ?? []).filter(c => c.estado === 'pendiente').length

  const canjear = async () => {
    const { tipo, item } = elegido
    try {
      if (tipo === 'vale') await canjearVale.mutateAsync(item)
      else await comprarExpediente.mutateAsync(item)
      setElegido(null)
      if (tipo === 'expediente') { setLeyendo(item.id); setAviso('¡Expediente abierto!') }
      else setAviso('¡Canjeado! Tu profe ya lo ve')
    } catch (e) {
      setElegido(null)
      setAviso(e?.message || 'No se pudo canjear. Prueba otra vez.')
    }
  }

  return (
    <div className="rc-root">
      <div className="rc-bg" style={{ backgroundImage: `url('/assets/tienda/gato-${gatoColor}-5.webp')` }} aria-hidden="true" />
      <div className="rc-top">
        <button type="button" className="rc-back" onClick={onVolver}>‹ Calle</button>
        {tienda?.libro_id && <span className="rc-saldo" title="Tus ovillos en este libro"><Ovillo />{saldo}</span>}
      </div>

      <main className="rc-body" data-tab={pestana}>
        <header className="rc-head">
          <h1 className="rc-title">Recompensas</h1>
          {libro && (tienda.libros.length > 1 ? (
            <label className="rc-libro">Pagas con
              <select value={libro.id} onChange={e => setLibroId(e.target.value)}>
                {tienda.libros.map(l => <option key={l.id} value={l.id}>{l.titulo}</option>)}
              </select>
            </label>
          ) : <span className="rc-libro">Pagas con <i>{libro.titulo}</i></span>)}
          {libro && (
            <div className="rc-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={pestana === 'tienda'} onClick={() => setPestana('tienda')}>Tienda</button>
              <button type="button" role="tab" aria-selected={pestana === 'mis'} onClick={() => setPestana('mis')}>
                Mis canjes{pendientes > 0 && <span className="rc-tab-n">{pendientes}</span>}
              </button>
            </div>
          )}
        </header>

        {cargando ? <p className="rc-msg">Abriendo la tienda…</p>
          : error || !tienda ? <p className="rc-msg">No pudimos abrir la tienda. Revisa tu conexión.</p>
          : !libro ? <Vacia />
          : <>
              <section className="rc-col rc-tienda" aria-label="Tienda">
                {libro.de_aula && (
                  <>
                    <h2 className="rc-shelf-h">De tu profe <small>{tienda.recompensas[0]?.aula ?? ''}</small></h2>
                    <div className="rc-shelf">
                      {tienda.recompensas.length === 0
                        ? <p className="rc-shelf-vacio">Tu profe todavía no puso recompensas.</p>
                        : tienda.recompensas.map(v => {
                            const bloq = textoBloqueo(v)
                            return (
                              <button key={v.id} type="button" className={`rc-vale ${saldo < v.precio ? 'is-caro' : ''}`}
                                disabled={!!bloq} onClick={() => setElegido({ tipo: 'vale', item: v })}>
                                <b>{v.titulo}</b>
                                <small>{bloq ?? textoLimite(v.limite)}</small>
                                <span className="rc-precio"><Ovillo />{v.precio}</span>
                              </button>
                            )
                          })}
                    </div>
                  </>
                )}
                <h2 className="rc-shelf-h">Expedientes <small>de Inmersia</small></h2>
                <div className="rc-shelf">
                  {tienda.expedientes.length === 0
                    ? <p className="rc-shelf-vacio">Este libro todavía no tiene expedientes.</p>
                    : tienda.expedientes.map(x => (
                        <button key={x.id} type="button" className={`rc-vale rc-exp ${!x.comprado && saldo < x.precio ? 'is-caro' : ''}`}
                          onClick={() => x.comprado ? setLeyendo(x.id) : setElegido({ tipo: 'expediente', item: x })}>
                          <b>{sinPrefijo(x.titulo)}</b>
                          <small>{x.comprado ? 'Ya es tuyo · tócalo para leer' : x.descripcion}</small>
                          {x.comprado ? <span className="rc-leer">Leer</span> : <span className="rc-precio"><Ovillo />{x.precio}</span>}
                        </button>
                      ))}
                </div>
                <p className="rc-pie">Leer un capítulo da 2 ovillos; los juegos de la lectura dan más.</p>
              </section>

              <section className="rc-col rc-mis" aria-label="Mis canjes">
                <h2 className="rc-shelf-h">Mis canjes <small><i>{libro.titulo}</i></small></h2>
                {tienda.canjes.length === 0
                  ? <p className="rc-shelf-vacio">Todavía no canjeaste nada con este libro.</p>
                  : <div className="rc-canjes">
                      {tienda.canjes.map(c => (
                        <div key={c.tipo + c.id} className="rc-canje">
                          <b>{c.tipo === 'expediente' ? sinPrefijo(c.titulo) : c.titulo}</b>
                          <small>
                            {fechaCorta(c.fecha)} · <Ovillo />{c.precio}
                            {c.tipo === 'expediente'
                              ? <> · <button type="button" className="rc-link" onClick={() => setLeyendo(c.id)}>Leer</button></>
                              : c.estado === 'pendiente' ? ' · te lo entrega tu profe'
                              : c.estado === 'devuelto' ? ' · te devolvió los ovillos' : ''}
                          </small>
                          <span className={`rc-est ${ESTADO[c.estado][0]}`}>{ESTADO[c.estado][1]}</span>
                        </div>
                      ))}
                    </div>}
              </section>
            </>}
      </main>

      {elegido && (
        <Cuenta elegido={elegido} saldo={saldo} enviando={canjearVale.isPending || comprarExpediente.isPending}
          onCerrar={() => setElegido(null)} onCanjear={canjear} />
      )}
      {leyendo && <Lectura libroId={tienda?.libro_id} id={leyendo} onCerrar={() => setLeyendo(null)} />}
      {aviso && <div className="rc-toast" role="status">{aviso}</div>}
    </div>
  )
}

function Vacia() {
  return (
    <div className="rc-vacia">
      <p><b>Aquí cambias tus ovillos por recompensas.</b></p>
      <p>Todavía no hay nada para tus libros. Cuando tu profe ponga alguna recompensa, o uno de tus libros tenga expedientes, aparecerá aquí.</p>
    </div>
  )
}

// Hoja de abajo (móvil) o tarjeta centrada (escritorio) con la cuenta.
function Cuenta({ elegido, saldo, enviando, onCerrar, onCanjear }) {
  const { tipo, item } = elegido
  const c = cuentaCanje(saldo, item.precio)
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCerrar])

  return (
    <>
      <div className="rc-dim" onClick={onCerrar} />
      <div className="rc-sheet" role="dialog" aria-modal="true" aria-labelledby="rc-sheet-t">
        <div>
          <div className="rc-kick">{tipo === 'vale' ? 'Recompensa de tu profe' : 'Expediente de Inmersia'}</div>
          <h3 id="rc-sheet-t">{tipo === 'vale' ? item.titulo : sinPrefijo(item.titulo)}</h3>
          {tipo === 'expediente' && <p className="rc-sheet-desc">{item.descripcion}</p>}
        </div>
        <div className="rc-cuenta">
          <div><span>Tienes</span><span><Ovillo />{saldo}</span></div>
          <div><span>Cuesta</span><span><Ovillo />−{item.precio}</span></div>
          <div><span>Te quedan</span><span><Ovillo />{c.alcanza ? c.queda : '—'}</span></div>
        </div>
        {c.aviso === 'falta' && <div className="rc-aviso">{c.queda === -1 ? 'Te falta' : 'Te faltan'} {ovillos(-c.queda)}. Leer y los juegos de la lectura dan más.</div>}
        {c.aviso === 'poco' && <div className="rc-aviso">Te quedarían {ovillos(c.queda)} para el resto del libro: la mesa de investigación y las corazonadas los usan.</div>}
        {tipo === 'vale' && <p className="rc-nota">Tu profe lo verá en el Salón y te lo entregará en clase.</p>}
        <div className="rc-btns">
          <button type="button" className="rc-btn" onClick={onCerrar}>Ahora no</button>
          <button type="button" className="rc-btn solid" disabled={!c.alcanza || enviando} onClick={onCanjear}>
            {enviando ? 'Canjeando…' : 'Canjear'}
          </button>
        </div>
      </div>
    </>
  )
}

// El expediente, para leer.
function Lectura({ libroId, id, onCerrar }) {
  const { data, isLoading, isError } = useExpediente(libroId, id)
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCerrar])

  return (
    <div className="rc-lectura" role="dialog" aria-modal="true" aria-label="Expediente">
      <div className="rc-lectura-top">
        <button type="button" className="rc-back" onClick={onCerrar}>‹ Volver</button>
      </div>
      <article className="rc-papel">
        {isLoading ? <p className="rc-msg">Abriendo el expediente…</p>
          : isError || !data ? <p className="rc-msg">No pudimos abrir el expediente. Prueba otra vez.</p>
          : <>
              <div className="rc-kick">Expediente</div>
              <h2>{sinPrefijo(data.titulo)}</h2>
              <p className="rc-papel-desc">{data.descripcion}</p>
              {data.parrafos.map((p, i) => <p key={i}>{p}</p>)}
            </>}
      </article>
    </div>
  )
}
