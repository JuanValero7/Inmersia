// Comunidades en la barra naranja de la Biblioteca (escritorio).
// El botón muestra con quién lees: la comunidad activa (sello + nombre) o
// "Comunidades" si lees solo. Su desplegable tiene tres vistas:
//   · inicio     → "Leer como": Solo yo o una de mis comunidades, cada una
//                  con "Ver comunidad" (abre ComunidadPanel). Al final,
//                  "Tengo una invitación", "Buscar comunidades" y el botón
//                  naranja "Crear comunidad" (solo para creadores)
//   · invitacion → campo del código
//   · buscar     → buscador de públicas
// Al crear o unirse, la comunidad queda activa y se abre su panel.
// El panel lo monta la Biblioteca (onVerComunidad), no este menú: desde
// él se abren libros, y eso es cosa de la Biblioteca.
// En móvil lo mismo es la hoja LeerComoSheet + la pantalla /comunidades.
import { useState, useEffect, useRef } from 'react'
import {
  useComunidadActiva, useBuscarComunidadesQuery, useUnirseComunidad, usePuedeCrearComunidadQuery,
  TOPE_COMUNIDADES, normalizarCodigo,
} from '../../hooks/useComunidades.js'
import { FilaResultado, IconoComunidad, IconoLupa, Sello, MetaComunidad, useDebounced } from './comunidadesShared.jsx'
import { CrearComunidadModal } from './CrearComunidad.jsx'
import '../../styles/comunidades.css'

// onVerComunidad(id, bienvenida?): abre el panel. `bienvenida` va tras
// crear ({ privada, codigo }) para mostrar la tarjeta con el código.
export default function ComunidadesMenu({ user, onVerComunidad }) {
  const { activa, setActiva } = useComunidadActiva(user?.id)
  const [abierto, setAbierto] = useState(false)
  const [vista, setVista] = useState('inicio') // 'inicio' | 'invitacion' | 'buscar'
  const [creando, setCreando] = useState(false)
  const cajaRef = useRef(null)

  const cerrar = () => { setAbierto(false); setVista('inicio') }

  // Cerrar al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (cajaRef.current && !cajaRef.current.contains(e.target)) cerrar() }
    const esc = (e) => { if (e.key === 'Escape') cerrar() }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  const ver = (id) => { cerrar(); onVerComunidad(id) }
  // Tras unirse: queda activa y se abre su panel.
  const entrar = (id) => { setActiva(id); ver(id) }

  return (
    <div className="com-menu" ref={cajaRef}>
      <button type="button" className={'com-btn com-select' + (abierto ? ' open' : '') + (activa ? ' activa' : '')}
        aria-expanded={abierto} onClick={() => (abierto ? cerrar() : setAbierto(true))}
        title={activa ? `Leyendo con ${activa.nombre}` : 'Comunidades'}>
        <span className="com-select-lbl">
          {activa ? <Sello c={activa} tam="sm" /> : <IconoComunidad />}
          <span className="com-select-txt">{activa ? activa.nombre : 'Comunidades'}</span>
        </span>
        <span aria-hidden="true">{abierto ? '▴' : '▾'}</span>
      </button>

      {abierto && (
        <div className={'com-dd' + (vista === 'inicio' ? '' : ' ancho')} role="dialog" aria-label="Comunidades">
          {vista === 'inicio' && (
            <Inicio user={user} onVer={ver} onVista={setVista} onElegida={cerrar}
              onCrear={() => { cerrar(); setCreando(true) }} />
          )}
          {vista === 'invitacion' && <Invitacion user={user} onEntrar={entrar} onVolver={() => setVista('inicio')} />}
          {vista === 'buscar' && <Buscar user={user} onEntrar={entrar} onVolver={() => setVista('inicio')} />}
        </div>
      )}

      {creando && (
        <CrearComunidadModal user={user} onClose={() => setCreando(false)}
          onCreada={({ id, privada, codigo }) => {
            setCreando(false)
            setActiva(id)
            onVerComunidad(id, { privada, codigo })
          }} />
      )}
    </div>
  )
}

// "Leer como": Solo yo + mis comunidades. Elegir una la deja activa.
export function LeerComo({ user, onVer, onElegida }) {
  const { activaId, setActiva, mias, cargando } = useComunidadActiva(user?.id)
  const elegir = (id) => { setActiva(id); onElegida?.() }

  if (cargando) return <p className="com-dd-msg">Cargando tus comunidades…</p>

  return (
    <div className="com-leer" role="radiogroup" aria-label="Leer como">
      <button type="button" role="radio" aria-checked={!activaId} className={'com-modo' + (!activaId ? ' on' : '')} onClick={() => elegir(null)}>
        <span className="com-radio" />
        <span className="com-body"><span className="com-name">Solo yo</span><span className="com-meta">Sin notas de ninguna comunidad</span></span>
      </button>
      {mias.map(c => (
        <div key={c.id} className={'com-modo' + (activaId === c.id ? ' on' : '')}>
          <button type="button" role="radio" aria-checked={activaId === c.id} className="com-modo-sel" onClick={() => elegir(c.id)}>
            <span className="com-radio" />
            <Sello c={c} />
            <span className="com-body"><span className="com-name">{c.nombre}</span><MetaComunidad c={c} /></span>
          </button>
          <button type="button" className="com-ver" onClick={() => onVer(c.id)}>Ver comunidad</button>
        </div>
      ))}
      {mias.length === 0 && (
        <p className="com-nota com-leer-vacio">Todavía no perteneces a ninguna comunidad. Únete con el código que te pasó un amigo o busca una pública.</p>
      )}
    </div>
  )
}

function Inicio({ user, onVer, onVista, onCrear, onElegida }) {
  const { mias } = useComunidadActiva(user?.id)
  const { data: puedeCrear = false } = usePuedeCrearComunidadQuery(user?.id)
  const enTope = mias.length >= TOPE_COMUNIDADES

  return (
    <>
      <div className="com-dd-head"><h3>Leer como</h3>{mias.length > 0 && <span>{mias.length} de {TOPE_COMUNIDADES} comunidades</span>}</div>
      <LeerComo user={user} onVer={onVer} onElegida={onElegida} />
      <div className="com-dd-acciones">
        <div className="com-fila">
          <button type="button" className="com-btn" onClick={() => onVista('invitacion')}>Tengo una invitación</button>
          <button type="button" className="com-btn" onClick={() => onVista('buscar')}><IconoLupa />Buscar comunidades</button>
        </div>
        {puedeCrear && (
          <button type="button" className="com-btn solid com-dd-crear" onClick={onCrear} disabled={enTope}
            title={enTope ? `Ya estás en ${TOPE_COMUNIDADES} comunidades, el máximo.` : undefined}>
            Crear comunidad
          </button>
        )}
      </div>
    </>
  )
}

function CabeceraVista({ titulo, onVolver }) {
  return (
    <div className="com-dd-volver">
      <button type="button" className="com-btn sm" onClick={onVolver} aria-label="Volver">‹</button>
      <h3>{titulo}</h3>
    </div>
  )
}

function Invitacion({ user, onEntrar, onVolver }) {
  const { mias } = useComunidadActiva(user?.id)
  const enTope = mias.length >= TOPE_COMUNIDADES
  const { unirseConCodigo, pendiente } = useUnirseComunidad(user?.id)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)
    const r = await unirseConCodigo(codigo)
    if (r.error) setError(r.error)
    else onEntrar(r.id)
  }

  return (
    <form className="com-block com-dd-vista" onSubmit={enviar}>
      <CabeceraVista titulo="Tengo una invitación" onVolver={onVolver} />
      <label className="com-nota" htmlFor="com-codigo">Escribe el código que te compartió el moderador de la comunidad.</label>
      <div className="com-fila">
        <span className="com-input code">
          <input id="com-codigo" value={codigo} maxLength={20} autoComplete="off" spellCheck="false" autoFocus
            placeholder="Código" onChange={e => { setCodigo(normalizarCodigo(e.target.value)); setError(null) }} />
        </span>
        <button type="submit" className="com-btn solid" disabled={enTope || pendiente === 'codigo'}>
          {pendiente === 'codigo' ? 'Uniendo…' : 'Unirme'}
        </button>
      </div>
      {error && <p className="com-error" role="alert">{error}</p>}
      {enTope && <p className="com-nota">Ya estás en {TOPE_COMUNIDADES} comunidades, el máximo. Sal de una para unirte a otra.</p>}
    </form>
  )
}

function Buscar({ user, onEntrar, onVolver }) {
  const { mias } = useComunidadActiva(user?.id)
  const enTope = mias.length >= TOPE_COMUNIDADES
  const { unirse, pendiente } = useUnirseComunidad(user?.id)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState(null)
  const textoDebounced = useDebounced(texto)
  const { data: resultados = [], isLoading, isError } = useBuscarComunidadesQuery(textoDebounced)

  const unirseA = async (id) => {
    setError(null)
    const r = await unirse(id)
    if (r.error) setError(r.error)
    else onEntrar(r.id)
  }

  return (
    <div className="com-block com-dd-vista">
      <CabeceraVista titulo="Buscar comunidades" onVolver={onVolver} />
      <span className="com-input">
        <IconoLupa />
        <input value={texto} placeholder="Nombre de la comunidad o del libro" autoComplete="off" autoFocus
          aria-label="Buscar comunidades" onChange={e => setTexto(e.target.value)} />
      </span>
      <div className="com-results">
        {isLoading ? <p className="com-dd-msg">Buscando…</p>
          : isError ? <p className="com-dd-msg">No pudimos buscar. Revisa tu conexión.</p>
          : resultados.length === 0 ? <p className="com-dd-msg">{texto.trim() ? 'Ninguna comunidad pública coincide.' : 'Todavía no hay comunidades públicas.'}</p>
          : resultados.map(c => (
              <FilaResultado key={c.id} c={c} onUnirse={unirseA} onOpen={onEntrar} pendiente={pendiente} enTope={enTope} />
            ))}
      </div>
      {error && <p className="com-error" role="alert">{error}</p>}
      <p className="com-nota">
        {enTope
          ? `Ya estás en ${TOPE_COMUNIDADES} comunidades, el máximo. Sal de una para unirte a otra.`
          : 'Se muestran hasta 20 resultados. Escribe más para afinar.'}
      </p>
    </div>
  )
}
