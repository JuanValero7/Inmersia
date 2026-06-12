// src/components/Landing.jsx
// ─────────────────────────────────────────────────────────────
// Landing pública de Inmersia (escritorio).
// Se muestra ANTES de <Auth> cuando no hay usuario. Sus botones
// llaman a onAuth('login' | 'registro') para abrir el carnet de acceso.
//
// Variante móvil: components/mobile/LandingMobile.jsx
// Todas las clases van prefijadas con `inm-` y el CSS está scopeado
// bajo `.inm-landing`, así no colisiona con el resto de la app.
// ─────────────────────────────────────────────────────────────
import { useRef } from 'react'
import { FEATURES, WORLDS_IMG } from './landing/landingData.js'
import { useReveal, usePortal } from './landing/useLandingScene.js'
import '../styles/landing.css'

const LOGO = '/assets/inmersia-logo.png'
const LOGO_STACKED = '/assets/landing/inmersia-logo-stacked.png'
const BOOK = '/assets/landing/libro2-cutout.webp'

export default function Landing({ onAuth, mobile = false }) {
  const rootRef = useRef(null)
  const queRef = useRef(null)
  useReveal(rootRef)
  usePortal(rootRef)

  const go = (tab) => (e) => { e.preventDefault(); onAuth?.(tab) }
  const scrollToQue = (e) => {
    e.preventDefault()
    const el = queRef.current
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 8, behavior: 'smooth' })
  }

  return (
    <div className={`inm-landing ${mobile ? 'inm-mobile' : ''}`.trim()} ref={rootRef}>
      <header className="inm-nav">
        <div className="inm-wrap inm-nav-in">
          <img src={LOGO} alt="Inmersia" />
          <nav className="inm-nav-right">
            <a className="inm-lnk" href="#login" onClick={go('login')}>Iniciar sesión</a>
            <a className="inm-clay-btn" href="#registro" onClick={go('registro')}>Crear cuenta</a>
          </nav>
        </div>
      </header>

      {/* ── HERO portal-libro ── */}
      <section className="inm-hero">
        <div className="inm-wrap inm-hero-grid">
          <div>
            <h1 className="inm-hero-h">
              Las mejores<br className="inm-dbr" />historias <em>nunca</em><br className="inm-dbr" />estuvieron en el<br className="inm-dbr" />feed.
            </h1>
            <p className="inm-hero-lede">
              Inmersia convierte cada libro en un mundo para habitar, no en una pantalla más para
              mirar. Con imágenes, sonido, pistas para investigar la trama y gente que lee contigo,
              adéntrate en una nueva aventura.
            </p>
            <div className="inm-hero-cta">
              <a className="inm-clay-btn" href="#registro" onClick={go('registro')}>Empezar a leer</a>
              <a className="inm-quiet" href="#que-hace" onClick={scrollToQue}>¿Qué es Inmersia?</a>
            </div>
          </div>

          <div className="inm-hero-art" data-reveal>
            <div className="inm-portal-scene">
              <div className="inm-portal-wrap">
                <div className="inm-portal">
                  {WORLDS_IMG.map((w, i) => (
                    <img key={w.src} className={`inm-world ${i === 0 ? 'active' : ''} ${w.cls}`.trim()} src={w.src} alt="" />
                  ))}
                  <div className="inm-portal-shine" />
                </div>
              </div>
              <div className="inm-chips">
                <span className="inm-chip cA"><span className="inm-d" /><span className="inm-t" /></span>
                <span className="inm-chip cB"><span className="inm-d" /><span className="inm-t" /></span>
              </div>
              <img className="inm-book" src={BOOK} alt="Libro abierto" />
            </div>
          </div>
        </div>
      </section>

      {/* ── MANIFIESTO ── */}
      <section className="inm-manifesto inm-band">
        <div className="inm-wrap">
          <p className="inm-q" data-reveal>
            Las redes no te robaron las ganas de leer.<br />
            Solo te cambiaron <b>qué</b> lees.
          </p>
          <p className="inm-by" data-reveal>— y nosotros queremos devolverte la mejor parte</p>
        </div>
      </section>

      {/* ── ¿QUÉ ES INMERSIA? + DETALLE ── */}
      <section className="inm-band inm-rule-top" id="que-hace" ref={queRef}>
        <div className="inm-wrap">
          <div className="inm-ov-head">
            <h2 className="inm-sec-h" data-reveal>¿Qué es Inmersia?</h2>
          </div>

          {FEATURES.map((f) => (
            <div className={`inm-feature ${f.flip ? 'flip' : ''}`.trim()} id={f.id} data-reveal key={f.id}>
              <div className="inm-ftxt">
                <div className="inm-idx">{f.idx}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                <ul>
                  {f.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
              <div className="inm-vis-wrap">
                <div className="inm-shot">
                  <span className="inm-bar"><i /><i /><i /></span>
                  <img src={f.shot} alt={`${f.idx} de Inmersia`} loading="lazy" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CIERRE ── */}
      <section className="inm-band inm-closing inm-rule-top">
        <div className="inm-wrap inm-closing-in">
          <img className="inm-closing-logo" src={LOGO_STACKED} alt="Inmersia" data-reveal />
          <p className="inm-closing-msg" data-reveal>Abre tu imaginación. <em>Nosotros nos encargamos del resto.</em></p>
          <a className="inm-clay-btn inm-clay-lg" href="#registro" onClick={go('registro')} data-reveal>Crear una cuenta</a>
        </div>
      </section>

      <footer className="inm-footer">
        <div className="inm-wrap inm-foot-in">
          <img src={LOGO} alt="Inmersia" />
          <p>Las mejores historias nunca estuvieron en el feed.</p>
          <p>© 2026 Inmersia</p>
        </div>
      </footer>
    </div>
  )
}
