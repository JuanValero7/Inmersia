// src/components/landing/colegios/LibroCorazonada.jsx
// ─────────────────────────────────────────────────────────────
// Noche 1, «Mateo, en Inmersia»: la página 39-40 del libro con su ilustración
// y el chip de la corazonada. La tarjeta de
// la corazonada funciona como en la app: elegir A/B, cuántos ovillos jugarse
// (Katana cambia de pose), guardar y «Seguir leyendo» para cerrarla.
//
// Sonido como en el lector: el botón de la esquina enciende el mar y el
// velero de fondo (se apaga solo si el libro sale de la pantalla), y las
// frases que brillan suenan al tocarlas, con o sin fondo.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { gatoSrc } from '../landingData.js'
import { asset, CORAZONADA as CZ } from './colegiosData.js'
import { Icono, Ovillos } from './SvgDefs.jsx'

// Fondo de la escena: [archivo, volumen]. Son los mismos sonidos del lector.
const FONDO = [['/sounds/olas.mp3', 0.6], ['/sounds/ambiente/velero_cubierta_a.mp3', 0.3]]

export default function LibroCorazonada() {
  const [abierta, setAbierta] = useState(false)
  const [eleccion, setEleccion] = useState(null)
  const [ovillos, setOvillos] = useState(0)
  const [guardada, setGuardada] = useState(false)

  const guardar = () => setGuardada(true)

  // ── Sonido ──
  const libroRef = useRef(null)
  const fondo = useRef(null) // [mar, velero], se crean al primer toque
  const efectos = useRef({})
  const [suena, setSuena] = useState(false)
  const alternarFondo = () => {
    if (!fondo.current) {
      fondo.current = FONDO.map(([src, vol]) => { const a = new Audio(src); a.loop = true; a.volume = vol; return a })
    }
    if (suena) { fondo.current.forEach((a) => a.pause()); setSuena(false); return }
    Promise.all(fondo.current.map((a) => a.play())).then(() => setSuena(true)).catch(() => {})
  }
  useEffect(() => {
    if (!suena || !libroRef.current) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) { fondo.current?.forEach((a) => a.pause()); setSuena(false) }
    })
    io.observe(libroRef.current)
    return () => io.disconnect()
  }, [suena])
  useEffect(() => () => fondo.current?.forEach((a) => a.pause()), [])

  const [sonando, setSonando] = useState(null)
  const sfx = (archivo, texto) => {
    const tocar = () => {
      const a = efectos.current[archivo] ?? (efectos.current[archivo] = new Audio(asset(`snd/${archivo}`)))
      a.currentTime = 0
      a.play().catch(() => {})
      setSonando(archivo); setTimeout(() => setSonando((s) => (s === archivo ? null : s)), 900)
    }
    return (
      <span className={`lc-sfx ${sonando === archivo ? 'lc-suena-ya' : ''}`.trim()} role="button" tabIndex={0} onClick={tocar}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tocar() } }}>{texto}</span>
    )
  }

  return (
    <div className="lc-libro" ref={libroRef}>
      <figure className="lc-hoja-l lc-izq">
        <img src={asset('ilus-cap2.jpg')} alt="Ilustración del capítulo 2: la cubierta del velero" />
        <figcaption>Capítulo 2 · La vida a bordo</figcaption>
        <button type="button" className={`lc-suena ${suena ? '' : 'lc-mudo'}`.trim()} aria-pressed={suena} onClick={alternarFondo}>
          <span className="lc-barras" aria-hidden="true"><i /><i /><i /><i /></span>
          {suena ? 'Suena: el mar' : 'Sonido apagado: toque aquí'}
        </button>
        <span className="lc-toque">Toque las frases que brillan</span>
        <span className="lc-num">39</span>
      </figure>
      <div className="lc-hoja-l lc-der">
        <p>-Lo que debe haber sido seis o siete veces -respondió Tom Platt secamente-. Una buena estiba es una estiba, sea como sea; hay una manera buena y otra mala de hacerlo.</p>
        <p>-¡Eh! -{sfx('sfx-grito.mp3', 'gritó Manuel')}, {sfx('sfx-golpe.mp3', 'reanudando su trabajo')}, sin detenerse hasta que el depósito provisional de cubierta quedó completamente vacío.</p>
        <p>En cuanto {sfx('sfx-pescado.mp3', 'el último pescado bajó por la escotilla')}, Disko se retiró con su hermano. Tom Platt se detuvo sólo el tiempo suficiente para {sfx('sfx-escotilla.mp3', 'cerrar la escotilla')}.</p>
        <div className="lc-cz-bloque">
          <button type="button" className={`lc-cz-chip ${guardada ? 'lc-is-jugada' : ''}`.trim()} onClick={() => setAbierta((a) => !a)}>
            <Icono id="corazon" />
            {guardada
              ? <>Tu corazonada <small>{'AB'[eleccion]} · {ovillos} {ovillos === 1 ? 'ovillo' : 'ovillos'}</small></>
              : <>Corazonada <small>{CZ.pregunta}</small></>}
          </button>
        </div>
        <p>-Esta vez lo he hecho un poco mejor, Danny -dijo Penn, cuyos párpados se cerraban de puro sueño-.</p>
        <span className="lc-num">40</span>
      </div>

      <div className="lc-cz-tarjeta" hidden={!abierta}>
        <div className="lc-cz-panel">
          <div className="lc-cz-head">
            <img className="lc-cz-gato" src={gatoSrc('negro', CZ.pose[ovillos])} alt="" />
            <div><div className="lc-cz-kicker">Corazonada</div><h3>{CZ.pregunta}</h3></div>
            <span className="lc-cz-saldo"><Icono id="ovillo" className="lc-cz-ovillo" />{CZ.saldo}</span>
          </div>
          <p className="lc-cz-ctx">{CZ.contexto}</p>
          <div className="lc-cz-opts">
            {CZ.opciones.map((o, i) => (
              <button key={o} type="button" className="lc-cz-opt" aria-pressed={eleccion === i} onClick={() => setEleccion(i)}>
                <span className="lc-cz-lt">{'AB'[i]}</span>{o}
              </button>
            ))}
          </div>
          <div className="lc-cz-apuesta">
            <div className="lc-cz-apuesta-h">
              ¿Cuántos ovillos te juegas?
              <small>{ovillos ? `${CZ.nivel[ovillos]} · si aciertas, recibes ${ovillos * 2}` : 'Si aciertas, recibes el doble'}</small>
            </div>
            <div className="lc-cz-apuesta-btns">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" aria-pressed={ovillos === n} onClick={() => setOvillos(n)}><span><Ovillos n={n} /></span>{n}</button>
              ))}
            </div>
          </div>
          {guardada ? <>
            <p className="lc-cz-nota">El libro te dirá si acertaste. Cuando lo cuente, verás un corazón junto al párrafo.</p>
            <div className="lc-cz-btns">
              <button type="button" className="lc-cz-btn lc-is-main" onClick={() => setAbierta(false)}>Seguir leyendo</button>
            </div>
          </> : (
            <div className="lc-cz-btns">
              <button type="button" className="lc-cz-btn lc-is-luego" onClick={() => setAbierta(false)}>Ahora no</button>
              <button type="button" className="lc-cz-btn lc-is-main" disabled={eleccion === null || !ovillos} onClick={guardar}>Guardar corazonada</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
