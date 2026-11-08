// El desafío del gato en el lector: una charla a mitad del libro y otra al
// final. Salta al pasar del final del capítulo que toca (y, si el alumno lo
// deja para luego, al terminar otro capítulo más adelante). Queda en el
// Cuaderno para releerla o seguirla.
//
// useDesafioLector devuelve las piezas que cada lector reparte:
//   · interceptar(continuar) → para pasar de capítulo (y en el móvil, la
//                     última página). true = abrió la charla y el lector no
//                     avanza; al cerrarla se llama a `continuar`.
//   · hayPendiente → hay una charla que saltaría ahora (el móvil lo usa para
//                     dejar el botón de avanzar en la última página del libro).
//   · panel        → la charla: pantalla entera (escritorio) u hoja (móvil).
//   · cuaderno     → lo que necesita la pestaña «Desafíos» del Cuaderno.
// Sin usuario, sin la 092 o sin desafío en el libro, no aparece nada.
//
// Maquetas: Documents/Inmersia_maquetas/colegios/maqueta-desafio.html (PC) y
// maqueta-todos-los-juegos.html (5 · Desafío, móvil).
// Reglas: Documentation/colegios/desafio-prompt.md.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useDesafio, ErrorDesafio } from '../../hooks/useDesafio.js'
import { momentoQueToca, piezasCharla, mensajesQueQuedan, MIN_PALABRAS, MAX_PALABRAS } from '../../utils/desafio.js'
import { contarPalabras } from '../../utils/concurso.js'
import '../../styles/corazonada.css'
import '../../styles/desafio.css'

// Frases fijas del gato. Provisionales: las escribe Juan.
const TEXTOS = {
  intro: {
    mitad: '¡Vas por la mitad del libro! Te tengo un desafío.',
    final: '¡Terminaste el libro! Te tengo un último desafío.',
  },
  titulo: { mitad: 'Desafío · mitad del libro', final: 'Desafío final' },
  explica: 'Contesta con tus palabras. Te haré un par de preguntas para que lo expliques con el libro.',
  completo: '¡Desafío completo!',
  completoProfe: 'Tu charla va para tu profe. Puedes releerla en tu cuaderno.',
  completoSolo: 'Puedes releerla en tu cuaderno.',
  notaProfe: 'Tu profe',
}
const ERRORES = {
  vuelve_manana: 'Tu gato ya habló mucho hoy. Vuelve mañana y seguimos.',
  muy_corta: 'Escribe un poco más.',
  muy_larga: `Es demasiado largo: como mucho ${MAX_PALABRAS} palabras.`,
  sesion: 'Hace falta volver a iniciar sesión.',
  no_se_puede: 'No se pudo enviar. Prueba otra vez.',
}
const gatoSrc = (color) => `/assets/landing/gatos/${color}-6.webp`

// ── La charla ──────────────────────────────────────────────

/**
 * La misma charla en el lector y en el Cuaderno.
 * @param {{ m: import('../../utils/desafio.js').Momento, conProfe: boolean, gatoColor: string,
 *   ocupado: boolean, onEnviar: (texto: string) => Promise<unknown>,
 *   onCerrar?: () => void, movil?: boolean, enCuaderno?: boolean }} props
 */
export function ChatDesafio({ m, conProfe, gatoColor, ocupado, onEnviar, onCerrar, movil = false, enCuaderno = false }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(null)   // lo que se está enviando, para pintarlo ya
  const [error, setError] = useState(null)
  const caja = useRef(null)
  const { consigna, mensajes } = piezasCharla(m)
  const terminada = m.estado === 'terminada'
  const n = contarPalabras(texto)
  const puede = !terminada && !enviando && !ocupado && n >= MIN_PALABRAS && n <= MAX_PALABRAS

  useEffect(() => {
    const c = caja.current
    if (c) c.scrollTop = c.scrollHeight
  }, [mensajes.length, enviando, terminada])

  const enviar = async () => {
    if (!puede) return
    const t = texto.trim()
    setError(null)
    setEnviando(t)
    setTexto('')
    try {
      await onEnviar(t)
    } catch (e) {
      setTexto(t)
      setError(e instanceof ErrorDesafio ? (ERRORES[e.codigo] || ERRORES.no_se_puede) : ERRORES.no_se_puede)
    } finally {
      setEnviando(null)
    }
  }

  return (
    <div className={'df-chat' + (movil ? ' is-movil' : '') + (enCuaderno ? ' is-cuaderno' : '')}>
      <div className="df-chat-h">
        <img className="df-ava" src={gatoSrc(gatoColor)} alt="" />
        <div className="df-who"><b>Tu gato</b><span>{TEXTOS.titulo[m.momento]}</span></div>
        {conProfe && <span className="df-profe">Lo lee tu profe</span>}
        {onCerrar && !terminada && <button type="button" className="df-luego" onClick={onCerrar} disabled={!!enviando}>Ahora no</button>}
      </div>

      <div className="df-msgs" ref={caja} aria-live="polite">
        {!enCuaderno && <div className="df-bub is-gato">{TEXTOS.intro[m.momento]}</div>}
        <div className="df-consigna">
          <div className="df-k">Desafío</div>
          <p>{consigna}</p>
          <small>{TEXTOS.explica}</small>
        </div>
        {mensajes.map((t, i) => <div key={i} className={'df-bub ' + (t.de === 'alumno' ? 'is-yo' : 'is-gato')}>{t.texto}</div>)}
        {enviando && <>
          <div className="df-bub is-yo">{enviando}</div>
          <div className="df-bub is-gato df-escribe" aria-label="Tu gato está escribiendo">• • •</div>
        </>}
        {terminada && <div className="df-hecho"><b>{TEXTOS.completo}</b><span>{conProfe ? TEXTOS.completoProfe : TEXTOS.completoSolo}</span></div>}
        {/* La nota y el comentario que puso el profe en el Salón (094). */}
        {terminada && (m.nota != null || m.comentario) && (
          <div className="df-nota-profe">
            <b>{TEXTOS.notaProfe}{m.nota != null && <span className="df-nota-n">{m.nota} / 20</span>}</b>
            {m.comentario && <p>{m.comentario}</p>}
          </div>
        )}
      </div>

      {terminada
        ? !enCuaderno && onCerrar && <div className="df-composer"><button type="button" className="cz-btn is-main df-seguir" onClick={onCerrar}>Seguir leyendo</button></div>
        : <div className="df-composer">
            <textarea value={texto} aria-label="Tu respuesta"
              placeholder={mensajesQueQuedan(m) === 1 ? 'Tu último mensaje…' : 'Escribe tu respuesta…'}
              autoFocus={!movil && !enCuaderno} maxLength={MAX_PALABRAS * 12} disabled={!!enviando}
              onChange={e => setTexto(e.target.value)}
              onPaste={e => e.preventDefault()} onDrop={e => e.preventDefault()}
              onKeyDown={e => { if (!movil && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} />
            {error && <p className="df-error" role="alert">{error}</p>}
            <div className="df-fila">
              <small>No se puede pegar texto</small>
              <span className={'df-cuenta' + (n > MAX_PALABRAS ? ' is-pasado' : '')}>{n} / {MAX_PALABRAS}</span>
              <button type="button" className="cz-btn is-main" disabled={!puede} onClick={enviar}>Enviar</button>
            </div>
          </div>}
    </div>
  )
}

// La tarjeta de la izquierda en escritorio (maqueta-desafio.html, PC).
function ComoFunciona({ conProfe }) {
  return (
    <div className="df-info">
      <h3>Cómo funciona</h3>
      <ul>
        {conProfe
          ? <li>Esto lo lee tu profe, y la nota la pone él.</li>
          : <li>No hay respuestas buenas ni malas: es para pensar el libro.</li>}
        <li>Tu gato te hará un par de preguntas para que lo expliques con el libro.</li>
        <li>Escríbelo tú: no se puede pegar texto.</li>
        <li>Si lo dejas para luego, queda en tu cuaderno.</li>
      </ul>
    </div>
  )
}

// ── Hook del lector ────────────────────────────────────────

/**
 * @param {{ libroId: string|null, userId: string|null, capNum: number|null,
 *   gatoColor?: string, movil?: boolean, deshabilitado?: boolean }} opts
 */
export function useDesafioLector({ libroId, userId, capNum, gatoColor = 'negro', movil = false, deshabilitado = false }) {
  const df = useDesafio(deshabilitado ? null : libroId, userId)
  const momentos = useMemo(() => df.estado?.momentos ?? [], [df.estado])
  const conProfe = !!df.estado?.con_profe
  const [activo, setActivo] = useState(null)       // { momento, continuar }
  // Los cerrados con «Ahora no» no vuelven a saltar en esta sesión. Ref por
  // lo mismo que en el concurso: el `continuar` es el del render en que se abrió.
  const cerrados = useRef(new Set())

  const interceptar = useCallback((continuar) => {
    if (activo) return true
    const m = momentoQueToca(momentos, capNum, cerrados.current)
    if (!m) return false
    setActivo({ momento: m.momento, continuar })
    return true
  }, [activo, momentos, capNum])

  const cerrar = useCallback(() => {
    if (!activo) return
    cerrados.current.add(activo.momento)
    const { continuar } = activo
    setActivo(null)
    continuar?.()
  }, [activo])

  // Escape = «Ahora no» (o «Seguir leyendo» si ya terminó).
  useEffect(() => {
    if (!activo) return
    const h = (e) => { if (e.key === 'Escape' && !df.ocupado) cerrar() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [activo, cerrar, df.ocupado])

  const enviar = useCallback((momento, texto) => df.enviar({ momento, texto }), [df])

  const m = activo ? momentos.find(x => x.momento === activo.momento) : null
  let panel = null
  if (m) {
    const chat = (
      <ChatDesafio key={m.momento} m={m} conProfe={conProfe} gatoColor={gatoColor} movil={movil}
        ocupado={df.ocupado} onEnviar={(t) => enviar(m.momento, t)} onCerrar={cerrar} />
    )
    panel = movil
      ? <div className="lm-backdrop df-fondo-movil">
          <div className="lm-sheet df-hoja" role="dialog" aria-label="Desafío del gato">
            <div className="lm-grip" />
            {chat}
          </div>
        </div>
      : createPortal(
          <div className="df-escena" role="dialog" aria-label="Desafío del gato">
            <div className="df-mesa">
              <ComoFunciona conProfe={conProfe} />
              {chat}
            </div>
          </div>,
          document.body,
        )
  }

  const empezadas = useMemo(() => momentos.filter(x => x.estado !== 'nueva'), [momentos])

  return {
    interceptar: momentos.length ? interceptar : null,
    hayPendiente: !!momentoQueToca(momentos, capNum, cerrados.current),
    panel,
    cuaderno: empezadas.length ? { momentos: empezadas, conProfe, gatoColor, ocupado: df.ocupado, enviar } : null,
  }
}
