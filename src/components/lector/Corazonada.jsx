// Corazonadas en el lector: chip entre párrafos, corazón en la revelación y la
// tarjeta (escritorio) u hoja (móvil) donde se juega.
//
// useCorazonadasLector devuelve las piezas que cada lector reparte:
//   · listo        → el lector espera a esto para paginar (el chip ocupa sitio)
//   · chips        → las corazonadas cuyo chip va en este capítulo (para
//                    utils/corazonadas.js → conCorazonadas antes de paginar)
//   · renderChip   → el bloque del chip, para los ítems tipo 'corazonada'
//   · renderCorazon→ el corazón del margen, para el párrafo de una revelación
//   · panel        → la tarjeta/hoja abierta y el aviso de «guardada»
// Sin usuario, sin la 089 o sin corazonadas en el libro, no aparece nada.
//
// «Si llegas, la pierdes»: en cuanto la página con el párrafo de la revelación
// está en pantalla, si no jugaste, se avisa a la base de datos y el chip queda
// cerrado. Reglas: Documentation/colegios/corazonadas-prompt.md.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useCorazonadas } from '../../hooks/useCorazonadas.js'
import { CHIP_ALTO } from '../../utils/corazonadas.js'
import '../../styles/corazonada.css'

const LETRAS = ['A', 'B', 'C']
// Pose del gato según cuántos ovillos te juegas (como en la maqueta).
const POSE = { 0: '7', 1: '6', 2: '4', 3: '1' }
const NIVEL = { 1: 'Me lo huelo', 2: 'Bastante seguro', 3: '¡Segurísimo!' }
const ANCHO = 330

const gatoSrc = (color, pose) => `/assets/landing/gatos/${color}-${pose}.webp`

function Corazon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.6 1.2 4.4 2.5.8-1.3 2.2-2.5 4.4-2.5 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"/></svg>
  )
}

function Ovillo() {
  return (
    <svg className="cz-ovillo" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M33 33 q5 9 13 7" className="cz-ovillo-hebra" />
      <circle cx="22" cy="22" r="17" className="cz-ovillo-bola" />
      <g className="cz-ovillo-hebra"><path d="M8 16 q14 -7 27 5" /><path d="M6 24 q16 -9 31 4" /><path d="M10 32 q13 -10 25 -1" /><path d="M17 6 q-7 15 2 32" /><path d="M26 6 q-8 15 0 32" /></g>
    </svg>
  )
}

const ovillos = (n) => `${n} ${n === 1 ? 'ovillo' : 'ovillos'}`

function Chip({ cz, onAbrir }) {
  if (cz.estado === 'perdida') {
    return <span className="cz-chip is-perdida"><Corazon />Corazonada <small>El libro ya lo contó</small></span>
  }
  if (cz.estado === 'jugada' || cz.estado === 'cobrada') {
    return (
      <button type="button" className="cz-chip is-jugada" onClick={(e) => { e.stopPropagation(); onAbrir(cz, e.currentTarget) }}>
        <Corazon />Tu corazonada <small>{LETRAS[cz.opcion]} · {ovillos(cz.ovillos)}</small>
      </button>
    )
  }
  return (
    <button type="button" className="cz-chip" onClick={(e) => { e.stopPropagation(); onAbrir(cz, e.currentTarget) }}>
      <Corazon />Corazonada <small>{cz.pregunta}</small>
    </button>
  )
}

function MiOpcion({ cz }) {
  return (
    <div className="cz-mia">
      <span className="cz-lt">{LETRAS[cz.opcion]}</span>{cz.opciones[cz.opcion]}
      <small>{Array.from({ length: cz.ovillos }, (_, i) => <Ovillo key={i} />)}</small>
    </div>
  )
}

// Lo de dentro de la tarjeta/hoja. `modo`: 'jugar' (sin jugar), 'ver' (jugada,
// el libro aún no lo contó), 'revelar' (tocó el corazón) o 'resultado' (cobrada).
function Contenido({ cz, modo, saldo, gatoColor, ocupado, onJugar, onCobrar, onCerrar }) {
  const [sel, setSel] = useState(null)
  const [apuesta, setApuesta] = useState(0)
  const [error, setError] = useState(null)

  const pose = modo === 'jugar' ? POSE[apuesta]
    : modo === 'resultado' ? (cz.acierto ? '2' : '5')
    : '7'
  const kicker = modo === 'jugar' ? 'Corazonada' : `Tu corazonada del capítulo ${cz.chip.cap}`

  const intentar = async (fn) => {
    setError(null)
    try { await fn() } catch (e) { setError(e?.message || 'No se pudo guardar. Prueba otra vez.') }
  }

  return (
    <div className="cz-panel">
      <div className="cz-head">
        <img className="cz-gato" src={gatoSrc(gatoColor, pose)} alt="" />
        <div><div className="cz-kicker">{kicker}</div><h3>{cz.pregunta}</h3></div>
        <span className="cz-saldo" title="Tus ovillos en este libro"><Ovillo />{saldo}</span>
      </div>

      {modo === 'jugar' && (
        <>
          {/* Texto provisional: la voz del gato la escribe Juan. */}
          {cz.sorpresa && <p className="cz-aviso">Ojo: esta es difícil. El libro guarda una sorpresa.</p>}
          <p className="cz-ctx">{cz.contexto}</p>
          <div className="cz-opts">
            {cz.opciones.map((o, i) => (
              <button key={i} type="button" className="cz-opt" aria-pressed={sel === i} onClick={() => setSel(i)}>
                <span className="cz-lt">{LETRAS[i]}</span>{o}
              </button>
            ))}
          </div>
          <div className="cz-apuesta">
            <div className="cz-apuesta-h">¿Cuántos ovillos te juegas?
              <small>{apuesta ? `${NIVEL[apuesta]} · si aciertas, recibes ${apuesta * 2}` : 'Si aciertas, recibes el doble'}</small>
            </div>
            <div className="cz-apuesta-btns">
              {[1, 2, 3].map(n => (
                <button key={n} type="button" aria-pressed={apuesta === n} disabled={n > saldo} onClick={() => setApuesta(n)}>
                  <span>{Array.from({ length: n }, (_, i) => <Ovillo key={i} />)}</span>{n}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="cz-error">{error}</p>}
          <div className="cz-btns">
            <button type="button" className="cz-btn is-luego" onClick={onCerrar}>Ahora no</button>
            <button type="button" className="cz-btn is-main" disabled={sel === null || !apuesta || ocupado}
              onClick={() => intentar(() => onJugar(sel, apuesta))}>
              {ocupado ? 'Guardando…' : 'Guardar corazonada'}
            </button>
          </div>
        </>
      )}

      {modo === 'ver' && (
        <>
          <MiOpcion cz={cz} />
          <p className="cz-nota">El libro te dirá si acertaste. Cuando lo cuente, verás un corazón junto al párrafo.</p>
          <div className="cz-btns"><button type="button" className="cz-btn is-main" onClick={onCerrar}>Seguir leyendo</button></div>
        </>
      )}

      {modo === 'revelar' && (
        <>
          <MiOpcion cz={cz} />
          {error && <p className="cz-error">{error}</p>}
          <div className="cz-btns">
            <button type="button" className="cz-btn is-luego" onClick={onCerrar}>Luego</button>
            <button type="button" className="cz-btn is-main" disabled={ocupado} onClick={() => intentar(onCobrar)}>
              {ocupado ? 'Mirando…' : '¿Acerté?'}
            </button>
          </div>
        </>
      )}

      {modo === 'resultado' && (
        <>
          <MiOpcion cz={cz} />
          {cz.acierto
            ? <div className="cz-revela is-ok"><span className="cz-big">¡Acertaste!</span><span>{cz.resultado}</span>
                <span className="cz-gana"><Ovillo />+{cz.ovillos * 2} ovillos</span></div>
            : <div className="cz-revela is-mal"><span className="cz-big">Esta vez no</span><span>{cz.resultado}</span>
                <span>{cz.ovillos === 1 ? 'El ovillo se queda en la mesa.' : `Los ${cz.ovillos} ovillos se quedan en la mesa.`}</span></div>}
          {cz.pistas?.length > 0 && (
            <div className="cz-pistas">
              <h4>Así se podía saber</h4>
              <ul>{cz.pistas.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
          <div className="cz-btns"><button type="button" className="cz-btn is-main" onClick={onCerrar}>Seguir leyendo</button></div>
        </>
      )}
    </div>
  )
}

// Escritorio: al lado de afuera del libro; si no cabe en la mesa, al otro lado;
// si no cabe en ninguno, encima del libro junto al chip.
function posicionar(ancla) {
  const libro = ancla?.closest('.book-shadow')
  if (!libro) return { left: Math.max(12, (window.innerWidth - ANCHO) / 2), top: 80 }
  const b = libro.getBoundingClientRect(), a = ancla.getBoundingClientRect()
  let der = (a.left + a.width / 2) >= (b.left + b.width / 2)
  const cabeDer = window.innerWidth - b.right >= ANCHO + 30
  const cabeIzq = b.left >= ANCHO + 30
  if (der && !cabeDer && cabeIzq) der = false
  if (!der && !cabeIzq && cabeDer) der = true
  let left = der ? b.right + 22 : b.left - ANCHO - 22
  if (!cabeDer && !cabeIzq) left = Math.min(window.innerWidth - ANCHO - 12, Math.max(12, a.left - ANCHO / 2))
  return { left, top: Math.max(12, Math.min(window.innerHeight - 520, a.top - 60)) }
}

/**
 * @param {{ libroId: string|null, userId: string|null, capNum: number|null,
 *   visibles: { numero?: number, tipo?: string }[], clavePagina: string,
 *   gatoColor?: string, movil?: boolean, deshabilitada?: boolean }} opts
 *   visibles: los párrafos que hay en pantalla (en doble página, las dos).
 */
export function useCorazonadasLector({ libroId, userId, capNum, visibles, clavePagina, gatoColor = 'negro', movil = false, deshabilitada = false }) {
  const cz = useCorazonadas(deshabilitada ? null : libroId, userId)
  const lista = useMemo(() => cz.estado?.corazonadas ?? [], [cz.estado])
  const porId = useMemo(() => Object.fromEntries(lista.map(c => [c.id, c])), [lista])
  // Solo cambia si cambia DÓNDE van los chips: jugar o cobrar no repagina.
  const clavesChips = lista.filter(c => c.chip.cap === capNum).map(c => `${c.id}@${c.chip.parrafo}`).join(',')
  const chips = useMemo(() => lista.filter(c => c.chip.cap === capNum), [clavesChips]) // eslint-disable-line react-hooks/exhaustive-deps
  const revelaciones = useMemo(() => lista.filter(c => c.rev.cap === capNum), [lista, capNum])

  const [abierta, setAbierta] = useState(null)   // { id, modo, pos }
  const [toast, setToast] = useState(null)

  // Si llegas a la revelación sin haber jugado, la pierdes.
  const avisadas = useRef(new Set())
  const { llegar } = cz
  useEffect(() => {
    if (!revelaciones.length) return
    const enPantalla = new Set(visibles.map(p => p.numero))
    for (const c of revelaciones) {
      if (c.estado || avisadas.current.has(c.id) || !enPantalla.has(c.rev.parrafo)) continue
      avisadas.current.add(c.id)
      llegar(c.id)
    }
  }, [revelaciones, visibles, llegar])

  // Pasar de página cierra la tarjeta.
  useEffect(() => { setAbierta(null) }, [clavePagina])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const abrir = useCallback((c, ancla, modo) => {
    setAbierta({ id: c.id, modo, pos: movil ? null : posicionar(ancla) })
  }, [movil])

  const onAbrirChip = useCallback((c, ancla) => {
    abrir(c, ancla, c.estado === 'cobrada' ? 'resultado' : c.estado === 'jugada' ? 'ver' : 'jugar')
  }, [abrir])

  const renderChip = useCallback((item) => {
    const c = porId[item.corazonadaId]
    return (
      <div key={item.id} className="cz-bloque" style={{ height: CHIP_ALTO }}>
        {c && <Chip cz={c} onAbrir={onAbrirChip} />}
      </div>
    )
  }, [porId, onAbrirChip])

  const corazonPorNumero = useMemo(() => Object.fromEntries(
    revelaciones.filter(c => c.estado === 'jugada' || c.estado === 'cobrada').map(c => [c.rev.parrafo, c])), [revelaciones])

  const renderCorazon = useCallback((numero) => {
    const c = corazonPorNumero[numero]
    if (!c) return null
    const cobrada = c.estado === 'cobrada'
    return (
      <button type="button" className={'cz-corazon' + (cobrada ? ' is-cobrada' : '')}
        aria-label={cobrada ? 'Ver tu corazonada' : '¿Acertaste tu corazonada?'}
        onClick={(e) => { e.stopPropagation(); abrir(c, e.currentTarget, cobrada ? 'resultado' : 'revelar') }}>
        <Corazon />
      </button>
    )
  }, [corazonPorNumero, abrir])

  const actual = abierta ? porId[abierta.id] : null
  const cerrar = () => setAbierta(null)
  const contenido = actual && (
    <Contenido key={`${actual.id}:${abierta.modo}`} cz={actual} modo={abierta.modo} saldo={cz.estado?.saldo ?? 0}
      gatoColor={gatoColor} ocupado={cz.ocupado} onCerrar={cerrar}
      onJugar={async (opcion, n) => {
        await cz.jugar({ id: actual.id, opcion, ovillos: n })
        setAbierta(null)
        setToast(`−${n} · la verás cuando el libro lo cuente`)
      }}
      onCobrar={async () => {
        await cz.cobrar(actual.id)
        setAbierta(a => a && { ...a, modo: 'resultado' })
      }} />
  )

  // En móvil la hoja va dentro de la pantalla del lector (usa sus variables
  // de color, .lm-screen); en escritorio, en el body, sobre la mesa.
  const piezas = (contenido || toast) ? (
    <>
      {contenido && (movil
        ? <div className="lm-backdrop" onClick={cerrar}>
            <div className="lm-sheet" onClick={e => e.stopPropagation()}>
              <div className="lm-grip" />
              <div className="cz-hoja-cuerpo">{contenido}</div>
            </div>
          </div>
        : <div className="cz-tarjeta" style={{ left: abierta.pos.left, top: abierta.pos.top }}>{contenido}</div>)}
      {toast && <div className="cz-toast" role="status"><Ovillo />{toast}</div>}
    </>
  ) : null
  const panel = piezas && !movil ? createPortal(piezas, document.body) : piezas

  // Para paginar otro capítulo de golpe (el móvil, al volver al anterior).
  const chipsDe = useCallback((n) => lista.filter(c => c.chip.cap === n), [lista])

  return {
    listo: cz.listo,
    chips,
    chipsDe,
    renderChip: chips.length ? renderChip : null,
    renderCorazon: Object.keys(corazonPorNumero).length ? renderCorazon : null,
    panel,
  }
}
