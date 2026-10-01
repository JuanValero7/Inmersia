import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useLibroReelsQuery } from '../../../lib/queries.js'
import { useFichaEnUrl, useLibroEnUrl } from '../../../hooks/useFichaEnUrl.js'
import { useSala } from '../../../hooks/useSala.js'
import { useAvisoGuardar } from '../../../hooks/useAvisoGuardar.js'
import { estanteriaDe } from '../../../utils/estanteria.js'
import { imgUrl } from '../../../lib/img.js'
import { evento } from '../../../lib/analytics.js'
import { SalaCard, Lomo, mezclar } from '../../tienda/salaPiezas.jsx'
import { useAccionesFicha } from '../../tienda/fichaPiezas.jsx'
import Historia, { PrecargaHistoria } from '../../tienda/Historia.jsx'
import FichaLibroMobile from './FichaLibroMobile.jsx'
import CabeceraTiendaMobile from './CabeceraTiendaMobile.jsx'
import '../../../styles/tienda-principal.css'
import '../../../styles/sala.mobile.css'

// =============================================================
// SalaMobile · una sala de la Tienda en el teléfono (plan de la tienda, 1.3)
//   fila fija (Atrás «Tienda», lupa) → título → 2 baldas de 5 con
//   portadas solo de ilustración y una etiqueta de papel colgando con
//   el título → numerador → «Otras salas» en una fila deslizable.
//
// Tocar un libro (o su etiqueta) abre su historia a pantalla completa:
// X arriba, Ficha y Añadir en la columna derecha, «Comenzar a leer»
// abajo. Deslizar hacia arriba pasa al libro siguiente de la sala, hacia
// abajo al anterior (en los extremos, un rebote); tocar a izquierda o
// derecha cambia de escena.
//
// La historia vive en la URL (?historia=<slug>) y la ficha encima
// (?libro=): Atrás de Android cierra primero la ficha, luego la
// historia y al final sale de la sala. Al deslizar se reemplaza la
// entrada del historial en vez de apilar otra.
// Datos de la sala: useSala, el mismo hook que escritorio (SalaVista).
// TiendaMobile la monta con key={slug}: cambiar de sala = sala nueva.
// =============================================================

// Recorrido vertical (px) a partir del cual un arrastre cambia de libro.
const UMBRAL_DESLIZAR = 60
// Tras deslizar, el clic que llega al soltar no debe cambiar de escena.
const TRAGAR_CLIC_MS = 350

const IconoBuscar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>
)
const Flecha = ({ dir }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir < 0 ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
  </svg>
)
const IconoPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
)
const IconoInfo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5v.5" /></svg>
)
const IconoGuardar = ({ lleno }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={lleno ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
)
const IconoArriba = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
)

// La historia a pantalla completa, con los gestos y las acciones.
function HistoriaPantalla({ libro, sala, sentido, pausada, user, yaAdquirido, bloqueado, siguiente,
  onMover, onCerrar, onFicha, onGuardar, onComenzar }) {
  const { data: escenas = [], isLoading } = useLibroReelsQuery(libro.id)
  const acciones = useAccionesFicha({ libro, user, yaAdquirido, bloqueado, onComprar: onGuardar, onEmpezarLeer: onComenzar, origen: 'sala' })
  const marcoRef = useRef(null)
  const gesto = useRef(null)
  const tragarHasta = useRef(0)

  // Mientras está abierta, la sala de atrás no se desplaza.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const alSalir = useCallback(({ escenasVistas, deTotal }) => {
    evento('historia_vista', { libro: libro.slug, sala, escenas_vistas: escenasVistas, de_total: deTotal })
  }, [libro.slug, sala])

  // En los extremos de la sala la historia rebota en vez de cambiar.
  const rebotar = () => {
    const m = marcoRef.current
    if (!m) return
    m.classList.remove('smh-rebote')
    void m.offsetWidth   // reinicia la animación
    m.classList.add('smh-rebote')
  }
  const mover = (delta) => { if (!onMover(delta)) rebotar() }

  // Arrastre vertical: la historia sigue al dedo y, pasado el umbral,
  // cambia de libro. Los botones (salvo las zonas de toque de escena)
  // no empiezan un arrastre.
  const alBajar = (e) => {
    if (e.target.closest('button:not(.hist-toque)')) return
    gesto.current = { y: e.clientY, dy: 0 }
    if (marcoRef.current) marcoRef.current.style.transition = 'none'
  }
  const alMover = (e) => {
    const g = gesto.current
    if (!g) return
    g.dy = e.clientY - g.y
    if (marcoRef.current) marcoRef.current.style.transform = `translateY(${g.dy * 0.45}px)`
  }
  const alSoltar = () => {
    const g = gesto.current
    gesto.current = null
    if (!g) return
    const m = marcoRef.current
    if (m) { m.style.transition = ''; m.style.transform = '' }
    if (Math.abs(g.dy) > UMBRAL_DESLIZAR) {
      tragarHasta.current = Date.now() + TRAGAR_CLIC_MS
      mover(g.dy < 0 ? 1 : -1)
    }
  }
  const alClicCaptura = (e) => {
    if (Date.now() < tragarHasta.current) { e.stopPropagation(); e.preventDefault() }
  }

  const lateral = (
    <>
      <button type="button" className="smh-accion" onClick={onFicha}><i><IconoInfo /></i>Ficha</button>
      <button type="button" className={clsx('smh-accion', yaAdquirido && 'on')} onClick={acciones.guardar} disabled={acciones.guardarDeshabilitado}>
        <i><IconoGuardar lleno={yaAdquirido} /></i>{yaAdquirido ? 'En tu biblioteca' : 'Añadir a mi biblioteca'}
      </button>
    </>
  )
  const abajo = (
    <>
      <button type="button" className="hist-btn-leer" onClick={acciones.comenzar} disabled={acciones.comenzarDeshabilitado}>
        <IconoPlay /> Comenzar a leer
      </button>
      {acciones.comenzarDeshabilitado && <p className="smh-limite">{acciones.aviso}</p>}
      <button type="button" className="smh-desliza" onClick={() => mover(1)} disabled={!siguiente}>
        {siguiente ? <><IconoArriba /> Desliza · sigue {siguiente.titulo}</> : 'Es el último libro de esta sala'}
      </button>
    </>
  )

  return (
    <div className="smh" role="dialog" aria-modal="true" aria-label={`Historia de ${libro.titulo}`}
      onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}
      onClickCapture={alClicCaptura}>
      <div className="smh-marco" ref={marcoRef}>
        {isLoading || !escenas.length ? (
          <div className="hist-estado smh-estado">
            <p>{isLoading ? 'Cargando la historia…' : 'Este libro aún no tiene historia.'}</p>
            {!isLoading && abajo}
            <button type="button" className="hist-btn-sec" onClick={onCerrar}>Volver a la sala</button>
          </div>
        ) : (
          <Historia key={libro.id} libro={libro} escenas={escenas} pausada={pausada} alSalir={alSalir}
            onCerrar={onCerrar} lateral={lateral} className={sentido && `smh-entra-${sentido}`}>
            {abajo}
          </Historia>
        )}
      </div>
    </div>
  )
}

/**
 * @param {{ slug: string, catalogo: object[], loading: boolean, user: object|null,
 *   tieneLibro: (id: string) => boolean, pendientes: number, bloqueado?: boolean,
 *   onComprar: (libro: object) => Promise<{ error: string|null }>, onEmpezarLeer: (libro: object) => void,
 *   onVolver: () => void, onIrSala: (slug: string) => void }} props
 */
export default function SalaMobile({ slug, catalogo, loading, user, tieneLibro, pendientes, bloqueado = false, onComprar, onEmpezarLeer, onVolver, onIrSala }) {
  const navigate = useNavigate()
  const { sala, isError, libros, estanterias, secuencia, indiceDe, otras, librosDe } = useSala(slug, catalogo)
  const { libro: fichaLibro, abrir: abrirFicha, cerrar: cerrarFicha } = useFichaEnUrl(catalogo)
  const historia = useLibroEnUrl(secuencia, 'historia')
  const { aviso, guardar } = useAvisoGuardar(onComprar, pendientes)

  // Se llega desde la portada o desde otra sala, muchas veces con la página
  // ya desplazada: la sala empieza siempre arriba, con su título a la vista.
  useEffect(() => { window.scrollTo(0, 0) }, [])

  // El último libro visto queda resaltado en la estantería al cerrar.
  const [resaltado, setResaltado] = useState(null)
  const [pagina, setPagina] = useState(0)
  const [sentido, setSentido] = useState('')   // 'sube' | 'baja': hacia dónde entra la historia

  const libroHistoria = historia.libro
  const iHistoria = libroHistoria ? indiceDe.get(libroHistoria.id) : -1
  const siguiente = iHistoria >= 0 ? secuencia[iHistoria + 1] || null : null

  const marcar = (i) => { setResaltado(secuencia[i].id); setPagina(estanteriaDe(i)) }
  const abrir = (i) => {
    marcar(i)
    setSentido('sube')
    historia.abrir(secuencia[i])
  }
  // Devuelve si pudo moverse (si no, la historia rebota).
  const mover = (delta) => {
    const hacia = iHistoria + delta
    if (iHistoria < 0 || hacia < 0 || hacia >= secuencia.length) return false
    evento('historia_desliza', { sala: slug, desde: secuencia[iHistoria].slug, hacia: secuencia[hacia].slug })
    marcar(hacia)
    setSentido(delta > 0 ? 'sube' : 'baja')
    historia.cambiar(secuencia[hacia])
    return true
  }

  // Lupa: el buscador ocupa la fila; Enter abre el catálogo con esa búsqueda.
  const [buscando, setBuscando] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { if (buscando) inputRef.current?.focus() }, [buscando])
  const buscar = (e) => {
    e.preventDefault()
    if (q.trim()) navigate(`/tienda/catalogo?q=${encodeURIComponent(q.trim())}`)
  }
  const buscador = buscando && (
    <>
      <form className="tpm-buscador" role="search" onSubmit={buscar}>
        <IconoBuscar />
        <input ref={inputRef} type="search" enterKeyHint="search" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Busca en toda la tienda…" aria-label="Buscar en toda la tienda" />
      </form>
      <button type="button" className="tpm-cancelar" onClick={() => { setQ(''); setBuscando(false) }}>Cancelar</button>
    </>
  )
  const cabecera = (
    <CabeceraTiendaMobile etiquetaAtras="Tienda" onAtras={onVolver} buscador={buscador}
      derecha={<button type="button" className="tpm-icono" onClick={() => setBuscando(true)} aria-label="Buscar"><IconoBuscar /></button>} />
  )

  if (isError || !sala || loading) {
    return (
      <div className="sm sm-sin-sala">
        {cabecera}
        <p className="sm-estado">{isError ? 'No pudimos abrir la sala.' : 'Abriendo la sala…'}</p>
      </div>
    )
  }

  const pared = `radial-gradient(ellipse at 30% 20%, rgba(255,190,110,.22), transparent 50%), linear-gradient(180deg, ${mezclar(sala.color, '#140c08', 0.55)} 0%, ${mezclar(sala.color, '#140c08', 0.76)} 100%)`
  const baldas = estanterias[pagina] || []

  return (
    <div className="sm" style={{ background: pared }}>
      {cabecera}

      <div className="sm-titulo">
        <h1>{sala.nombre}</h1>
        <span>{sala.genero || 'Temporada'} · {libros.length} {libros.length === 1 ? 'libro' : 'libros'}</span>
      </div>
      <p className="sm-ayuda">Toca un libro para ver su historia.</p>

      <div className="sm-estanterias">
        {libros.length === 0 && <p className="sm-estado">Esta sala aún no tiene libros.</p>}
        {baldas.map((balda, b) => (
          <div className="sm-balda" key={`${pagina}-${b}`}>
            <div className="sm-balda-libros">
              {balda.map(({ libro, lomo }) => {
                const i = indiceDe.get(libro.id)
                const propio = tieneLibro(libro.id)
                return (
                  <button key={libro.id} type="button" className={clsx('sm-libro', resaltado === libro.id && 'sel')}
                    onClick={() => abrir(i)}
                    aria-label={`${libro.titulo}, ${libro.autor}${propio ? ' (ya está en tu biblioteca)' : ''}`}>
                    {lomo ? <Lomo libro={libro} className="sm-lomo" ancho={28} /> : (
                      <span className="sm-portada" style={{ background: libro.color || 'var(--accent)' }}>
                        {libro.portada_url && <img src={imgUrl(libro.portada_url, { width: 180 })} alt="" loading="lazy" draggable="false" />}
                      </span>
                    )}
                    {propio && !lomo && <span className="sm-check" aria-hidden="true">✓</span>}
                  </button>
                )
              })}
            </div>
            <div className="sm-tabla" aria-hidden="true" />
            {/* Las etiquetas repiten el botón del libro: fuera del foco y del lector de pantalla */}
            <div className="sm-etiquetas" aria-hidden="true">
              {balda.map(({ libro, lomo }, j) => lomo
                ? <span key={libro.id} className="sm-etiqueta-hueco" />
                : (
                  <button key={libro.id} type="button" tabIndex={-1} className="sm-etiqueta"
                    style={{ transform: `rotate(${j % 2 ? 1.2 : -1.2}deg)` }}
                    onClick={() => abrir(indiceDe.get(libro.id))}>
                    <span>{libro.titulo}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {estanterias.length > 1 && (
        <div className="sm-numerador">
          <button type="button" onClick={() => setPagina(p => p - 1)} disabled={pagina === 0} aria-label="Estantería anterior"><Flecha dir={-1} /></button>
          <span>Estantería {pagina + 1} de {estanterias.length}</span>
          <button type="button" onClick={() => setPagina(p => p + 1)} disabled={pagina >= estanterias.length - 1} aria-label="Estantería siguiente"><Flecha dir={1} /></button>
        </div>
      )}

      {otras.length > 0 && (
        <nav className="sm-otras" aria-label="Otras salas">
          <h2>Otras salas</h2>
          <div className="tpm-pista tpm-salas">
            {otras.map(s => (
              <SalaCard key={s.id} sala={s} numLibros={librosDe(s).length} onAbrir={() => onIrSala(s.slug)} />
            ))}
          </div>
        </nav>
      )}

      {libroHistoria && (
        <HistoriaPantalla
          libro={libroHistoria}
          sala={slug}
          sentido={sentido}
          pausada={!!fichaLibro}
          user={user}
          yaAdquirido={tieneLibro(libroHistoria.id)}
          bloqueado={bloqueado}
          siguiente={siguiente}
          onMover={mover}
          onCerrar={historia.cerrar}
          onFicha={() => abrirFicha(libroHistoria)}
          onGuardar={() => guardar(libroHistoria)}
          onComenzar={() => onEmpezarLeer(libroHistoria)}
        />
      )}
      {siguiente && <PrecargaHistoria libroId={siguiente.id} />}

      <div className={clsx('sm-aviso', aviso && 'on')} role="status" aria-live="polite">{aviso}</div>

      {fichaLibro && (
        <FichaLibroMobile
          key={fichaLibro.id}
          libro={fichaLibro}
          user={user}
          yaAdquirido={tieneLibro(fichaLibro.id)}
          bloqueado={bloqueado}
          onComprar={() => { guardar(fichaLibro); cerrarFicha() }}
          onEmpezarLeer={() => onEmpezarLeer(fichaLibro)}
          onCerrar={cerrarFicha}
          origen="sala"
        />
      )}
    </div>
  )
}
