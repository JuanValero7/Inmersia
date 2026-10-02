// src/components/Landing.jsx
// ─────────────────────────────────────────────────────────────
// Landing pública de Inmersia (escritorio).
// Se muestra ANTES de <Auth> cuando no hay usuario. Sus botones
// llaman a onAuth('login' | 'registro') para abrir el pop-up de acceso.
//
// Variante móvil: components/mobile/LandingMobile.jsx (este mismo componente
// con `mobile`). Clases prefijadas con `inm-` y CSS scopeado bajo `.inm-landing`.
//
// Los guías son los tres gatos de Inmersia: Yuri (naranja), Mancha (blanco) y
// Katana (negro). En escritorio el visitante elige uno y lo ve en toda la
// página; esa elección se guarda y pasa a su cuenta al registrarse (ver
// hooks/useGatoColor.js). En móvil no hay selector: cada gato sale de un color.
//
// Maqueta aprobada: Documentation/landing/maqueta-gatos/index.html
// ─────────────────────────────────────────────────────────────
import { useRef, useEffect, useState, useMemo } from 'react'
import {
  WORLDS_IMG, GATOS, COLORES_GATO, COLOR_MOVIL, gatoSrc, FRASES, COMENTARIOS_LIBRO,
  LECTOR, INVESTIGACION, ALBUM,
} from './landing/landingData.js'
import { usePortal } from './landing/useLandingScene.js'
import { useGato, Gato } from './landing/Gato.jsx'
import Estanteria from './landing/Estanteria.jsx'
import Acertijo from './landing/Acertijo.jsx'
import ChatGato from './landing/ChatGato.jsx'
import LegalModal from './legal/LegalModal.jsx'
import { useCatalogoLibrosQuery } from '../lib/queries.js'
import { imgUrl } from '../lib/img.js'
import { GATO_ELEGIDO_KEY } from '../hooks/useGatoColor.js'
import { evento } from '../lib/analytics.js'
import { MINUTOS_MUESTRA } from '../lib/constants.js'
import '../styles/landing.css'

// El sufijo ?v= fuerza al navegador a descargar la versión nueva cuando se
// reemplaza el archivo manteniendo el nombre (cache-busting).
const LOGO = '/assets/inmersia-logo.png?v=4'
const BOOK = '/assets/landing/libro2-cutout.webp?v=3'

const alAzar = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Prioridad de descarga del hero. React 18 no conoce `fetchPriority` (llega en
// React 19) y no lo pinta; en minúscula pasa tal cual al DOM. Va en un objeto
// para que react/no-unknown-property no lo marque.
const PRIORIDAD = { alta: { fetchpriority: 'high' }, baja: { fetchpriority: 'low' } }

function leerGatoElegido() {
  try {
    const c = localStorage.getItem(GATO_ELEGIDO_KEY)
    return COLORES_GATO.includes(c) ? c : null
  } catch { return null }
}

export default function Landing({ onAuth, onGoTienda, mobile = false }) {
  const [legalDoc, setLegalDoc] = useState(null) // null | 'terminos' | 'privacidad' | 'impressum'
  const rootRef = useRef(null)
  const heroCtaRef = useRef(null)
  const audioRef = useRef(null)
  usePortal(rootRef)

  // ── Color de cada gato ──
  const [elegido, setElegido] = useState(() => leerGatoElegido() ?? 'naranja')
  const colorDe = (zona) => (mobile ? COLOR_MOVIL[zona] : elegido)
  const nombreDe = (zona) => GATOS[colorDe(zona)]
  const src = (zona, pose) => gatoSrc(colorDe(zona), pose)

  // ── Estado de cada gato ──
  const hero = useGato(FRASES.hero('')[0])
  const estante = useGato(FRASES.estante()[0])
  const lector = useGato(FRASES.lector()[0])
  const investigacion = useGato(FRASES.investigacion()[0])
  const album = useGato(FRASES.album()[0])
  const faq = useGato(null)
  const cierre = useGato(FRASES.cierre()[0])
  const turno = useRef({})
  const hablar = (zona, gato) => () => {
    const lista = FRASES[zona](nombreDe(zona))
    turno.current[zona] = ((turno.current[zona] ?? 0) + 1) % lista.length
    gato.decir(lista[turno.current[zona]])
    gato.mover('hop')
  }

  const elegirGato = (c) => {
    setElegido(c)
    try { localStorage.setItem(GATO_ELEGIDO_KEY, c) } catch { /* sin almacenamiento: solo dura esta visita */ }
    for (const g of [hero, estante, lector, investigacion, album, faq, cierre]) g.mover('hop')
    hero.decir(`¡Hola! Soy ${GATOS[c]}.`)
    evento('landing_gato', { color: c })
  }

  // ── Botones ──
  const go = (tab, ubicacion) => (e) => { e?.preventDefault(); evento('landing_cta', { boton: tab, ubicacion }); onAuth?.(tab) }
  // "Entra ahora" abre Crear cuenta. Al catálogo se llega desde la estantería.
  const entrar = (ubicacion) => (e) => { e?.preventDefault(); evento('landing_cta', { boton: 'entrar', ubicacion }); onAuth?.('registro') }
  const verLibros = (ubicacion) => (e) => { e?.preventDefault(); evento('landing_cta', { boton: 'libros', ubicacion }); onGoTienda?.() }
  const abrirLibro = (libro) => { evento('landing_cta', { boton: 'libro', ubicacion: 'estanteria', libro: libro.slug }); onGoTienda?.(libro.slug) }

  // ── Sonido (Lector) ──
  const [sonando, setSonando] = useState(false)
  const [poseLector, setPoseLector] = useState(2)
  const alternarSonido = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      a.volume = 0.6
      a.play().then(() => {
        setSonando(true); setPoseLector(3)
        lector.decir('¡Ese mar se oye de verdad!'); lector.mover('roll')
      }).catch(() => lector.decir('Tu navegador no me deja sonar.'))
    } else {
      a.pause()
      setSonando(false); setPoseLector(2)
      lector.decir('Shh… sigue leyendo.')
    }
  }
  useEffect(() => () => audioRef.current?.pause(), [])

  // ── Barajita (Álbum) ──
  const { data: catalogo = [] } = useCatalogoLibrosQuery()
  const portadaBarajita = useMemo(
    () => catalogo.find((l) => l.slug === ALBUM.barajita.slug)?.portada_url,
    [catalogo],
  )
  const [volteada, setVolteada] = useState(false)
  const voltear = () => {
    const v = !volteada
    setVolteada(v)
    album.decir(v ? `¡${ALBUM.barajita.nombre.split(' ')[0]}! Esa me faltaba.` : 'Otra vez boca abajo…')
    album.mover('hop')
  }

  // ── Cierre: el gato se despierta con los botones ──
  const [poseCierre, setPoseCierre] = useState(5)
  const despertar = () => { if (poseCierre !== 7) { setPoseCierre(7); cierre.decir('¿Vamos?') } }
  const dormir = () => { setPoseCierre(5); cierre.decir('Zzz…') }

  // ── Barra fija (móvil): aparece cuando el botón del hero sale de pantalla ──
  const [barra, setBarra] = useState(false)
  useEffect(() => {
    if (!mobile || !heroCtaRef.current) return
    const io = new IntersectionObserver(([e]) => setBarra(!e.isIntersecting), { threshold: 0 })
    io.observe(heroCtaRef.current)
    return () => io.disconnect()
  }, [mobile])

  const abrirLegal = (doc) => (e) => { e.preventDefault(); setLegalDoc(doc) }
  const flecha = <span className="inm-arrow" aria-hidden="true">→</span>

  return (
    <div className={`inm-landing ${mobile ? 'inm-mobile' : ''}`.trim()} ref={rootRef}>
      <header className="inm-nav">
        <div className="inm-wrap inm-nav-in">
          <img src={LOGO} alt="Inmersia" />
          <nav className="inm-nav-right">
            <a className="inm-lnk" href="#login" onClick={go('login', 'nav')}>Iniciar sesión</a>
            <a className="inm-login-ico" href="#login" onClick={go('login', 'nav')} aria-label="Iniciar sesión" title="Iniciar sesión">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </a>
            <a className="inm-clay-btn" href="#registro" onClick={go('registro', 'nav')}>Crear cuenta</a>
          </nav>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="inm-hero">
        <div className="inm-wrap inm-hero-grid">
          <div className="inm-hero-txt">
            <h1 className="inm-hero-h">Lee los grandes libros <em>como nunca</em></h1>
            <p className="inm-hero-lede">
              Ilustraciones que aparecen en el momento justo, sonido que acompaña cada escena y pistas para investigar la trama.
            </p>
            <div className="inm-hero-cta" ref={heroCtaRef}>
              <a className="inm-clay-btn inm-clay-lg" href="#registro" onClick={entrar('hero')}>Entra ahora {flecha}</a>
            </div>
            <p className="inm-micro">Lee los primeros {MINUTOS_MUESTRA} minutos de cualquier libro sin cuenta</p>

            {!mobile && (
              <div className="inm-picker" role="group" aria-label="Elige a tu compañero de lectura">
                <span className="inm-picker-l">Elige a tu compañero de lectura:</span>
                <div className="inm-picker-opts">
                  {COLORES_GATO.map((c) => (
                    <button key={c} type="button" className="inm-pick" aria-pressed={elegido === c} onClick={() => elegirGato(c)}>
                      <span className="inm-pick-face"><img src={gatoSrc(c, 7)} alt="" /></span>
                      <span className="inm-pick-name">{GATOS[c]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="inm-hero-art">
            <div className="inm-portal-scene">
              <div className="inm-portal-wrap">
                <div className="inm-portal">
                  {WORLDS_IMG.map((w, i) => (
                    <img
                      key={w.src}
                      className={`inm-world ${i === 0 ? 'active' : ''} ${w.cls}`.trim()}
                      src={w.src}
                      // El primero es parte del primer pintado; los otros tardan
                      // 5 s en verse, así que no compiten con él.
                      {...(i === 0 ? PRIORIDAD.alta : PRIORIDAD.baja)}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      alt=""
                    />
                  ))}
                </div>
              </div>
              <img className="inm-book" src={BOOK} alt="Libro abierto" {...PRIORIDAD.alta} />
              <Gato
                gato={hero} nombre={nombreDe('hero')} className="inm-cat-hero" cola="abajo-der"
                src={src('hero', 1)} alt="Gato saltando hacia el libro"
                onToca={hablar('hero', hero)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── ESTANTERÍA ── */}
      <section className="inm-shelf" aria-labelledby="inm-shelf-h">
        <div className="inm-wrap">
          <h2 className="inm-sec-h" id="inm-shelf-h">Elige tu próxima historia</h2>
          <p className="inm-sec-p">Novela, cuento, filosofía y ensayo. Toca una portada para ver de qué va.</p>
          <div className="inm-shelf-row">
            <div className="inm-shelf-cat">
              <Gato
                gato={estante} nombre={nombreDe('estante')} className="inm-cat-estante" cola="abajo"
                src={src('estante', 6)} alt="Gato tumbado mirando pasar los libros"
                onToca={hablar('estante', estante)}
              />
            </div>
            <Estanteria
              onElegir={abrirLibro}
              onMirar={(l) => estante.decir(`«${l.titulo}»… ${alAzar(COMENTARIOS_LIBRO)}`)}
            />
            <div className="inm-plank" aria-hidden="true" />
          </div>
          <div className="inm-shelf-foot">
            <a className="inm-clay-btn inm-clay-bordo" href="/tienda" onClick={verLibros('estanteria')}>Ver todos los libros</a>
          </div>
        </div>
      </section>

      {/* ── MANIFIESTO ── */}
      <section className="inm-manifesto">
        <div className="inm-wrap">
          <p className="inm-q">Las redes no te robaron las ganas de leer. Solo te cambiaron <b>qué</b> lees.</p>
          <p className="inm-by">Y nosotros queremos devolverte la mejor parte.</p>
        </div>
      </section>

      {/* ── FUNCIONES ── */}
      <section className="inm-feats" aria-labelledby="inm-feats-h">
        <div className="inm-wrap">
          <h2 className="inm-sec-h inm-feats-h" id="inm-feats-h">Lo que encuentras dentro de cada libro</h2>

          {/* Lector */}
          <div className="inm-feature">
            <div className="inm-ftxt">
              <p className="inm-eyebrow">{LECTOR.eyebrow}</p>
              <h3>{LECTOR.title}</h3>
              <ul>{LECTOR.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
              <button type="button" className={`inm-clay-btn inm-clay-ghost inm-sound ${sonando ? 'is-on' : ''}`} aria-pressed={sonando} onClick={alternarSonido}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></svg>
                <span>{sonando ? 'Pausar el sonido' : 'Escucha cómo suena'}</span>
              </button>
              <audio ref={audioRef} src={LECTOR.sonido} preload="none" loop />
            </div>
            <div className="inm-fvis inm-fvis-lector">
              <Shot desk={LECTOR.shot} phone={mobile ? LECTOR.shotM : null} alt="El Lector de Inmersia con Capitanes intrépidos" />
              <Gato
                gato={lector} nombre={nombreDe('lector')} className="inm-cat-lector" cola={mobile ? 'der' : 'izq'}
                src={src('lector', poseLector)} alt="Gato asomado a un libro"
                onToca={hablar('lector', lector)}
              />
            </div>
          </div>

          {/* Investigación (en móvil el acertijo baja por debajo de la captura: ver landing.mobile.css) */}
          <div className="inm-feature flip inm-feature-inv">
            <div className="inm-ftxt">
              <p className="inm-eyebrow">{INVESTIGACION.eyebrow}</p>
              <h3>{INVESTIGACION.title}</h3>
              <ul>{INVESTIGACION.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
              <Acertijo
                onVeredicto={(t, tono) => investigacion.decir(t, tono)}
                onAcierto={() => investigacion.mover('hop')}
                onFallo={() => investigacion.mover('nope')}
              />
            </div>
            <div className="inm-fvis">
              <Shot desk={INVESTIGACION.shot} phone={mobile ? INVESTIGACION.shotM : null} alt="El tablero de la Investigación" />
              <Gato
                gato={investigacion} nombre={nombreDe('investigacion')} className="inm-cat-inv" cola="abajo-der"
                src={src('investigacion', 7)} alt="Gato enroscado, mirando con sospecha"
                onToca={hablar('investigacion', investigacion)}
              />
            </div>
          </div>

          {/* Álbum */}
          <div className="inm-feature">
            <div className="inm-ftxt">
              <p className="inm-eyebrow">{ALBUM.eyebrow}</p>
              <h3>{ALBUM.title}</h3>
              <ul>{ALBUM.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
              <div className="inm-card-row">
                <button type="button" className={`inm-baraja ${volteada ? 'is-flipped' : ''}`} onClick={voltear} aria-label="Voltear la barajita">
                  <span className="inm-baraja-in">
                    <span className="inm-cara inm-dorso"><span>i</span></span>
                    <span className="inm-cara inm-frente">
                      {portadaBarajita && <img src={imgUrl(portadaBarajita, { width: 240 })} alt="" loading="lazy" />}
                      <b>{ALBUM.barajita.nombre}</b>
                      <small>{ALBUM.barajita.libro}</small>
                    </span>
                  </span>
                </button>
                <p className="inm-card-hint">Toca la barajita para darle la vuelta.</p>
              </div>
            </div>
            <div className="inm-fvis">
              <Shot desk={ALBUM.shot} alt="El Álbum de Inmersia" />
              <Gato
                gato={album} nombre={nombreDe('album')} className="inm-cat-album" cola="abajo"
                src={src('album', 4)} alt="Gato estirándose hacia el álbum"
                onToca={hablar('album', album)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── PREGUNTAS FRECUENTES (responde el gato) ── */}
      <section className="inm-faq" aria-labelledby="inm-faq-h">
        <div className="inm-wrap inm-faq-grid">
          <div className="inm-faq-side">
            <h2 className="inm-sec-h" id="inm-faq-h">Pregúntale a {nombreDe('faq')}</h2>
            <p className="inm-sec-p">Las dudas de siempre, respondidas por quien más sabe de aquí.</p>
            <Gato
              gato={faq} nombre={nombreDe('faq')} className="inm-cat-faq"
              src={src('faq', 3)} alt="Gato panza arriba, listo para responder"
              onToca={() => faq.mover('hop')}
            />
          </div>
          <ChatGato nombre={nombreDe('faq')} avatar={src('faq', 7)} onPregunta={() => faq.mover('hop')} />
        </div>
      </section>

      {/* ── CIERRE ── */}
      <section className="inm-closing">
        <div className="inm-wrap inm-closing-in">
          <div className="inm-closing-cat">
            <Gato
              gato={cierre} nombre={nombreDe('cierre')} className="inm-cat-cierre" cola="abajo-der"
              src={src('cierre', poseCierre)} alt="Gato durmiendo junto a una pila de libros"
              onToca={hablar('cierre', cierre)}
            />
          </div>
          <div>
            <h2 className="inm-closing-h">Tu próximo libro te está esperando.</h2>
            {/* Escritorio: "Entra ahora" (registro) + el catálogo. Móvil: nada;
                la barra fija de abajo ya lleva "Entra ahora". */}
            {!mobile && (
              <div className="inm-final-ctas" onMouseEnter={despertar} onMouseLeave={dormir} onFocus={despertar}>
                <a className="inm-clay-btn inm-clay-lg" href="#registro" onClick={entrar('cierre')}>Entra ahora {flecha}</a>
                <a className="inm-clay-btn inm-clay-lg inm-clay-bordo" href="/tienda" onClick={verLibros('cierre')}>Ver todos los libros</a>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="inm-footer">
        <div className="inm-wrap inm-foot-in">
          <img src={LOGO} alt="Inmersia" loading="lazy" />
          {/* Los documentos legales tienen que ser accesibles SIN cuenta. El
              Impressum es obligatorio en Alemania (§ 5 DDG). Son enlaces de
              verdad (a /privacidad, /terminos, /impressum) porque Google
              comprueba que la portada enlace la política de privacidad para
              verificar la marca; al hacer clic se abren en la ventana de siempre. */}
          <nav className="inm-foot-legal" aria-label="Legal">
            <span>© 2026 Inmersia</span>
            <a href="/terminos" onClick={abrirLegal('terminos')}>Términos y Condiciones</a>
            <a href="/privacidad" onClick={abrirLegal('privacidad')}>Política de Privacidad</a>
            <a href="/impressum" onClick={abrirLegal('impressum')}>Impressum</a>
            <a href="https://www.instagram.com/inmersia.io/" target="_blank" rel="noopener noreferrer">Instagram</a>
          </nav>
        </div>
      </footer>

      {mobile && (
        <div className={`inm-sticky ${barra ? 'is-on' : ''}`} aria-hidden={!barra}>
          <span className="inm-av"><img src={src('hero', 7)} alt="" /></span>
          <a className="inm-clay-btn" href="#registro" onClick={entrar('barra')} tabIndex={barra ? undefined : -1}>Entra ahora {flecha}</a>
        </div>
      )}

      {legalDoc && <LegalModal initialDoc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  )
}

// Captura en su marco: ventana de escritorio, o teléfono si hay captura móvil.
function Shot({ desk, phone, alt }) {
  if (phone) {
    return (
      <div className="inm-shot inm-shot-phone">
        <img src={phone} alt={alt} loading="lazy" decoding="async" />
      </div>
    )
  }
  return (
    <div className="inm-shot">
      <span className="inm-bar"><i /><i /><i /></span>
      <img src={desk} alt={alt} loading="lazy" decoding="async" />
    </div>
  )
}
