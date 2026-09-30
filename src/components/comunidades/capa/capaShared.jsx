// Piezas de la capa de comunidad en el lector, compartidas por escritorio
// (CapaEscritorio.jsx) y móvil (CapaMovil.jsx).
//
// La capa va SUPERPUESTA a la hoja: nunca entra en el flujo del texto, así
// que no toca la paginación. <CapaHoja> se monta dentro de cada hoja, mide
// dónde quedó cada párrafo y pinta encima:
//   · las caritas en el margen (párrafo impar a la izquierda, par a la
//     derecha, para que dos diálogos cortos seguidos no choquen);
//   · el listón diagonal de los mensajitos de esa página;
//   · en modo "elegir párrafo", una lámina que tapa la hoja entera: así el
//     toque no llega al texto (ni selecciona, ni suena, ni pasa página).
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'
import { useComunidadDelLibro, useCapaComunidad, haceCuanto } from '../../../hooks/useCapaComunidad.js'

const AVISO_KEY = (libroId) => `inm_capa_aviso_${libroId}`

// ── Núcleo: comunidad, datos y estado on/off ────────────────
export function useCapaNucleo({ userId, libroId, capituloId, deshabilitada }) {
  const { comunidad, elegidaPorTi, listo } = useComunidadDelLibro(userId, libroId, !deshabilitada)
  const datos = useCapaComunidad({ userId, comunidadId: comunidad?.id, libroId, capituloId })
  const [on, setOnRaw] = useState(false)
  const [aviso, setAviso] = useState(false)

  // Al resolver la comunidad: encendida si es la de la Biblioteca; si la
  // elegimos nosotros, apagada y con un aviso la primera vez en este libro.
  useEffect(() => {
    if (!comunidad) { setOnRaw(false); setAviso(false); return }
    setOnRaw(!elegidaPorTi)
    let visto = true
    try { visto = !!localStorage.getItem(AVISO_KEY(libroId)) } catch { /* sin storage: no molestar */ }
    setAviso(!!elegidaPorTi && !visto)
  }, [comunidad?.id, elegidaPorTi, libroId]) // eslint-disable-line react-hooks/exhaustive-deps

  const cerrarAviso = useCallback(() => {
    setAviso(false)
    try { localStorage.setItem(AVISO_KEY(libroId), '1') } catch { /* nada */ }
  }, [libroId])

  const setOn = useCallback((v) => {
    setOnRaw(v)
    if (v) cerrarAviso()
  }, [cerrarAviso])

  const punto = useMemo(
    () => datos.mensajitos.some(m => m.sinLeer && m.capituloId === capituloId),
    [datos.mensajitos, capituloId])

  return { activa: listo && !!comunidad, comunidad, elegidaPorTi, on, setOn, aviso, cerrarAviso, punto, userId, ...datos }
}

// ── Páginas ─────────────────────────────────────────────────
// Ids de los párrafos que EMPIEZAN en la página idx. Un párrafo largo se
// parte entre páginas con el mismo id: el primer trozo de una página es
// continuación si la anterior terminaba con ese mismo párrafo.
export function iniciosDePagina(paginas, idx) {
  const pag = paginas[idx] || []
  const previo = paginas[idx - 1]?.at(-1)?.id
  const ids = new Set()
  pag.forEach((f, i) => {
    if (f.tipo === 'separador' || !f.id) return
    if (i === 0 && f.id === previo) return
    ids.add(f.id)
  })
  return ids
}

// Dónde se ancla un mensajito escrito en esta página: el primer párrafo que
// empieza en ella; si la página es solo la continuación de uno largo, ese.
export function anclaDePagina(paginas, idx) {
  const inicios = iniciosDePagina(paginas, idx)
  const pag = paginas[idx] || []
  return pag.find(f => inicios.has(f.id))?.id || pag.find(f => f.id && f.tipo !== 'separador')?.id || null
}

export function mensajitosDePagina(mensajitos, inicios) {
  return mensajitos
    .filter(m => inicios.has(m.parrafoId))
    .sort((a, b) => (b.sinLeer - a.sinLeer) || (b.createdAt > a.createdAt ? 1 : -1))
}

// ── Caritas ─────────────────────────────────────────────────
export function Carita({ persona, className = '' }) {
  return (
    <span className={'cl-av ' + className} style={{ background: persona?.color }} aria-hidden="true">
      {persona?.inicial || '?'}
    </span>
  )
}

function Caritas({ lista, lado, top, margen, activa, onClick }) {
  const quienes = []
  for (const c of lista) if (!quienes.some(p => p.id === c.autor.id)) quienes.push(c.autor)
  const nombres = quienes.map(p => p.corto).join(', ')
  return (
    <button type="button" className={`cl-caritas ${lado}${activa ? ' activa' : ''}`}
      style={{ top, [lado === 'izq' ? 'left' : 'right']: margen }}
      aria-label={`${lista.length} comentario${lista.length > 1 ? 's' : ''} de ${nombres}`}
      title={nombres}
      onClick={(e) => { e.stopPropagation(); onClick(e.currentTarget) }}>
      {quienes.slice(0, 2).map(p => <Carita key={p.id} persona={p} />)}
    </button>
  )
}

// ── Listón diagonal ─────────────────────────────────────────
const Mono = () => (
  <svg className="cl-mono" width="17" height="10" viewBox="0 0 34 19" aria-hidden="true">
    <path d="M17 11 C11 11 5 14 3 17 C7 18.5 13 15 17 11Z" fill="rgba(255,255,255,.85)"/>
    <path d="M17 11 C23 11 29 14 31 17 C27 18.5 21 15 17 11Z" fill="rgba(255,255,255,.85)"/>
    <ellipse cx="10" cy="7" rx="7.4" ry="5.2" transform="rotate(-24 10 7)" fill="#fff"/>
    <ellipse cx="24" cy="7" rx="7.4" ry="5.2" transform="rotate(24 24 7)" fill="#fff"/>
    <circle cx="17" cy="9" r="3.6" fill="rgba(255,255,255,.85)"/>
  </svg>
)

function Liston({ lista, lado, onClick }) {
  const ref = lista[0]
  return (
    <button type="button" className={`cl-liston ${lado}${ref.sinLeer ? ' sin-leer' : ''}`}
      style={{ '--rc': ref.otra.color }}
      aria-label={lista.length === 1 ? 'Un mensajito' : `${lista.length} mensajitos`}
      onClick={(e) => { e.stopPropagation(); onClick(e.currentTarget) }}>
      <span className="cl-banda"><Mono />{lista.length}</span>
    </button>
  )
}

// ── La capa de una hoja ─────────────────────────────────────
/**
 * @param {object[]} fragmentos   párrafos (o trozos) de esta página
 * @param {Set}      inicios      ids que empiezan en esta página
 * @param {string}   ladoListon   'izq' | 'der': esquina de afuera de la hoja
 * @param {number}   margen       px desde el canto de la hoja a las caritas
 * @param {*}        medida       cambia cuando hay que volver a medir (tamaño de letra, fuente…)
 */
export function CapaHoja({ nucleo, fragmentos, inicios, ladoListon = 'der', margen = 12, medida,
  seleccionando, onElegir, onAbrirHilo, onAbrirMensajitos, hiloActivo, noche }) {
  const rootRef = useRef(null)
  const [tops, setTops] = useState({})
  const [hover, setHover] = useState(null)
  const { comentariosPorParrafo, mensajitos, on } = nucleo

  // `inicios` llega como un Set nuevo en cada render: se memoiza por su
  // contenido, o medir() cambiaría siempre y el layout effect no pararía.
  const clave = [...inicios].join(',') + '|' + fragmentos.map(f => f.id).join(',')
  const conComentarios = useMemo(
    () => fragmentos.filter(f => inicios.has(f.id) && comentariosPorParrafo[f.id]?.length),
    [clave, comentariosPorParrafo]) // eslint-disable-line react-hooks/exhaustive-deps

  const medir = useCallback(() => {
    const hoja = rootRef.current?.parentElement
    if (!hoja) return
    const base = hoja.getBoundingClientRect().top
    const t = {}
    for (const f of conComentarios) {
      const el = hoja.querySelector(`[data-parrafo-id="${f.id}"]`)
      if (el) t[f.id] = Math.round(el.getBoundingClientRect().top - base)
    }
    setTops(prev => {
      const k = Object.keys(t)
      return k.length === Object.keys(prev).length && k.every(id => prev[id] === t[id]) ? prev : t
    })
  }, [conComentarios])

  useLayoutEffect(() => { medir() }, [medir, medida])
  useEffect(() => {
    const hoja = rootRef.current?.parentElement
    if (!hoja || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => medir())
    ro.observe(hoja)
    document.fonts?.ready?.then(() => medir())
    return () => ro.disconnect()
  }, [medir])

  // Modo elegir: qué párrafo hay bajo el puntero
  const parrafoEn = (x, y) => {
    const hoja = rootRef.current?.parentElement
    const el = document.elementsFromPoint(x, y).find(n => n.dataset?.parrafoId && hoja?.contains(n))
    if (!el) return null
    const r = el.getBoundingClientRect(), b = hoja.getBoundingClientRect()
    return { el, id: el.dataset.parrafoId, caja: { top: r.top - b.top - 3, left: r.left - b.left - 5, width: r.width + 10, height: r.height + 6 } }
  }

  const deEstaPagina = on ? mensajitosDePagina(mensajitos, inicios) : []

  return (
    <div ref={rootRef} className={'cl-capa' + (on ? '' : ' apagada') + (noche ? ' noche' : '')}>
      {on && conComentarios.map(f => {
        const lista = comentariosPorParrafo[f.id]
        const lado = (f.numero ?? 0) % 2 === 1 ? 'izq' : 'der'
        return tops[f.id] == null ? null : (
          <Caritas key={f.id} lista={lista} lado={lado} top={tops[f.id] + 3} margen={margen}
            activa={hiloActivo === f.id} onClick={(el) => onAbrirHilo(f.id, el)} />
        )
      })}
      {deEstaPagina.length > 0 && (
        <Liston lista={deEstaPagina} lado={ladoListon} onClick={(el) => onAbrirMensajitos(deEstaPagina, el)} />
      )}
      {seleccionando && (
        <div className="cl-lamina"
          onMouseMove={(e) => setHover(parrafoEn(e.clientX, e.clientY))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            e.stopPropagation()
            const p = parrafoEn(e.clientX, e.clientY)
            if (p) onElegir(p.id, p.el.textContent.trim(), p.el)
          }}>
          {hover && <span className="cl-realce" style={hover.caja} />}
        </div>
      )}
    </div>
  )
}

// ── ⋯ Borrar / Denunciar ────────────────────────────────────
export function Acciones({ puedeBorrar, puedeDenunciar, que, onBorrar, onDenunciar }) {
  const [paso, setPaso] = useState(null)   // null | 'menu' | 'borrar' | 'denunciar' | 'hecho' | 'error'
  const [msg, setMsg] = useState('')
  if (!puedeBorrar && !puedeDenunciar) return null

  const correr = async (fn, okMsg) => {
    try { await fn(); if (okMsg) { setMsg(okMsg); setPaso('hecho') } }
    catch (err) { setMsg(err.message); setPaso('error') }
  }

  return (
    <>
      <button type="button" className="cl-mas" aria-label="Más opciones" aria-expanded={paso === 'menu'}
        onClick={(e) => { e.stopPropagation(); setPaso(p => (p ? null : 'menu')) }}>⋯</button>
      {paso && (
        <div className="cl-acc" onClick={(e) => e.stopPropagation()}>
          {paso === 'menu' && (
            <>
              {puedeBorrar && <button type="button" className="cl-opt rojo" onClick={() => setPaso('borrar')}>Borrar {que}</button>}
              {puedeDenunciar && <button type="button" className="cl-opt" onClick={() => setPaso('denunciar')}>Denunciar {que}</button>}
            </>
          )}
          {paso === 'borrar' && (
            <>¿Seguro? No se puede deshacer.
              <div className="cl-fila">
                <button type="button" className="cl-btn" onClick={() => setPaso(null)}>Cancelar</button>
                <button type="button" className="cl-btn peligro" onClick={() => correr(onBorrar)}>Borrar</button>
              </div>
            </>
          )}
          {paso === 'denunciar' && (
            <>Lo revisa el equipo de Inmersia. Quien lo escribió no sabrá que fuiste tú.
              <div className="cl-fila">
                <button type="button" className="cl-btn" onClick={() => setPaso(null)}>Cancelar</button>
                <button type="button" className="cl-btn peligro" onClick={() => correr(onDenunciar, 'Gracias. Lo vamos a revisar.')}>Denunciar</button>
              </div>
            </>
          )}
          {paso === 'hecho' && <span className="cl-ok">{msg}</span>}
          {paso === 'error' && <span className="cl-err">{msg}</span>}
        </div>
      )}
    </>
  )
}

// ── Contenido de un hilo (comentarios de un párrafo) ────────
export function Hilo({ nucleo, parrafoId, pos, setPos, onVacio, cabeceraExtra }) {
  const lista = nucleo.comentariosPorParrafo[parrafoId] || []
  pos = Math.max(0, Math.min(pos, lista.length - 1))
  const c = lista[pos]
  useEffect(() => { if (!lista.length) onVacio?.() }, [lista.length]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null
  const mio = c.autor.id === nucleo.userId
  return (
    <div className="cl-hilo">
      <div className="cl-head">
        <Carita persona={c.autor} className="m" />
        <div className="cl-quien"><b>{mio ? 'Tú' : c.autor.nombre}</b><span>{haceCuanto(c.createdAt)}</span></div>
        <div className="cl-tools">
          <Acciones key={c.id} que={mio ? 'mi comentario' : 'este comentario'}
            puedeBorrar={mio || nucleo.soyModerador} puedeDenunciar={!mio}
            onBorrar={() => nucleo.borrarComentario(c.id)}
            onDenunciar={() => nucleo.denunciar('comentario_lectura', c.id)} />
          {cabeceraExtra}
        </div>
      </div>
      <p className="cl-cuerpo">{c.contenido}</p>
      {lista.length > 1 && (
        <div className="cl-nav">
          <button type="button" className="cl-flecha" disabled={pos === 0} aria-label="Anterior" onClick={(e) => { e.stopPropagation(); setPos(pos - 1) }}>‹</button>
          <span className="cl-puntos">{lista.map((x, i) => <i key={x.id} className={i === pos ? 'on' : ''} />)}</span>
          <button type="button" className="cl-flecha" disabled={pos >= lista.length - 1} aria-label="Siguiente" onClick={(e) => { e.stopPropagation(); setPos(pos + 1) }}>›</button>
          <span className="cl-cnt">{pos + 1}/{lista.length}</span>
        </div>
      )}
      {/* Pendiente de decidir si se usa: los comentarios no se responden y
          el enlace llevaría al foro de la comunidad (foros_comentarios.comunidad_id).
          Antes hay que filtrar el foro general con .is('comunidad_id', null)
          en ForoComentarios.jsx.
      <div className="cl-foro">Los comentarios no se responden.
        <button type="button">Discútelo en el foro de la comunidad →</button></div> */}
    </div>
  )
}

// ── Contenido de un mensajito abierto ───────────────────────
export function Nota({ nucleo, m, cabeceraExtra }) {
  return (
    <div className="cl-hilo">
      <div className="cl-head">
        <Carita persona={m.otra} className="m" />
        <div className="cl-quien">
          <b>{m.mio ? `Para ${m.otra.corto}` : m.otra.nombre}</b>
          <span>{m.mio ? 'lo dejaste' : 'te lo dejó'} {haceCuanto(m.createdAt)}</span>
        </div>
        <div className="cl-tools">
          {!m.mio && (
            <Acciones key={m.id} que="este mensajito" puedeBorrar puedeDenunciar
              onBorrar={() => nucleo.borrarMensajito(m.id)}
              onDenunciar={() => nucleo.denunciar('mensajito', m.id)} />
          )}
          {cabeceraExtra}
        </div>
      </div>
      <p className="cl-cuerpo">{m.contenido}</p>
      {m.efimero && <span className="cl-efimero">✦ {m.mio ? 'Se borra cuando lo lea' : 'Se borra al cerrarlo'}</span>}
    </div>
  )
}

// ── Formularios ─────────────────────────────────────────────
export function FormComentario({ nucleo, parrafoId, cita, movil, onListo, onCancelar }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [err, setErr] = useState('')
  const guardar = async () => {
    if (!texto.trim() || enviando) return
    setEnviando(true); setErr('')
    try { await nucleo.comentar(parrafoId, texto); onListo() }
    catch (e) { setErr(e.message); setEnviando(false) }
  }
  return (
    <div className="cl-form">
      {!movil && <h4>Tu comentario</h4>}
      <div className="cl-cita">“{cita.length > 110 ? cita.slice(0, 110) + '…' : cita}”</div>
      <textarea id="cl-comentario" className="cl-ta" autoFocus maxLength={500} value={texto}
        placeholder="Escribe lo que quieres decir…"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (!movil && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); guardar() }
          if (e.key === 'Escape') onCancelar()
        }} />
      {err && <span className="cl-err">{err}</span>}
      <div className="cl-pie">
        {movil
          ? <button type="button" className="cl-btn grande" onClick={onCancelar}>Cancelar</button>
          : <span className="cl-tip"><b>Enter</b> guarda · <b>Esc</b> cancela</span>}
        <button type="button" className={'cl-btn primario' + (movil ? ' grande' : '')} disabled={!texto.trim() || enviando} onClick={guardar}>
          {enviando ? 'Guardando…' : movil ? 'Publicar' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

export function FormMensajito({ nucleo, parrafoId, movil, onListo, onCancelar }) {
  const [texto, setTexto] = useState('')
  const [para, setPara] = useState(null)
  const [efimero, setEfimero] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [err, setErr] = useState('')
  const listo = texto.trim() && para && parrafoId && !enviando
  const enviar = async () => {
    if (!listo) return
    setEnviando(true); setErr('')
    try { await nucleo.dejarMensajito({ paraId: para, parrafoId, contenido: texto, efimero }); onListo() }
    catch (e) { setErr(e.message); setEnviando(false) }
  }
  const { destinatarios } = nucleo
  return (
    <div className="cl-form">
      {!movil && <h4>Mensajito</h4>}
      {!movil && <div className="cl-cita dorada">Solo lo ve la persona que elijas. Queda en esta página y le aparece cuando llegue aquí.</div>}
      <textarea id="cl-mensajito" className="cl-ta" autoFocus maxLength={300} value={texto}
        placeholder="Escribe tu mensajito…"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (!movil && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
          if (e.key === 'Escape') onCancelar()
        }} />
      <div className="cl-cap">¿A quién le llega?</div>
      {destinatarios.length
        ? <div className="cl-quienes">
            {destinatarios.map(p => (
              <button key={p.id} type="button" className="cl-pick" aria-pressed={para === p.id} onClick={() => setPara(p.id)}>
                <Carita persona={p} />{p.corto}
              </button>
            ))}
          </div>
        : <span className="cl-vacio">Todavía no hay nadie en la comunidad que pueda recibirlo.</span>}
      <button type="button" className="cl-chk" role="checkbox" aria-checked={efimero} onClick={() => setEfimero(v => !v)}>
        <span className="cl-box" />
        <span>Se borra cuando lo lea<em>Al cerrarlo, desaparece</em></span>
      </button>
      {err && <span className="cl-err">{err}</span>}
      <div className="cl-pie">
        {movil
          ? <button type="button" className="cl-btn grande" onClick={onCancelar}>Cancelar</button>
          : <span className="cl-tip"><b>Enter</b> lo deja</span>}
        <button type="button" className={'cl-btn primario' + (movil ? ' grande' : '')} disabled={!listo} onClick={enviar}>
          {enviando ? 'Dejando…' : 'Dejar el listón'}
        </button>
      </div>
    </div>
  )
}

// Lista de mensajitos de una página (cuando hay más de uno)
export function ListaMensajitos({ lista, onAbrir }) {
  return (
    <div className="cl-lista">
      {lista.map(m => (
        <button key={m.id} type="button" className="cl-fila-m" style={{ borderLeftColor: m.otra.color }} onClick={(e) => { e.stopPropagation(); onAbrir(m) }}>
          <Carita persona={m.otra} />
          <span className="cl-fila-t"><b>{m.mio ? `Para ${m.otra.corto}` : m.otra.corto}</b> · {m.contenido}</span>
          {m.sinLeer && <span className="cl-dot" />}
        </button>
      ))}
    </div>
  )
}

