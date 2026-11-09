// Tienda de recompensas · el local de la izquierda en la calle de la Tienda
// (migración 095, maqueta 5YpgxrcjrXGv2QGQo5SLAX).
//
// Dos estantes, con la misma repisa que la Biblioteca (nicho de pared +
// tabla de madera): «De tu profe» (vales que crea el profe en el Salón,
// solo con el libro de su aula), como cupones de colores con la etiqueta
// del precio colgando (los colores de las secciones de la Cartelera), y
// «Expedientes» (autor y época, los pone Inmersia), como carpetas de cartón.
// Se paga con los ovillos de un libro: arriba, «Pagas con…» elige cuál.
// Antes de canjear, la cuenta: tienes / cuesta / te quedan, con aviso si se
// queda con pocos para jugar. No lo impide: gastar es decisión del alumno.
//
// «Mis canjes» es un recibo: lo del profe queda pendiente hasta que lo
// entrega; los expedientes se leen ahí mismo. En el móvil son dos pestañas;
// en escritorio, dos columnas.
//
// Bote de la clase (097): un cupón con la barra de lo juntado. No se canjea:
// cada alumno pone los ovillos que quiera hasta llenarlo.
import { useState, useEffect } from 'react'
import { useTiendaRecompensas, useExpediente } from '../../hooks/useRecompensas.js'
import useIsMobile from '../../hooks/useIsMobile.js'
import { cuentaCanje, textoBloqueo, textoLimite, ovillos, sinPrefijo } from '../../utils/recompensas.js'
import { CartoonPlank, PlankMobile } from '../biblioteca/clay/Shelves.jsx'
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
  aportado: ['warn', 'En el bote'],
  lleno: ['ok', '¡Lleno!'],
}
// Cupones con los colores de las secciones de la Cartelera (rc-c0…rc-c4 en recompensas.css).
const SELLO = { ya_canjeado: 'Canjeado', agotado: 'Agotado', esta_semana: 'Esta semana no', lleno: '¡Lleno!', entregado: 'Entregado' }

export default function TiendaRecompensas({ user, gatoColor = 'negro', onVolver }) {
  const movil = useIsMobile()
  const [libroId, setLibroId] = useState(null)
  const { tienda, cargando, error, canjearVale, comprarExpediente, aportarBote } = useTiendaRecompensas(user?.id, libroId)
  const [elegido, setElegido] = useState(null)      // {tipo: 'vale'|'expediente'|'bote', item}
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
  const porFila = movil ? 2 : 3

  const canjear = async (cantidad) => {
    const { tipo, item } = elegido
    try {
      if (tipo === 'bote') {
        const r = await aportarBote.mutateAsync({ vale: item, cantidad })
        setElegido(null)
        setAviso(r?.lleno ? '¡Llenaron el bote! Tu profe ya lo ve' : `Pusiste ${ovillos(r?.puesto ?? cantidad)} en el bote`)
        return
      }
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
        <button type="button" className="rc-back" onClick={onVolver}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          Calle
        </button>
        {tienda?.libro_id && (
          <span className="rc-saldo" title="Tus ovillos en este libro">
            <span className="rc-saldo-bolas" aria-hidden="true"><Ovillo /><Ovillo /><Ovillo /></span>
            <b>{saldo}</b><span className="rc-saldo-txt">{saldo === 1 ? 'ovillo' : 'ovillos'}</span>
          </span>
        )}
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
                  <Estante etiqueta="De tu profe" detalle={tienda.recompensas[0]?.aula} porFila={porFila} movil={movil}
                    vacio="Tu profe todavía no puso recompensas."
                    items={tienda.recompensas.map((v, i) => (
                      <Cupon key={v.id} v={v} i={i} caro={v.limite === 'bote' ? saldo < 1 : saldo < v.precio}
                        onAbrir={() => setElegido({ tipo: v.limite === 'bote' ? 'bote' : 'vale', item: v })} />
                    ))} />
                )}
                <Estante etiqueta="Expedientes" detalle="de Inmersia" porFila={porFila} movil={movil}
                  vacio="Este libro todavía no tiene expedientes."
                  items={tienda.expedientes.map(x => (
                    <Carpeta key={x.id} x={x} caro={!x.comprado && saldo < x.precio}
                      onAbrir={() => x.comprado ? setLeyendo(x.id) : setElegido({ tipo: 'expediente', item: x })} />
                  ))} />
                <p className="rc-pie">Leer un capítulo da 2 ovillos; los juegos de la lectura dan más.</p>
              </section>

              <section className="rc-col rc-mis" aria-label="Mis canjes">
                <Recibo canjes={tienda.canjes} titulo={libro.titulo} onLeer={setLeyendo} />
              </section>
            </>}
      </main>

      {elegido && (
        <Cuenta elegido={elegido} saldo={saldo} enviando={canjearVale.isPending || comprarExpediente.isPending || aportarBote.isPending}
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

// Un estante: etiqueta + filas de repisa (nicho + tabla, como en la Biblioteca).
function Estante({ etiqueta, detalle, items, porFila, movil, vacio }) {
  const filas = []
  for (let i = 0; i < Math.max(items.length, 1); i += porFila) filas.push(items.slice(i, i + porFila))
  const Tabla = movil ? PlankMobile : CartoonPlank
  return (
    <div className="rc-estante">
      <span className="rc-estante-tag">{etiqueta}{detalle && <small> · {detalle}</small>}</span>
      {filas.map((fila, fi) => {
        return (
          <div key={fi} className="rc-fila">
            <div className="rc-nicho" aria-hidden="true" />
            <div className="rc-fila-items" style={{ gridTemplateColumns: `repeat(${porFila}, minmax(0, 1fr))` }}>
              {items.length === 0
                ? <p className="rc-estante-vacio" style={{ gridColumn: '1 / -1' }}>{vacio}</p>
                : fila}
            </div>
            <Tabla />
          </div>
        )
      })}
    </div>
  )
}

// Vale del profe: un cupón con muescas, la línea de corte y la etiqueta del precio colgando.
function Cupon({ v, i, caro, onAbrir }) {
  const bloq = textoBloqueo(v)
  const bote = v.limite === 'bote'
  const pie = bote
    ? `${v.juntado} de ${v.precio}${v.mio > 0 ? ` · pusiste ${v.mio}` : ''}`
    : bloq ?? textoLimite(v.limite)
  return (
    <button type="button" className={`rc-cupon rc-c${i % 5} ${bote ? 'is-bote' : ''} ${bloq ? 'is-bloq' : ''} ${caro ? 'is-caro' : ''}`}
      disabled={!!bloq} onClick={onAbrir}
      aria-label={`${v.titulo}, ${bote ? `bote de la clase: ${v.juntado} de ${v.precio} ovillos` : ovillos(v.precio)}${bloq ? `. ${bloq}` : ''}`}>
      <span className="rc-etiqueta"><Ovillo />{v.precio}</span>
      <span className="rc-cupon-kick">{bote ? 'Bote de la clase' : 'Vale'}</span>
      <b className="rc-cupon-t">{v.titulo}</b>
      {bote && (
        <span className="rc-bote-barra" aria-hidden="true">
          <span style={{ width: `${Math.min(100, Math.round((v.juntado / v.precio) * 100))}%` }} />
        </span>
      )}
      <span className="rc-cupon-corte" />
      <small className="rc-cupon-pie">{pie}</small>
      {bloq && <span className="rc-sello">{SELLO[v.bloqueo]}</span>}
    </button>
  )
}

// Expediente de Inmersia: una carpeta de cartón con su pestaña y una hoja asomando.
function Carpeta({ x, caro, onAbrir }) {
  return (
    <div className="rc-carpeta-wrap">
    <span className="rc-carpeta-hoja" aria-hidden="true" />
    <button type="button" className={`rc-carpeta ${x.comprado ? 'is-tuyo' : ''} ${caro ? 'is-caro' : ''}`} onClick={onAbrir}
      aria-label={`${sinPrefijo(x.titulo)}${x.comprado ? ', ya es tuyo: leer' : `, ${ovillos(x.precio)}`}`}>
      {!x.comprado && <span className="rc-etiqueta"><Ovillo />{x.precio}</span>}
      <span className="rc-carpeta-kick">Expediente</span>
      <b className="rc-carpeta-t">{sinPrefijo(x.titulo)}</b>
      {x.comprado
        ? <span className="rc-carpeta-leer">Es tuyo · Leer</span>
        : <small className="rc-carpeta-d">{x.descripcion}</small>}
    </button>
    </div>
  )
}

// «Mis canjes»: un recibo con una línea por canje y el total gastado.
function Recibo({ canjes, titulo, onLeer }) {
  const total = canjes.filter(c => c.estado !== 'devuelto').reduce((t, c) => t + c.precio, 0)
  return (
    <div className="rc-recibo">
      <div className="rc-recibo-h">
        <b>Mis canjes</b>
        <i>{titulo}</i>
      </div>
      {canjes.length === 0
        ? <p className="rc-recibo-vacio">Todavía no canjeaste nada con este libro.</p>
        : canjes.map(c => (
            <div key={c.tipo + c.id} className="rc-linea">
              <div className="rc-linea-txt">
                <b>{c.tipo === 'expediente' ? sinPrefijo(c.titulo) : c.tipo === 'bote' ? `Bote: ${c.titulo}` : c.titulo}</b>
                <small>
                  {fechaCorta(c.fecha)}
                  {c.tipo === 'expediente'
                    ? <> · <button type="button" className="rc-link" onClick={() => onLeer(c.id)}>Leer</button></>
                    : c.estado === 'pendiente' ? ' · te lo entrega tu profe'
                    : c.estado === 'aportado' ? ' · lo pusiste en el bote de la clase'
                    : c.estado === 'lleno' ? ' · se llenó: tu profe lo entrega'
                    : c.estado === 'devuelto' ? ' · te devolvió los ovillos' : ''}
                </small>
              </div>
              <span className={`rc-est ${ESTADO[c.estado][0]}`}>{ESTADO[c.estado][1]}</span>
              <span className={`rc-linea-precio ${c.estado === 'devuelto' ? 'is-tachado' : ''}`}><Ovillo />{c.precio}</span>
            </div>
          ))}
      {canjes.length > 0 && (
        <div className="rc-recibo-total"><span>Gastado</span><span><Ovillo />{total}</span></div>
      )}
    </div>
  )
}

// Hoja de abajo (móvil) o tarjeta centrada (escritorio) con la cuenta.
function Cuenta({ elegido, saldo, enviando, onCerrar, onCanjear }) {
  const { tipo, item } = elegido
  const bote = tipo === 'bote'
  const falta = bote ? item.precio - item.juntado : 0
  const tope = Math.max(1, Math.min(saldo, falta))      // no se pone más de lo que falta ni de lo que tiene
  const [cantidad, setCantidad] = useState(Math.min(5, tope))
  const costo = bote ? cantidad : item.precio
  const c = cuentaCanje(saldo, costo)
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
          <div className="rc-kick">{tipo === 'vale' ? 'Recompensa de tu profe' : bote ? 'Bote de la clase' : 'Expediente de Inmersia'}</div>
          <h3 id="rc-sheet-t">{tipo === 'expediente' ? sinPrefijo(item.titulo) : item.titulo}</h3>
          {tipo === 'expediente' && <p className="rc-sheet-desc">{item.descripcion}</p>}
          {bote && (
            <p className="rc-sheet-desc">
              Entre todos llevan {item.juntado} de {item.precio}: faltan {ovillos(falta)}.
              {item.mio > 0 && <> Tú ya pusiste {item.mio}.</>}
            </p>
          )}
        </div>
        {bote && (
          <div className="rc-poner" role="group" aria-label="Cuántos ovillos pones">
            <button type="button" className="rc-btn" aria-label="Uno menos" disabled={cantidad <= 1}
              onClick={() => setCantidad(n => Math.max(1, n - 1))}>−</button>
            <input type="number" inputMode="numeric" min="1" max={tope} value={cantidad} aria-label="Ovillos que pones"
              onChange={e => setCantidad(Math.max(1, Math.min(tope, Math.floor(Number(e.target.value) || 1))))} />
            <button type="button" className="rc-btn" aria-label="Uno más" disabled={cantidad >= tope}
              onClick={() => setCantidad(n => Math.min(tope, n + 1))}>+</button>
          </div>
        )}
        <div className="rc-cuenta">
          <div><span>Tienes</span><span><Ovillo />{saldo}</span></div>
          <div><span>{bote ? 'Pones' : 'Cuesta'}</span><span><Ovillo />−{costo}</span></div>
          <div><span>Te quedan</span><span><Ovillo />{c.alcanza ? c.queda : '—'}</span></div>
        </div>
        {c.aviso === 'falta' && <div className="rc-aviso">{c.queda === -1 ? 'Te falta' : 'Te faltan'} {ovillos(-c.queda)}. Leer y los juegos de la lectura dan más.</div>}
        {c.aviso === 'poco' && <div className="rc-aviso">Te quedarían {ovillos(c.queda)} para el resto del libro: la mesa de investigación y las corazonadas los usan.</div>}
        {tipo === 'vale' && <p className="rc-nota">Tu profe lo verá en el Salón y te lo entregará en clase.</p>}
        {bote && <p className="rc-nota">Cuando se llene, tu profe lo verá en el Salón. Lo que pones no vuelve, salvo que tu profe borre el bote.</p>}
        <div className="rc-btns">
          <button type="button" className="rc-btn" onClick={onCerrar}>Ahora no</button>
          <button type="button" className="rc-btn solid" disabled={!c.alcanza || enviando} onClick={() => onCanjear(cantidad)}>
            {enviando ? (bote ? 'Poniendo…' : 'Canjeando…') : bote ? `Poner ${cantidad}` : 'Canjear'}
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
        <button type="button" className="rc-back" onClick={onCerrar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          Volver
        </button>
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
