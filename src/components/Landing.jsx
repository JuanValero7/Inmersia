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

// El sufijo ?v= fuerza al navegador a descargar la versión nueva del logo
// cuando reemplazamos el archivo manteniendo el mismo nombre (cache-busting).
// Súbelo (v3 → v4 …) cada vez que cambies las imágenes.
const LOGO = '/assets/inmersia-logo.png?v=3'
const BOOK = '/assets/landing/libro2-cutout.webp?v=3'
const GATO = '/assets/cartelera/gato-blanco-2.webp'

export default function Landing({ onAuth, onGoTienda, mobile = false }) {
  const rootRef = useRef(null)
  const queRef = useRef(null)
  useReveal(rootRef)
  usePortal(rootRef)

  const go = (tab) => (e) => { e.preventDefault(); onAuth?.(tab) }
  const scrollToQue = (e) => {
    e.preventDefault()
    const el = queRef.current
    if (!el) return
    const navH = rootRef.current?.querySelector('.inm-nav')?.offsetHeight ?? 0
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - navH - 8, behavior: 'smooth' })
  }

  return (
    <div className={`inm-landing ${mobile ? 'inm-mobile' : ''}`.trim()} ref={rootRef}>
      <header className="inm-nav">
        <div className="inm-wrap inm-nav-in">
          <img src={LOGO} alt="Inmersia" />
          <nav className="inm-nav-right">
            <a className="inm-lnk" href="#login" onClick={go('login')}>Iniciar sesión</a>
            <a className="inm-login-ico" href="#login" onClick={go('login')} aria-label="Iniciar sesión" title="Iniciar sesión">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </a>
            <a className="inm-clay-btn" href="#registro" onClick={go('registro')}>Crear cuenta</a>
          </nav>
        </div>
      </header>

      {/* ── HERO portal-libro ── */}
      <section className="inm-hero">
        <div className="inm-wrap inm-hero-grid">
          <div>
            <h1 className="inm-hero-h">
              Escapa de lo efímero y conecta con tu <em>imaginación</em>
            </h1>
            <p className="inm-hero-lede">
              Inmersia convierte cada libro en un mundo para habitar, no en una pantalla más para
              mirar. Con imágenes, sonido, pistas para investigar la trama y gente que lee contigo,
              adéntrate en una nueva aventura.
            </p>
            <div className="inm-hero-cta">
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

          {/* En móvil el botón de registro vive aquí (la barra superior solo deja
              el logo + iniciar sesión). Es hijo directo de la rejilla del hero:
              el CSS móvil lo coloca por `order` justo debajo del libro-portal y
              encima del titular. En escritorio no se renderiza. */}
          {mobile && <a className="inm-clay-btn inm-hero-signup" href="#registro" onClick={go('registro')}>Crear cuenta</a>}
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
          <div className="inm-closing-hero" data-reveal>
            <img className="inm-closing-cat" src={GATO} alt="" />
            <div className="inm-closing-text">
              <p className="inm-closing-msg">Motívate a una <em>nueva aventura</em>.</p>
              <div className="inm-closing-ctas">
                <a className="inm-clay-btn inm-clay-lg" href="/tienda" onClick={(e) => { e.preventDefault(); onGoTienda?.() }}>Explora nuestro catálogo</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="inm-footer">
        <div className="inm-wrap inm-foot-in">
          <img src={LOGO} alt="Inmersia" />
          <p>© 2026 Inmersia</p>
        </div>
      </footer>
    </div>
  )
}
