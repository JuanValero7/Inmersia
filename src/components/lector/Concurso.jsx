// El concurso en el lector: al intentar pasar la página donde está la frase
// que le tocó al alumno, se apagan las luces, un foco cae sobre la frase (en
// su sitio, sin cambiar de pantalla) y aparece la tarjeta: «¿qué quiso decir?».
//
// useConcursoLector devuelve las piezas que cada lector reparte:
//   · interceptar(continuar) → para el botón/tecla de avanzar, como las
//                     ilustraciones (interceptForward). true = abrió el foco y
//                     el lector no avanza; al cerrar la tarjeta se llama a
//                     `continuar` (que vuelve a intentar avanzar).
//   · panel        → el foco y la tarjeta (escritorio) u hoja (móvil).
// Sin usuario, sin la 090 o sin frases en el libro, no aparece nada.
//
// El foco se pinta ENCIMA de la página ya dibujada: busca la frase en los <p>
// de pantalla (data-parrafo-id) con un Range del DOM. No toca la paginación.
// Reglas: Documentation/colegios/concurso-prompt.md.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useConcurso, ErrorConcurso } from '../../hooks/useConcurso.js'
import { ubicarCita, contarPalabras } from '../../utils/concurso.js'
import { Ovillo } from './Corazonada.jsx'
import '../../styles/concurso.css'

const MIN_PALABRAS = 3
const MAX_PALABRAS = 200
const ANCHO = 380
const VEREDICTO = {
  correcto: ['is-ok', '¡Correeeecto!'],
  casi: ['is-casi', 'Uy, casi'],
  no: ['is-no', 'Ehhhh, no'],
}
const ERRORES = {
  vuelve_manana: 'El jurado ya trabajó mucho hoy. Vuelve mañana y lo intentamos.',
  ia_no_disponible: 'El jurado no responde ahora. Prueba otra vez en un rato.',
  muy_corta: 'Escribe un poco más: al menos tres palabras.',
  muy_larga: 'Es demasiado largo: como mucho 200 palabras.',
  sesion: 'Hace falta volver a iniciar sesión.',
}

// ── Localizar la frase en pantalla ─────────────────────────

function textoDe(el) {
  const nodos = []
  let texto = ''
  const w = document.createTreeWalker(el, window.NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    nodos.push({ node: n, start: texto.length })
    texto += n.nodeValue
  }
  return { texto, nodos }
}

function rango(nodos, start, end) {
  const donde = (pos) => {
    const k = nodos.findLastIndex(x => x.start <= pos)
    const { node, start: s } = nodos[Math.max(0, k)]
    return [node, Math.min(pos - s, node.nodeValue.length)]
  }
  const r = document.createRange()
  r.setStart(...donde(start))
  r.setEnd(...donde(end))
  return r
}

// Los rangos de la cita en los <p> de ese párrafo que hay en pantalla. Si el
// párrafo está partido entre páginas, vale cuando el FINAL de la cita está a
// la vista (ya la leyó entera); si sigue en la página siguiente, todavía no.
function rangosEnPantalla(raiz, parrafoId, cita) {
  if (!raiz || !parrafoId) return null
  const partes = [...raiz.querySelectorAll(`[data-parrafo-id="${window.CSS.escape(String(parrafoId))}"]`)]
    .map(el => ({ el, ...textoDe(el) }))
    .map(p => ({ ...p, u: ubicarCita(p.texto, cita) }))
    .filter(p => p.u)
  const entera = partes.find(p => p.u.tipo === 'entera')
  let elegidas
  if (entera) elegidas = [entera]
  else {
    const cola = partes.find(p => p.u.tipo === 'cola')
    if (!cola) return null
    const cabeza = partes.find(p => p.u.tipo === 'cabeza' && p.el !== cola.el)
    elegidas = cabeza ? [cabeza, cola] : [cola]
  }
  return elegidas.map(p => rango(p.nodos, p.u.start, p.u.end))
}

// Un rectángulo por línea (los subrayados parten la línea en varios trozos).
// También lo usa el falsificador (Falsificador.jsx).
export function rectsDe(rangos) {
  const lineas = []
  for (const r of rangos || []) {
    for (const b of r.getClientRects()) {
      if (b.width < 2) continue
      const l = lineas.find(x => Math.abs(x.top - b.top) < 3)
      if (l) { l.left = Math.min(l.left, b.left); l.right = Math.max(l.right, b.right); l.bottom = Math.max(l.bottom, b.bottom) }
      else lineas.push({ top: b.top, bottom: b.bottom, left: b.left, right: b.right })
    }
  }
  return lineas
}

// Escritorio: al lado de afuera del libro, a la altura de la frase.
export function posicionar(rects) {
  const libro = document.querySelector('.book-shadow')?.getBoundingClientRect()
  const ref = rects[0]
  if (!libro || !ref) return { left: Math.max(12, (window.innerWidth - ANCHO) / 2), top: 80 }
  const cabeDer = window.innerWidth - libro.right >= ANCHO + 30
  const cabeIzq = libro.left >= ANCHO + 30
  const centro = (ref.left + ref.right) / 2
  let der = centro >= (libro.left + libro.right) / 2
  if (der && !cabeDer && cabeIzq) der = false
  if (!der && !cabeIzq && cabeDer) der = true
  let left = der ? libro.right + 22 : libro.left - ANCHO - 22
  // Sin sitio a ningún lado: encima del libro, en la página que no tiene la frase.
  if (!cabeDer && !cabeIzq) left = centro > window.innerWidth / 2 ? libro.left + 16 : libro.right - ANCHO - 16
  return { left, top: Math.max(12, Math.min(window.innerHeight - 560, ref.top - 80)) }
}

// ── Tarjeta ────────────────────────────────────────────────

function Tarjeta({ frase, saldo, ctxFuera, ocupado, movil, onComodin, onEnviar, onElegir, onAhoraNo, onVolver }) {
  const [fase, setFase] = useState('escribir')   // escribir · delibera · veredicto
  const [texto, setTexto] = useState('')
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const n = contarPalabras(texto)

  const intentar = async (fn, conJurado) => {
    setError(null)
    if (conJurado) setFase('delibera')
    try {
      const r = await fn()
      if (r?.veredicto) { setResultado(r); setFase('veredicto') }
    } catch (e) {
      setFase('escribir')
      setError(e instanceof ErrorConcurso ? (ERRORES[e.codigo] || ERRORES.ia_no_disponible) : (e?.message || 'No se pudo guardar. Prueba otra vez.'))
    }
  }

  const head = (
    <div className="cc-head">
      <div><div className="cc-kicker">El concurso</div><h3>{fase === 'veredicto' ? 'El veredicto' : frase.pregunta}</h3></div>
      <span className="cc-saldo" title="Tus ovillos en este libro"><Ovillo />{saldo}</span>
    </div>
  )

  if (fase === 'delibera') {
    return <div className="cc-panel">{head}<div className="cc-jurado"><div className="cc-tambor">• • •</div><b>El jurado delibera…</b><span>Leyendo tu respuesta</span></div></div>
  }

  if (fase === 'veredicto' && resultado) {
    const [clase, titulo] = VEREDICTO[resultado.veredicto]
    const final = resultado.estado?.frases?.find(f => f.id === frase.id)
    return (
      <div className="cc-panel">
        {head}
        {texto && <div className="cc-mia"><small>Tu respuesta</small>{texto}</div>}
        <div className={'cc-veredicto ' + clase}>
          <span className="cc-big">{titulo}</span>
          {resultado.explicacion && <span>{resultado.explicacion}</span>}
          {resultado.premio > 0 && <span className="cc-gana"><Ovillo />+{resultado.premio} {resultado.premio === 1 ? 'ovillo' : 'ovillos'}</span>}
        </div>
        {final?.referencia && <div className="cc-ref"><small>Así lo entendemos nosotros</small><p>{final.referencia}</p></div>}
        <div className="cc-btns"><button type="button" className="cc-btn is-main" onClick={onVolver}>Volver a la lectura</button></div>
      </div>
    )
  }

  const usoContexto = !!frase.contexto
  const uso5050 = !!frase.opciones
  return (
    <div className="cc-panel">
      {head}
      {usoContexto && ctxFuera && <p className="cc-ctx"><small>Antes de la frase</small>{frase.contexto.cita}</p>}
      {uso5050
        ? <div className="cc-opts">
            {frase.opciones.map((o, i) => (
              <button key={i} type="button" className="cc-opt" disabled={ocupado} onClick={() => intentar(() => onElegir(i), true)}>
                <span className="cc-lt">{'AB'[i]}</span>{o}
              </button>
            ))}
          </div>
        : <>
            <textarea className="cc-texto" value={texto} placeholder="Escríbelo con tus palabras…" aria-label="Tu respuesta"
              autoFocus={!movil} maxLength={MAX_PALABRAS * 12}
              onChange={e => setTexto(e.target.value)}
              onPaste={e => e.preventDefault()} onDrop={e => e.preventDefault()} />
            <div className={'cc-pista' + (n > MAX_PALABRAS ? ' is-pasado' : '')}>
              <span>No se puede pegar texto: escríbelo tú.</span><span>{n} / {MAX_PALABRAS}</span>
            </div>
          </>}
      <div className="cc-comodines">
        <button type="button" className={'cc-com' + (usoContexto ? ' is-usado' : '')} disabled={usoContexto || uso5050 || ocupado || saldo < 1}
          onClick={() => intentar(() => onComodin('contexto'))}>
          {usoContexto && '✓ '}Más contexto <span><Ovillo />1</span>
        </button>
        <button type="button" className={'cc-com' + (uso5050 ? ' is-usado' : '')} disabled={uso5050 || ocupado || saldo < 2}
          onClick={() => intentar(() => onComodin('cincuenta'))}>
          {uso5050 && '✓ '}50/50 <span><Ovillo />2</span>
        </button>
      </div>
      {error && <p className="cc-error" role="alert">{error}</p>}
      <div className="cc-btns">
        <button type="button" className="cc-btn is-luego" onClick={onAhoraNo}>Ahora no</button>
        {!uso5050 && (
          <button type="button" className="cc-btn is-main" disabled={n < MIN_PALABRAS || n > MAX_PALABRAS || ocupado}
            onClick={() => intentar(() => onEnviar(texto.trim()), true)}>
            Enviar al jurado
          </button>
        )}
      </div>
    </div>
  )
}

// ── Hook del lector ────────────────────────────────────────

/**
 * @param {{ libroId: string|null, userId: string|null, capNum: number|null,
 *   visibles: { id?: string, numero?: number }[], clavePagina: string,
 *   movil?: boolean, deshabilitado?: boolean }} opts
 *   visibles: los párrafos que hay en pantalla (en doble página, las dos).
 */
export function useConcursoLector({ libroId, userId, capNum, visibles, clavePagina, movil = false, deshabilitado = false }) {
  const cc = useConcurso(deshabilitado ? null : libroId, userId)
  const frases = useMemo(() => cc.estado?.frases ?? [], [cc.estado])
  const [activa, setActiva] = useState(null)       // { id, continuar }
  const [medida, setMedida] = useState(null)       // { rects, rectsCtx }
  // Las ya cerradas (respondida o «Ahora no») no vuelven a saltar en esta sesión.
  // Es un ref a propósito: el `continuar` del móvil es el handleNext del render
  // en que se abrió, con la lista de frases de entonces (la frase aún sin
  // responder); sin esto, al cerrar la volvía a abrir.
  const cerradas = useRef(new Set())

  const raiz = useCallback(() => document.querySelector(movil ? '[data-lm-pagebox]' : '.book-shadow'), [movil])
  const idDe = useCallback((numero) => visibles.find(p => p.numero === numero)?.id, [visibles])

  const frase = activa ? frases.find(f => f.id === activa.id) : null

  const medir = useCallback(() => {
    if (!frase) { setMedida(null); return }
    const rects = rectsDe(rangosEnPantalla(raiz(), idDe(frase.parrafo), frase.cita))
    const rectsCtx = frase.contexto
      ? rectsDe(rangosEnPantalla(raiz(), idDe(frase.contexto.parrafo), frase.contexto.cita))
      : []
    setMedida({ rects, rectsCtx })
  }, [frase, raiz, idDe])

  useEffect(() => {
    if (!activa) return
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [activa, medir])

  // Si la página cambia por otro lado (capítulo, flecha atrás), se apaga sin avanzar.
  useEffect(() => { setActiva(null) }, [clavePagina])

  const interceptar = useCallback((continuar) => {
    if (activa) return true
    const enPantalla = new Set(visibles.map(p => p.numero))
    for (const f of frases) {
      if (f.cap !== capNum || f.estado === 'resuelta' || cerradas.current.has(f.id) || !enPantalla.has(f.parrafo)) continue
      if (!rangosEnPantalla(raiz(), idDe(f.parrafo), f.cita)) continue
      setActiva({ id: f.id, continuar })
      return true
    }
    return false
  }, [activa, frases, capNum, visibles, raiz, idDe])

  const cerrar = useCallback(() => {
    if (!activa) return
    cerradas.current.add(activa.id)
    const { continuar } = activa
    setActiva(null)
    continuar?.()
  }, [activa])

  // Escape = «Ahora no».
  useEffect(() => {
    if (!activa) return
    const h = (e) => { if (e.key === 'Escape') cerrar() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [activa, cerrar])

  let panel = null
  if (frase && medida) {
    const huecos = [...medida.rects, ...medida.rectsCtx]
    const arriba = movil && medida.rects[0] && medida.rects[0].top > window.innerHeight * 0.5
    const pos = movil ? null : posicionar(medida.rects)
    const tarjeta = (
      <Tarjeta key={frase.id} frase={frase} saldo={cc.estado?.saldo ?? 0} movil={movil}
        ctxFuera={!!frase.contexto && medida.rectsCtx.length === 0} ocupado={cc.ocupado}
        onComodin={(cual) => cc.comodin({ id: frase.id, cual })}
        onElegir={(opcion) => cc.elegir({ id: frase.id, opcion })}
        onEnviar={(respuesta) => cc.evaluar({ id: frase.id, respuesta })}
        onAhoraNo={cerrar} onVolver={cerrar} />
    )
    panel = createPortal(
      <div className="cc-escena">
        <svg className="cc-noche" width="100%" height="100%" aria-hidden="true">
          <defs>
            <mask id="cc-huecos">
              <rect width="100%" height="100%" fill="white" />
              {huecos.map((r, i) => <rect key={i} x={r.left - 4} y={r.top - 2} width={r.right - r.left + 8} height={r.bottom - r.top + 4} rx="5" fill="black" />)}
            </mask>
          </defs>
          <rect width="100%" height="100%" mask="url(#cc-huecos)" />
        </svg>
        {medida.rects.map((r, i) => <div key={i} className="cc-foco" style={{ left: r.left - 4, top: r.top - 2, width: r.right - r.left + 8, height: r.bottom - r.top + 4 }} />)}
        {medida.rectsCtx.map((r, i) => <div key={`c${i}`} className="cc-foco is-ctx" style={{ left: r.left - 4, top: r.top - 2, width: r.right - r.left + 8, height: r.bottom - r.top + 4 }} />)}
        {movil
          ? <div className={'cc-hoja' + (arriba ? ' is-arriba' : '')} role="dialog" aria-label="El concurso">{tarjeta}</div>
          : <div className="cc-tarjeta" role="dialog" aria-label="El concurso" style={{ left: pos.left, top: pos.top }}>{tarjeta}</div>}
      </div>,
      document.body,
    )
  }

  return { interceptar: frases.length ? interceptar : null, panel }
}
