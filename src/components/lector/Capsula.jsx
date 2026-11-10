// La cápsula del tiempo en el lector (libros de no ficción, migración 098).
// Al abrir el libro (antes de terminar el capítulo 1) el gato propone guardar
// lo que piensas hoy: unas preguntas abiertas que se responden en texto. Al
// responderlas se sella. Al pasar del último capítulo se abre: respondes lo
// mismo sin ver lo de antes y luego ves las dos respuestas lado a lado.
// Sin IA, sin ovillos, sin respuestas buenas ni malas. Queda en el Cuaderno.
//
// useCapsulaLector devuelve las piezas que cada lector reparte:
//   · interceptar(continuar) → al pasar del último capítulo. true = abrió la
//                     cápsula y el lector no avanza; al cerrarla se llama a `continuar`.
//   · hayPendiente → saltaría ahora al pasar del último capítulo (el móvil lo
//                     usa para dejar el botón de avanzar en la última página).
//   · panel        → pantalla entera (escritorio) u hoja alta (móvil).
//   · cuaderno     → lo que necesita la pestaña «Cápsula» del Cuaderno.
// Sin usuario, sin la 098 o sin cápsula en el libro, no aparece nada.
//
// Maqueta: Documents/Inmersia_maquetas/colegios/maqueta-capsula-noficcion.html
// Reglas de las preguntas: Documentation/colegios/capsula-prompt.md.
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useCapsula, ErrorCapsula } from '../../hooks/useCapsula.js'
import { completas, tocaAlEmpezar, tocaAlTerminar, fechaCapsula, MIN_CARACTERES, MAX_CARACTERES } from '../../utils/capsula.js'
import '../../styles/corazonada.css'
import '../../styles/desafio.css'
import '../../styles/capsula.css'

// Frases fijas del gato (las de la maqueta; Juan puede cambiarlas).
const TEXTOS = {
  sub: { antes: 'antes de empezar', sellada: 'sellada', despues: 'al terminar el libro', comparar: 'antes y ahora' },
  antes1: 'Antes de empezar, guardemos lo que piensas hoy. Cuando termines el libro, abrimos la cápsula y vemos si algo cambió.',
  antes2: 'No hay respuestas buenas ni malas: escribe lo que piensas ahora, aunque no estés seguro.',
  despues1: '¡Terminaste el libro! Abramos tu cápsula.',
  despues2: 'Antes de mirar lo que dijiste, responde otra vez. Sin trampas: lo de antes está guardado.',
  selladaTitulo: '¡Cápsula sellada!',
  selladaTexto: 'La abrimos cuando termines el libro. Hasta entonces, nadie la ve: ni tú.',
  selladaProfe: 'La abrimos cuando termines el libro. Hasta entonces, solo la ve tu profe.',
  compararTitulo: 'Así pensabas al empezar, y así piensas ahora.',
  compararTexto: 'Léelas juntas: ¿qué cambió? Ninguna respuesta es mejor que otra.',
  placeholder: 'Con tus palabras. Una o dos frases bastan.',
}
const ERRORES = {
  ya_empezaste: 'Ya empezaste el libro: la cápsula se sella antes de leer.',
  respuestas_incompletas: 'Responde todas las preguntas.',
  respuesta_larga: `Alguna respuesta es demasiado larga: como mucho ${MAX_CARACTERES} caracteres.`,
  no_se_puede: 'No se pudo guardar. Prueba otra vez.',
}
const gatoSrc = (color) => `/assets/landing/gatos/${color}-6.webp`

// ── La lata ────────────────────────────────────────────────

/** @param {{ abierta?: boolean, fecha?: string, titulo?: string }} props */
export function Lata({ abierta = false, fecha = '', titulo = '' }) {
  return (
    <div className={'caps-lata' + (abierta ? ' is-abierta' : '')} aria-hidden="true">
      <div className="caps-papeles"><i /><i /><i /></div>
      <div className="caps-tapa" />
      <div className="caps-cuerpo">
        <div className="caps-etiqueta"><b>Mi cápsula</b>{titulo}<br />{fecha ? `Sellada ${fecha}` : 'Sin sellar'}</div>
      </div>
    </div>
  )
}

// ── El panel (lector y Cuaderno) ───────────────────────────

/**
 * @param {{ c: import('../../utils/capsula.js').EstadoCapsula,
 *   modo: 'empezar'|'terminar'|'cuaderno', puedeAbrir?: boolean,
 *   titulo: string, gatoColor: string, ocupado: boolean,
 *   onSellar?: (r: string[]) => Promise<unknown>, onAbrir: (r: string[]) => Promise<unknown>,
 *   onCerrar?: () => void, movil?: boolean }} props
 */
export function PanelCapsula({ c, modo, puedeAbrir = false, titulo, gatoColor, ocupado, onSellar, onAbrir, onCerrar, movil = false }) {
  const n = c.preguntas.length
  const [respuestas, setRespuestas] = useState(() => c.preguntas.map(() => ''))
  const [error, setError] = useState(null)
  const fecha = fechaCapsula(c.sellada_at)
  const enCuaderno = modo === 'cuaderno'

  const fase = c.estado === 'abierta' ? 'comparar'
    : c.estado === 'nueva' ? 'antes'
    : modo === 'terminar' || (enCuaderno && puedeAbrir) ? 'despues'
    : 'sellada'
  const listas = completas(respuestas, n)
  // Si escribió algo pero muy corto, se le dice por qué no puede seguir.
  const cortas = respuestas.some(t => { const k = t.trim().length; return k > 0 && k < MIN_CARACTERES })
  const falta = (todo) => cortas ? `Escribe al menos ${MIN_CARACTERES} letras en cada respuesta.` : todo

  const enviar = async () => {
    if (!listas || ocupado) return
    setError(null)
    try {
      await (fase === 'antes' ? onSellar : onAbrir)?.(respuestas.map(t => t.trim()))
      setRespuestas(c.preguntas.map(() => ''))
    } catch (e) {
      setError(e instanceof ErrorCapsula ? (ERRORES[e.codigo] || ERRORES.no_se_puede) : ERRORES.no_se_puede)
    }
  }

  const preguntas = (
    <>
      {c.preguntas.map((q, i) => (
        <div key={q.id} className="caps-preg">
          <p><span className="caps-n">PREGUNTA {i + 1} DE {n}</span>{q.texto}</p>
          <textarea value={respuestas[i]} placeholder={TEXTOS.placeholder} aria-label={q.texto}
            maxLength={MAX_CARACTERES} disabled={ocupado} rows={2}
            onChange={e => { const v = e.target.value; setRespuestas(r => r.map((x, j) => j === i ? v : x)) }} />
        </div>
      ))}
    </>
  )

  let cuerpo, pie
  if (fase === 'antes') {
    cuerpo = <>
      <div className="df-bub is-gato">{TEXTOS.antes1}</div>
      <div className="df-bub is-gato">{TEXTOS.antes2}</div>
      {movil && <div className="caps-sellada"><Lata titulo={titulo} /></div>}
      {preguntas}
    </>
    pie = <>
      <small>{listas ? '¡Lista para sellar!' : falta(`Responde las ${n} preguntas.`)}</small>
      <button type="button" className="cz-btn is-main" disabled={!listas || ocupado} onClick={enviar}>Sellar la cápsula</button>
    </>
  } else if (fase === 'sellada') {
    cuerpo = (
      <div className="caps-sellada">
        <Lata fecha={fecha} titulo={titulo} />
        <span className="caps-sello">SELLADA · {fecha.toUpperCase()}</span>
        <b>{TEXTOS.selladaTitulo}</b>
        <span>{c.con_profe ? TEXTOS.selladaProfe : TEXTOS.selladaTexto}</span>
      </div>
    )
    pie = !enCuaderno && onCerrar && <><small /><button type="button" className="cz-btn is-main" onClick={onCerrar}>A leer</button></>
  } else if (fase === 'despues') {
    cuerpo = <>
      <div className="df-bub is-gato">{TEXTOS.despues1}</div>
      <div className="caps-sellada"><Lata abierta fecha={fecha} titulo={titulo} /></div>
      <div className="df-bub is-gato">{TEXTOS.despues2}</div>
      {preguntas}
    </>
    pie = <>
      <small>{listas ? '¡Lista!' : falta('Responde todo para comparar.')}</small>
      <button type="button" className="cz-btn is-main" disabled={!listas || ocupado} onClick={enviar}>Ver qué cambió</button>
    </>
  } else {
    cuerpo = <>
      <div className="caps-resumen"><b>{TEXTOS.compararTitulo}</b><span>{TEXTOS.compararTexto}</span></div>
      {c.preguntas.map((q, i) => (
        <div key={q.id} className="caps-comp">
          <p>{q.texto}</p>
          <div className={'caps-dos' + (movil ? ' is-movil' : '')}>
            <div className="caps-a"><small>Antes · {fecha}</small>{c.antes?.[i]}</div>
            <div className="caps-b"><small>Ahora</small>{c.ahora?.[i]}</div>
          </div>
        </div>
      ))}
    </>
    pie = !enCuaderno && onCerrar && <><small>Queda guardada en tu cuaderno.</small><button type="button" className="cz-btn is-main" onClick={onCerrar}>Listo</button></>
  }

  const conLuego = !enCuaderno && onCerrar && (fase === 'antes' || fase === 'despues')
  return (
    <div className={'caps-panel' + (enCuaderno ? ' is-cuaderno' : '')}>
      <div className="df-chat-h">
        <img className="df-ava" src={gatoSrc(gatoColor)} alt="" />
        <div className="df-who"><b>Tu gato</b><span>Cápsula del tiempo · {TEXTOS.sub[fase]}</span></div>
        {c.con_profe && <span className="df-profe">Lo lee tu profe</span>}
        {conLuego && <button type="button" className="df-luego" onClick={onCerrar} disabled={ocupado}>Ahora no</button>}
      </div>
      <div className="caps-body">{cuerpo}</div>
      {(pie || error) && (
        <div className="caps-pie">
          {error && <p className="df-error" role="alert">{error}</p>}
          {pie && <div className="caps-pie-fila">{pie}</div>}
        </div>
      )}
    </div>
  )
}

// La tarjeta de la izquierda en escritorio (maqueta, PC).
function ComoFunciona({ c, titulo, abierta }) {
  return (
    <div className="df-info caps-info">
      <h3>Cómo funciona</h3>
      <Lata abierta={abierta} fecha={fechaCapsula(c.sellada_at)} titulo={titulo} />
      <ul>
        <li>Al empezar, respondes {c.preguntas.length} preguntas con tus palabras: lo que piensas hoy.</li>
        <li>{c.con_profe ? 'La cápsula se sella: tú no la ves hasta el final; tu profe sí la lee.' : 'La cápsula se sella: nadie la ve, ni tú.'}</li>
        <li>Al terminar el libro, respondes lo mismo sin mirar.</li>
        <li>Luego ves en qué cambiaste. No hay respuestas buenas ni malas.</li>
      </ul>
    </div>
  )
}

// ── Hook del lector ────────────────────────────────────────

/**
 * @param {{ libroId: string|null, userId: string|null, titulo?: string,
 *   chapterIndex: number, enUltimoCapitulo: boolean, listo: boolean,
 *   terminado?: boolean, gatoColor?: string, movil?: boolean, deshabilitado?: boolean }} opts
 *   listo: el lector ya sabe en qué capítulo está (para no saltar antes de restaurar el progreso).
 *   terminado: el libro cuenta como leído (en el Cuaderno se puede abrir la cápsula).
 */
export function useCapsulaLector({ libroId, userId, titulo = '', chapterIndex, enUltimoCapitulo, listo, terminado = false,
  gatoColor = 'negro', movil = false, deshabilitado = false }) {
  const cp = useCapsula(deshabilitado ? null : libroId, userId)
  const c = deshabilitado ? null : cp.estado
  // Al empezar: «Ahora no» o «A leer» la callan en esta sesión. `recienSellada`
  // deja ver la lata sellada después de sellar (ya no «toca» empezar).
  const [inicioCerrado, setInicioCerrado] = useState(false)
  const [recienSellada, setRecienSellada] = useState(false)
  // Al terminar. En refs además de en estado: al cerrar se llama a `continuar`
  // en el acto, y el lector vuelve a preguntar con el render de antes.
  const [final, setFinal] = useState(null)   // { continuar } | null
  const [finalCerrado, setFinalCerrado] = useState(false)
  const finalRef = useRef(null)
  const finalCerradoRef = useRef(false)

  const abiertoInicio = !!c && listo && cp.listo && !inicioCerrado
    && (recienSellada || tocaAlEmpezar(c, chapterIndex, false))
  const modo = final ? 'terminar' : abiertoInicio ? 'empezar' : null

  const interceptar = useCallback((continuar) => {
    if (finalRef.current) return true
    if (!tocaAlTerminar(c, enUltimoCapitulo, finalCerradoRef.current)) return false
    finalRef.current = { continuar }
    setFinal(finalRef.current)
    return true
  }, [c, enUltimoCapitulo])

  const cerrar = useCallback(() => {
    const f = finalRef.current
    if (!f) { setInicioCerrado(true); return }
    finalRef.current = null
    finalCerradoRef.current = true
    setFinal(null)
    setFinalCerrado(true)
    f.continuar?.()
  }, [])

  // Escape = «Ahora no» / «A leer» / «Listo».
  useEffect(() => {
    if (!modo) return
    const h = (e) => { if (e.key === 'Escape' && !cp.ocupado) cerrar() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [modo, cerrar, cp.ocupado])

  const sellar = useCallback(async (r) => { await cp.sellar(r); setRecienSellada(true) }, [cp])

  let panel = null
  if (c && modo) {
    const p = (
      <PanelCapsula key={modo} c={c} modo={modo} titulo={titulo} gatoColor={gatoColor} movil={movil}
        ocupado={cp.ocupado} onSellar={sellar} onAbrir={cp.abrir} onCerrar={cerrar} />
    )
    panel = movil
      ? <div className="lm-backdrop df-fondo-movil">
          <div className="lm-sheet df-hoja" role="dialog" aria-label="Cápsula del tiempo">
            <div className="lm-grip" />
            {p}
          </div>
        </div>
      : createPortal(
          <div className="df-escena" role="dialog" aria-label="Cápsula del tiempo">
            <div className="df-mesa">
              <ComoFunciona c={c} titulo={titulo} abierta={c.estado === 'abierta' || modo === 'terminar'} />
              {p}
            </div>
          </div>,
          document.body,
        )
  }

  return {
    interceptar: c ? interceptar : null,
    hayPendiente: tocaAlTerminar(c, enUltimoCapitulo, finalCerrado),
    panel,
    cuaderno: c && c.estado !== 'nueva'
      ? { c, titulo, gatoColor, puedeAbrir: terminado, ocupado: cp.ocupado, abrir: cp.abrir }
      : null,
  }
}
