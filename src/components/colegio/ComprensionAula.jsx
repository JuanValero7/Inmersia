// Pestaña «Comprensión» del Salón: lo que dicen los 5 juegos del libro del
// aula (comprension_aula, migración 094). Decisiones de Juan (8 nov 2026):
//   1. Tres habilidades en llano, con la evidencia del juego y quién necesita
//      apoyo. Sin semáforos. La etiqueta PISA va pequeña.
//   2. Mesa de investigación: deducciones por alumno, intentos por deducción
//      (combinaciones hasta dar con el trío) y cuántos completaron todos los
//      perfiles. Por personaje, cada deducción con su grupo de pistas.
//   3. Por capítulo: corazonadas, frases difíciles y tesoros.
//   4. Desafío (mitad / final): resumen del gato, la charla y la nota del profe.
//   5. La clase, alumno por alumno.
//   6. Cápsula del tiempo (no ficción, 098): las dos respuestas de cada
//      alumno, antes y ahora, lado a lado. Solo para leer: sin conteos.
//   7. El falsificador (no ficción, 099).
//   8. Hilo de ideas (no ficción, 100): por alumno, ideas armadas, si llegó a
//      la conclusión, intentos fallidos, ayudas y jugadas con señuelos; por
//      idea, cuántos la armaron y dónde se atasca la clase.
//   9. Explícaselo a… (no ficción, 101): por momento, a quién se lo explicó,
//      el veredicto, los puntos que tocó, si rompió la regla y la charla entera.
// Arriba de todo, los interruptores del profe (JuegosAula, 102).
// Las cuentas viven en utils/comprension.js.
import { useState, useMemo } from 'react'
import { useJuegosAulaQuery, useComprensionQuery, useCharlaAulaQuery, useCalificarDesafio, useCapsulaAulaQuery, useFalsificadorAulaQuery, useHiloAulaQuery, useExplicaseloAulaQuery } from '../../hooks/useColegio.js'
import { resumenFalsificador } from '../../utils/falsificador.js'
import { resumenHiloAula } from '../../utils/hilo.js'
import { personaje } from '../../utils/explicaselo.js'
import {
  capituloPorDefecto, resumenMesa, resumenFrases, frasesPorTipo, resumenTesoros, resumenCorazonadas,
  corazonadasAlumno, estadoFrase, evidenciaAlumno, habilidades, NOTA_APROBADO, pct, num,
} from '../../utils/comprension.js'
import { Kpi, EstadoPill, iniciales } from './graficos.jsx'
import JuegosAula from './JuegosAula.jsx'

const TIPO_FRASE = { vocabulario: 'Vocabulario', sintaxis: 'Sintaxis', figurado: 'Lenguaje figurado', ironia: 'Ironía', intencion: 'Intención' }
const RESULTADO = { correcto: 'Comprendida', casi: 'Parcialmente', no: 'No comprendida', omitida: 'Omitida' }
const PREGUNTA = {
  no_cuadra: 'Lo que no cuadra', avisar: 'Avisarle a alguien', terminalo: 'Termínalo tú', aburrida: 'La parte más aburrida',
  amigo: '¿Serías su amigo?', tijera: 'La tijera', parte2: 'La parte 2', examen: 'El amigo del examen',
}
const MOMENTO = { mitad: 'Mitad del libro', final: 'Final del libro' }
const SOSTIENE = { si: 'Apoya lo que dice en hechos del libro', a_medias: 'Se apoya en el libro solo a medias', no: 'No se apoya en el libro' }
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

export default function ComprensionAula({ aulaId }) {
  const { data: c, isLoading, isError } = useComprensionQuery(aulaId)
  const { data: capsula, isLoading: cargandoCapsula } = useCapsulaAulaQuery(aulaId)
  const { data: falsificador, isLoading: cargandoFx } = useFalsificadorAulaQuery(aulaId)
  const { data: hilo, isLoading: cargandoHilo } = useHiloAulaQuery(aulaId)
  const { data: explicaselo, isLoading: cargandoEx } = useExplicaseloAulaQuery(aulaId)
  const { data: juegosAula } = useJuegosAulaQuery(aulaId)

  if (isLoading || cargandoCapsula || cargandoFx || cargandoHilo || cargandoEx) return <p className="com-dd-msg">Cargando la comprensión…</p>
  if (isError || !c) return <p className="com-dd-msg">No pudimos cargar la comprensión. Revisa tu conexión.</p>
  if (!c.libro_id) return null
  const conFiccion = !!(c.mesa || c.corazonadas || c.concurso || c.mapa || c.desafio)
  const conCapsula = !!capsula?.preguntas && capsula.encendida !== false
  const conFalsificador = !!falsificador?.items?.length && falsificador.encendido === true
  const conHilo = !!hilo?.ideas?.length && hilo.encendido !== false
  const conExplicaselo = !!explicaselo?.momentos?.length && explicaselo.encendido === true
  const interruptores = <JuegosAula key={'ja' + aulaId} aulaId={aulaId} datos={juegosAula} />
  if (!conFiccion && !conCapsula && !conFalsificador && !conHilo && !conExplicaselo) {
    const apagados = !!juegosAula?.disponibles?.length
    return (
      <>
        {interruptores}
        <section className="col-tarjeta">
          <h3>{apagados ? 'Los juegos de este libro están apagados' : 'Este libro todavía no tiene juegos'}</h3>
          <p className="col-sub">{apagados ? 'Enciende alguno arriba y aquí verás qué entiende la clase de lo que lee.'
            : 'Cuando estén listos, aquí verás qué entiende la clase de lo que lee.'}</p>
        </section>
      </>
    )
  }
  return (
    <>
      {interruptores}
      {conFiccion && <ConJuegos key={aulaId} c={c} aulaId={aulaId} />}
      {conCapsula && <BloqueCapsula key={'cp' + aulaId} capsula={capsula} alumnos={c.alumnos} />}
      {conHilo && <BloqueHilo hilo={hilo} alumnos={c.alumnos} />}
      {conFalsificador && <BloqueFalsificador fx={falsificador} alumnos={c.alumnos} />}
      {conExplicaselo && <BloqueExplicaselo ex={explicaselo} alumnos={c.alumnos} />}
    </>
  )
}

function ConJuegos({ c, aulaId }) {
  const on = (k) => c[k] && c.juegos?.[k] !== false
  const hab = useMemo(() => habilidades(c), [c])
  const [cap, setCap] = useState(() => capituloPorDefecto(c.alumnos, c.total_capitulos))
  // Un juego a la vez, en orden de lectura: corazonadas, frases difíciles, mapa del tesoro.
  const juegosCap = [['corazonadas', 'Corazonadas'], ['concurso', 'Frases difíciles'], ['mapa', 'Mapa del tesoro']].filter(([k]) => on(k))
  const [juegoCap, setJuegoCap] = useState(juegosCap[0]?.[0])
  const porCapitulo = juegosCap.length > 0

  return (
    <>
      <Habilidades c={c} hab={hab} />
      {on('mesa') && <BloqueMesa mesa={c.mesa} alumnos={c.alumnos} />}
      {porCapitulo && (
        <section className="col-tarjeta">
          <div className="col-card-head">
            <div>
              <h3>Capítulo a capítulo</h3>
              <p className="col-sub">Elige el juego y el capítulo.</p>
            </div>
            <SelectorCapitulo cap={cap} total={c.total_capitulos} onCap={setCap} />
          </div>
          <div className="col-filtros cmp-juegos" role="tablist" aria-label="Juego">
            {juegosCap.map(([k, t]) => (
              <button key={k} type="button" role="tab" className="col-chip" aria-selected={juegoCap === k} aria-pressed={juegoCap === k}
                onClick={() => setJuegoCap(k)}>{t}</button>
            ))}
          </div>
          {juegoCap === 'corazonadas' && <BloqueCorazonadas cz={c.corazonadas} alumnos={c.alumnos} cap={cap} />}
          {juegoCap === 'concurso' && <BloqueFrases cc={c.concurso} alumnos={c.alumnos} cap={cap} />}
          {juegoCap === 'mapa' && <BloqueTesoros mapa={c.mapa} alumnos={c.alumnos} cap={cap} />}
        </section>
      )}
      {on('desafio') && <BloqueDesafio c={c} aulaId={aulaId} />}
      <TablaComprension c={c} />
    </>
  )
}

// ── 1. Las tres habilidades ─────────────────────────────────

function Habilidades({ c, hab }) {
  const { localizar: lo, comprender: co, evaluar: ev } = hab
  const m = co.clase.mesa
  return (
    <>
      <div className="cmp-hab">
        <TarjetaHabilidad titulo="Encontrar datos en el texto" pisa="localizar" apoyo={lo.apoyo}
          lineas={c.mapa ? [`La clase encontró ${pct(lo.clase.vista.pct)} de los tesoros a la vista.`] : ['Este libro no tiene tesoros.']} />
        <TarjetaHabilidad titulo="Entender lo que no se dice" pisa="comprender" apoyo={co.apoyo}
          lineas={[
            c.concurso && `Frases difíciles: ${pct(co.clase.frases.pct)} comprendidas.`,
            c.mapa && `Tesoros escondidos: ${pct(co.clase.escondidos.pct)} encontrados.`,
            m && `Mesa: ${num(m.porAlumno)} de ${m.total} deducciones por alumno.`,
          ].filter(Boolean)} />
        <TarjetaHabilidad titulo="Opinar con argumentos del libro" pisa="evaluar y reflexionar" apoyo={ev.apoyo}
          vacio={ev.clase.terminadas === 0 ? 'Nadie terminó todavía un desafío.' : ev.clase.corregidas === 0 ? 'Cuando pongas notas en el desafío, aquí verás el resumen.' : null}
          lineas={ev.clase.terminadas ? [
            `Corregiste ${ev.clase.corregidas} de ${plural(ev.clase.terminadas, 'desafío terminado', 'desafíos terminados')}.`,
            ev.clase.corregidas ? `Nota media: ${num(ev.clase.media)}.` : null,
          ].filter(Boolean) : []} />
      </div>
      {hab.sinDatos.length > 0 && (
        <p className="cmp-sin-datos"><b>Todavía sin datos:</b> {hab.sinDatos.map(a => a.nombre).join(', ')}. No jugaron a nada aún, así que no salen como «necesita apoyo».</p>
      )}
    </>
  )
}

function TarjetaHabilidad({ titulo, pisa, lineas, apoyo, vacio = null }) {
  return (
    <section className="col-tarjeta cmp-hab-t">
      <span className="cmp-pisa">PISA: {pisa}</span>
      <h3>{titulo}</h3>
      {lineas.map(l => <p key={l} className="cmp-hab-l">{l}</p>)}
      {vacio && <p className="col-sub">{vacio}</p>}
      {!vacio && (
        <div className="cmp-apoyo">
          <span className="col-label">Necesitan apoyo</span>
          {apoyo.length === 0 ? <p className="col-sub">Nadie por ahora.</p> : apoyo.map(({ a, motivo }) => (
            <div key={a.user_id} className="cmp-apoyo-f">
              <span className="col-alerta-ini" aria-hidden="true">{iniciales(a.nombre)}</span>
              <div><b>{a.nombre}</b><span>{motivo}</span></div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── 2. Mesa de investigación ────────────────────────────────

function BloqueMesa({ mesa, alumnos }) {
  const r = useMemo(() => resumenMesa(mesa, alumnos), [mesa, alumnos])
  const [pj, setPj] = useState(mesa.personajes[0]?.id)
  const [abierta, setAbierta] = useState(null)
  const lista = mesa.deducciones.filter(d => d.pj === pj)

  return (
    <section className="col-tarjeta">
      <h3>Mesa de investigación</h3>
      <p className="col-sub">Deducciones sobre los personajes. Lo difícil es dar con las pistas que van juntas.</p>
      <div className="col-kpis cmp-kpis-3">
        <Kpi n={num(r.porAlumno)} de={r.total} etiqueta="Deducciones por alumno" />
        <Kpi n={num(r.intentos)} etiqueta="Intentos por deducción" detalle="Combinaciones probadas hasta dar con las pistas" />
        <Kpi n={r.completos} de={alumnos.length} etiqueta="Completaron todos los perfiles" />
      </div>
      <div className="col-filtros cmp-pj">
        {mesa.personajes.map(p => (
          <button key={p.id} type="button" className="col-chip" aria-pressed={pj === p.id} onClick={() => { setPj(p.id); setAbierta(null) }}>{p.nombre}</button>
        ))}
      </div>
      <div className="cmp-deds">
        {lista.map(d => {
          const x = r.porDeduccion[d.id]
          const open = abierta === d.id
          return (
            <div key={d.id} className={'cmp-ded' + (open ? ' on' : '')}>
              <button type="button" className="cmp-ded-h" aria-expanded={open} onClick={() => setAbierta(open ? null : d.id)}>
                <b>{d.texto}</b>
                <span>
                  {x.pueden === 0
                    ? (Number.isFinite(x.desde) ? `Se puede armar desde el cap. ${x.desde}` : 'Todavía no se puede armar')
                    : `La encontraron ${x.encontraron} de ${x.pueden}${x.intentos != null ? ` · ${num(x.intentos)} ${x.intentos === 1 ? 'intento' : 'intentos'} de media` : ''}`}
                </span>
                <i aria-hidden="true">{open ? '▾' : '▸'}</i>
              </button>
              {open && (
                <div className="cmp-ded-b">
                  <span className="col-label">Se arma con 3 de {d.pistas.length === 3 ? 'estas 3 pistas' : `estas ${d.pistas.length} pistas`}</span>
                  <ul>
                    {d.pistas.map((p, i) => (
                      <li key={i}>{p.texto}<small>{p.deduccion ? 'otra deducción' : `cap. ${p.cap}`}</small></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="col-nota-tabla">Si una combinación no encaja, el intento cuenta para la siguiente deducción que encuentre con ese personaje. Al final del libro quedan menos pistas en la mesa y las últimas salen más fáciles.</p>
    </section>
  )
}

// ── 3. Capítulo a capítulo ──────────────────────────────────

function SelectorCapitulo({ cap, total, onCap }) {
  return (
    <div className="cmp-selcap">
      <button type="button" className="col-chip" disabled={cap <= 1} onClick={() => onCap(cap - 1)} aria-label="Capítulo anterior">‹</button>
      <select className="col-select col-aula-sel" value={cap} aria-label="Capítulo" onChange={e => onCap(Number(e.target.value))}>
        {Array.from({ length: Math.max(total, 1) }, (_, i) => <option key={i} value={i + 1}>Capítulo {i + 1}</option>)}
      </select>
      <button type="button" className="col-chip" disabled={cap >= total} onClick={() => onCap(cap + 1)} aria-label="Capítulo siguiente">›</button>
    </div>
  )
}

// Como en la maqueta: cada opción con su letra, el texto dentro de la barra
// y la que pasó en verde.
function BloqueCorazonadas({ cz, alumnos, cap }) {
  const lista = resumenCorazonadas(cz, alumnos, cap)
  return (
    <div className="cmp-bloque">
      <p className="col-sub">Qué creyó la clase que iba a pasar. En verde, lo que pasó. Los alumnos lo ven al terminar el libro; tú, desde ya.</p>
      {lista.length === 0 ? <p className="col-sub col-vacio-bloque">En este capítulo no hay corazonadas.</p> : (
        <div className="cmp-filas">
          {lista.map(p => (
            <div key={p.id} className="cmp-fila">
              <div className="cmp-q">
                {p.pregunta}{' '}
                <small>· jugaron {p.jugaron} de {p.pueden}{p.perdidas ? ` · ${plural(p.perdidas, 'la dejó pasar', 'la dejaron pasar')}` : ''} · se resuelve en el cap. {p.rev}</small>
              </div>
              {p.sorpresa && <span className="col-tag cmp-sorpresa" title="Era un giro: no se podía deducir. Fallarla no es un error de comprensión.">Giro sorpresa: fallarla no es un error</span>}
              <div className="cmp-opciones">
                {p.opciones.map((o, i) => (
                  <div key={i} className={'cmp-op' + (i === p.correcta ? ' ok' : '')}>
                    <span className="cmp-op-l">{'ABC'[i]}</span>
                    <span className="cmp-op-track"><i style={{ width: `${p.jugaron ? (p.votos[i] / p.jugaron) * 100 : 0}%` }} /><em>{o}</em></span>
                    <span className="cmp-op-n">{p.votos[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const SEG = [['correcto', 's-ok'], ['casi', 's-mid'], ['no', 's-no'], ['omitida', 's-skip']]
// Lo que va dentro de cada tramo de la barra, en singular y plural.
const EN_BARRA = { correcto: ['comprendida', 'comprendidas'], casi: ['parcial', 'parciales'], no: ['no comprendida', 'no comprendidas'], omitida: ['omitida', 'omitidas'] }

// Como en la maqueta: la cita, una línea de datos y la barra apilada con las cifras dentro.
function BloqueFrases({ cc, alumnos, cap }) {
  const lista = resumenFrases(cc, alumnos, cap)
  const tipos = useMemo(() => frasesPorTipo(cc, alumnos), [cc, alumnos])
  return (
    <div className="cmp-bloque">
      <p className="col-sub">Interpretación de ironía, lenguaje figurado y vocabulario. A cada alumno le tocan 1 o 2 por capítulo. Nunca ves lo que escribieron.</p>
      {lista.length === 0 ? <p className="col-sub col-vacio-bloque">En este capítulo no hay frases difíciles.</p> : (
        <div className="cmp-filas">
          {lista.map(f => (
            <div key={f.id} className="cmp-fila">
              <q className="cmp-cita">{f.cita}</q>
              <div className="cmp-q"><small>{TIPO_FRASE[f.tipo] || f.tipo} · {f.total === 0 ? 'no le tocó a nadie que haya llegado a este capítulo' : `le tocó a ${f.total}${f.ayudas ? ` · ${f.ayudas} con ayuda` : ''}`}</small></div>
              {f.total > 0 && (
                <div className="cmp-stack" role="img" aria-label={SEG.map(([k]) => `${RESULTADO[k]}: ${f[k]}`).join(', ')}>
                  {SEG.map(([k, cls]) => f[k] > 0 && <span key={k} className={cls} style={{ flex: f[k] }} title={`${RESULTADO[k]}: ${f[k]}`}>{f[k]} {EN_BARRA[k][f[k] === 1 ? 0 : 1]}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {lista.some(f => f.total > 0) && (
        <div className="col-leyenda">
          {SEG.map(([k, cls]) => <span key={k}><i className={cls} />{RESULTADO[k]}</span>)}
        </div>
      )}
      {tipos.length > 1 && (
        <p className="cmp-tipos"><b>En todo lo leído:</b> {tipos.map(t => `${TIPO_FRASE[t.tipo] || t.tipo} ${pct(t.pct)}`).join(' · ')}</p>
      )}
    </div>
  )
}

function BloqueTesoros({ mapa, alumnos, cap }) {
  const lista = resumenTesoros(mapa, alumnos, cap)
  return (
    <div className="cmp-bloque">
      <p className="col-sub">Cuántos encontraron cada tesoro. Los escondidos cuestan más: el libro no lo dice con esas palabras.</p>
      {lista.length === 0 ? <p className="col-sub col-vacio-bloque">En este capítulo no hay tesoros.</p> : (
        <div className="cmp-tesoros">
          {lista.map(t => (
            <div key={t.id} className="cmp-item">
              <b className="cmp-q">{t.pregunta}</b>
              <span className="col-tag">{t.tipo === 'vista' ? 'A la vista' : 'Escondido'}</span>
              <span className="cmp-tes-bar"><i style={{ width: `${t.pueden ? (t.encontraron / t.pueden) * 100 : 0}%` }} /></span>
              <small className="cmp-pie">
                {t.pueden === 0 ? 'Nadie llegó todavía a este capítulo.'
                  : `Lo encontraron ${t.encontraron} de ${t.pueden}${t.fallos != null ? ` · ${num(t.fallos)} ${t.fallos === 1 ? 'fallo' : 'fallos'} de media antes de dar con él` : ''}`}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 4. Desafío ──────────────────────────────────────────────

const ESTADO_DF = { nueva: ['Sin empezar', null], abierta: ['A medias', 'warn'], evaluando: ['A medias', 'warn'], terminada: ['Terminado', 'ok'] }

function BloqueDesafio({ c, aulaId }) {
  const momentos = c.desafio.momentos
  const [mo, setMo] = useState(momentos[0]?.momento)
  const [quien, setQuien] = useState(null)
  const m = momentos.find(x => x.momento === mo)
  const preguntas = Object.fromEntries((m?.preguntas || []).map(q => [q.id, q]))
  const filas = c.alumnos.map(a => ({ a, ch: c.desafio.charlas[a.user_id]?.[mo] })).filter(x => x.ch)
  const elegido = filas.find(x => x.a.user_id === quien)

  return (
    <section className="col-tarjeta">
      <div className="col-card-head">
        <div>
          <h3>Desafío del gato</h3>
          <p className="col-sub">Las charlas con el gato. Estas sí las lees enteras: el alumno sabe que son para ti. La nota la pones tú, de 0 a 20, y el alumno la ve.</p>
        </div>
        <div className="col-filtros">
          {momentos.map(x => (
            <button key={x.momento} type="button" className="col-chip" aria-pressed={mo === x.momento} onClick={() => { setMo(x.momento); setQuien(null) }}>{MOMENTO[x.momento]}</button>
          ))}
        </div>
      </div>
      <p className="col-sub cmp-df-tras">Sale al terminar el capítulo {m?.tras_capitulo}. A cada alumno le toca una pregunta al azar.</p>
      <div className="cmp-df">
        <div className="cmp-entregas">
          {filas.map(({ a, ch }) => {
            const [txt, tono] = ESTADO_DF[ch.estado] || ESTADO_DF.nueva
            return (
              <button key={a.user_id} type="button" className={'cmp-ent' + (quien === a.user_id ? ' on' : '')}
                disabled={ch.estado !== 'terminada'} onClick={() => setQuien(a.user_id)}>
                <span className="cmp-ent-n"><b>{a.nombre}</b><small title={preguntas[ch.pregunta]?.consigna}>{PREGUNTA[preguntas[ch.pregunta]?.tipo] || '—'}</small></span>
                {ch.nota != null
                  ? <span className={'cmp-nota' + (ch.nota < NOTA_APROBADO ? ' baja' : '')}>{ch.nota}</span>
                  : ch.estado === 'terminada' ? <span className="cmp-sin-nota">Sin corregir</span>
                  : tono ? <EstadoPill tono={tono} texto={txt} /> : <span className="col-vacio">{txt}</span>}
              </button>
            )
          })}
        </div>
        {elegido
          ? <DetalleCharla key={`${quien}:${mo}`} aulaId={aulaId} a={elegido.a} ch={elegido.ch} momento={mo} consigna={preguntas[elegido.ch.pregunta]?.consigna} />
          : <div className="cmp-df-vacio col-sub">Toca a un alumno que haya terminado para leer el resumen del gato y ponerle nota.</div>}
      </div>
    </section>
  )
}

function DetalleCharla({ aulaId, a, ch, momento, consigna }) {
  const [verCharla, setVerCharla] = useState(false)
  const { data: charla, isLoading } = useCharlaAulaQuery(aulaId, a.user_id, momento, verCharla)
  const calificar = useCalificarDesafio(aulaId)
  const [nota, setNota] = useState(ch.nota ?? '')
  const [comentario, setComentario] = useState(ch.comentario ?? '')
  const [error, setError] = useState(null)
  const [guardado, setGuardado] = useState(false)
  const r = ch.resumen

  const guardar = async (e) => {
    e.preventDefault()
    setError(null); setGuardado(false)
    const n = nota === '' ? null : Number(nota)
    if (n != null && (!Number.isInteger(n) || n < 0 || n > 20)) { setError('La nota va de 0 a 20, sin decimales.'); return }
    try {
      await calificar.mutateAsync({ userId: a.user_id, momento, nota: n, comentario: comentario.trim() || null })
      setGuardado(true)
    } catch {
      setError('No pudimos guardar la nota. Revisa tu conexión.')
    }
  }

  return (
    <div className="cmp-charla">
      <span className="col-label">{a.nombre}</span>
      <b className="cmp-q">{consigna}</b>
      {r ? (
        <div className="cmp-resumen">
          <h4>Resumen del gato</h4>
          {r.sostiene && <p className={'cmp-r cmp-r-' + r.sostiene}>{SOSTIENE[r.sostiene] || r.sostiene}</p>}
          {r.para_el_profe && <p>{r.para_el_profe}</p>}
          {r.inventa?.length > 0 && <p className="cmp-r cmp-r-no">Dice cosas que no están en el libro: {r.inventa.join(' · ')}</p>}
        </div>
      ) : <p className="col-sub">El gato no pudo hacer el resumen de esta charla: léela entera.</p>}

      <button type="button" className="com-btn cc-ghost" onClick={() => setVerCharla(v => !v)}>{verCharla ? 'Ocultar la charla' : 'Ver la charla'}</button>
      {verCharla && (isLoading ? <p className="col-sub">Cargando…</p> : (
        <div className="cmp-turnos">
          {(charla?.turnos || []).map((t, i) => <p key={i} className={t.de === 'alumno' ? 'yo' : 'gato'}><b>{t.de === 'alumno' ? a.nombre.split(' ')[0] : 'Gato'}:</b> {t.texto}</p>)}
        </div>
      ))}

      <form className="cmp-calificar" onSubmit={guardar}>
        <div className="cmp-calificar-h">
          <h4>Tu nota</h4>
          <label className="cmp-nota-campo">
            <input type="number" min={0} max={20} step={1} inputMode="numeric" value={nota} aria-label="Nota de 0 a 20"
              onChange={e => { setNota(e.target.value); setGuardado(false) }} />
            <span>/ 20</span>
          </label>
        </div>
        <label className="cmp-com">
          <span className="col-label">Comentario para el alumno</span>
          <textarea rows={4} maxLength={1000} value={comentario}
            onChange={e => { setComentario(e.target.value); setGuardado(false) }} placeholder="Opcional. Por ejemplo: qué hizo bien y qué parte del libro le conviene releer." />
        </label>
        {error && <p className="com-error" role="alert">{error}</p>}
        <div className="cmp-calificar-acc">
          <small>{guardado ? <span className="cmp-ok">Guardado. El alumno ya lo ve.</span> : 'El alumno lo verá en su cuaderno, debajo de la charla.'}</small>
          <button type="submit" className="com-btn solid" disabled={calificar.isPending}>{calificar.isPending ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  )
}

// ── 5. Alumno por alumno ────────────────────────────────────

function TablaComprension({ c }) {
  const [abierto, setAbierto] = useState(null)
  const filas = useMemo(() => c.alumnos.map(a => ({
    a, e: evidenciaAlumno(c, a),
    cz: c.corazonadas ? corazonadasAlumno(c.corazonadas, a) : null,
    omitidas: c.concurso ? c.concurso.frases.filter(f => estadoFrase(c.concurso, a, f) === 'omitida').length : 0,
    charlas: c.desafio ? c.desafio.charlas[a.user_id] || {} : {},
  })), [c])
  const totalMesa = c.mesa?.deducciones.length || 0

  return (
    <section className="col-tarjeta">
      <h3>La clase, alumno por alumno</h3>
      <p className="col-sub">Toca un alumno para ver su detalle.</p>
      <div className="col-tabla-scroll">
        <table className="col-tabla cmp-tabla">
          <thead>
            <tr>
              <th>Alumno</th><th className="num">Capítulos</th>
              {c.mesa && <th className="num">Deducciones</th>}
              {c.corazonadas && <th>Corazonadas</th>}
              {c.concurso && <th>Frases difíciles</th>}
              {c.mapa && <th className="num">Tesoros a la vista</th>}
              {c.mapa && <th className="num">Escondidos</th>}
              {c.desafio && <th>Desafío</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map(({ a, e, cz, omitidas, charlas }) => {
              const open = abierto === a.user_id
              return [
                <tr key={a.user_id} className="col-tr-link" tabIndex={0} aria-expanded={open}
                  onClick={() => setAbierto(open ? null : a.user_id)}
                  onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setAbierto(open ? null : a.user_id) } }}>
                  <td className="col-nombre">{open ? '▾ ' : '▸ '}{a.nombre}</td>
                  <td className="num">{a.capitulos} de {c.total_capitulos}</td>
                  {c.mesa && <td className="num">{e.mesa.si} de {totalMesa}</td>}
                  {c.corazonadas && <td>{cz.jugadas === 0 ? <span className="col-vacio">—</span> : <>{cz.resueltas ? `${cz.aciertos} de ${cz.resueltas} acertadas` : `${plural(cz.jugadas, 'jugada', 'jugadas')}, por resolver`}<small className="cmp-sub-td">{cz.confianza != null && `se juega ${num(cz.confianza)} ovillos de media`}</small></>}</td>}
                  {c.concurso && <td>{e.frases.de === 0 && !omitidas ? <span className="col-vacio">—</span> : <>{e.frases.de ? `${e.frases.comprendidas} de ${e.frases.de} comprendidas` : 'Ninguna contestada'}{omitidas > 0 && <small className="cmp-sub-td">{plural(omitidas, 'omitida', 'omitidas')}</small>}</>}</td>}
                  {c.mapa && <td className="num">{e.vista.si} de {e.vista.de}</td>}
                  {c.mapa && <td className="num">{e.escondidos.si} de {e.escondidos.de}</td>}
                  {c.desafio && <td>{['mitad', 'final'].map(mo => charlas[mo]?.nota != null ? <span key={mo} className={'cmp-nota' + (charlas[mo].nota < NOTA_APROBADO ? ' baja' : '')} title={MOMENTO[mo]}>{charlas[mo].nota}</span> : charlas[mo]?.estado === 'terminada' ? <span key={mo} className="cmp-sin-nota" title={MOMENTO[mo]}>Sin corregir</span> : null)}{!Object.values(charlas).some(x => x.estado === 'terminada') && <span className="col-vacio">—</span>}</td>}
                </tr>,
                open && (
                  <tr key={a.user_id + ':d'} className="cmp-det-tr">
                    <td colSpan={8}><DetalleAlumno c={c} a={a} /></td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DetalleAlumno({ c, a }) {
  const mesa = c.mesa, cz = c.corazonadas, cc = c.concurso, mapa = c.mapa
  const jm = mesa?.jugadas[a.user_id] || {}
  const frases = cc ? cc.frases.map(f => ({ f, e: estadoFrase(cc, a, f), j: cc.jugadas[a.user_id]?.[f.id] })).filter(x => x.e) : []
  const czs = cz ? cz.preguntas.map(p => ({ p, j: cz.jugadas[a.user_id]?.[p.id] })).filter(x => x.j?.opcion != null) : []
  const enc = new Set(mapa?.jugadas[a.user_id]?.encontrados || [])
  const tesCaps = mapa ? [...new Set(mapa.tesoros.filter(t => t.cap <= a.capitulos).map(t => t.cap))] : []

  return (
    <div className="cmp-det">
      {mesa && (
        <div className="cmp-det-b">
          <h4>Mesa</h4>
          {mesa.personajes.map(p => {
            const ds = mesa.deducciones.filter(d => d.pj === p.id)
            const hechas = ds.filter(d => jm[d.id]?.armada)
            return <div key={p.id}><span>{p.nombre}</span><span>{hechas.length} de {ds.length}</span></div>
          })}
          {Object.keys(jm).length > 0 && <div><span>Intentos por deducción</span><span>{num(Object.values(jm).reduce((t, j) => t + j.intentos, 0) / Object.keys(jm).length)}</span></div>}
        </div>
      )}
      {cz && (
        <div className="cmp-det-b">
          <h4>Corazonadas</h4>
          {czs.length === 0 ? <p className="col-sub">No jugó ninguna.</p> : czs.map(({ p, j }) => (
            <div key={p.id}><span title={p.pregunta}>Cap. {p.cap} · {p.opciones[j.opcion]}</span>
              <span>{j.acierto == null ? 'Por resolver' : p.sorpresa ? (j.acierto ? 'Acertó (giro)' : 'Giro sorpresa') : j.acierto ? 'Acertó' : 'Falló'} · {plural(j.ovillos, 'ovillo', 'ovillos')}</span></div>
          ))}
        </div>
      )}
      {cc && (
        <div className="cmp-det-b">
          <h4>Frases difíciles</h4>
          {frases.length === 0 ? <p className="col-sub">Todavía no le tocó ninguna.</p> : frases.map(({ f, e, j }) => (
            <div key={f.id}><span title={f.cita}>Cap. {f.cap} · {TIPO_FRASE[f.tipo] || f.tipo}</span>
              <span>{RESULTADO[e]}{j?.contexto ? ' · más contexto' : ''}{j?.cincuenta ? ' · dos opciones' : ''}</span></div>
          ))}
          <p className="col-sub">El texto que escribió no se muestra.</p>
        </div>
      )}
      {mapa && (
        <div className="cmp-det-b">
          <h4>Tesoros</h4>
          {tesCaps.length === 0 ? <p className="col-sub">Todavía no llegó a ningún tesoro.</p> : tesCaps.map(cp => {
            const ts = mapa.tesoros.filter(t => t.cap === cp)
            return <div key={cp}><span>Cap. {cp}</span><span>{ts.filter(t => enc.has(t.id)).length} de {ts.length}{mapa.jugadas[a.user_id]?.fallos_cap[cp] ? ` · ${plural(mapa.jugadas[a.user_id].fallos_cap[cp], 'fallo', 'fallos')}` : ''}</span></div>
          })}
        </div>
      )}
    </div>
  )
}


// ── 6. Cápsula del tiempo (no ficción) ──────────────────────

const fechaCorta = (iso) => iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : ''

function BloqueCapsula({ capsula, alumnos }) {
  const [quien, setQuien] = useState(null)
  const filas = alumnos.map(a => ({ a, r: capsula.respuestas?.[a.user_id] }))
  const elegido = filas.find(x => x.a.user_id === quien && x.r)

  return (
    <section className="col-tarjeta">
      <div className="col-card-head">
        <div>
          <h3>Cápsula del tiempo</h3>
          <p className="col-sub">Lo que cada alumno pensaba al empezar el libro y lo que piensa al terminarlo, con sus palabras. No hay respuestas buenas ni malas: es para leer. El alumno sabe que tú lo lees.</p>
        </div>
      </div>
      <div className="cmp-df">
        <div className="cmp-entregas">
          {filas.map(({ a, r }) => (
            <button key={a.user_id} type="button" className={'cmp-ent' + (quien === a.user_id ? ' on' : '')}
              disabled={!r} onClick={() => setQuien(a.user_id)}>
              <span className="cmp-ent-n"><b>{a.nombre}</b>
                <small>{!r ? 'Sin sellar' : r.abierta_at ? `Antes ${fechaCorta(r.sellada_at)} · ahora ${fechaCorta(r.abierta_at)}` : `Sellada el ${fechaCorta(r.sellada_at)}`}</small>
              </span>
              {r && (r.abierta_at ? <EstadoPill tono="ok" texto="Antes y ahora" /> : <span className="col-vacio">Leyendo</span>)}
            </button>
          ))}
        </div>
        {elegido ? (
          <div className="cmp-charla cmp-cap">
            <span className="col-label">{elegido.a.nombre}</span>
            {elegido.r.preguntas.map((q, i) => (
              <div key={q.id} className="cmp-cap-q">
                <b className="cmp-q">{q.texto}</b>
                <div className="cmp-cap-dos">
                  <div className="cmp-cap-a"><small>Antes · {fechaCorta(elegido.r.sellada_at)}</small>{elegido.r.antes[i]}</div>
                  <div className="cmp-cap-b"><small>Ahora</small>{elegido.r.ahora ? elegido.r.ahora[i] : <i>Todavía no termina el libro.</i>}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="cmp-df-vacio col-sub">Toca a un alumno que haya sellado su cápsula para leer sus respuestas.</div>}
      </div>
    </section>
  )
}


// ── 7. El falsificador (no ficción) ─────────────────────────

function BloqueFalsificador({ fx, alumnos }) {
  const r = useMemo(() => resumenFalsificador(fx, alumnos), [fx, alumnos])
  const nombre = Object.fromEntries(alumnos.map(a => [a.user_id, a.nombre]))
  const autor = fx.autor || 'el autor'
  const m = r.masEngano
  return (
    <section className="col-tarjeta">
      <div className="col-card-head">
        <div>
          <h3>El falsificador</h3>
          <p className="col-sub">El gato coló {plural(r.totalFalsos, 'párrafo inventado', 'párrafos inventados')} entre {plural(r.totalReales, 'párrafo', 'párrafos')} de {autor}. Pillar una trampa es descubrir un inventado; confiar en el autor es reconocer uno de verdad.</p>
        </div>
      </div>
      {m && (
        <div className="cmp-fila">
          <small className="col-label">El que más engañó a la clase</small>
          <q className="cmp-cita">{m.inicio}</q>
          <div className="cmp-q"><small>{m.falso ? 'Inventado por el gato' : `De ${autor}`} · engañó a {m.fallos} de {m.respondidos}</small></div>
        </div>
      )}
      <div className="cmp-filas">
        {r.filas.map(f => (
          <div key={f.user_id} className="cmp-fila">
            <b>{nombre[f.user_id]}</b>
            {f.respondidos === 0
              ? <span className="col-vacio">Todavía no llega a ninguno</span>
              : <small className="cmp-pie">Pilló {f.pillo} de {r.totalFalsos} trampas · confió en {autor} {f.confio} de {plural(r.totalReales, 'vez', 'veces')}</small>}
          </div>
        ))}
      </div>
    </section>
  )
}


// ── 8. Hilo de ideas (no ficción) ──────────────────────────

function BloqueHilo({ hilo, alumnos }) {
  const r = useMemo(() => resumenHiloAula(hilo, alumnos), [hilo, alumnos])
  const nombre = Object.fromEntries(alumnos.map(a => [a.user_id, a.nombre]))
  const final = r.porIdea.find(i => i.final === 'principal')
  return (
    <section className="col-tarjeta">
      <div className="col-card-head">
        <div>
          <h3>Hilo de ideas</h3>
          <p className="col-sub">Las pistas llegan solas al terminar cada capítulo; el alumno las une de tres en tres hasta llegar a la idea del libro. Entre ellas hay señuelos: datos ciertos que no van en ninguna idea.</p>
        </div>
      </div>
      {r.atasco && (
        <div className="cmp-fila">
          <small className="col-label">Donde más se atasca la clase</small>
          <b>{r.atasco.titulo}</b>
          <div className="cmp-q"><small>{plural(r.atasco.fallos, 'intento fallido', 'intentos fallidos')} entre todos · la armaron {r.atasco.armaron} de {r.jugaron}</small></div>
        </div>
      )}
      <div className="cmp-filas">
        {r.porIdea.map(i => (
          <div key={i.id} className="cmp-fila">
            <b>{i.titulo}{i.final === 'principal' ? ' · la conclusión del libro' : ''}</b>
            <small className="cmp-pie">La {i.armaron === 1 ? 'armó' : 'armaron'} {i.armaron} de {alumnos.length}{i.fallos ? ` · ${plural(i.fallos, 'intento fallido', 'intentos fallidos')}` : ''}</small>
          </div>
        ))}
      </div>
      <div className="cmp-filas">
        {r.filas.map(f => (
          <div key={f.user_id} className="cmp-fila">
            <b>{nombre[f.user_id]}</b>
            {!f.jugo
              ? <span className="col-vacio">Todavía no juega</span>
              : <small className="cmp-pie">
                  {f.armadas} de {r.total} ideas{final ? (f.conclusion ? ' · llegó a la conclusión' : ' · aún sin la conclusión') : ''}
                  {` · ${plural(f.fallos, 'intento fallido', 'intentos fallidos')}`}
                  {f.ayudas ? ` · ${plural(f.ayudas, 'ayuda', 'ayudas')}` : ''}
                  {f.senuelos ? ` · usó señuelos ${plural(f.senuelos, 'vez', 'veces')}` : ''}
                </small>}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── 9. Explícaselo a… (no ficción) ─────────────────────────

const VEREDICTO_EX = { entendio: ['Lo entendió', 'ok'], casi: ['Casi', 'warn'], igual: ['Se quedó igual', 'bad'] }
const ESTADO_EX = { ruleta: 'Giró la ruleta', abierta: 'A medias', evaluando: 'A medias' }

function BloqueExplicaselo({ ex, alumnos }) {
  const [mo, setMo] = useState(ex.momentos[0]?.momento)
  const [quien, setQuien] = useState(null)
  const m = ex.momentos.find(x => x.momento === mo)
  const filas = alumnos.map(a => ({ a, ch: ex.alumnos?.[a.user_id]?.[mo] })).filter(x => x.ch)
  const elegido = filas.find(x => x.a.user_id === quien)
  const terminadas = filas.filter(x => x.ch.estado === 'terminada')
  const entendieron = terminadas.filter(x => x.ch.resultado === 'entendio').length

  return (
    <section className="col-tarjeta">
      <div className="col-card-head">
        <div>
          <h3>Explícaselo a…</h3>
          <p className="col-sub">Le explican una idea del libro a un personaje que les toca en una ruleta, cada uno con su regla (al pirata en 3 frases, al marciano sin ciertas palabras…). La IA hace del personaje y marca qué puntos tocaron. Las charlas las lees enteras: el alumno sabe que son para ti.</p>
        </div>
        <div className="col-filtros">
          {ex.momentos.map(x => (
            <button key={x.momento} type="button" className="col-chip" aria-pressed={mo === x.momento} onClick={() => { setMo(x.momento); setQuien(null) }}>{MOMENTO[x.momento]}</button>
          ))}
        </div>
      </div>
      {m && <p className="col-sub cmp-df-tras">Sale al terminar el capítulo {m.tras_capitulo}: «{m.consigna}»{terminadas.length > 0 && ` · Lo entendieron ${entendieron} de ${terminadas.length}.`}</p>}
      <div className="cmp-df">
        <div className="cmp-entregas">
          {filas.length === 0 && <span className="col-vacio">Nadie ha llegado todavía.</span>}
          {filas.map(({ a, ch }) => {
            const v = VEREDICTO_EX[ch.resultado]
            return (
              <button key={a.user_id} type="button" className={'cmp-ent' + (quien === a.user_id ? ' on' : '')}
                disabled={ch.estado === 'ruleta'} onClick={() => setQuien(a.user_id)}>
                <span className="cmp-ent-n"><b>{a.nombre}</b><small>{personaje(ch.personaje)?.nombre ?? '—'}{ch.giros > 1 ? ` · giró ${ch.giros} veces` : ''}</small></span>
                {v ? <EstadoPill tono={v[1]} texto={v[0]} /> : <span className="col-vacio">{ESTADO_EX[ch.estado] || '—'}</span>}
              </button>
            )
          })}
        </div>
        {elegido && m
          ? <DetalleExplicaselo key={`${quien}:${mo}`} a={elegido.a} ch={elegido.ch} m={m} />
          : <div className="cmp-df-vacio col-sub">Toca a un alumno para ver qué puntos tocó y leer la charla.</div>}
      </div>
    </section>
  )
}

function DetalleExplicaselo({ a, ch, m }) {
  const pj = personaje(ch.personaje)
  return (
    <div className="cmp-charla">
      <span className="col-label">{a.nombre} · se lo explicó a {pj?.nombre ?? '—'}</span>
      <b className="cmp-q">{m.consigna}</b>
      {ch.estado === 'terminada' && (
        <div className="cmp-resumen">
          <h4>Puntos que tocó</h4>
          {m.puntos.map((t, i) => (
            <p key={i} className={'cmp-r ' + (ch.puntos?.[i] ? 'cmp-r-si' : 'cmp-r-no')}>{t}</p>
          ))}
          {ch.rompio_regla && <p className="cmp-r cmp-r-no">No cumplió la regla del personaje (por eso, como mucho «casi»).</p>}
          {ch.para_el_profe && <p>{ch.para_el_profe}</p>}
          {ch.plan_b && <p className="col-sub">La IA no pudo dar el veredicto de esta charla: se le dio «casi». Léela entera.</p>}
        </div>
      )}
      <div className="cmp-turnos">
        {(ch.turnos || []).map((t, i) => <p key={i} className={t.de === 'alumno' ? 'yo' : 'gato'}><b>{t.de === 'alumno' ? a.nombre.split(' ')[0] : (pj?.corto ?? 'Personaje')}:</b> {t.texto}</p>)}
      </div>
    </div>
  )
}
