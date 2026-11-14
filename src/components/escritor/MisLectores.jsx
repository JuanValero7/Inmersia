// «Mis lectores» — ruta /escritor/lectores (solo escritorio).
// Maqueta aprobada: Documents/Inmersia_maquetas/escritor/rincon-escritor.html,
// pantalla 9. Los datos vienen ya sumados de mis_lectores() (migración 118).
// Decisiones de Juan (13 nov 2026): sin fichas consultadas, sin «de dónde
// llegan» y sin minutos por capítulo (no se registran). Desafío y
// Explícaselo no están en el Rincón, así que el escritor nunca lee textos
// de sus lectores: solo porcentajes. La Cápsula es texto libre → solo
// cuántos la sellaron y la abrieron.
// El superusuario puede abrir cualquier libro del catálogo.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useIsMobile from '../../hooks/useIsMobile.js'
import { useEscritorQuery, useLibrosEscritorQuery } from '../../hooks/useEscritor.js'
import { useMisLectores, useLibrosCatalogoLectores, PERIODOS } from '../../hooks/useMisLectores.js'
import '../../styles/escritor.css'
import '../../styles/escritor-lectores.css'

const GATO = '/assets/landing/gatos/blanco-2.webp'
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const num = (n) => Number(n || 0).toLocaleString('es')

function duracion(seg) {
  if (seg == null) return null
  const m = Math.round(seg / 60)
  const h = Math.floor(m / 60)
  return h ? `${h} h ${m % 60} min` : `${m} min`
}

// ── Tooltip compartido (uno por página) ─────────────────────
function useTip() {
  const [tip, setTip] = useState(null)
  const props = (html) => ({
    onMouseMove: (e) => setTip({ html, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => setTip(null),
  })
  const nodo = tip && (
    <div className="ml-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>{tip.html}</div>
  )
  return [props, nodo]
}

/** Barras verticales (una por capítulo). */
function BarrasV({ datos, max, guias = [], suf = '', ejeX, tip }) {
  const tope = max || Math.max(1, ...datos.map(d => d.v))
  return (
    <div className="ml-grafico">
      <div className="ml-barras-v">
        <div className="ml-guias">
          {guias.map(g => <div key={g} style={{ bottom: `${(g / tope) * 100}%` }}><span>{g}{suf}</span></div>)}
        </div>
        {datos.map(d => (
          <div key={d.x} className={'ml-b' + (d.resalta ? ' ml-resalta' : '')} {...tip(d.tip)}>
            <i style={{ height: `${(d.v / tope) * 100}%` }} />
            {d.lab && <em style={{ bottom: `calc(${(d.v / tope) * 100}% + 3px)` }}>{d.lab}</em>}
          </div>
        ))}
      </div>
      <div className="ml-eje-x">{datos.map(d => <span key={d.x}>{datos.length > 20 && d.x % 5 && d.x !== 1 ? '' : d.x}</span>)}</div>
      <div className="ml-eje-tit">{ejeX}</div>
    </div>
  )
}

/** Barras horizontales; v null = menos de 10 personas. */
function BarrasH({ datos, suf = '', tip, cita = false }) {
  const tope = Math.max(1, ...datos.map(d => d.v ?? 0))
  return (
    <div className={'ml-barras-h' + (cita ? ' ml-cita' : '')}>
      {datos.map((d, i) => (
        <div key={i} className="ml-fila" {...tip(d.tip ?? `${d.t}: ${d.v ?? '—'}${suf}`)}>
          <div>
            <span>{d.t}{d.e && <span className="ml-etq">{d.e}</span>}{d.s && <small>{d.s}</small>}</span>
            <div className="ml-riel"><i style={{ width: d.v == null ? 0 : `${(d.v / tope) * 100}%` }} /></div>
          </div>
          <b className={d.v == null ? 'ml-pocos' : ''}>{d.v == null ? 'pocos' : `${d.v}${suf}`}</b>
        </div>
      ))}
    </div>
  )
}

/**
 * Barras de un juego: solo las preguntas con 10 jugadores o más; el resto
 * (en el Mapa pueden ser decenas) se resume en una línea.
 */
function BarrasJuego({ datos, tip, nombre = 'preguntas' }) {
  const con = datos.filter(d => d.v != null)
  const pocos = datos.length - con.length
  if (!con.length) return <Pocos>Todavía ninguna tiene 10 jugadores. Cuando los tenga, lo verás.</Pocos>
  return (<>
    <BarrasH tip={tip} suf=" %" datos={con} />
    {pocos > 0 && <p className="ml-t-sub">Y {pocos} {nombre} más con menos de 10 jugadores.</p>}
  </>)
}

const Pocos = ({ children = 'Todavía hay menos de 10 lectores aquí. Cuando haya más, lo verás.' }) =>
  <p className="ml-pocos-txt">{children}</p>

/**
 * @param {object} props
 * @param {{ id: string }} props.user
 * @param {boolean} props.isSuperuser
 * @param {() => void} props.onGoEstudio
 * @param {() => void} props.onGoPerfil
 */
export default function MisLectores({ user, isSuperuser = false, onGoEstudio, onGoPerfil }) {
  const isMobile = useIsMobile()
  const [params, setParams] = useSearchParams()
  const [periodo, setPeriodo] = useState('todo')
  const [verTabla, setVerTabla] = useState(false)
  const [tip, nodoTip] = useTip()

  const { data: escritor, isLoading: cargandoEsc } = useEscritorQuery(user?.id)
  const { data: propios = [] } = useLibrosEscritorQuery(user?.id, !!escritor)
  const { data: catalogo = [] } = useLibrosCatalogoLectores(isSuperuser)

  const libroId = params.get('libro') || propios[0]?.id || null
  const { data: r, isLoading, isError } = useMisLectores(libroId, periodo)

  const cabecera = (
    <header className="esc-cab"><div className="esc-cab-in">
      <img src="/assets/inmersia-logo.png" alt="Inmersia" />
      <span className="esc-lugar">Rincón del escritor</span>
      <span className="esc-hueco" />
      <button type="button" className="esc-avatar" onClick={onGoPerfil} title="Mi perfil" aria-label="Mi perfil">
        {(user?.email || '?').charAt(0).toUpperCase()}
      </button>
    </div></header>
  )

  if (isMobile) {
    return (
      <div className="esc-page"><div className="esc-aviso">
        <img src={GATO} alt="" /><h1>Mis lectores</h1>
        <p>Cómo leen tu libro se ve desde la computadora. Entra a inmersia.io desde ahí.</p>
      </div></div>
    )
  }
  if (cargandoEsc) return <div className="esc-page">{cabecera}<p className="esc-msg">Abriendo…</p></div>
  if (!escritor && !isSuperuser) {
    return <div className="esc-page">{cabecera}<p className="esc-msg">Tu cuenta todavía no tiene el modo escritor.</p></div>
  }

  const elegir = (id) => setParams(id ? { libro: id } : {}, { replace: true })
  const selector = (
    <select className="ml-select" value={libroId || ''} onChange={(e) => elegir(e.target.value)} aria-label="Libro">
      {!libroId && <option value="">Elige un libro</option>}
      {propios.length > 0 && (
        <optgroup label="Mis libros">{propios.map(l => <option key={l.id} value={l.id}>{l.titulo}</option>)}</optgroup>
      )}
      {isSuperuser && catalogo.length > 0 && (
        <optgroup label="Catálogo (administración)">{catalogo.map(l => <option key={l.id} value={l.id}>{l.titulo}</option>)}</optgroup>
      )}
    </select>
  )

  const top = (
    <div className="ml-top">
      <div>
        <button type="button" className="esc-volver esc-volver-oscuro ml-volver" onClick={() => onGoEstudio(libroId)}>← Volver al estudio</button>
        <h1>Mis lectores</h1>{selector}
      </div>
      <span className="esc-hueco" />
      <div className="ml-filtro">
        {PERIODOS.map(p => (
          <button key={p.id} type="button" className={periodo === p.id ? 'on' : ''} onClick={() => setPeriodo(p.id)}>{p.texto}</button>
        ))}
      </div>
    </div>
  )

  if (!libroId) {
    return <div className="esc-page">{cabecera}<main className="ml-an">{top}<p className="esc-msg">Todavía no tienes libros en tu repisa.</p></main></div>
  }
  if (isLoading) return <div className="esc-page">{cabecera}<main className="ml-an">{top}<p className="esc-msg">Contando lectores…</p></main></div>
  if (isError || !r) return <div className="esc-page">{cabecera}<main className="ml-an">{top}<p className="esc-msg">No pudimos abrir los datos de este libro.</p></main></div>

  const c = r.cifras

  // ── Hasta dónde llegan: el capítulo donde más gente se va ──
  let peor = null
  const llegan = r.llegan?.map(x => ({ ...x, p: pct(x.n, r.llegan[0].n) })) || null
  if (llegan) {
    for (let i = 0; i < llegan.length - 1; i++) {
      const caida = llegan[i].p - llegan[i + 1].p
      if (caida > 0 && (!peor || caida > peor.caida)) peor = { cap: llegan[i].cap, caida, de: llegan[i].p, a: llegan[i + 1].p }
    }
  }
  const ahora = r.ahora
  const horas = r.horas
  const totH = horas ? horas.manana + horas.tarde + horas.noche + horas.madrugada : 0
  const j = r.juegos || {}
  const hayJuegos = ['corazonadas', 'anderson', 'mapa', 'hilo', 'falsificador', 'capsula'].some(k => j[k])
  const masDificil = (j.anderson || []).filter(x => x.pct != null).sort((a, b) => b.intentos - a.intentos)[0]

  return (
    <div className="esc-page">
      {cabecera}
      <main className="ml-an">
        {top}

        {/* ── Cifras ── */}
        <div className="ml-kpis">
          <div className="ml-kpi"><small>Lo agregaron</small><b>{num(c.agregaron)}</b><span>a su biblioteca</span></div>
          <div className="ml-kpi"><small>Lo empezaron</small><b>{num(c.empezaron)}</b><span>{pct(c.empezaron, c.agregaron)} % de los que lo agregaron</span></div>
          <div className="ml-kpi"><small>Lo terminaron</small><b>{num(c.terminaron)}</b><span>{pct(c.terminaron, c.empezaron)} % de los que lo empezaron</span></div>
          <div className="ml-kpi"><small>Tiempo de lectura</small><b>{duracion(c.segundos_medio) ?? '—'}</b>
            <span>{c.segundos_medio == null ? 'cuando lo terminen 10 lectores' : 'promedio de los que lo terminaron'}</span></div>
          <div className="ml-kpi"><small>Veces abierto</small><b>{num(c.aperturas)}</b>
            <span>{c.empezaron ? `${Math.round(c.aperturas / c.empezaron)} por lector` : '—'}</span></div>
          <div className="ml-kpi"><small>Valoración</small><b>{c.valoracion != null ? `${String(c.valoracion).replace('.', ',')} ★` : '—'}</b>
            <span>{c.resenas === 1 ? '1 reseña' : `${num(c.resenas)} reseñas`}</span></div>
        </div>

        <div className="ml-dos">
          {/* ── Hasta dónde llegan ── */}
          <section className="ml-tarjeta">
            <div className="ml-t-cab"><h2>Hasta dónde llegan</h2>
              {llegan && <button type="button" className="ml-enlace" onClick={() => setVerTabla(v => !v)}>{verTabla ? 'Ocultar tabla' : 'Ver como tabla'}</button>}
            </div>
            <p className="ml-t-sub">De cada 100 que lo empezaron, cuántos llegan a cada capítulo.</p>
            {!llegan ? <Pocos /> : (<>
              <BarrasV tip={tip} max={100} guias={[25, 50, 75]} suf=" %" ejeX="capítulo"
                datos={llegan.map((x, i) => ({
                  x: x.cap, v: x.p, resalta: peor?.cap === x.cap,
                  lab: (i === 0 || i === llegan.length - 1 || peor?.cap === x.cap) ? `${x.p} %` : '',
                  tip: <><b>Capítulo {x.cap}</b><br />Llega el {x.p} % ({num(x.n)} lectores){i > 0 && <><br />{llegan[i - 1].p - x.p} puntos menos que el anterior</>}</>,
                }))} />
              {peor && (
                <div className="ml-nota">↓ <b>En el capítulo {peor.cap} se va más gente que en ningún otro:</b> llega el {peor.de} % y pasa al {peor.cap + 1} solo el {peor.a} %.</div>
              )}
              {verTabla && (
                <table className="ml-tabla"><thead><tr><th>Capítulo</th><th>Lectores que llegan</th></tr></thead>
                  <tbody>{llegan.map(x => <tr key={x.cap}><td>{x.cap}</td><td>{x.p} % · {num(x.n)}</td></tr>)}</tbody></table>
              )}
            </>)}
          </section>

          {/* ── Por dónde van ahora ── */}
          <section className="ml-tarjeta">
            <div className="ml-t-cab"><h2>Por dónde van ahora</h2></div>
            {!ahora ? <Pocos /> : (<>
              <p className="ml-t-sub">De los {num(ahora.total)} que lo empezaron y no lo terminaron, en qué capítulo están.</p>
              <BarrasV tip={tip} ejeX="capítulo en el que están"
                datos={ahora.caps.map(x => ({
                  x: x.cap, v: x.n,
                  tip: <><b>Capítulo {x.cap}</b><br />{num(x.n)} lectores ({pct(x.n, ahora.total)} %)</>,
                }))} />
              <p className="ml-t-sub" style={{ marginTop: 8 }}>
                El {pct(ahora.dormidos, ahora.total)} % lleva más de 30 días sin abrirlo. Los contamos como abandonos en el gráfico de al lado.
              </p>
            </>)}
          </section>
        </div>

        {/* ── Subrayados ── */}
        <section className="ml-tarjeta">
          <div className="ml-t-cab"><h2>Lo más subrayado</h2></div>
          {!r.subrayados ? <Pocos /> : r.subrayados.length === 0
            ? <Pocos>Todavía no hay frases que hayan subrayado dos lectores o más.</Pocos>
            : <BarrasH tip={tip} cita datos={r.subrayados.map(s => ({
                t: `«${s.texto}»`, s: `cap. ${s.cap}`, v: s.n,
                tip: <><b>{num(s.n)} lectores</b> la subrayaron</>,
              }))} />}
        </section>

        {/* ── Juegos ── */}
        {hayJuegos && (
          <section className="ml-tarjeta">
            <div className="ml-t-cab"><h2>Los juegos, como los vería un profesor</h2></div>
            <p className="ml-t-sub">Ves cómo le fue al grupo, no a cada persona. Una pregunta con menos de 10 jugadores sale como «pocos».</p>
            <div className="ml-juegos">
              {j.corazonadas && (
                <div className="ml-ja"><h3>Corazonadas <small>% que acertó</small></h3>
                  <BarrasJuego tip={tip} datos={j.corazonadas.map(x => ({
                    t: x.texto, e: x.clase, s: `${num(x.jugaron)} jugaron`, v: x.pct,
                    tip: x.pct == null ? `${num(x.jugaron)} jugaron: todavía pocos` : <><b>{x.pct} %</b> acertó · {num(x.jugaron)} jugaron</>,
                  }))} /></div>
              )}
              {j.anderson && (
                <div className="ml-ja"><h3>Método Anderson <small>% que armó el perfil completo</small></h3>
                  <BarrasJuego tip={tip} nombre="personajes" datos={j.anderson.map(x => ({
                    t: x.texto, s: x.intentos != null ? `${String(x.intentos).replace('.', ',')} intentos` : `${num(x.jugaron)} jugaron`, v: x.pct,
                    tip: x.pct == null ? `${num(x.jugaron)} jugaron: todavía pocos` : <><b>{x.pct} %</b> lo armó · {num(x.jugaron)} jugaron</>,
                  }))} />
                  {masDificil && masDificil.intentos >= 2 && (
                    <p className="ml-t-sub">{masDificil.texto} es quien más cuesta: {String(masDificil.intentos).replace('.', ',')} intentos de media. Puede ser una pista de que su perfil no se deduce bien.</p>
                  )}
                </div>
              )}
              {j.mapa && (
                <div className="ml-ja"><h3>Mapa del tesoro <small>% que lo encontró</small></h3>
                  <BarrasJuego tip={tip} nombre="tesoros" datos={j.mapa.map(x => ({
                    t: x.texto, s: `cap. ${x.cap}`, v: x.pct,
                    tip: x.pct == null ? `${num(x.jugaron)} buscaron: todavía pocos` : <><b>{x.pct} %</b> lo encontró · {num(x.jugaron)} buscaron en ese capítulo</>,
                  }))} /></div>
              )}
              {j.hilo && (
                <div className="ml-ja"><h3>El hilo <small>% que juntó la idea</small></h3>
                  <BarrasJuego tip={tip} nombre="ideas" datos={j.hilo.map(x => ({
                    t: x.texto, s: `${num(x.jugaron)} jugaron`, v: x.pct,
                    tip: x.pct == null ? `${num(x.jugaron)} jugaron: todavía pocos` : <><b>{x.pct} %</b> la juntó · {num(x.jugaron)} jugaron</>,
                  }))} /></div>
              )}
              {j.falsificador && (
                <div className="ml-ja"><h3>El falsificador <small>% que acertó quién lo escribió</small></h3>
                  <BarrasJuego tip={tip} nombre="párrafos" datos={j.falsificador.map(x => ({
                    t: `«${x.texto}»`, e: x.falso ? 'inventado' : 'tuyo', s: `cap. ${x.cap}`, v: x.pct,
                    tip: x.pct == null ? `${num(x.jugaron)} jugaron: todavía pocos` : <><b>{x.pct} %</b> acertó · {num(x.jugaron)} jugaron</>,
                  }))} /></div>
              )}
              {j.capsula && (
                <div className="ml-ja"><h3>Cápsula del tiempo</h3>
                  {j.capsula.sellaron < r.minimo ? <Pocos /> : (
                    <div className="ml-capsula">
                      <span><b>{num(j.capsula.sellaron)}</b> la sellaron al empezar</span>
                      <span><b>{num(j.capsula.abrieron)}</b> la abrieron al terminar ({pct(j.capsula.abrieron, j.capsula.sellaron)} %)</span>
                      <p className="ml-t-sub">Lo que escriben es suyo: solo te contamos cuántos.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Cuándo leen ── */}
        <section className="ml-tarjeta">
          <div className="ml-t-cab"><h2>Cuándo leen</h2></div>
          <p className="ml-t-sub">Veces que abren el libro, por franja horaria (tu hora).</p>
          {!horas ? <Pocos /> : (
            <BarrasH tip={tip} suf=" %" datos={[
              ['Mañana (6–12)', horas.manana], ['Tarde (12–19)', horas.tarde],
              ['Noche (19–24)', horas.noche], ['Madrugada', horas.madrugada],
            ].map(([t, n]) => ({ t, v: pct(n, totH), tip: <><b>{t}</b><br />{num(n)} aperturas</> }))} />
          )}
        </section>

        <p className="ml-privacidad">Todo son datos agrupados. Si un grupo tiene menos de 10 lectores, no lo mostramos, para que nadie pueda ser reconocido.</p>
      </main>
      {nodoTip}
    </div>
  )
}
