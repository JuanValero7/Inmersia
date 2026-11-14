// src/components/LandingEscritores.jsx
// ─────────────────────────────────────────────────────────────
// Landing de escritores (escritorio), en /escritores. Pública, con o sin
// sesión. Se llega tocando a Mancha en «¿Cómo vas a usar Inmersia?».
//
// «El viaje del libro»: un carrusel horizontal. Portada (la tienda de
// Inmersia) y 8 paradas, de Egipto a hoy; en cada una, la época en chico y lo
// que hace Inmersia en grande (landing/escritores/Cuerpos.jsx). Abajo, la
// línea del tiempo con el libro que avanza. «Quiero ser escritor» abre un
// pop-up que guarda la solicitud (landing/escritores/Solicitud.jsx, migración 120).
//
// Variante móvil: components/mobile/LandingEscritoresMobile.jsx (este mismo
// componente con `mobile`). Clases con prefijo `le-`, CSS en
// styles/landing-escritores.css y landing-escritores.mobile.css.
//
// Maqueta aprobada: Documents/Inmersia_maquetas/landing/escritores/viaje.html (fuera del repo)
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { gatoSrc } from './landing/landingData.js'
import { ASSET, LOGO, ERAS } from './landing/escritores/escritoresData.js'
import { CUERPOS } from './landing/escritores/Cuerpos.jsx'
import Solicitud from './landing/escritores/Solicitud.jsx'
import SelectorPublico from './landing/SelectorPublico.jsx'
import { evento } from '../lib/analytics.js'
import '../styles/landing-escritores.css'

const ULTIMA = ERAS.length            // la portada es la 0; las paradas, 1..8
const pos = (i) => (i / (ERAS.length - 1)) * 100

// Muestras de sonido: una sola a la vez. El ruido blanco se genera con Web
// Audio (como useWhiteNoise del lector), no es un archivo.
function useMuestras() {
  const [sonando, setSonando] = useState(null)
  const audioRef = useRef(null)
  const ctxRef = useRef(null)
  const parar = useCallback(() => {
    audioRef.current?.pause(); audioRef.current = null
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null }
    setSonando(null)
  }, [])
  const sonar = useCallback((clave, src) => {
    const estaba = sonando === clave
    parar()
    if (estaba) return
    setSonando(clave)
    if (src === 'ruido') {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0)
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
      const fuente = ctx.createBufferSource(), vol = ctx.createGain()
      fuente.buffer = buf; fuente.loop = true; vol.gain.value = 0.08
      fuente.connect(vol).connect(ctx.destination); fuente.start()
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      ctxRef.current = ctx
    } else {
      const a = new Audio(src)
      a.onended = parar
      a.play().catch(parar)
      audioRef.current = a
    }
    evento('escritores_muestra', { sonido: clave })
  }, [sonando, parar])
  useEffect(() => parar, [parar])
  return { sonando, sonar, parar }
}

export default function LandingEscritores({ mobile = false, user = null, openAuth }) {
  const navigate = useNavigate()
  const carrilRef = useRef(null)
  const [actual, setActual] = useState(0)
  const [visor, setVisor] = useState(null)
  const [pidiendo, setPidiendo] = useState(false)
  const { sonando, sonar, parar } = useMuestras()

  useEffect(() => {
    const antes = document.title
    document.title = 'Inmersia para escritores'
    return () => { document.title = antes }
  }, [])

  const irA = useCallback((i, suave = true) => {
    const c = carrilRef.current
    if (c) c.scrollTo({ left: i * c.clientWidth, behavior: suave ? 'smooth' : 'auto' })
  }, [])

  // La lámina activa sale del scroll (flechas, rueda, dedo o línea del tiempo).
  useEffect(() => {
    const c = carrilRef.current
    if (!c) return
    let t
    const alMover = () => { clearTimeout(t); t = setTimeout(() => setActual(Math.round(c.scrollLeft / c.clientWidth)), 60) }
    c.addEventListener('scroll', alMover, { passive: true })
    return () => { clearTimeout(t); c.removeEventListener('scroll', alMover) }
  }, [])
  useEffect(() => { parar() }, [actual, parar])
  useEffect(() => { if (actual > 0) evento('escritores_lamina', { lamina: ERAS[actual - 1]?.id ?? 'portada' }) }, [actual])

  // Al cambiar el tamaño, quedarse en la misma lámina.
  const actualRef = useRef(0)
  useEffect(() => { actualRef.current = actual }, [actual])
  useEffect(() => {
    const ajustar = () => irA(actualRef.current, false)
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [irA])

  // Flechas del teclado (no con el pop-up abierto ni escribiendo); Escape cierra.
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'Escape') { setVisor(null); setPidiendo(false); return }
      if (pidiendo || visor || e.target.closest?.('input, textarea, select')) return
      if (e.key === 'ArrowRight') { e.preventDefault(); irA(Math.min(ULTIMA, actualRef.current + 1)) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); irA(Math.max(0, actualRef.current - 1)) }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [irA, pidiendo, visor])

  const pedir = (desde) => { evento('escritores_cta', { ubicacion: desde }); setPidiendo(true) }
  const yaTengo = () => { if (user) navigate('/escritor'); else openAuth?.('login') }
  const elegirPublico = (p) => {
    evento('escritores_publico', { publico: p.id })
    if (p.id === 'lector') navigate('/')
    else if (p.ruta && p.id !== 'escritor') navigate(p.ruta)
  }

  const era = actual - 1
  const enEra = era >= 0 && era < ERAS.length

  return (
    <div className={`le-landing ${mobile ? 'le-mobile' : ''}`.trim()}>
      <header className="le-cab">
        <Link to="/" aria-label="Inmersia, inicio"><img src={LOGO} alt="Inmersia" /></Link>
        <span className="le-lugar">Rincón del escritor</span>
        <span className="le-hueco" />
        <button type="button" className="le-pill le-plana" onClick={yaTengo}>{user ? 'Mi estudio' : 'Ya tengo cuenta'}</button>
        <button type="button" className="le-pill le-naranja" onClick={() => pedir('cabecera')}>Quiero ser escritor</button>
      </header>

      <div className="le-carril" ref={carrilRef}>
        <section className={`le-lamina le-portada ${actual === 0 ? 'le-activa' : ''}`}>
          <img src={`${ASSET}/eras/portada.webp`} alt="" />
          <div className="le-centro">
            <div className="le-kicker">Rincón del escritor · para autores</div>
            <h1>¿La historia de un libro o el libro de una historia?</h1>
            <p>Han viajado en papiro por el Nilo y cabalgado junto a los romanos. Han sido consuelo de monasterios y tesoros de reyes. Puertas a nuevos mundos e inspiración de tecnologías. El origen de aventuras y, ahora, el corazón de Inmersia.</p>
            <div className="le-botones">
              <button type="button" className="le-pill le-naranja" onClick={() => irA(1)}>Empezar el viaje →</button>
              <button type="button" className="le-pill" onClick={() => pedir('portada')}>Quiero ser escritor</button>
            </div>
            <SelectorPublico actual="escritor" onElegir={elegirPublico} mobile={mobile} className="le-publico" />
          </div>
        </section>

        {ERAS.map((e, k) => {
          const Cuerpo = CUERPOS[e.id]
          return (
            <section key={e.id} className={`le-lamina le-era le-${e.lado} le-ancha ${actual === k + 1 ? 'le-activa' : ''}`}>
              <img src={`${ASSET}/eras/${e.img}.webp`} alt="" loading={k < 1 ? 'eager' : 'lazy'} />
              <div className="le-texto">
                <div className="le-cuando">{e.cuando}</div>
                <h2>{e.t}</h2>
                <p className="le-hist">{e.h}</p>
                <div className="le-hoy">
                  <img className="le-gato" src={gatoSrc('blanco', e.gato)} alt="" />
                  <div className="le-que">Hoy, en Inmersia</div>
                  <b className="le-paso">{e.paso}</b>
                  <div className="le-cuerpo">
                    <Cuerpo ver={setVisor} sonar={sonar} sonando={sonando} pedir={pedir} />
                  </div>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      <button type="button" className="le-flecha le-ant" aria-label="Anterior" disabled={actual === 0} onClick={() => irA(Math.max(0, actual - 1))}>←</button>
      <button type="button" className={`le-flecha le-sig ${actual === 0 ? 'le-late' : ''}`} aria-label="Siguiente" disabled={actual === ULTIMA} onClick={() => irA(Math.min(ULTIMA, actual + 1))}>→</button>

      <nav className={`le-tiempo ${enEra ? '' : 'le-fuera'}`} aria-label="Línea del tiempo">
        <div className="le-riel">
          <div className="le-lleno" style={{ width: `${enEra ? pos(era) : 0}%` }} />
          <div className="le-libro-riel" style={{ left: `${enEra ? pos(era) : 0}%` }} />
          {ERAS.map((e, k) => (
            <button type="button" key={e.id} style={{ left: `${pos(k)}%` }} onClick={() => irA(k + 1)}
              className={`${k === era ? 'le-on' : ''} ${k < era ? 'le-paso' : ''}`.trim()} aria-current={k === era ? 'step' : undefined}>
              <i /><span>{e.etq}</span>
            </button>
          ))}
        </div>
      </nav>

      {visor && (
        <div className="le-visor le-on" onClick={() => setVisor(null)}><img src={visor} alt="" /></div>
      )}
      {pidiendo && <Solicitud user={user} onCerrar={() => setPidiendo(false)} />}
    </div>
  )
}
