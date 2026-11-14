// Panel de sonidos del escritor (Rincón del escritor, fase 2a; migración 104).
// Lo ve solo el dueño del libro, en el lector, sobre su propio libro.
// Diseño de Juan (13 nov 2026):
//   · Efectos: el escritor subraya en el libro el trozo donde quiere el
//     sonido; de la selección sacamos el párrafo y la frase (como el
//     superusuario, pero sin escribirlos a mano). Debajo, toda la biblioteca
//     de sonidos con buscador: escuchar o vincular.
//   · Ambientes: otra cosa. De qué párrafo a qué párrafo del capítulo suena
//     cada ambiente, con la explicación de los continuos y los de «de vez en
//     cuando», y cada uno se puede escuchar antes.
// Todo se guarda al momento y es gratis. La base decide qué puede tocar.
import { useState, useEffect, useRef, useMemo } from 'react'
import { AMBIENTES } from '../../lib/ambientes.js'
import { useAudiosBiblioteca, useGuardarAmbientes, mensajeErrorAmbientes, normalizarBusqueda } from '../../hooks/useSonidosEscritor.js'
import '../../styles/escritor-sonidos.css'

const MAX_RESULTADOS = 80
const nombreAmbiente = (slug) => AMBIENTES[slug]?.nombre || slug.replace(/_/g, ' ')
const LISTA_AMBIENTES = Object.entries(AMBIENTES)
  .map(([slug, a]) => ({ slug, ...a }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

/** Un audio de muestra del ambiente: el bucle, o un sonido suelto al azar. */
function urlMuestraAmbiente(slug) {
  const a = AMBIENTES[slug]
  if (!a) return null
  if (a.tipo === 'bucle') return `/sounds/ambiente/${slug}_${a.variantes?.[0] || 'a'}.mp3`
  const d = a.detalles?.[Math.floor(Math.random() * a.detalles.length)]
  return d ? `/sounds/ambiente/detalles/${slug}/${d.slug}.mp3` : null
}

/**
 * La frase subrayada, completada hasta palabras enteras dentro del párrafo
 * («l martes de carnaval» → «el martes de carnaval»). null si no está.
 * @param {string} contenido
 * @param {string} frase
 */
export function fraseEnteras(contenido, frase) {
  const i = frase ? contenido.indexOf(frase) : -1
  if (i < 0) return null
  const letra = /[\p{L}\p{N}]/u
  let a = i, b = i + frase.length
  while (a > 0 && letra.test(contenido[a - 1]) && letra.test(contenido[a])) a--
  while (b < contenido.length && letra.test(contenido[b]) && letra.test(contenido[b - 1])) b++
  return contenido.slice(a, b).trim()
}

/** Un solo audio sonando a la vez; volver a tocar el mismo lo para. */
function useReproductor() {
  const audioRef = useRef(null)
  const [sonando, setSonando] = useState(null)
  const parar = () => { audioRef.current?.pause(); audioRef.current = null; setSonando(null) }
  const tocar = (clave, url) => {
    if (sonando === clave) { parar(); return }
    audioRef.current?.pause()
    if (!url) return
    const audio = new Audio(url)
    audio.volume = 0.85
    audio.onended = () => { audioRef.current = null; setSonando(null) }
    audio.play().catch(() => setSonando(null))
    audioRef.current = audio
    setSonando(clave)
  }
  useEffect(() => () => audioRef.current?.pause(), [])
  return { sonando, tocar, parar }
}

function BotonPlay({ activo, onClick, titulo }) {
  return (
    <button type="button" className={'esn-play' + (activo ? ' on' : '')} onClick={onClick}
      title={activo ? 'Parar' : titulo || 'Escuchar'} aria-label={activo ? 'Parar' : titulo || 'Escuchar'}>
      {activo ? '■' : '▶'}
    </button>
  )
}

/**
 * @param {object} props
 * @param {{ id: string, numero: number, ambientes?: {desde:number,hasta:number,ambiente:string}[]|null }} props.capitulo
 * @param {{ id: string, numero: number, contenido: string, capitulo_id: string, tipo: string }[]} props.parrafos
 * @param {Record<string, any[]>} props.mediaByParrafo
 * @param {{ text: string, parrafoId: string|null, parrafoFinId: string|null }|null} props.seleccion
 * @param {() => void} props.onLimpiarSeleccion
 * @param {(parrafoId: string, mediaId: string, capituloId: string, textoRef: string|null) => Promise<boolean>} props.onVincular
 * @param {(parrafoId: string, mediaId: string, capituloId: string) => Promise<boolean>} props.onQuitar
 * @param {(capituloId: string, tramos: any[]|null) => void} props.onAmbientesGuardados
 * @param {() => void} props.onClose
 */
export default function PanelSonidosEscritor({
  capitulo, parrafos = [], mediaByParrafo = {}, seleccion, onLimpiarSeleccion,
  onVincular, onQuitar, onAmbientesGuardados, onClose,
}) {
  const [tab, setTab] = useState('efectos')
  const { sonando, tocar, parar } = useReproductor()
  useEffect(() => { parar() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className="esn-panel" aria-label="Sonidos del capítulo">
      <div className="esn-cab">
        <div>
          <h2>Sonidos · Capítulo {capitulo?.numero ?? ''}</h2>
          <small>Se guarda al momento · gratis</small>
        </div>
        <button type="button" className="esn-cerrar" onClick={onClose} aria-label="Cerrar">×</button>
      </div>
      <div className="esn-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'efectos'} className={tab === 'efectos' ? 'on' : ''} onClick={() => setTab('efectos')}>Efectos</button>
        <button type="button" role="tab" aria-selected={tab === 'ambientes'} className={tab === 'ambientes' ? 'on' : ''} onClick={() => setTab('ambientes')}>Ambientes</button>
      </div>
      <div className="esn-cuerpo">
        {tab === 'efectos'
          ? <Efectos {...{ capitulo, parrafos, mediaByParrafo, seleccion, onLimpiarSeleccion, onVincular, onQuitar, sonando, tocar }} />
          : <Ambientes {...{ capitulo, parrafos, onAmbientesGuardados, sonando, tocar }} />}
      </div>
    </aside>
  )
}

// ── Efectos ──────────────────────────────────────────────────

function Efectos({ capitulo, parrafos, mediaByParrafo, seleccion, onLimpiarSeleccion, onVincular, onQuitar, sonando, tocar }) {
  const { data: audios = [], isLoading, isError } = useAudiosBiblioteca()
  const [busqueda, setBusqueda] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')

  // De la selección: el párrafo y la frase. Si cruza párrafos, no vale.
  const destino = useMemo(() => {
    if (!seleccion?.parrafoId) return null
    if (seleccion.parrafoFinId && seleccion.parrafoFinId !== seleccion.parrafoId) return { error: 'varios' }
    const p = parrafos.find(x => x.id === seleccion.parrafoId)
    if (!p) return null
    const seleccionada = seleccion.text.replace(/\s+/g, ' ').trim()
    const entera = fraseEnteras(p.contenido || '', seleccionada)
    const textoRef = entera ? entera.slice(0, 500) : null
    return { parrafo: p, frase: entera || seleccionada, textoRef }
  }, [seleccion, parrafos])

  useEffect(() => { setAviso('') }, [seleccion])

  const efectos = useMemo(() => parrafos.flatMap(p =>
    (mediaByParrafo[p.id] || [])
      .filter(m => m.tipo === 'audio' && m.origen === 'explicito')
      .map(m => ({ parrafo: p, media: m }))), [parrafos, mediaByParrafo])

  const resultados = useMemo(() => {
    const q = normalizarBusqueda(busqueda.trim())
    const lista = !q ? audios : audios.filter(a =>
      normalizarBusqueda(a.titulo).includes(q) || normalizarBusqueda(a.slug).includes(q)
      || (a.tags || []).some(t => normalizarBusqueda(t).includes(q)))
    return { total: lista.length, visibles: lista.slice(0, MAX_RESULTADOS) }
  }, [audios, busqueda])

  const vincular = async (audio) => {
    if (!destino?.parrafo || ocupado) return
    setOcupado(true)
    const ok = await onVincular(destino.parrafo.id, audio.id, destino.parrafo.capitulo_id || capitulo.id, destino.textoRef)
    setOcupado(false)
    if (ok) { onLimpiarSeleccion(); window.getSelection()?.removeAllRanges() }
    else setAviso('No pudimos poner el sonido. Inténtalo de nuevo.')
  }

  const quitar = async ({ parrafo, media }) => {
    setOcupado(true)
    const ok = await onQuitar(parrafo.id, media.media_id, parrafo.capitulo_id || capitulo.id)
    setOcupado(false)
    if (!ok) setAviso('No pudimos quitar el sonido. Inténtalo de nuevo.')
  }

  return (
    <>
      <div className={'esn-aviso' + (destino?.parrafo ? ' listo' : '')}>
        {!destino ? (
          <p><b>Selecciona en el libro</b> (subraya con el ratón) el trozo de texto donde quieras el sonido. Luego elige el sonido abajo.</p>
        ) : destino.error ? (
          <p>Selecciona dentro de <b>un solo párrafo</b>.</p>
        ) : (
          <>
            <div className="esn-destino">
              <span>Párrafo {destino.parrafo.numero}</span>
              <button type="button" onClick={onLimpiarSeleccion} aria-label="Quitar selección">×</button>
            </div>
            <q>{destino.frase.length > 120 ? destino.frase.slice(0, 120) + '…' : destino.frase}</q>
            {!destino.textoRef && <small>El sonido irá en todo el párrafo.</small>}
          </>
        )}
      </div>
      {aviso && <p className="esn-error">{aviso}</p>}

      <h3>En este capítulo <span>({efectos.length})</span></h3>
      {efectos.length === 0 ? (
        <p className="esn-vacio">Todavía no hay efectos en este capítulo.</p>
      ) : (
        <ul className="esn-lista">
          {efectos.map((e) => {
            const clave = `ef-${e.parrafo.id}-${e.media.media_id}`
            return (
              <li key={clave}>
                <BotonPlay activo={sonando === clave} onClick={() => tocar(clave, e.media.url)} />
                <div className="esn-info">
                  <b>{e.media.titulo || e.media.slug}</b>
                  <small>párr. {e.parrafo.numero}{e.media.metadata?.texto_ref ? ` · «${e.media.metadata.texto_ref.slice(0, 40)}${e.media.metadata.texto_ref.length > 40 ? '…' : ''}»` : ''}</small>
                </div>
                <button type="button" className="esn-quitar" disabled={ocupado} onClick={() => quitar(e)}>Quitar</button>
              </li>
            )
          })}
        </ul>
      )}

      <h3>Biblioteca de sonidos <span>({audios.length.toLocaleString('es')})</span></h3>
      <input className="esn-buscar" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar: puerta, trueno, pasos…" aria-label="Buscar sonido" />
      {isLoading ? (
        <p className="esn-vacio">Cargando la biblioteca…</p>
      ) : isError ? (
        <p className="esn-error">No pudimos cargar la biblioteca. Revisa tu conexión.</p>
      ) : resultados.total === 0 ? (
        <p className="esn-vacio">Ningún sonido con «{busqueda}». Prueba con otra palabra.</p>
      ) : (
        <>
          <ul className="esn-lista">
            {resultados.visibles.map(a => {
              const clave = `bib-${a.id}`
              return (
                <li key={a.id}>
                  <BotonPlay activo={sonando === clave} onClick={() => tocar(clave, a.url)} />
                  <div className="esn-info"><b>{a.titulo || a.slug.replace(/_/g, ' ')}</b></div>
                  <button type="button" className="esn-vincular" disabled={!destino?.parrafo || ocupado}
                    title={destino?.parrafo ? 'Poner este sonido en el trozo seleccionado' : 'Primero selecciona un trozo del texto'}
                    onClick={() => vincular(a)}>Vincular</button>
                </li>
              )
            })}
          </ul>
          {resultados.total > MAX_RESULTADOS && (
            <p className="esn-vacio">Se ven {MAX_RESULTADOS} de {resultados.total.toLocaleString('es')}. Escribe para buscar.</p>
          )}
        </>
      )}
    </>
  )
}

// ── Ambientes ────────────────────────────────────────────────

function Ambientes({ capitulo, parrafos, onAmbientesGuardados, sonando, tocar }) {
  const guardar = useGuardarAmbientes()
  const numeros = useMemo(() => parrafos.filter(p => p.tipo !== 'separador').map(p => p.numero), [parrafos])
  const primero = numeros[0] ?? 1
  const ultimo = numeros[numeros.length - 1] ?? 1
  const tramos = useMemo(() => capitulo?.ambientes || [], [capitulo?.ambientes])
  const [desde, setDesde] = useState(primero)
  const [hasta, setHasta] = useState(ultimo)
  const [elegido, setElegido] = useState(null)
  const [error, setError] = useState('')

  // Al cambiar de capítulo, el formulario vuelve a «todo el capítulo».
  useEffect(() => { setDesde(primero); setHasta(ultimo); setElegido(null); setError('') }, [capitulo?.id, primero, ultimo])

  const guardarTramos = async (nuevos) => {
    setError('')
    try {
      const r = await guardar.mutateAsync({ capituloId: capitulo.id, tramos: nuevos })
      onAmbientesGuardados(capitulo.id, r)
      return true
    } catch (e) {
      setError(mensajeErrorAmbientes(e))
      return false
    }
  }

  const agregar = async () => {
    if (!elegido) return
    if (desde > hasta) { setError('«Desde» no puede ser mayor que «hasta».'); return }
    const pisa = tramos.find(t => desde <= t.hasta && hasta >= t.desde)
    if (pisa) { setError(`Se pisa con «${nombreAmbiente(pisa.ambiente)}» (párrafos ${pisa.desde}–${pisa.hasta}). Quítalo primero o elige otros párrafos.`); return }
    const ok = await guardarTramos([...tramos, { desde, hasta, ambiente: elegido }].sort((a, b) => a.desde - b.desde))
    if (ok) setElegido(null)
  }

  const continuos = LISTA_AMBIENTES.filter(a => a.tipo === 'bucle')
  const deVezEnCuando = LISTA_AMBIENTES.filter(a => a.tipo !== 'bucle')

  const opcion = (a) => {
    const clave = `amb-${a.slug}`
    return (
      <li key={a.slug} className={elegido === a.slug ? 'on' : ''}>
        <BotonPlay activo={sonando === clave} onClick={() => tocar(clave, urlMuestraAmbiente(a.slug))}
          titulo={a.tipo === 'bucle' ? 'Escuchar' : 'Escuchar uno de sus sonidos'} />
        <button type="button" className="esn-elegir" aria-pressed={elegido === a.slug} onClick={() => setElegido(a.slug)}>
          {a.nombre}
        </button>
      </li>
    )
  }

  return (
    <>
      <div className="esn-explica">
        <p>Un ambiente es el fondo de un lugar. Suena mientras se leen los párrafos que elijas, y cada lector decide el volumen (empieza apagado).</p>
        <p><b>Continuos:</b> suenan todo el rato, como la lluvia, el mar o un tren en marcha.</p>
        <p><b>De vez en cuando:</b> silencio y, cada medio minuto o minuto, un sonido suelto del lugar: un pájaro, unos pasos, una taza. Al escucharlos aquí oyes uno de esos sonidos.</p>
      </div>

      <h3>En este capítulo <span>({tramos.length})</span></h3>
      {tramos.length === 0 ? (
        <p className="esn-vacio">Este capítulo no tiene ambiente.</p>
      ) : (
        <ul className="esn-lista">
          {tramos.map(t => {
            const clave = `tr-${t.desde}`
            return (
              <li key={t.desde}>
                <BotonPlay activo={sonando === clave} onClick={() => tocar(clave, urlMuestraAmbiente(t.ambiente))} />
                <div className="esn-info">
                  <b>{nombreAmbiente(t.ambiente)}</b>
                  <small>párrafos {t.desde}–{t.hasta}</small>
                </div>
                <button type="button" className="esn-quitar" disabled={guardar.isPending}
                  onClick={() => guardarTramos(tramos.filter(x => x !== t))}>Quitar</button>
              </li>
            )
          })}
        </ul>
      )}

      <h3>Añadir un ambiente</h3>
      <div className="esn-tramo">
        <label>Desde el párrafo
          <select value={desde} onChange={(e) => setDesde(Number(e.target.value))}>
            {numeros.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>hasta el
          <select value={hasta} onChange={(e) => setHasta(Number(e.target.value))}>
            {numeros.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <h4>Continuos</h4>
      <ul className="esn-lista esn-ambientes">{continuos.map(opcion)}</ul>
      <h4>De vez en cuando</h4>
      <ul className="esn-lista esn-ambientes">{deVezEnCuando.map(opcion)}</ul>
      {error && <p className="esn-error">{error}</p>}
      <div className="esn-pie">
        <button type="button" className="esn-agregar" disabled={!elegido || guardar.isPending} onClick={agregar}>
          {guardar.isPending ? 'Guardando…'
            : elegido ? `Poner «${nombreAmbiente(elegido)}» en párrafos ${desde}–${hasta}` : 'Elige un ambiente'}
        </button>
      </div>
    </>
  )
}
