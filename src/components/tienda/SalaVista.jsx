import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useLibroReelsQuery } from '../../lib/queries.js'
import { useFichaEnUrl } from '../../hooks/useFichaEnUrl.js'
import { useSala } from '../../hooks/useSala.js'
import { useAvisoGuardar } from '../../hooks/useAvisoGuardar.js'
import { estanteriaDe } from '../../utils/estanteria.js'
import { evento } from '../../lib/analytics.js'
import { CoverCard } from './catalogoShared.jsx'
import { SalaCard, Lomo, mezclar } from './salaPiezas.jsx'
import { useAccionesFicha } from './fichaPiezas.jsx'
import Historia, { PrecargaHistoria } from './Historia.jsx'
import FichaLibro from './FichaLibro.jsx'
import CabeceraTienda from './CabeceraTienda.jsx'
import '../../styles/sala.css'

// =============================================================
// SalaVista · una sala de la Tienda en escritorio (plan de la tienda, 1.3)
//   /tienda/<slug> · salas (tipo 'sala') y la temporada vigente.
//
//   cabecera (Atrás «Tienda», buscador de toda la tienda) →
//   izquierda: título, estanterías de 2 baldas × 5, numerador y el
//   pasillo de otras salas · derecha: el panel de la historia (9:16).
//
// Tocar un libro abre su historia en el panel. «Desliza» (rueda, ↓/↑ o
// el botón) pasa al libro siguiente o anterior en el orden en que se ven,
// y la estantería cambia de página si hace falta. Sin sonido de sala:
// cada historia trae el suyo.
// La ficha se abre encima y vive en la URL (?libro=, ver useFichaEnUrl);
// mientras está abierta la historia se pausa.
// Tienda.jsx la monta con key={slug}: cambiar de sala = sala nueva.
// Datos de la sala: useSala, el mismo hook que el móvil (SalaMobile).
// =============================================================

const IconoBuscar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>
)
const Flecha = ({ dir }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir < 0 ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
  </svg>
)
const IconoPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
)
const IconoInfo = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5v.5" /></svg>
)
const IconoGuardar = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
)
const IconoArriba = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
)

// Rueda: un gesto mueve un solo libro. Por debajo de este delta es ruido
// del trackpad; durante la pausa se ignoran los eventos que siguen llegando.
const RUEDA_MIN_DELTA = 18
const RUEDA_PAUSA_MS = 700

// Lo de abajo de la historia: Comenzar a leer, Ficha + Guardar y Desliza.
function AccionesHistoria({ libro, user, yaAdquirido, bloqueado, onComenzar, onGuardar, onFicha, siguiente, onDeslizar }) {
  const acciones = useAccionesFicha({ libro, user, yaAdquirido, bloqueado, onComprar: onGuardar, onEmpezarLeer: onComenzar, origen: 'sala' })
  return (
    <>
      <button type="button" className="hist-btn-leer" onClick={acciones.comenzar} disabled={acciones.comenzarDeshabilitado}>
        <IconoPlay /> Comenzar a leer
      </button>
      <div className="sv-acciones">
        <button type="button" className="sv-btn-claro" onClick={onFicha}><IconoInfo /> Ficha</button>
        <button type="button" className="sv-btn-claro" onClick={acciones.guardar} disabled={acciones.guardarDeshabilitado}>
          {yaAdquirido ? '✓ En tu biblioteca' : <><IconoGuardar /> Guardar en mi biblioteca</>}
        </button>
      </div>
      {acciones.comenzarDeshabilitado && <p className="sv-limite">{acciones.aviso}</p>}
      <button type="button" className="sv-desliza" onClick={onDeslizar} disabled={!siguiente}>
        {siguiente ? <><IconoArriba /> Desliza · sigue {siguiente.titulo}</> : 'Es el último libro de esta sala'}
      </button>
    </>
  )
}

// El panel de la derecha con la historia del libro elegido. `children`
// son las acciones: van también en el libro que aún no tiene historia.
function PanelHistoria({ libro, sala, sentido, pausada, children }) {
  const { data: escenas = [], isLoading } = useLibroReelsQuery(libro.id)
  const alSalir = useCallback(({ escenasVistas, deTotal }) => {
    evento('historia_vista', { libro: libro.slug, sala, escenas_vistas: escenasVistas, de_total: deTotal })
  }, [libro.slug, sala])

  if (isLoading) return <div className="hist-estado"><p>Cargando la historia…</p></div>
  if (!escenas.length) {
    return (
      <div className="hist-estado sv-sin-historia">
        <CoverCard libro={libro} grande />
        <p>Este libro aún no tiene historia.</p>
        {children}
      </div>
    )
  }
  return (
    <Historia key={libro.id} libro={libro} escenas={escenas} pausada={pausada} alSalir={alSalir}
      className={sentido && `sv-entra-${sentido}`}>
      {children}
    </Historia>
  )
}

/**
 * @param {{ slug: string, catalogo: object[], loading: boolean, user: object|null, gatoColor?: string,
 *   tieneLibro: (id: string) => boolean, pendientes: number, bloqueado?: boolean,
 *   onComprar: (libro: object) => Promise<{ error: string|null }>, onEmpezarLeer: (libro: object) => void,
 *   onVolver: () => void, onIrSala: (slug: string) => void }} props
 */
export default function SalaVista({ slug, catalogo, loading, user, gatoColor = 'negro', tieneLibro, pendientes, bloqueado = false, onComprar, onEmpezarLeer, onVolver, onIrSala }) {
  const navigate = useNavigate()
  const { sala, isError, libros, estanterias, secuencia, indiceDe, otras, librosDe } = useSala(slug, catalogo)
  const { libro: fichaLibro, abrir: abrirFicha, cerrar: cerrarFicha } = useFichaEnUrl(catalogo)
  const [sel, setSel] = useState(-1)
  const [pagina, setPagina] = useState(0)
  const [sentido, setSentido] = useState('')   // 'sube' | 'baja': hacia dónde entra la historia
  const libroSel = secuencia[sel] || null
  const siguiente = sel >= 0 ? secuencia[sel + 1] || null : null

  const seleccionar = (i, haciaSentido) => {
    setSel(i)
    setSentido(haciaSentido)
    setPagina(estanteriaDe(i))
  }
  const elegir = (i) => { if (i !== sel) seleccionar(i, i > sel ? 'sube' : 'baja') }
  const deslizar = (delta) => {
    const hacia = sel + delta
    if (sel < 0 || hacia < 0 || hacia >= secuencia.length) return
    evento('historia_desliza', { sala: slug, desde: secuencia[sel].slug, hacia: secuencia[hacia].slug })
    seleccionar(hacia, delta > 0 ? 'sube' : 'baja')
  }
  // Los manejadores nativos (rueda, teclado) leen siempre la última versión.
  const deslizarRef = useRef(deslizar)
  useEffect(() => { deslizarRef.current = deslizar })

  // Rueda sobre el panel: el listener es nativo y no pasivo para poder
  // frenar el desplazamiento de la página.
  const panelRef = useRef(null)
  const haySel = sel >= 0
  useEffect(() => {
    const panel = panelRef.current
    if (!panel || !haySel) return
    let ultima = 0
    const h = (e) => {
      e.preventDefault()
      const ahora = Date.now()
      if (ahora - ultima < RUEDA_PAUSA_MS || Math.abs(e.deltaY) < RUEDA_MIN_DELTA) return
      ultima = ahora
      deslizarRef.current(e.deltaY > 0 ? 1 : -1)
    }
    panel.addEventListener('wheel', h, { passive: false })
    return () => panel.removeEventListener('wheel', h)
  }, [haySel])

  // ↓ / ↑ con la ficha cerrada y fuera del buscador.
  const fichaAbierta = !!fichaLibro
  useEffect(() => {
    if (fichaAbierta) return
    const h = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      if (e.key === 'ArrowDown') { e.preventDefault(); deslizarRef.current(1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); deslizarRef.current(-1) }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [fichaAbierta])

  // Aviso al guardar («quedó en tu biblioteca · N de 5»).
  const { aviso, guardar } = useAvisoGuardar(onComprar, pendientes)

  // Buscador: busca en toda la tienda, en el catálogo completo.
  const [q, setQ] = useState('')
  const buscar = (e) => {
    e.preventDefault()
    if (q.trim()) navigate(`/tienda/catalogo?q=${encodeURIComponent(q.trim())}`)
  }

  // Pasillo: las demás salas visitables. Flechas solo si no caben.
  // La pista se guarda en estado (no en un ref): aparece cuando la sala
  // termina de cargar, y es entonces cuando hay que medirla.
  const [pista, setPista] = useState(null)
  const [pasilloDesborda, setPasilloDesborda] = useState(false)
  useEffect(() => {
    if (!pista) return
    const medir = () => setPasilloDesborda(pista.scrollWidth > pista.clientWidth + 2)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(pista)
    return () => ro.disconnect()
  }, [pista])
  const moverPasillo = (dir) => pista?.scrollBy({ left: dir * pista.clientWidth * 0.8, behavior: 'smooth' })

  const cabecera = (
    <CabeceraTienda etiquetaAtras="Tienda" onAtras={onVolver} user={user}>
      <form className="tp-buscador" role="search" onSubmit={buscar}>
        <IconoBuscar />
        <input type="text" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Busca en toda la tienda…" aria-label="Buscar en toda la tienda" />
      </form>
    </CabeceraTienda>
  )

  if (isError) {
    return (
      <div className="sv sv-sin-sala">
        {cabecera}
        <p className="sv-estado">No pudimos abrir la sala. <button type="button" className="tp-pill" onClick={onVolver}>Volver a la tienda</button></p>
      </div>
    )
  }
  if (!sala || loading) {
    return (
      <div className="sv sv-sin-sala">
        {cabecera}
        <p className="sv-estado">Abriendo la sala…</p>
      </div>
    )
  }

  const pared = `radial-gradient(ellipse at 30% 30%, rgba(255,190,110,.22), transparent 46%), linear-gradient(180deg, ${mezclar(sala.color, '#140c08', 0.55)} 0%, ${mezclar(sala.color, '#140c08', 0.74)} 100%)`
  const baldas = estanterias[pagina] || []

  return (
    <div className="sv" style={{ background: pared }}>
      {cabecera}

      <div className="sv-cuerpo">
        <section className="sv-izq" aria-label={sala.nombre}>
          <div className="sv-cartel">
            <h1>{sala.nombre}</h1>
            <span>{sala.genero || 'Temporada'} · {libros.length} {libros.length === 1 ? 'libro' : 'libros'}</span>
          </div>

          <div className="sv-estanterias">
            {libros.length === 0 && <p className="sv-estado">Esta sala aún no tiene libros.</p>}
            {baldas.map((balda, b) => (
              <div className="sv-balda" key={`${pagina}-${b}`}>
                <div className="sv-balda-libros">
                  {balda.map(({ libro, lomo }) => {
                    const i = indiceDe.get(libro.id)
                    const propio = tieneLibro(libro.id)
                    return (
                      <button key={libro.id} type="button" className={clsx('sv-libro', i === sel && 'sel')}
                        onClick={() => elegir(i)} aria-pressed={i === sel}
                        aria-label={`${libro.titulo}, ${libro.autor}${propio ? ' (ya está en tu biblioteca)' : ''}`}>
                        {lomo ? <Lomo libro={libro} className="sv-lomo" ancho={34 + (libro.titulo.length % 4) * 4} /> : <CoverCard libro={libro} />}
                        {propio && !lomo && <span className="tp-check" aria-hidden="true">✓</span>}
                      </button>
                    )
                  })}
                </div>
                <div className="sv-tabla" aria-hidden="true" />
              </div>
            ))}
          </div>

          {estanterias.length > 1 && (
            <div className="sv-numerador">
              <button type="button" onClick={() => setPagina(p => p - 1)} disabled={pagina === 0} aria-label="Estantería anterior"><Flecha dir={-1} /></button>
              <span>Estantería {pagina + 1} de {estanterias.length}</span>
              <button type="button" onClick={() => setPagina(p => p + 1)} disabled={pagina >= estanterias.length - 1} aria-label="Estantería siguiente"><Flecha dir={1} /></button>
            </div>
          )}
        </section>

        {otras.length > 0 && (
          <nav className="sv-pasillo" aria-label="Otras salas">
            <span className="sv-pasillo-lbl">Otras salas</span>
            {pasilloDesborda && <button type="button" className="sv-flecha" onClick={() => moverPasillo(-1)} aria-label="Salas anteriores"><Flecha dir={-1} /></button>}
            <div className="sv-pasillo-pista" ref={setPista}>
              {otras.map(s => (
                <SalaCard key={s.id} sala={s} numLibros={librosDe(s).length} compacta onAbrir={() => onIrSala(s.slug)} />
              ))}
            </div>
            {pasilloDesborda && <button type="button" className="sv-flecha" onClick={() => moverPasillo(1)} aria-label="Más salas"><Flecha dir={1} /></button>}
          </nav>
        )}

        <aside className="sv-der">
          <div className="sv-panel" ref={panelRef}>
            {libroSel ? (
              <PanelHistoria libro={libroSel} sala={slug} sentido={sentido} pausada={fichaAbierta}>
                <AccionesHistoria
                  libro={libroSel}
                  user={user}
                  yaAdquirido={tieneLibro(libroSel.id)}
                  bloqueado={bloqueado}
                  onComenzar={() => onEmpezarLeer(libroSel)}
                  onGuardar={() => guardar(libroSel)}
                  onFicha={() => abrirFicha(libroSel)}
                  siguiente={siguiente}
                  onDeslizar={() => deslizar(1)}
                />
              </PanelHistoria>
            ) : (
              <div className="sv-invitacion">
                <img src={`/assets/tienda/gato-${gatoColor}-4.webp`} alt="" />
                {sala.linea && <p>{sala.linea}</p>}
                <small>Toca un libro del estante para ver su historia.</small>
              </div>
            )}
          </div>
          {siguiente && <PrecargaHistoria libroId={siguiente.id} />}
        </aside>
      </div>

      <div className={clsx('sv-aviso', aviso && 'on')} role="status" aria-live="polite">{aviso}</div>

      {fichaLibro && (
        <FichaLibro
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
