// src/components/landing/escritores/Cuerpos.jsx
// ─────────────────────────────────────────────────────────────
// Lo que va dentro de la tarjeta «Hoy, en Inmersia» de cada parada del
// viaje (LandingEscritores.jsx). Uno por `id` de ERAS. Reciben:
//   ver(src)          abre una captura en grande
//   sonar(clave, src) reproduce / corta una muestra (src 'ruido' = ruido blanco)
//   sonando           clave de la muestra que suena ahora
//   pedir()           abre el pop-up «Quiero ser escritor»
// ─────────────────────────────────────────────────────────────
import { ASSET, ESTILOS, SECCIONES_FICCION, SECCIONES_NOFICCION, EFECTOS, AMBIENTES } from './escritoresData.js'

function Captura({ nombre, alt, ver }) {
  const src = `${ASSET}/capturas/${nombre}.webp`
  return (
    <button type="button" className="le-captura" onClick={() => ver(src)}>
      <img src={src} alt={alt} loading="lazy" /><span className="le-lupa">⤢ ampliar</span>
    </button>
  )
}

function Muestra({ clave, src, children, sonar, sonando }) {
  return (
    <button type="button" className={`le-son ${sonando === clave ? 'le-on' : ''}`} aria-pressed={sonando === clave} onClick={() => sonar(clave, src)}>
      <i />{children}
    </button>
  )
}

const Chips = ({ lista }) => (
  <div className="le-chips">
    {lista.map(([n, d, c]) => <span key={n} style={{ borderTopColor: c }}><b>{n}</b>{d}</span>)}
  </div>
)

function Egipto({ ver }) {
  return (<>
    <p className="le-intro">Tu libro es lo más importante: con él empieza nuestro camino juntos.</p>
    <div className="le-prueba"><b>Estamos en periodo de prueba.</b> A los primeros escritores no les cobramos nada.</div>
    <div className="le-duo">
      <div className="le-trato"><b>El trato</b>
        <ul><li>Tu texto sigue siendo tuyo.</li><li>Nadie lo ve hasta que lo publiques.</li><li>Lo borras cuando quieras, con todo lo que le hayas puesto.</li></ul>
      </div>
      <Captura nombre="avisos" alt="Lo que pasa con tu libro" ver={ver} />
    </div>
    <div className="le-sub">Subirlo es así de simple</div>
    <div className="le-pasos">
      <div><i>1</i><b>Arrastras tu Word</b><small>y eliges ficción o no ficción</small></div>
      <div><i>2</i><b>Lees qué pasa con tu libro</b><small>y das el ok</small></div>
      <div><i>3</i><b>Revisas los capítulos</b><small>que encontramos</small></div>
      <div><i>4</i><b>Título y autor</b><small>y queda guardado</small></div>
    </div>
  </>)
}

function Roma() {
  return (<>
    <p className="le-intro">Primero miramos cómo está armado: sus partes, sus capítulos y qué tipo de libro es. Así sabemos cómo acompañarlo, porque una novela de misterio no se lee igual que un ensayo de historia, y tu lector tiene la experiencia que le corresponde.</p>
    <div className="le-sub">Después pasa por cuatro salas</div>
    <div className="le-salas">
      <div><b>Sonido</b><small>Efectos de sonido y ambiente</small></div>
      <div><b>Imágenes</b><small>Portada, personajes y escenas</small></div>
      <div><b>Análisis</b><small>Armamos uno de los especiales de la casa: la cartelera de investigación</small></div>
      <div><b>Juegos</b><small>Para darle un toque divertido</small></div>
    </div>
    <p className="le-nota">Tú revisas todo antes de publicar. La historia te contará cómo son las salas.</p>
  </>)
}

function Presentacion() {
  return (<>
    <p className="le-intro">Antes de leer una línea, el lector ve cómo se presenta tu libro. Eso lo preparamos en tres piezas:</p>
    <div className="le-piezas">
      <div><span className="le-vis le-v-portada" /><b>Portada</b><small>Gratis, en el estilo de todo el catálogo, para que tu libro luzca junto a los demás.</small></div>
      <div><span className="le-vis le-v-fondo" /><b>Fondo de la ficha</b><small>Una ilustración de tu libro que acompaña su página en la tienda y su lugar en la biblioteca del lector.</small></div>
      <div><span className="le-vis le-v-historias"><i /><i /><i /><i /><i /></span><b>Historias de la tienda</b><small>Un avance de cinco escenas ilustradas que el lector pasa como historias antes de decidirse. Los textos los cambias gratis.</small></div>
    </div>
    <p className="le-nota">Las tres las ves y las cambias antes de publicar.</p>
  </>)
}

function Ilustraciones({ ver }) {
  return (<>
    <p className="le-intro">Eliges un estilo, analizamos tu libro y buscamos las descripciones de personajes, lugares y las escenas más memorables. Te mostramos la descripción y tú decides qué dibujar.</p>
    <div className="le-tipos">
      <span><b>Personajes</b>como los describes tú</span>
      <span><b>Lugares</b>donde pasa tu historia</span>
      <span><b>Escenas</b>las más memorables</span>
    </div>
    <div className="le-sub">Nueve estilos, uno para todo el libro</div>
    <div className="le-estilos">
      {ESTILOS.map((n, k) => {
        const src = `${ASSET}/estilos/e${k}.webp`
        return <button type="button" key={n} onClick={() => ver(src)}><img src={src} alt={n} loading="lazy" /><span>{n}</span></button>
      })}
    </div>
  </>)
}

function Cartelera({ ver }) {
  return (<>
    <p className="le-intro">Uno de los especiales de la casa: mientras lee, tu lector tiene un tablero con todo lo que pasa en tu libro. Se llena capítulo a capítulo y nunca adelanta nada.</p>
    <Captura nombre="cartelera" alt="La cartelera" ver={ver} />
    <div className="le-sub">Si tu libro es ficción</div>
    <Chips lista={SECCIONES_FICCION} />
    <div className="le-sub">Si es no ficción</div>
    <Chips lista={SECCIONES_NOFICCION} />
  </>)
}

function Sonido({ sonar, sonando }) {
  const m = { sonar, sonando }
  return (<>
    <p className="le-intro">Tu libro puede sonar de dos maneras. Dale play a las muestras:</p>
    <div className="le-sonidos">
      <div><b>Efectos</b><small>Suenan justo en su frase.</small>
        {EFECTOS.map(([k, t]) => <Muestra key={k} clave={k} src={`${ASSET}/snd/${k}.mp3`} {...m}>{t}</Muestra>)}
      </div>
      <div><b>Ambientes</b><small>De fondo, por tramos de la historia.</small>
        {AMBIENTES.map(([k, t]) => <Muestra key={k} clave={k} src={`${ASSET}/snd/${k}.mp3`} {...m}>{t}</Muestra>)}
      </div>
    </div>
    <p className="le-intro" style={{ marginTop: 10 }}>Los pones tú: subrayas la frase y eliges entre más de 2.000 sonidos, gratis y sin límite. O lo hacemos nosotros y tú lo revisas.</p>
    <div className="le-nf">
      <div><b>En no ficción, ruido blanco.</b> Un fondo que acompaña sin distraer y que el lector elige: ruido blanco, rosa o marrón, o lluvia, río, olas y fuego.</div>
      <Muestra clave="ruido" src="ruido" {...m}>Ruido blanco</Muestra>
    </div>
  </>)
}

function Juegos() {
  return (<>
    <p className="le-intro">Para darle un toque divertido: juegos que aparecen mientras se lee. Los preparamos a mano leyendo tu libro y tú los editas.</p>
    <div className="le-juegos2">
      <div><h4>Ficción</h4>
        <p><b>Método Anderson</b>Junta pistas del texto y deduce cómo es cada personaje.</p>
        <p><b>Corazonadas</b>En los momentos de suspenso apuesta qué va a pasar. Tu libro le dice si acertó.</p>
        <p><b>El mapa del tesoro</b>Busca en el capítulo la frase que responde y la manda al mapa.</p>
        <a className="le-pill le-naranja" href="/demos/juegos/ficcion.html" target="_blank" rel="noopener">Ver cómo se juegan →</a>
      </div>
      <div><h4>No ficción</h4>
        <p><b>Hilo de ideas</b>Las grandes ideas están tapadas: las destapa juntando sus tres pistas.</p>
        <p><b>El falsificador</b>Se apagan las luces sobre un párrafo: ¿lo escribiste tú o lo coló el gato?</p>
        <p><b>Cápsula del tiempo</b>Escribe lo que piensa antes de leer y lo compara al terminar.</p>
        <a className="le-pill le-naranja" href="/demos/juegos/noficcion.html" target="_blank" rel="noopener">Ver cómo se juegan →</a>
      </div>
    </div>
  </>)
}

function Lectores({ ver, pedir }) {
  return (<>
    <p className="le-intro">Cuando publicas, ves cómo leen tu libro:</p>
    <div className="le-datos">
      <div><b>Cuántos</b><small>lo agregan, lo empiezan y lo terminan</small></div>
      <div><b>Hasta dónde</b><small>llegan y en qué capítulo lo dejan</small></div>
      <div><b>Ahora</b><small>por dónde van tus lectores</small></div>
      <div><b>Subrayados</b><small>las frases que más marcan</small></div>
      <div><b>Juegos</b><small>cómo les va en cada uno</small></div>
      <div><b>Cuándo</b><small>qué días y a qué hora leen</small></div>
    </div>
    <Captura nombre="lectores" alt="Mis lectores" ver={ver} />
    <div className="le-prueba" style={{ margin: '10px 0 0' }}>Siempre en conjunto, <b>nunca lector por lector.</b></div>
    <button type="button" className="le-pill le-naranja" style={{ marginTop: 12 }} onClick={() => pedir('final')}>Quiero ser escritor →</button>
  </>)
}

export const CUERPOS = { egipto: Egipto, roma: Roma, presentacion: Presentacion, ilustraciones: Ilustraciones, cartelera: Cartelera, sonido: Sonido, juegos: Juegos, lectores: Lectores }
