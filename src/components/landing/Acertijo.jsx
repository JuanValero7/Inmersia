// src/components/landing/Acertijo.jsx
// ─────────────────────────────────────────────────────────────
// Acertijo de la sección Investigación. Quien corrige es el gato: este
// componente solo le pasa el veredicto por `onVeredicto(texto, tono)`.
// Al primer fallo da la pista, al tercero ofrece la respuesta.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { ACERTIJOS, ACIERTOS } from './landingData.js'

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-zñ0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const alAzar = (arr) => arr[Math.floor(Math.random() * arr.length)]

/**
 * @param onVeredicto(texto, tono?)  lo que dice el gato; tono 'ok' | 'mal'
 * @param onAcierto() / onFallo()    para animar al gato
 */
export default function Acertijo({ onVeredicto, onAcierto, onFallo }) {
  const [i, setI] = useState(0)
  const [respuesta, setRespuesta] = useState('')
  const [fallos, setFallos] = useState(0)
  const [estado, setEstado] = useState(null) // null | 'ok' | 'mal'
  const acertijo = ACERTIJOS[i]

  const responder = (e) => {
    e.preventDefault()
    const r = normalizar(respuesta)
    if (!r) { onVeredicto('Escribe algo, aunque sea una corazonada.'); return }
    const palabras = r.split(' ')
    if (acertijo.ok.some((k) => palabras.includes(k))) {
      setEstado('ok')
      onVeredicto(alAzar(ACIERTOS), 'ok')
      onAcierto?.()
      return
    }
    const n = fallos + 1
    setFallos(n)
    setEstado('mal')
    onFallo?.()
    if (n === 1) onVeredicto(`Mmm… no. Pista: ${acertijo.pista}`, 'mal')
    else if (n === 2) onVeredicto('Tampoco. Dale otra vuelta.', 'mal')
    else onVeredicto('Si quieres, te digo la respuesta.', 'mal')
  }

  const otro = () => {
    setI((i + 1) % ACERTIJOS.length)
    setRespuesta(''); setFallos(0); setEstado(null)
    onVeredicto(alAzar(['A ver este.', 'Este es más difícil.', 'Otro, a ver qué tal.']))
  }

  const revelar = () => {
    onVeredicto(`Era: ${acertijo.respuesta}. El siguiente lo sacas.`)
    setFallos(0)
  }

  return (
    <form className="inm-riddle" onSubmit={responder} autoComplete="off">
      <div className="inm-riddle-top">
        <p className="inm-riddle-k">Pon a prueba tu olfato</p>
        <span className="inm-riddle-n">{i + 1} de {ACERTIJOS.length}</span>
      </div>
      <p className="inm-riddle-q">{acertijo.q}</p>
      <div className="inm-riddle-row">
        <input
          type="text"
          value={respuesta}
          onChange={(e) => { setRespuesta(e.target.value); if (estado) setEstado(null) }}
          placeholder="Tu respuesta"
          aria-label="Tu respuesta al acertijo"
          className={estado ? `is-${estado}` : undefined}
        />
        <button className="inm-clay-btn" type="submit">Responder</button>
      </div>
      <div className="inm-riddle-foot">
        <button className="inm-linkbtn" type="button" onClick={otro}>Otro acertijo</button>
        {fallos >= 3 && <button className="inm-linkbtn" type="button" onClick={revelar}>Dime la respuesta</button>}
      </div>
    </form>
  )
}
