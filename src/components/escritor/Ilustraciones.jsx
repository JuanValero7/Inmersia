// Ilustraciones (maqueta, pantalla 6; migración 108). Solo ficción.
//   1 · Estilo: los 9 de analyze.py (ART_STYLES, mismo orden), con
//       ejemplos reales. «Analizar mi libro» (5 $): el PC propone
//       personajes, lugares y una escena por capítulo.
//   2 · Qué dibujar: la lista del autor (109): lo que propuso el análisis o
//       lo que escribió él, todo editable. Marca; 0,50 $ cada imagen que salga.
//       Sin análisis: «Escribirlas yo» abre la lista vacía.
//   3 · Revisar: carrusel con Guardar / Descartar / Rehacer (0,25 $).
//       Guardada, la escena va a su capítulo como polaroid; el personaje o
//       lugar espera a la cartelera (fase 4) para ir a su ficha.
import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queries.js'
import {
  usePreciosEscritor, useTrabajo, usePedirTrabajo, useImagenesLibro,
  useGuardarImagen, useDescartarImagen, mensajeErrorEscritor,
  usePropuestasIlustracion, useGuardarPropuesta, useBorrarPropuesta, useCapitulosLibro,
} from '../../hooks/useEscritor.js'

const dinero = (n) => `${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`

// En el mismo orden que ART_STYLES de analyze.py (el índice es el que se pide).
export const ESTILOS = [
  ['Óleo clásico', 'Tonos dorados, pintura académica del siglo XIX'],
  ['Grabado a plumilla', 'Tinta, tramas finas, como Gustave Doré'],
  ['Acuarela', 'Suave, tierra, de cuento clásico'],
  ['Art Nouveau', 'Líneas curvas y color joya, como Mucha'],
  ['Aventura clásica', 'Óleo y gouache, como N. C. Wyeth'],
  ['Pulp', 'Tinta y color de revista antigua, mucho contraste'],
  ['Arte conceptual', 'Cinematográfico, detallado, épico'],
  ['Expresionista', 'Pinceladas gruesas, color intenso, como Munch'],
  ['Impresionista', 'Luz moteada y textura, como Renoir'],
]
const ejemplo = (i, j) => `/assets/escritor/estilos/e${i}_${j}.webp`
const TIPOS_ILUS = ['personaje', 'lugar', 'escena']
const etiqueta = (img) => (img.tipo === 'escena' ? `Escena · Capítulo ${img.capitulo}` : `${img.tipo === 'personaje' ? 'Personaje' : 'Lugar'} · ${img.nombre}`)
const EN_MARCHA = ['pendiente', 'en_proceso']

export default function Ilustraciones({ user, libro, saldo }) {
  const qc = useQueryClient()
  const { data: precios } = usePreciosEscritor()
  const { data: analisis } = useTrabajo(libro.id, 'ilustraciones_analisis')
  const { data: generacion } = useTrabajo(libro.id, 'ilustraciones')
  const { data: rehacer } = useTrabajo(libro.id, 'rehacer')
  const { data: imagenes = [] } = useImagenesLibro(libro.id)
  const { data: propuestas = [] } = usePropuestasIlustracion(libro.id)

  const ilus = imagenes.filter(i => TIPOS_ILUS.includes(i.tipo))
  const borradores = ilus.filter(i => i.estado === 'borrador')
  const guardadas = ilus.filter(i => i.estado === 'guardada')

  // El estilo vale para todo el libro: el que elija, o el del último análisis
  // o dibujo, o Acuarela.
  const [estiloElegido, setEstilo] = useState(null)
  const estilo = estiloElegido ?? generacion?.parametros?.estilo ?? analisis?.resultado?.estilo ?? analisis?.parametros?.estilo ?? 2

  // Paso 2 abierto si hay propuestas o si el autor decidió escribirlas.
  const [aMano, setAMano] = useState(false)
  const hayLista = propuestas.length > 0 || aMano
  const pasoInicial = borradores.length || EN_MARCHA.includes(generacion?.estado) ? 3 : hayLista ? 2 : 1
  // El paso que elige el escritor manda; si no eligió, el que toca. Cuando un
  // trabajo cambia de estado (análisis listo, imágenes listas), vuelve a
  // mandar el que toca.
  const [pasoElegido, setPaso] = useState(null)
  const paso = pasoElegido ?? pasoInicial
  useEffect(() => { setPaso(null) }, [analisis?.id, analisis?.estado, generacion?.id, generacion?.estado])

  // Al terminar cualquier trabajo: refrescar imágenes, propuestas y saldo.
  const estados = `${analisis?.estado}|${generacion?.estado}|${rehacer?.estado}|${rehacer?.id}`
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['imagenesLibro', libro.id] })
    qc.invalidateQueries({ queryKey: ['propuestasIlustracion', libro.id] })
    qc.invalidateQueries({ queryKey: queryKeys.escritor(user?.id) })
  }, [estados, qc, libro.id, user?.id])

  const clase = (n) => 'esc-paso' + (n < paso ? ' ok' : n === paso ? ' on' : '')
  return (
    <section className="esc-vidrio">
      <div className="esc-pasos esc-pasos-img">
        <button type="button" className={clase(1)} onClick={() => setPaso(1)}>1 · Estilo</button>
        <button type="button" className={clase(2)} disabled={!hayLista} onClick={() => setPaso(2)}>2 · Qué dibujar</button>
        <button type="button" className={clase(3)} disabled={!ilus.length && !EN_MARCHA.includes(generacion?.estado)} onClick={() => setPaso(3)}>3 · Revisar</button>
      </div>
      {paso === 1 && (
        <PasoEstilo {...{ user, libro, saldo, precios, analisis, estilo, setEstilo, hayPropuestas: propuestas.length > 0 }}
          onAMano={() => { setAMano(true); setPaso(2) }} />
      )}
      {paso === 2 && hayLista && (
        <PasoElegir {...{ user, libro, saldo, precios, propuestas, estilo, generacion, ilus }} onCambiarEstilo={() => setPaso(1)} />
      )}
      {paso === 3 && <PasoRevisar {...{ user, libro, saldo, precios, borradores, guardadas, generacion, rehacer }} />}
    </section>
  )
}

// ── 1 · Estilo ────────────────────────────────────────────────

function PasoEstilo({ user, libro, saldo, precios, analisis, estilo, setEstilo, hayPropuestas, onAMano }) {
  const pedir = usePedirTrabajo(user?.id, libro.id, 'ilustraciones_analisis')
  const [error, setError] = useState('')
  const precio = Number(precios?.ilustraciones_analisis ?? 0)
  const enMarcha = EN_MARCHA.includes(analisis?.estado)

  const analizar = async () => {
    setError('')
    if (hayPropuestas && !window.confirm('Volver a analizar reemplaza las propuestas que vinieron del análisis (también las que editaste). Las que escribiste tú se quedan. ¿Seguir?')) return
    try { await pedir.mutateAsync({ estilo }) } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos pedirlo.')) }
  }

  return (
    <>
      <p>Todas las ilustraciones de tu libro van en un mismo estilo, para que se vean como una sola obra. Elige uno:</p>
      <SelectorEstilo estilo={estilo} setEstilo={setEstilo} deshabilitado={enMarcha} />

      <div className="esc-dos-caminos">
        <div>
          <h3>Que lo lea Inmersia</h3>
          <p>Leemos tu libro y te proponemos personajes, lugares y una escena por capítulo, con sus descripciones. Luego puedes cambiar cualquiera.</p>
          <button type="button" className="esc-pill esc-naranja" onClick={analizar} disabled={enMarcha || pedir.isPending || saldo < precio}>
            {enMarcha ? 'Analizando…' : `Analizar mi libro · ${dinero(precio)}`}
          </button>
          {saldo < precio && <p className="esc-letra esc-falta">Tu cupón no alcanza ({dinero(saldo)}).</p>}
        </div>
        <div>
          <h3>Escribirlas yo</h3>
          <p>Describe tú los personajes, lugares y escenas que quieres dibujar. Sin análisis y sin costo hasta que dibujes.</p>
          <button type="button" className="esc-pill" onClick={onAMano} disabled={enMarcha}>
            {hayPropuestas ? 'Ir a mi lista' : 'Escribirlas yo'}</button>
        </div>
      </div>
      {enMarcha && <EnMarcha trabajo={analisis} texto="Leyendo tu libro" />}
      {analisis?.estado === 'error' && <div className="esc-alerta esc-error"><span>⚠️</span><span>{analisis.error}</span></div>}
      {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
    </>
  )
}

/** Los 9 estilos con sus ejemplos (Ilustraciones y Avance de la tienda). */
export function SelectorEstilo({ estilo, setEstilo, deshabilitado = false }) {
  const [visor, setVisor] = useState(null) // índice del estilo abierto
  return (
    <>
      <div className="esc-estilos">
        {ESTILOS.map(([nombre, desc], i) => (
          <div key={nombre} className={'esc-estilo' + (estilo === i ? ' on' : '')}>
            <button type="button" className="esc-mosaico" onClick={() => setVisor(i)} aria-label={`Ver ejemplos de ${nombre}`}>
              <img src={ejemplo(i, 0)} alt="" loading="lazy" /><img src={ejemplo(i, 1)} alt="" loading="lazy" /><img src={ejemplo(i, 2)} alt="" loading="lazy" />
              <span className="esc-ver">Ver 5 ejemplos</span>
            </button>
            <div>
              <b>{nombre}</b><small>{desc}</small>
              <button type="button" className="esc-elegir-est" onClick={() => setEstilo(i)} disabled={deshabilitado}>
                {estilo === i ? 'Elegido' : 'Elegir'}</button>
            </div>
          </div>
        ))}
      </div>
      {visor !== null && (
        <Visor titulo={ESTILOS[visor][0]} subtitulo={ESTILOS[visor][1]}
          imagenes={[0, 1, 2, 3, 4].map(j => ejemplo(visor, j))}
          accion={estilo === visor ? 'Este es tu estilo' : 'Elegir este estilo'}
          onAccion={() => { setEstilo(visor); setVisor(null) }} onCerrar={() => setVisor(null)} />
      )}
    </>
  )
}

// ── 2 · Qué dibujar (la lista del autor, migración 109) ───────

const AVISO_DETALLE = 'Mientras menos detalles pongas, más genérica saldrá la imagen. Cuenta edad, cuerpo, pelo, ropa, rasgos, época, luz, colores…'
const PRINCIPALES = ['protagonist', 'antagonist']

function PasoElegir({ user, libro, saldo, precios, propuestas, estilo, generacion, ilus, onCambiarEstilo }) {
  const pedir = usePedirTrabajo(user?.id, libro.id, 'ilustraciones')
  const { data: capitulos = [] } = useCapitulosLibro(libro.id)
  const [marcados, setMarcados] = useState(() => new Set())
  const [verSecundarios, setVerSecundarios] = useState(false)
  const [todasEscenas, setTodasEscenas] = useState(false)
  const [editando, setEditando] = useState(null) // id de propuesta, o 'nuevo-personaje' | 'nuevo-lugar' | 'nuevo-escena'
  const [error, setError] = useState('')
  const precio = Number(precios?.ilustracion ?? 0)
  const enMarcha = EN_MARCHA.includes(generacion?.estado)

  // Que no queden marcadas propuestas que ya no existen.
  const ids = useMemo(() => new Set(propuestas.map(p => p.id)), [propuestas])
  const marcadosVivos = useMemo(() => new Set([...marcados].filter(id => ids.has(id))), [marcados, ids])

  const yaTiene = useMemo(() => new Set(ilus.map(i => i.propuesta_id).filter(Boolean)), [ilus])
  const alternar = (id) => setMarcados(prev => {
    const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s
  })
  const total = marcadosVivos.size * precio

  const personajes = propuestas.filter(p => p.tipo === 'personaje')
  const principales = personajes.filter(p => PRINCIPALES.includes(p.rol) || p.origen === 'autor')
  const secundarios = personajes.filter(p => !principales.includes(p))
  const lugares = propuestas.filter(p => p.tipo === 'lugar')
  const escenasTodas = propuestas.filter(p => p.tipo === 'escena').sort((a, b) => a.capitulo - b.capitulo)
  const escenas = todasEscenas ? escenasTodas : escenasTodas.slice(0, 8)

  const generar = async () => {
    setError('')
    try { await pedir.mutateAsync({ estilo, items: [...marcadosVivos] }); setMarcados(new Set()) }
    catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos pedirlo.')) }
  }

  const tarjeta = (p) => (editando === p.id ? (
    <FormPropuesta key={p.id} libro={libro} propuesta={p} capitulos={capitulos} onListo={() => setEditando(null)} />
  ) : (
    <div key={p.id} className={'esc-sel' + (marcadosVivos.has(p.id) ? ' on' : '')}>
      <input type="checkbox" checked={marcadosVivos.has(p.id)} onChange={() => alternar(p.id)} disabled={enMarcha}
        aria-label={`Dibujar ${p.nombre || `escena del capítulo ${p.capitulo}`}`} />
      <b>{p.tipo === 'escena' ? `Capítulo ${p.capitulo}` : p.nombre}
        {yaTiene.has(p.id) && <em> · ya tienes una</em>}
        {p.origen === 'autor' ? <em> · tuya</em> : p.editado ? <em> · editada</em> : null}</b>
      <span>{p.descripcion}</span>
      <button type="button" className="esc-editar" onClick={() => setEditando(p.id)} disabled={enMarcha}>Editar</button>
    </div>
  ))

  const botonNuevo = (tipo, texto) => (editando === `nuevo-${tipo}`
    ? <FormPropuesta libro={libro} tipo={tipo} capitulos={capitulos} onListo={() => setEditando(null)} />
    : <button type="button" className="esc-anadir" onClick={() => setEditando(`nuevo-${tipo}`)} disabled={enMarcha}>＋ {texto}</button>)

  return (
    <>
      <p>
        Marca lo que quieras dibujar. Puedes <b>editar</b> cualquier descripción o <b>añadir</b> las tuyas: se dibuja con lo que diga aquí.
        {' '}Estilo: <b>{ESTILOS[estilo]?.[0]}</b> <button type="button" className="esc-borrar" onClick={onCambiarEstilo}>cambiar</button>
      </p>

      <div className="esc-grupo-sel">
        <h3>Personajes <small>retrato de cuerpo entero</small></h3>
        <div className="esc-sel-grid">
          {principales.map(tarjeta)}
          {verSecundarios && secundarios.map(tarjeta)}
        </div>
        {secundarios.length > 0 && (
          <button type="button" className="esc-borrar" onClick={() => setVerSecundarios(v => !v)}>
            {verSecundarios ? 'Ocultar los secundarios' : `Ver ${secundarios.length} personajes secundarios`}</button>
        )}
        {botonNuevo('personaje', 'Añadir personaje')}
      </div>

      <div className="esc-grupo-sel">
        <h3>Lugares <small>vista general</small></h3>
        <div className="esc-sel-grid">{lugares.map(tarjeta)}</div>
        {botonNuevo('lugar', 'Añadir lugar')}
      </div>

      <div className="esc-grupo-sel">
        <h3>Escenas <small>las que salen en el lector, en su capítulo</small></h3>
        <div className="esc-sel-grid">{escenas.map(tarjeta)}</div>
        {escenasTodas.length > 8 && !todasEscenas && (
          <button type="button" className="esc-borrar" onClick={() => setTodasEscenas(true)}>Ver las {escenasTodas.length} escenas</button>
        )}
        {botonNuevo('escena', 'Añadir escena')}
      </div>

      <div className="esc-pie-tab">
        <table className="esc-cuenta esc-cuenta-mini"><tbody>
          <tr><td>{marcadosVivos.size} {marcadosVivos.size === 1 ? 'imagen' : 'imágenes'} <span className="esc-gris">× {dinero(precio)}</span></td><td>{dinero(total)}</td></tr>
          <tr className="esc-cupon"><td>Cupón de bienvenida</td><td>−{dinero(Math.min(total, saldo))}</td></tr>
          <tr className="esc-total"><td>Pagas hoy</td><td>{dinero(Math.max(0, total - saldo))}</td></tr>
        </tbody></table>
        <button type="button" className="esc-pill esc-naranja" onClick={generar}
          disabled={!marcadosVivos.size || enMarcha || pedir.isPending || total > saldo}>
          {enMarcha ? 'Dibujando…' : `Generar ${marcadosVivos.size || ''} ${marcadosVivos.size === 1 ? 'imagen' : 'imágenes'}`}
        </button>
      </div>
      <p className="esc-letra">Solo se cobran las que salgan. En las escenas también usamos la descripción de los personajes y lugares que nombres, para que se parezcan. Las verás en «Revisar» para guardarlas, descartarlas o rehacerlas.</p>
      {total > saldo && <p className="esc-letra esc-falta">Tu cupón no alcanza ({dinero(saldo)}). Marca menos.</p>}
      {enMarcha && <EnMarcha trabajo={generacion} texto="Dibujando" />}
      {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
    </>
  )
}

/** Crear o editar una propuesta (personaje, lugar o escena). */
function FormPropuesta({ libro, propuesta, tipo: tipoNuevo, capitulos, onListo }) {
  const tipo = propuesta?.tipo || tipoNuevo
  const guardar = useGuardarPropuesta(libro.id)
  const borrar = useBorrarPropuesta(libro.id)
  const [nombre, setNombre] = useState(propuesta?.nombre || '')
  const [capitulo, setCapitulo] = useState(propuesta?.capitulo ?? capitulos[0]?.numero ?? 1)
  const [descripcion, setDescripcion] = useState(propuesta?.descripcion || '')
  const [error, setError] = useState('')

  const enviar = async () => {
    setError('')
    try {
      await guardar.mutateAsync({ id: propuesta?.id || null, tipo, nombre, capitulo, descripcion })
      onListo()
    } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos guardarla.')) }
  }
  const quitar = async () => {
    if (!window.confirm('¿Quitar esta propuesta de la lista? Las imágenes que ya hiciste con ella se quedan.')) return
    try { await borrar.mutateAsync(propuesta.id); onListo() } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos quitarla.')) }
  }

  return (
    <div className="esc-form-prop">
      {tipo === 'escena' ? (
        <label>Capítulo
          <select value={capitulo} onChange={(e) => setCapitulo(Number(e.target.value))}>
            {capitulos.map(c => <option key={c.numero} value={c.numero}>Capítulo {c.numero}</option>)}
          </select>
        </label>
      ) : (
        <label>{tipo === 'personaje' ? 'Nombre del personaje' : 'Nombre del lugar'}
          <input value={nombre} maxLength={160} onChange={(e) => setNombre(e.target.value)} />
        </label>
      )}
      <label>{tipo === 'escena' ? 'Qué pasa en la escena' : 'Cómo es'}
        <textarea rows={3} maxLength={1000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          placeholder={tipo === 'personaje' ? 'Por ejemplo: mujer de unos 30 años, delgada, pelo negro recogido, abrigo de lana gris…'
            : tipo === 'lugar' ? 'Por ejemplo: faro blanco sobre rocas negras, mar gris, cielo de tormenta…'
              : 'Por ejemplo: Elena baja corriendo la escalera del faro con una linterna, de noche…'} />
      </label>
      <p className="esc-aviso-detalle">💡 {AVISO_DETALLE}</p>
      {error && <p className="esc-falta esc-letra">{error}</p>}
      <div className="esc-fila-botones">
        {propuesta && <button type="button" className="esc-borrar" onClick={quitar} disabled={borrar.isPending}>Quitar de la lista</button>}
        <span className="esc-hueco" />
        <button type="button" className="esc-pill esc-plana esc-chica" onClick={onListo}>Cancelar</button>
        <button type="button" className="esc-pill esc-naranja esc-chica" onClick={enviar} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  )
}

// ── 3 · Revisar ───────────────────────────────────────────────

function PasoRevisar({ user, libro, saldo, precios, borradores, guardadas, generacion, rehacer }) {
  const guardar = useGuardarImagen(user?.id, libro.id)
  const descartar = useDescartarImagen(user?.id, libro.id)
  const pedirRehacer = usePedirTrabajo(user?.id, libro.id, 'rehacer')
  const [i, setI] = useState(0)
  const [grande, setGrande] = useState(null)
  const [error, setError] = useState('')
  const precioRehacer = Number(precios?.rehacer ?? 0)
  const rehaciendo = EN_MARCHA.includes(rehacer?.estado)
  const rehaciendoId = rehaciendo ? rehacer?.parametros?.imagen : null
  const actual = borradores[Math.min(i, borradores.length - 1)]

  useEffect(() => { if (i > borradores.length - 1) setI(Math.max(0, borradores.length - 1)) }, [borradores.length, i])

  const hacer = async (fn, arg) => {
    setError('')
    try { await fn.mutateAsync(arg) } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos hacerlo. Inténtalo de nuevo.')) }
  }

  return (
    <>
      {EN_MARCHA.includes(generacion?.estado) && <EnMarcha trabajo={generacion} texto="Dibujando" />}
      {generacion?.estado === 'hecho' && generacion.resultado?.pedidas > generacion.resultado?.imagenes && (
        <p className="esc-letra">Salieron {generacion.resultado.imagenes} de {generacion.resultado.pedidas}: solo se cobraron esas.</p>
      )}

      {actual ? (
        <>
          <div className="esc-carrusel">
            <button type="button" className="esc-flecha" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Anterior">‹</button>
            <figure>
              <button type="button" className="esc-zoom" onClick={() => setGrande(actual)}>
                <img src={actual.url} alt={etiqueta(actual)} />
              </button>
              <figcaption><b>{etiqueta(actual)}</b> {actual.descripcion}</figcaption>
            </figure>
            <button type="button" className="esc-flecha" disabled={i >= borradores.length - 1} onClick={() => setI(i + 1)} aria-label="Siguiente">›</button>
          </div>
          <div className="esc-miniaturas">
            {borradores.map((b, k) => (
              <button key={b.id} type="button" className={k === i ? 'on' : ''} onClick={() => setI(k)}><img src={b.url} alt="" /></button>
            ))}
            <small>{i + 1} de {borradores.length} por revisar</small>
          </div>
          <div className="esc-fila-botones esc-acciones-carrusel">
            <button type="button" className="esc-pill esc-plana" disabled={descartar.isPending || rehaciendoId === actual.id}
              onClick={() => hacer(descartar, actual.id)}>Descartar</button>
            <button type="button" className="esc-pill" disabled={rehaciendo || pedirRehacer.isPending || saldo < precioRehacer}
              onClick={() => hacer(pedirRehacer, { imagen: actual.id })}>
              {rehaciendoId === actual.id ? 'Rehaciendo…' : `Rehacer · ${dinero(precioRehacer)}`}</button>
            <button type="button" className="esc-pill esc-naranja" disabled={guardar.isPending || rehaciendoId === actual.id}
              onClick={() => hacer(guardar, actual.id)}>Guardar</button>
          </div>
          <p className="esc-letra">Toca la imagen para verla en grande. Rehacer cuesta la mitad y reemplaza a esta. Lo que descartes no se cobra de nuevo, pero tampoco se devuelve. Los borradores se borran solos a los 7 días.</p>
        </>
      ) : !EN_MARCHA.includes(generacion?.estado) && (
        <p className="esc-gris">No tienes ilustraciones por revisar.</p>
      )}
      {rehaciendo && !borradores.some(b => b.id === rehaciendoId) && <EnMarcha trabajo={rehacer} texto="Dibujando otra vez" />}
      {rehacer?.estado === 'error' && <div className="esc-alerta esc-error"><span>⚠️</span><span>{rehacer.error}</span></div>}
      {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}

      {guardadas.length > 0 && (
        <>
          <h3 className="esc-sub">Guardadas</h3>
          <div className="esc-guardadas">
            {guardadas.map(g => (
              <figure key={g.id}>
                <button type="button" className="esc-zoom" onClick={() => setGrande(g)}><img src={g.url} alt={etiqueta(g)} loading="lazy" /></button>
                <figcaption>
                  <b>{etiqueta(g)}</b>
                  <small>{g.tipo === 'escena' ? 'En el lector, en su capítulo.' : 'Irá a su ficha cuando tengas la cartelera.'}</small>
                  <button type="button" className="esc-borrar" onClick={() => window.confirm('¿Quitar esta ilustración? Se borra.') && hacer(descartar, g.id)}>Quitar</button>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {grande && (
        <Visor titulo={etiqueta(grande)} subtitulo={grande.descripcion} imagenes={[grande.url]} onCerrar={() => setGrande(null)} />
      )}
    </>
  )
}

// ── Piezas ────────────────────────────────────────────────────

export function EnMarcha({ trabajo, texto }) {
  const p = trabajo?.progreso
  return (
    <div className="esc-en-marcha">
      <b>{trabajo?.estado === 'pendiente' ? 'En la cola…' : `${p?.texto || texto}…`}</b>
      <span>Puede tardar unos minutos. Puedes cerrar esta ventana: el resultado te espera aquí.</span>
    </div>
  )
}

export function Visor({ titulo, subtitulo, imagenes, accion, onAccion, onCerrar }) {
  const [k, setK] = useState(0)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowRight') setK(x => Math.min(imagenes.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setK(x => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [imagenes.length, onCerrar])
  return (
    <div className="esc-visor" role="dialog" aria-modal="true" aria-label={titulo} onClick={onCerrar}>
      <div className="esc-visor-caja" onClick={(e) => e.stopPropagation()}>
        <div className="esc-visor-cab">
          <h3>{titulo}</h3>{subtitulo && <span>{subtitulo}</span>}
          <span className="esc-hueco" />
          <button type="button" className="esc-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="esc-visor-cuerpo"><img src={imagenes[k]} alt="" /></div>
        {(imagenes.length > 1 || accion) && (
          <div className="esc-visor-pie">
            <div className="esc-visor-minis">
              {imagenes.length > 1 && imagenes.map((u, j) => (
                <button key={u} type="button" className={j === k ? 'on' : ''} onClick={() => setK(j)}><img src={u} alt="" /></button>
              ))}
            </div>
            {accion && <button type="button" className="esc-pill esc-naranja" onClick={onAccion}>{accion}</button>}
          </div>
        )}
      </div>
    </div>
  )
}
