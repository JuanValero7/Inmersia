// Capa de comunidad en el lector de ESCRITORIO.
//
// useCapaEscritorio devuelve tres piezas que el Lector reparte:
//   · chip        → pastilla "Comunidad" + su menú, en la barra del libro
//   · renderHoja  → la capa de cada hoja (caritas, listón, modo elegir)
//   · flotante    → la ventana de hilo / mensajito / formulario, siempre
//                   sobre la mesa, al lado de afuera de la hoja del ancla
// Si no hay comunidad para este libro (o es invitado / tutorial), todo es null.
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  useCapaNucleo, CapaHoja, Hilo, Nota, FormComentario, FormMensajito, ListaMensajitos,
  iniciosDePagina, anclaDePagina,
} from './capaShared.jsx'
import { Sello } from '../comunidadesShared.jsx'
import '../../../styles/comunidades.css'

const ANCHO = 290

const IcGente = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
)
const IcGlobo = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
)
const IcRegalo = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a3622" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 21V7"/><path d="M12 7a3 3 0 10-3-3c0 2 1.2 3 3 3z"/><path d="M12 7a3 3 0 113-3c0 2-1.2 3-3 3z"/></svg>
)

// Al lado de afuera de la hoja donde está el ancla; si no cabe en la mesa,
// al otro lado; si no cabe en ninguno, encima del libro junto al ancla.
function posicionar(ancla) {
  const libro = ancla.closest('.book-shadow') || ancla
  const b = libro.getBoundingClientRect(), a = ancla.getBoundingClientRect()
  let der = ancla === libro ? true : (a.left + a.width / 2) >= (b.left + b.width / 2)
  const cabeDer = window.innerWidth - b.right >= ANCHO + 30
  const cabeIzq = b.left >= ANCHO + 30
  if (der && !cabeDer && cabeIzq) der = false
  if (!der && !cabeIzq && cabeDer) der = true
  let left = der ? b.right + 22 : b.left - ANCHO - 22
  if (!cabeDer && !cabeIzq) left = Math.min(window.innerWidth - ANCHO - 12, Math.max(12, der ? a.left - ANCHO - 10 : a.right + 10))
  const top = ancla === libro ? b.top + 60 : a.top - 14
  return { left, top: Math.max(12, Math.min(window.innerHeight - 340, top)), der }
}

export function useCapaEscritorio({ userId, libroId, capituloId, paginas, pageIndex, doubleView, deshabilitada, medida, noche }) {
  const nucleo = useCapaNucleo({ userId, libroId, capituloId, deshabilitada })
  const [menuOpen, setMenuOpen] = useState(false)
  const [eligiendo, setEligiendo] = useState(false)
  const [abierto, setAbiertoRaw] = useState(null)   // { tipo, ancla, ... }
  const abiertoRef = useRef(null)
  const setAbierto = useCallback((v) => {
    setAbiertoRaw(prev => { const next = typeof v === 'function' ? v(prev) : v; abiertoRef.current = next; return next })
  }, [])
  const [pos, setPos] = useState(null)
  const flotRef = useRef(null)
  const chipRef = useRef(null)

  // Cerrar lo abierto. Un mensajito efímero recibido se borra aquí, al cerrarlo.
  const { borrarMensajito, marcarLeido } = nucleo
  const cerrar = useCallback(() => {
    const prev = abiertoRef.current
    if (prev?.tipo === 'nota' && prev.m.efimero && !prev.m.mio) borrarMensajito(prev.m.id).catch(() => {})
    setAbierto(null)
    setEligiendo(false)
  }, [borrarMensajito, setAbierto])

  // Cambiar de página o de capítulo: las anclas desaparecen
  useEffect(() => { cerrar() }, [pageIndex, capituloId, doubleView]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!nucleo.on) cerrar() }, [nucleo.on]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!abierto?.ancla?.isConnected) { setPos(null); return }
    setPos(posicionar(abierto.ancla))
  }, [abierto, medida])

  // Clic fuera y Esc
  useEffect(() => {
    if (!abierto && !eligiendo && !menuOpen) return
    const fuera = (e) => {
      if (e.target.closest('.cl-flot, .cl-caritas, .cl-liston, .cl-lamina')) return
      if (chipRef.current?.contains(e.target)) return
      setMenuOpen(false); cerrar()
    }
    const tecla = (e) => { if (e.key === 'Escape') { setMenuOpen(false); cerrar() } }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [abierto, eligiendo, menuOpen, cerrar])

  const abrirHilo = useCallback((parrafoId, ancla) => { cerrar(); setAbierto({ tipo: 'hilo', parrafoId, pos: 0, ancla }) }, [cerrar, setAbierto])
  const abrirNota = useCallback((m, ancla) => {
    cerrar(); setAbierto({ tipo: 'nota', m, ancla })
    if (m.sinLeer) marcarLeido(m.id)
  }, [cerrar, setAbierto, marcarLeido])
  const abrirMensajitos = useCallback((lista, ancla) => {
    if (lista.length === 1) abrirNota(lista[0], ancla)
    else { cerrar(); setAbierto({ tipo: 'lista', lista, ancla }) }
  }, [abrirNota, cerrar, setAbierto])
  const elegir = useCallback((parrafoId, cita, ancla) => {
    setEligiendo(false); setAbierto({ tipo: 'comentar', parrafoId, cita, ancla })
  }, [setAbierto])

  if (!nucleo.activa) return { activa: false, chip: null, renderHoja: () => null, flotante: null }

  const renderHoja = (idx, lado) => (paginas[idx]?.length ? (
    <CapaHoja nucleo={nucleo} fragmentos={paginas[idx]} inicios={iniciosDePagina(paginas, idx)}
      ladoListon={lado} margen={12} medida={medida} seleccionando={eligiendo}
      onElegir={elegir} onAbrirHilo={abrirHilo} onAbrirMensajitos={abrirMensajitos}
      hiloActivo={abierto?.tipo === 'hilo' ? abierto.parrafoId : null} noche={noche} />
  ) : null)

  const { comunidad, on, setOn } = nucleo
  const chip = (
    <div className="cl-chip-wrap" ref={chipRef}>
      <button type="button" className={'cl-pill' + (on ? ' on' : '')} aria-haspopup="menu" aria-expanded={menuOpen}
        onClick={() => { setMenuOpen(o => !o); nucleo.cerrarAviso() }}>
        <IcGente />Comunidad<span className="cl-caret">▼</span>
        {nucleo.punto && <span className="cl-punto" aria-label="Tienes un mensajito sin abrir" />}
      </button>
      {menuOpen && (
        <div className="cl-menu" role="menu">
          <div className="cl-menu-head">
            <Sello c={comunidad} tam="sm" />
            <div><b>{comunidad.nombre}</b><span>{nucleo.elegidaPorTi ? 'La elegimos por ti · se cambia en la Biblioteca' : 'Elegida en tu Biblioteca'}</span></div>
          </div>
          <div className="cl-menu-sw">
            <div><b>Mostrar la comunidad</b><span>{on ? 'Comentarios y mensajitos' : 'Oculta · solo tus subrayados'}</span></div>
            <button type="button" className="cl-sw" role="switch" aria-checked={on} aria-label="Mostrar la comunidad" onClick={() => setOn(!on)} />
          </div>
          <button type="button" className="cl-act" disabled={!on} onClick={() => { setMenuOpen(false); cerrar(); setEligiendo(true) }}>
            <span className="ic"><IcGlobo /></span><span className="tx">Agregar comentario<em>Eliges el párrafo</em></span>
          </button>
          <button type="button" className="cl-act" disabled={!on} onClick={() => {
            setMenuOpen(false); cerrar()
            const libro = chipRef.current?.closest('.desk')?.querySelector('.book-shadow')
            if (libro) setAbierto({ tipo: 'mensajito', parrafoId: anclaDePagina(paginas, pageIndex), ancla: libro })
          }}>
            <span className="ic"><IcRegalo /></span><span className="tx">Mensajito<em>Para alguien de la comunidad</em></span>
          </button>
        </div>
      )}
      {nucleo.aviso && !menuOpen && (
        <div className="cl-aviso" role="status">
          <span><b>{comunidad.nombre}</b> también leyó este libro. Enciende <b>Comunidad</b> para ver sus comentarios.</span>
          <button type="button" aria-label="Cerrar aviso" onClick={nucleo.cerrarAviso}>✕</button>
        </div>
      )}
    </div>
  )

  const cerrarBtn = <button type="button" className="cl-x" aria-label="Cerrar" onClick={cerrar}>✕</button>
  let contenido = null
  if (abierto?.tipo === 'hilo') contenido = (
    <Hilo nucleo={nucleo} parrafoId={abierto.parrafoId} pos={abierto.pos}
      setPos={(p) => setAbierto(a => ({ ...a, pos: p }))} onVacio={cerrar} cabeceraExtra={cerrarBtn} />
  )
  if (abierto?.tipo === 'nota') contenido = <Nota nucleo={nucleo} m={abierto.m} cabeceraExtra={cerrarBtn} />
  if (abierto?.tipo === 'lista') contenido = (
    <>
      <div className="cl-head"><div className="cl-quien"><b>Mensajitos en esta página</b></div><div className="cl-tools">{cerrarBtn}</div></div>
      <ListaMensajitos lista={abierto.lista} onAbrir={(m) => abrirNota(m, abierto.ancla)} />
    </>
  )
  if (abierto?.tipo === 'comentar') contenido = (
    <FormComentario nucleo={nucleo} parrafoId={abierto.parrafoId} cita={abierto.cita}
      onCancelar={cerrar} onListo={() => setAbierto(null)} />
  )
  if (abierto?.tipo === 'mensajito') contenido = (
    <FormMensajito nucleo={nucleo} parrafoId={abierto.parrafoId} onCancelar={cerrar} onListo={() => setAbierto(null)} />
  )

  const flotante = createPortal(
    <>
      {contenido && pos && (
        <div ref={flotRef} className={'cl-flot ' + (pos.der ? 'a-der' : 'a-izq')} style={{ left: pos.left, top: pos.top, width: ANCHO }}>
          {contenido}
          <span className="cl-guia" />
        </div>
      )}
      {eligiendo && (
        <div className="cl-hint" role="status">
          <span>Elige el párrafo donde va tu comentario</span><span className="cl-esc">Esc para cancelar</span>
        </div>
      )}
    </>,
    document.body,
  )

  return { activa: true, chip, renderHoja, flotante }
}
