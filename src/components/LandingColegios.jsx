// src/components/LandingColegios.jsx
// ─────────────────────────────────────────────────────────────
// Landing para colegios (escritorio), en /colegios. Pública, sin cuenta.
//
// Una historia de 28 días: Pedro, profe de 3.º B, asigna Capitanes intrépidos.
// Los días pasan en el colegio (lo que ve el profe, con capturas reales del
// panel) y las noches en casa, con dos Mateos: «como hoy» y «en Inmersia».
// Cierra con una corazonada para el colegio y las dudas que responde Katana.
//
// Variante móvil: components/mobile/LandingColegiosMobile.jsx (este mismo
// componente con `mobile`). Clases prefijadas con `lc-` y CSS scopeado bajo
// `.lc-landing` (styles/landing-colegios.css y landing-colegios.mobile.css).
// Piezas en components/landing/colegios/.
//
// Maqueta aprobada: Documents/Inmersia_maquetas/landing/colegios/index.html (fuera del repo)
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { gatoSrc } from './landing/landingData.js'
import { asset, LOGO, PAISES, FAQ, TIPOS_DE_LIBRO, RESUMEN } from './landing/colegios/colegiosData.js'
import { useEscena, useEnFranja } from './landing/colegios/useEscenas.js'
import SvgDefs, { Icono } from './landing/colegios/SvgDefs.jsx'
import Duo from './landing/colegios/Duo.jsx'
import Tarjetas from './landing/colegios/Tarjetas.jsx'
import Captura from './landing/colegios/Captura.jsx'
import Pestanas from './landing/colegios/Pestanas.jsx'
import LibroCorazonada from './landing/colegios/LibroCorazonada.jsx'
import Concurso from './landing/colegios/Concurso.jsx'
import MesaDemo from './landing/colegios/MesaDemo.jsx'
import Notificaciones from './landing/colegios/Notificaciones.jsx'
import Contacto from './landing/colegios/Contacto.jsx'
import Chips, { Tipo } from './landing/colegios/Chips.jsx'
import LegalModal from './legal/LegalModal.jsx'
import SelectorPublico from './landing/SelectorPublico.jsx'
import { evento } from '../lib/analytics.js'
import { useCatalogoLibrosQuery } from '../lib/queries.js'
import { imgUrl } from '../lib/img.js'
import '../styles/landing-colegios.css'

// Ovillos que lleva Mateo en cada noche (contador del lado de Inmersia).
const Contador = ({ n }) => (
  <><span className="lc-sp" /><span className="lc-cont"><Icono id="ovillo" /><span className="lc-tnum">{n}</span> ovillos</span></>
)
const Mide = ({ children }) => <div className="lc-mide">Mide: <span>{children}</span></div>

export default function LandingColegios({ mobile = false }) {
  const rootRef = useRef(null)
  const duo3Ref = useRef(null)
  const [legalDoc, setLegalDoc] = useState(null)

  // ── Noche 3: qué Mateo se ve y si ya saltaron las notificaciones ──
  const [ver3, setVer3] = useState('malo')
  const [juego3, setJuego3] = useState('mapa') // mapa | falsificador
  const [juego25, setJuego25] = useState('desafio') // desafio | explicaselo
  const [emboscada, setEmboscada] = useState('lista') // lista | corriendo | hecha
  const verInmersia3 = (v) => { setVer3(v); if (v === 'bueno' && emboscada === 'lista') setEmboscada('hecha') }
  useEnFranja(duo3Ref, () => setEmboscada('corriendo'), { arriba: 0.3, abajo: 0.45, activo: emboscada === 'lista' && ver3 === 'malo' })

  const escena = useEscena(rootRef)


  // ── País ──
  const [pais, setPais] = useState(PAISES[0])
  const [menuPais, setMenuPais] = useState(false)
  useEffect(() => {
    if (!menuPais) return
    const cerrar = () => setMenuPais(false)
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [menuPais])
  const elegirPais = (p) => { setPais(p); setMenuPais(false); evento('colegios_pais', { pais: p.id }) }

  const [teoria, setTeoria] = useState(false)       // Día 2, móvil: la teoría plegada
  const [intentoConcurso, setIntentoConcurso] = useState(0)
  const [cta, setCta] = useState(false)
  const subir = (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  // «Volver a la pizarra»: centrado, al terminar de leer la escena
  const arribaFin = <div className="lc-arriba-fin"><a className="lc-arriba" href="#arriba" onClick={subir}>↑ Volver a la pizarra</a></div>
  // Resumen de arriba: cada punto lleva a su escena de la historia
  const irA = (esc) => (e) => {
    e.preventDefault()
    evento('colegios_resumen', { a: esc })
    const destino = rootRef.current?.querySelector(`[data-esc="${esc}"]`)
    const n3 = rootRef.current?.querySelector('[data-esc="noche3"]')
    // Si el salto pasa por la noche 3, las notificaciones no saltan en el camino (bloquearían el scroll)
    if (destino && n3 && (n3.compareDocumentPosition(destino) & window.Node.DOCUMENT_POSITION_FOLLOWING)) setEmboscada((e) => (e === 'lista' ? 'hecha' : e))
    if (!destino) return
    destino.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Las capturas se cargan mientras se baja y empujan el destino: se corrige hasta que quede quieto.
    let vueltas = 0
    const corregir = () => {
      const top = destino.getBoundingClientRect().top - (rootRef.current?.querySelector('.lc-nav')?.getBoundingClientRect().bottom ?? 0)
      if (Math.abs(top - 12) > 24 && vueltas++ < 4) { destino.scrollIntoView({ block: 'start' }); setTimeout(corregir, 600) }
    }
    setTimeout(corregir, 1200)
  }
  const [alumnos, setAlumnos] = useState(10)
  const [guardada, setGuardada] = useState(false)

  useEffect(() => {
    const antes = document.title
    document.title = 'Inmersia para colegios'
    window.scrollTo(0, 0)
    return () => { document.title = antes }
  }, [])

  const abrirLegal = (doc) => (e) => { e.preventDefault(); setLegalDoc(doc) }

  // Portadas de los dos libros de ejemplo (Día 2: ficción y no ficción). Sin catálogo, sin portada.
  const { data: catalogo = [] } = useCatalogoLibrosQuery()
  const portada = useMemo(() => Object.fromEntries(catalogo.map((l) => [l.slug, l.portada_url])), [catalogo])

  const navigate = useNavigate()

  // «¿Cómo vas a usar Inmersia?»: aquí está marcado el colegio
  const [avisoPublico, setAvisoPublico] = useState(null)
  const elegirPublico = (p) => {
    evento('colegios_publico', { publico: p.id })
    if (p.id === 'lector') navigate('/')
    else if (p.pronto) setAvisoPublico('Mancha está preparando el rincón de los escritores. ¡Pronto!')
  }

  return (
    <div className={`lc-landing ${mobile ? 'lc-mobile' : ''} ${escena.sol ? '' : 'lc-es-noche'}`.replace(/\s+/g, ' ').trim()} ref={rootRef}>
      <SvgDefs />

      <header className="lc-nav">
        <div className="lc-wrap lc-nav-in">
          <Link to="/" aria-label="Inmersia, inicio"><img className="lc-nav-logo" src={LOGO} alt="Inmersia" /></Link>
          <div className="lc-reloj">
            <span className="lc-reloj-ico"><Icono id={escena.sol ? 'sol' : 'luna'} /></span>
            <span className="lc-reloj-txt"><span className="lc-reloj-dia">{escena.titulo}</span><br /><span className="lc-reloj-sub">{escena.hora}</span></span>
          </div>
          <Contacto abierta={cta} setAbierta={setCta} />
        </div>
      </header>

      <main>

        {/* ═════════ LA PIZARRA DE PEDRO: lo importante, con tiza ═════════ */}
        <section className="lc-portada" data-esc="arriba" data-dia="0" data-titulo="Inmersia para colegios" data-hora="el bimestre" data-sol="1">
          <div className="lc-wrap">
            <div className="lc-gran-pizarra">
              <span className="lc-gp-fecha">3.º B · este bimestre</span>
              <h1>Lo que trae Inmersia a su colegio</h1>
              <ol className="lc-gp-lista">
                {RESUMEN.map((r) => (
                  <li key={r.esc}>
                    <a href={`#${r.esc}`} onClick={irA(r.esc)}>
                      <span className="lc-gp-dia">{r.dia}</span>
                      <span className="lc-gp-t">{r.titulo}</span>
                      <span className="lc-gp-x">{r.texto}</span>
                    </a>
                  </li>
                ))}
              </ol>
              <a className="lc-gp-historia" href="#datos" onClick={irA('datos')}>¿Tiene unos minutos? Lea la historia completa de 28 días ↓</a>
              <img className="lc-gp-gato" src={gatoSrc('negro', 2)} alt="" />
              <span className="lc-gp-tiza" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* ═════════ DATOS ═════════ */}
        <section className="lc-esc lc-dia lc-datos-sec" data-esc="datos" data-dia="0" data-titulo="Antes de empezar" data-hora="lo que ya sabemos" data-sol="1">
          <div className="lc-wrap">
            <div className="lc-datos-cab">
              <div className="lc-esc-head">
                <div className="lc-ceja">Lo que ya sabemos</div>
                <h2>El tiempo es finito y leer ha quedado en un segundo plano.</h2>
                <p>Las consecuencias están a la vista.</p>
              </div>
              <div className="lc-hero-btns lc-datos-pais">
                <div className="lc-pais-wrap">
                    <button type="button" className="lc-btn" aria-haspopup="true" aria-expanded={menuPais}
                      onClick={(e) => { e.stopPropagation(); setMenuPais(!menuPais) }}>
                      Elige tu país <span aria-hidden="true">▾</span>
                    </button>
                    {menuPais && (
                      <div className="lc-pais-menu">
                        {PAISES.map((p) => (
                          <button key={p.id} type="button" onClick={() => elegirPais(p)}>
                            <Icono id={`f-${p.id}`} className="lc-bandera" />{p.nombre}{!p.dato && <> <small>pronto</small></>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="lc-pais-elegido"><Icono id={`f-${pais.id}`} className="lc-bandera" />{pais.nombre}</span>
              </div>
            </div>
            <div className="lc-datos-grid">
              <div className="lc-dato lc-grande">
                <div className="lc-dato-big lc-tnum">{pais.dato ? pais.dato.big : 'PISA'}</div>
                <p>{pais.dato ? pais.dato.txt : `El dato de lectura de ${pais.nombre} en PISA 2025 está en preparación.`}</p>
                <span className="lc-fuente">{pais.dato ? pais.dato.src : 'Lo tomamos de la fuente oficial'}</span>
              </div>
              <div className="lc-dato">
                <div className="lc-dato-big lc-neutro">1 de 3</div>
                <p>chicos de 8 a 18 años disfruta leer en su tiempo libre. El mínimo en 20 años.</p>
                <span className="lc-fuente">National Literacy Trust, Reino Unido, 2025</span>
              </div>
              <div className="lc-dato">
                <div className="lc-dato-big lc-neutro">14 %</div>
                <p>de los chicos de 13 años lee por gusto casi todos los días. En 1984 era el 35 %.</p>
                <span className="lc-fuente">NAEP, Departamento de Educación de EE. UU., 2023</span>
              </div>
              <div className="lc-dato">
                <div className="lc-dato-big lc-neutro">18,7 %</div>
                <p>de los chicos de 8 a 18 años lee algo cada día en su tiempo libre. La cifra más baja desde que se mide.</p>
                <span className="lc-fuente">National Literacy Trust, Reino Unido, 2025</span>
              </div>
            </div>
            <SelectorPublico actual="colegio" onElegir={elegirPublico} mobile={mobile} aviso={avisoPublico} className="lc-publico" />
          </div>
        </section>

        {/* ═════════ EL GIRO: qué ofrecemos ═════════ */}
        <section className="lc-giro" data-dia="0" data-titulo="Antes de empezar" data-hora="cómo cambiarla" data-sol="1">
          <div className="lc-wrap">
            <span className="lc-giro-raya" aria-hidden="true" />
            <h2>¿Cómo podemos <em>cambiar</em> esta historia?</h2>
          </div>
        </section>

        {/* ═════════ LA HISTORIA: Pedro y Mateo ═════════ */}
        <section className="lc-hero lc-historia" data-dia="0" data-titulo="Antes de empezar" data-hora="el bimestre" data-sol="1">
          <div className="lc-wrap lc-hero-grid">
            <div className="lc-hist-txt">
              <div className="lc-ceja">Una historia de 28 días</div>
              <p className="lc-hist-1">Empieza el bimestre. <b>Pedro</b>, el profesor de 3.º B, asigna <b>Capitanes intrépidos</b> como lectura del curso.</p>
              <p className="lc-hist-1"><b>Mateo</b>, a quien no le gusta leer, ya se imagina la nueva tortura que le toca atravesar.</p>
              <p>Acompáñenos a ver cómo sería, para los dos, la experiencia con Inmersia.</p>
              <div className="lc-hist-leyenda">
                <span><Icono id="sol" />De día, el colegio: lo que ve Pedro</span>
                <span><Icono id="luna" />De noche, la casa: cómo lee Mateo</span>
              </div>
            </div>
            <div className="lc-piz-caja">
              <div className="lc-pizarra">
                <div className="lc-piz-tit">Capitanes intrépidos</div>
                <div className="lc-piz-sub">10 capítulos · 28 días para leerlo</div>
              </div>
              <img className="lc-piz-gato" src={gatoSrc('negro', 2)} alt="" />
            </div>
          </div>
        </section>

        {/* ═════════ DÍA 1 ═════════ */}
        <section className="lc-esc lc-dia" data-esc="dia1" data-dia="1" data-hora="8:00 · en el colegio" data-sol="1">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 1</b> 8:00 · en el colegio</div>
              <h2>Lunes, 8:00. Pedro asigna el libro del bimestre.</h2>
              <p>Todo lo que tiene que hacer el colegio en tres pasos.</p>
            </div>
            <div className="lc-d1-grid">
              <ol className="lc-pasos lc-pasos-grandes">
                <li><div><b>El colegio recibe su código</b><span>Con él entra la dirección y arma su lista de salones.</span></div></li>
                <li><div><b>Cada salón tiene dos códigos</b><span>Uno para que entren los alumnos y otro para sus profesores. Así 3.º B queda armado en minutos.</span></div></li>
                <li><div><b>Pedro elige el libro y la fecha</b><span>El libro aparece solo en la biblioteca de los 30 alumnos. Nadie tiene que comprarlo ni descargarlo.</span></div></li>
              </ol>
              <div className="lc-capturas">
                <Captura mobile={mobile} nombre="d1-lista" movil lazy={false} ancho={1500} alto={1090}
                  alt="Lista del colegio: el aula 3.º B con su código de alumnos, su código de profesor y sus 30 alumnos"
                  titulo="La lista del colegio" nota="Los códigos de esta imagen son de ejemplo"
                  marcas={[{ n: 1, escritorio: [100, 11], movil: [97, 57] }, { n: 2, escritorio: [100, 31], movil: [97, 73] }]} />
                <Captura mobile={mobile} nombre="d1-asig" movil lazy={false} ancho={1500} alto={679}
                  alt="Pedro asigna Capitanes intrépidos a 3.º B con fecha meta"
                  titulo="Asignar libro" nota="Elegir el libro y poner la fecha meta"
                  marcas={[{ n: 3, escritorio: [100, 19], movil: [97, 61] }]} />
              </div>
            </div>
            <div className="lc-capsula">
              <div className="lc-capsula-txt">
                <div className="lc-ceja">Antes de abrir el libro <Tipo tipo="nf" /></div>
                <h3>La cápsula del tiempo</h3>
                <p>En los libros de no ficción, antes de empezar cada alumno responde con sus palabras unas preguntas sobre el tema: «¿Quién crees que inventó el dinero?». La respuesta queda sellada.</p>
                <p>Al terminar el libro vuelve a responder, sin ver lo que puso antes. Pedro lee las dos lado a lado. No hay nota: es para ver cuánto cambió su forma de pensar.</p>
              </div>
              <Captura mobile={mobile} nombre="capsula" movil ancho={1500} alto={1361}
                alt="Cápsula del tiempo: lo que una alumna pensaba al empezar Del origen del dinero y lo que piensa al terminarlo"
                titulo="Lo que pensaba antes y lo que piensa ahora" nota="Del origen del dinero · datos de ejemplo" />
            </div>
          </div>
        </section>

        {/* ═════════ NOCHE 1 ═════════ */}
        <section className="lc-esc lc-noche" data-esc="noche1" data-dia="1" data-hora="21:30 · en casa" data-sol="0">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 1</b> 21:30 · en casa</div>
              <h2>Esa noche, Mateo abre el libro.</h2>
              <p>{mobile
                ? 'Arriba elige cuál de los dos ver: como lee hoy o como lee con Inmersia. La misma página del mismo libro.'
                : 'A la izquierda, como lee hoy. A la derecha, con Inmersia. La misma página del mismo libro.'}</p>
            </div>
            <Duo
              mobile={mobile}
              malo={<>
                <div className="lc-fotocopia" aria-hidden="true">
                  <h4>CAPITANES INTRÉPIDOS — RUDYARD KIPLING</h4>
                  -Lo que debe haber sido seis o siete veces -respondió Tom Platt secamente-. Una buena estiba es una estiba, sea como sea; hay una manera buena y otra mala de hacerlo. Si tú hubieras visto cuatrocientas toneladas de hierro colocadas en... -¡Eh! -gritó Manuel, reanudando su trabajo, sin detenerse hasta que el depósito provisional de cubierta quedó completamente vacío. En cuanto el último pescado bajó por la escotilla, Disko se retiró con su hermano. Manuel y Long Jack se dirigieron a proa, y Tom Platt se detuvo sólo el tiempo suficiente para cerrar la escotilla. Medio minuto más tarde Harvey oyó profundos ronquidos, mientras observaba extrañado a Dan y Penn. -Esta vez lo he hecho un poco mejor, Danny -dijo Penn, cuyos párpados se cerraban de puro sueño-. Pero supongo que mi deber es ayudarte a limpiar.
                  <span className="lc-folio">— 40 —</span>
                </div>
                <div className="lc-cel-zumba"><span className="lc-cel" aria-hidden="true" /><span>Página 40 de 212. Letra chica, sin una imagen. El celular vibra al lado.</span></div>
                <p className="lc-lado-pie">Lee cuatro páginas y lo deja. Nadie se entera.</p>
              </>}
              bueno={<>
                <LibroCorazonada />
                <p className="lc-lado-pie">Sigue hasta el capítulo 3. Quiere saber si acertó.</p>
              </>}
            />
            <Tarjetas mobile={mobile} className="lc-detras">
              <div><h4>Cada escena suena</h4><p>De fondo, el mar y el barco. Y las frases que brillan suenan al tocarlas: el grito de Manuel, el pescado que cae, la escotilla que se cierra.</p></div>
              <div><h4>Cada capítulo tiene su imagen</h4><p>Ilustraciones de las escenas, los personajes y los lugares, pensadas para el libro. Un clásico de 1897 deja de parecer de 1897.</p></div>
              <div><h4>La cartelera se llena sola</h4><p>Mientras lee, se desbloquean los personajes, los lugares y los hechos del libro en su tablero de investigación. Sin adelantar nada: solo lo que ya leyó.</p></div>
              <div><h4>La corazonada <Tipo tipo="f" /></h4><p>Un chip entre párrafos, justo donde está el suspenso. Elige qué cree que va a pasar y se queda con las ganas de comprobarlo.</p><Mide>Comprender · inferir</Mide></div>
            </Tarjetas>
            {arribaFin}
          </div>
        </section>

        {/* ═════════ DÍA 2 ═════════ */}
        <section className="lc-esc lc-dia" data-esc="dia2" data-dia="2" data-hora="16:00 · sala de profesores" data-sol="1">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 2</b> 16:00 · sala de profesores</div>
              <h2>Inmersia acompaña la evaluación y el crecimiento de cada alumno.</h2>
              <p>Mientras Mateo lee y juega, Inmersia va juntando evidencia de lo que entiende. Pedro la usa para evaluar y para ayudar a cada uno a mejorar y reconoce el esfuerzo con recompensas que él mismo elige.</p>
            </div>

            <div className={`lc-teoria ${teoria ? 'lc-m-abierta' : ''}`.trim()}>
              <div className="lc-ceja lc-ceja-teoria">La teoría detrás de los juegos</div>
              <h3>Evaluación sigilosa: el alumno juega y la evidencia queda.</h3>
              {mobile && (
                <button type="button" className="lc-m-mas" onClick={() => setTeoria(!teoria)}>{teoria ? 'Ocultar ▴' : 'Cómo funciona ▾'}</button>
              )}
              <div className="lc-teoria-cols">
                <div>
                  <p>Valerie Shute, investigadora de la Universidad Estatal de Florida, la llamó <i>stealth assessment</i>. La idea es medir mientras el alumno hace algo que le interesa, en lugar de detenerlo para tomarle un examen. Se parte de lo que se quiere saber del alumno, se define qué conducta lo demostraría y se diseña una tarea que provoque esa conducta.</p>
                  <p>En Inmersia la tarea es el juego dentro del libro. El alumno nunca siente que está dando un examen, y por eso no estudia para el examen: lee.</p>
                  <span className="lc-fuente">Valerie J. Shute, «Stealth assessment in computer-based games», 2011</span>
                </div>
                <div>
                  <div className="lc-cadena">
                    <div className="lc-eslabon"><small>Competencia</small><b>Lo que queremos saber del alumno</b><span className="lc-eslabon-ej">Por ejemplo, si entiende a los personajes.</span></div><span className="lc-flecha" aria-hidden="true">→</span>
                    <div className="lc-eslabon"><small>Evidencia</small><b>Lo que tendría que hacer para demostrarlo</b><span className="lc-eslabon-ej">Sacar conclusiones correctas de lo que hacen.</span></div><span className="lc-flecha" aria-hidden="true">→</span>
                    <div className="lc-eslabon"><small>Tarea</small><b>Una actividad que provoque esa conducta</b><span className="lc-eslabon-ej">Dentro del juego, sin interrumpir la lectura.</span></div>
                  </div>
                </div>
              </div>
              <div className="lc-pisa">
                <div><b>Localizar</b><span>Encontrar información en el texto.</span><span className="lc-juegos"><em>Mapa del tesoro</em></span></div>
                <div><b>Comprender</b><span>Entender lo literal e inferir lo que no se dice.</span><span className="lc-juegos"><em>Corazonadas</em><em>Concurso</em><em>Mesa de investigación</em></span></div>
                <div><b>Evaluar y reflexionar</b><span>Opinar sobre el texto con hechos del libro.</span><span className="lc-juegos"><em>Desafío del gato</em></span></div>
              </div>
              <p className="lc-sin-nota">Son los tres procesos de lectura de PISA. Inmersia no pone nota: le da la evidencia y usted decide cómo evaluar.</p>
<div className="lc-tipos">
                <h4 className="lc-tipos-t">Una novela no se lee como un ensayo. Cada libro trae sus juegos.</h4>
                <div className="lc-tipos-grid">
                  {TIPOS_DE_LIBRO.map((t) => (
                    <div key={t.id} className={`lc-tipo lc-tipo-${t.id}`}>
                      <div className="lc-tipo-libro">
                        {portada[t.slug] && <img src={imgUrl(portada[t.slug], { width: 160 })} alt="" loading="lazy" />}
                        <div><Tipo tipo={t.id === 'ficcion' ? 'f' : 'nf'} /><b>{t.libro}</b><span>{t.autor}</span></div>
                      </div>
                      <ul>{t.juegos.map((j) => <li key={j}>{j}</li>)}</ul>
                    </div>
                  ))}
                </div>
                <p className="lc-tipos-pie">Inmersia activa los juegos de cada tipo según el libro que asigne. En esta historia los verá marcados.</p>
              </div>
            </div>

            <div className="lc-d2-grid">
              <div className="lc-d2-txt">
                <h3>Los ovillos: la moneda de cada libro</h3>
                <p>Cada libro trae su propia bolsa de ovillos de lana. <b>Leer un capítulo da ovillos</b>, y los juegos dan más si se juegan bien. Se usan en las corazonadas, en los comodines del concurso y en la mesa de investigación.</p>
                <h3>Las recompensas las pone el profe</h3>
                <ul>
                  <li><b>Vales:</b> «2 puntos extra en el examen», «elegir el próximo libro de la clase», «leer en el patio una clase». Pedro decide qué, cuánto cuesta y cuántas veces.</li>
                  <li><b>Bote de la clase:</b> un premio para todos, como ver la película del libro. Cada alumno pone los ovillos que quiere hasta llenarlo.</li>
                  <li><b>Precios justos:</b> el panel le dice cuántos ovillos puede juntar un alumno en este libro (30 solo leyendo, hasta 150 jugando sin equivocarse) y le sugiere precios.</li>
                </ul>
                <p>Los alumnos las ven en la tienda de recompensas, en la calle de la Tienda de Inmersia. Pedro las entrega en clase.</p>
              </div>
              <Captura mobile={mobile} nombre="d2-recomp" movil ancho={1500} alto={1293}
                alt="Panel de recompensas de 3.º B: vales, bote de la clase y formulario para crear una recompensa con precios sugeridos"
                titulo="Pedro arma la tienda de 3.º B" nota="Datos de ejemplo" />
            </div>
            {arribaFin}
          </div>
        </section>

        {/* ═════════ NOCHE 3 ═════════ */}
        <section className="lc-esc lc-noche" data-esc="noche3" data-dia="3" data-hora="22:10 · en casa" data-sol="0">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 3</b> 22:10 · en casa</div>
              <h2>El celular también quiere a Mateo.</h2>
              <p>No podemos luchar contra ello, pero podemos copiar su estrategia. Con incentivos a corto plazo como el mapa del tesoro o el falsificador le damos una razón para concentrarse en la tarea en el momento.</p>
            </div>
            <div ref={duo3Ref}>
              <Duo
                mobile={mobile} className={`lc-duo3 lc-gana-${ver3}`} ver={ver3} onVer={verInmersia3} nombreBueno="En Inmersia"
                extraBueno={ver3 === 'bueno' && (
                  <><span className="lc-sp" />
                    <Chips opciones={[['mapa', 'Mapa del tesoro', 'f'], ['falsificador', 'El falsificador', 'nf']]} valor={juego3} onCambio={setJuego3} className="lc-chips3" />
                  </>
                )}
                malo={<>
                  <div className="lc-malo-mini">
                    <span className="lc-cel-mini" aria-hidden="true" /><span>Sigue en el celular.</span>
                    <button type="button" className="lc-ver-malo" onClick={() => verInmersia3('malo')}>Ver a Mateo, como hoy</button>
                  </div>
                  <div className="lc-feed">
                    <div className="lc-tel" aria-hidden="true">
                      <div className="lc-tel-video" />
                      <div className="lc-tel-noti">
                        <div><b>Fotos · ahora</b>vale.rmz te etiquetó en una historia</div>
                        <div><b>Grupo 3.º B · 14 mensajes</b>Diego: alguien ya leyó lo de Kipling??</div>
                        <div><b>Videos · ahora</b>Un canal que sigues subió un video</div>
                        <div><b>Juego · hace 2 min</b>Tu recompensa diaria te espera</div>
                      </div>
                    </div>
                    <div className="lc-stats">
                      <div className="lc-stat"><b>Querer ≠ disfrutar</b><p>El celular despierta las ganas de seguir mirando, no el placer. No lo pasan bien, pero no lo sueltan.</p><span className="lc-fuente">Kent Berridge, Universidad de Michigan</span></div>
                      <div className="lc-stat"><b>La sorpresa</b><p>Nunca saben si el próximo video será bueno, y por eso siguen mirando. Es la recompensa variable que estudió Skinner.</p></div>
                      <div className="lc-stat lc-ancho"><b>8 h 39 min</b><p>al día pasa un adolescente frente a pantallas para entretenerse, sin contar el colegio. Del otro lado, una fotocopia en blanco y negro.</p><span className="lc-fuente">Common Sense Media, EE. UU., 2021</span></div>
                    </div>
                  </div>
                  <p className="lc-lado-pie">23:40. La fotocopia sigue en la página 40.</p>
                </>}
                bueno={ver3 === 'malo' ? <>
                  <div className="lc-espera-bueno">Mientras tanto…</div>
                  <button type="button" className="lc-ver-bueno" onClick={() => verInmersia3('bueno')}>Ver Inmersia</button>
                </> : juego3 === 'falsificador' ? (
                  <div className="lc-mapa-movil">
                    <div className="lc-tel-marco"><img src={asset('falsificador-m.webp')} alt="El falsificador en el celular: el párrafo sospechoso iluminado y la pregunta ¿Quién escribió este párrafo?, con las opciones Lo escribió Menger y Lo coló el gato" loading="lazy" width="600" height="1298" /></div>
                    <div className="lc-mapa-txt">
                      <h3>El falsificador <Tipo tipo="nf" /></h3>
                      <p>Entre los párrafos del capítulo, el gato cuela uno que el autor nunca escribió. Al pasar la página se apagan las luces y el alumno decide: ¿lo escribió el autor o lo coló el gato?</p>
                      <p>Solo lo pilla quien leyó con atención. El profe ve cuántas trampas detectó cada alumno.</p>
                    </div>
                  </div>
                ) : (
                  <div className="lc-mapa-movil">
                    <div className="lc-tel-marco"><img src={asset('al-mapa-movil.webp')} alt="El mapa del tesoro del capítulo 1 en el celular: dos tesoros encontrados y tres por encontrar" loading="lazy" width="600" height="1298" /></div>
                    <div className="lc-mapa-txt">
                      <h3>Al abrir el capítulo, el mapa del tesoro <Tipo tipo="f" /></h3>
                      <p>Cinco preguntas sobre lo que va a leer: algunas a la vista, otras escondidas. Para encontrar cada tesoro hay que leer con atención y subrayar la frase justa.</p>
                      <p>El capítulo tiene dos razones para leerlo concentrado: la historia y el juego.</p>
                    </div>
                  </div>
                )}
              />
            </div>
            <Tarjetas mobile={mobile} className="lc-detras">
              <div><h4>Dos razones para leer con atención <Tipo tipo="f" /></h4><p>La historia y el juego. Al empezar cada capítulo aparece su mapa del tesoro: preguntas sobre datos concretos de lo que va a leer. Para encontrarlos hay que estar atento, y cada tesoro da ovillos.</p><Mide>Localizar</Mide></div>
              <div><h4>Lo que subraya y anota no se pierde</h4><p>Los subrayados y las notas del cuaderno de toda la clase se juntan. Una IA los lee y le cuenta al profe qué temas le están importando al salón, sin citar ni nombrar a nadie.</p></div>
              <div className="lc-ia-card">
                <span className="lc-maq">Estamos preparando</span>
                <h4>Lo que le está importando a 3.º B</h4>
                <div className="lc-temas">
                  <div className="lc-tema"><b>Si Troop fue injusto con Harvey</b><span>12 alumnos</span></div>
                  <div className="lc-tema"><b>El dinero y lo que no puede comprar</b><span>9 alumnos</span></div>
                  <div className="lc-tema"><b>El trabajo duro en el barco</b><span>7 alumnos</span></div>
                </div>
                <span className="lc-fuente">Temas, no frases. Nunca dice quién escribió qué.</span>
              </div>
            </Tarjetas>
          </div>
        </section>

        {/* ═════════ DÍA 8 ═════════ */}
        <section className="lc-esc lc-dia" data-esc="dia8" data-dia="8" data-hora="10:15 · en el colegio" data-sol="1">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 8</b> 10:15 · en el colegio</div>
              <h2>Una semana después, Pedro ya sabe quién se quedó atrás.</h2>
              <p>No hace falta esperar a la prueba. El Salón le dice, hoy, quién va al día, quién necesita un empujón, quién pasó páginas sin leer y qué frases subrayó la clase.</p>
            </div>
            <Captura mobile={mobile} nombre="d8-salon" movil ancho={1500} alto={1577}
              alt="El Salón de 3.º B el día 8: lectura asignada, alumnos al día, quién necesita un empujón, dónde va cada alumno y lo que más subrayó la clase"
              titulo="El Salón de 3.º B, día 8" nota="Datos de ejemplo" />
            <div className="lc-papel-tira">
              <b>Lo mismo,<br />en papel</b>
              <div><span>¿Quién va al día?</span><b>?</b></div>
              <div><span>¿Por qué capítulo va cada uno?</span><b>?</b></div>
              <div><span>¿Lo leyó o pasó las páginas?</span><b>?</b></div>
            </div>
            <Tarjetas mobile={mobile} className="lc-notas3">
              <div><h4>Al día, por capítulos</h4><p>Al día: llegó al capítulo de la meta de hoy. Un poco atrás: de 1 a 3 capítulos. Atrasado: 4 o más. Se actualiza cada día.</p></div>
              <div><h4>«Leyó muy rápido»</h4><p>Más de 600 palabras por minuto en un capítulo. Es una señal para conversar con el alumno, no una acusación.</p></div>
              <div><h4>Lo que más subrayó la clase</h4><p>Aparece cuando tres o más alumnos marcan el mismo párrafo. Sirve para abrir la próxima discusión en clase. Nunca muestra quién.</p></div>
            </Tarjetas>
          </div>
        </section>

        {/* ═════════ NOCHE 10 ═════════ */}
        <section className="lc-esc lc-noche" data-esc="noche10" data-dia="10" data-hora="21:45 · en casa" data-sol="0">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 10</b> 21:45 · en casa</div>
              <h2>La inteligencia artificial no es el enemigo.</h2>
              <p>El resumen existe desde tiempos inmemoriales. Eso no significa que sea un problema si aprendemos a usarlo a nuestro favor.</p>
            </div>
            <Duo
              mobile={mobile}
              malo={<>
                <div className="lc-chat-ia">
                  <div className="lc-yo">resume los caps 1 al 5 de capitanes intrepidos</div>
                  <div className="lc-ia">Harvey Cheyne, hijo mimado de un millonario, cae al mar desde un transatlántico. Lo rescata Manuel, un pescador del velero <i>We&apos;re Here</i>. El capitán, Disko Troop, no le cree lo de su fortuna y lo pone a trabajar. Con Dan, el hijo del capitán, Harvey aprende el oficio…<small>Respuesta en 10 segundos</small></div>
                </div>
                <div className="lc-stat"><b>1 de 4</b><p>adolescentes ya usó ChatGPT para hacer tareas del colegio: el doble que un año antes.</p><span className="lc-fuente">Pew Research Center, EE. UU., 2025</span></div>
                <p className="lc-lado-pie">Sabe qué pasó. No lo vivió, y en clase se nota.</p>
              </>}
              bueno={
                <Pestanas pestanas={[['repaso', 'Anteriormente en…'], ['cartelera', 'Cartelera de investigación']]}>
                  {(p) => p === 'repaso' ? (
                    <div className="lc-repaso">
                      <div className="lc-repaso-story">
                        <img src={asset('ilus-cap3.jpg')} alt="Escena del capítulo 3" loading="lazy" />
                        <div className="lc-barras-st"><i className="lc-ya" /><i className="lc-ya" /><i /><i /><i /></div>
                        <div className="lc-pie"><small>Anteriormente en</small><b>Capítulo 3</b></div>
                      </div>
                      <div className="lc-repaso-txt">
                        <span className="lc-k">Hace 6 días que no lee. Antes de seguir, un repaso en historias:</span>
                        <ul>
                          <li>Harvey cae al mar desde el transatlántico y lo rescata Manuel.</li>
                          <li>Troop le ofrece diez dólares y medio al mes y Harvey se niega.</li>
                          <li>Dan se vuelve su compañero de trabajo en la cubierta.</li>
                        </ul>
                        <span className="lc-fuente">Solo con lo que ya leyó: los últimos capítulos que terminó.</span>
                      </div>
                    </div>
                  ) : (
                    <Captura mobile={mobile} nombre="al-cartelera" movil panel={false} ancho={1600} alto={1000}
                      alt="Tablero de investigación de Capitanes intrépidos con personajes, lugares, datos y hechos"
                      titulo="Su tablero de investigación" nota="Se llena a medida que lee" />
                  )}
                </Pestanas>
              }
            />
            <Tarjetas mobile={mobile} className="lc-detras">
              <div><h4>Anteriormente en…</h4><p>Si pasaron días sin leer, la ficha del libro le ofrece un repaso de los últimos capítulos en formato de historias, como en las redes. Sin buscar el resumen afuera y sin adelantar nada.</p></div>
              <div><h4>La cartelera de investigación</h4><p>Personajes, lugares, datos y hechos del libro, con ilustraciones, pegados en un corcho que crece con la lectura. Si se le olvidó quién era Long Jack, está ahí.</p></div>
              <div><h4>Lo que un resumen no hace</h4><p>El resumen reemplaza la lectura. El repaso y la cartelera la acompañan: lo devuelven al libro en vez de sacarlo.</p></div>
            </Tarjetas>
          </div>
        </section>

        {/* ═════════ NOCHE 12 ═════════ */}
        <section className="lc-esc lc-noche" data-esc="noche12" data-dia="12" data-hora="22:00 · en casa" data-sol="0">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 12</b> 22:00 · en casa</div>
              <h2>Más léxico, más astuto, mejor alumno.</h2>
              <p>Podemos evaluar la comprensión lectora en tiempo real.</p>
            </div>
            <Duo
              mobile={mobile}
              extraBueno={<><span className="lc-sp" /><button type="button" className="lc-repetir" onClick={() => setIntentoConcurso((n) => n + 1)}>Ver de nuevo</button></>}
              malo={<>
                <div className="lc-fotocopia lc-grande" aria-hidden="true">
                  Un señor de Filadelfia, acurrucado en un rincón, comentó: -Su educación no ha empezado aún. Ese muchacho tiene doscientos dólares mensuales para sus gastos. Él me lo ha dicho. Y todavía no ha cumplido dieciséis años.
                  <span className="lc-garabato">¿?</span>
                </div>
                <p className="lc-lado-pie">No entiende la frase. Sigue de largo. Nadie se entera, ni él.</p>
              </>}
              bueno={<Concurso intento={intentoConcurso} />}
            />
            <Tarjetas mobile={mobile} className="lc-detras">
              <div><h4>El concurso <Tipo tipo="f" /></h4><p>Justo después de leer una frase difícil (ironía, vocabulario, doble sentido) se apagan las luces y un foco cae sobre ella. El alumno explica con sus palabras qué quiso decir, y una IA le dice si la entendió.</p><Mide>Comprender · interpretar</Mide></div>
              <div><h4>Comodines</h4><p>Más contexto o un 50/50, pagados con ovillos. Usarlos también es información: el profe ve si la entendió y con qué ayuda, nunca el texto que escribió.</p></div>
              <div><h4>Siempre se puede saltar</h4><p>«Ahora no» devuelve la luz. Es un juego dentro del libro, no un examen que interrumpe la lectura.</p></div>
            </Tarjetas>
          </div>
        </section>

        {/* ═════════ DÍA 14 ═════════ */}
        <section className="lc-esc lc-dia lc-alt" data-esc="dia14" data-dia="14" data-hora="11:00 · en clase" data-sol="1">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 14</b> 11:00 · en clase</div>
              <h2>Mateo canjea sus primeros ovillos. Y la clase ya juntó medio bote.</h2>
              <p>Dos semanas leyendo y jugando: Mateo pidió los 2 puntos extra en el examen y Pedro tiene que entregarlos. El bote para ver la película va 135 de 200.</p>
            </div>
            <Captura mobile={mobile} nombre="d14-recomp" movil ancho={1500} alto={933}
              alt="Recompensas de 3.º B el día 14: vales canjeados, el bote de la película con 135 de 200 ovillos y lo que hay por entregar"
              titulo="Recompensas de 3.º B, día 14" nota="Datos de ejemplo" />
            <Tarjetas mobile={mobile} className="lc-notas3">
              <div><h4>Por entregar</h4><p>Lo que los alumnos canjearon y Pedro todavía no dio. Si no puede darlo, «Devolver» les regresa los ovillos.</p></div>
              <div><h4>Quién puso cuánto</h4><p>En el bote, Pedro ve cuánto aportó cada uno. El alumno ve el total y lo suyo.</p></div>
              <div><h4>Expedientes de Inmersia</h4><p>Además de los premios de Pedro, cada libro trae expedientes sobre el autor y la época, que los alumnos abren con ovillos.</p></div>
            </Tarjetas>
          </div>
        </section>

        {/* ═════════ NOCHE 15 ═════════ */}
        <section className="lc-esc lc-noche" data-esc="noche15" data-dia="15" data-hora="20:30 · mitad del libro" data-sol="0">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 15</b> 20:30 · mitad del libro</div>
              <h2>Mateo nunca está solo.</h2>
              <p>Dentro del libro los alumnos pueden socializar y darse ánimos: se van encontrando a través de los párrafos.</p>
            </div>
            <Duo
              mobile={mobile}
              extraBueno={<Contador n={44} />}
              malo={<>
                <div className="lc-cuarto">Sigue en la página 40.<br />No sabe que medio salón ya va por el capítulo 5.<br />No tiene con quién comentarlo.</div>
                <p className="lc-lado-pie">Cada uno lee solo. Lo único que comparten es la prueba.</p>
              </>}
              bueno={<>
                <Captura mobile={mobile} nombre="al-comentarios" movil panel={false} ancho={1600} alto={1000}
                  alt="El lector de Capitanes intrépidos con las caritas de los compañeros en el margen y el hilo de comentarios abierto, con la pregunta del profesor Pedro"
                  titulo="Los comentarios de 3.º B, en el párrafo exacto" nota="Las caritas del margen abren el hilo" />
                <div className="lc-comu-grid">
                  <Captura mobile={mobile} nombre="al-leercomo" panel={false} ancho={724} alto={496}
                    alt="Menú Leer como: solo yo o como 3.º B" titulo="Lee «como 3.º B»" nota="o solo, si quiere" />
                  <Captura mobile={mobile} nombre="al-comunidad" panel={false} ancho={900} alto={1072}
                    alt="Comunidad de 3.º B: lectura actual Capitanes intrépidos y el camino con el avance de cada compañero"
                    titulo="La comunidad del aula" nota="«El camino»: dónde va cada compañero" />
                </div>
              </>}
            />
            <Tarjetas mobile={mobile} className="lc-detras">
              <div><h4>El aula es una comunidad</h4><p>Cada salón del colegio es una comunidad privada dentro de Inmersia. Solo entra quien tiene el código del aula, y el libro del aula llega solo a todos.</p></div>
              <div><h4>«Leer como 3.º B»</h4><p>Al leer como su clase, Mateo ve en el margen las caritas de quienes comentaron cada párrafo. Al tocarlas se abre el hilo. Pedro también comenta y deja preguntas para la próxima clase.</p></div>
              <div><h4>Mensajitos entre compañeros</h4><p>Además de comentar un párrafo para toda la clase, un alumno le puede dejar un mensajito a otro dentro del libro: «¡aguanta, lo mejor viene en el capítulo 6!». Solo lo lee quien lo recibe.</p></div>
              <div><h4>El camino</h4><p>Cada uno ve por dónde va el resto del salón. Saber que la mitad ya pasó el capítulo 5 empuja más que cualquier recordatorio.</p></div>
            </Tarjetas>
            <div className="lc-seguro">
              <div className="lc-seguro-cab">
                <span className="lc-seguro-escudo" aria-hidden="true">✓</span>
                <div><h3>Un espacio seguro, sin bullying</h3><p>Socializar dentro del libro solo funciona si nadie la pasa mal.</p></div>
              </div>
              <Tarjetas mobile={mobile} interior className="lc-seguro-grid">
                <div><h4>Solo entra la clase</h4><p>El aula es privada: solo entra quien tiene su código. Nadie de afuera ve ni escribe nada.</p></div>
                <div><h4>«Denunciar» en todo</h4><p>Cada comentario y cada mensajito tiene un botón para denunciarlo. La denuncia llega al equipo de Inmersia, que la revisa.</p></div>
                <div><h4>La prueba no se pierde</h4><p>Al denunciar se guarda una copia del texto, aunque después lo borren.</p></div>
                <div><h4>El profe modera</h4><p>Pedro entra al aula como moderador: puede borrar cualquier comentario de la clase.</p></div>
              </Tarjetas>
            </div>
            {arribaFin}
          </div>
        </section>

        {/* ═════════ NOCHE 17: MÉTODO ANDERSON ═════════ */}
        <section className="lc-esc lc-noche" data-esc="noche17" data-dia="17" data-hora="21:00 · en casa" data-sol="0">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 17</b> 21:00 · en casa</div>
              <h2>Analizar a los personajes y ver más allá de las palabras es el reto más grande.</h2>
              <p>El método Anderson convierte la lectura en una investigación de personajes. Nadie le dice a Mateo cómo es Harvey: lo descubre él, con pruebas.</p>
            </div>
            <Duo
              mobile={mobile}
              extraBueno={<Contador n={52} />}
              malo={<>
                <div className="lc-prueba-hoja" aria-hidden="true">
                  <b>3. Describe al personaje de Harvey Cheyne.</b>
                  <span className="lc-resp-malo">Es rico y mimado.</span>
                  <span className="lc-resp-malo">&nbsp;</span>
                </div>
                <p className="lc-lado-pie">Lo que decía el resumen. Una etiqueta, sin una sola prueba del libro.</p>
              </>}
              bueno={
                <div className="lc-nf">
                  <span className="lc-anderson-dos">El método Anderson, en sus dos versiones</span>
                  <Pestanas pestanas={[['ficcion', 'Mesa de investigación', 'f'], ['noficcion', 'Hilo de ideas', 'nf'], ['prueba', 'Pruébelo usted']]}>
                    {(p) => ({
                      ficcion: (
                        <div className="lc-nf">
                          <p className="lc-nf-txt"><b>La mesa de investigación.</b> En una novela hay personajes. Las pistas son hechos de lo que hizo cada uno y se juntan de a tres para deducir cómo es, con pruebas del libro.</p>
                          <Captura mobile={mobile} nombre="al-mesa" movil panel={false} ancho={1600} alto={1000}
                            alt="Mesa de investigación en la app: tres pistas sobre Harvey y la pregunta qué te dicen estas tres"
                            titulo="La mesa de investigación" nota="Capitanes intrépidos" />
                        </div>
                      ),
                      noficcion: (
                        <div className="lc-nf">
                          <p className="lc-nf-txt"><b>El hilo de ideas.</b> En un ensayo no hay personajes: hay ideas. Las pistas llegan solas al terminar cada capítulo y se juntan de a tres hasta destapar cada idea del autor, una tras otra, hasta la conclusión del libro.</p>
                          <Captura mobile={mobile} nombre="hilo" movil panel={false} ancho={1500} alto={1108}
                            alt="Hilo de ideas de Del origen del dinero: la pizarra con las ideas tapadas, el expediente de la idea elegida y las pistas"
                            titulo="El hilo de ideas" nota="Del origen del dinero, de Carl Menger" />
                        </div>
                      ),
                      prueba: <MesaDemo />,
                    })[p]}
                  </Pestanas>
                </div>
              }
            />
            <div className="lc-anderson-mas">
              <h3>Por qué el método Anderson es lo más poderoso de Inmersia</h3>
              <Tarjetas mobile={mobile} interior>
                <div><span className="lc-num">1</span><h4>Pistas, no citas sueltas</h4><p>Cada pista es un hecho llano sobre lo que hizo un personaje: «Harvey le ofrece pagarle a Troop al contado». La cita queda detrás de «Ver en el libro». El hecho no interpreta: la interpretación la pone el alumno.</p></div>
                <div><span className="lc-num">2</span><h4>Inferir de verdad</h4><p>Las opciones falsas salen de las mismas pistas leídas a medias, sin exageraciones. Para elegir bien hay que haber entendido lo que hizo el personaje, no recordarlo de memoria.</p></div>
                <div><span className="lc-num">3</span><h4>El perfil crece con el libro</h4><p>Las deducciones se vuelven a combinar en otras más profundas, como «Harvey empieza a cambiar». Los personajes entran a la mesa solo cuando aparecen: nada de spoilers.</p></div>
                <div><span className="lc-num">4</span><h4>La señal más honesta para el profe</h4><p>Pedro ve cuántos intentos le llevó cada deducción y qué opciones falsas eligió cada alumno. Eso dice más de su comprensión que cualquier prueba de opción múltiple.</p></div>
              </Tarjetas>
              <div className="lc-mide lc-mide-ancho">Mide: <span>Comprender · inferir el carácter de un personaje</span></div>
            </div>
          </div>
        </section>

        {/* ═════════ DÍA 21 ═════════ */}
        <section className="lc-esc lc-dia" data-esc="dia21" data-dia="21" data-hora="15:30 · reunión de coordinación" data-sol="1">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 21</b> 15:30 · reunión de coordinación</div>
              <h2>La dirección mira todos los cursos de una vez.</h2>
              <p>En la reunión de coordinación ya no se discute con sensaciones: 3.º C va más lento y se ve, a tiempo para hacer algo.</p>
            </div>
            <Captura mobile={mobile} nombre="d28-colegio" movil ancho={1500} alto={1123}
              alt="Vista del colegio: alumnos que leyeron, horas leídas, cursos con lectura asignada, libros terminados y avance por curso"
              titulo="Lo que ve la dirección" nota="Todos los cursos juntos, sin ranking · datos de ejemplo" />
            <Tarjetas mobile={mobile} className="lc-notas3">
              <div><h4>Cuánto se lee</h4><p>Alumnos que leyeron esta semana y horas de lectura del colegio, semana a semana.</p></div>
              <div><h4>Por curso</h4><p>Lectura asignada, docente, alumnos al día y minutos por alumno, en el orden de los cursos y sin ranking.</p></div>
              <div><h4>Para cada profe, su salón</h4><p>La dirección filtra por profesor. Cada profe ve solo sus aulas.</p></div>
            </Tarjetas>
          </div>
        </section>

        {/* ═════════ NOCHE 25 ═════════ */}
        <section className="lc-esc lc-noche" data-esc="noche25" data-dia="25" data-hora="22:15 · terminó el libro" data-sol="0">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 25</b> 22:15 · en casa</div>
              <h2>Una opinión convertida en evaluación. Que la creatividad sea la respuesta.</h2>
              <p>Si consigue un resumen y responde lo correcto, la buena nota es inevitable, aunque sea inmerecida. Al terminar el libro, el gato le hace la pregunta que ningún resumen contesta: qué piensa él.</p>
            </div>
            <Duo
              mobile={mobile}
              extraBueno={<>
                <Contador n={64} />
                <Chips opciones={[['desafio', 'Desafío del gato', 'f'], ['explicaselo', 'Explícaselo a…', 'nf']]} valor={juego25} onCambio={setJuego25} className="lc-chips3" />
              </>}
              malo={<>
                <div className="lc-busqueda">
                  <div className="lc-caja-b">capitanes intrépidos cómo termina</div>
                  <div className="lc-res-b"><b>Capitanes intrépidos: resumen corto y personajes</b>Harvey, un niño rico y malcriado, aprende el valor del trabajo…</div>
                  <div className="lc-res-b"><b>Análisis de la obra para el colegio</b>Tema principal, personajes, preguntas tipo prueba…</div>
                </div>
                <p className="lc-lado-pie">Copia el resumen en su cuaderno para estudiarlo la noche antes.</p>
              </>}
              bueno={juego25 === 'explicaselo' ? (
                <div className="lc-nf">
                  <Tarjetas mobile={mobile} interior className="lc-ex-pasos">
                    {['Gira la ruleta', 'Se lo explica', '¿Lo entendió?'].map((t, i) => (
                      <figure key={t} className="lc-real lc-nf-paso">
                        <figcaption><span className="lc-ex-n">{i + 1}</span>{t}</figcaption>
                        <div className="lc-tel-marco"><img src={asset(`explicaselo-${i + 1}-m.webp`)} alt={`Explícaselo a…, paso ${i + 1}: ${t}`} loading="lazy" decoding="async" width="600" height="1298" /></div>
                      </figure>
                    ))}
                  </Tarjetas>
                </div>
              ) : (
                <div className="lc-chat-gato">
                  <div className="lc-cab"><img src={gatoSrc('negro', 3)} alt="" /><span>Desafío final</span><span className="lc-sp" /><span className="lc-lee">Lo lee tu profe</span></div>
                  <div className="lc-bur lc-g">Te tocó «la tijera». Diriges la película de Capitanes intrépidos. ¿Qué escena cortarías sin romper la historia?</div>
                  <div className="lc-bur lc-a">La de los franceses, cuando Harvey va a pedirles tabaco.</div>
                  <div className="lc-bur lc-g">¿Qué pasa en esa escena? ¿Por qué no se rompería nada?</div>
                  <div className="lc-bur lc-a">Harvey hace de intérprete y se ríen, pero la historia sigue igual sin eso.</div>
                  <div className="lc-bur lc-g">¿Y no muestra nada de Harvey?</div>
                  <div className="lc-bur lc-a">Que ya se anima a hablar con todos. Pero eso se ve en otras partes.</div>
                  <div className="lc-resumen-gato"><b>Resumen para Pedro:</b> elige una escena real (los franceses, capítulo 5) y argumenta que no mueve la trama. Reconoce que muestra el cambio de Harvey y lo sostiene con que se ve en otras escenas.</div>
                </div>
              )}
            />
            <Tarjetas mobile={mobile} className="lc-detras">
              <div><h4>El desafío del gato <Tipo tipo="f" /></h4><p>A mitad y al final del libro, a cada alumno le toca una pregunta abierta al azar. Al final, por ejemplo: «¿Serías amigo de Harvey?» o «tu amigo no leyó nada y tiene que aprobar: ¿qué le dirías que recuerde?». A mitad: «¿Hay algo que no cuadre hasta ahora?».</p><Mide>Evaluar y reflexionar</Mide></div>
              <div><h4>El gato repregunta</h4><p>Dos o tres veces, hasta que el alumno se apoya en hechos del libro. No califica opiniones: cuenta qué dijo y con qué lo sostuvo.</p></div>
              <div><h4>Explícaselo a… <Tipo tipo="nf" /></h4><p>En los libros de no ficción, una ruleta le asigna a quién explicarle una idea: su abuela, un primo de 6 años, un pirata, un marciano… Cada uno con su regla de lenguaje. El personaje repregunta lo que no entendió y el profe lee la charla.</p></div>
              <div><h4>La nota la pone el profe</h4><p>Pedro lee la charla completa y un resumen, y pone la nota si quiere. El alumno sabe que esta parte la lee su profe.</p></div>
            </Tarjetas>
          </div>
        </section>

        {/* ═════════ DÍA 28 ═════════ */}
        <section className="lc-esc lc-dia lc-alt" data-esc="dia28" data-dia="28" data-hora="8:00 · día de la prueba" data-sol="1">
          <div className="lc-wrap">
            <div className="lc-esc-head">
              <div className="lc-ceja"><b>Día 28</b> 8:00 · en el colegio</div>
              <h2>Día de la prueba. Pedro ya sabe qué esperar.</h2>
              <p>Cuatro semanas de evidencia de cada juego, sin un solo examen de por medio.</p>
            </div>
            <div className="lc-final2">
              <div className="lc-fin lc-m"><h3>Mateo, como hoy</h3><div className="lc-big">Pág. 40</div><ul><li>Estudió un resumen anoche.</li><li>Pedro se entera hoy, con la prueba.</li><li>Lo único que se sabe de lo que entendió: la prueba.</li></ul></div>
              <div className="lc-fin lc-b"><h3>Mateo, en Inmersia</h3><div className="lc-big">Terminó el libro</div><ul><li>Lo terminó el día 25. Leyó 17 de 28 días.</li><li>Tesoros, corazonadas, frases, deducciones y un desafío: 41 evidencias.</li><li>Puso 15 ovillos en el bote. El viernes, película.</li></ul></div>
            </div>
            <div className="lc-dash">
              <Pestanas pestanas={[['comp', 'Por proceso de PISA y mesa'], ['desafio', 'Desafío del gato'], ['clase', 'Alumno por alumno, todos los juegos']]}>
                {(p) => ({
                  comp: <Captura key="comp" mobile={mobile} nombre="d28-comp" movil ancho={1500} alto={1362}
                    alt="Comprensión de 3.º B por proceso de PISA, quién necesita apoyo y resultados de la mesa de investigación por deducción"
                    titulo="Comprensión de 3.º B" nota="Quién necesita apoyo en cada habilidad · datos de ejemplo" />,
                  desafio: <Captura key="desafio" mobile={mobile} nombre="d28-desafio" movil ancho={1500} alto={1397}
                    alt="Desafío del gato: la pregunta que le tocó a cada alumno y la nota que puso el profe"
                    titulo="Desafío del gato" nota="La pregunta de cada alumno y la nota del profe · datos de ejemplo" />,
                  clase: <Captura key="clase" mobile={mobile} nombre="d28-clase" deLado ancho={1500} alto={1496}
                    alt="La clase alumno por alumno: capítulos, deducciones, corazonadas, frases difíciles, tesoros y desafío"
                    titulo="Alumno por alumno" nota="Capítulos, deducciones, corazonadas, frases, tesoros y desafío · datos de ejemplo" />,
                })[p]}
              </Pestanas>
              <Tarjetas mobile={mobile} className="lc-dash-pie">
                <div><h4>Cada juego, su evidencia</h4><p>Tesoros encontrados, corazonadas acertadas y cuánto se jugó, frases difíciles comprendidas, deducciones con sus intentos y el desafío con su nota.</p></div>
                <div><h4>Quién necesita apoyo</h4><p>Para cada proceso de PISA, el panel nombra a los alumnos que más lo necesitan, y a los que todavía no jugaron.</p></div>
                <div><h4>Lo que el panel nunca muestra</h4><p>Lo que el alumno escribe para sí mismo: sus notas, sus corazonadas, sus respuestas del concurso. Solo cuántas hizo y si las acertó.</p></div>
              </Tarjetas>
            </div>
            {arribaFin}
          </div>
        </section>

        {/* ═════════ LA CORAZONADA DEL COLEGIO ═════════ */}
        <section className="lc-esc lc-apuesta" data-esc="apuesta" data-dia="28" data-titulo="Su colegio" data-hora="y ahora, usted" data-sol="1">
          <div className="lc-wrap lc-apu-grid">
            <div>
              <div className="lc-esc-head lc-esc-head-apu">
                <div className="lc-ceja"><b>Su turno</b> una corazonada para usted</div>
                <h2>De sus 30 alumnos, ¿cuántos cree que terminan el libro este bimestre?</h2>
                <p>Mueva la barra y guarde su corazonada.</p>
              </div>
              <div className="lc-piloto">
                <div><b>1</b><span>curso</span></div>
                <div><b>1</b><span>libro</span></div>
                <div><b>6</b><span>semanas</span></div>
                <div><b>Gratis</b><span>sin letra chica</span></div>
              </div>
            </div>
            <div className="lc-apu-caja">
              <div className="lc-apu-num"><span className="lc-tnum">{alumnos}</span><small> de 30</small></div>
              <label htmlFor="lc-apu-range" className="lc-apu-label">Alumnos que terminan el libro</label>
              <input type="range" id="lc-apu-range" min="0" max="30" value={alumnos} onChange={(e) => setAlumnos(+e.target.value)} />
              <button type="button" className="lc-btn" onClick={() => { setGuardada(true); evento('colegios_corazonada', { alumnos }) }}>Guardar mi corazonada</button>
              {guardada && (
                <>
                  <div className="lc-apu-res">Usted dice {alumnos} de 30. En el piloto le mostramos el número real.</div>
                  <button type="button" className="lc-btn lc-btn-bordo" data-abre-cta onClick={() => { setCta(true); evento('colegios_contacto', { via: 'cierre', accion: 'abrir' }) }}>Quiero participar</button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ═════════ KATANA RESPONDE ═════════ */}
        <section className="lc-esc lc-dia" data-esc="faq" data-dia="28" data-titulo="Su colegio" data-hora="preguntas frecuentes" data-sol="1">
          <div className="lc-wrap lc-faq-grid">
            <div className="lc-katana">
              <img src={gatoSrc('negro', 6)} alt="Katana, la gata negra" loading="lazy" />
              <span className="lc-nombre">Katana</span>
              <span className="lc-cargo">Responde las dudas de los colegios</span>
            </div>
            <div className="lc-faq">
              {FAQ.map(([p, r], i) => (
                <details key={p} open={i === 0}>
                  <summary>{p}</summary>
                  <div className="lc-resp"><img src={gatoSrc('negro', 7)} alt="" loading="lazy" /><p>{r}</p></div>
                </details>
              ))}
            </div>
          </div>
        </section>

      </main>

      <footer>
        <div className="lc-wrap">
          <img src={LOGO} alt="Inmersia" className="lc-foot-logo" />
          <span>Hecho en Berlín, Alemania</span>
          <a href="/privacidad" onClick={abrirLegal('privacidad')}>Privacidad</a>
          <a href="/terminos" onClick={abrirLegal('terminos')}>Términos</a>
          <a href="/impressum" onClick={abrirLegal('impressum')}>Impressum</a>
          <Link to="/">Inmersia para lectores</Link>
        </div>
      </footer>

      <Notificaciones activa={emboscada === 'corriendo'} />
      {legalDoc && <LegalModal initialDoc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  )
}
