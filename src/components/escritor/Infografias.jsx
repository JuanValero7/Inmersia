// Infografías (maqueta, pantalla 6, pestaña de no ficción; migración 110).
//   · Una por capítulo: idea central + cinco puntos clave (el resumen de
//     resumir_capitulos_noficcion.py) en las plantillas de Documents/Info html.
//   · Dos estilos (Art Nouveau y Pulp); el formato (bandas, cintas, revista)
//     rota entre capítulos.
//   · 0,50 $ cada una que salga (Juan, 13 nov). Los capítulos muy cortos se
//     saltan y no se cobran.
//   · Llegan como borrador: Guardar la pone en su capítulo (y reemplaza a la
//     de antes), Descartar la borra.
//   · «Corregir texto» (111, GRATIS): título, idea central y puntos; el PC
//     vuelve a pintar la misma plantilla sin IA y reemplaza la imagen.
import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queries.js'
import {
  usePreciosEscritor, useTrabajo, usePedirTrabajo, useImagenesLibro,
  useGuardarImagen, useDescartarImagen, useCapitulosLibro, mensajeErrorEscritor,
} from '../../hooks/useEscritor.js'
import { EnMarcha, Visor } from './Ilustraciones.jsx'

const dinero = (n) => `${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
const EN_MARCHA = ['pendiente', 'en_proceso']
// El índice es el que se pide (worker: PLANTILLAS_INFOGRAFIA).
const ESTILOS_INFO = [
  ['Art Nouveau', 'Líneas curvas, ornamentos y color joya'],
  ['Pulp', 'Tinta y color de revista antigua, mucho contraste'],
]
const FORMATOS = ['bandas', 'cintas', 'revista']
const ejemplos = (i) => [0, 1, 2].map(j => `/assets/escritor/infografias/e${i}_${j}.webp`)
const etiqueta = (img) => `Capítulo ${img.capitulo}`
// El título solo si dice algo más que «Capítulo N».
const titulo = (img) => (img.descripcion && img.descripcion.trim() !== etiqueta(img) ? img.descripcion : '')

/**
 * @param {object} props
 * @param {{ id: string }} props.user
 * @param {{ id: string, titulo: string }} props.libro
 * @param {number} props.saldo
 */
export default function Infografias({ user, libro, saldo }) {
  const qc = useQueryClient()
  const { data: precios } = usePreciosEscritor()
  const { data: trabajo } = useTrabajo(libro.id, 'infografias')
  const { data: imagenes = [] } = useImagenesLibro(libro.id)
  const { data: capitulos = [] } = useCapitulosLibro(libro.id)
  const pedir = usePedirTrabajo(user?.id, libro.id, 'infografias')
  const guardar = useGuardarImagen(user?.id, libro.id)
  const descartar = useDescartarImagen(user?.id, libro.id)

  const [estiloElegido, setEstilo] = useState(null)
  const estilo = estiloElegido ?? trabajo?.parametros?.estilo ?? 0
  const [visor, setVisor] = useState(null)   // {titulo, subtitulo, imagenes}
  const [i, setI] = useState(0)
  const [error, setError] = useState('')
  const [guardandoTodas, setGuardandoTodas] = useState(false)
  const [corrigiendo, setCorrigiendo] = useState(null)   // la infografía abierta en el editor de texto
  const { data: correccion } = useTrabajo(libro.id, 'infografia_texto')
  const corrigiendoId = EN_MARCHA.includes(correccion?.estado) ? correccion?.parametros?.imagen : null

  const estado = trabajo?.estado
  const enMarcha = EN_MARCHA.includes(estado)
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['imagenesLibro', libro.id] })
    qc.invalidateQueries({ queryKey: queryKeys.escritor(user?.id) })
  }, [estado, trabajo?.id, correccion?.estado, correccion?.id, qc, libro.id, user?.id])

  const infos = useMemo(() => imagenes.filter(im => im.tipo === 'infografia')
    .sort((a, b) => (a.capitulo ?? 0) - (b.capitulo ?? 0)), [imagenes])
  const borradores = infos.filter(im => im.estado === 'borrador')
  const guardadas = infos.filter(im => im.estado === 'guardada')

  // Lo que falta: capítulos sin infografía (ni guardada ni por revisar) y que
  // la última vez no salieron como «muy cortos».
  const cortos = new Set(estado === 'hecho' ? (trabajo.resultado?.cortos || []) : [])
  const conInfo = new Set(infos.map(im => im.capitulo))
  const faltan = capitulos.map(c => c.numero).filter(n => !conInfo.has(n) && !cortos.has(n))
  const precio = Number(precios?.infografia ?? 0)
  const total = faltan.length * precio
  const alcanza = saldo >= total

  const actual = borradores[Math.min(i, borradores.length - 1)]
  useEffect(() => { if (i > borradores.length - 1) setI(Math.max(0, borradores.length - 1)) }, [borradores.length, i])

  const hacer = async (fn, arg) => {
    setError('')
    try { await fn.mutateAsync(arg) } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos hacerlo. Inténtalo de nuevo.')) }
  }
  const generar = () => hacer(pedir, { estilo, capitulos: faltan })
  const guardarTodas = async () => {
    setGuardandoTodas(true)
    setError('')
    try {
      for (const b of borradores) await guardar.mutateAsync(b.id)
    } catch (e) {
      setError(mensajeErrorEscritor(e, 'No pudimos guardarlas todas. Inténtalo de nuevo.'))
    } finally {
      setGuardandoTodas(false)
    }
  }

  return (
    <section className="esc-vidrio">
      <p>Cada capítulo lleva una <b>infografía</b> con su idea central y cinco puntos clave. Elige uno de los dos estilos; el formato (bandas, cintas o revista) va rotando entre capítulos para que no se repita.</p>
      <div className="esc-estilos esc-estilos-info">
        {ESTILOS_INFO.map(([nombre, desc], k) => (
          <div key={nombre} className={'esc-estilo' + (estilo === k ? ' on' : '')}>
            <button type="button" className="esc-mosaico esc-mosaico-info" aria-label={`Ver ejemplos de ${nombre}`}
              onClick={() => setVisor({ titulo: `Infografía · ${nombre}`, subtitulo: 'Formatos: bandas, cintas y revista', imagenes: ejemplos(k) })}>
              {ejemplos(k).map(u => <img key={u} src={u} alt="" loading="lazy" />)}
              <span className="esc-ver">Ver los 3 formatos</span>
            </button>
            <div>
              <b>{nombre}</b><small>{desc} · {FORMATOS.length} formatos</small>
              <button type="button" className="esc-elegir-est" onClick={() => setEstilo(k)} disabled={enMarcha}>
                {estilo === k ? 'Elegido' : 'Elegir'}</button>
            </div>
          </div>
        ))}
      </div>

      <div className="esc-pie-tab">
        <span className="esc-gris">
          {faltan.length === 0
            ? (capitulos.length ? 'Todos los capítulos tienen su infografía.' : '')
            : <>{faltan.length === capitulos.length ? `${faltan.length} infografías, una por capítulo` : `${faltan.length} capítulos sin infografía`} · {dinero(precio)} cada una · {alcanza ? 'la cubre tu cupón' : 'tu cupón no alcanza'} (te quedan {dinero(saldo)}). Los capítulos muy cortos se saltan y no se cobran.</>}
        </span>
        {faltan.length > 0 && (
          <button type="button" className="esc-pill esc-naranja" onClick={generar}
            disabled={enMarcha || pedir.isPending || !alcanza}>
            {pedir.isPending ? 'Pidiendo…' : `Generar ${faltan.length === 1 ? '1 infografía' : `${faltan.length} infografías`} · ${dinero(total)}`}
          </button>
        )}
      </div>

      {enMarcha && <EnMarcha trabajo={trabajo} texto="Preparando tus infografías" />}
      {estado === 'error' && <div className="esc-alerta esc-error"><span>⚠️</span><span>{trabajo.error}</span></div>}
      {estado === 'hecho' && (trabajo.resultado?.cortos?.length > 0 || trabajo.resultado?.pedidas > trabajo.resultado?.imagenes) && (
        <p className="esc-letra">
          Salieron {trabajo.resultado.imagenes} de {trabajo.resultado.pedidas}; solo se cobraron esas.
          {trabajo.resultado.cortos?.length > 0 && <> Muy cortos para resumir: {trabajo.resultado.cortos.map(n => `cap. ${n}`).join(', ')}.</>}
        </p>
      )}

      {actual && (
        <>
          <h3 className="esc-sub">Para revisar</h3>
          <div className="esc-carrusel esc-carrusel-info">
            <button type="button" className="esc-flecha" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Anterior">‹</button>
            <figure>
              <button type="button" className="esc-zoom" onClick={() => setVisor({ titulo: etiqueta(actual), subtitulo: titulo(actual), imagenes: [actual.url] })}>
                <img src={actual.url} alt={`Infografía del ${etiqueta(actual).toLowerCase()}`} />
              </button>
              <figcaption><b>{etiqueta(actual)}</b> {titulo(actual)}</figcaption>
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
            <button type="button" className="esc-pill esc-plana" disabled={descartar.isPending || guardandoTodas}
              onClick={() => hacer(descartar, actual.id)}>Descartar</button>
            <button type="button" className="esc-pill" disabled={!actual.datos?.plantilla || !!corrigiendoId}
              onClick={() => setCorrigiendo(actual)}>{corrigiendoId === actual.id ? 'Pintando…' : 'Corregir texto'}</button>
            <button type="button" className="esc-pill esc-naranja" disabled={guardar.isPending || guardandoTodas}
              onClick={() => hacer(guardar, actual.id)}>Guardar</button>
            {borradores.length > 1 && (
              <button type="button" className="esc-pill" disabled={guardar.isPending || guardandoTodas} onClick={guardarTodas}>
                {guardandoTodas ? 'Guardando…' : `Guardar las ${borradores.length}`}</button>
            )}
          </div>
          <p className="esc-letra">Guardada, va al final de su capítulo y reemplaza a la que hubiera. Si descartas una, el capítulo vuelve a quedar libre para generarla de nuevo (se cobra otra vez). Los borradores se borran solos a los 7 días.</p>
        </>
      )}
      {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
      {corrigiendoId && <EnMarcha trabajo={correccion} texto="Pintando con tu texto" />}
      {correccion?.estado === 'error' && <div className="esc-alerta esc-error"><span>⚠️</span><span>{correccion.error}</span></div>}

      {guardadas.length > 0 && (
        <>
          <h3 className="esc-sub">En tu libro</h3>
          <div className="esc-guardadas esc-guardadas-info">
            {guardadas.map(g => (
              <figure key={g.id}>
                <button type="button" className="esc-zoom" onClick={() => setVisor({ titulo: etiqueta(g), subtitulo: titulo(g), imagenes: [g.url] })}>
                  <img src={g.url} alt={`Infografía del ${etiqueta(g).toLowerCase()}`} loading="lazy" />
                </button>
                <figcaption>
                  <b>{etiqueta(g)}</b>
                  {titulo(g) && <small>{titulo(g)}</small>}
                  {g.datos?.plantilla && (
                    <button type="button" className="esc-borrar" disabled={!!corrigiendoId} onClick={() => setCorrigiendo(g)}>
                      {corrigiendoId === g.id ? 'Pintando…' : 'Corregir texto'}</button>
                  )}
                  <button type="button" className="esc-borrar"
                    onClick={() => window.confirm('¿Quitar esta infografía de tu libro? Se borra.') && hacer(descartar, g.id)}>Quitar</button>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {visor && <Visor {...visor} onCerrar={() => setVisor(null)} />}
      {corrigiendo && <EditorTexto user={user} libro={libro} img={corrigiendo} onCerrar={() => setCorrigiendo(null)} />}
    </section>
  )
}

// Corregir texto: lo que dice la infografía. Gratis, sin IA: el PC vuelve a
// pintar la misma plantilla con este texto.
function EditorTexto({ user, libro, img, onCerrar }) {
  const d = img.datos || {}
  const pedir = usePedirTrabajo(user?.id, libro.id, 'infografia_texto')
  const [tituloTxt, setTitulo] = useState(d.titulo || img.descripcion || '')
  const [concepto, setConcepto] = useState(d.concepto_principal || '')
  const [bullets, setBullets] = useState(() => [0, 1, 2, 3, 4].map(k => d.bullets?.[k] || ''))
  const [error, setError] = useState('')
  const llenos = bullets.map(b => b.trim()).filter(Boolean)
  const valido = tituloTxt.trim() && llenos.length === 5

  const enviar = async () => {
    setError('')
    try {
      await pedir.mutateAsync({ imagen: img.id, titulo: tituloTxt.trim(), concepto: concepto.trim(), bullets: llenos })
      onCerrar()
    } catch (e) {
      setError(mensajeErrorEscritor(e, 'No pudimos pedirlo. Inténtalo de nuevo.'))
    }
  }

  return (
    <div className="esc-visor" role="dialog" aria-modal="true" aria-label="Corregir texto" onClick={onCerrar}>
      <div className="esc-visor-caja esc-editor-info" onClick={(e) => e.stopPropagation()}>
        <div className="esc-visor-cab">
          <h3>Corregir texto · {etiqueta(img)}</h3><span>Gratis: la volvemos a pintar con tu texto, en el mismo formato.</span>
          <span className="esc-hueco" />
          <button type="button" className="esc-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="esc-editor-info-cuerpo">
          <img src={img.url} alt="" />
          <div className="esc-editor-campos">
            <label>Título del capítulo
              <input value={tituloTxt} maxLength={160} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label>Idea central <small>(corta se lee mejor; puede ir vacía)</small>
              <textarea rows={2} value={concepto} maxLength={200} onChange={(e) => setConcepto(e.target.value)} />
            </label>
            {bullets.map((b, k) => (
              <label key={k}>Punto {k + 1}
                <textarea rows={2} value={b} maxLength={220}
                  onChange={(e) => setBullets(bs => bs.map((x, j) => (j === k ? e.target.value : x)))} />
              </label>
            ))}
            {error && <p className="esc-falta esc-letra">{error}</p>}
            <div className="esc-fila-botones">
              <span className="esc-hueco" />
              <button type="button" className="esc-pill esc-plana esc-chica" onClick={onCerrar}>Cancelar</button>
              <button type="button" className="esc-pill esc-naranja esc-chica" onClick={enviar} disabled={!valido || pedir.isPending}>
                {pedir.isPending ? 'Pidiendo…' : 'Volver a pintar · gratis'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
