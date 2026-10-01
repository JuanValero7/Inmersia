// src/components/landing/ChatGato.jsx
// ─────────────────────────────────────────────────────────────
// Preguntas frecuentes en forma de chat: las responde el gato.
// Las respuestas están siempre visibles; al tocar una pregunta el gato
// "vuelve a escribirla" (puntitos y luego la frase).
// ─────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { FAQ } from './landingData.js'

/**
 * @param nombre   nombre del gato que responde (Yuri, Mancha, Katana)
 * @param avatar   imagen del gato para la burbuja
 * @param onPregunta()  al tocar una pregunta (el gato grande da un salto)
 */
export default function ChatGato({ nombre, avatar, onPregunta }) {
  const [escribiendo, setEscribiendo] = useState(null) // índice de la respuesta que se está "escribiendo"
  const [vez, setVez] = useState({})                     // índice → contador, para re-animar la burbuja
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const preguntar = (i) => {
    clearTimeout(timer.current)
    setEscribiendo(i)
    onPregunta?.()
    timer.current = setTimeout(() => {
      setEscribiendo(null)
      setVez((v) => ({ ...v, [i]: (v[i] || 0) + 1 }))
    }, 700)
  }

  return (
    <div className="inm-chat">
      {FAQ.map((f, i) => (
        <div className="inm-chat-par" key={f.q}>
          <button type="button" className="inm-ask" onClick={() => preguntar(i)}>{f.q}</button>
          <div className="inm-a">
            <span className="inm-av"><img src={avatar} alt="" /></span>
            <div className={`inm-msg ${vez[i] ? 'is-say' : ''}`} key={vez[i] || 0}>
              <span className="inm-who">{nombre}</span>
              {escribiendo === i
                ? <span className="inm-typing" aria-label="Escribiendo"><i /><i /><i /></span>
                : <p>{f.a}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
