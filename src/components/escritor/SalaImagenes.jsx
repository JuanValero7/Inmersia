// Sala de imágenes (maqueta, pantalla 6; fondo = taller de pintor).
// Fase 3: Portada y Fondo de ficha (106), Mis imágenes (107), Ilustraciones
// (108), Infografías, solo no ficción (110), y el Avance de la tienda (119).
// Decisiones de Juan (13 nov 2026):
//   · Lo que sale en la portada y en el fondo lo escribe el escritor; se lo
//     pasamos tal cual a la IA.
//   · Portada gratis; fondo de ficha 1 $ (precios_escritor() en la base).
//   · Lo generado llega como borrador: Guardar lo pone en el libro (y quita
//     el anterior), Descartar lo borra. Los borradores duran 7 días.
// Estilo: el de siempre de Inmersia (kawaii plano), el mismo de los scripts
// generar_portada.py y hero_generate.py, que usa el worker.
import { useState, useEffect } from 'react'
import MisImagenes from './MisImagenes.jsx'
import Ilustraciones from './Ilustraciones.jsx'
import Infografias from './Infografias.jsx'
import AvanceTienda from './AvanceTienda.jsx'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queries.js'
import {
  usePreciosEscritor, useTrabajo, usePedirTrabajo, useImagenesLibro,
  useGuardarImagen, useDescartarImagen, mensajeErrorEscritor,
} from '../../hooks/useEscritor.js'

const dinero = (n) => `${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`

// Los cuatro de generar_portada.py (BASE_COLORS aclarados): así todas las
// portadas de la estantería son de la misma familia.
// Son datos (el color que se le pide a la IA), no estilos: por eso hex.
/* eslint-disable no-restricted-syntax */
const COLORES = [
  { hex: '#d08c99', nombre: 'Rosa' },
  { hex: '#9cab6c', nombre: 'Oliva' },
  { hex: '#f8be5e', nombre: 'Ámbar' },
  { hex: '#394361', nombre: 'Azul marino' },
]
/* eslint-enable no-restricted-syntax */
const PESTANAS = [
  { id: 'portada', label: 'Portada' },
  { id: 'fondo', label: 'Fondo de ficha' },
  { id: 'ilustraciones', label: 'Ilustraciones', soloFiccion: true },
  { id: 'infografias', label: 'Infografías', soloNoFiccion: true },
  { id: 'avance', label: 'Avance de la tienda' },
  { id: 'propias', label: 'Mis imágenes' },
]

/**
 * @param {object} props
 * @param {{ id: string }} props.user
 * @param {{ id: string, titulo: string, capitulos: number, es_ficcion: boolean }} props.libro
 * @param {number} props.saldo
 * @param {() => void} props.onVolver
 */
export default function SalaImagenes({ user, libro, saldo, onVolver }) {
  const [tab, setTab] = useState('portada')
  const pestanas = PESTANAS.filter(p => !(p.soloFiccion && !libro.es_ficcion) && !(p.soloNoFiccion && libro.es_ficcion))

  return (
    <div className="esc-estudio esc-taller">
      <div className="esc-estudio-in esc-una-col">
        <div>
          <button type="button" className="esc-volver" onClick={onVolver}>← Volver al estudio</button>
          <h1>Sala de imágenes</h1>
          <p className="esc-estudio-sub">{libro.titulo} · {libro.capitulos} capítulos</p>
          <div className="esc-tabs-img" role="tablist">
            {pestanas.map(p => (
              <button key={p.id} type="button" role="tab" aria-selected={tab === p.id}
                className={tab === p.id ? 'on' : ''} disabled={p.pronto}
                title={p.pronto ? 'Llega muy pronto' : undefined}
                onClick={() => setTab(p.id)}>{p.label}{p.pronto ? ' · pronto' : ''}</button>
            ))}
          </div>
          {tab === 'portada' && <ImagenUnica key="portada" tipo="portada" user={user} libro={libro} saldo={saldo} />}
          {tab === 'fondo' && <ImagenUnica key="fondo" tipo="fondo" user={user} libro={libro} saldo={saldo} />}
          {tab === 'propias' && <MisImagenes user={user} libro={libro} />}
          {tab === 'ilustraciones' && <Ilustraciones user={user} libro={libro} saldo={saldo} />}
          {tab === 'infografias' && <Infografias user={user} libro={libro} saldo={saldo} />}
          {tab === 'avance' && <AvanceTienda user={user} libro={libro} saldo={saldo} />}
        </div>
      </div>
    </div>
  )
}

const TEXTOS = {
  portada: {
    explica: <>Todas las portadas de Inmersia van en el mismo estilo: <b>ilustración kawaii plana sobre un color liso</b>. Así tu libro se ve parte de la misma estantería que los demás.</>,
    pregunta: '¿Qué sale en tu portada?',
    ejemplo: 'Por ejemplo: un faro blanco sobre unas rocas, con una gaviota volando cerca.',
    boton: 'Generar portada',
    enCurso: 'Dibujando tu portada',
  },
  fondo: {
    explica: <>Es la imagen ancha que aparece detrás de tu libro en su ficha de la Tienda y en «Seguir leyendo». Va en el mismo estilo que las portadas, <b>un paisaje sin personas</b>, con un elemento del libro en el centro. Hacemos dos: para computadora y para teléfono.</>,
    pregunta: '¿Qué sale en el fondo?',
    ejemplo: 'Por ejemplo: un pueblo de pescadores de noche, con el faro encendido a lo lejos.',
    boton: 'Generar fondo',
    enCurso: 'Pintando tu fondo',
  },
}

function ImagenUnica({ tipo, user, libro, saldo }) {
  const qc = useQueryClient()
  const t = TEXTOS[tipo]
  const { data: precios } = usePreciosEscritor()
  const { data: trabajo } = useTrabajo(libro.id, tipo)
  const { data: imagenes = [] } = useImagenesLibro(libro.id)
  const pedir = usePedirTrabajo(user?.id, libro.id, tipo)
  const guardar = useGuardarImagen(user?.id, libro.id)
  const descartar = useDescartarImagen(user?.id, libro.id)
  const [sujeto, setSujeto] = useState('')
  const [color, setColor] = useState(COLORES[0].hex)
  const [error, setError] = useState('')

  const estado = trabajo?.estado
  const enMarcha = estado === 'pendiente' || estado === 'en_proceso'
  // Al terminar: refrescar imágenes y saldo (la base ya devolvió lo que sobró).
  useEffect(() => {
    if (estado === 'hecho' || estado === 'error') {
      qc.invalidateQueries({ queryKey: ['imagenesLibro', libro.id] })
      qc.invalidateQueries({ queryKey: queryKeys.escritor(user?.id) })
    }
  }, [estado, qc, libro.id, user?.id])

  const precio = Number(precios?.[tipo] ?? 0)
  const alcanza = saldo >= precio
  const mias = imagenes.filter(i => i.tipo === tipo)
  const guardada = mias.find(i => i.estado === 'guardada')
  const borradores = mias.filter(i => i.estado === 'borrador')

  const generar = async () => {
    setError('')
    try {
      await pedir.mutateAsync(tipo === 'portada' ? { sujeto: sujeto.trim(), color } : { sujeto: sujeto.trim() })
    } catch (e) {
      setError(mensajeErrorEscritor(e, 'No pudimos pedirlo. Revisa tu conexión e inténtalo de nuevo.'))
    }
  }
  const accion = async (fn, id) => {
    setError('')
    try { await fn.mutateAsync(id) } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos hacerlo. Inténtalo de nuevo.')) }
  }

  return (
    <div className="esc-img-grid">
      <section className="esc-vidrio">
        <p>{t.explica}</p>
        <label className="esc-campo-largo">
          <span>{t.pregunta}</span>
          <textarea value={sujeto} maxLength={400} rows={3} placeholder={t.ejemplo}
            onChange={(e) => setSujeto(e.target.value)} disabled={enMarcha} />
        </label>
        {tipo === 'portada' && (
          <div className="esc-colores" role="radiogroup" aria-label="Color de fondo">
            <span>Color de fondo</span>
            {COLORES.map(c => (
              <button key={c.hex} type="button" role="radio" aria-checked={color === c.hex} title={c.nombre}
                className={'esc-color' + (color === c.hex ? ' on' : '')} style={{ background: c.hex }}
                onClick={() => setColor(c.hex)} disabled={enMarcha} />
            ))}
          </div>
        )}
        <div className="esc-pie-tab">
          <span className="esc-gris">
            {precio === 0 ? 'Gratis' : <>1 {tipo} · {dinero(precio)} · {alcanza ? 'la cubre tu cupón' : 'tu cupón no alcanza'} (te quedan {dinero(saldo)})</>}
          </span>
          <button type="button" className="esc-pill esc-naranja" onClick={generar}
            disabled={enMarcha || pedir.isPending || sujeto.trim().length < 3 || !alcanza}>
            {pedir.isPending ? 'Pidiendo…' : t.boton}
          </button>
        </div>
        {enMarcha && (
          <div className="esc-en-marcha">
            <b>{estado === 'pendiente' ? 'En la cola…' : `${trabajo.progreso?.texto || t.enCurso}…`}</b>
            <span>Puede tardar unos minutos. Puedes cerrar esta ventana: el resultado te espera aquí.</span>
          </div>
        )}
        {estado === 'error' && <div className="esc-alerta esc-error"><span>⚠️</span><span>{trabajo.error}</span></div>}
        {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
      </section>

      <section className="esc-vidrio">
        {borradores.length > 0 && (
          <>
            <h2>Para revisar</h2>
            <p className="esc-letra">Guarda la que te guste: pasa a tu libro y reemplaza a la anterior. Los borradores se borran solos a los 7 días.</p>
            <div className={'esc-muestras ' + tipo}>
              {borradores.map(b => (
                <figure key={b.id}>
                  <a href={b.url} target="_blank" rel="noreferrer"><img src={b.url} alt={b.descripcion || tipo} /></a>
                  {b.descripcion && <figcaption>{b.descripcion}</figcaption>}
                  <div className="esc-fila-botones">
                    <button type="button" className="esc-pill esc-plana" disabled={descartar.isPending} onClick={() => accion(descartar, b.id)}>Descartar</button>
                    <button type="button" className="esc-pill esc-naranja" disabled={guardar.isPending} onClick={() => accion(guardar, b.id)}>Guardar</button>
                  </div>
                </figure>
              ))}
            </div>
          </>
        )}
        {guardada ? (
          <>
            <h2>En tu libro</h2>
            <div className={'esc-muestras ' + tipo}>
              <figure>
                <a href={guardada.url} target="_blank" rel="noreferrer"><img src={guardada.url} alt={guardada.descripcion || tipo} /></a>
                {guardada.descripcion && <figcaption>{guardada.descripcion}</figcaption>}
                <div className="esc-fila-botones">
                  <button type="button" className="esc-pill esc-plana" disabled={descartar.isPending}
                    onClick={() => window.confirm('¿Quitar esta imagen de tu libro? Se borra.') && accion(descartar, guardada.id)}>Quitar</button>
                </div>
              </figure>
            </div>
          </>
        ) : borradores.length === 0 && (
          tipo === 'portada' ? (
            <>
              <h2>Así son las portadas de Inmersia</h2>
              <div className="esc-ejemplos">
                {[0, 1, 2, 3, 4, 5].map(n => <img key={n} src={`/assets/escritor/portadas/p${n}.webp`} alt="" />)}
              </div>
            </>
          ) : (
            <>
              <h2>Así es un fondo de ficha</h2>
              <img className="esc-ejemplo-fondo" src="/assets/escritor/fondo-ejemplo.webp" alt="Ejemplo: el fondo de El principito" />
              <p className="esc-letra">El fondo de <i>El principito</i>. A la izquierda queda espacio para el título.</p>
            </>
          )
        )}
      </section>
    </div>
  )
}
