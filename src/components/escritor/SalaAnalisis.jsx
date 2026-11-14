// Sala de análisis (maqueta, pantalla 7; fondo = despacho de detective).
// Fase 4 (migración 111):
//   · «Generar la cartelera» (5 $, como los otros análisis): el PC corre extraer_cartelera.py
//     (ficción) o extraer_cartelera_noficcion.py y la deja en el libro.
//     Volver a generarla REEMPLAZA la anterior, cambios del autor incluidos.
//   · Editor: el escritor cambia todo (decisión de Juan, 12 nov: los
//     spoilers que escriba él son cosa suya). Solo por RPC: el navegador
//     no escribe la tabla.
//       - Personajes y lugares = fichas: nombre, alias, foto (las guardadas
//         en la Sala de imágenes se pegan solas por nombre) y lo que se sabe
//         capítulo a capítulo (una fila por capítulo).
//       - Hechos y resumen: los del capítulo elegido en la tira.
//       - Datos, glosario y referencias: cada uno «desde» un capítulo.
//   · La tira de capítulos = «lo que sabe el lector al terminar el capítulo N»:
//     marca lo que todavía no ve.
//   · «Ver en la cartelera»: abre la cartelera de la app tal como la ve un
//     lector que terminó el capítulo elegido en la tira (state.vistaAutor).
//   · «Portada del tablero» (solo ficción, 112): la imagen principal de los
//     paneles Personajes, Lugares y Hechos, de las guardadas en Imágenes.
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queries.js'
import {
  usePreciosEscritor, useTrabajo, usePedirTrabajo, useImagenesLibro, useCapitulosLibro,
  useCarteleraEscritor, useEditarCartelera, mensajeErrorEscritor,
  useCarteleraPrincipalEscritor, useImagenPrincipal,
} from '../../hooks/useEscritor.js'
import { EnMarcha } from './Ilustraciones.jsx'

const dinero = (n) => `${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
const EN_MARCHA = ['pendiente', 'en_proceso']

const SECCIONES_FIC = [
  { id: 'personajes', label: 'Personajes', ficha: true, nuevo: 'Nuevo personaje', explica: 'Quién es cada uno y cómo cambia a lo largo del libro.' },
  { id: 'lugares', label: 'Lugares', ficha: true, nuevo: 'Nuevo lugar', explica: 'Dónde ocurre la historia y qué pasa en cada sitio.' },
  { id: 'hechos', label: 'Hechos', porCapitulo: true, nuevo: 'Agregar hecho', explica: 'Lo que sucede en cada capítulo, en pocas líneas.' },
  { id: 'datos', label: 'Datos', nuevo: 'Nuevo dato', explica: 'Objetos, épocas, palabras o costumbres que conviene saber.' },
]
const SECCIONES_NOF = [
  { id: 'glosario', label: 'Glosario', nuevo: 'Nuevo término', explica: 'Los términos clave, explicados en llano.' },
  { id: 'datos', label: 'Datos', nuevo: 'Nuevo dato', explica: 'Cifras, hechos, personas y fechas importantes.' },
  { id: 'referencias', label: 'Referencias', nuevo: 'Nueva referencia', explica: 'Libros, autores y estudios que cita.' },
  { id: 'resumen', label: 'Resumen', porCapitulo: true, nuevo: 'Agregar resumen', explica: 'Lo esencial de cada capítulo.' },
]

/**
 * @param {object} props
 * @param {{ id: string }} props.user
 * @param {{ id: string, titulo: string, capitulos: number, es_ficcion: boolean }} props.libro
 * @param {number} props.saldo
 * @param {() => void} props.onVolver
 */
export default function SalaAnalisis({ user, libro, saldo, onVolver }) {
  const qc = useQueryClient()
  const { data: precios } = usePreciosEscritor()
  const { data: trabajo } = useTrabajo(libro.id, 'cartelera')
  const { data: filas = [], isLoading } = useCarteleraEscritor(libro.id)
  const pedir = usePedirTrabajo(user?.id, libro.id, 'cartelera')
  const [error, setError] = useState('')

  const estado = trabajo?.estado
  const enMarcha = EN_MARCHA.includes(estado)
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['carteleraEscritor', libro.id] })
    qc.invalidateQueries({ queryKey: ['imagenesLibro', libro.id] })
    qc.invalidateQueries({ queryKey: queryKeys.escritor(user?.id) })
  }, [estado, trabajo?.id, qc, libro.id, user?.id])

  const secciones = libro.es_ficcion ? SECCIONES_FIC : SECCIONES_NOF
  const precio = Number(precios?.cartelera ?? 0)
  const hay = filas.length > 0

  const generar = async () => {
    setError('')
    if (hay && !window.confirm('Volver a generar la cartelera la reemplaza entera, también lo que cambiaste a mano. ¿Seguir?')) return
    try { await pedir.mutateAsync({}) } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos pedirlo. Inténtalo de nuevo.')) }
  }

  const botonGenerar = (
    <button type="button" className={'esc-pill ' + (hay ? 'esc-plana esc-chica' : 'esc-naranja')} onClick={generar}
      disabled={enMarcha || pedir.isPending || saldo < precio}>
      {pedir.isPending ? 'Pidiendo…' : `${hay ? 'Volver a generar' : 'Generar la cartelera'} · ${dinero(precio)}`}
    </button>
  )

  return (
    <div className="esc-estudio esc-despacho">
      <div className="esc-estudio-in esc-una-col">
        <div>
          <button type="button" className="esc-volver" onClick={onVolver}>← Volver al estudio</button>
          <h1>Sala de análisis</h1>
          <p className="esc-estudio-sub">{libro.titulo} · {libro.capitulos} capítulos</p>

          {!hay && !isLoading && (
            <section className="esc-vidrio">
              <h2>La cartelera de tu libro</h2>
              <p>{libro.es_ficcion
                ? 'Es el tablero de investigación que acompaña al lector: quién es quién, dónde pasa cada cosa, qué ha ocurrido y datos útiles.'
                : 'Es el cuaderno de estudio que acompaña al lector: los términos clave, los datos, lo que cita el libro y lo esencial de cada capítulo.'}
              {' '}<b>Se va revelando capítulo a capítulo</b>, así que nadie se encuentra algo que todavía no ha leído.</p>
              <div className="esc-an-secs">
                {secciones.map(s => <div key={s.id}><b>{s.label}</b><span>{s.explica}</span></div>)}
              </div>
              <p>Leemos tu libro entero y te lo dejamos hecho. Después lo revisas y cambias lo que quieras.</p>
              <div className="esc-pie-tab">
                <span className="esc-gris">Cartelera completa · {dinero(precio)} · {saldo >= precio ? 'la cubre tu cupón' : 'tu cupón no alcanza'}.
                  {libro.es_ficcion && ' Si ya guardaste imágenes de personajes o lugares, se ponen solas en sus fichas.'}</span>
                {botonGenerar}
              </div>
              {enMarcha && <EnMarcha trabajo={trabajo} texto="Leyendo tu libro" />}
              {estado === 'error' && <div className="esc-alerta esc-error"><span>⚠️</span><span>{trabajo.error}</span></div>}
              {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
            </section>
          )}

          {hay && (
            <>
              {enMarcha && <EnMarcha trabajo={trabajo} texto="Rehaciendo tu cartelera" />}
              {estado === 'error' && <div className="esc-alerta esc-error"><span>⚠️</span><span>{trabajo.error}</span></div>}
              {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
              <Editor user={user} libro={libro} filas={filas} secciones={secciones} botonGenerar={botonGenerar} bloqueado={enMarcha} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Editor ────────────────────────────────────────────────────

function Editor({ libro, filas, secciones, botonGenerar, bloqueado }) {
  const { data: capitulos = [] } = useCapitulosLibro(libro.id)
  const [secId, setSecId] = useState(secciones[0].id)
  const location = useLocation()
  const [cap, setCap] = useState(() => location.state?.cap ?? 1)
  const sec = secciones.find(s => s.id === secId) || secciones[0]
  const navigate = useNavigate()
  // Al volver (atrás), el estudio reabre esta sala con este libro.
  const verEnCartelera = () => {
    navigate('/escritor', { replace: true, state: { sala: 'analisis', libroId: libro.id, cap } })
    navigate(`/investigacion/${libro.slug}`, { state: { vistaAutor: { cap } } })
  }
  const deSeccion = filas.filter(f => f.seccion === sec.id)
  const cuenta = (id) => {
    const fs = filas.filter(f => f.seccion === id)
    return secciones.find(s => s.id === id)?.ficha ? new Set(fs.map(f => f.nombre)).size : fs.length
  }

  return (
    <section className="esc-vidrio esc-an-editor">
      <div className="esc-an-cab">
        <div className="esc-tabs-img" role="tablist">
          {secciones.map(s => (
            <button key={s.id} type="button" role="tab" aria-selected={s.id === sec.id} className={s.id === sec.id ? 'on' : ''}
              onClick={() => setSecId(s.id)}>{s.label} <small>{cuenta(s.id)}</small></button>
          ))}
          {libro.es_ficcion && (
            <button type="button" role="tab" aria-selected={secId === 'portada'} className={secId === 'portada' ? 'on' : ''}
              onClick={() => setSecId('portada')}>Portada del tablero</button>
          )}
        </div>
        <span className="esc-hueco" />
        <button type="button" className="esc-pill esc-naranja esc-chica" onClick={verEnCartelera}
          title={`Como la ve un lector que terminó el capítulo ${cap}`}>Ver en la cartelera</button>
        {botonGenerar}
      </div>
      {secId === 'portada' ? <PortadaTablero libro={libro} bloqueado={bloqueado} /> : <>
      <div className="esc-caps-tira">
        <span>Lo que sabe el lector al terminar el capítulo</span>
        <div>
          {capitulos.map(c => (
            <button key={c.numero} type="button" className={c.numero === cap ? 'on' : ''} title={c.titulo || ''}
              onClick={() => setCap(c.numero)}>{c.numero}</button>
          ))}
        </div>
      </div>
      <p className="esc-letra">{sec.explica}</p>
      {sec.ficha
        ? <Fichas key={sec.id} libro={libro} sec={sec} filas={deSeccion} cap={cap} capitulos={capitulos} bloqueado={bloqueado} />
        : <Lista key={sec.id} libro={libro} sec={sec} filas={deSeccion} cap={cap} capitulos={capitulos} bloqueado={bloqueado} />}
      </>}
    </section>
  )
}

function useAccion() {
  const [error, setError] = useState('')
  const hacer = async (fn, params) => {
    setError('')
    try { await fn.mutateAsync(params); return true } catch (e) {
      setError(mensajeErrorEscritor(e, 'No pudimos guardarlo. Inténtalo de nuevo.'))
      return false
    }
  }
  return [error, hacer]
}

function SelectCapitulo({ value, onChange, capitulos, disabled }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled}>
      {capitulos.map(c => <option key={c.numero} value={c.numero}>Capítulo {c.numero}</option>)}
    </select>
  )
}

// ── Personajes y lugares ──────────────────────────────────────

function Fichas({ libro, sec, filas, cap, capitulos, bloqueado }) {
  const fichas = useMemo(() => {
    const m = new Map()
    for (const f of filas) {
      if (!m.has(f.nombre)) m.set(f.nombre, { nombre: f.nombre, filas: [], desde: f.capitulo_numero, imagen: null, aliases: [] })
      const x = m.get(f.nombre)
      x.filas.push(f)
      x.desde = Math.min(x.desde, f.capitulo_numero)
      x.imagen ??= f.imagen?.url || null
      if (Array.isArray(f.metadata?.aliases)) x.aliases = f.metadata.aliases
    }
    return [...m.values()].sort((a, b) => a.desde - b.desde || a.nombre.localeCompare(b.nombre))
  }, [filas])
  const [elegido, setElegido] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [nueva, setNueva] = useState(false)
  const ficha = fichas.find(f => f.nombre === elegido) || (nueva ? null : fichas[0])
  const visibles = fichas.filter(f => !buscar.trim() || f.nombre.toLowerCase().includes(buscar.trim().toLowerCase()))

  return (
    <div className="esc-cuaderno">
      <div className="esc-indice">
        <input className="esc-buscar" placeholder={`Buscar en ${sec.label.toLowerCase()}`} value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        {visibles.map(f => (
          <button key={f.nombre} type="button" className={'esc-it' + (ficha?.nombre === f.nombre && !nueva ? ' on' : '') + (f.desde > cap ? ' oculto' : '')}
            onClick={() => { setElegido(f.nombre); setNueva(false) }}>
            <b>{f.nombre}</b><small>desde cap. {f.desde}{f.desde > cap ? ` · aún no visible en el cap. ${cap}` : ''}</small>
          </button>
        ))}
        <button type="button" className="esc-nuevo-it" disabled={bloqueado} onClick={() => setNueva(true)}>＋ {sec.nuevo}</button>
      </div>
      {nueva
        ? <FichaNueva libro={libro} sec={sec} cap={cap} capitulos={capitulos} onListo={(n) => { setNueva(false); if (n) setElegido(n) }} />
        : ficha && <Ficha key={ficha.nombre} libro={libro} sec={sec} ficha={ficha} cap={cap} capitulos={capitulos} bloqueado={bloqueado}
          onRenombrada={setElegido} />}
    </div>
  )
}

function FichaNueva({ libro, sec, cap, capitulos, onListo }) {
  const guardar = useEditarCartelera(libro.id, 'guardar_item_cartelera')
  const [nombre, setNombre] = useState('')
  const [desc, setDesc] = useState('')
  const [desde, setDesde] = useState(cap)
  const [error, hacer] = useAccion()
  const enviar = async () => {
    const ok = await hacer(guardar, { p_id: null, p_seccion: sec.id, p_capitulo: desde, p_nombre: nombre.trim(), p_descripcion: desc.trim() })
    if (ok) onListo(nombre.trim())
  }
  return (
    <div className="esc-ficha-ed">
      <h3>{sec.nuevo}</h3>
      <label className="esc-campo-an">Nombre<input value={nombre} maxLength={200} onChange={(e) => setNombre(e.target.value)} /></label>
      <label className="esc-campo-an">Aparece desde<SelectCapitulo value={desde} onChange={setDesde} capitulos={capitulos} /></label>
      <label className="esc-campo-an">Lo que se sabe en ese capítulo<textarea rows={3} maxLength={3000} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      {error && <p className="esc-falta esc-letra">{error}</p>}
      <div className="esc-fila-botones">
        <span className="esc-hueco" />
        <button type="button" className="esc-pill esc-plana esc-chica" onClick={() => onListo(null)}>Cancelar</button>
        <button type="button" className="esc-pill esc-naranja esc-chica" disabled={!nombre.trim() || guardar.isPending} onClick={enviar}>Crear</button>
      </div>
    </div>
  )
}

function Ficha({ libro, sec, ficha, cap, capitulos, bloqueado, onRenombrada }) {
  const renombrar = useEditarCartelera(libro.id, 'renombrar_ficha_cartelera')
  const borrarFicha = useEditarCartelera(libro.id, 'borrar_ficha_cartelera')
  const guardar = useEditarCartelera(libro.id, 'guardar_item_cartelera')
  const ponerFoto = useEditarCartelera(libro.id, 'imagen_ficha_cartelera')
  const [nombre, setNombre] = useState(ficha.nombre)
  const [alias, setAlias] = useState(ficha.aliases.join(', '))
  const [elegirFoto, setElegirFoto] = useState(false)
  const [otroCap, setOtroCap] = useState(null)   // capítulo de la entrada nueva
  const [otroTxt, setOtroTxt] = useState('')
  const [error, hacer] = useAccion()
  const filas = [...ficha.filas].sort((a, b) => a.capitulo_numero - b.capitulo_numero)
  const actual = [...filas].reverse().find(f => f.capitulo_numero <= cap)
  const libres = capitulos.filter(c => !filas.some(f => f.capitulo_numero === c.numero))
  const aliasLista = alias.split(',').map(a => a.trim()).filter(Boolean)
  const cambioNombre = nombre.trim() !== ficha.nombre || aliasLista.join('|') !== ficha.aliases.join('|')

  const guardarNombre = async () => {
    const ok = await hacer(renombrar, { p_seccion: sec.id, p_nombre: ficha.nombre, p_nuevo: nombre.trim(), p_aliases: aliasLista })
    if (ok) onRenombrada(nombre.trim())
  }
  const agregar = async () => {
    const ok = await hacer(guardar, { p_id: null, p_seccion: sec.id, p_capitulo: otroCap, p_nombre: ficha.nombre, p_descripcion: otroTxt.trim() })
    if (ok) { setOtroCap(null); setOtroTxt('') }
  }

  return (
    <div className="esc-ficha-ed">
      <div className="esc-ficha-top">
        <figure className="esc-polaroid">
          {ficha.imagen ? <img src={ficha.imagen} alt={ficha.nombre} /> : <div className="esc-polaroid-vacia">Sin imagen</div>}
          <button type="button" className="esc-borrar" disabled={bloqueado} onClick={() => setElegirFoto(true)}>{ficha.imagen ? 'Cambiar imagen' : 'Poner imagen'}</button>
        </figure>
        <div className="esc-ficha-campos">
          <label className="esc-campo-an">Nombre<input value={nombre} maxLength={200} onChange={(e) => setNombre(e.target.value)} disabled={bloqueado} /></label>
          <label className="esc-campo-an">También {sec.id === 'lugares' ? 'se conoce como' : 'lo llaman'} <small>(separados por comas)</small>
            <input value={alias} onChange={(e) => setAlias(e.target.value)} disabled={bloqueado} /></label>
          <div className="esc-fila-botones">
            <button type="button" className="esc-borrar" disabled={bloqueado || borrarFicha.isPending}
              onClick={() => window.confirm(`¿Borrar la ficha de ${ficha.nombre} entera?`) && hacer(borrarFicha, { p_seccion: sec.id, p_nombre: ficha.nombre })}>Borrar ficha</button>
            <span className="esc-hueco" />
            {cambioNombre && <button type="button" className="esc-pill esc-naranja esc-chica" disabled={!nombre.trim() || renombrar.isPending} onClick={guardarNombre}>Guardar nombre</button>}
          </div>
        </div>
      </div>

      <div className="esc-linea-t">Lo que se sabe de {ficha.nombre}, capítulo a capítulo</div>
      <div className="esc-tiempo">
        {filas.map(f => (
          <Entrada key={`${f.id}|${f.nombre}|${f.capitulo_numero}|${f.descripcion}`} libro={libro} sec={sec} fila={f} capitulos={capitulos} bloqueado={bloqueado} etiquetaCap
            nota={f.id === actual?.id ? `Esto es lo último que ve un lector que va por el capítulo ${cap}.`
              : f.capitulo_numero > cap ? `Oculto hasta que el lector termine el capítulo ${f.capitulo_numero}.` : ''}
            clase={f.id === actual?.id ? 'actual' : f.capitulo_numero > cap ? 'futuro' : ''} />
        ))}
        {otroCap == null ? (
          libres.length > 0 && <button type="button" className="esc-nuevo-it" disabled={bloqueado}
            onClick={() => setOtroCap(libres.find(c => c.numero >= cap)?.numero ?? libres[0].numero)}>＋ Agregar lo que se sabe en otro capítulo</button>
        ) : (
          <div className="esc-t-cap">
            <SelectCapitulo value={otroCap} onChange={setOtroCap} capitulos={libres} />
            <textarea rows={2} maxLength={3000} value={otroTxt} onChange={(e) => setOtroTxt(e.target.value)} />
            <div className="esc-fila-botones">
              <span className="esc-hueco" />
              <button type="button" className="esc-pill esc-plana esc-chica" onClick={() => setOtroCap(null)}>Cancelar</button>
              <button type="button" className="esc-pill esc-naranja esc-chica" disabled={!otroTxt.trim() || guardar.isPending} onClick={agregar}>Agregar</button>
            </div>
          </div>
        )}
      </div>
      {error && <p className="esc-falta esc-letra">{error}</p>}
      {elegirFoto && (
        <ElegirFoto libro={libro} titulo={`Imagen de ${ficha.nombre}`} preferido={sec.id === 'personajes' ? 'personaje' : 'lugar'}
          hayImagen={!!ficha.imagen} onCerrar={() => setElegirFoto(false)}
          onElegir={(id) => hacer(ponerFoto, { p_seccion: sec.id, p_nombre: ficha.nombre, p_imagen: id })} />
      )}
    </div>
  )
}

// Elegir una de las imágenes GUARDADAS del libro (Sala de imágenes).
// onElegir(id | null) devuelve true si salió bien.
function ElegirFoto({ libro, titulo, preferido, hayImagen, onElegir, onCerrar }) {
  const { data: imagenes = [] } = useImagenesLibro(libro.id)
  const [ocupado, setOcupado] = useState(false)
  const opciones = imagenes.filter(i => i.estado === 'guardada' && ['personaje', 'lugar', 'escena', 'propia'].includes(i.tipo))
    .sort((a, b) => (b.tipo === preferido) - (a.tipo === preferido))
  const elegir = async (id) => {
    setOcupado(true)
    const ok = await onElegir(id)
    setOcupado(false)
    if (ok) onCerrar()
  }
  return (
    <div className="esc-visor" role="dialog" aria-modal="true" aria-label="Elegir imagen" onClick={onCerrar}>
      <div className="esc-visor-caja" onClick={(e) => e.stopPropagation()}>
        <div className="esc-visor-cab">
          <h3>{titulo}</h3><span>Las que guardaste en la Sala de imágenes.</span>
          <span className="esc-hueco" />
          <button type="button" className="esc-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="esc-elegir-foto">
          {opciones.length === 0 && <p className="esc-gris">Todavía no tienes imágenes guardadas. Hazlas en la Sala de imágenes (Ilustraciones o Mis imágenes).</p>}
          {opciones.map(i => (
            <button key={i.id} type="button" onClick={() => elegir(i.id)} disabled={ocupado}>
              <img src={i.url} alt="" loading="lazy" /><small>{i.nombre || i.pie || (i.capitulo ? `Capítulo ${i.capitulo}` : i.tipo)}</small>
            </button>
          ))}
        </div>
        {hayImagen && (
          <div className="esc-visor-pie">
            <span className="esc-hueco" />
            <button type="button" className="esc-pill esc-plana esc-chica" disabled={ocupado} onClick={() => elegir(null)}>Quitar la imagen</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Portada del tablero (112) ─────────────────────────────────

const PANELES = [
  { id: 'personajes', label: 'Personajes', preferido: 'personaje', explica: 'El retrato del panel de personajes.' },
  { id: 'lugares', label: 'Lugares', preferido: 'lugar', explica: 'El lugar principal de la historia.' },
  { id: 'hechos', label: 'Hechos', preferido: 'escena', explica: 'Una escena que resuma el libro.' },
]

function PortadaTablero({ libro, bloqueado }) {
  const { data: actuales = {} } = useCarteleraPrincipalEscritor(libro.id)
  const poner = useImagenPrincipal(libro.id)
  const [eligiendo, setEligiendo] = useState(null)   // panel
  const [error, setError] = useState('')
  const elegir = async (panel, imagen) => {
    setError('')
    try { await poner.mutateAsync({ seccion: panel.id, imagen }); return true } catch (e) {
      setError(mensajeErrorEscritor(e, 'No pudimos guardarla. Inténtalo de nuevo.'))
      return false
    }
  }
  return (
    <>
      <p className="esc-letra">Cada panel del tablero lleva una imagen grande que se va destapando a medida que el lector avanza. Elige cuál va en cada uno, de las que guardaste en la Sala de imágenes.</p>
      <div className="esc-paneles">
        {PANELES.map(p => (
          <figure key={p.id} className="esc-panel">
            {actuales[p.id] ? <img src={actuales[p.id]} alt={p.label} /> : <div className="esc-polaroid-vacia">Sin imagen</div>}
            <figcaption>
              <b>{p.label}</b><small>{p.explica}</small>
              <button type="button" className="esc-pill esc-chica" disabled={bloqueado} onClick={() => setEligiendo(p)}>
                {actuales[p.id] ? 'Cambiar' : 'Elegir imagen'}</button>
            </figcaption>
          </figure>
        ))}
      </div>
      {error && <p className="esc-falta esc-letra">{error}</p>}
      {eligiendo && (
        <ElegirFoto libro={libro} titulo={`Panel de ${eligiendo.label.toLowerCase()}`} preferido={eligiendo.preferido}
          hayImagen={!!actuales[eligiendo.id]} onElegir={(id) => elegir(eligiendo, id)} onCerrar={() => setEligiendo(null)} />
      )}
    </>
  )
}

// ── Hechos, datos, glosario, referencias, resumen ─────────────

function Lista({ libro, sec, filas, cap, capitulos, bloqueado }) {
  const guardar = useEditarCartelera(libro.id, 'guardar_item_cartelera')
  const [nuevo, setNuevo] = useState(false)
  const [nombre, setNombre] = useState('')
  const [desc, setDesc] = useState('')
  const [error, hacer] = useAccion()
  const lista = sec.porCapitulo ? filas.filter(f => f.capitulo_numero === cap) : filas
  const crear = async () => {
    const ok = await hacer(guardar, { p_id: null, p_seccion: sec.id, p_capitulo: cap, p_nombre: nombre.trim(), p_descripcion: desc.trim() })
    if (ok) { setNuevo(false); setNombre(''); setDesc('') }
  }
  return (
    <div className="esc-hechos">
      {sec.porCapitulo && <p className="esc-letra">{sec.label} del <b>capítulo {cap}</b>. El lector los ve al terminar ese capítulo.</p>}
      {lista.length === 0 && <p className="esc-gris">{sec.porCapitulo ? 'Nada en este capítulo.' : 'Todavía no hay nada aquí.'}</p>}
      {lista.map(f => (
        <Entrada key={`${f.id}|${f.nombre}|${f.capitulo_numero}|${f.descripcion}`} libro={libro} sec={sec} fila={f} capitulos={capitulos} bloqueado={bloqueado} conNombre conCapitulo={!sec.porCapitulo}
          clase={f.capitulo_numero > cap ? 'futuro' : ''}
          nota={!sec.porCapitulo && f.capitulo_numero > cap ? `Aún no visible en el capítulo ${cap}.` : ''} />
      ))}
      {nuevo ? (
        <div className="esc-hecho">
          <div>
            <input placeholder={sec.id === 'glosario' ? 'Término' : 'Título'} value={nombre} maxLength={200} onChange={(e) => setNombre(e.target.value)} />
            <textarea rows={2} maxLength={3000} value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="esc-fila-botones">
              <small className="esc-gris">Va desde el capítulo {cap} (elígelo en la tira de arriba).</small>
              <span className="esc-hueco" />
              <button type="button" className="esc-pill esc-plana esc-chica" onClick={() => setNuevo(false)}>Cancelar</button>
              <button type="button" className="esc-pill esc-naranja esc-chica" disabled={!nombre.trim() || guardar.isPending} onClick={crear}>Agregar</button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="esc-nuevo-it" disabled={bloqueado} onClick={() => setNuevo(true)}>
          ＋ {sec.nuevo}{sec.porCapitulo ? ` al capítulo ${cap}` : ''}</button>
      )}
      {error && <p className="esc-falta esc-letra">{error}</p>}
    </div>
  )
}

// Una fila de la cartelera, editable. Se guarda con su botón (solo aparece si cambió).
function Entrada({ libro, sec, fila, capitulos, bloqueado, conNombre, conCapitulo, etiquetaCap, nota, clase }) {
  const guardar = useEditarCartelera(libro.id, 'guardar_item_cartelera')
  const borrar = useEditarCartelera(libro.id, 'borrar_item_cartelera')
  const [nombre, setNombre] = useState(fila.nombre)
  const [desc, setDesc] = useState(fila.descripcion || '')
  const [capN, setCapN] = useState(fila.capitulo_numero)
  const [error, hacer] = useAccion()
  const cambio = nombre !== fila.nombre || desc !== (fila.descripcion || '') || capN !== fila.capitulo_numero
  const enviar = () => hacer(guardar, { p_id: fila.id, p_seccion: sec.id, p_capitulo: capN, p_nombre: nombre.trim(), p_descripcion: desc.trim() })
  return (
    <div className={(etiquetaCap ? 'esc-t-cap ' : 'esc-hecho ') + (clase || '')}>
      {etiquetaCap && <i>Cap. {fila.capitulo_numero}</i>}
      <div>
        {conNombre && <input value={nombre} maxLength={200} onChange={(e) => setNombre(e.target.value)} disabled={bloqueado} />}
        <textarea rows={2} maxLength={3000} value={desc} onChange={(e) => setDesc(e.target.value)} disabled={bloqueado} />
        <div className="esc-fila-botones">
          {conCapitulo && <label className="esc-desde">Desde <SelectCapitulo value={capN} onChange={setCapN} capitulos={capitulos} disabled={bloqueado} /></label>}
          {nota && <span className="esc-t-nota">{nota}</span>}
          <span className="esc-hueco" />
          <button type="button" className="esc-borrar" disabled={bloqueado || borrar.isPending}
            onClick={() => window.confirm('¿Quitar esta entrada?') && hacer(borrar, { p_id: fila.id })}>Quitar</button>
          {cambio && <button type="button" className="esc-pill esc-naranja esc-chica" disabled={guardar.isPending || !nombre.trim()} onClick={enviar}>Guardar</button>}
        </div>
        {error && <p className="esc-falta esc-letra">{error}</p>}
      </div>
    </div>
  )
}
