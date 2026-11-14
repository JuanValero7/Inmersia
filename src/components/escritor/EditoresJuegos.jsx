// Editar los juegos del libro: Corazonadas, Cápsula
// del tiempo, El falsificador, Método Anderson, Hilo de ideas y El mapa del
// tesoro (estos tres con estructura y vista del lector jugable). Migr. 114–117.
//   · El escritor cambia TEXTOS. La estructura (dónde sale cada cosa en el
//     libro, cuál es la opción correcta, lo que usa el panel del profe) no
//     se toca desde aquí: la base la conserva aunque el navegador mande otra.
//   · Se guarda todo junto con «Guardar cambios». «Volver al original»
//     recupera lo que preparamos nosotros.
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJuegoEscritor, useGuardarJuego, useParrafosLibro, useCapitulosLibro, ubicarCitaEscritor, mensajeErrorEscritor } from '../../hooks/useEscritor.js'
import HiloIdeas from '../hilo/HiloIdeas.jsx'
import '../../styles/mesa.css'

export const JUEGOS_EDITABLES = ['corazonadas', 'capsula', 'falsificador', 'anderson', 'hilo', 'mapa']

/**
 * @param {object} props
 * @param {{ id: string }} props.libro
 * @param {string} props.juego
 * @param {string} props.nombre
 * @param {() => void} props.onCerrar
 */
export default function EditorJuego({ libro, juego, nombre, onCerrar }) {
  const { data, isLoading, isError, refetch } = useJuegoEscritor(libro.id, juego)
  const restaurar = useGuardarJuego(libro.id, juego, 'restaurar_juego')
  const [error, setError] = useState('')
  // Solo se vuelve a montar el editor al restaurar (al guardar, se queda con su «✓ Guardado»).
  const [vuelta, setVuelta] = useState(0)
  // Anderson e Hilo: tras guardar, la base pone ids nuevos; se recarga el editor sin perder dónde estaba.
  // ui.vista = 'lector' ensancha la ventana para la mesa / la pizarra.
  const [ui, setUi] = useState({ pj: null, rasgo: null, vista: 'editar' })
  const [recien, setRecien] = useState(false)
  const recargar = async () => { await refetch(); setVuelta(v => v + 1); setRecien(true) }
  const volverOriginal = async () => {
    if (!window.confirm('¿Volver al juego tal como lo preparamos? Se pierden tus cambios.')) return
    setError('')
    try { await restaurar.mutateAsync({ p_juego: juego }); await refetch(); setVuelta(v => v + 1) } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos restaurarlo.')) }
  }

  return (
    <div className="esc-visor" role="dialog" aria-modal="true" aria-label={`Editar ${nombre}`}>
      <div className={'esc-visor-caja esc-editor-juego' + (ui.vista === 'lector' && juego !== 'mapa' ? ' is-ancho' : '')}>
        <div className="esc-visor-cab">
          <h3>{nombre}</h3><span>Cambia los textos; tus lectores verán la versión guardada.</span>
          <span className="esc-hueco" />
          {data?.editado && <button type="button" className="esc-borrar" disabled={restaurar.isPending} onClick={volverOriginal}>Volver al original</button>}
          <button type="button" className="esc-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="esc-editor-juego-cuerpo">
          {isLoading && <p className="esc-gris">Cargando…</p>}
          {isError && <p className="esc-falta">No pudimos abrir el juego.</p>}
          {error && <p className="esc-falta">{error}</p>}
          {data?.datos && juego === 'corazonadas' && <EditorCorazonadas key={vuelta} libro={libro} datos={data.datos} />}
          {data?.datos && juego === 'capsula' && <EditorCapsula key={vuelta} libro={libro} datos={data.datos} />}
          {data?.datos && juego === 'falsificador' && <EditorFalsificador key={vuelta} libro={libro} datos={data.datos} />}
          {data?.datos && juego === 'anderson' && (
            <EditorAnderson key={vuelta} libro={libro} datos={data.datos} ui={ui}
              setUi={(x) => { setUi(x); setRecien(false) }} recienGuardado={recien}
              onGuardado={() => { setUi(u => ({ ...u, rasgo: /^[xy]/.test(u.rasgo || '') ? null : u.rasgo })); recargar() }} />
          )}
          {data?.datos && juego === 'hilo' && (
            <EditorHilo key={vuelta} libro={libro} datos={data.datos} ui={ui}
              setUi={(x) => { setUi(x); setRecien(false) }} recienGuardado={recien}
              onGuardado={() => { setUi(u => ({ ...u, rasgo: /^[xy]/.test(u.rasgo || '') ? null : u.rasgo })); recargar() }} />
          )}
          {data?.datos && juego === 'mapa' && (
            <EditorMapa key={vuelta} libro={libro} datos={data.datos} ui={ui}
              setUi={(x) => { setUi(x); setRecien(false) }} recienGuardado={recien}
              onGuardado={() => { setUi(u => ({ ...u, rasgo: /^z/.test(u.rasgo || '') ? null : u.rasgo })); recargar() }} />
          )}
        </div>
      </div>
    </div>
  )
}

function useGuardar(libro, juego, rpc) {
  const guardar = useGuardarJuego(libro.id, juego, rpc)
  const [estado, setEstado] = useState({ error: '', ok: false })
  const enviar = async ({ onOk, ...params }) => {
    setEstado({ error: '', ok: false })
    try { await guardar.mutateAsync(params); onOk?.(); setEstado({ error: '', ok: true }) } catch (e) {
      setEstado({ error: mensajeErrorEscritor(e, 'No pudimos guardarlo. Inténtalo de nuevo.'), ok: false })
    }
  }
  return { enviar, guardando: guardar.isPending, ...estado }
}

// Abre el libro en ese capítulo y párrafo; atrás vuelve a la Sala de juegos.
// Extra del falsificador: falso (id del inventado) y sospechoso (vista previa del juego).
function useVerEnLibro(libro, cambiado) {
  const navigate = useNavigate()
  return (donde) => {
    if (!donde?.cap || !libro.slug) return
    if (cambiado && !window.confirm('Tienes cambios sin guardar. ¿Ir al libro igualmente?')) return
    navigate('/escritor', { replace: true, state: { sala: 'juegos', libroId: libro.id } })
    const { cap, parrafo, ...extra } = donde
    navigate(`/libro/${libro.slug}`, { state: { irA: { cap, parrafo: parrafo || 1, ...extra } } })
  }
}

function PieGuardar({ cambiado, guardando, error, ok, onGuardar }) {
  return (
    <div className="esc-pie-tab esc-pie-editor">
      <span className={error ? 'esc-falta' : 'esc-gris'}>{error || (ok && !cambiado ? '✓ Guardado. Tus lectores ya ven esta versión.' : cambiado ? 'Tienes cambios sin guardar.' : '')}</span>
      <button type="button" className="esc-pill esc-naranja" disabled={!cambiado || guardando} onClick={onGuardar}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}</button>
    </div>
  )
}

// ── Corazonadas ───────────────────────────────────────────────

const aEditable = (c) => ({
  id: c.id, pregunta: c.pregunta || '', contexto: c.contexto || '', resultado: c.resultado || '',
  clase: c.clase === 'sorpresa' ? 'sorpresa' : 'deducible', opciones: [...(c.opciones || [])], pistas: [...(c.pistas || [])],
  correcta: c.correcta, chip: c.chip, rev: c.rev,
})

function EditorCorazonadas({ libro, datos }) {
  const [original, setOriginal] = useState(() => (datos.corazonadas || []).map(aEditable))
  const [items, setItems] = useState(original)
  const [sel, setSel] = useState(0)
  const { enviar, guardando, error, ok } = useGuardar(libro, 'corazonadas', 'editar_corazonadas')
  const cambiado = JSON.stringify(items) !== JSON.stringify(original)
  const cz = items[Math.min(sel, items.length - 1)]
  const verEnLibro = useVerEnLibro(libro, cambiado)
  useEffect(() => { if (sel > items.length - 1) setSel(Math.max(0, items.length - 1)) }, [items.length, sel])

  const cambiar = (campo, valor) => setItems(xs => xs.map((x, k) => (k === sel ? { ...x, [campo]: valor } : x)))
  const quitar = () => {
    if (items.length <= 1) return
    if (window.confirm('¿Quitar esta corazonada del libro?')) setItems(xs => xs.filter((_, k) => k !== sel))
  }
  const guardar = () => enviar({
    onOk: () => setOriginal(items),
    p_items: items.map(({ id, pregunta, contexto, resultado, clase, opciones, pistas }) => ({
      id, pregunta, contexto, resultado, clase, opciones, pistas: pistas.filter(p => p.trim()),
    })),
  })

  return (
    <>
      <div className="esc-cuaderno">
        <div className="esc-indice">
          {items.map((x, k) => (
            <button key={x.id} type="button" className={'esc-it' + (k === sel ? ' on' : '')} onClick={() => setSel(k)}>
              <b>{x.pregunta || 'Sin pregunta'}</b><small>Cap. {x.chip?.cap ?? '?'} → se resuelve en el {x.rev?.cap ?? '?'}</small>
            </button>
          ))}
        </div>
        {cz && (
          <div className="esc-ficha-ed">
            <div className="esc-donde-juego">
              <span>El aviso sale en el <b>capítulo {cz.chip?.cap}</b> y el libro lo resuelve en el <b>capítulo {cz.rev?.cap}</b>.</span>
              <button type="button" className="esc-pill esc-chica" onClick={() => verEnLibro({ cap: cz.chip?.cap, parrafo: cz.chip?.parrafo })}>Ver dónde aparece ↗</button>
              <button type="button" className="esc-pill esc-chica" onClick={() => verEnLibro({ cap: cz.rev?.cap, parrafo: cz.rev?.parrafo })}>Ver dónde se resuelve ↗</button>
            </div>
            {cambiado && <small className="esc-gris">Guarda antes de ir al libro: ahí verás la versión guardada.</small>}
            <label className="esc-campo-an">Pregunta<input value={cz.pregunta} maxLength={200} onChange={(e) => cambiar('pregunta', e.target.value)} /></label>
            <label className="esc-campo-an">Contexto <small>(lo que el lector recuerda antes de apostar)</small>
              <textarea rows={2} maxLength={600} value={cz.contexto} onChange={(e) => cambiar('contexto', e.target.value)} /></label>
            <div className="esc-campo-an">Opciones
              {cz.opciones.map((o, k) => (
                <div key={k} className="esc-opcion">
                  <input value={o} maxLength={160} onChange={(e) => cambiar('opciones', cz.opciones.map((x, j) => (j === k ? e.target.value : x)))} />
                  {k === cz.correcta ? <span className="esc-correcta">✓ la que pasa</span> : <span className="esc-gris">falsa</span>}
                </div>
              ))}
              <small>Si cambias el sentido de la correcta, que siga siendo lo que de verdad pasa en el libro.</small>
            </div>
            <label className="esc-campo-an">Tipo
              <select value={cz.clase} onChange={(e) => cambiar('clase', e.target.value)}>
                <option value="deducible">Se puede adivinar (un lector atento llega a la respuesta)</option>
                <option value="sorpresa">Sorpresa (el libro gira y no se podía ver venir)</option>
              </select>
            </label>
            <div className="esc-campo-an">Pistas que ya dio el libro <small>(se le muestran al lector después)</small>
              {cz.pistas.map((p, k) => (
                <div key={k} className="esc-opcion">
                  <input value={p} maxLength={300} onChange={(e) => cambiar('pistas', cz.pistas.map((x, j) => (j === k ? e.target.value : x)))} />
                  <button type="button" className="esc-borrar" onClick={() => cambiar('pistas', cz.pistas.filter((_, j) => j !== k))}>Quitar</button>
                </div>
              ))}
              {cz.pistas.length < 8 && <button type="button" className="esc-nuevo-it" onClick={() => cambiar('pistas', [...cz.pistas, ''])}>＋ Agregar pista</button>}
            </div>
            <label className="esc-campo-an">Lo que pasa <small>(se muestra al resolverse)</small>
              <textarea rows={2} maxLength={600} value={cz.resultado} onChange={(e) => cambiar('resultado', e.target.value)} /></label>
            <div className="esc-fila-botones">
              <button type="button" className="esc-borrar" disabled={items.length <= 1} onClick={quitar}>Quitar esta corazonada</button>
            </div>
          </div>
        )}
      </div>
      <PieGuardar cambiado={cambiado} guardando={guardando} error={error} ok={ok} onGuardar={guardar} />
    </>
  )
}

// ── Cápsula del tiempo ────────────────────────────────────────

function EditorCapsula({ libro, datos }) {
  const [original, setOriginal] = useState(() => (datos.preguntas || []).map(p => ({ id: p.id, texto: p.texto || '' })))
  const [preguntas, setPreguntas] = useState(original)
  const { enviar, guardando, error, ok } = useGuardar(libro, 'capsula', 'editar_capsula')
  const cambiado = JSON.stringify(preguntas) !== JSON.stringify(original)
  const cambiar = (k, texto) => setPreguntas(ps => ps.map((p, j) => (j === k ? { ...p, texto } : p)))
  const mover = (k, d) => setPreguntas(ps => {
    const xs = [...ps]; const [x] = xs.splice(k, 1); xs.splice(k + d, 0, x); return xs
  })

  return (
    <>
      <p className="esc-letra">El lector responde estas preguntas de opinión al empezar el libro y otra vez al terminarlo, y ve si cambió de opinión. Funcionan mejor si se pueden contestar sin haber leído nada.</p>
      <div className="esc-tiempo">
        {preguntas.map((p, k) => (
          <div key={p.id || `nueva-${k}`} className="esc-t-cap">
            <i>{k + 1}</i>
            <div>
              <input className="esc-input-juego" value={p.texto} maxLength={200} placeholder="¿Qué crees que…?" onChange={(e) => cambiar(k, e.target.value)} />
              <div className="esc-fila-botones">
                {!p.id && <span className="esc-t-nota">Nueva</span>}
                <span className="esc-hueco" />
                <button type="button" className="esc-borrar" disabled={k === 0} onClick={() => mover(k, -1)}>Subir</button>
                <button type="button" className="esc-borrar" disabled={k === preguntas.length - 1} onClick={() => mover(k, 1)}>Bajar</button>
                <button type="button" className="esc-borrar" disabled={preguntas.length <= 1} onClick={() => setPreguntas(ps => ps.filter((_, j) => j !== k))}>Quitar</button>
              </div>
            </div>
          </div>
        ))}
        {preguntas.length < 8 && <button type="button" className="esc-nuevo-it" onClick={() => setPreguntas(ps => [...ps, { id: null, texto: '' }])}>＋ Agregar pregunta</button>}
      </div>
      <PieGuardar cambiado={cambiado} guardando={guardando} error={error} ok={ok}
        onGuardar={() => enviar({ onOk: () => setOriginal(preguntas), p_preguntas: preguntas.map(p => ({ id: p.id, texto: p.texto })) })} />
    </>
  )
}

// ── El falsificador ───────────────────────────────────────────
// Falso: el párrafo inventado, «lo raro» y lo que dice el libro de verdad.
// Real: es del libro (no se toca), solo lo que se explica al responder.

const aSospechoso = (x) => ({
  id: x.id, cap: x.cap, parrafo: x.parrafo, falso: !!x.falso,
  texto: x.texto || '', raro: x.raro || '', verdad: x.verdad || '',
})

function EditorFalsificador({ libro, datos }) {
  const [original, setOriginal] = useState(() => ({ autor: datos.autor || '', items: (datos.items || []).map(aSospechoso) }))
  const [autor, setAutor] = useState(original.autor)
  const [items, setItems] = useState(original.items)
  const [sel, setSel] = useState(0)
  const { enviar, guardando, error, ok } = useGuardar(libro, 'falsificador', 'editar_falsificador')
  const cambiado = autor !== original.autor || JSON.stringify(items) !== JSON.stringify(original.items)
  const verEnLibro = useVerEnLibro(libro, cambiado)
  const parrafos = useParrafosLibro(libro.id, original.items.map(x => ({ cap: x.cap, parrafo: x.parrafo }))).data || {}
  useEffect(() => { if (sel > items.length - 1) setSel(Math.max(0, items.length - 1)) }, [items.length, sel])

  const sx = items[Math.min(sel, items.length - 1)]
  const nFalsos = items.filter(x => x.falso).length
  const nReales = items.length - nFalsos
  const sePuedeQuitar = !!sx && (sx.falso ? nFalsos : nReales) > 1
  const cambiar = (campo, valor) => setItems(xs => xs.map((x, k) => (k === sel ? { ...x, [campo]: valor } : x)))
  const quitar = () => {
    if (sePuedeQuitar && window.confirm('¿Quitar este párrafo del juego?')) setItems(xs => xs.filter((_, k) => k !== sel))
  }
  const guardar = () => enviar({
    onOk: () => setOriginal({ autor, items }),
    p_autor: autor,
    p_items: items.map(({ id, falso, texto, raro, verdad }) => (falso ? { id, texto, raro, verdad } : { id, verdad })),
  })
  const delLibro = sx ? parrafos[`${sx.cap}:${sx.parrafo}`] : null

  return (
    <>
      <p className="esc-letra">Hay párrafos sospechosos en tu libro: unos los inventó el gato imitando tu voz y otros son tuyos. El lector adivina cuáles son cuáles. Los inventados dicen algo que el libro no dice; un lector atento tiene que poder pillarlos.</p>
      <label className="esc-campo-an">Cómo firmas <small>(el lector elige entre «Lo escribió {autor.trim() || '…'}» y «Lo coló el gato»)</small>
        <input value={autor} maxLength={60} onChange={(e) => setAutor(e.target.value)} /></label>
      <div className="esc-cuaderno">
        <div className="esc-indice">
          {items.map((x, k) => (
            <button key={x.id} type="button" className={'esc-it' + (k === sel ? ' on' : '')} onClick={() => setSel(k)}>
              <b>{x.falso ? '🐾 Inventado' : '📖 Tuyo'}</b><small>Cap. {x.cap}</small>
            </button>
          ))}
        </div>
        {sx && (
          <div className="esc-ficha-ed">
            <div className="esc-donde-juego">
              <span>{sx.falso
                ? <>Párrafo <b>inventado</b>: va en el <b>capítulo {sx.cap}</b>, justo después de este párrafo tuyo:</>
                : <>Párrafo <b>tuyo</b> del <b>capítulo {sx.cap}</b>. Es el texto del libro y aquí no se cambia:</>}</span>
              <button type="button" className="esc-pill esc-chica"
                onClick={() => verEnLibro({ cap: sx.cap, parrafo: sx.parrafo, sospechoso: sx.id, ...(sx.falso ? { falso: sx.id } : {}) })}>Ver en tu libro ↗</button>
            </div>
            <blockquote className="esc-cita-libro">{delLibro ?? '…'}</blockquote>
            {cambiado && <small className="esc-gris">Guarda antes de ir al libro: ahí verás la versión guardada.</small>}
            {sx.falso && (
              <>
                <label className="esc-campo-an">El párrafo inventado <small>(que suene a ti y tenga el largo de tus párrafos de alrededor: el largo delata)</small>
                  <textarea rows={7} maxLength={1500} value={sx.texto} onChange={(e) => cambiar('texto', e.target.value)} /></label>
                <label className="esc-campo-an">Lo raro <small>(qué lo delata, en una frase; se muestra al responder)</small>
                  <textarea rows={2} maxLength={300} value={sx.raro} onChange={(e) => cambiar('raro', e.target.value)} /></label>
              </>
            )}
            <label className="esc-campo-an">{sx.falso ? 'Lo que dice el libro de verdad' : 'Lo que dices ahí'} <small>(se muestra al responder; 1 o 2 frases en llano)</small>
              <textarea rows={2} maxLength={400} value={sx.verdad} onChange={(e) => cambiar('verdad', e.target.value)} /></label>
            <div className="esc-fila-botones">
              <button type="button" className="esc-borrar" disabled={!sePuedeQuitar} onClick={quitar}
                title={sePuedeQuitar ? undefined : 'Tiene que quedar al menos uno inventado y uno tuyo'}>Quitar este párrafo</button>
            </div>
          </div>
        )}
      </div>
      <PieGuardar cambiado={cambiado} guardando={guardando} error={error} ok={ok} onGuardar={guardar} />
    </>
  )
}

// ── Pistas (Anderson e Hilo) ──────────────────────────────────
// Los dos juegos son pistas que llegan con los capítulos y se combinan. La
// cita es el texto del libro (no se cambia); el escritor cambia cómo se
// cuenta la pista.

function TarjetaPista({ pista, etiqueta, campo, largo, onCambiar, verEnLibro, children }) {
  return (
    <div className="esc-pista-ed">
      <div className="esc-donde-juego">
        <span><b>Cap. {pista.cap}</b>{etiqueta ? <> · {etiqueta}</> : null}</span>
        {verEnLibro && <button type="button" className="esc-pill esc-chica" onClick={() => verEnLibro({ cap: pista.cap, parrafo: pista.parrafo })}>Ver en tu libro ↗</button>}
      </div>
      <blockquote className="esc-cita-libro">{pista.cita}</blockquote>
      <label className="esc-campo-an">Lo que ve el lector en la pista
        <input value={pista[campo]} maxLength={largo} onChange={(e) => onCambiar(campo, e.target.value)} /></label>
      {children}
    </div>
  )
}

// ── Método Anderson ───────────────────────────────────────────
// Editar: personaje → sus deducciones (solo la conclusión verdadera) → al abrir
// una, las pistas que la arman y sus tres conclusiones.
// Cómo lo ve el lector: la mesa entera para jugarla, con sellos que solo ve él.
// Se pueden quitar y añadir pistas y deducciones; la base hace cumplir las
// reglas (mínimo 3 pistas, dos deducciones no comparten 3, etc.: migr. 116).

const TIPO_FALSA = { por_encima: 'falsa · lectura por encima', otra: 'falsa · otra lectura' }
const MIN_PISTAS = 3
const LETRAS_MESA = ['A', 'B', 'C']

const verdadera = (r) => r.opciones[r.correcta] || ''

function EditorAnderson({ libro, datos, ui, setUi, recienGuardado, onGuardado }) {
  const personajes = datos.personajes || []
  const inicial = useMemo(() => ({
    pistas: (datos.pistas || []).map(x => ({ ...x, resumen: x.resumen || '', por_que: x.por_que || '' })),
    rasgos: (datos.rasgos || []).map(x => ({ ...x, opciones: [...(x.opciones || [])], pool: [...(x.pool || [])] })),
  }), [datos])
  const [pistas, setPistas] = useState(inicial.pistas)
  const [rasgos, setRasgos] = useState(inicial.rasgos)
  const { enviar, guardando, error, ok } = useGuardar(libro, 'anderson', 'editar_anderson')
  const cambiado = JSON.stringify({ pistas, rasgos }) !== JSON.stringify(inicial)
  const verEnLibro = useVerEnLibro(libro, cambiado)
  const nuevoId = useRef(0)

  const pjSel = personajes.some(p => p.id === ui.pj) ? ui.pj : personajes[0]?.id
  const pj = personajes.find(p => p.id === pjSel)
  const elegirPj = (id) => setUi({ ...ui, pj: id, rasgo: null })
  const abrir = (id) => setUi({ ...ui, pj: pjSel, rasgo: id })
  const volver = () => setUi({ ...ui, pj: pjSel, rasgo: null })

  const pistaPorId = useMemo(() => new Map(pistas.map(x => [x.id, x])), [pistas])
  const rasgoPorId = useMemo(() => new Map(rasgos.map(r => [r.id, r])), [rasgos])
  const susRasgos = rasgos.filter(r => r.pj === pjSel)
  const susSenuelos = pistas.filter(x => x.pj === pjSel && x.senuelo).sort((a, b) => a.cap - b.cap)
  // Si la deducción abierta ya no existe (se quitó, o volvió al original), se vuelve a la lista.
  const abierta = ui.rasgo === 'senuelos' || rasgoPorId.has(ui.rasgo) ? ui.rasgo : null
  const rasgo = abierta === 'senuelos' ? null : rasgoPorId.get(abierta)
  const pistasDe = (r) => r.pool.filter(id => pistaPorId.has(id)).map(id => pistaPorId.get(id))

  const cambiarRasgo = (id, cambio) => setRasgos(xs => xs.map(r => (r.id === id ? { ...r, ...cambio } : r)))
  const cambiarPista = (id, campo, valor) => setPistas(xs => xs.map(x => (x.id === id ? { ...x, [campo]: valor } : x)))
  const quitarDeRasgo = (r, id) => cambiarRasgo(r.id, { pool: r.pool.filter(x => x !== id) })
  const agregarARasgo = (r, id) => cambiarRasgo(r.id, { pool: [...r.pool, id] })
  const pistaNueva = (r, p) => {
    const id = `n${++nuevoId.current}`
    setPistas(xs => [...xs, { id, nueva: true, pj: pjSel, cap: p.cap, parrafo: p.parrafo, cita: p.cita, resumen: p.resumen, senuelo: false, por_que: '' }])
    agregarARasgo(r, id)
  }
  const nuevaDeduccion = () => {
    const id = `x${++nuevoId.current}`
    setRasgos(xs => [...xs, { id, nueva: true, pj: pjSel, opciones: ['', '', ''], correcta: 0, tipos: [null, 'otra', 'otra'], pool: [] }])
    abrir(id)
  }
  const quitarDeduccion = (r) => {
    if (!window.confirm('¿Quitar esta deducción del juego? Las pistas que solo servían para ella también se quitan.')) return
    setRasgos(xs => xs.filter(x => x.id !== r.id).map(x => ({ ...x, pool: x.pool.filter(id => id !== r.id) })))
    volver()
  }

  const guardar = () => {
    const usadas = new Set(rasgos.flatMap(r => r.pool))
    enviar({
      onOk: onGuardado,
      p_pistas: pistas.filter(x => !x.nueva || usadas.has(x.id)).map(x => (x.nueva
        ? { nueva: true, id: x.id, pj: x.pj, cap: x.cap, cita: x.cita, resumen: x.resumen }
        : x.senuelo ? { id: x.id, resumen: x.resumen, por_que: x.por_que } : { id: x.id, resumen: x.resumen })),
      p_rasgos: rasgos.map(r => (r.nueva
        ? { nueva: true, id: r.id, pj: r.pj, opciones: r.opciones, correcta: r.correcta, pool: r.pool }
        : { id: r.id, opciones: r.opciones, pool: r.pool })),
    })
  }

  return (
    <>
      <p className="esc-letra">Mientras lee, el lector junta pistas de cada personaje (frases de tu libro). Con tres que van juntas arma una deducción y elige cuál de tres conclusiones es la verdadera. Entre las pistas hay señuelos: frases reales que engañan a quien lee por encima.</p>
      <div className="esc-tabs-ed" role="tablist">
        <button type="button" role="tab" aria-selected={ui.vista !== 'lector'} onClick={() => setUi({ ...ui, vista: 'editar' })}>Editar</button>
        <button type="button" role="tab" aria-selected={ui.vista === 'lector'} onClick={() => setUi({ ...ui, vista: 'lector' })}>Cómo lo ve el lector</button>
      </div>
      {ui.vista === 'lector' && (
        <>
          <p className="esc-t-nota">Juégala como tu lector. Los sellos numerados solo los ves tú: marcan qué pistas arman cada deducción. {cambiado ? 'Ya incluye tus cambios sin guardar. ' : ''}Aquí no se gasta nada ni se guarda nada.</p>
          <MesaEnsayo personajes={personajes} pistas={pistas} rasgos={rasgos} />
        </>
      )}
      {ui.vista !== 'lector' && <div className="esc-cuaderno">
        <div className="esc-indice">
          {personajes.map(x => (
            <button key={x.id} type="button" className={'esc-it' + (x.id === pjSel ? ' on' : '')} onClick={() => elegirPj(x.id)}>
              <b>{x.nombre}</b><small>Aparece en el cap. {x.aparece} · {rasgos.filter(r => r.pj === x.id).length} deducciones</small>
            </button>
          ))}
        </div>
        {pj && (
          <div className="esc-ficha-ed">
            {!abierta && (
              <>
                <h4 className="esc-sub-ed">Lo que el lector descubre de {pj.corto}</h4>
                <div className="esc-deducciones">
                  {susRasgos.map(r => {
                    const ps = pistasDe(r)
                    const falta = ps.length < MIN_PISTAS
                    return (
                      <button key={r.id} type="button" className={'esc-deduccion' + (falta ? ' is-falta' : '')} onClick={() => abrir(r.id)}>
                        <b>{verdadera(r) || 'Deducción nueva (sin escribir)'}</b>
                        <small>{ps.length} pistas{ps.length ? ` · caps. ${Math.min(...ps.map(p => p.cap))}–${Math.max(...ps.map(p => p.cap))}` : ''}{falta ? ' · le faltan pistas' : ''}</small>
                      </button>
                    )
                  })}
                  <button type="button" className="esc-deduccion is-nueva" onClick={nuevaDeduccion}>＋ Nueva deducción</button>
                </div>
                <button type="button" className="esc-deduccion is-senuelos" onClick={() => abrir('senuelos')}>
                  <b>Señuelos de {pj.corto}</b><small>{susSenuelos.length} frases reales que engañan a quien lee por encima</small>
                </button>
              </>
            )}

            {abierta && (
              <button type="button" className="esc-volver-ed" onClick={volver}>← Todas las deducciones de {pj.corto}</button>
            )}

            {rasgo && (
              <DetalleDeduccion key={rasgo.id} r={rasgo} pj={pj} libro={libro}
                pistasDe={pistasDe} rasgos={susRasgos} pistas={pistas.filter(x => x.pj === pjSel && !x.senuelo)}
                rasgoPorId={rasgoPorId} verEnLibro={verEnLibro}
                onCambiar={(cambio) => cambiarRasgo(rasgo.id, cambio)} onCambiarPista={cambiarPista}
                onQuitarPista={(id) => quitarDeRasgo(rasgo, id)} onAgregarPista={(id) => agregarARasgo(rasgo, id)}
                onPistaNueva={(p) => pistaNueva(rasgo, p)}
                onQuitar={susRasgos.length > 1 ? () => quitarDeduccion(rasgo) : null} />
            )}

            {abierta === 'senuelos' && (
              <>
                <h4 className="esc-sub-ed">Señuelos de {pj.corto}</h4>
                <p className="esc-t-nota">Frases reales del libro que parecen apoyar una conclusión falsa. No arman ninguna deducción.</p>
                {susSenuelos.map(x => (
                  <TarjetaPista key={x.id} pista={x} campo="resumen" largo={200} etiqueta="Señuelo" verEnLibro={verEnLibro}
                    onCambiar={(campo, valor) => cambiarPista(x.id, campo, valor)}>
                    <label className="esc-campo-an">Por qué engaña <small>(lo ve el profe; en una línea)</small>
                      <input value={x.por_que} maxLength={300} onChange={(e) => cambiarPista(x.id, 'por_que', e.target.value)} /></label>
                  </TarjetaPista>
                ))}
              </>
            )}
          </div>
        )}
      </div>}
      <PieGuardar cambiado={cambiado} guardando={guardando} error={error} ok={ok || recienGuardado} onGuardar={guardar} />
    </>
  )
}

function DetalleDeduccion({ r, pj, libro, pistasDe, rasgos, pistas, rasgoPorId, verEnLibro,
  onCambiar, onCambiarPista, onQuitarPista, onAgregarPista, onPistaNueva, onQuitar }) {
  const ps = pistasDe(r)
  const base = r.pool.filter(id => rasgoPorId.has(id)).map(id => rasgoPorId.get(id))
  const otrasDe = (id) => rasgos.filter(x => x.id !== r.id && x.pool.includes(id)).map(verdadera)
  const libres = pistas.filter(x => !r.pool.includes(x.id)).sort((a, b) => a.cap - b.cap)

  return (
    <>
      {(
        <>
          <div className="esc-campo-an esc-pista-ed">Las tres conclusiones <small>(el lector elige una; que midan parecido y empiecen igual: si la verdadera es la única larga, se adivina sin leer)</small>
            {r.opciones.map((o, k) => (
              <div key={k} className="esc-opcion">
                <input value={o} maxLength={160} placeholder={k === r.correcta ? `${pj.corto}…  (la verdadera)` : `${pj.corto}…  (una falsa creíble)`}
                  onChange={(e) => onCambiar({ opciones: r.opciones.map((x, j) => (j === k ? e.target.value : x)) })} />
                {r.nueva
                  ? <label className="esc-gris esc-radio"><input type="radio" name={`correcta-${r.id}`} checked={k === r.correcta} onChange={() => onCambiar({ correcta: k })} /> la verdadera</label>
                  : k === r.correcta ? <span className="esc-correcta">✓ la verdadera</span> : <span className="esc-gris">{TIPO_FALSA[r.tipos?.[k]] || 'falsa'}</span>}
              </div>
            ))}
          </div>

          <h4 className="esc-sub-ed">Pistas que la arman ({ps.length})</h4>
          {ps.length < MIN_PISTAS && <p className="esc-falta">Necesita al menos {MIN_PISTAS} pistas para que el lector pueda armarla.</p>}
          {base.map(b => <p key={b.id} className="esc-t-nota">Parte de otra deducción: «{verdadera(b)}» (cuenta como una carta más).</p>)}
          {ps.map(x => (
            <TarjetaPista key={x.id} pista={x} campo="resumen" largo={200} verEnLibro={x.nueva ? null : verEnLibro}
              etiqueta={x.nueva ? 'nueva (se guarda al guardar los cambios)' : otrasDe(x.id).length ? `también arma «${otrasDe(x.id).join('», «')}»` : null}
              onCambiar={(campo, valor) => onCambiarPista(x.id, campo, valor)}>
              <div className="esc-fila-botones">
                <button type="button" className="esc-borrar" disabled={ps.length <= MIN_PISTAS} onClick={() => onQuitarPista(x.id)}
                  title={ps.length <= MIN_PISTAS ? `Tiene que quedar con al menos ${MIN_PISTAS} pistas` : undefined}>Quitar de esta deducción</button>
              </div>
            </TarjetaPista>
          ))}

          <AgregarPista pj={pj} libro={libro} libres={libres} onAgregar={onAgregarPista} onNueva={onPistaNueva} />

          <div className="esc-fila-botones">
            <button type="button" className="esc-borrar" disabled={!onQuitar} onClick={onQuitar || undefined}
              title={onQuitar ? undefined : `${pj.corto} tiene que quedarse con al menos una deducción`}>Quitar esta deducción</button>
          </div>
        </>
      )}
    </>
  )
}

// Añadir una pista: una que ya tiene el personaje o una frase nueva del libro
// (la base comprueba que esté tal cual en ese capítulo).
function AgregarPista({ pj, libro, libres, onAgregar, onNueva }) {
  const [modo, setModo] = useState(null)   // null · existente · nueva
  const { data: caps = [] } = useCapitulosLibro(libro.id)
  const desde = caps.filter(c => c.numero >= (pj.aparece || 1))
  const [cap, setCap] = useState(pj.aparece || 1)
  const [cita, setCita] = useState('')
  const [resumen, setResumen] = useState('')
  const [estado, setEstado] = useState({ buscando: false, error: '' })

  const anadirNueva = async () => {
    setEstado({ buscando: true, error: '' })
    try {
      const parrafo = await ubicarCitaEscritor(libro.id, Number(cap), cita)
      onNueva({ cap: Number(cap), parrafo, cita: cita.trim(), resumen: resumen.trim() })
      setCita(''); setResumen(''); setModo(null); setEstado({ buscando: false, error: '' })
    } catch (e) {
      setEstado({ buscando: false, error: mensajeErrorEscritor(e, 'No pudimos comprobar la frase.') })
    }
  }

  if (!modo) {
    return (
      <div className="esc-fila-botones">
        <button type="button" className="esc-nuevo-it" disabled={!libres.length} onClick={() => setModo('existente')}>＋ Una pista que ya tiene {pj.corto}</button>
        <button type="button" className="esc-nuevo-it" onClick={() => setModo('nueva')}>＋ Una frase nueva de tu libro</button>
      </div>
    )
  }
  return (
    <div className="esc-pista-ed esc-agregar-pista">
      {modo === 'existente' && (
        <>
          <b>Pistas de {pj.corto} que no están en esta deducción</b>
          {libres.map(x => (
            <div key={x.id} className="esc-opcion">
              <span className="esc-libre"><b>Cap. {x.cap}</b> · {x.resumen}</span>
              <button type="button" className="esc-pill esc-chica" onClick={() => { onAgregar(x.id); setModo(null) }}>Añadir</button>
            </div>
          ))}
        </>
      )}
      {modo === 'nueva' && (
        <>
          <b>Una frase nueva de tu libro</b>
          <label className="esc-campo-an">Capítulo <small>({pj.corto} aparece en el {pj.aparece}: antes no puede haber pistas suyas)</small>
            <select value={cap} onChange={(e) => setCap(e.target.value)}>
              {desde.map(c => <option key={c.numero} value={c.numero}>Capítulo {c.numero}{c.titulo ? ` · ${c.titulo}` : ''}</option>)}
            </select></label>
          <label className="esc-campo-an">La frase, copiada tal cual de tu libro <small>(1 a 3 oraciones; el lector la ve como cita)</small>
            <textarea rows={3} maxLength={600} value={cita} onChange={(e) => setCita(e.target.value)} /></label>
          <label className="esc-campo-an">Lo que ve el lector en la pista <small>(una frase corta y neutra: qué pasa, sin decir la conclusión)</small>
            <input value={resumen} maxLength={200} onChange={(e) => setResumen(e.target.value)} /></label>
          {estado.error && <p className="esc-falta">{estado.error}</p>}
        </>
      )}
      <div className="esc-fila-botones">
        <button type="button" className="esc-borrar" onClick={() => { setModo(null); setEstado({ buscando: false, error: '' }) }}>Cancelar</button>
        {modo === 'nueva' && (
          <button type="button" className="esc-pill esc-naranja esc-chica" disabled={estado.buscando || cita.trim().length < 10 || !resumen.trim()} onClick={anadirNueva}>
            {estado.buscando ? 'Buscando la frase…' : 'Añadir pista'}</button>
        )}
      </div>
    </div>
  )
}

// La mesa de Anderson como la juega el lector, para que el escritor la pruebe
// con lo que tiene en pantalla (aunque no esté guardado). Es una copia local
// de las reglas de la mesa (087): un trío vale si las tres están en una misma
// deducción pendiente; si dos van juntas, «Casi»; al acertar, las pistas que
// ya no sirven a nada más pasan a la ficha. Sin ovillos y sin guardar nada.
// SOLO aquí, cada pista lleva un sello numerado con la deducción (o las
// deducciones) que arma: así el escritor puede resolverla.
const VACIO_MESA = [null, null, null]

function MesaEnsayo({ personajes, pistas, rasgos }) {
  const [pjId, setPjId] = useState(personajes[0]?.id)
  const [lab, setLab] = useState(VACIO_MESA)
  const [abierta, setAbierta] = useState(null)       // { rasgo, pistas, tachadas }
  const [armadas, setArmadas] = useState([])         // ids de deducciones armadas
  const [parejas, setParejas] = useState([])         // [[id, id]] marcadas por un «Casi»
  const [aviso, setAviso] = useState(null)

  const pj = personajes.find(p => p.id === pjId)
  const susRasgos = rasgos.filter(r => r.pj === pjId)
  const numero = new Map(susRasgos.map((r, k) => [r.id, k]))   // sello de cada deducción
  const pendientes = susRasgos.filter(r => !armadas.includes(r.id))
  const rasgoPorId = new Map(rasgos.map(r => [r.id, r]))
  // Piezas en la lista: pistas que aún sirven a una deducción pendiente (y los
  // señuelos, que nunca se van) + deducciones armadas de las que parte otra.
  const piezas = [
    ...susRasgos.filter(r => armadas.includes(r.id) && pendientes.some(q => q.pool.includes(r.id)))
      .map(r => ({ id: r.id, comp: true, texto: r.opciones[r.correcta] })),
    ...pistas.filter(x => x.pj === pjId && (x.senuelo || pendientes.some(r => r.pool.includes(x.id))))
      .sort((a, b) => a.cap - b.cap || a.parrafo - b.parrafo),
  ]
  const porId = new Map(piezas.map(x => [x.id, x]))
  const sellos = (id) => susRasgos.filter(r => r.pool.includes(id) && !armadas.includes(r.id))
  const lleno = lab.every(Boolean)

  const reiniciar = () => { setLab(VACIO_MESA); setAbierta(null); setArmadas([]); setParejas([]); setAviso(null) }
  const elegirPj = (id) => { if (!abierta) { setPjId(id); setLab(VACIO_MESA); setAviso(null) } }
  const poner = (id) => {
    if (abierta || lab.includes(id)) return
    const i = lab.indexOf(null)
    if (i >= 0) { setAviso(null); setLab(lab.map((x, k) => (k === i ? id : x))) }
  }
  const quitar = (i) => { if (!abierta) setLab(lab.map((x, k) => (k === i ? null : x))) }

  const jugar = () => {
    const r = pendientes.find(q => lab.every(id => q.pool.includes(id)))
    if (r) { setAbierta({ rasgo: r.id, pistas: lab, tachadas: [] }); setLab(VACIO_MESA); setAviso(null); return }
    const par = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => [lab[a], lab[b]])
      .find(([a, b]) => pendientes.some(q => q.pool.includes(a) && q.pool.includes(b)))
    if (par) {
      setParejas(ps => [...ps, par])
      setAviso({ tipo: 'bad', titulo: 'Casi', texto: 'Dos de estas sí van juntas: te las dejé marcadas con 🔗 en la lista.' })
    } else {
      setAviso({ tipo: 'bad', titulo: 'No encajan juntas', texto: 'Prueba con tres que cuenten algo en común.' })
    }
    setLab(VACIO_MESA)
  }
  const concluir = (i) => {
    const r = rasgoPorId.get(abierta.rasgo)
    if (i !== r.correcta) {
      setAbierta(a => ({ ...a, tachadas: [...a.tachadas, i] }))
      return
    }
    const ahora = [...armadas, r.id]
    const quedan = abierta.pistas.filter(id => susRasgos.some(q => !ahora.includes(q.id) && q.pool.includes(id))).length
    const extras = []
    const confirman = r.pool.filter(id => !abierta.pistas.includes(id) && !rasgoPorId.has(id)).length
    if (confirman) extras.push(confirman === 1 ? 'Otra pista que también lo mostraba pasa a la ficha.' : `Otras ${confirman} pistas que también lo mostraban pasan a la ficha.`)
    if (quedan) extras.push(quedan === 1 ? 'Una de las tres se queda en la lista: todavía sirve para otra cosa.' : `${quedan} de las tres se quedan en la lista: todavía sirven para otra cosa.`)
    setArmadas(ahora)
    setParejas(ps => ps.filter(([a, b]) => !(r.pool.includes(a) && r.pool.includes(b))))
    setAbierta(null)
    setAviso({ tipo: 'ok', titulo: '¡Nueva deducción!', texto: r.opciones[r.correcta], extras })
  }

  const sellosDe = (id) => (
    <span className="esc-sellos" title="Solo lo ves tú: a qué deducción pertenece">
      {sellos(id).map(q => <span key={q.id} className={`esc-sello s-${numero.get(q.id) % 6}`}>{numero.get(q.id) + 1}</span>)}
    </span>
  )
  const marcas = (id) => parejas.map((par, i) => (par.includes(id) ? <span key={i} className={`mesa-par par-${i % 6}`}>🔗{i + 1}</span> : null))

  const cartaMesa = (id, i, mini) => {
    const p = porId.get(id) || (rasgoPorId.has(id) ? { id, comp: true, texto: rasgoPorId.get(id).opciones[rasgoPorId.get(id).correcta] } : null)
    if (!p) return null
    return (
      <div key={i} className={`mesa-cartax${p.comp ? ' is-comp' : ''}`} {...(mini ? {} : { role: 'button', tabIndex: 0, onClick: () => quitar(i) })}>
        <span className="mesa-cartax-cp">{p.comp ? 'DEDUCCIÓN' : `CAP. ${p.cap}`}</span>
        <span className="mesa-cartax-palo">{p.comp ? '★' : '♦'}</span>
        <span className="mesa-cartax-t">{p.comp ? p.texto : p.resumen}</span>
        {!mini && <span className="mesa-cartax-x">×</span>}
      </div>
    )
  }

  const r = abierta ? rasgoPorId.get(abierta.rasgo) : null
  return (
    <div className="mesa-root is-pc esc-mesa-ensayo">
      <div className="mesa-izq">
        <div className="mesa-chips" role="tablist" aria-label="Personajes">
          {personajes.map(p => {
            const total = rasgos.filter(q => q.pj === p.id).length
            const hechas = rasgos.filter(q => q.pj === p.id && armadas.includes(q.id)).length
            return (
              <button key={p.id} type="button" role="tab" className="mesa-chip" aria-selected={p.id === pjId}
                disabled={!!abierta && p.id !== pjId} onClick={() => elegirPj(p.id)}>
                <span className="mesa-chip-ini">{p.corto[0]}</span>{p.corto} <small>{hechas}/{total}</small>
              </button>
            )
          })}
        </div>
        <div className="mesa-pend">
          {pendientes.length === 0 ? <b>¡Perfil completo!</b> : <>🔎 <b>{pendientes.length} {pendientes.length === 1 ? 'deducción' : 'deducciones'} por descubrir</b></>}
        </div>
        <div className="mesa-ficha">
          <div className="mesa-ficha-h">LO QUE SABES DE<b>{pj?.nombre}</b></div>
          {susRasgos.filter(q => armadas.includes(q.id)).map(q => {
            const mas = q.pool.filter(id => !rasgoPorId.has(id)).length - 3
            return (
              <div key={q.id} className="mesa-concl">{q.opciones[q.correcta]}
                {mas > 0 && <small>+{mas} {mas === 1 ? 'pista más lo confirma' : 'pistas más lo confirman'}</small>}
              </div>
            )
          })}
          {pendientes.length > 0 && <div className="mesa-falta">{pendientes.length} {pendientes.length === 1 ? 'deducción' : 'deducciones'} por descubrir</div>}
        </div>
        <div className="mesa-tabla">
          {aviso && !abierta && (
            <div className={`mesa-res is-${aviso.tipo}`} role="status">
              <span className="mesa-res-k">{aviso.titulo}</span>
              {aviso.texto && <span className={aviso.tipo === 'ok' ? 'mesa-res-big' : ''}>{aviso.texto}</span>}
              {(aviso.extras || []).map((x, i) => <span key={i}>{x}</span>)}
            </div>
          )}
          {abierta ? (<>
            <div className="mesa-slots is-mini">{abierta.pistas.map((id, i) => cartaMesa(id, i, true))}</div>
            <div className="mesa-q">¿Qué te dicen estas tres?</div>
            <div className="mesa-opts">
              {r.opciones.map((o, i) => (
                <button key={i} type="button" className="mesa-opt" disabled={abierta.tachadas.includes(i)} onClick={() => concluir(i)}>
                  <span className="mesa-opt-lt">{LETRAS_MESA[i]}</span>{o}
                </button>
              ))}
            </div>
          </>) : (<>
            <div className="mesa-slots">
              {lab.map((id, i) => (id ? cartaMesa(id, i, false) : <div key={i} className="mesa-cartax is-vacia">Pista {i + 1}</div>))}
            </div>
            <div className="mesa-btns">
              <button type="button" className="mesa-jugar" onClick={jugar} disabled={!lleno}>Jugar</button>
            </div>
          </>)}
        </div>
        <button type="button" className="esc-borrar" onClick={reiniciar}>Empezar de nuevo</button>
      </div>
      <div className="mesa-der">
        <span className="mesa-washi">Pistas de {pj?.corto}</span>
        <div className="mesa-lista">
          {piezas.map(p => (
            <div key={p.id} role="button" tabIndex={0} className={`mesa-carta${p.comp ? ' is-comp' : ''}${lab.includes(p.id) ? ' en-mesa' : ''}`}
              onClick={() => poner(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poner(p.id) } }}>
              {p.comp ? <span className="mesa-carta-tag">Deducción</span> : <><span className="mesa-carta-pin" /><span><span className="mesa-carta-cap">Cap. {p.cap}</span></span></>}
              <span className="mesa-carta-t">{p.comp ? p.texto : p.resumen}</span>
              <span className="mesa-pars">{marcas(p.id)}</span>
              {sellosDe(p.id)}
            </div>
          ))}
          {piezas.length === 0 && <div className="mesa-vacio">No quedan pistas de {pj?.corto}.</div>}
        </div>
      </div>
    </div>
  )
}

// ── Hilo de ideas ─────────────────────────────────────────────
// Editar: las ideas como tarjetas → al abrir una, sus textos y sus 3 piezas
// (pistas del libro o ideas anteriores). Cada idea lleva SIEMPRE 3 piezas y
// cada pista va en una sola idea: por eso una pieza se «cambia» (por otra
// frase del libro o por una idea anterior). Se pueden crear y quitar ideas.
// La base hace cumplir las reglas y recalcula cuándo se abre cada una (116).
// Cómo lo ve el lector: la pizarra de verdad (HiloIdeas en modo ensayo) con
// reglas locales y sellos que solo ve el escritor.

const SENUELOS = '__senuelos'
const chipIdea = (x) => (x.final === 'principal' ? 'La conclusión del libro' : x.final === 'extra' ? 'Conclusión extra' : null)

function EditorHilo({ libro, datos, ui, setUi, recienGuardado, onGuardado }) {
  const inicial = useMemo(() => ({
    pistas: (datos.pistas || []).map(x => ({ ...x, t: x.t || '' })),
    ideas: (datos.ideas || []).map(x => ({ ...x, titulo: x.titulo || '', pregunta: x.pregunta || '', conclusion: x.conclusion || '', falta: x.falta || '', piezas: [...(x.piezas || [])] })),
  }), [datos])
  const [pistas, setPistas] = useState(inicial.pistas)
  const [ideas, setIdeas] = useState(inicial.ideas)
  const { enviar, guardando, error, ok } = useGuardar(libro, 'hilo', 'editar_hilo')
  const cambiado = JSON.stringify({ pistas, ideas }) !== JSON.stringify(inicial)
  const verEnLibro = useVerEnLibro(libro, cambiado)
  const nuevoId = useRef(0)

  const pistaPorId = new Map(pistas.map(x => [x.id, x]))
  const ideaPorId = new Map(ideas.map(x => [x.id, x]))
  const numero = new Map(ideas.map((x, k) => [x.id, k + 1]))
  const senuelos = pistas.filter(x => x.senuelo).sort((a, b) => a.cap - b.cap)
  const abierta = ui.rasgo === SENUELOS || ideaPorId.has(ui.rasgo) ? ui.rasgo : null
  const idea = ideaPorId.get(abierta)
  const abrir = (id) => setUi({ ...ui, rasgo: id })
  const volver = () => setUi({ ...ui, rasgo: null })
  // Quién usa a quién (para no quitar una idea que otra necesita ni crear ciclos).
  const usadaPor = (id) => ideas.filter(x => x.piezas.includes(id))
  const dependeDe = (a, b, vistos = new Set()) => {   // ¿a necesita (directa o indirectamente) a b?
    if (a === b) return true
    if (vistos.has(a)) return false
    vistos.add(a)
    return (ideaPorId.get(a)?.piezas || []).some(p => ideaPorId.has(p) && dependeDe(p, b, vistos))
  }

  const cambiarIdea = (cambio) => setIdeas(xs => xs.map(x => (x.id === abierta ? { ...x, ...cambio } : x)))
  const cambiarPista = (id, valor) => setPistas(xs => xs.map(x => (x.id === id ? { ...x, t: valor } : x)))
  const ponerPieza = (k, pieza) => {
    let id = pieza.idea
    if (pieza.frase) {
      id = `n${++nuevoId.current}`
      setPistas(xs => [...xs, { id, nueva: true, cap: pieza.frase.cap, parrafo: pieza.frase.parrafo, cita: pieza.frase.cita, t: pieza.frase.t, senuelo: false }])
    }
    cambiarIdea({ piezas: idea.piezas.map((x, j) => (j === k ? id : x)) })
  }
  const nuevaIdea = () => {
    const id = `y${++nuevoId.current}`
    setIdeas(xs => [...xs, { id, nueva: true, final: null, titulo: '', pregunta: '', conclusion: '', falta: '', piezas: [null, null, null] }])
    abrir(id)
  }
  const quitarIdea = () => {
    if (!window.confirm('¿Quitar esta idea del juego? Sus pistas también se quitan.')) return
    setIdeas(xs => xs.filter(x => x.id !== abierta))
    volver()
  }

  const guardar = () => {
    const usadas = new Set(ideas.flatMap(x => x.piezas))
    enviar({
      onOk: onGuardado,
      p_pistas: pistas.filter(x => !x.nueva || usadas.has(x.id)).map(x => (x.nueva
        ? { nueva: true, id: x.id, cap: x.cap, cita: x.cita, t: x.t } : { id: x.id, t: x.t })),
      p_ideas: ideas.map(x => ({ ...(x.nueva ? { nueva: true } : {}), id: x.id, titulo: x.titulo, pregunta: x.pregunta,
        conclusion: x.conclusion, falta: x.falta, piezas: x.piezas })),
    })
  }

  // Sellos de la vista del lector: el número de la idea, en ella y en sus pistas.
  const sello = (n) => <span className={`esc-sello s-${(n - 1) % 6}`}>{n}</span>
  const ensayo = useHiloEnsayo({ pistas, ideas })
  const ensayoSellos = {
    ...ensayo,
    sello: (pid) => {
      const due = ideas.find(x => x.piezas.includes(pid))
      return due ? <span className="esc-sellos" title="Solo lo ves tú: a qué idea pertenece">{sello(numero.get(due.id))}</span> : null
    },
    selloIdea: (iid) => <span className="esc-sellos is-izq" title="Solo lo ves tú">{sello(numero.get(iid))}</span>,
  }

  return (
    <>
      <p className="esc-letra">Al terminar cada capítulo llegan pistas (ideas de tu libro dichas en llano). En una pizarra hay ideas tapadas: el lector junta las tres piezas de cada una para destaparla, hasta llegar a la conclusión del libro. Entre las pistas hay señuelos: cosas ciertas del libro que no explican ninguna idea.</p>
      <div className="esc-tabs-ed" role="tablist">
        <button type="button" role="tab" aria-selected={ui.vista !== 'lector'} onClick={() => setUi({ ...ui, vista: 'editar' })}>Editar</button>
        <button type="button" role="tab" aria-selected={ui.vista === 'lector'} onClick={() => setUi({ ...ui, vista: 'lector' })}>Cómo lo ve el lector</button>
      </div>

      {ui.vista === 'lector' && (
        <>
          <p className="esc-t-nota">Juégala como tu lector, con el libro ya leído. Los sellos numerados solo los ves tú: cada idea lleva su número y sus pistas, el mismo. {cambiado ? 'Ya incluye tus cambios sin guardar. ' : ''}Aquí no se gasta nada ni se guarda nada.</p>
          <div className="esc-hilo-ensayo-wrap">
            <HiloIdeas libroId={null} userId={null} ensayo={ensayoSellos} />
          </div>
          <button type="button" className="esc-borrar" onClick={ensayo.reiniciar}>Empezar de nuevo</button>
        </>
      )}

      {ui.vista !== 'lector' && (
        <div className="esc-ficha-ed">
          {cambiado && <small className="esc-gris">Guarda antes de ir al libro: ahí verás la versión guardada.</small>}
          {!abierta && (
            <>
              <h4 className="esc-sub-ed">Las ideas de la pizarra</h4>
              <div className="esc-deducciones">
                {ideas.map(x => {
                  const faltan = x.piezas.filter(p => !p).length
                  return (
                    <button key={x.id} type="button" className={'esc-deduccion' + (faltan ? ' is-falta' : '')} onClick={() => abrir(x.id)}>
                      <b><span className="esc-num-idea">{numero.get(x.id)}</span> {x.titulo || 'Idea nueva (sin título)'}</b>
                      <small>{x.pregunta || 'Sin pregunta'}{chipIdea(x) ? ` · ${chipIdea(x)}` : ''}{x.nueva ? '' : ` · se abre en el cap. ${x.abre}`}{faltan ? ` · le faltan ${faltan} piezas` : ''}</small>
                    </button>
                  )
                })}
                <button type="button" className="esc-deduccion is-nueva" onClick={nuevaIdea}>＋ Nueva idea</button>
              </div>
              <button type="button" className="esc-deduccion is-senuelos" onClick={() => abrir(SENUELOS)}>
                <b>Señuelos</b><small>{senuelos.length} pistas ciertas del libro que no van en ninguna idea</small>
              </button>
            </>
          )}

          {abierta && <button type="button" className="esc-volver-ed" onClick={volver}>← Todas las ideas</button>}

          {idea && (
            <>
              <h4 className="esc-sub-ed"><span className="esc-num-idea">{numero.get(idea.id)}</span> {idea.titulo || 'Idea nueva'}{chipIdea(idea) ? ` · ${chipIdea(idea)}` : ''}</h4>
              <label className="esc-campo-an">Pregunta <small>(lo que se ve en la tarjeta tapada; sin adelantar la respuesta)</small>
                <input value={idea.pregunta} maxLength={160} onChange={(e) => cambiarIdea({ pregunta: e.target.value })} /></label>
              <label className="esc-campo-an">Título <small>(2 a 5 palabras; se ve al destaparla)</small>
                <input value={idea.titulo} maxLength={60} onChange={(e) => cambiarIdea({ titulo: e.target.value })} /></label>
              <label className="esc-campo-an">Conclusión <small>(lo que entiende el lector al unir las piezas; 1 a 3 frases en llano)</small>
                <textarea rows={3} maxLength={500} value={idea.conclusion} onChange={(e) => cambiarIdea({ conclusion: e.target.value })} /></label>
              <label className="esc-campo-an">Ayuda <small>(cuesta 1 ovillo: qué buscar, sin nombrar las pistas)</small>
                <textarea rows={2} maxLength={300} value={idea.falta} onChange={(e) => cambiarIdea({ falta: e.target.value })} /></label>

              <h4 className="esc-sub-ed">Sus tres piezas</h4>
              <p className="esc-t-nota">Siempre tres. Una pieza es una pista (una frase de tu libro dicha en llano) o una idea anterior, que llega sola por el hilo cuando el lector la arma.</p>
              {idea.piezas.map((id, k) => {
                const x = id && pistaPorId.get(id)
                const previa = id && ideaPorId.get(id)
                const cambiar = (
                  <CambiarPieza libro={libro} ideas={ideas.filter(o => o.id !== idea.id && o.final !== 'principal' && !idea.piezas.includes(o.id) && !dependeDe(o.id, idea.id))}
                    numero={numero} vacia={!id} onElegir={(pieza) => ponerPieza(k, pieza)} />
                )
                if (x) {
                  return (
                    <TarjetaPista key={id} pista={x} campo="t" largo={200} verEnLibro={x.nueva ? null : verEnLibro}
                      etiqueta={x.nueva ? 'nueva (se guarda al guardar los cambios)' : null} onCambiar={(_, v) => cambiarPista(id, v)}>
                      {cambiar}
                    </TarjetaPista>
                  )
                }
                return (
                  <div key={id || `vacia-${k}`} className="esc-pista-ed">
                    {previa
                      ? <p className="esc-t-nota">Llega sola por el hilo: la idea <span className="esc-num-idea">{numero.get(previa.id)}</span> «{previa.titulo}».</p>
                      : <p className="esc-falta">Pieza {k + 1}: sin elegir.</p>}
                    {cambiar}
                  </div>
                )
              })}

              <div className="esc-fila-botones">
                {(() => {
                  const motivo = idea.final === 'principal' ? 'La conclusión del libro no se puede quitar'
                    : usadaPor(idea.id).length ? `La usa la idea ${numero.get(usadaPor(idea.id)[0].id)}: cámbiala ahí primero` : null
                  return <button type="button" className="esc-borrar" disabled={!!motivo} title={motivo || undefined} onClick={quitarIdea}>Quitar esta idea</button>
                })()}
              </div>
            </>
          )}

          {abierta === SENUELOS && senuelos.map(x => (
            <TarjetaPista key={x.id} pista={x} campo="t" largo={200} etiqueta="Señuelo" verEnLibro={verEnLibro} onCambiar={(_, v) => cambiarPista(x.id, v)} />
          ))}
        </div>
      )}
      <PieGuardar cambiado={cambiado} guardando={guardando} error={error} ok={ok || recienGuardado} onGuardar={guardar} />
    </>
  )
}

// Cambiar (o elegir) una pieza: una frase nueva de tu libro o una idea anterior.
function CambiarPieza({ libro, ideas, numero, vacia, onElegir }) {
  const [modo, setModo] = useState(null)   // null · frase · idea
  const { data: caps = [] } = useCapitulosLibro(libro.id)
  const [cap, setCap] = useState(1)
  const [cita, setCita] = useState('')
  const [t, setT] = useState('')
  const [estado, setEstado] = useState({ buscando: false, error: '' })
  const cerrar = () => { setModo(null); setCita(''); setT(''); setEstado({ buscando: false, error: '' }) }
  const anadir = async () => {
    setEstado({ buscando: true, error: '' })
    try {
      const parrafo = await ubicarCitaEscritor(libro.id, Number(cap), cita)
      onElegir({ frase: { cap: Number(cap), parrafo, cita: cita.trim(), t: t.trim() } })
      cerrar()
    } catch (e) {
      setEstado({ buscando: false, error: mensajeErrorEscritor(e, 'No pudimos comprobar la frase.') })
    }
  }

  if (!modo) {
    return (
      <div className="esc-fila-botones">
        <button type="button" className="esc-nuevo-it" onClick={() => setModo('frase')}>{vacia ? '＋ Una frase de tu libro' : 'Cambiar por otra frase de tu libro'}</button>
        <button type="button" className="esc-nuevo-it" disabled={!ideas.length} onClick={() => setModo('idea')}>{vacia ? '＋ Una idea anterior' : 'Cambiar por una idea anterior'}</button>
      </div>
    )
  }
  return (
    <div className="esc-agregar-pista">
      {modo === 'idea' && ideas.map(o => (
        <div key={o.id} className="esc-opcion">
          <span className="esc-libre"><span className="esc-num-idea">{numero.get(o.id)}</span> <b>{o.titulo || 'Idea nueva'}</b> · {o.pregunta}</span>
          <button type="button" className="esc-pill esc-chica" onClick={() => { onElegir({ idea: o.id }); cerrar() }}>Elegir</button>
        </div>
      ))}
      {modo === 'frase' && (
        <>
          <label className="esc-campo-an">Capítulo <small>(la pista le llega al lector al terminarlo)</small>
            <select value={cap} onChange={(e) => setCap(e.target.value)}>
              {caps.map(c => <option key={c.numero} value={c.numero}>Capítulo {c.numero}{c.titulo ? ` · ${c.titulo}` : ''}</option>)}
            </select></label>
          <label className="esc-campo-an">La frase, copiada tal cual de tu libro
            <textarea rows={3} maxLength={600} value={cita} onChange={(e) => setCita(e.target.value)} /></label>
          <label className="esc-campo-an">Lo que ve el lector en la pista <small>(una frase corta en llano: no copia la cita, la traduce)</small>
            <input value={t} maxLength={200} onChange={(e) => setT(e.target.value)} /></label>
          {estado.error && <p className="esc-falta">{estado.error}</p>}
        </>
      )}
      <div className="esc-fila-botones">
        <button type="button" className="esc-borrar" onClick={cerrar}>Cancelar</button>
        {modo === 'frase' && (
          <button type="button" className="esc-pill esc-naranja esc-chica" disabled={estado.buscando || cita.trim().length < 10 || !t.trim()} onClick={anadir}>
            {estado.buscando ? 'Buscando la frase…' : 'Usar esta frase'}</button>
        )}
      </div>
    </div>
  )
}

// Mezcla fija por id (como el lector, que las recibe mezcladas y no por capítulo).
const mezcla = (id) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 100003, 7)

// La pizarra del lector, jugada en local con las reglas de la 100: con el
// libro ya leído (todo abierto), sin ovillos y sin guardar nada.
function useHiloEnsayo({ pistas, ideas }) {
  const [armadas, setArmadas] = useState([])
  const [ayudas, setAyudas] = useState([])
  const [ultimas, setUltimas] = useState({})     // idea → { pistas, resultado, pareja? }
  const idsIdeas = new Set(ideas.map(x => x.id))
  const listas = ideas.filter(x => x.piezas.every(Boolean))

  const estadoCon = (arm, ayu, ult) => ({
    version: 1, capitulos_completados: 9999, total_capitulos: 9999, saldo: 99, faltaron: null,
    pistas: pistas
      .filter(x => x.senuelo || listas.some(i => i.piezas.includes(x.id)))
      .map(x => ({ id: x.id, cap: x.cap, t: x.t, cita: x.cita, usada_en: listas.find(i => arm.includes(i.id) && i.piezas.includes(x.id))?.id }))
      .sort((a, b) => mezcla(a.id) - mezcla(b.id)),
    ideas: listas.map(i => {
      const armada = arm.includes(i.id)
      return {
        id: i.id, final: i.final ?? null, abre: i.abre ?? 1,
        previas: i.piezas.filter(p => idsIdeas.has(p)), huecos: i.piezas.filter(p => !idsIdeas.has(p)).length,
        estado: armada ? 'armada' : 'abierta', titulo: i.titulo, pregunta: i.pregunta,
        ...(armada ? { conclusion: i.conclusion, piezas: i.piezas } : {}),
        ...(!armada && ayu.includes(i.id) ? { falta: i.falta } : {}),
        ...(!armada && ult[i.id] ? { ultima: { pistas: ult[i.id].pistas, resultado: ult[i.id].resultado }, pareja: ult[i.id].pareja } : {}),
      }
    }),
  })

  const jugar = async ({ idea: iid, pistas: puestas }) => {
    const i = listas.find(x => x.id === iid)
    const mias = i.piezas.filter(p => !idsIdeas.has(p))
    const prev = i.piezas.filter(p => idsIdeas.has(p))
    const buenas = puestas.filter(p => mias.includes(p))
    const resultado = buenas.length === mias.length ? 'acierto'
      : (mias.length >= 2 && buenas.length + prev.length === 2) ? 'casi' : 'no_encajan'
    const ult = { ...ultimas }
    let arm = armadas
    const nuevas = []
    if (resultado === 'acierto') {
      arm = [...arm, iid]; nuevas.push(iid); delete ult[iid]
      // Las que solo esperaban ideas se arman solas, en cadena.
      for (;;) {
        const sola = listas.find(x => !arm.includes(x.id) && x.piezas.every(p => arm.includes(p)))
        if (!sola) break
        arm = [...arm, sola.id]; nuevas.push(sola.id)
      }
      setArmadas(arm)
    } else {
      ult[iid] = { pistas: puestas, resultado, pareja: resultado === 'casi' ? buenas : undefined }
    }
    setUltimas(ult)
    const premio = nuevas.reduce((n, id) => n + (listas.find(x => x.id === id)?.final === 'principal' ? 5 : 2), 0)
    return { resultado, armadas: nuevas, premio, estado: estadoCon(arm, ayudas, ult) }
  }
  const pedirAyuda = async (iid) => {
    const ayu = [...ayudas, iid]
    setAyudas(ayu)
    return { estado: estadoCon(armadas, ayu, ultimas) }
  }
  const reiniciar = () => { setArmadas([]); setAyudas([]); setUltimas({}) }
  return { estado: estadoCon(armadas, ayudas, ultimas), jugar, pedirAyuda, reiniciar }
}

// ── El mapa del tesoro ────────────────────────────────────────
// Editar: capítulo → sus tesoros (tarjetas) → al abrir uno, pregunta, tipo,
// «porque», spoiler y las frases que valen (1 a 3; la primera es la principal:
// el libro brilla alrededor de ella). La base recalcula el brillo y no deja
// que dos tesoros compartan frase ni que sus brillos se pisen (117).
// Cómo lo ve el lector: el propio libro con el mapa en ensayo (MapaTesoro.jsx).

const TIPO_TESORO = { vista: 'A la vista', escondido: 'Escondido' }

function EditorMapa({ libro, datos, ui, setUi, recienGuardado, onGuardado }) {
  const inicial = useMemo(() => (datos.tesoros || []).map(t => ({
    id: t.id, cap: t.cap, tipo: t.tipo, pregunta: t.pregunta || '', porque: t.porque || '', spoiler: !!t.spoiler, brillo: t.brillo,
    respuestas: (t.respuestas || []).map(r => ({ ...r, cita: (datos.textos?.[`${t.cap}:${r.parrafo}`] || '').slice(r.inicio - 1, r.fin) })),
  })), [datos])
  const [tesoros, setTesoros] = useState(inicial)
  const { enviar, guardando, error, ok } = useGuardar(libro, 'mapa', 'editar_mapa')
  const cambiado = JSON.stringify(tesoros) !== JSON.stringify(inicial)
  const verEnLibro = useVerEnLibro(libro, cambiado)
  const { data: caps = [] } = useCapitulosLibro(libro.id)
  const nuevoId = useRef(0)

  const capSel = ui.pj ?? tesoros[0]?.cap ?? 1
  const delCap = tesoros.filter(t => t.cap === capSel)
  const tesoro = tesoros.find(t => t.id === ui.rasgo)
  const elegirCap = (n) => setUi({ ...ui, pj: n, rasgo: null })
  const abrir = (id) => setUi({ ...ui, pj: capSel, rasgo: id })
  const volver = () => setUi({ ...ui, pj: capSel, rasgo: null })
  const cambiar = (cambio) => setTesoros(xs => xs.map(t => (t.id === ui.rasgo ? { ...t, ...cambio } : t)))
  const nuevo = () => {
    const id = `z${++nuevoId.current}`
    setTesoros(xs => [...xs, { id, nueva: true, cap: capSel, tipo: 'vista', pregunta: '', porque: '', spoiler: false, respuestas: [] }])
    abrir(id)
  }
  const quitar = () => {
    if (!window.confirm('¿Quitar este tesoro del mapa?')) return
    setTesoros(xs => xs.filter(t => t.id !== ui.rasgo)); volver()
  }
  const guardar = () => enviar({
    onOk: onGuardado,
    p_tesoros: tesoros.map(t => ({
      ...(t.nueva ? { nueva: true, cap: t.cap } : {}), id: t.id, pregunta: t.pregunta, tipo: t.tipo, porque: t.porque, spoiler: t.spoiler,
      respuestas: t.respuestas.map(r => (r.nueva ? { cita: r.cita } : { parrafo: r.parrafo, inicio: r.inicio, fin: r.fin })),
    })),
  })
  const principal = (t) => t.respuestas[0]

  return (
    <>
      <p className="esc-letra">Al empezar cada capítulo el lector recibe fichas con preguntas. Un poco antes de cada tesoro el borde del libro brilla; si encuentra la frase, la subraya y la manda al mapa. «A la vista» = un detalle que el libro dice tal cual; «Escondido» = una idea que el libro no dice con esas palabras.</p>
      <div className="esc-tabs-ed" role="tablist">
        <button type="button" role="tab" aria-selected={ui.vista !== 'lector'} onClick={() => setUi({ ...ui, vista: 'editar' })}>Editar</button>
        <button type="button" role="tab" aria-selected={ui.vista === 'lector'} onClick={() => setUi({ ...ui, vista: 'lector' })}>Cómo lo ve el lector</button>
      </div>

      {ui.vista === 'lector' && (
        <div className="esc-ficha-ed">
          <p className="esc-t-nota">Se abre tu libro con el mapa encendido, como lo vive el lector: el borde brilla cerca de cada tesoro, la lista de fichas sale al entrar en el capítulo y, al subrayar, eliges «Mapa del tesoro». Solo tú ves las frases buenas subrayadas con el color de su ficha. No se gasta ni se guarda nada. {cambiado ? 'Guarda antes: el libro muestra la versión guardada.' : ''}</p>
          <div className="esc-deducciones">
            {caps.filter(c => tesoros.some(t => t.cap === c.numero)).map(c => (
              <button key={c.numero} type="button" className="esc-deduccion" onClick={() => verEnLibro({ cap: c.numero, parrafo: 1, mapa: true })}>
                <b>Capítulo {c.numero}{c.titulo ? ` · ${c.titulo}` : ''}</b>
                <small>{tesoros.filter(t => t.cap === c.numero).length} tesoros · abrir en tu libro ↗</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {ui.vista !== 'lector' && (
        <div className="esc-cuaderno">
          <div className="esc-indice">
            {caps.map(c => {
              const n = tesoros.filter(t => t.cap === c.numero).length
              return (
                <button key={c.numero} type="button" className={'esc-it' + (c.numero === capSel ? ' on' : '')} onClick={() => elegirCap(c.numero)}>
                  <b>Capítulo {c.numero}</b><small>{n ? `${n} tesoros` : 'sin tesoros'}</small>
                </button>
              )
            })}
          </div>
          <div className="esc-ficha-ed">
            {cambiado && <small className="esc-gris">Guarda antes de ir al libro: ahí verás la versión guardada.</small>}
            {!tesoro && (
              <>
                <h4 className="esc-sub-ed">Tesoros del capítulo {capSel}</h4>
                <div className="esc-deducciones">
                  {delCap.map((t, k) => (
                    <button key={t.id} type="button" className={'esc-deduccion' + (!t.respuestas.length ? ' is-falta' : '')} onClick={() => abrir(t.id)}>
                      <b><span className={`esc-num-idea mt-esc-${k % 6}`}>{k + 1}</span> {t.pregunta || 'Tesoro nuevo (sin pregunta)'}</b>
                      <small>{TIPO_TESORO[t.tipo]}{t.spoiler ? ' · sale al llegar a su brillo' : ''} · {t.respuestas.length} {t.respuestas.length === 1 ? 'frase vale' : 'frases valen'}</small>
                    </button>
                  ))}
                  <button type="button" className="esc-deduccion is-nueva" onClick={nuevo}>＋ Nuevo tesoro en el capítulo {capSel}</button>
                </div>
              </>
            )}

            {tesoro && (
              <>
                <button type="button" className="esc-volver-ed" onClick={volver}>← Tesoros del capítulo {tesoro.cap}</button>
                <div className="esc-donde-juego">
                  <span>Capítulo <b>{tesoro.cap}</b>{tesoro.brillo ? <> · el libro brilla entre los párrafos {tesoro.brillo[0]} y {tesoro.brillo[1]}</> : ' · el brillo se calcula al guardar'}</span>
                  {!tesoro.nueva && principal(tesoro) && (
                    <button type="button" className="esc-pill esc-chica" onClick={() => verEnLibro({ cap: tesoro.cap, parrafo: principal(tesoro).parrafo, mapa: true })}>Verlo en tu libro como el lector ↗</button>
                  )}
                </div>
                <label className="esc-campo-an">Pregunta <small>(la ficha que lee antes del capítulo: corta, de tú, sin adelantar nada)</small>
                  <input value={tesoro.pregunta} maxLength={200} onChange={(e) => cambiar({ pregunta: e.target.value })} /></label>
                <label className="esc-campo-an">Tipo
                  <select value={tesoro.tipo} onChange={(e) => cambiar({ tipo: e.target.value })}>
                    <option value="vista">A la vista: un detalle que el libro dice tal cual</option>
                    <option value="escondido">Escondido: una idea que el libro no dice con esas palabras</option>
                  </select></label>
                {tesoro.tipo === 'escondido' && (
                  <label className="esc-campo-an">Por qué esa frase lo dice <small>(lo dice el gato al encontrarlo; una frase)</small>
                    <input value={tesoro.porque} maxLength={300} onChange={(e) => cambiar({ porque: e.target.value })} /></label>
                )}
                <label className="esc-opcion esc-check-ed">
                  <input type="checkbox" checked={tesoro.spoiler} onChange={(e) => cambiar({ spoiler: e.target.checked })} />
                  <span>Spoiler: la ficha no sale en la lista del principio, aparece al llegar a su brillo (solo si no hay forma de preguntarlo sin adelantar algo).</span>
                </label>

                <h4 className="esc-sub-ed">Frases que valen ({tesoro.respuestas.length} de 3)</h4>
                <p className="esc-t-nota">Si el lector subraya cualquiera de estas, lo encontró. La primera es la principal: el brillo va alrededor de ella. Si el detalle se repite en el capítulo, pon todas las frases donde aparece.</p>
                {!tesoro.respuestas.length && <p className="esc-falta">Necesita al menos una frase.</p>}
                {tesoro.respuestas.map((r, k) => (
                  <div key={`${r.parrafo}-${r.inicio}-${k}`} className="esc-pista-ed">
                    <div className="esc-donde-juego">
                      <span>{k === 0 ? <b>Principal</b> : `Frase ${k + 1}`}{r.nueva ? ' · nueva (se guarda al guardar los cambios)' : ` · párrafo ${r.parrafo}`}</span>
                    </div>
                    <blockquote className="esc-cita-libro">{r.cita}</blockquote>
                    <div className="esc-fila-botones">
                      {k > 0 && <button type="button" className="esc-borrar" onClick={() => cambiar({ respuestas: [r, ...tesoro.respuestas.filter((_, j) => j !== k)] })}>Hacer principal</button>}
                      <button type="button" className="esc-borrar" disabled={tesoro.respuestas.length <= 1 && !tesoro.nueva} onClick={() => cambiar({ respuestas: tesoro.respuestas.filter((_, j) => j !== k) })}>Quitar</button>
                    </div>
                  </div>
                ))}
                {tesoro.respuestas.length < 3 && (
                  <FraseMapa libro={libro} cap={tesoro.cap} onAgregar={(cita) => cambiar({ respuestas: [...tesoro.respuestas, { nueva: true, cita }] })} />
                )}
                <div className="esc-fila-botones">
                  <button type="button" className="esc-borrar" onClick={quitar}>Quitar este tesoro</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <PieGuardar cambiado={cambiado} guardando={guardando} error={error} ok={ok || recienGuardado} onGuardar={guardar} />
    </>
  )
}

// Añadir una frase buena: copiada tal cual del capítulo del tesoro.
function FraseMapa({ libro, cap, onAgregar }) {
  const [abierto, setAbierto] = useState(false)
  const [cita, setCita] = useState('')
  const [estado, setEstado] = useState({ buscando: false, error: '' })
  const cerrar = () => { setAbierto(false); setCita(''); setEstado({ buscando: false, error: '' }) }
  const anadir = async () => {
    setEstado({ buscando: true, error: '' })
    try {
      await ubicarCitaEscritor(libro.id, cap, cita)
      onAgregar(cita.trim()); cerrar()
    } catch (e) {
      setEstado({ buscando: false, error: mensajeErrorEscritor(e, 'No pudimos comprobar la frase.') })
    }
  }
  if (!abierto) return <div className="esc-fila-botones"><button type="button" className="esc-nuevo-it" onClick={() => setAbierto(true)}>＋ Una frase que vale (del capítulo {cap})</button></div>
  return (
    <div className="esc-pista-ed esc-agregar-pista">
      <label className="esc-campo-an">La frase, copiada tal cual del capítulo {cap} <small>(una oración: la que el lector tendría que subrayar)</small>
        <textarea rows={3} maxLength={1500} value={cita} onChange={(e) => setCita(e.target.value)} /></label>
      {estado.error && <p className="esc-falta">{estado.error}</p>}
      <div className="esc-fila-botones">
        <button type="button" className="esc-borrar" onClick={cerrar}>Cancelar</button>
        <button type="button" className="esc-pill esc-naranja esc-chica" disabled={estado.buscando || cita.trim().split(/\s+/).length < 3} onClick={anadir}>
          {estado.buscando ? 'Buscando la frase…' : 'Añadir frase'}</button>
      </div>
    </div>
  )
}
