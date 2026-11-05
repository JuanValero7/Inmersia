// Sección «Salón» del panel del colegio: un aula, elegida por grado y
// sección, sobre el libro que está leyendo (salon_aula, migraciones
// 083–084). Mismo orden que «Mi aula» en la maqueta de octubre:
//   1. Lectura asignada: libro, plazos y la ruta de la clase con la meta de hoy.
//   2. Cuatro cifras.
//   3. Necesitan un empujón (por urgencia) · Dónde va cada alumno.
//   4. Lo que más subrayó la clase (3+ alumnos, sin decir quién).
//   5. La clase, alumno por alumno (filtros y orden).
//   6. Minutos leídos por la clase, 28 días.
//   7. Lo que el panel no muestra nunca.
// El libro y la fecha meta se asignan aquí mismo (AsignarLectura, 085): el
// libro llega solo a la biblioteca de todos los del aula.
// Estados (084): al día = en el capítulo de la meta o más adelante; un poco
// atrás = 1 a 3 capítulos; atrasado = 4 o más. Nada de lo que escriben.
import { useState, useMemo } from 'react'
import { useListaColegioQuery, useSalonQuery, useGestionColegio } from '../../hooks/useColegio.js'
import { SelectorLibro, LibroElegido } from '../comunidades/CrearComunidad.jsx'
import { imgUrl } from '../../lib/img.js'
import { Kpi, Barras, EstadoPill, Dias, fmtMin, iniciales, fechaCorta } from './graficos.jsx'

// Tono de cada alumno para colores y filtros. «Sin empezar» toma el color
// de lo lejos que está de la meta.
function tono(a) {
  if (a.estado === 'al_dia' || a.estado === 'terminado') return 'ok'
  if (a.estado === 'poco_atras') return 'warn'
  if (a.estado === 'atrasado') return 'bad'
  if (a.estado === 'sin_empezar' && a.caps_detras != null) return a.caps_detras >= 4 ? 'bad' : a.caps_detras >= 1 ? 'warn' : 'ok'
  return null
}
const TEXTO = { terminado: 'Terminó', al_dia: 'Al día', poco_atras: 'Un poco atrás', atrasado: 'Atrasado', sin_empezar: 'Sin empezar' }
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

export default function SalonColegio({ colegioId, aulaId, onAula, user }) {
  const { data: aulas = [], isLoading: cargandoAulas } = useListaColegioQuery(colegioId)
  const actual = aulas.find(a => a.aula_id === aulaId) || aulas[0] || null
  const { data: s, isLoading, isError } = useSalonQuery(actual?.aula_id)
  const gestion = useGestionColegio(colegioId, user?.id)
  const [asignando, setAsignando] = useState(false)

  if (cargandoAulas) return <p className="com-dd-msg">Cargando las aulas…</p>
  if (!actual) return <p className="com-dd-msg">Todavía no hay aulas. Créalas en «Lista».</p>

  return (
    <div className="col-salon">
      <div className="col-head">
        <h2>Salón</h2>
        <select className="col-select col-aula-sel" value={actual.aula_id} aria-label="Aula"
          onChange={e => { onAula(e.target.value); setAsignando(false) }}>
          {aulas.map(a => <option key={a.aula_id} value={a.aula_id}>{a.nombre}</option>)}
        </select>
        {/* Al lado del curso, para que no se pierda: sin libro ni fecha meta
            el Salón no puede decir quién va al día. */}
        {s && !asignando && (
          <button type="button" className="com-btn solid col-btn-lectura" onClick={() => setAsignando(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14zM4 19.5A2.5 2.5 0 006.5 22H20v-5" /></svg>
            {!s.lectura ? 'Asignar libro' : s.lectura.fecha_meta ? 'Cambiar libro o fecha' : 'Poner fecha meta'}
          </button>
        )}
      </div>

      {isLoading ? <p className="com-dd-msg">Cargando el aula…</p>
        : isError || !s ? <p className="com-dd-msg">No pudimos cargar el aula. Revisa tu conexión.</p>
        : asignando ? <AsignarLectura key={actual.aula_id} s={s} gestion={gestion} onListo={() => setAsignando(false)} />
        : !s.lectura ? <SinLibro alumnos={s.alumnos.length} />
        : <ConLectura s={s} />}

      <Privacidad />
    </div>
  )
}

function SinLibro({ alumnos }) {
  return (
    <section className="col-tarjeta col-sin-libro">
      <h3>Esta aula todavía no tiene libro</h3>
      <p className="col-sub">{alumnos > 0 && `Ya ${alumnos === 1 ? 'entró 1 alumno' : `entraron ${alumnos} alumnos`}. `}
        Con «Asignar libro», arriba, eliges el libro y la fecha en la que la clase debería terminarlo. El libro aparece solo en la biblioteca de cada alumno, y desde ese momento ves aquí cómo va la lectura.</p>
    </section>
  )
}

// Libro + fecha meta, en un paso. Cambiar el libro empieza una lectura nueva
// (la anterior queda en el historial del aula).
function AsignarLectura({ s, gestion, onListo }) {
  const l = s.lectura
  const [libro, setLibro] = useState(l ? { id: l.libro_id, titulo: l.titulo, autor: l.autor, portada_url: l.portada, color: l.color } : null)
  const [eligiendo, setEligiendo] = useState(!l)
  const [fecha, setFecha] = useState(l?.fecha_meta || '')
  const [error, setError] = useState(null)
  const hoy = new Date().toLocaleDateString('en-CA')
  const ocupado = gestion.ocupado === `lectura:${s.aula.id}`
  const cambiaLibro = l && libro && libro.id !== l.libro_id

  const guardar = async (e) => {
    e.preventDefault()
    setError(null)
    if (!libro) { setError('Elige el libro.'); return }
    if (fecha && fecha < hoy) { setError('La fecha meta no puede ser anterior a hoy.'); return }
    const r = await gestion.asignarLectura(s.aula.id, libro.id, fecha)
    if (r.error) setError(r.error)
    else onListo()
  }

  return (
    <section className="col-tarjeta">
      <div className="col-card-head">
        <div>
          <h3>{l ? 'Cambiar la lectura' : 'Asignar libro'} · {s.aula.nombre}</h3>
          <p className="col-sub">El libro aparece solo en la biblioteca de cada alumno, sin contar para su límite de lecturas.</p>
        </div>
        <button type="button" className="com-btn cc-ghost" onClick={onListo}>Cancelar</button>
      </div>
      {eligiendo ? (
        <SelectorLibro seleccionado={libro} onElegir={(x) => { setLibro(x); setEligiendo(false) }} />
      ) : (
        <form className="col-asignar" onSubmit={guardar}>
          <LibroElegido libro={libro} etiqueta="Libro" onElegir={() => setEligiendo(true)} />
          <label className="col-asignar-fecha">
            <span className="col-label">Fecha meta</span>
            <span className="com-input"><input type="date" value={fecha} min={hoy} onChange={e => { setFecha(e.target.value); setError(null) }} /></span>
            <span className="col-sub">El día en que la clase debería terminar el libro. Con ella el panel sabe quién va al día.</span>
          </label>
          {cambiaLibro && <p className="col-sub">«{l.titulo}» deja de ser la lectura actual. El avance de cada alumno en ese libro no se pierde.</p>}
          {error && <p className="com-error" role="alert">{error}</p>}
          <button type="submit" className="com-btn solid" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
        </form>
      )}
    </section>
  )
}

function ConLectura({ s }) {
  const { lectura: l, alumnos } = s
  const conMeta = l.meta_capitulo != null
  const n = alumnos.length
  const alDia = alumnos.filter(a => tono(a) === 'ok').length
  const minProm = n ? Math.round(alumnos.reduce((t, a) => t + a.minutos_semana, 0) / n) : 0
  const diasOrden = alumnos.map(a => a.dias_semana).sort((x, y) => x - y)
  const mediana = n ? diasOrden[Math.floor(n / 2)] : 0
  const rapidos = alumnos.filter(a => a.caps_rapidos > 0 || a.rapido)
  const capsRapidos = alumnos.reduce((t, a) => t + a.caps_rapidos, 0)

  return (
    <>
      <Asignada l={l} />

      <div className="col-kpis">
        {conMeta
          ? <Kpi n={alDia} de={n} etiqueta="Alumnos al día" detalle={`${n - alDia} van por detrás de la meta`} />
          : <Kpi n="—" etiqueta="Alumnos al día" detalle="Pon una fecha meta para saberlo" />}
        <Kpi n={fmtMin(minProm)} etiqueta="Lectura por alumno" detalle="Promedio de esta semana" />
        <Kpi n={mediana} de={7} etiqueta="Días con lectura" detalle="Lo normal en la clase esta semana" />
        <Kpi n={rapidos.length} etiqueta="Leyeron muy rápido"
          detalle={capsRapidos ? plural(capsRapidos, 'capítulo en total', 'capítulos en total') : 'Más de 600 palabras por minuto'} />
      </div>

      <div className="col-grid-2">
        <Empujon alumnos={alumnos} />
        <div className="col-columna">
          <DondeVa s={s} />
          <Frases frases={s.subrayados} />
        </div>
      </div>

      <TablaAlumnos l={l} alumnos={alumnos} />
      <MinutosClase s={s} />
    </>
  )
}

function Asignada({ l }) {
  const total = Math.max(l.total_capitulos, 1)
  const pos = (c) => `${total <= 1 ? 0 : ((c - 1) / (total - 1)) * 100}%`
  const quedan = l.dias_restantes
  return (
    <section className="col-tarjeta col-asignada">
      {l.portada
        ? <img className="col-libro-img" src={imgUrl(l.portada, { width: 200 })} alt="" />
        : <div className="col-libro" style={l.color ? { background: l.color } : undefined}><b>{l.titulo}</b><small>{l.autor}</small></div>}
      <div className="col-asig-body">
        <span className="col-label">Lectura asignada</span>
        <h3 className="col-asig-title">{l.titulo}</h3>
        <div className="col-asig-meta">
          <span className="col-tag">{l.total_capitulos} capítulos</span>
          {l.fecha_meta && <span className="col-tag">Del {fechaCorta(l.inicio, 'long')} al {fechaCorta(l.fecha_meta, 'long')}</span>}
          {quedan != null && (
            <span className="col-tag naranja">
              {quedan > 1 ? `Faltan ${quedan} días` : quedan === 1 ? 'Falta 1 día' : quedan === 0 ? 'Vence hoy' : `Venció hace ${-quedan} ${quedan === -1 ? 'día' : 'días'}`}
            </span>
          )}
        </div>
        <div className="col-ruta">
          <div className="col-ruta-track"><div className="col-ruta-fill" style={{ width: pos(l.promedio_capitulo || 1) }} /></div>
          {l.meta_capitulo != null && (
            // En los extremos la etiqueta se alinea hacia adentro, para no salirse.
            <div className={'col-ruta-mark' + (parseFloat(pos(l.meta_capitulo)) < 12 ? ' ini' : parseFloat(pos(l.meta_capitulo)) > 88 ? ' fin' : '')}
              style={{ left: pos(l.meta_capitulo) }}><span>Meta de hoy: cap. {l.meta_capitulo}</span></div>
          )}
        </div>
        <div className="col-ruta-ends">
          <span>Cap. 1</span>
          <span>{l.promedio_capitulo ? `La clase va en promedio por el cap. ${String(l.promedio_capitulo).replace('.', ',')}` : 'Nadie empezó todavía'}</span>
          <span>Cap. {l.total_capitulos}</span>
        </div>
        {l.meta_capitulo == null && <span className="col-sub">Sin fecha meta todavía: ponla para saber quién va al día.</span>}
      </div>
    </section>
  )
}

function motivos(a) {
  const m = []
  if (a.dias_sin_abrir == null && a.estado === 'sin_empezar') m.push('Todavía no abrió el libro')
  else if (a.dias_sin_abrir >= 5) m.push(`No abre el libro desde hace ${a.dias_sin_abrir} días`)
  if (a.caps_detras > 0 && a.estado !== 'terminado') m.push(`Va ${plural(a.caps_detras, 'capítulo', 'capítulos')} detrás de la meta`)
  if (a.caps_rapidos > 0) m.push(`Pasó ${a.caps_rapidos === 1 ? 'un capítulo' : `${a.caps_rapidos} capítulos`} muy rápido`)
  else if (a.rapido) m.push('Lee muy rápido: más de 600 palabras por minuto de media')
  return m
}

function Empujon({ alumnos }) {
  const urg = (a) => ({ bad: 100, warn: 50 }[tono(a)] || 0) + Math.max(0, a.caps_detras || 0) * 3 + (a.dias_sin_abrir || 0) + a.caps_rapidos * 4 + (a.rapido ? 4 : 0)
  const lista = alumnos
    .filter(a => tono(a) === 'bad' || tono(a) === 'warn' || a.caps_rapidos > 0 || a.rapido || a.dias_sin_abrir >= 5)
    .sort((x, y) => urg(y) - urg(x))

  return (
    <section className="col-tarjeta">
      <h3>Necesitan un empujón</h3>
      <p className="col-sub">Ordenados por urgencia. Se actualiza cada día.</p>
      {lista.length === 0 ? <p className="col-sub col-vacio-bloque">Nadie por ahora: toda la clase va bien.</p> : (
        <div className="col-alertas">
          {lista.map(a => (
            <div key={a.user_id} className="col-alerta">
              <span className="col-alerta-ini" aria-hidden="true">{iniciales(a.nombre)}</span>
              <div className="col-alerta-body">
                <div className="col-alerta-top">
                  <b>{a.nombre}</b>
                  <EstadoPill tono={tono(a)} texto={tono(a) === 'ok' && a.estado !== 'terminado' ? 'Al día en capítulos' : TEXTO[a.estado]} />
                </div>
                <div className="col-motivos">{motivos(a).map(t => <span key={t}>{t}</span>)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const COLOR = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)' }

function DondeVa({ s }) {
  const { lectura: l, alumnos } = s
  const rango = { bad: 0, warn: 1, ok: 2 }
  // Cada barra toma el color del alumno más atrasado de ese capítulo.
  const datos = Array.from({ length: Math.max(l.total_capitulos, 1) }, (_, i) => {
    const g = alumnos.filter(a => a.porcentaje > 0 && a.capitulo_actual === i + 1)
    const peor = g.reduce((p, a) => Math.min(p, rango[tono(a)] ?? 2), 2)
    return {
      x: i + 1, v: g.length, color: COLOR[['bad', 'warn', 'ok'][peor]],
      tip: <><b>Capítulo {i + 1}</b><br />{g.length ? g.map(a => <span key={a.user_id}>{a.nombre}<br /></span>) : 'Nadie va por aquí'}</>,
    }
  })
  const maxAlumnos = Math.max(...datos.map(d => d.v), 1)
  const tope = maxAlumnos <= 4 ? Math.max(2, maxAlumnos) : Math.ceil(maxAlumnos / 3) * 3
  return (
    <section className="col-tarjeta">
      <h3>Dónde va cada alumno</h3>
      <p className="col-sub">Alumnos por capítulo. Pasa el cursor por una barra para ver quiénes son.</p>
      <Barras datos={datos} alto={210} max={tope} ticks={tope <= 4 ? tope : 3}
        cadaEtiqueta={l.total_capitulos > 14 ? 2 : 1} aria={`Cantidad de alumnos en cada capítulo de ${l.titulo}`}
        referencia={l.meta_capitulo ? { i: l.meta_capitulo - 1, texto: 'Meta de hoy' } : null} />
      <div className="col-leyenda">
        <span><i style={{ background: 'var(--ok)' }} />Al día</span>
        <span><i style={{ background: 'var(--warn)' }} />Un poco atrás</span>
        <span><i style={{ background: 'var(--bad)' }} />Atrasado</span>
      </div>
    </section>
  )
}

function Frases({ frases }) {
  return (
    <section className="col-tarjeta">
      <h3>Lo que más subrayó la clase</h3>
      <p className="col-sub">Para abrir la próxima discusión en el aula.</p>
      {frases.length === 0 ? (
        <p className="col-sub col-vacio-bloque">Aparece cuando 3 alumnos o más subrayan el mismo párrafo. Nunca se muestra quién.</p>
      ) : (
        <div className="col-frases">
          {frases.map((f, i) => (
            <div key={i} className="col-frase">
              <q>{f.texto}{f.texto.length >= 280 ? '…' : ''}</q>
              <span>Cap. {f.capitulo} · la subrayaron {f.alumnos} alumnos</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const COLUMNAS = [
  { k: 'nombre', t: 'Alumno', valor: a => a.nombre },
  { k: 'avance', t: 'Avance', valor: a => a.porcentaje },
  { k: 'semana', t: 'Esta semana', num: true, valor: a => a.minutos_semana },
  { k: 'dias', t: 'Días que leyó', valor: a => a.dias_semana },
  { k: 'pred', t: 'Predicciones', num: true, valor: a => a.predicciones },
  { k: 'sub', t: 'Subrayados', num: true, valor: a => a.subrayados },
  { k: 'estado', t: 'Estado', valor: a => ({ bad: 0, warn: 1, ok: 2 }[tono(a)] ?? 3) },
]

function TablaAlumnos({ l, alumnos }) {
  const [filtro, setFiltro] = useState('todos')
  const [orden, setOrden] = useState({ k: 'avance', dir: -1 })
  const cuenta = (t) => alumnos.filter(a => tono(a) === t).length
  const FILTROS = [['todos', 'Todos', alumnos.length], ['bad', 'Atrasados', cuenta('bad')], ['warn', 'Un poco atrás', cuenta('warn')], ['ok', 'Al día', cuenta('ok')]]

  const filas = useMemo(() => {
    const col = COLUMNAS.find(c => c.k === orden.k)
    return alumnos
      .filter(a => filtro === 'todos' || tono(a) === filtro)
      .slice()
      .sort((x, y) => {
        const a = col.valor(x), b = col.valor(y)
        return (typeof a === 'string' ? a.localeCompare(b) : a - b) * orden.dir
      })
  }, [alumnos, filtro, orden])

  const ordenar = (k) => setOrden(o => ({ k, dir: o.k === k ? -o.dir : (k === 'nombre' ? 1 : -1) }))

  return (
    <section className="col-tarjeta">
      <div className="col-card-head">
        <div>
          <h3>La clase, alumno por alumno</h3>
          <p className="col-sub">Toca un encabezado para ordenar.</p>
        </div>
        <div className="col-filtros">
          {FILTROS.map(([k, t, c]) => (
            <button key={k} type="button" className="col-chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{t} · {c}</button>
          ))}
        </div>
      </div>
      {alumnos.length === 0 ? <p className="col-sub">Nadie entró todavía al aula.</p> : (
        <div className="col-tabla-scroll">
          <table className="col-tabla">
            <thead>
              <tr>
                {COLUMNAS.map(c => (
                  <th key={c.k} className={c.num ? 'num' : undefined}
                    aria-sort={orden.k === c.k ? (orden.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => ordenar(c.k)}>{c.t}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map(a => (
                <tr key={a.user_id}>
                  <td className="col-nombre">{a.nombre}</td>
                  <td>
                    <span className="col-avance">
                      <span className="col-avance-bar" title={`${a.porcentaje} % del libro`}>
                        <i style={{ width: `${a.porcentaje}%` }} />
                        {l.esperado != null && <u style={{ left: `${l.esperado}%` }} />}
                      </span>
                      <span className="col-avance-txt">
                        <small>{a.porcentaje === 0 ? 'Sin empezar' : `Cap. ${a.capitulo_actual} de ${l.total_capitulos}`}</small>
                        {a.caps_rapidos > 0
                          ? <span className="col-rapido" title="Terminó esos capítulos a más de 600 palabras por minuto de reloj.">⚡ {a.caps_rapidos} muy rápido</span>
                          : a.rapido && <span className="col-rapido" title="Más de 600 palabras por minuto de media en el libro.">⚡ muy rápido</span>}
                      </span>
                    </span>
                  </td>
                  <td className="num">{a.minutos_semana ? fmtMin(a.minutos_semana) : <span className="col-vacio">—</span>}</td>
                  <td><Dias mascara={a.dias_lectura || '.......'} /></td>
                  <td className="num">{a.predicciones}</td>
                  <td className="num">{a.subrayados}</td>
                  <td><EstadoPill tono={tono(a)} texto={TEXTO[a.estado] || '—'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="col-nota-tabla">
        «Esta semana» cuenta solo el tiempo con el libro abierto y en uso: si el alumno deja la pestaña abierta y se va, no suma.
        Los puntos van de hace 6 días a hoy. «Muy rápido» marca los capítulos terminados a más de 600 palabras por minuto.
      </p>
    </section>
  )
}

function MinutosClase({ s }) {
  const { lectura: l, minutos_dia: dias } = s
  const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const inicio = l.inicio?.slice(0, 10)
  const iInicio = dias.findIndex(d => d.dia >= inicio)
  const datos = dias.map((d, i) => {
    const [y, mo, da] = d.dia.split('-').map(Number)
    const f = new Date(y, mo - 1, da)
    return {
      x: `${da}/${mo}`, v: d.minutos, emph: i === dias.length - 1,
      tip: <><b>{DIA[f.getDay()]} {da}/{mo}</b><br />{d.minutos} min entre toda la clase</>,
    }
  })
  return (
    <section className="col-tarjeta">
      <h3>Minutos leídos por la clase</h3>
      <p className="col-sub">Últimos 28 días, sumando a todos los alumnos.</p>
      <Barras datos={datos} alto={220} cadaEtiqueta={7} aria="Minutos leídos por la clase cada día, últimos 28 días"
        referencia={iInicio > 0 ? { i: iInicio, texto: `Empieza ${l.titulo}`, izquierda: iInicio > dias.length * 0.6 } : null} />
    </section>
  )
}

function Privacidad() {
  return (
    <section className="col-privacidad">
      <span className="col-candado" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
      </span>
      <div className="col-privacidad-body">
        <h3>Lo que este panel no muestra nunca</h3>
        <ul>
          <li>Los chats y mensajitos entre alumnos.</li>
          <li>El texto de sus predicciones y notas: solo cuántas hizo.</li>
          <li>Quién subrayó qué. Un párrafo aparece solo si lo marcaron 3 o más.</li>
          <li>Lo que leen por su cuenta: solo cuenta el libro del aula.</li>
        </ul>
      </div>
    </section>
  )
}
