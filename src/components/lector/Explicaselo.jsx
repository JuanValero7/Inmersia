// Explícaselo a… en el lector (no ficción): a mitad del libro y al final,
// giras una ruleta, te toca un personaje con su regla y le explicas una idea
// del libro. Te contesta en su papel (la IA), pregunta lo que le faltó y al
// final dice si lo entendió. Salta al pasar del final del capítulo que toca
// (como el Desafío) y queda en el Cuaderno.
//
// useExplicaseloLector devuelve las mismas piezas que useDesafioLector:
//   · interceptar(continuar), hayPendiente, panel, cuaderno.
// Sin usuario, sin la 101 o sin contenido en el libro, no aparece nada.
//
// Maqueta: Documents/Inmersia_maquetas/colegios/maqueta-explicaselo-noficcion.html
// (sin emojis: el nombre va escrito en la rueda y el personaje es un círculo
// con su inicial). Reglas: Documentation/colegios/explicaselo-prompt.md.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useExplicaselo, ErrorExplicaselo } from '../../hooks/useExplicaselo.js'
import { momentoQueToca } from '../../utils/desafio.js'
import {
  PERSONAJES, personaje, reglaDe, avisoRegla, anguloPara, mensajesQueQuedan, PREMIO,
  MIN_PALABRAS, MAX_PALABRAS, MAX_FRASES_PIRATA,
} from '../../utils/explicaselo.js'
import { contarPalabras } from '../../utils/concurso.js'
import { Ovillo } from './Corazonada.jsx'
import '../../styles/corazonada.css'
import '../../styles/desafio.css'
import '../../styles/explicaselo.css'

const TEXTOS = {
  intro: {
    mitad: '¡Vas por la mitad del libro! A ver si se lo sabes explicar a alguien.',
    final: '¡Terminaste el libro! Una última: explícaselo a alguien.',
  },
  momento: { mitad: 'Explícaselo a… · mitad del libro', final: 'Explícaselo a… · final' },
  girar: 'Girar la ruleta',
  girando: 'Girando…',
  empezar: 'Empezar',
  otraVez: 'Otra vez',
  veredicto: {
    entendio: '¡Lo entendió!',
    casi: 'Casi lo entiende',
    igual: 'Se quedó igual',
  },
  rompio: 'Se te escapó su regla, así que como mucho «casi».',
  puntos: 'Lo que hacía falta',
  referencia: 'Cómo lo explicaríamos nosotros',
  profe: 'Tu charla va para tu profe. Puedes releerla en tu cuaderno.',
  solo: 'Puedes releerla en tu cuaderno.',
}
const ERRORES = {
  vuelve_manana: 'Ya se habló mucho hoy. Vuelve mañana y seguimos.',
  muy_corta: 'Escribe un poco más.',
  muy_larga: `Es demasiado largo: como mucho ${MAX_PALABRAS} palabras.`,
  regla_frases: `El pirata no aguanta más de ${MAX_FRASES_PIRATA} frases.`,
  regla_palabra: 'El marciano no entiende una de las palabras que usaste.',
  sin_ovillos: 'No te quedan ovillos para volver a girar.',
  sesion: 'Hace falta volver a iniciar sesión.',
  no_se_puede: 'No se pudo enviar. Prueba otra vez.',
}
const GIRO_MS = 2500
const gatoSrc = (color) => `/assets/landing/gatos/${color}-6.webp`

/** El círculo con la inicial del personaje, de su color. */
function Mono({ id, tam = 36 }) {
  const p = personaje(id)
  if (!p) return null
  return <span className="xp-mono" style={{ width: tam, height: tam, fontSize: tam / 2, background: p.color }} aria-hidden="true">{p.corto[0]}</span>
}

// ── La ruleta ──────────────────────────────────────────────

const FONDO_RUEDA = `conic-gradient(${PERSONAJES.map((p, i) => `${p.color} ${i * 60}deg ${(i + 1) * 60}deg`).join(', ')})`

// `tam`: 210 en el móvil y el Cuaderno; más grande en la pantalla entera del escritorio.
function Rueda({ angulo, tam = 210 }) {
  const r = tam * 0.295
  return (
    <div className="xp-rueda-w" style={{ width: tam, height: tam }}>
      <div className="xp-puntero" />
      <div className="xp-rueda" style={{ transform: `rotate(${angulo}deg)`, background: FONDO_RUEDA }}>
        {PERSONAJES.map((p, i) => {
          const g = i * 60 + 30, a = (g * Math.PI) / 180
          return (
            <span key={p.id} className="xp-cara">
              <i style={{ fontSize: Math.round(tam * 0.062), transform: `translate(${Math.sin(a) * r}px, ${-Math.cos(a) * r}px) translate(-50%, -50%) rotate(${g}deg)` }}>{p.corto}</i>
            </span>
          )
        })}
      </div>
      <div className="xp-eje" />
    </div>
  )
}

// ── El panel: ruleta, charla y veredicto ───────────────────

/**
 * El mismo panel en el lector y en el Cuaderno.
 * @param {{ m: import('../../utils/explicaselo.js').MomentoEx, conProfe: boolean, saldo: number, gatoColor: string,
 *   ocupado: boolean, onGirar: () => Promise<{ personaje: string }>, onEnviar: (texto: string) => Promise<unknown>,
 *   onCerrar?: () => void, movil?: boolean, enCuaderno?: boolean }} props
 */
export function PanelExplicaselo({ m, conProfe, saldo, gatoColor, ocupado, onGirar, onEnviar, onCerrar, movil = false, enCuaderno = false }) {
  const [angulo, setAngulo] = useState(() => (m.personaje ? anguloPara(m.personaje, 0, 0) : 0))
  const [girando, setGirando] = useState(false)
  const [empezada, setEmpezada] = useState(m.turnos.length > 0)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(null)
  const [error, setError] = useState(null)
  const caja = useRef(null)
  const reloj = useRef(null)
  useEffect(() => () => clearTimeout(reloj.current), [])

  const terminada = m.estado === 'terminada'
  const enRuleta = m.estado === 'nueva' || (m.estado === 'ruleta' && !empezada) || girando
  // En el lector la rueda crece y ocupa el hueco: en el escritorio «Te tocó» va a su lado;
  // en el móvil, debajo, con la rueda tan ancha como deja la hoja. En el Cuaderno, pequeña.
  const grande = !enCuaderno
  const tamRueda = enCuaderno ? 210 : movil ? Math.max(210, Math.min(310, (typeof window !== 'undefined' ? window.innerWidth : 390) - 90)) : 330
  const pj = m.personaje ? personaje(m.personaje) : null
  const regla = m.personaje ? reglaDe(m.personaje, m.prohibidas?.palabras) : ''
  const n = contarPalabras(texto)
  const aviso = m.personaje && texto.trim() ? avisoRegla(m.personaje, texto, m.prohibidas) : null
  const puede = !terminada && !enviando && !ocupado && n >= MIN_PALABRAS && n <= MAX_PALABRAS && !aviso

  useEffect(() => {
    const c = caja.current
    if (c && !enRuleta) c.scrollTop = c.scrollHeight
  }, [m.turnos.length, enviando, terminada, enRuleta])

  const girar = async () => {
    if (girando || ocupado) return
    setError(null)
    try {
      const r = await onGirar()
      setGirando(true)
      setAngulo(a => anguloPara(/** @type {any} */ (r.personaje), a))
      reloj.current = setTimeout(() => setGirando(false), GIRO_MS)
    } catch (e) {
      setError(e instanceof ErrorExplicaselo ? (ERRORES[e.codigo] || ERRORES.no_se_puede) : ERRORES.no_se_puede)
    }
  }

  const enviar = async () => {
    if (!puede) return
    const t = texto.trim()
    setError(null)
    setEnviando(t)
    setTexto('')
    try {
      await onEnviar(t)
    } catch (e) {
      setTexto(t)
      setError(e instanceof ErrorExplicaselo ? (ERRORES[e.codigo] || ERRORES.no_se_puede) : ERRORES.no_se_puede)
    } finally {
      setEnviando(null)
    }
  }

  const avisoTexto = aviso?.tipo === 'frases'
    ? `Llevas ${aviso.n} frases: el pirata solo aguanta ${MAX_FRASES_PIRATA}.`
    : aviso?.tipo === 'palabra' ? `El marciano no entiende «${aviso.palabra}». Dilo de otra forma.` : null

  return (
    <div className={'df-chat xp-panel' + (movil ? ' is-movil' : '') + (enCuaderno ? ' is-cuaderno' : '')}>
      <div className="df-chat-h">
        {!enRuleta && pj ? <Mono id={pj.id} tam={40} /> : <img className="df-ava" src={gatoSrc(gatoColor)} alt="" />}
        <div className="df-who"><b>{!enRuleta && pj ? pj.nombre : 'Tu gato'}</b><span>{TEXTOS.momento[m.momento]}</span></div>
        <span className="cz-saldo xp-saldo" title="Tus ovillos en este libro"><Ovillo />{saldo}</span>
        {onCerrar && !terminada && <button type="button" className="df-luego" onClick={onCerrar} disabled={!!enviando || girando}>Ahora no</button>}
      </div>

      <div className="df-msgs" ref={caja} aria-live="polite">
        {!enCuaderno && <div className="df-bub is-gato">{TEXTOS.intro[m.momento]}</div>}
        <div className="df-consigna">
          <div className="df-k">Explícaselo a…</div>
          <p>{m.consigna}</p>
        </div>

        {enRuleta ? (
          <div className={'xp-ruleta' + (grande ? ' is-grande' : '') + (movil ? ' is-movil' : '')}>
            <Rueda angulo={angulo} tam={tamRueda} />
            {m.estado === 'nueva' || girando
              ? <button type="button" className="cz-btn is-main xp-girar" onClick={girar} disabled={girando || ocupado}>{girando ? TEXTOS.girando : TEXTOS.girar}</button>
              : pj && (
                <div className="xp-toco">
                  <div className="xp-toco-t"><Mono id={pj.id} tam={38} /><span><small>Te tocó</small>{pj.nombre}</span></div>
                  <div className="xp-regla">Regla: {regla}</div>
                  <div className="xp-fila">
                    <button type="button" className="cz-btn is-main" onClick={() => setEmpezada(true)}>{TEXTOS.empezar}</button>
                    <button type="button" className="cz-btn xp-otra" onClick={girar} disabled={ocupado || saldo < 1}
                      title={saldo < 1 ? ERRORES.sin_ovillos : 'Volver a girar cuesta 1 ovillo'}>
                      {TEXTOS.otraVez} <Ovillo />1
                    </button>
                  </div>
                </div>
              )}
          </div>
        ) : <>
          {pj && <div className="xp-regla"><Mono id={pj.id} tam={26} /><span><b>{pj.nombre}.</b> {regla}</span></div>}
          {m.turnos.map((t, i) => (
            <div key={i} className={'df-bub ' + (t.de === 'alumno' ? 'is-yo' : 'is-gato')}>
              {t.de !== 'alumno' && pj && <b className="xp-quien">{pj.nombre}</b>}
              {t.texto}
            </div>
          ))}
          {enviando && <>
            <div className="df-bub is-yo">{enviando}</div>
            <div className="df-bub is-gato df-escribe" aria-label="Está escribiendo">• • •</div>
          </>}
          {terminada && m.resultado && <Veredicto m={m} conProfe={conProfe} />}
        </>}
        {error && enRuleta && <p className="df-error" role="alert">{error}</p>}
      </div>

      {enRuleta ? null : terminada
        ? !enCuaderno && onCerrar && <div className="df-composer"><button type="button" className="cz-btn is-main df-seguir" onClick={onCerrar}>Seguir leyendo</button></div>
        : <div className="df-composer">
            <textarea value={texto} aria-label="Tu explicación"
              placeholder={mensajesQueQuedan(m) === 1 && m.turnos.length ? 'Tu último mensaje…' : 'Explícaselo con tus palabras…'}
              autoFocus={!movil && !enCuaderno} maxLength={MAX_PALABRAS * 12} disabled={!!enviando}
              onChange={e => setTexto(e.target.value)}
              onPaste={e => e.preventDefault()} onDrop={e => e.preventDefault()}
              onKeyDown={e => { if (!movil && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} />
            {avisoTexto && <p className="df-error xp-aviso" role="status">{avisoTexto}</p>}
            {error && <p className="df-error" role="alert">{error}</p>}
            <div className="df-fila">
              <small>No se puede pegar texto</small>
              <span className={'df-cuenta' + (n > MAX_PALABRAS ? ' is-pasado' : '')}>{n} / {MAX_PALABRAS}</span>
              <button type="button" className="cz-btn is-main" disabled={!puede} onClick={enviar}>Enviar</button>
            </div>
          </div>}
    </div>
  )
}

function Veredicto({ m, conProfe }) {
  const premio = PREMIO[m.resultado] ?? 0
  return (
    <div className={'xp-veredicto is-' + m.resultado}>
      <div className="xp-v-t">
        <b>{TEXTOS.veredicto[m.resultado]}</b>
        {premio > 0 && <span className="xp-premio">+{premio} <Ovillo /></span>}
      </div>
      {m.rompio_regla && <p className="xp-v-nota">{TEXTOS.rompio}</p>}
      {m.puntos?.length > 0 && <>
        <div className="df-k">{TEXTOS.puntos}</div>
        <ul className="xp-puntos">
          {m.puntos.map((p, i) => (
            <li key={i} className={p.cubierto ? 'is-ok' : 'is-falta'}>
              <span aria-label={p.cubierto ? 'Lo dijiste' : 'Faltó'}>{p.cubierto ? '✓' : '✗'}</span>{p.t}
            </li>
          ))}
        </ul>
      </>}
      {m.referencia && <>
        <div className="df-k">{TEXTOS.referencia}</div>
        <p className="xp-ref">{m.referencia}</p>
      </>}
      <p className="xp-v-nota">{conProfe ? TEXTOS.profe : TEXTOS.solo}</p>
    </div>
  )
}

// La tarjeta de la izquierda en escritorio (como el Desafío).
function ComoFunciona({ conProfe }) {
  return (
    <div className="df-info">
      <h3>Cómo funciona</h3>
      <ul>
        <li>Gira la ruleta: te toca alguien con su forma de hablar.</li>
        <li>Explícale la idea con tus palabras y con su regla.</li>
        <li>Si le falta algo, te pregunta. Al final te dice si lo entendió.</li>
        <li>Lo entendió +3 ovillos, casi +1. Volver a girar cuesta 1.</li>
        {conProfe && <li>Esto lo lee tu profe.</li>}
        <li>Si lo dejas para luego, queda en tu cuaderno.</li>
      </ul>
    </div>
  )
}

// ── Hook del lector ────────────────────────────────────────

/**
 * @param {{ libroId: string|null, userId: string|null, capNum: number|null,
 *   gatoColor?: string, movil?: boolean, deshabilitado?: boolean }} opts
 */
export function useExplicaseloLector({ libroId, userId, capNum, gatoColor = 'negro', movil = false, deshabilitado = false }) {
  const ex = useExplicaselo(deshabilitado ? null : libroId, userId)
  const momentos = useMemo(() => ex.estado?.momentos ?? [], [ex.estado])
  const conProfe = !!ex.estado?.con_profe
  const saldo = ex.estado?.saldo ?? 0
  const [activo, setActivo] = useState(null)       // { momento, continuar }
  const cerrados = useRef(new Set())

  const interceptar = useCallback((continuar) => {
    if (activo) return true
    const m = momentoQueToca(/** @type {any} */ (momentos), capNum, cerrados.current)
    if (!m) return false
    setActivo({ momento: m.momento, continuar })
    return true
  }, [activo, momentos, capNum])

  const cerrar = useCallback(() => {
    if (!activo) return
    cerrados.current.add(activo.momento)
    const { continuar } = activo
    setActivo(null)
    continuar?.()
  }, [activo])

  useEffect(() => {
    if (!activo) return
    const h = (e) => { if (e.key === 'Escape' && !ex.ocupado) cerrar() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [activo, cerrar, ex.ocupado])

  const girar = useCallback((momento) => ex.girar(momento), [ex])
  const enviar = useCallback((momento, texto) => ex.enviar({ momento, texto }), [ex])

  const m = activo ? momentos.find(x => x.momento === activo.momento) : null
  let panel = null
  if (m) {
    const p = (
      <PanelExplicaselo key={m.momento} m={m} conProfe={conProfe} saldo={saldo} gatoColor={gatoColor} movil={movil}
        ocupado={ex.ocupado} onGirar={() => girar(m.momento)} onEnviar={(t) => enviar(m.momento, t)} onCerrar={cerrar} />
    )
    panel = movil
      ? <div className="lm-backdrop df-fondo-movil">
          <div className="lm-sheet df-hoja" role="dialog" aria-label="Explícaselo a…">
            <div className="lm-grip" />
            {p}
          </div>
        </div>
      : createPortal(
          <div className="df-escena" role="dialog" aria-label="Explícaselo a…">
            <div className="df-mesa">
              <ComoFunciona conProfe={conProfe} />
              {p}
            </div>
          </div>,
          document.body,
        )
  }

  const empezadas = useMemo(() => momentos.filter(x => x.estado !== 'nueva'), [momentos])

  return {
    interceptar: momentos.length ? interceptar : null,
    hayPendiente: !!momentoQueToca(/** @type {any} */ (momentos), capNum, cerrados.current),
    panel,
    cuaderno: empezadas.length ? { momentos: empezadas, conProfe, saldo, gatoColor, ocupado: ex.ocupado, girar, enviar } : null,
  }
}
