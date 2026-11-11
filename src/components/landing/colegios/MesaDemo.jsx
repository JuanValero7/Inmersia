// src/components/landing/colegios/MesaDemo.jsx
// ─────────────────────────────────────────────────────────────
// Noche 17, pestaña «Pruébelo usted»: la mesa de investigación del método
// Anderson, jugable, con 9 pistas reales de Harvey y 3 recetas (deducciones).
// Se juntan tres pistas, se paga 1 ovillo por jugada y se elige qué dicen.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { MESA } from './colegiosData.js'
import { Icono } from './SvgDefs.jsx'

function Carta({ id, sel, onClick }) {
  const [cap, txt] = MESA.pistas[id]
  return (
    <button type="button" className={`lc-md-carta ${sel ? 'lc-sel' : ''}`.trim()} onClick={onClick}>
      <small>CAP. {cap} ♦</small>{txt}
    </button>
  )
}

export default function MesaDemo() {
  const [mesa, setMesa] = useState([])
  const [usadas, setUsadas] = useState([])
  const [hechas, setHechas] = useState([])
  const [saldo, setSaldo] = useState(MESA.saldo)
  const [abierta, setAbierta] = useState(null)
  const [tachadas, setTachadas] = useState([])
  const [aviso, setAviso] = useState(['Toque tres pistas que crea que van juntas para llevarlas a la mesa.', ''])

  const tocarPista = (id) => {
    if (abierta) return
    const nueva = mesa.includes(id) ? mesa.filter((x) => x !== id) : mesa.length < 3 ? [...mesa, id] : mesa
    setMesa(nueva)
    setAviso([nueva.length < 3 ? `Llevas ${nueva.length} de 3 pistas en la mesa.` : 'Listo: toca «Jugar» para ver qué te dicen.', ''])
  }

  const jugar = () => {
    setSaldo((s) => s - 1)
    const pendientes = MESA.recetas.filter((x) => !hechas.includes(x.texto))
    const r = pendientes.find((x) => x.pistas.every((id) => mesa.includes(id)))
    if (r) { setAbierta(r); setTachadas([]); setAviso(['Estas tres van juntas. ¿Qué te dicen de Harvey?', '']); return }
    const casi = pendientes.find((x) => x.pistas.filter((id) => mesa.includes(id)).length === 2)
    setAviso([casi ? 'Dos de estas sí van juntas: cambia la otra.' : 'Estas tres no encajan juntas. Prueba otra combinación.', 'lc-mal'])
    setMesa([])
  }

  const elegir = (k) => {
    if (tachadas.includes(k)) return
    if (k !== abierta.ok) { setTachadas([...tachadas, k]); setAviso(['No es eso. Mira otra vez qué tienen en común las tres pistas.', 'lc-mal']); return }
    const nuevas = [...hechas, abierta.texto]
    setHechas(nuevas); setUsadas([...usadas, ...abierta.pistas]); setMesa([]); setAbierta(null)
    if (nuevas.length === 3) { setSaldo((s) => s + 9); setAviso(['¡Perfil de Harvey completo! +9 ovillos. Así se ve el cambio del personaje, con pruebas.', 'lc-ok']) }
    else setAviso(['¡Nueva deducción! Ya está en la ficha de Harvey. Las pistas usadas se van de la mesa.', 'lc-ok'])
  }

  return (
    <div className="lc-mesa-demo">
      <div className="lc-md-top">
        <span className="lc-md-chip">Harvey Cheyne <b>{hechas.length}/3</b></span>
        <span className="lc-md-saldo"><Icono id="ovillo" className="lc-cz-ovillo" /><span>{saldo}</span></span>
      </div>
      <p className={`lc-md-aviso ${aviso[1]}`.trim()}>{aviso[0]}</p>
      <div className="lc-md-grid">
        <div className="lc-md-izq">
          <div className="lc-md-ficha">
            <small>Lo que sabes de</small><b>Harvey Cheyne</b>
            <div className="lc-md-deds">
              {hechas.map((d) => <div key={d} className="lc-md-ded">{d}<small>3 pistas lo confirman</small></div>)}
              {Array.from({ length: 3 - hechas.length }, (_, i) => <div key={i} className="lc-md-hueco">Deducción por descubrir</div>)}
            </div>
          </div>
          <div className="lc-md-mesa">
            {abierta ? (
              <div className="lc-md-preg">
                <b>¿Qué te dicen estas tres?</b>
                {abierta.opciones.map((o, k) => (
                  <button key={o} type="button" className={`lc-md-opt ${tachadas.includes(k) ? 'lc-mal' : ''}`.trim()} onClick={() => elegir(k)}>
                    <i>{'ABC'[k]}</i>{o}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="lc-md-slots">
                  {[0, 1, 2].map((k) => mesa[k]
                    ? <Carta key={mesa[k]} id={mesa[k]} onClick={() => setMesa(mesa.filter((x) => x !== mesa[k]))} />
                    : <div key={k} className="lc-md-slot">Pista {k + 1}</div>)}
                </div>
                <button type="button" className="lc-md-jugar" disabled={mesa.length < 3 || saldo < 1} onClick={jugar}>
                  Jugar <small><Icono id="ovillo" className="lc-cz-ovillo" />1</small>
                </button>
              </>
            )}
          </div>
        </div>
        <div className="lc-md-pistas">
          <span className="lc-md-titulo">Pistas de Harvey</span>
          <div className="lc-md-cartas">
            {MESA.orden.filter((id) => !usadas.includes(id)).map((id) => (
              <Carta key={id} id={id} sel={mesa.includes(id)} onClick={() => tocarPista(id)} />
            ))}
          </div>
        </div>
      </div>
      <span className="lc-fuente lc-md-nota">Ejemplo con pistas reales de los capítulos 1 a 5. En la app, las pistas llegan solas mientras se lee.</span>
    </div>
  )
}
