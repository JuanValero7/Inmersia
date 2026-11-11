// src/components/landing/colegios/LibroCorazonada.jsx
// ─────────────────────────────────────────────────────────────
// Noche 1, «Mateo, en Inmersia»: la página 39-40 del libro con su ilustración
// y el chip de la corazonada. La tarjeta de
// la corazonada funciona como en la app: elegir A/B, cuántos ovillos jugarse
// (Katana cambia de pose) y guardar.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { gatoSrc } from '../landingData.js'
import { asset, CORAZONADA as CZ } from './colegiosData.js'
import { Icono, Ovillos } from './SvgDefs.jsx'

export default function LibroCorazonada() {
  const [abierta, setAbierta] = useState(false)
  const [eleccion, setEleccion] = useState(null)
  const [ovillos, setOvillos] = useState(0)
  const [guardada, setGuardada] = useState(false)

  const guardar = () => { setGuardada(true); setTimeout(() => setAbierta(false), 1800) }

  return (
    <div className="lc-libro">
      <figure className="lc-hoja-l lc-izq">
        <img src={asset('ilus-cap2.jpg')} alt="Ilustración del capítulo 2: la cubierta del velero" />
        <figcaption>Capítulo 2 · La vida a bordo</figcaption>
        <span className="lc-num">39</span>
      </figure>
      <div className="lc-hoja-l lc-der">
        <p>-Lo que debe haber sido seis o siete veces -respondió Tom Platt secamente-. Una buena estiba es una estiba, sea como sea; hay una manera buena y otra mala de hacerlo.</p>
        <p>-¡Eh! -gritó Manuel, reanudando su trabajo, sin detenerse hasta que el depósito provisional de cubierta quedó completamente vacío.</p>
        <p>En cuanto el último pescado bajó por la escotilla, Disko se retiró con su hermano. Tom Platt se detuvo sólo el tiempo suficiente para cerrar la escotilla.</p>
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
          <div className="lc-cz-btns">
            <button type="button" className="lc-cz-btn lc-is-luego" onClick={() => setAbierta(false)}>Ahora no</button>
            <button type="button" className="lc-cz-btn lc-is-main" disabled={guardada || eleccion === null || !ovillos} onClick={guardar}>Guardar corazonada</button>
          </div>
          {guardada && <p className="lc-cz-nota">El libro te dirá si acertaste. Cuando lo cuente, verás un corazón junto al párrafo.</p>}
        </div>
      </div>
    </div>
  )
}
