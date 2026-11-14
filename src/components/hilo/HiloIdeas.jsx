// Formato: Plain JavaScript (.jsx)
// El hilo de ideas (no ficción), con la disposición de la maqueta aprobada
// (Documents/Inmersia_maquetas/colegios/maqueta-tablero-noficcion.html):
//   · PC: pizarra arriba (tarjetas con 3 puntitos de estado e hilos);
//     expediente de la idea elegida abajo a la izquierda; pistas abajo a la
//     derecha.
//   · móvil: como Anderson. Pizarrón con marco de madera que se mueve con el
//     dedo (sin barras), barra Pistas | Expediente y, en Pistas, Jugar arriba y
//     las pistas en 2 columnas. Tocar una idea armada lleva a su expediente.
// Se toca la tarjeta de la idea y luego las pistas que se le suman; se valida
// con «Jugar 🧶1». Las reglas viven en la base de datos (migración 100): aquí
// solo se elige y se pinta el tablero que devuelve. Cabecera y navegación las
// pone quien lo monta (Cartelera.jsx / CarteleraMobile.jsx).
// Ensayo del escritor (EditoresJuegos.jsx): con `ensayo`, el tablero y las
// jugadas vienen de fuera (reglas copiadas en local, sin base ni ovillos) y
// cada idea y sus pistas llevan un sello que solo ve el escritor.
import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react'
import { useHiloIdeas } from '../../hooks/useHiloIdeas.js'
import { colocar, infoIdea, marcasPareja, sePuedeArmar } from '../../utils/hilo.js'
import '../../styles/mesa.css'
import '../../styles/hilo.css'

const ESCALA_MOVIL = 0.72
const ESCALA_MAX = 1.6   // PC: hasta dónde crecen las tarjetas para llenar el marco
// PC: tarjetas más anchas y bajas (sobra ancho, falta alto): la pregunta en 2 líneas.
const TARJETA_PC = { tarjeta: 236, pasoY: 104, altoTarjeta: 92 }
const gatoSrc = (color) => `/assets/landing/gatos/${color}-6.webp`
const chipDe = (i) => (i.final === 'principal' ? 'Conclusión' : i.final === 'extra' ? 'Conclusión extra' : 'Idea')

function Ovillo() {
  return (
    <svg className="mesa-ovillo" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M33 33 q5 9 13 7" className="mesa-ovillo-hebra" />
      <circle cx="22" cy="22" r="17" className="mesa-ovillo-bola" />
      <g className="mesa-ovillo-hebra"><path d="M8 16 q14 -7 27 5" /><path d="M6 24 q16 -9 31 4" /><path d="M10 32 q13 -10 25 -1" /><path d="M17 6 q-7 15 2 32" /><path d="M26 6 q-8 15 0 32" /></g>
    </svg>
  )
}

function OjoTapado() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7c2.1 0 3.9.7 5.4 1.7M22 12s-3.6 7-10 7c-2.1 0-3.9-.7-5.4-1.7" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" />
    </svg>
  )
}

const teclas = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } }

/**
 * @param {object} props
 * @param {string|null} props.libroId
 * @param {string|null} props.userId
 * @param {boolean} [props.movil]
 * @param {'negro'|'blanco'|'naranja'} [props.gatoColor]
 * @param {{ estado: any, jugar: Function, pedirAyuda: Function, sello: (id: string) => any, selloIdea: (id: string) => any }|null} [props.ensayo]
 */
export default function HiloIdeas({ libroId, userId, movil = false, gatoColor = 'negro', ensayo = null }) {
  const servidor = useHiloIdeas(ensayo ? null : libroId, userId)
  const { estado, cargando, jugar, pedirAyuda, ocupado } = ensayo ? { ...ensayo, cargando: false, ocupado: false } : servidor
  const [activoSel, setActivoSel] = useState(null)
  const [puestas, setPuestas] = useState({})      // idea → pistas puestas a mano (aún sin jugar)
  const [msg, setMsg] = useState(null)            // { texto, tono: 'bien'|'mal'|'' }
  const [verCita, setVerCita] = useState(null)
  const [panel, setPanel] = useState('pistas')    // móvil: 'pistas' | 'exp'
  const [efecto, setEfecto] = useState({ nuevas: [], temblor: null })
  const [centrar, setCentrar] = useState(null)

  const ideas = useMemo(() => estado?.ideas ?? [], [estado])
  const porId = useMemo(() => Object.fromEntries(ideas.map(i => [i.id, i])), [ideas])
  const pistas = useMemo(() => estado?.pistas ?? [], [estado])
  const pistaPorId = useMemo(() => Object.fromEntries(pistas.map(p => [p.id, p])), [pistas])
  const pares = useMemo(() => marcasPareja(ideas), [ideas])

  // Idea elegida: la que tocó, o la primera que ya se puede armar.
  const jugable = (i) => i.estado === 'abierta' && i.huecos > 0
  const activo = (activoSel && porId[activoSel] && porId[activoSel].estado !== 'cerrada') ? activoSel
    : (ideas.find(i => jugable(i) && i.previas.every(p => porId[p]?.estado === 'armada')) || ideas.find(jugable))?.id ?? null
  const idea = activo ? porId[activo] : null
  const mano = (id) => (puestas[id] || []).filter(p => pistaPorId[p] && !pistaPorId[p].usada_en)

  // ── Pizarra ──
  // Móvil: escala fija y se mueve con el dedo. PC: como la Cartelera, la madera
  // es solo el marco y la pizarra lo llena: se escala para llenar el alto (las
  // tarjetas crecen) y las columnas se separan para llenar el ancho.
  const marcoRef = useRef(null)
  const scrollRef = useRef(null)
  const [caja, setCaja] = useState(null)   // { w, h } del interior del marco (PC)
  const hayEstado = !!estado
  useLayoutEffect(() => {
    if (movil) return
    const el = marcoRef.current
    if (!el) return
    const medir = () => setCaja(c => (c && c.w === el.clientWidth && c.h === el.clientHeight ? c : { w: el.clientWidth, h: el.clientHeight }))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [movil, hayEstado])
  const { lienzo, escala } = useMemo(() => {
    if (movil) return { lienzo: colocar(ideas), escala: ESCALA_MOVIL }
    const natural = colocar(ideas, TARJETA_PC)
    if (!caja) return { lienzo: natural, escala: 1 }
    const k = Math.min(ESCALA_MAX, caja.h / natural.alto, caja.w / natural.ancho)
    return { lienzo: colocar(ideas, { ...TARJETA_PC, ancho: caja.w / k }), escala: k }
  }, [ideas, movil, caja])

  // ── Hilos: se miden las tarjetas ya pintadas ──
  const nodosRef = useRef({})
  const [alturas, setAlturas] = useState({})
  useLayoutEffect(() => {
    const h = {}
    for (const [id, el] of Object.entries(nodosRef.current)) if (el) h[id] = el.offsetHeight
    setAlturas(prev => (Object.keys(h).some(k => h[k] !== prev[k]) ? h : prev))
  }, [estado, puestas, activoSel])

  // Móvil: al tocar una idea, el pizarrón la centra.
  useEffect(() => {
    if (!movil || !centrar) return
    const el = nodosRef.current[centrar], sc = scrollRef.current
    if (el && sc) {
      sc.scrollLeft = (el.offsetLeft + el.offsetWidth / 2) * ESCALA_MOVIL - sc.clientWidth / 2
      sc.scrollTop = (el.offsetTop + el.offsetHeight / 2) * ESCALA_MOVIL - sc.clientHeight / 2
    }
    setCentrar(null)
  }, [movil, centrar])

  // Las animaciones (destapar, temblar) duran una vuelta.
  useEffect(() => {
    if (!efecto.nuevas.length && !efecto.temblor) return
    const t = setTimeout(() => setEfecto({ nuevas: [], temblor: null }), 950)
    return () => clearTimeout(t)
  }, [efecto])

  if (cargando) return <div className="hilo-root hilo-cargando"><div className="spinner" /></div>
  if (!estado) return <div className="hilo-root"><p className="hilo-vacio">Este libro todavía no tiene hilo de ideas.</p></div>

  const decir = (texto, tono = '') => setMsg({ texto, tono })

  // ── Acciones ──
  const activar = (id) => {
    const i = porId[id]
    if (!i || i.estado === 'cerrada') return
    setMsg(null); setActivoSel(id); setCentrar(id)
    setPanel(i.estado === 'armada' ? 'exp' : 'pistas')
  }
  const tocarPista = (pid) => {
    const p = pistaPorId[pid]
    if (p.usada_en) { decir('Esa pista ya está usada en una idea armada.'); return }
    if (!idea || !jugable(idea)) { decir('Primero toca una idea tapada de la pizarra.', 'mal'); return }
    const m = mano(idea.id)
    setMsg(null)
    if (m.includes(pid)) { setPuestas({ ...puestas, [idea.id]: m.filter(x => x !== pid) }); return }
    if (m.length >= idea.huecos) { decir('Ya llenaste los huecos. Toca una pista puesta para sacarla, o dale a Jugar.', 'mal'); return }
    const otras = Object.fromEntries(Object.entries(puestas).map(([k, v]) => [k, v.filter(x => x !== pid)]))
    setPuestas({ ...otras, [idea.id]: [...m, pid] })
  }
  const quitar = (pid) => { if (idea) { setMsg(null); setPuestas({ ...puestas, [idea.id]: mano(idea.id).filter(x => x !== pid) }) } }

  const onJugar = async () => {
    if (!idea || ocupado) return
    try {
      const r = await jugar({ idea: idea.id, pistas: mano(idea.id) })
      if (r.resultado === 'acierto') {
        setPuestas({ ...puestas, [idea.id]: [] })
        setEfecto({ nuevas: r.armadas, temblor: null })
        const cierre = r.armadas.find(id => r.estado.ideas.find(i => i.id === id)?.final === 'principal')
        const otras = r.armadas.filter(id => id !== idea.id && id !== cierre)
        if (cierre) { setActivoSel(cierre); setPanel('exp'); decir(`¡Caso cerrado! Llegaste a la conclusión del libro. +${r.premio} ovillos.`, 'bien') }
        else {
          setPanel('exp')
          decir(`¡Encaja! «${idea.titulo}» destapada. +${r.premio} ovillos.${otras.length ? ' Y por el hilo se armó otra más.' : ''}`, 'bien')
        }
      } else {
        setEfecto({ nuevas: [], temblor: idea.id })
        if (r.resultado === 'casi') decir('Casi: dos de estas sí van juntas. Te las dejé marcadas con 🔗.', 'mal')
        else decir('No encajan juntas. Prueba con otras que cuenten algo en común.', 'mal')
      }
    } catch (e) {
      decir(e.message || 'No se pudo jugar. Revisa tu conexión.', 'mal')
    }
  }
  const onAyuda = async () => {
    if (!idea || ocupado) return
    if (estado.saldo < 1) { decir('No te quedan ovillos. Destapa una idea para ganar más.', 'mal'); return }
    try { await pedirAyuda(idea.id); decir('Ahí tienes una ayuda (−1 ovillo).') }
    catch (e) { decir(e.message || 'No se pudo pedir la ayuda.', 'mal') }
  }

  // ── Piezas ──
  const saldo = ensayo ? null : <span className="mesa-saldo" title="Tus ovillos en este libro"><Ovillo />{estado.saldo}</span>

  const jugarBtn = (i) => {
    const info = infoIdea(i, mano(i.id), porId)
    return (
      <button type="button" className="mesa-jugar" onClick={onJugar} disabled={!info.puedeJugar || ocupado || estado.saldo < 1}>
        {ocupado ? 'Pensando…' : 'Jugar'} <small><Ovillo />1</small>
      </button>
    )
  }

  const puntos = (i) => {
    const info = infoIdea(i, mano(i.id), porId)
    const m = mano(i.id)
    const txt = info.res === 'casi' ? 'Casi' : info.res === 'no' ? 'No encaja' : info.faltanIdeas.length ? 'Falta una idea' : info.lleno ? 'Lista para jugar' : ''
    const cls = info.res ? ` r-${info.res}` : info.lleno && !info.faltanIdeas.length ? ' r-lista' : ''
    return (
      <span className="hilo-est">
        {i.previas.map(p => <i key={p} className={`hilo-dot${porId[p]?.estado === 'armada' ? ' is-idea' : ''}`} />)}
        {m.map(p => <i key={p} className={`hilo-dot ${info.res === 'casi' && info.marcadas.includes(p) ? 'is-ok2' : 'is-puesta'}`} />)}
        {Array.from({ length: Math.max(0, i.huecos - m.length) }, (_, k) => <i key={'v' + k} className="hilo-dot" />)}
        {txt && <span className={`hilo-est-txt${cls}`}>{txt}</span>}
      </span>
    )
  }

  const nodo = (i) => {
    const p = lienzo.pos[i.id]
    const cls = `hilo-nodo is-${i.estado}${activo === i.id ? ' is-activa' : ''}${i.final ? ' is-final' : ''}`
      + `${efecto.nuevas.includes(i.id) ? ' is-nueva' : ''}${efecto.temblor === i.id ? ' is-temblor' : ''}`
    const ref = (el) => { nodosRef.current[i.id] = el }
    const style = { left: p.x, top: p.y, width: lienzo.tarjeta }
    if (i.estado === 'cerrada') {
      return <div key={i.id} ref={ref} className={cls} style={style}><OjoTapado />Se abre más adelante en el libro</div>
    }
    return (
      <div key={i.id} ref={ref} className={cls} style={style} role="button" tabIndex={0}
        aria-label={i.estado === 'armada' ? `Idea armada: ${i.titulo}` : `Idea: ${i.pregunta}`}
        onClick={() => activar(i.id)} onKeyDown={teclas(() => activar(i.id))}>
        <span className="hilo-pin" />
        {ensayo?.selloIdea(i.id)}
        <span className="hilo-chip">{chipDe(i)}</span>
        {sePuedeArmar(i, porId) && <span className="hilo-puedes" title="Ya tienes lo necesario para armarla">✓ Ya puedes</span>}
        {i.estado === 'armada'
          ? <><span className="hilo-tit">{i.titulo}</span><span className="hilo-stamp">✓ ARMADA</span></>
          : <><span className="hilo-q">{i.pregunta}</span>{puntos(i)}</>}
      </div>
    )
  }

  const hilos = ideas.flatMap(t => t.previas.filter(s => lienzo.pos[s]).map(s => {
    const a = lienzo.pos[s], b = lienzo.pos[t.id]
    const ha = alturas[s] ?? 100, hb = alturas[t.id] ?? 100
    const x1 = a.x + lienzo.tarjeta, y1 = a.y + ha / 2, x2 = b.x, y2 = b.y + hb / 2
    const dx = Math.max(30, (x2 - x1) / 2)
    const d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
    return porId[s]?.estado === 'armada'
      ? <g key={s + t.id} className="hilo-hilo is-tenso"><path d={d} /><circle cx={x1} cy={y1} r="5" /><circle cx={x2} cy={y2} r="5" /></g>
      : <path key={s + t.id} className="hilo-hilo" d={d} />
  }))

  const pizarra = (
    <div className="hilo-hold" style={{ width: lienzo.ancho * escala, height: lienzo.alto * escala }}>
      <div className="hilo-canvas" style={{ width: lienzo.ancho, height: lienzo.alto, transform: `scale(${escala})` }}>
        <svg className="hilo-hilos" aria-hidden="true">{hilos}</svg>
        {ideas.map(nodo)}
      </div>
    </div>
  )

  const textoPieza = (id) => pistaPorId[id]?.t ?? porId[id]?.titulo ?? id

  const expediente = () => {
    if (!idea) return <div className="hilo-vacio">Toca una idea de la pizarra para abrir su expediente.</div>
    if (idea.estado === 'armada') {
      return (
        <div className="hilo-exp">
          <span className="hilo-exp-tab">EXPEDIENTE · {chipDe(idea).toUpperCase()}</span>
          {idea.final === 'principal' && <span className="hilo-cierre">CASO CERRADO · LA CONCLUSIÓN DEL LIBRO</span>}
          <span className="hilo-tit">{idea.titulo}</span>
          <span className="hilo-concl">{idea.conclusion}</span>
          <span className="hilo-stamp">✓ ARMADA</span>
          <ul className="hilo-piezas">{(idea.piezas ?? []).map(id => <li key={id}>{textoPieza(id)}</li>)}</ul>
        </div>
      )
    }
    const info = infoIdea(idea, mano(idea.id), porId)
    const m = mano(idea.id)
    const faltoEsta = estado.faltaron?.find(f => f.id === idea.id)
    const listo = info.faltanIdeas.length
      ? <span className="hilo-listo is-no">Aún no: falta armar {info.faltanIdeas.length === 1 ? 'la idea que llega por el hilo' : `${info.faltanIdeas.length} ideas que llegan por el hilo`}</span>
      : idea.huecos ? <span className="hilo-listo is-si">✓ Ya tienes todo para armarla</span> : null
    return (
      <div className={`hilo-exp${efecto.temblor === idea.id ? ' is-temblor' : ''}`}>
        <span className="hilo-exp-tab">EXPEDIENTE · {chipDe(idea).toUpperCase()}</span>
        <span className="hilo-q">{idea.pregunta}</span>
        {listo}
        {!idea.huecos && <span className="hilo-listo is-no">Se arma sola cuando tengas las ideas que llegan aquí.</span>}
        <div className="hilo-slots">
          {idea.previas.map(p => porId[p]?.estado === 'armada'
            ? <div key={p} className="hilo-slot is-armado">🧵 {porId[p].titulo}</div>
            : <div key={p} className="hilo-slot">Llega sola por el hilo{porId[p]?.titulo ? `: «${porId[p].titulo}»` : ''}</div>)}
          {m.map(pid => (
            <button key={pid} type="button" className="hilo-slot is-puesta" onClick={() => quitar(pid)} title="Toca para sacarla">
              {info.res === 'casi' && info.marcadas.includes(pid) && <span className="hilo-ok2">🔗</span>}
              <span>{pistaPorId[pid]?.t}</span><span className="hilo-slot-x" aria-hidden="true">×</span>
            </button>
          ))}
          {Array.from({ length: Math.max(0, idea.huecos - m.length) }, (_, k) => (
            <div key={'l' + k} className="hilo-slot is-libre">＋ Toca una pista para sumarla</div>
          ))}
        </div>
        {info.res === 'casi' && <span className="hilo-marca is-casi">Casi: dos de estas van juntas (🔗)</span>}
        {info.res === 'no' && <span className="hilo-marca is-mal">No encajan juntas</span>}
        {idea.huecos > 0 && (
          <div className="hilo-jugar-row">{saldo}{jugarBtn(idea)}</div>
        )}
        {idea.huecos > 0 && estado.saldo < 1 && <div className="hilo-sin-ovillos">Te quedaste sin ovillos.</div>}
        {idea.huecos > 0 && (idea.falta
          ? <div className="hilo-falta">{idea.falta}</div>
          : <button type="button" className="hilo-ayuda" onClick={onAyuda} disabled={ocupado}>Ayuda · 1 ovillo</button>)}
        {faltoEsta && (
          <div className="hilo-faltaron">
            <b>Lo que te faltó</b>
            <span className="hilo-concl">{faltoEsta.conclusion}</span>
            <ul className="hilo-piezas">{faltoEsta.piezas.map(id => <li key={id}>{textoPieza(id)}</li>)}</ul>
          </div>
        )}
      </div>
    )
  }

  const pista = (p) => {
    const usada = p.usada_en ? porId[p.usada_en] : null
    const enIdea = !usada && Object.entries(puestas).find(([, v]) => v.includes(p.id))?.[0]
    const sel = !!idea && enIdea === idea.id
    const par = pares[p.id]
    return (
      <div key={p.id} role="button" tabIndex={0} className={`hilo-pista${sel ? ' is-sel' : ''}${usada ? ' is-usada' : ''}`}
        onClick={() => tocarPista(p.id)} onKeyDown={teclas(() => tocarPista(p.id))}>
        <span className="hilo-pin" />
        {p.cap === estado.capitulos_completados && !usada && <span className="hilo-pista-tag">nueva</span>}
        <span className="hilo-pista-t">{p.t}</span>
        {ensayo?.sello(p.id)}
        {(usada || enIdea || par != null) && (
          <span className="hilo-pista-donde">
            {par != null && <span className={`mesa-par par-${par % 6}`} title="Va junto con otra pista marcada igual">🔗{par + 1}</span>}
            {usada ? `✓ Usada en: ${usada.titulo}` : enIdea ? `En: ${porId[enIdea]?.titulo ?? ''}` : ''}
          </span>
        )}
        {verCita === p.id && <span className="hilo-pista-cita">«…{p.cita}…»</span>}
        <button type="button" className="hilo-pista-ver" onClick={(e) => { e.stopPropagation(); setVerCita(verCita === p.id ? null : p.id) }}>
          {verCita === p.id ? 'Ocultar' : 'Ver en el libro'}
        </button>
      </div>
    )
  }

  const listaPistas = pistas.length
    ? pistas.map(pista)
    : [<div key="v" className="hilo-vacio">Todavía no tienes pistas. Cuando termines el capítulo 1, llegan solas.</div>]

  const lineaGato = msg ?? (
    !idea ? { texto: 'Toca una idea de la pizarra para abrir su expediente.', tono: '' }
    : idea.estado === 'armada' ? { texto: 'Esta ya está armada. Toca otra idea de la pizarra.', tono: '' }
    : { texto: 'Toca pistas para sumarlas al expediente. Tócalas otra vez para sacarlas.', tono: '' })

  const armadas = ideas.filter(i => i.estado === 'armada').length

  if (movil) {
    const abierta = idea && jugable(idea)
    return (
      <div className="hilo-root is-movil">
        <div className="hilo-m-saldo">{saldo}</div>
        <div className="hilo-m-board">
          <div className="hilo-m-scroll" ref={scrollRef}>{pizarra}</div>
          {msg && <div className={`hilo-m-msg${msg.tono ? ' is-' + msg.tono : ''}`} role="status">{msg.texto}</div>}
        </div>
        <div className="hilo-m-seg" role="tablist">
          <button type="button" role="tab" aria-selected={panel === 'pistas'} onClick={() => setPanel('pistas')}>Pistas</button>
          <button type="button" role="tab" aria-selected={panel === 'exp'} onClick={() => setPanel('exp')}>Expediente</button>
        </div>
        <div className="hilo-m-panel">
          {panel === 'exp' ? <div className="hilo-m-expwrap">{expediente()}</div> : (<>
            <div className="hilo-m-jug">
              {abierta
                ? <><span className="hilo-m-para">Para: <b>{idea.titulo}</b></span>{jugarBtn(idea)}</>
                : <span className="hilo-m-para">Toca una idea tapada del pizarrón para llenarla.</span>}
            </div>
            <div className="hilo-m-lista">{listaPistas}</div>
          </>)}
        </div>
      </div>
    )
  }

  return (
    <div className="hilo-root is-pc">
      <section className="hilo-pane hilo-p-piz">
        <div className="hilo-pane-h"><h2>Pizarra</h2><small>{armadas} de {ideas.length} ideas armadas</small>{saldo}</div>
        <div className="hilo-marco" ref={marcoRef}>{pizarra}</div>
      </section>
      <section className="hilo-pane hilo-p-exp">
        <div className="hilo-exp-body">{expediente()}</div>
        <div className="hilo-gato">
          <img src={gatoSrc(gatoColor)} alt="" />
          <div className={`hilo-bub${lineaGato.tono ? ' is-' + lineaGato.tono : ''}`} role="status">{lineaGato.texto}</div>
        </div>
      </section>
      <section className="hilo-pane hilo-p-pis">
        <div className="hilo-pane-h">
          <h2>Tus pistas <small>{pistas.length}</small></h2>
          <small>{idea && jugable(idea) ? `Toca para sumar a «${idea.titulo}»` : 'Elige una idea en la pizarra'}</small>
        </div>
        <div className="hilo-pis-body">{listaPistas}</div>
      </section>
    </div>
  )
}
