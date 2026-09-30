// Comunidades (móvil) — ruta /comunidades. Se llega desde la hoja "Leer
// como" de la Biblioteca (LeerComoSheet) con `vistaInicial`:
//   · 'buscar'     → buscador de públicas (máx. 20 resultados)
//   · 'crear'      → formulario (solo creadores), con su selector de libro
//   · 'invitacion' → la hoja del código abierta sobre la vista inicio
//   · sin vista    → inicio: Mis comunidades + los tres botones
// Al unirse o crear, la comunidad queda activa y se vuelve a la Biblioteca
// con su panel abierto (onListo). Tocar una de mis comunidades hace lo
// mismo, sin cambiar la activa.
// En escritorio lo mismo vive en la barra naranja (ComunidadesMenu.jsx).
import { useState } from 'react'
import {
  useMisComunidadesQuery, useBuscarComunidadesQuery, useUnirseComunidad, usePuedeCrearComunidadQuery, useComunidadActiva,
  TOPE_COMUNIDADES, normalizarCodigo,
} from '../../hooks/useComunidades.js'
import { FilaMiComunidad, FilaResultado, IconoLupa, useDebounced } from '../comunidades/comunidadesShared.jsx'
import { CrearComunidadPantalla } from '../comunidades/CrearComunidad.jsx'
import '../../styles/comunidades.css'
import '../../styles/comunidades.mobile.css'
import { ModalDenunciaComunidad } from '../comunidades/DenunciarComunidad.jsx'

const TITULOS = { inicio: 'Comunidades', buscar: 'Buscar', crear: 'Crear comunidad' }

// onListo(id, bienvenida?): vuelve a la Biblioteca con el panel de esa
// comunidad abierto. `bienvenida` = { privada, codigo } tras crearla.
export default function ComunidadesMobile({ user, vistaInicial = null, onGoBack, onListo }) {
  const [vista, setVista] = useState(vistaInicial === 'buscar' || vistaInicial === 'crear' ? vistaInicial : 'inicio')
  const [eligiendoLibro, setEligiendoLibro] = useState(false)
  const [hojaCodigo, setHojaCodigo] = useState(vistaInicial === 'invitacion')
  const { data: puedeCrear = false } = usePuedeCrearComunidadQuery(user?.id)
  const { setActiva } = useComunidadActiva(user?.id)

  // Si se llegó directo a una vista desde la hoja "Leer como", "atrás"
  // vuelve a la Biblioteca, no a la vista inicio.
  const atras = () => {
    if (vista === 'crear' && eligiendoLibro) setEligiendoLibro(false)
    else if (vista !== 'inicio' && !vistaInicial) setVista('inicio')
    else onGoBack()
  }

  const entrar = (id, bienvenida) => { setActiva(id); onListo(id, bienvenida) }

  const { data: mias = [], isLoading, isError } = useMisComunidadesQuery(user?.id)
  const enTope = mias.length >= TOPE_COMUNIDADES
  const unirseApi = useUnirseComunidad(user?.id)

  return (
    <div className="comm-screen">
      <div className="comm-top">
        <button type="button" className="com-btn comm-back" aria-label="Volver" onClick={atras}>‹</button>
        <h1>{vista === 'crear' && eligiendoLibro ? 'Primera lectura' : TITULOS[vista]}</h1>
      </div>

      {vista === 'inicio' ? (
        <div className="comm-body">
          <section className="comm-sec">
            <div className="comm-sec-head">
              <h2 className="com-label">Mis comunidades</h2>
              {mias.length > 0 && <span className="comm-count">{mias.length} de {TOPE_COMUNIDADES}</span>}
            </div>
            {isLoading ? (
              <p className="com-dd-msg">Cargando tus comunidades…</p>
            ) : isError ? (
              <p className="com-dd-msg">No pudimos cargar tus comunidades. Revisa tu conexión.</p>
            ) : mias.length === 0 ? (
              <div className="comm-empty">
                <b>No perteneces a ninguna comunidad</b>
                <p>Busca una comunidad pública o únete con el código que te pasó un amigo.</p>
              </div>
            ) : (
              <div className="com-list comm-list">
                {mias.map(c => <FilaMiComunidad key={c.id} c={c} onOpen={(id) => onListo(id)} />)}
              </div>
            )}
          </section>

          <div className="comm-actions">
            <button type="button" className="com-btn" onClick={() => setVista('buscar')}>
              <IconoLupa />Buscar comunidades
            </button>
            <button type="button" className="com-btn" onClick={() => setHojaCodigo(true)}>
              Tengo una invitación
            </button>
            {puedeCrear && (
              <button type="button" className="com-btn solid" disabled={enTope} onClick={() => setVista('crear')}>
                Crear comunidad
              </button>
            )}
          </div>
        </div>
      ) : vista === 'buscar' ? (
        <Buscar user={user} enTope={enTope} unirseApi={unirseApi} onOpen={entrar} />
      ) : (
        <CrearComunidadPantalla user={user} eligiendo={eligiendoLibro} setEligiendo={setEligiendoLibro}
          onCreada={({ id, privada, codigo }) => entrar(id, { privada, codigo })} />
      )}

      {hojaCodigo && (
        <HojaCodigo enTope={enTope} unirseApi={unirseApi} onOpen={entrar}
          onClose={() => (vistaInicial === 'invitacion' ? onGoBack() : setHojaCodigo(false))} />
      )}
    </div>
  )
}

function Buscar({ user, enTope, unirseApi, onOpen }) {
  const { unirse, pendiente } = unirseApi
  const [texto, setTexto] = useState('')
  const [error, setError] = useState(null)
  const textoDebounced = useDebounced(texto)
  const { data: resultados = [], isLoading, isError } = useBuscarComunidadesQuery(textoDebounced)
  const [denunciando, setDenunciando] = useState(null)

  const unirseA = async (id) => {
    setError(null)
    const r = await unirse(id)
    if (r.error) setError(r.error)
    else onOpen(r.id)
  }

  return (
    <div className="comm-body">
      {denunciando && <ModalDenunciaComunidad user={user} c={denunciando} onClose={() => setDenunciando(null)} />}
      <span className="com-input">
        <IconoLupa />
        <input value={texto} placeholder="Nombre de la comunidad o del libro" autoComplete="off"
          aria-label="Buscar comunidades" onChange={e => setTexto(e.target.value)} />
      </span>
      <div className="com-results comm-list">
        {isLoading ? <p className="com-dd-msg">Buscando…</p>
          : isError ? <p className="com-dd-msg">No pudimos buscar. Revisa tu conexión.</p>
          : resultados.length === 0 ? <p className="com-dd-msg">{texto.trim() ? 'Ninguna comunidad pública coincide.' : 'Todavía no hay comunidades públicas.'}</p>
          : resultados.map(c => (
              <FilaResultado key={c.id} c={c} onUnirse={unirseA} onOpen={onOpen} pendiente={pendiente} enTope={enTope} onDenunciar={setDenunciando} />
            ))}
      </div>
      {error && <p className="com-error" role="alert">{error}</p>}
      <p className="com-nota">
        {enTope
          ? `Ya estás en ${TOPE_COMUNIDADES} comunidades, el máximo. Sal de una para unirte a otra.`
          : 'Hasta 20 resultados. Escribe más para afinar.'}
      </p>
    </div>
  )
}

function HojaCodigo({ enTope, unirseApi, onOpen, onClose }) {
  const { unirseConCodigo, pendiente } = unirseApi
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)
    const r = await unirseConCodigo(codigo)
    if (r.error) setError(r.error)
    else onOpen(r.id)
  }

  return (
    <div className="comm-sheet-wrap">
      <div className="comm-sheet-dim" onClick={onClose} />
      <form className="comm-sheet" onSubmit={enviar} role="dialog" aria-label="Unirte con una invitación">
        <span className="comm-grab" aria-hidden="true" />
        <h2>Unirte con una invitación</h2>
        <p>Escribe el código que te compartió el moderador de la comunidad.</p>
        <span className="com-input code">
          <input value={codigo} maxLength={20} autoComplete="off" spellCheck="false" autoFocus
            placeholder="Código" aria-label="Código de invitación"
            onChange={e => { setCodigo(normalizarCodigo(e.target.value)); setError(null) }} />
        </span>
        {error && <p className="com-error" role="alert">{error}</p>}
        {enTope && <p className="com-nota">Ya estás en {TOPE_COMUNIDADES} comunidades, el máximo.</p>}
        <button type="submit" className="com-btn solid comm-big" disabled={enTope || pendiente === 'codigo'}>
          {pendiente === 'codigo' ? 'Uniendo…' : 'Unirme'}
        </button>
      </form>
    </div>
  )
}
