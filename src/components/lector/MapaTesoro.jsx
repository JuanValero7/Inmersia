// El mapa del tesoro en el lector: la lista de tesoros del capítulo, el borde
// del libro que brilla cuando hay uno cerca y la respuesta del gato al mandar
// un subrayado al mapa.
//
// useMapaTesoroLector devuelve las piezas que cada lector reparte:
//   · brilla      → hay un tesoro pendiente en lo que se ve en pantalla (brillan
//                   el libro y la entrada al Cuaderno)
//   · quedan      → al capítulo le quedan tesoros (para ofrecer «Mapa del tesoro» al subrayar)
//   · cuaderno    → las fichas para la pestaña «Tesoros» del Cuaderno: solo de los
//                   capítulos hasta el que se lee (las de más adelante contarían lo que pasa)
//   · enviar      → manda un subrayado al mapa ({ parrafoId, texto })
//   · panel       → la lista abierta y la respuesta del gato
// La lista se abre sola la primera vez que se entra en un capítulo con tesoros;
// después vive en el Cuaderno (decisión de Juan, 8 nov: el botón suelto era feo).
// Sin usuario, sin la 091 o sin mapa en el libro, no aparece nada.
// Ensayo del escritor («Cómo lo ve el lector» desde su editor): el mapa sale
// de su propio JSON, se juega en local (sin ovillos ni guardar nada) y las
// frases buenas se ven subrayadas con el color de su ficha (solo él).
// Reglas: Documentation/colegios/mapa-tesoro-prompt.md.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMapaTesoro } from '../../hooks/useMapaTesoro.js'
import { useJuegoEscritor } from '../../hooks/useEscritor.js'
import { ubicarCita } from '../../utils/concurso.js'
import { textoDe, rango } from './Concurso.jsx'
import { fichasDelCapitulo, brilla as brillaEn, quedanTesoros } from '../../utils/mapaTesoro.js'
import { Ovillo } from './Corazonada.jsx'
import '../../styles/corazonada.css'
import '../../styles/mapa-tesoro.css'

const ANCHO = 330
const TIPO = { vista: 'A la vista', escondido: 'Escondido' }
// La voz del gato (frases de Juan, 7 nov).
const RESPUESTA = {
  tesoro: { texto: '¡Bravo!', pose: '2', ovillos: '+1' },
  cerca: { texto: 'Uy, casi', pose: '5', ovillos: '−1' },
  no: { texto: 'Ehhh, ¿por qué te comportas como un perro escarbando en todos lados?', pose: '5', ovillos: '−1' },
  ya_encontrado: { texto: 'Ese ya lo tienes', pose: '7', ovillos: null },
}
const ERRORES = {
  texto_no_coincide: 'No pude leer bien lo que subrayaste. Prueba otra vez.',
}

const gatoSrc = (color, pose) => `/assets/landing/gatos/${color}-${pose}.webp`

const visto = (libroId, cap) => `mapa-visto:${libroId}:${cap}`
function yaVista(libroId, cap) {
  try { return localStorage.getItem(visto(libroId, cap)) === '1' } catch { return false }
}
function marcarVista(libroId, cap) {
  try { localStorage.setItem(visto(libroId, cap), '1') } catch { /* sin almacenamiento: se volverá a abrir */ }
}

// Las fichas de un capítulo: la lista del mapa y la pestaña «Tesoros» del Cuaderno.
export function FichasTesoro({ fichas, colores = null }) {
  const encontrados = fichas.filter(t => t.encontrado).length
  return (
    <>
      <p className="mt-cuenta">{encontrados} de {fichas.length} encontrados</p>
      <ol className="mt-lista">
        {fichas.map((t, i) => (
          <li key={t.id} className={'mt-ficha' + (t.encontrado ? ' is-encontrado' : '')}>
            <span className={'mt-n' + (colores && colores[t.id] != null ? ` mt-esc-${colores[t.id] % 6}` : '')}>{colores?.[t.id] != null ? colores[t.id] + 1 : i + 1}</span>
            <div>
              <span className={'mt-tag is-' + t.tipo}>{TIPO[t.tipo]}</span>
              <p className="mt-q">{t.pregunta}</p>
              {t.encontrado
                ? <>
                    <p className="mt-cita">«{t.cita}»</p>
                    {t.porque && <p className="mt-porque">{t.porque}</p>}
                  </>
                : <p className="mt-estado">Sin encontrar</p>}
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

export const AYUDA_MAPA = 'Cuando el libro brille, hay un tesoro cerca. Subraya la frase y elige «Mapa del tesoro». Acertar +1 · fallar −1.'

function Lista({ fichas, cap, saldo, gatoColor, onCerrar, colores = null }) {
  return (
    <div className="cz-panel mt-panel">
      <div className="cz-head">
        <img className="cz-gato" src={gatoSrc(gatoColor, '7')} alt="" />
        <div><div className="cz-kicker mt-kicker">{colores ? 'Mapa del tesoro · así lo verá tu lector' : 'Mapa del tesoro'}</div><h3>Capítulo {cap}</h3></div>
        {saldo != null && <span className="cz-saldo" title="Tus ovillos en este libro"><Ovillo />{saldo}</span>}
      </div>
      <FichasTesoro fichas={fichas} colores={colores} />
      {colores && <p className="cz-nota">Solo lo ves tú: las frases buenas están subrayadas en el texto con el color del número de su ficha. Aquí no se gasta ni se guarda nada.</p>}
      <p className="cz-nota">{AYUDA_MAPA} También están en tu Cuaderno.</p>
      <div className="cz-btns"><button type="button" className="cz-btn is-main" onClick={onCerrar}>Seguir leyendo</button></div>
    </div>
  )
}

function Respuesta({ r, gatoColor, onCerrar, ensayo = false }) {
  const d = r.error ? { texto: r.error, pose: '7', ovillos: null } : RESPUESTA[r.resultado]
  return (
    <div className="cz-panel mt-panel">
      <div className="cz-head">
        <img className="cz-gato" src={gatoSrc(gatoColor, d.pose)} alt="" />
        <div><div className="cz-kicker mt-kicker">Mapa del tesoro</div><h3>{d.texto}</h3></div>
        {d.ovillos && !ensayo && <span className={'cz-saldo mt-delta' + (r.resultado === 'tesoro' ? ' is-gana' : '')}><Ovillo />{d.ovillos}</span>}
      </div>
      {r.tesoro && (
        <div className="mt-hallado">
          <p className="mt-q">{r.tesoro.pregunta}</p>
          {r.tesoro.porque && <p className="mt-porque">{r.tesoro.porque}</p>}
        </div>
      )}
      <div className="cz-btns"><button type="button" className="cz-btn is-main" onClick={onCerrar}>Seguir leyendo</button></div>
    </div>
  )
}

// Escritorio: al lado de afuera del libro, como la tarjeta de la corazonada.
function posicionar() {
  const libro = document.querySelector('.book-shadow')
  if (!libro) return { left: Math.max(12, (window.innerWidth - ANCHO) / 2), top: 80 }
  const b = libro.getBoundingClientRect()
  const cabeDer = window.innerWidth - b.right >= ANCHO + 30
  const cabeIzq = b.left >= ANCHO + 30
  const left = cabeDer ? b.right + 22 : cabeIzq ? b.left - ANCHO - 22 : window.innerWidth - ANCHO - 12
  return { left, top: Math.max(12, b.top) }
}

/**
 * @param {{ libroId: string|null, userId: string|null, capNum: number|null,
 *   visibles: { numero?: number, tipo?: string }[], parrafos: { id: string, numero: number }[],
 *   gatoColor?: string, movil?: boolean, deshabilitado?: boolean, ensayo?: boolean }} opts
 *   ensayo: el escritor probando su mapa (ver arriba).
 *   visibles: los párrafos que hay en pantalla (en doble página, las dos).
 *   parrafos: los del capítulo, para pasar del id del subrayado a su número.
 */
export function useMapaTesoroLector({ libroId, userId, capNum, visibles, parrafos, gatoColor = 'negro', movil = false, deshabilitado = false, ensayo = false }) {
  const servidor = useMapaTesoro(deshabilitado || ensayo ? null : libroId, userId)
  const local = useMapaEnsayo(ensayo && !deshabilitado ? libroId : null)
  const mt = ensayo ? local : servidor
  const tesoros = useMemo(() => mt.estado?.tesoros ?? [], [mt.estado])
  const enPantalla = useMemo(() => visibles.map(p => p.numero).filter(n => typeof n === 'number'), [visibles])

  // Hasta dónde llegó en cada capítulo: las fichas con spoiler salen al llegar a su brillo.
  // Solo se guarda al cruzar el comienzo de uno de esos brillos: guardarlo en cada página
  // volvía a pintar el lector entero tras cada paso de página.
  const [hasta, setHasta] = useState({})
  const masLejos = enPantalla.length ? Math.max(...enPantalla) : 0
  const umbrales = useMemo(() => tesoros.filter(t => t.cap === capNum && t.spoiler && !t.encontrado).map(t => t.brillo[0]), [tesoros, capNum])
  useEffect(() => {
    if (capNum == null || !masLejos) return
    setHasta(h => {
      const antes = h[capNum] ?? 0
      return umbrales.some(u => antes < u && masLejos >= u) ? { ...h, [capNum]: masLejos } : h
    })
  }, [capNum, masLejos, umbrales])

  const fichas = useMemo(() => capNum == null ? [] : fichasDelCapitulo(tesoros, capNum, hasta[capNum] ?? 0), [tesoros, capNum, hasta])
  const brilla = capNum != null && brillaEn(tesoros, capNum, enPantalla)
  const quedan = capNum != null && quedanTesoros(tesoros, capNum)
  const cuaderno = useMemo(() => capNum == null ? [] : [
    ...tesoros.filter(t => t.cap < capNum),
    ...fichas,
  ], [tesoros, capNum, fichas])

  const [lista, setLista] = useState(null)        // { pos } abierta
  const [respuesta, setRespuesta] = useState(null) // { resultado, tesoro?, error?, pos }

  // Cambiar de capítulo cierra lo abierto. Va antes de la apertura sola: si las
  // dos pasan a la vez, gana la apertura.
  useEffect(() => { setLista(null); setRespuesta(null) }, [capNum])

  // La primera vez en un capítulo con tesoros, la lista se abre sola.
  const hayFichas = fichas.length > 0
  const vistasEnsayo = useRef(new Set())
  useEffect(() => {
    if (!hayFichas || !libroId || capNum == null) return
    if (ensayo) { if (vistasEnsayo.current.has(capNum)) return; vistasEnsayo.current.add(capNum) }
    else { if (yaVista(libroId, capNum)) return; marcarVista(libroId, capNum) }
    setLista({ pos: movil ? null : posicionar() })
  }, [hayFichas, libroId, capNum, movil, ensayo])

  // Los fallos se cierran solos; el tesoro se queda hasta que lo cierre (puede llevar el porque).
  useEffect(() => {
    if (!respuesta || respuesta.resultado === 'tesoro') return
    const t = setTimeout(() => setRespuesta(null), 4000)
    return () => clearTimeout(t)
  }, [respuesta])

  const { subrayar } = mt
  const enviar = useCallback(async ({ parrafoId, texto }) => {
    const pos = movil ? null : posicionar()
    setLista(null)
    const numero = parrafos?.find(p => p.id === parrafoId)?.numero
    if (numero == null || capNum == null) { setRespuesta({ error: ERRORES.texto_no_coincide, pos }); return }
    try {
      const r = await subrayar({ cap: capNum, parrafo: numero, texto })
      setRespuesta({ resultado: r.resultado, tesoro: r.estado.tesoros.find(t => t.id === r.tesoro) ?? null, pos })
    } catch (e) {
      setRespuesta({ error: ERRORES[e?.message] ?? e?.message ?? 'No se pudo mandar. Prueba otra vez.', pos })
    }
  }, [movil, parrafos, capNum, subrayar])

  const cerrar = () => { setLista(null); setRespuesta(null) }
  const abierta = respuesta ?? lista
  const contenido = respuesta
    ? <Respuesta r={respuesta} gatoColor={gatoColor} onCerrar={cerrar} ensayo={ensayo} />
    : lista && <Lista fichas={fichas} cap={capNum} saldo={ensayo ? null : mt.estado?.saldo ?? 0} gatoColor={gatoColor} onCerrar={cerrar}
        colores={ensayo ? local.colores : null} />

  // En móvil la hoja va dentro de la pantalla del lector (usa sus variables
  // de color, .lm-screen); en escritorio, en el body, sobre la mesa.
  const piezas = contenido ? (movil
    ? <div className="lm-backdrop" onClick={cerrar}>
        <div className="lm-sheet" onClick={e => e.stopPropagation()}>
          <div className="lm-grip" />
          <div className="cz-hoja-cuerpo">{contenido}</div>
        </div>
      </div>
    : <div className="cz-tarjeta mt-tarjeta" style={{ left: abierta.pos.left, top: abierta.pos.top }}>{contenido}</div>
  ) : null
  const panel = piezas && !movil ? createPortal(piezas, document.body) : piezas

  // Ensayo: las frases buenas del capítulo, subrayadas en pantalla con el color de su ficha.
  useSubrayadoEscritor(ensayo ? local : null, capNum, parrafos, visibles, movil)

  return {
    brilla,
    quedan,
    cuaderno,
    enviar,
    ocupado: mt.ocupado,
    panel,
  }
}

// ── Ensayo del escritor ────────────────────────────────────

// La misma normalización que _mapa_norm (091): rayas, comillas y espacios.
const normMapa = (t) => (t || '').replace(/[–—-]+/g, '-').replace(/[«»“”"]/g, '"').replace(/\s+/g, ' ').trim()
const citaDe = (datos, t, r) => (datos.textos?.[`${t.cap}:${r.parrafo}`] || '').slice(r.inicio - 1, r.fin)

// El mapa jugado en local con las reglas de mapa_subrayar (091), sin ovillos.
function useMapaEnsayo(libroId) {
  const datos = useJuegoEscritor(libroId, 'mapa', !!libroId).data?.datos
  const [hallados, setHallados] = useState([])
  const estado = useMemo(() => datos ? {
    saldo: null,
    tesoros: (datos.tesoros || []).map(t => {
      const encontrado = hallados.includes(t.id)
      return {
        id: t.id, cap: t.cap, tipo: t.tipo, spoiler: !!t.spoiler, pregunta: t.pregunta, brillo: t.brillo, encontrado,
        ...(encontrado ? { parrafo: t.respuestas[0].parrafo, cita: citaDe(datos, t, t.respuestas[0]), porque: t.porque } : {}),
      }
    }),
  } : null, [datos, hallados])
  // Color de cada tesoro: su orden dentro del capítulo.
  const colores = useMemo(() => {
    const out = {}
    const porCap = {}
    for (const t of datos?.tesoros || []) { porCap[t.cap] = (porCap[t.cap] ?? -1) + 1; out[t.id] = porCap[t.cap] }
    return out
  }, [datos])

  const subrayar = useCallback(async ({ cap, parrafo, texto }) => {
    const sel = normMapa(texto)
    if (!sel || sel.split(' ').length < 3) throw new Error('Subraya al menos tres palabras.')
    const textoP = datos.textos?.[`${cap}:${parrafo}`]
    const pos = textoP != null ? textoP.indexOf(sel) + 1 : 0
    if (textoP != null && pos === 0) throw new Error('texto_no_coincide')
    const comun = (r) => Math.min(pos + sel.length - 1, r.fin) - Math.max(pos, r.inicio) + 1
    let hallado = null, repetido = false, cerca = false, pend = 0
    for (const t of (datos.tesoros || []).filter(x => x.cap === cap)) {
      if (hallados.includes(t.id)) {
        if (pos > 0 && t.respuestas.some(r => r.parrafo === parrafo && comun(r) * 2 > sel.length)) repetido = true
        continue
      }
      pend++
      for (const r of t.respuestas) {
        if (Math.abs(r.parrafo - parrafo) <= 1) cerca = true
        if (!hallado && pos > 0 && r.parrafo === parrafo && comun(r) * 2 > sel.length) hallado = t
      }
    }
    if (!hallado && repetido) return { resultado: 'ya_encontrado', estado }
    if (!pend) throw new Error('En este capítulo no quedan tesoros.')
    if (hallado) {
      const ahora = [...hallados, hallado.id]
      setHallados(ahora)
      const t = { ...hallado, encontrado: true, porque: hallado.porque }
      return { resultado: 'tesoro', tesoro: hallado.id, estado: { ...estado, tesoros: estado.tesoros.map(x => (x.id === t.id ? { ...x, encontrado: true, porque: t.porque } : x)) } }
    }
    return { resultado: cerca ? 'cerca' : 'no', estado }
  }, [datos, hallados, estado])

  return { estado, subrayar, ocupado: false, colores, datos }
}

// Subraya (con el resaltador del navegador, sin tocar el texto) las frases
// buenas del capítulo que hay en pantalla, una capa por color de ficha.
function useSubrayadoEscritor(local, capNum, parrafos, visibles, movil) {
  const datos = local?.datos
  const colores = local?.colores
  useEffect(() => {
    const css = typeof window !== 'undefined' ? window.CSS : null
    if (!css?.highlights || !datos || capNum == null) return
    const raiz = document.querySelector(movil ? '[data-lm-pagebox]' : '.book-shadow')
    if (!raiz) return
    const idDe = new Map((parrafos || []).map(p => [p.numero, p.id]))
    const capas = Array.from({ length: 6 }, () => [])
    for (const t of (datos.tesoros || []).filter(x => x.cap === capNum)) {
      for (const r of t.respuestas) {
        const id = idDe.get(r.parrafo)
        if (!id) continue
        const cita = citaDe(datos, t, r)
        for (const el of raiz.querySelectorAll(`[data-parrafo-id="${css.escape(String(id))}"]`)) {
          const { texto, nodos } = textoDe(el)
          const u = ubicarCita(texto, cita)
          if (u && nodos.length) capas[colores[t.id] % 6].push(rango(nodos, u.start, u.end))
        }
      }
    }
    capas.forEach((rs, k) => { css.highlights.set(`mapa-esc-${k}`, new window.Highlight(...rs)) })
    return () => { for (let k = 0; k < 6; k++) css.highlights.delete(`mapa-esc-${k}`) }
  }, [datos, colores, capNum, parrafos, visibles, movil])
}
