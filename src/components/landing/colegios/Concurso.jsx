// src/components/landing/colegios/Concurso.jsx
// ─────────────────────────────────────────────────────────────
// Noche 12, «Mateo, en Inmersia»: el concurso. Cuando la página llega a la
// mitad de la pantalla se apagan las luces, un foco cae sobre la frase difícil
// y aparece la pregunta. Comodines (más contexto, 50/50) pagados con ovillos,
// «Ahora no» devuelve la luz. Mismo funcionamiento que el concurso de la app;
// el juez de aquí es una lista de ideas clave (en la app lo hace una IA).
// `intento` sube cuando el visitante toca «Ver de nuevo».
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CONCURSO as CC } from './colegiosData.js'
import { useEnFranja } from './useEscenas.js'
import { Icono, Ovillos } from './SvgDefs.jsx'

const reduce = () => typeof window.matchMedia !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const palabras = (t) => t.trim().split(/\s+/).filter(Boolean).length

export default function Concurso({ intento }) {
  const lectorRef = useRef(null)
  const fraseRef = useRef(null)
  const timers = useRef([])
  const [apagado, setApagado] = useState(false)
  const [fase, setFase] = useState(null) // null | 'pregunta' | 'jurado' | 'veredicto'
  const [saldo, setSaldo] = useState(CC.saldo)
  const [usoCtx, setUsoCtx] = useState(false)
  const [con5050, setCon5050] = useState(false)
  const [texto, setTexto] = useState('')
  const [veredicto, setVeredicto] = useState(null)
  const [focos, setFocos] = useState([])

  const luego = (fn, ms) => { timers.current.push(setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Huecos de luz sobre cada línea de la frase (puede partirse en dos renglones).
  const medir = useCallback(() => {
    const lec = lectorRef.current, fr = fraseRef.current
    if (!lec || !fr || !lec.offsetParent) return
    const L = lec.getBoundingClientRect()
    setFocos([...fr.getClientRects()].map((r) => ({ x: r.left - L.left - 4, y: r.top - L.top - 2, w: r.width + 8, h: r.height + 4 })))
  }, [])
  // Se vuelve a medir cada vez que el texto cambia de tamaño (en el celular el lado
  // de Inmersia aparece con una animación y la letra se reacomoda después del primer
  // cálculo) y justo cuando se apagan las luces.
  useLayoutEffect(() => {
    const lec = lectorRef.current
    if (!lec) return
    const ro = new ResizeObserver(() => medir())
    ro.observe(lec)
    window.addEventListener('resize', medir)
    return () => { ro.disconnect(); window.removeEventListener('resize', medir) }
  }, [medir])
  useEffect(() => { if (apagado) requestAnimationFrame(medir) }, [apagado, medir])

  const apagar = useCallback(() => {
    medir()
    setFase('pregunta')
    luego(() => setApagado(true), reduce() ? 0 : 2200)
  }, [medir])
  useEnFranja(lectorRef, apagar, { arriba: 0.4, abajo: 0.55 })

  const encender = () => setApagado(false)

  useEffect(() => {
    if (!intento) return
    setApagado(false); setSaldo(CC.saldo); setUsoCtx(false); setCon5050(false); setTexto(''); setVeredicto(null)
    luego(apagar, 700)
  }, [intento, apagar])

  const juzgar = (v) => {
    setFase('jurado')
    luego(() => { setVeredicto(v); setSaldo((s) => s + CC.veredictos[v][3]); setFase('veredicto') }, reduce() ? 300 : 1600)
  }

  const cabeza = (titulo) => (
    <div className="lc-cc-head">
      <div><div className="lc-cc-kicker">El concurso</div><h3>{titulo}</h3></div>
      <span className="lc-cc-saldo"><Icono id="ovillo" className="lc-cz-ovillo" />{saldo}</span>
    </div>
  )

  let panel = null
  if (fase === 'pregunta') {
    panel = (
      <>
        {cabeza(CC.pregunta)}
        {usoCtx && <p className="lc-cc-ctx"><small>Antes de la frase</small>{CC.contexto}</p>}
        {con5050 ? (
          <div className="lc-cc-opts">
            {CC.opciones5050.map((o, i) => (
              <button key={o} type="button" className="lc-cc-opt" onClick={() => juzgar(i === CC.ok5050 ? 'ok' : 'no')}>
                <span className="lc-cc-lt">{'AB'[i]}</span>{o}
              </button>
            ))}
          </div>
        ) : (
          <>
            <textarea
              className="lc-cc-texto" placeholder="Escríbelo con tus palabras…" aria-label="Tu respuesta"
              value={texto} onChange={(e) => setTexto(e.target.value)} onPaste={(e) => e.preventDefault()}
            />
            <div className="lc-cc-pista"><span>Con tus palabras. No se puede pegar.</span><span>{palabras(texto)} palabras</span></div>
          </>
        )}
        <div className="lc-cc-comodines">
          <button type="button" className={`lc-cc-com ${usoCtx ? 'lc-is-usado' : ''}`.trim()} disabled={usoCtx || con5050}
            onClick={() => { setUsoCtx(true); setSaldo((s) => s - 1) }}>
            {usoCtx ? '✓ ' : ''}Más contexto <span><Ovillos n={1} />1</span>
          </button>
          <button type="button" className={`lc-cc-com ${con5050 ? 'lc-is-usado' : ''}`.trim()} disabled={con5050}
            onClick={() => { setCon5050(true); setSaldo((s) => s - 2) }}>
            {con5050 ? '✓ ' : ''}50/50 <span><Ovillos n={2} />2</span>
          </button>
        </div>
        <div className="lc-cc-btns">
          <button type="button" className="lc-cc-btn lc-is-luego" onClick={encender}>Ahora no</button>
          {!con5050 && (
            <button type="button" className="lc-cc-btn lc-is-main" disabled={palabras(texto) < 3}
              onClick={() => juzgar(CC.aciertos.test(texto) ? 'ok' : 'casi')}>Responder</button>
          )}
        </div>
      </>
    )
  } else if (fase === 'jurado') {
    panel = (
      <>
        {cabeza(CC.pregunta)}
        <div className="lc-cc-jurado"><div className="lc-cc-tambor">• • •</div><b>El jurado delibera…</b><span>Leyendo tu respuesta</span></div>
      </>
    )
  } else if (fase === 'veredicto') {
    const [clase, titulo, txt, premio] = CC.veredictos[veredicto]
    panel = (
      <>
        {cabeza('El veredicto')}
        <div className={`lc-cc-veredicto lc-${clase}`}>
          <span className="lc-cc-big">{titulo}</span>
          <span>{txt}</span>
          {premio > 0 && <span><Icono id="ovillo" className="lc-cz-ovillo" /> +{premio} {premio === 1 ? 'ovillo' : 'ovillos'}</span>}
        </div>
        <div className="lc-cc-ref"><small>Así lo entendemos nosotros</small><p>{CC.referencia}</p></div>
        <div className="lc-cc-btns"><button type="button" className="lc-cc-btn lc-is-main" onClick={encender}>Volver a la lectura</button></div>
      </>
    )
  }

  return (
    <div className={`lc-cc-lector ${apagado ? 'lc-apagado' : ''}`.trim()} ref={lectorRef}>
      <div className="lc-cc-pag">
        <p>-¡Bah! Realmente, no es un mal muchacho. Merece más que se le compadezca -comentó un neoyorquino-. Desde que era una criatura lo han arrastrado de un hotel a otro.</p>
        <p>Esta mañana estuve hablando con su madre. Es una mujer encantadora, que no cree que pueda manejarlo. Lo llevan a Europa a que termine su educación.</p>
        <p>Un señor de Filadelfia, acurrucado en un rincón, comentó: <span ref={fraseRef}>-Su educación no ha empezado aún.</span> Ese muchacho tiene doscientos dólares mensuales para sus gastos. Él me lo ha dicho.</p>
        <p>Y todavía no ha cumplido dieciséis años.</p>
      </div>
      <svg className="lc-cc-noche" aria-hidden="true">
        <defs>
          <mask id="lc-cc-huecos">
            <rect width="100%" height="100%" fill="white" />
            <g>{focos.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="5" fill="black" />)}</g>
          </mask>
        </defs>
        <rect className="lc-fondo" width="100%" height="100%" mask="url(#lc-cc-huecos)" />
      </svg>
      <div>
        {focos.map((r, i) => <div key={i} className="lc-cc-foco" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />)}
      </div>
      <div className="lc-cc-tarjeta" role="dialog" aria-label="El concurso">
        <div className="lc-cc-panel">{panel}</div>
      </div>
    </div>
  )
}
