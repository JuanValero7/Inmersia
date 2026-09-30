// Capa de comunidad en el lector MÓVIL.
//
// useCapaMovil devuelve las piezas que reparte LectorMobile:
//   · chip         → botón solo-ícono en la fila de controles (on/off directo)
//   · herramienta  → entrada "Comunidad" para la bandeja del gato
//   · overlay      → la capa de la hoja (caritas, listón, modo elegir)
//   · capas        → banner de "toca el párrafo", aviso y hojas (sheets)
// Si no hay comunidad para este libro (o es invitado / tutorial): activa=false.
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  useCapaNucleo, CapaHoja, Hilo, Nota, FormComentario, FormMensajito, ListaMensajitos,
  iniciosDePagina, anclaDePagina,
} from './capaShared.jsx'
import '../../../styles/comunidades.css'
import '../../../styles/comunidades.mobile.css'

const IcGente = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
)
const IcCerrar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12"/></svg>
)
// Icono ilustrado para la bandeja del gato: dos globos, el tuyo en naranja
export const IconoComunidadBandeja = () => (
  <span style={{ width: 48, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M20 8h18a5 5 0 015 5v11a5 5 0 01-5 5h-2v6l-6-6h-10a5 5 0 01-5-5V13a5 5 0 015-5z" fill="#e7dcc2" stroke="#4a3622" strokeWidth="2.4" strokeLinejoin="round"/>
      <path d="M9 17h17a5 5 0 015 5v10a5 5 0 01-5 5H16l-7 6v-6a5 5 0 01-5-5V22a5 5 0 015-5z" fill="#F2792A" stroke="#4a3622" strokeWidth="2.4" strokeLinejoin="round"/>
      <g fill="#fff"><circle cx="12.5" cy="27" r="2"/><circle cx="19" cy="27" r="2"/><circle cx="25.5" cy="27" r="2"/></g>
    </svg>
  </span>
)

function Hoja({ titulo, sub, onCerrar, children, pie }) {
  return (
    <div className="lm-backdrop" onClick={onCerrar}>
      <div className="lm-sheet cl-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="lm-grip" />
        <div className="lm-sheet-head">
          <span className="lm-sheet-title">{titulo}{sub && <em className="cl-sheet-sub">{sub}</em>}</span>
          <button type="button" className="lm-close" aria-label="Cerrar" onClick={onCerrar}><IcCerrar /></button>
        </div>
        <div className="cl-sheet-body">{children}</div>
        {pie && <div className="cl-sheet-pie">{pie}</div>}
      </div>
    </div>
  )
}

export function useCapaMovil({ userId, libroId, capituloId, paginas, pageIndex, deshabilitada, medida, noche, onAntesDeElegir }) {
  const nucleo = useCapaNucleo({ userId, libroId, capituloId, deshabilitada })
  const [eligiendo, setEligiendo] = useState(false)
  const [hoja, setHojaRaw] = useState(null)   // { tipo, ... }
  const hojaRef = useRef(null)
  const setHoja = useCallback((v) => { hojaRef.current = v; setHojaRaw(v) }, [])
  const { borrarMensajito, marcarLeido, setOn, on } = nucleo

  // Cerrar la hoja. Un mensajito efímero recibido se borra aquí, al cerrarlo.
  const cerrar = useCallback(() => {
    const prev = hojaRef.current
    if (prev?.tipo === 'nota' && prev.m.efimero && !prev.m.mio) borrarMensajito(prev.m.id).catch(() => {})
    setHoja(null)
  }, [borrarMensajito, setHoja])

  useEffect(() => { setEligiendo(false) }, [pageIndex, capituloId])
  useEffect(() => { if (!on) { setEligiendo(false); setHoja(null) } }, [on, setHoja])

  const abrirNota = useCallback((m) => {
    setHoja({ tipo: 'nota', m })
    if (m.sinLeer) marcarLeido(m.id)
  }, [setHoja, marcarLeido])
  const abrirMensajitos = useCallback((lista) => {
    if (lista.length === 1) abrirNota(lista[0])
    else setHoja({ tipo: 'lista', lista })
  }, [abrirNota, setHoja])
  const empezarAElegir = useCallback(() => {
    onAntesDeElegir?.()
    setHoja(null); setEligiendo(true)
  }, [onAntesDeElegir, setHoja])

  if (!nucleo.activa) return { activa: false, chip: null, herramienta: null, overlay: null, capas: null }

  const { comunidad } = nucleo

  const chip = (
    <button type="button" className={'lm-ctrl cl-chip-m' + (on ? ' on' : '')} aria-label="Comunidad" aria-pressed={on}
      title={on ? 'Ocultar la comunidad' : 'Mostrar la comunidad'} onClick={() => setOn(!on)}>
      <IcGente />
      {nucleo.punto && <span className="cl-punto" aria-label="Tienes un mensajito sin abrir" />}
    </button>
  )

  const herramienta = {
    key: 'comunidad', label: 'Comunidad', icon: <IconoComunidadBandeja />,
    act: () => { if (!on) setOn(true); nucleo.cerrarAviso(); setHoja({ tipo: 'elegir' }) },
  }

  const overlay = paginas[pageIndex]?.length ? (
    <CapaHoja nucleo={nucleo} fragmentos={paginas[pageIndex]} inicios={iniciosDePagina(paginas, pageIndex)}
      ladoListon="der" margen={5} medida={medida} seleccionando={eligiendo} noche={noche}
      onElegir={(parrafoId, cita) => { setEligiendo(false); setHoja({ tipo: 'comentar', parrafoId, cita }) }}
      onAbrirHilo={(parrafoId) => setHoja({ tipo: 'hilo', parrafoId, pos: 0 })}
      onAbrirMensajitos={(lista) => abrirMensajitos(lista)}
      hiloActivo={hoja?.tipo === 'hilo' ? hoja.parrafoId : null} />
  ) : null

  const nuevoMensajito = () => setHoja({ tipo: 'mensajito', parrafoId: anclaDePagina(paginas, pageIndex) })

  let sheet = null
  if (hoja?.tipo === 'elegir') sheet = (
    <Hoja titulo="Dejar algo" sub={`En ${comunidad.nombre}`} onCerrar={cerrar}>
      <div className="lm-nav-grid cl-elegir">
        <button type="button" onClick={empezarAElegir}>
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M9 8h30a5 5 0 015 5v18a5 5 0 01-5 5H20l-9 7v-7H9a5 5 0 01-5-5V13a5 5 0 015-5z" fill="#F2792A" stroke="#4a3622" strokeWidth="2.6" strokeLinejoin="round"/><g stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><path d="M13 18h22M13 26h14"/></g></svg>
          Comentario
          <span className="sub">Queda en el párrafo,<br />lo ve toda la comunidad</span>
        </button>
        <button type="button" onClick={nuevoMensajito}>
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="5" y="20" width="38" height="22" rx="4" fill="#e7dcc2" stroke="#4a3622" strokeWidth="2.6"/><rect x="19" y="20" width="10" height="22" fill="#BE6173" stroke="#4a3622" strokeWidth="2.2"/><rect x="3" y="14" width="42" height="9" rx="3" fill="#f3ead6" stroke="#4a3622" strokeWidth="2.4"/><rect x="19" y="14" width="10" height="9" fill="#BE6173" stroke="#4a3622" strokeWidth="2.2"/><ellipse cx="18" cy="9" rx="6.5" ry="4.6" transform="rotate(-22 18 9)" fill="#d98a99" stroke="#4a3622" strokeWidth="2.2"/><ellipse cx="30" cy="9" rx="6.5" ry="4.6" transform="rotate(22 30 9)" fill="#d98a99" stroke="#4a3622" strokeWidth="2.2"/><circle cx="24" cy="11" r="3.2" fill="#BE6173" stroke="#4a3622" strokeWidth="2"/></svg>
          Mensajito
          <span className="sub">Solo para quien<br />tú elijas</span>
        </button>
      </div>
    </Hoja>
  )
  if (hoja?.tipo === 'comentar') sheet = (
    <Hoja titulo="Tu comentario" onCerrar={cerrar}>
      <FormComentario nucleo={nucleo} parrafoId={hoja.parrafoId} cita={hoja.cita} movil
        onCancelar={cerrar} onListo={() => setHoja({ tipo: 'hilo', parrafoId: hoja.parrafoId, pos: 999 })} />
    </Hoja>
  )
  if (hoja?.tipo === 'hilo') {
    const n = nucleo.comentariosPorParrafo[hoja.parrafoId]?.length || 0
    sheet = (
      <Hoja titulo="Comentarios" sub={n ? `${n} en este párrafo` : null} onCerrar={cerrar}>
        <Hilo nucleo={nucleo} parrafoId={hoja.parrafoId} pos={Math.min(hoja.pos, Math.max(0, n - 1))}
          setPos={(p) => setHoja({ ...hoja, pos: p })} onVacio={cerrar} />
      </Hoja>
    )
  }
  if (hoja?.tipo === 'lista') sheet = (
    <Hoja titulo="Mensajitos" sub="En esta página" onCerrar={cerrar}
      pie={<button type="button" className="cl-btn primario grande" onClick={nuevoMensajito}>Escribir uno</button>}>
      <ListaMensajitos lista={hoja.lista} onAbrir={abrirNota} />
    </Hoja>
  )
  if (hoja?.tipo === 'nota') sheet = (
    <Hoja titulo={hoja.m.mio ? `Para ${hoja.m.otra.corto}` : `De ${hoja.m.otra.corto}`} onCerrar={cerrar}>
      <Nota nucleo={nucleo} m={hoja.m} />
    </Hoja>
  )
  if (hoja?.tipo === 'mensajito') sheet = (
    <Hoja titulo="Mensajito" sub="Queda en esta página" onCerrar={cerrar}>
      <FormMensajito nucleo={nucleo} parrafoId={hoja.parrafoId} movil onCancelar={cerrar} onListo={() => setHoja(null)} />
    </Hoja>
  )

  const capas = (
    <>
      {nucleo.aviso && (
        <div className="cl-aviso-m" role="status">
          <span><b>{comunidad.nombre}</b> también leyó este libro. Toca el ícono de <b>Comunidad</b> para ver sus comentarios.</span>
          <button type="button" aria-label="Cerrar aviso" onClick={nucleo.cerrarAviso}>✕</button>
        </div>
      )}
      {eligiendo && (
        <div className="lm-sub-banner">
          <span>Toca el párrafo donde va tu comentario</span>
          <button type="button" aria-label="Cancelar" onClick={() => setEligiendo(false)}>&#x2715;</button>
        </div>
      )}
      {sheet}
    </>
  )

  return { activa: true, chip, herramienta, overlay, capas, eligiendo }
}
