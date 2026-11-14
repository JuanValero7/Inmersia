// El falsificador en el lector (no ficción). Igual que el concurso: al
// intentar pasar la página donde hay un párrafo sospechoso, se apagan las
// luces, cae un foco sobre el párrafo (en su sitio) y aparece la tarjeta:
// «¿Quién escribió este párrafo?» → el autor o el gato.
//
// useFalsificadorLector devuelve las piezas que cada lector reparte:
//   · listo / falsos → el lector espera a `listo` para paginar y mete `falsos`
//                      en el capítulo con conFalsos (utils/falsificador.js).
//   · falsosDe(n)    → los falsos del capítulo n (para paginar el anterior).
//   · interceptar(continuar) → para el botón/tecla de avanzar, como el concurso.
//   · renderFalso(p) → lo de dentro del <p> del falso: tachado y con el sello
//                      «LO COLÓ EL GATO» si ya se respondió. Los reales no
//                      llevan marca: la información correcta se lee limpia.
//   · panel          → el foco y la tarjeta (escritorio) u hoja (móvil).
//
// Sin «Ahora no»: si el falso se queda sin responder, el alumno se queda con
// una mentira. Si sale de la página por otro lado (menú de capítulos, flecha
// atrás), el foco se apaga y vuelve a saltar la próxima vez.
// El sello va ENCIMA del párrafo (position absolute): no cambian el alto,
// así que no hay que volver a paginar al responder.
// Vista previa del escritor («Ver en tu libro» desde su editor): la tarjeta
// se abre sola sobre ese párrafo y el veredicto sale de su propio JSON, sin
// guardar la respuesta ni mover ovillos.
// Reglas: Documentation/colegios/falsificador-prompt.md.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useFalsificador } from '../../hooks/useFalsificador.js'
import { useJuegoEscritor } from '../../hooks/useEscritor.js'
import { esComienzo, trozoEn } from '../../utils/falsificador.js'
import { rectsDe, posicionar } from './Concurso.jsx'
import { Ovillo } from './Corazonada.jsx'
import '../../styles/corazonada.css'
import '../../styles/concurso.css'
import '../../styles/falsificador.css'

const gatoSrc = (color) => `/assets/landing/gatos/${color}-6.webp`

/** Los <p> en pantalla de un sospechoso (los dos trozos si está partido en doble página). */
function elementos(raiz, item, idReal) {
  if (!raiz) return []
  const sel = item.texto
    ? `[data-falso-id="${window.CSS.escape(item.id)}"]`
    : idReal ? `[data-parrafo-id="${window.CSS.escape(String(idReal))}"]` : null
  return sel ? [...raiz.querySelectorAll(sel)] : []
}

function rectsDeElementos(els) {
  return rectsDe(els.map(el => {
    const r = document.createRange()
    r.selectNodeContents(el)
    return r
  }))
}

// Escritorio. Con sitio al lado del libro, como el concurso. Sin sitio, la
// tarjeta va encima del libro; pero un falso puede ocupar las dos páginas, así
// que va en la página con menos párrafo y arriba o abajo de él, sin taparlo.
const ANCHO = 380
const ALTO = 300
function posicionarFx(rects) {
  const base = posicionar(rects)
  const libro = document.querySelector('.book-shadow')?.getBoundingClientRect()
  if (!libro || !rects.length) return base
  const alLado = base.left >= libro.right || base.left + ANCHO <= libro.left
  if (alLado) return base
  const mitad = (libro.left + libro.right) / 2
  const der = rects.filter(r => r.left >= mitad).length <= rects.filter(r => r.left < mitad).length
  const left = der ? libro.right - ANCHO - 16 : libro.left + 16
  const enLado = rects.filter(r => (r.left >= mitad) === der)
  if (!enLado.length) return { left, top: base.top }
  const arriba = Math.min(...enLado.map(r => r.top))
  const abajo = Math.max(...enLado.map(r => r.bottom))
  if (abajo + 16 + ALTO <= window.innerHeight - 8) return { left, top: abajo + 16 }
  // Encima del párrafo: anclada por abajo, para que al crecer (el veredicto) suba y no lo tape.
  if (arriba - 16 - ALTO >= 8) return { left, bottom: window.innerHeight - arriba + 16 }
  return { left, top: base.top }
}

// ── Tarjeta ────────────────────────────────────────────────

function Tarjeta({ item, autor, saldo, gatoColor, sigue, viene, ocupado, onResponder, onResto, onComienzo, onVolver, ensayo = false }) {
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const r = resultado ? resultado.estado.items.find(x => x.id === item.id)?.respuesta : null

  const elegir = async (dice) => {
    setError(null)
    try { setResultado(await onResponder(dice)) }
    catch { setError('No se pudo guardar. Prueba otra vez.') }
  }

  const head = (
    <div className="cc-head">
      <div><div className="cc-kicker">{ensayo ? 'El falsificador · así lo verá tu lector' : 'El falsificador'}</div><h3>{r ? 'El veredicto' : '¿Quién escribió este párrafo?'}</h3></div>
      {!ensayo && <span className="cc-saldo" title="Tus ovillos en este libro"><Ovillo />{resultado?.estado.saldo ?? saldo}</span>}
    </div>
  )

  if (r) {
    const linea = r.falso
      ? (r.acierto ? 'Era del gato: este párrafo es inventado.' : 'Te la coló: era del gato.')
      : (r.acierto ? `Es de ${autor}.` : `Este sí es de ${autor}, tal cual en el libro.`)
    const premio = resultado.premio
    return (
      <div className="cc-panel">
        {head}
        <div className={'cc-veredicto ' + (r.acierto ? 'is-ok' : 'is-no')}>
          <span className="cc-big">{r.acierto ? '¡Correeeecto!' : 'Ehhhh, no'}</span>
          <span>{linea}</span>
          {premio !== 0 && <span className="cc-gana"><Ovillo />{premio > 0 ? '+1 ovillo' : '−1 ovillo'}</span>}
        </div>
        {r.falso && r.raro && <div className="fx-raro"><b>Lo raro:</b> {r.raro}</div>}
        <div className="cc-ref"><small>{r.falso ? 'Lo que dice el libro' : `Lo que dice ${autor} aquí`}</small><p>{r.verdad}</p></div>
        <div className="cc-btns"><button type="button" className="cc-btn is-main" onClick={onVolver}>Volver a la lectura</button></div>
      </div>
    )
  }

  return (
    <div className="cc-panel">
      {head}
      <div className="fx-sub">Puede ser del libro o puede haberlo colado el gato.</div>
      {sigue && <div className="fx-aviso">El párrafo sigue en la página siguiente.<button type="button" onClick={onResto}>Leer el resto ›</button></div>}
      {!sigue && viene && <div className="fx-aviso">Este es el final del párrafo.<button type="button" onClick={onComienzo}>‹ Ver el comienzo</button></div>}
      <div className="fx-opts">
        <button type="button" className="fx-opt" disabled={ocupado} onClick={() => elegir('autor')}>
          <span className="fx-ic" aria-hidden="true">📖</span><span>Lo escribió {autor}<small>Es del libro</small></span>
        </button>
        <button type="button" className="fx-opt" disabled={ocupado} onClick={() => elegir('gato')}>
          <span className="fx-ic"><img src={gatoSrc(gatoColor)} alt="" /></span><span>Lo coló el gato<small>Es inventado</small></span>
        </button>
      </div>
      {error && <p className="cc-error" role="alert">{error}</p>}
      {ensayo && <p className="fx-sub">Vista previa: tu respuesta no se guarda.</p>}
    </div>
  )
}

// ── Hook del lector ────────────────────────────────────────

/**
 * @param {{ libroId: string|null, userId: string|null, capNum: number|null,
 *   visibles: any[], previas: any[], siguientes: any[], clavePagina: string,
 *   atras?: () => void, gatoColor?: string, movil?: boolean, deshabilitado?: boolean, soloVer?: boolean,
 *   ensayo?: string|null, adelante?: () => void }} opts
 *   soloVer: los falsos entran en el capítulo pero no salta la tarjeta al pasar página (el escritor revisando su libro).
 *   ensayo: id de un sospechoso: vista previa del escritor (la tarjeta se abre sola sobre él, sin guardar nada).
 *   adelante: pasar de página (para «Leer el resto» en la vista previa).
 *   visibles: los párrafos (con los falsos) que hay en pantalla; previas y
 *   siguientes: los de la pantalla de antes y de después (para saber si el
 *   párrafo viene de la anterior o sigue en la siguiente).
 */
export function useFalsificadorLector({ libroId, userId, capNum, visibles, previas, siguientes, clavePagina,
  atras = null, gatoColor = 'negro', movil = false, deshabilitado = false, soloVer = false, ensayo = null, adelante = null }) {
  const fx = useFalsificador(deshabilitado ? null : libroId, userId)
  // Vista previa: el veredicto sale del JSON del dueño (juego_escritor, solo él lo lee).
  const propio = useJuegoEscritor(libroId, 'falsificador', !!ensayo && !deshabilitado).data?.datos
  const items = useMemo(() => fx.estado?.items ?? [], [fx.estado])
  const autor = (ensayo && propio?.autor) || fx.estado?.autor || 'el autor'

  // Solo cambia si cambia DÓNDE van los falsos: responder no repagina.
  const clave = items.filter(x => x.cap === capNum && x.texto).map(x => `${x.id}@${x.parrafo}`).join(',')
  const falsos = useMemo(() => items.filter(x => x.cap === capNum && x.texto), [clave]) // eslint-disable-line react-hooks/exhaustive-deps
  const falsosDe = useCallback((n) => items.filter(x => x.cap === n && x.texto), [items])

  const [activa, setActiva] = useState(null)    // { id, continuar }
  const [medida, setMedida] = useState(null)    // { rects, sigue, viene }
  // Móvil: primero se lee. La tarjeta empieza bajada (una barra fina) y se
  // sube con «Responder»; se puede volver a bajar para releer.
  const [hojaAbierta, setHojaAbierta] = useState(false)
  useEffect(() => { setHojaAbierta(false) }, [activa?.id, clavePagina])
  // Las ya respondidas: el `continuar` es el handleNext del render en que se
  // abrió, con la lista de entonces (como en el concurso).
  const respondidas = useRef(new Set())
  // «Leer el resto» / «Ver el comienzo» cambian de página sin apagar el foco.
  const pasando = useRef(false)

  const raiz = useCallback(() => document.querySelector(movil ? '[data-lm-pagebox]' : '.book-shadow'), [movil])
  const item = activa ? items.find(x => x.id === activa.id) : null

  const medir = useCallback(() => {
    if (!item) { setMedida(null); return }
    const trozo = trozoEn(item, visibles)
    const els = elementos(raiz(), item, trozo?.id)
    const sigue = !!trozoEn(item, siguientes) && !!trozo
    const viene = !!trozoEn(item, previas) && !!trozo
    setMedida({ rects: rectsDeElementos(els), sigue, viene })
  }, [item, visibles, previas, siguientes, raiz])

  useEffect(() => {
    if (!activa) return
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [activa, medir, clavePagina])

  // Si la página cambia por otro lado (capítulo, flecha atrás), se apaga.
  useEffect(() => {
    if (pasando.current) { pasando.current = false; return }
    setActiva(null)
  }, [clavePagina])

  const interceptar = useCallback((continuar) => {
    if (soloVer || pasando.current) return false
    if (activa) return true
    for (const x of items) {
      if (x.cap !== capNum || x.respuesta || respondidas.current.has(x.id)) continue
      const trozo = trozoEn(x, visibles)
      if (!trozo || !elementos(raiz(), x, trozo.id).length) continue
      setActiva({ id: x.id, continuar })
      return true
    }
    return false
  }, [activa, items, capNum, visibles, raiz, soloVer])

  // Vista previa: se abre sola, una vez, cuando su párrafo está en pantalla.
  const ensayoAbierto = useRef(false)
  useEffect(() => {
    if (!ensayo || ensayoAbierto.current || activa || !propio) return
    const x = items.find(i => i.id === ensayo)
    if (!x || x.cap !== capNum) return
    const trozo = trozoEn(x, visibles)
    if (!trozo || !elementos(raiz(), x, trozo.id).length) return
    ensayoAbierto.current = true
    setActiva({ id: x.id, continuar: adelante })
  }, [ensayo, activa, propio, items, capNum, visibles, raiz, adelante])
  const responderEnsayo = useCallback(async (id, dice) => {
    const x = propio?.items?.find(i => i.id === id)
    if (!x) throw new Error('sin datos')
    const respuesta = { dijo: dice, acierto: (dice === 'gato') === !!x.falso, falso: !!x.falso, raro: x.raro, verdad: x.verdad }
    return { acierto: respuesta.acierto, premio: 0, estado: { saldo: 0, autor: propio.autor, items: [{ id, respuesta }] } }
  }, [propio])

  const cerrar = useCallback(() => {
    if (!activa) return
    respondidas.current.add(activa.id)
    setActiva(null)          // se queda en la página: el falso ya se ve tachado
  }, [activa])

  const resto = useCallback(() => {
    if (!activa?.continuar) return
    pasando.current = true
    activa.continuar()
  }, [activa])

  const comienzo = useCallback(() => {
    if (!atras) return
    pasando.current = true
    atras()
  }, [atras])

  // Lo de dentro del <p> del falso. Ya respondido: tachado y con el sello
  // (solo en el primer trozo si el paginador lo partió).
  const respuestaDe = useMemo(() => Object.fromEntries(items.filter(x => x.respuesta).map(x => [x.id, x.respuesta])), [items])
  const renderFalso = useCallback((p) => {
    if (ensayo || !respuestaDe[p.falsoId]) return p.contenido
    return (
      <>
        <span className="fx-tachado">{p.contenido}</span>
        {esComienzo(p) && <span className="fx-sello" aria-label="Este párrafo lo coló el gato">LO COLÓ EL GATO</span>}
      </>
    )
  }, [respuestaDe, ensayo])

  let panel = null
  if (item && medida) {
    const { rects } = medida
    const centro = rects.length ? (rects[0].top + rects[rects.length - 1].bottom) / 2 : 0
    const arriba = movil && centro > window.innerHeight * 0.5
    const pos = movil ? null : posicionarFx(rects)
    const ultimo = rects[rects.length - 1]
    const primero = rects[0]
    const respondida = !ensayo && !!item.respuesta
    const tarjeta = (
      <Tarjeta key={item.id} item={item} autor={autor} saldo={fx.estado?.saldo ?? 0} gatoColor={gatoColor}
        sigue={medida.sigue} viene={medida.viene} ocupado={fx.ocupado}
        onResponder={(dice) => (ensayo ? responderEnsayo(item.id, dice) : fx.responder({ id: item.id, dice }))}
        onResto={resto} onComienzo={atras ? comienzo : null} onVolver={cerrar} ensayo={!!ensayo} />
    )
    panel = createPortal(
      <div className="cc-escena">
        <svg className="cc-noche" width="100%" height="100%" aria-hidden="true">
          <defs>
            <mask id="fx-huecos">
              <rect width="100%" height="100%" fill="white" />
              {rects.map((r, i) => <rect key={i} x={r.left - 4} y={r.top - 2} width={r.right - r.left + 8} height={r.bottom - r.top + 4} rx="5" fill="black" />)}
            </mask>
          </defs>
          <rect width="100%" height="100%" mask="url(#fx-huecos)" />
        </svg>
        {rects.map((r, i) => <div key={i} className="cc-foco" style={{ left: r.left - 4, top: r.top - 2, width: r.right - r.left + 8, height: r.bottom - r.top + 4 }} />)}
        {/* Los chips del párrafo partido son la forma de moverse: llevan a la otra página sin apagar el foco. */}
        {!respondida && medida.sigue && ultimo && (
          <button type="button" className="fx-pill" style={{ left: ultimo.left, top: ultimo.bottom + 4 }} onClick={resto}>Continúa en la página siguiente ›</button>
        )}
        {!respondida && medida.viene && primero && (
          <button type="button" className="fx-pill" style={{ left: primero.left, top: Math.max(4, primero.top - 30) }}
            onClick={atras ? comienzo : undefined} disabled={!atras}>‹ Viene de la página anterior</button>
        )}
        {movil && !hojaAbierta && (() => {
          // La barra va donde tapa menos párrafo: arriba o abajo.
          const barraArriba = primero && ultimo && primero.top > window.innerHeight - ultimo.bottom
          return (
            <div className={'fx-barra' + (barraArriba ? ' is-arriba' : '')} role="dialog" aria-label="El falsificador">
              <span className="fx-barra-t"><small>El falsificador</small>¿Quién escribió este párrafo?</span>
              <button type="button" className="is-main" onClick={() => setHojaAbierta(true)}>{respondida ? 'Ver el veredicto ▴' : 'Responder ▴'}</button>
            </div>
          )
        })()}
        {movil
          // La tarjeta sigue montada al bajarla: no se pierde el veredicto.
          ? <div className={'cc-hoja' + (arriba ? ' is-arriba' : '')} role="dialog" aria-label="El falsificador" hidden={!hojaAbierta}>
              <button type="button" className="fx-asa" onClick={() => setHojaAbierta(false)}>▾ Bajar para leer el párrafo</button>
              {tarjeta}
            </div>
          : <div className="cc-tarjeta" role="dialog" aria-label="El falsificador" style={pos.bottom != null
              ? { left: pos.left, bottom: pos.bottom, maxHeight: window.innerHeight - pos.bottom - 8 }
              : { left: pos.left, top: pos.top, maxHeight: window.innerHeight - pos.top - 8 }}>{tarjeta}</div>}
      </div>,
      document.body,
    )
  }

  return {
    listo: fx.listo,
    falsos,
    falsosDe,
    interceptar: items.length ? interceptar : null,
    renderFalso: items.length ? renderFalso : null,
    panel,
  }
}
