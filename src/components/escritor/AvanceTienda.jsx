// Avance de la tienda (Sala de imágenes, migración 119). Es lo que ve la
// gente en la ficha del libro antes de abrirlo: 5 escenas verticales con
// título, un texto corto y música (libro_reels). Decisiones de Juan
// (13 nov 2026): crearlo es GRATIS; los textos se cambian gratis; otra
// imagen u otra música, 0,25 $. Lo arma el worker con los scripts de
// siempre (preview_analyze + preview_generate) y el estilo elegido.
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, useLibroReelsQuery } from '../../lib/queries.js'
import {
  usePreciosEscritor, useTrabajo, usePedirTrabajo, useGuardarTextoAvance, mensajeErrorEscritor,
} from '../../hooks/useEscritor.js'
import { AvanceLibro } from '../tienda/Historia.jsx'
import { SelectorEstilo, EnMarcha } from './Ilustraciones.jsx'

const EN_MARCHA = ['pendiente', 'en_proceso']
const dinero = (n) => `${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`

/**
 * @param {object} props
 * @param {{ id: string }} props.user
 * @param {{ id: string, titulo: string, autor?: string, portada_url?: string|null }} props.libro
 * @param {number} props.saldo
 */
export default function AvanceTienda({ user, libro, saldo }) {
  const qc = useQueryClient()
  const { data: precios } = usePreciosEscritor()
  const { data: escenas = [], isLoading } = useLibroReelsQuery(libro.id)
  const { data: avance } = useTrabajo(libro.id, 'avance')
  const { data: rehacer } = useTrabajo(libro.id, 'avance_rehacer')
  const { data: ilus } = useTrabajo(libro.id, 'ilustraciones_analisis')
  const creando = EN_MARCHA.includes(avance?.estado)
  const rehaciendo = EN_MARCHA.includes(rehacer?.estado)
  const [deNuevo, setDeNuevo] = useState(false)
  const [ver, setVer] = useState(false)

  // Al terminar un trabajo: avance y saldo al día.
  const estados = `${avance?.estado}|${avance?.id}|${rehacer?.estado}|${rehacer?.id}`
  useEffect(() => {
    qc.invalidateQueries({ queryKey: queryKeys.libroReels(libro.id) })
    qc.invalidateQueries({ queryKey: queryKeys.escritor(user?.id) })
    setDeNuevo(false)
  }, [estados, qc, libro.id, user?.id])

  if (isLoading) return <section className="esc-vidrio"><p>Cargando…</p></section>

  if (creando) {
    return (
      <section className="esc-vidrio">
        <EnMarcha trabajo={avance} texto="Preparando tu avance" />
      </section>
    )
  }

  if (!escenas.length || deNuevo) {
    return (
      <section className="esc-vidrio">
        <Crear user={user} libro={libro} hay={escenas.length > 0} avance={avance}
          estiloInicial={avance?.parametros?.estilo ?? ilus?.parametros?.estilo ?? 2}
          onCancelar={escenas.length ? () => setDeNuevo(false) : null} />
      </section>
    )
  }

  const precio = Number(precios?.avance_rehacer ?? 0.25)
  return (
    <section className="esc-vidrio">
      <div className="esc-avance-cab">
        <p>Así se presenta tu libro en la tienda. Cambia los textos cuando quieras, gratis.</p>
        <span className="esc-hueco" />
        <button type="button" className="esc-pill esc-naranja" onClick={() => setVer(true)}>▶ Verlo como en la tienda</button>
      </div>
      {rehaciendo && <EnMarcha trabajo={rehacer} texto="Rehaciendo" />}
      {rehacer?.estado === 'error' && <div className="esc-alerta esc-error"><span>⚠️</span><span>{rehacer.error}</span></div>}

      <div className="esc-avance-escenas">
        {escenas.map(e => (
          <Escena key={`${e.id}-${e.imagen_url}`} user={user} libro={libro} escena={e} precio={precio}
            saldo={saldo} ocupado={rehaciendo} />
        ))}
      </div>

      <Musica user={user} libro={libro} url={escenas[0]?.audio_url} precio={precio} saldo={saldo} ocupado={rehaciendo} />

      <p className="esc-letra">
        ¿No te convence nada? <button type="button" className="esc-borrar" onClick={() => setDeNuevo(true)}>Hacerlo de nuevo</button> (gratis; reemplaza este).
      </p>

      {ver && (
        <AvanceLibro libro={libro} onCerrar={() => setVer(false)} onComenzar={() => setVer(false)} comenzarDeshabilitado />
      )}
    </section>
  )
}

// ── Crear (o rehacer entero) ──────────────────────────────────

function Crear({ user, libro, hay, avance, estiloInicial, onCancelar }) {
  const pedir = usePedirTrabajo(user?.id, libro.id, 'avance')
  const [estilo, setEstilo] = useState(estiloInicial)
  const [error, setError] = useState('')
  const crear = async () => {
    setError('')
    try { await pedir.mutateAsync({ estilo }) } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos pedirlo.')) }
  }
  return (
    <>
      <p>
        El avance es lo primero que ve la gente en la tienda: <b>5 escenas</b> de tu libro en vertical, cada una con un
        título corto, y <b>música</b> de fondo. Lo preparamos leyendo tu libro, sin contar el final. <b>Es gratis.</b>
      </p>
      <p>Elige el estilo de las imágenes:</p>
      <SelectorEstilo estilo={estilo} setEstilo={setEstilo} deshabilitado={pedir.isPending} />
      <div className="esc-avance-cab">
        <button type="button" className="esc-pill esc-naranja" onClick={crear} disabled={pedir.isPending}>
          {hay ? 'Hacer un avance nuevo · gratis' : 'Crear mi avance · gratis'}
        </button>
        {onCancelar && <button type="button" className="esc-borrar" onClick={onCancelar}>Mejor me quedo con el que tengo</button>}
      </div>
      {hay && <p className="esc-letra">El nuevo reemplaza al que tienes ahora cuando esté listo.</p>}
      {avance?.estado === 'error' && <div className="esc-alerta esc-error"><span>⚠️</span><span>{avance.error}</span></div>}
      {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
    </>
  )
}

// ── Una escena: imagen + textos editables + otra imagen ───────

function Escena({ user, libro, escena, precio, saldo, ocupado }) {
  const guardar = useGuardarTextoAvance(libro.id)
  const pedir = usePedirTrabajo(user?.id, libro.id, 'avance_rehacer')
  const [titulo, setTitulo] = useState(escena.titulo || '')
  const [subtexto, setSubtexto] = useState(escena.subtexto || '')
  const [msg, setMsg] = useState('')
  const cambiado = titulo !== (escena.titulo || '') || subtexto !== (escena.subtexto || '')

  const onGuardar = async () => {
    setMsg('')
    try { await guardar.mutateAsync({ orden: escena.orden, titulo, subtexto }); setMsg('Guardado') }
    catch (e) { setMsg(mensajeErrorEscritor(e, 'No se pudo guardar.')) }
  }
  const otraImagen = async () => {
    if (!window.confirm(`¿Otra imagen para la escena ${escena.orden}? Cuesta ${dinero(precio)} y reemplaza la actual.`)) return
    setMsg('')
    try { await pedir.mutateAsync({ orden: escena.orden }) } catch (e) { setMsg(mensajeErrorEscritor(e, 'No pudimos pedirla.')) }
  }

  return (
    <div className="esc-avance-escena">
      <div className="esc-avance-img"><img src={escena.imagen_url} alt="" loading="lazy" /><span>{escena.orden}</span></div>
      <input type="text" value={titulo} maxLength={80} onChange={(e) => { setTitulo(e.target.value); setMsg('') }}
        aria-label={`Título de la escena ${escena.orden}`} />
      <textarea value={subtexto} maxLength={240} rows={3} onChange={(e) => { setSubtexto(e.target.value); setMsg('') }}
        aria-label={`Texto de la escena ${escena.orden}`} />
      <div className="esc-avance-acciones">
        {cambiado
          ? <button type="button" className="esc-pill esc-naranja esc-chica" onClick={onGuardar} disabled={guardar.isPending || !titulo.trim()}>Guardar</button>
          : <button type="button" className="esc-pill esc-chica" onClick={otraImagen} disabled={ocupado || pedir.isPending || saldo < precio}>Otra imagen · {dinero(precio)}</button>}
        {msg && <small>{msg}</small>}
      </div>
    </div>
  )
}

// ── La música ─────────────────────────────────────────────────

function Musica({ user, libro, url, precio, saldo, ocupado }) {
  const pedir = usePedirTrabajo(user?.id, libro.id, 'avance_rehacer')
  const [error, setError] = useState('')
  const otra = async () => {
    if (!window.confirm(`¿Otra música para el avance? Cuesta ${dinero(precio)} y reemplaza la actual.`)) return
    setError('')
    try { await pedir.mutateAsync({ musica: true }) } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos pedirla.')) }
  }
  return (
    <div className="esc-avance-musica">
      <b>Música</b>
      {url ? <audio controls preload="none" src={url} key={url} /> : <span className="esc-letra">Sin música</span>}
      <button type="button" className="esc-pill esc-chica" onClick={otra} disabled={ocupado || pedir.isPending || saldo < precio}>
        Otra música · {dinero(precio)}
      </button>
      {error && <small className="esc-falta">{error}</small>}
    </div>
  )
}
