// Comunidades (móvil) — ruta /comunidades. Se llega desde la hoja "Leer
// como" de la Biblioteca (LeerComoSheet) con `vistaInicial`:
//   · 'buscar'     → buscador de públicas (máx. 20 resultados)
//   · 'crear'      → formulario (solo creadores), con su selector de libro
//   · 'invitacion' → la hoja del código abierta sobre la vista inicio (si se
//                    llegó por un enlace /unirse/CÓDIGO, con el código escrito)
//   · sin vista    → inicio: Mis comunidades + los tres botones
// Al unirse o crear, la comunidad queda activa y se vuelve a la Biblioteca
// con su panel abierto (onListo). Tocar una de mis comunidades hace lo
// mismo, sin cambiar la activa. Un código de profesor o de administrador
// lleva al panel del colegio (onGoColegio).
// En escritorio lo mismo vive en la barra naranja (ComunidadesMenu.jsx).
import { useState, useEffect } from 'react'
import {
  useMisComunidadesQuery, useBuscarComunidadesQuery, useUnirseComunidad, usePuedeCrearComunidadQuery, useComunidadActiva,
  useFormCanje, TOPE_COMUNIDADES, contarParaTope, enTopeComunidades,
} from '../../hooks/useComunidades.js'
import { tomarCodigoPendiente } from '../../lib/codigoPendiente.js'
import { FilaMiComunidad, FilaResultado, IconoLupa, CamposNombreAula, useDebounced } from '../comunidades/comunidadesShared.jsx'
import { CrearComunidadPantalla } from '../comunidades/CrearComunidad.jsx'
import '../../styles/comunidades.css'
import '../../styles/comunidades.mobile.css'
import { ModalDenunciaComunidad } from '../comunidades/DenunciarComunidad.jsx'

const TITULOS = { inicio: 'Comunidades', buscar: 'Buscar', crear: 'Crear comunidad' }

// onListo(id, bienvenida?): vuelve a la Biblioteca con el panel de esa
// comunidad abierto. `bienvenida` = { privada, codigo } tras crearla.
export default function ComunidadesMobile({ user, vistaInicial = null, onGoBack, onListo, onGoColegio }) {
  // El código del enlace se toma una vez al montar (en StrictMode el segundo
  // pase ya no lo encuentra y no pisa nada).
  const [codigoEnlace, setCodigoEnlace] = useState('')
  useEffect(() => {
    if (vistaInicial !== 'invitacion') return
    const c = tomarCodigoPendiente()
    if (c) setCodigoEnlace(c)
  }, [vistaInicial])
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
  const enTope = enTopeComunidades(mias)
  const cuentan = contarParaTope(mias)
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
              {cuentan > 0 && <span className="comm-count">{cuentan} de {TOPE_COMUNIDADES}</span>}
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
        <HojaCodigo user={user} codigoInicial={codigoEnlace} onOpen={entrar} onColegio={onGoColegio}
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

// Sin desactivar en el tope: el código puede ser de un aula o del colegio,
// que no cuentan. Si es de un club y no cabe, avisa la base.
function HojaCodigo({ user, codigoInicial, onOpen, onColegio, onClose }) {
  const form = useFormCanje({ userId: user?.id, codigoInicial, onComunidad: onOpen, onColegio })
  const aula = form.paso === 'nombre'

  return (
    <div className="comm-sheet-wrap">
      <div className="comm-sheet-dim" onClick={onClose} />
      <form className="comm-sheet" onSubmit={form.enviar} role="dialog" aria-label="Unirte con una invitación">
        <span className="comm-grab" aria-hidden="true" />
        <h2>{aula ? 'Entrar al aula' : 'Unirte con una invitación'}</h2>
        {!aula && <p>Escribe el código que te compartieron: el de una comunidad, el de tu aula o el de tu colegio.</p>}
        <span className="com-input code">
          <input value={form.codigo} maxLength={20} autoComplete="off" spellCheck="false" autoFocus={!codigoInicial}
            placeholder="Código" aria-label="Código de invitación"
            onChange={e => form.setCodigo(e.target.value)} />
        </span>
        {aula && <CamposNombreAula form={form} />}
        {form.error && <p className="com-error" role="alert">{form.error}</p>}
        <button type="submit" className="com-btn solid comm-big" disabled={form.enviando}>
          {form.enviando ? 'Uniendo…' : aula ? 'Entrar al aula' : 'Unirme'}
        </button>
      </form>
    </div>
  )
}
