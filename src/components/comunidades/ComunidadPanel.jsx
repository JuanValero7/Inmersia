// Panel "Ver comunidad": todo lo de una comunidad sin salir de la
// Biblioteca. Lateral en escritorio (modo="lateral"), hoja alta desde
// abajo en móvil (modo="hoja"). Reemplaza a la antigua página
// /comunidad/:id.
//
// Vista "resumen": lectura actual, encuentro, el camino de los miembros,
// quién lee otra cosa, lecturas anteriores y, si moderas, la caja de
// gestión. El resto de vistas son la gestión del moderador (editar,
// cambiar libro, encuentro, código, miembros) y la confirmación de salir.
//
// Recién creada (`bienvenida`), arriba sale la tarjeta con el código.
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  useComunidadQuery, useComunidadActiva, useProgresoComunidadQuery, useLecturasAnterioresQuery,
  useGestionComunidad, normalizarCodigo, aLocal,
} from '../../hooks/useComunidades.js'
import {
  PortadaMini, Etiquetas, Sello, textoMiembros, fechaLarga, fechaEncuentro, diaMes, colorDeId,
} from './comunidadesShared.jsx'
import { Campo, CamposFechaEncuentro, LibroElegido, SelectorLibro } from './CrearComunidad.jsx'
import '../../styles/comunidades.css'
import { FormDenunciaComunidad } from './DenunciarComunidad.jsx'

const NOMBRE_MAX = 60
const DESC_MAX = 500

export default function ComunidadPanel({ user, comunidadId, bienvenida = null, modo = 'lateral', onClose, onLeerLibro }) {
  const { data: c, isLoading, isError } = useComunidadQuery(comunidadId, user?.id)
  const [vista, setVista] = useState('resumen')

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  const volver = () => setVista('resumen')

  let cuerpo
  if (isLoading) cuerpo = <p className="com-dd-msg">Abriendo la comunidad…</p>
  else if (isError) cuerpo = <p className="com-dd-msg">No pudimos cargar la comunidad. Revisa tu conexión.</p>
  else if (!c) cuerpo = <p className="com-dd-msg">Esta comunidad ya no está disponible.</p>
  else if (vista === 'resumen') cuerpo = <Resumen c={c} user={user} bienvenida={bienvenida} onVista={setVista} onLeerLibro={onLeerLibro} />
  else if (vista === 'editar') cuerpo = <Editar c={c} user={user} onVolver={volver} />
  else if (vista === 'libro') cuerpo = <CambiarLibro c={c} user={user} onVolver={volver} />
  else if (vista === 'encuentro') cuerpo = <EditarEncuentro c={c} user={user} onVolver={volver} />
  else if (vista === 'codigo') cuerpo = <Codigo c={c} user={user} onVolver={volver} />
  else if (vista === 'miembros') cuerpo = <Miembros c={c} user={user} onVolver={volver} />
  else if (vista === 'salir') cuerpo = <Salir c={c} user={user} onVolver={volver} onFuera={onClose} />
  else if (vista === 'denunciar') cuerpo = (
    <Subvista titulo="Denunciar la comunidad" onVolver={volver}>
      <FormDenunciaComunidad user={user} c={c} onCancelar={volver} onListo={volver} />
    </Subvista>
  )

  return createPortal(
    <div className={'cp-wrap ' + modo}>
      <div className="cp-dim" onClick={onClose} />
      <aside className="cp-panel" role="dialog" aria-label={c?.nombre || 'Comunidad'}>
        {modo === 'hoja' && <span className="cp-grab" aria-hidden="true" />}
        {c && (
          <header className="cp-head">
            <Sello c={c} tam="lg" />
            <div className="com-body">
              <h2>{c.nombre}</h2>
              <span className="com-meta">{textoMiembros(c.miembros)}</span>
              <Etiquetas c={c} />
            </div>
            <button type="button" className="com-btn cp-x" onClick={onClose} aria-label="Cerrar">✕</button>
          </header>
        )}
        <div className="cp-body">{cuerpo}</div>
      </aside>
    </div>,
    document.body
  )
}

// ── Resumen ────────────────────────────────────────────────

function Resumen({ c, user, bienvenida, onVista, onLeerLibro }) {
  const { setActiva } = useComunidadActiva(user?.id)
  const [verBienvenida, setVerBienvenida] = useState(!!bienvenida)
  const moderas = c.rol === 'moderador'

  const leer = (libroId) => { setActiva(c.id); onLeerLibro(libroId) }

  return (
    <>
      {verBienvenida && <Bienvenida c={c} onCerrar={() => setVerBienvenida(false)} />}
      {c.descripcion && <p className="cp-desc">{c.descripcion}</p>}

      <section className="cp-sec">
        <h3 className="com-label">Lectura actual</h3>
        {c.libroId ? (
          <>
            <div className="cp-lectura">
              <PortadaMini c={c} />
              <div className="com-body">
                <span className="cp-libro">{c.libroTitulo}</span>
                {c.libroAutor && <span className="com-meta">{c.libroAutor}</span>}
                {c.lectura?.fecha_meta && <span className="com-when">Terminar antes del {fechaLarga(c.lectura.fecha_meta)}</span>}
              </div>
            </div>
            <Encuentro lectura={c.lectura} />
          </>
        ) : (
          <p className="com-nota">{moderas ? 'Todavía no hay libro. Elige uno en «Cambiar libro».' : 'El moderador todavía no eligió libro.'}</p>
        )}
      </section>

      {c.libroId && <Camino c={c} user={user} />}
      <Anteriores c={c} onLeer={leer} />

      {moderas && (
        <section className="cp-mod">
          <h3 className="com-label">Moderas esta comunidad</h3>
          {c.privada && c.codigo && (
            <div className="cp-codigo-fila">
              <span>Código: <b className="cp-codigo">{c.codigo}</b></span>
              <BotonCopiar texto={c.codigo} />
            </div>
          )}
          <div className="cp-mod-acciones">
            <button type="button" className="com-btn sm" onClick={() => onVista('editar')}>Editar</button>
            <button type="button" className="com-btn sm" onClick={() => onVista('libro')}>Cambiar libro</button>
            {c.libroId && <button type="button" className="com-btn sm" onClick={() => onVista('encuentro')}>Encuentro</button>}
            <button type="button" className="com-btn sm" onClick={() => onVista('codigo')}>Código</button>
            <button type="button" className="com-btn sm" onClick={() => onVista('miembros')}>Miembros</button>
          </div>
        </section>
      )}

      <footer className="cp-foot">
        <span className="cp-foot-izq">
          <button type="button" className="cp-salir" onClick={() => onVista('salir')}>Salir de la comunidad</button>
          {c.rol !== 'moderador' && <button type="button" className="cp-denunciar" onClick={() => onVista('denunciar')}>Denunciar</button>}
        </span>
        {c.libroId && <button type="button" className="com-btn solid" onClick={() => leer(c.libroId)}>Leer con el club</button>}
      </footer>
    </>
  )
}

function Bienvenida({ c, onCerrar }) {
  return (
    <div className="cp-bienvenida" role="status">
      <h3>Tu comunidad está lista</h3>
      {c.privada && c.codigo ? (
        <>
          <p>Comparte este código con quien quieras invitar. Lo escriben en «Tengo una invitación».</p>
          <div className="com-codigo"><b>{c.codigo}</b><BotonCopiar texto={c.codigo} solido /></div>
        </>
      ) : (
        <p>Ya aparece en «Buscar comunidades». Cualquiera puede encontrarla y unirse.</p>
      )}
      <button type="button" className="com-btn sm cp-ok" onClick={onCerrar}>Entendido</button>
    </div>
  )
}

function BotonCopiar({ texto, solido = false }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles: el código se puede seleccionar a mano.
    }
  }
  return (
    <button type="button" className={'com-btn sm' + (solido ? ' solid' : '')} onClick={copiar}>
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function Encuentro({ lectura }) {
  if (!lectura?.encuentro_fecha && !lectura?.encuentro_lugar) return null
  const dm = lectura.encuentro_fecha ? diaMes(lectura.encuentro_fecha) : null
  return (
    <div className="cp-encuentro">
      {dm && <span className="cp-dia"><b>{dm.dia}</b><span>{dm.mes}</span></span>}
      <div className="com-body">
        <span className="cp-enc-t">{lectura.encuentro_fecha ? fechaEncuentro(lectura.encuentro_fecha) : 'Próximo encuentro'}</span>
        {lectura.encuentro_lugar && <span className="cp-enc-l">{lectura.encuentro_lugar}</span>}
      </div>
    </div>
  )
}

const primerNombre = (m) => (m.nombre || 'Lector').trim().split(/\s+/)[0]

// El camino: una ficha por miembro sobre el libro. Si dos fichas caen muy
// cerca, la segunda sube un carril para que no se tapen.
function Camino({ c, user }) {
  const { data: filas = [], isLoading } = useProgresoComunidadQuery(c.id)

  const { fichas, carriles, otros, sinEmpezar } = useMemo(() => {
    const leyendo = filas.filter(m => m.porcentaje !== null && m.porcentaje !== undefined)
      .sort((a, b) => a.porcentaje - b.porcentaje)
    const ultimos = []
    const fichas = leyendo.map(m => {
      let carril = ultimos.findIndex(p => m.porcentaje - p >= 9)
      if (carril === -1) { carril = ultimos.length; ultimos.push(m.porcentaje) } else ultimos[carril] = m.porcentaje
      return { ...m, carril }
    })
    return {
      fichas,
      carriles: Math.max(1, ultimos.length),
      otros: filas.filter(m => m.otro_libro_titulo),
      sinEmpezar: filas.filter(m => (m.porcentaje === null || m.porcentaje === undefined) && !m.otro_libro_titulo),
    }
  }, [filas])

  if (isLoading) return null
  const avanceMax = fichas.length ? fichas[fichas.length - 1].porcentaje : 0

  return (
    <section className="cp-sec">
      <h3 className="com-label">El camino</h3>
      {fichas.length === 0 ? (
        <p className="com-nota">Nadie ha empezado el libro todavía.</p>
      ) : (
        <div className="cp-camino" style={{ height: 40 + carriles * 34 }}>
          <span className="cp-linea" />
          <span className="cp-hecho" style={{ width: `${avanceMax}%` }} />
          {fichas.map(m => {
            const yo = m.user_id === user?.id
            return (
              <span key={m.user_id} className={'cp-ficha' + (yo ? ' yo' : '')}
                style={{ left: `${Math.min(97, Math.max(3, m.porcentaje))}%`, bottom: 20 + m.carril * 34 }}
                title={`${yo ? 'Tú' : primerNombre(m)} · ${m.porcentaje}%`}>
                <i style={{ background: colorDeId(m.user_id) }}>{primerNombre(m)[0]?.toUpperCase()}</i>
                <small>{m.porcentaje}%</small>
              </span>
            )
          })}
          {c.lectura?.fecha_meta && <span className="cp-meta">fin · {fechaLarga(c.lectura.fecha_meta)}</span>}
        </div>
      )}
      {(otros.length > 0 || sinEmpezar.length > 0) && (
        <ul className="cp-otros">
          {otros.map(m => (
            <li key={m.user_id}>
              <i style={{ background: colorDeId(m.user_id) }}>{primerNombre(m)[0]?.toUpperCase()}</i>
              {m.user_id === user?.id ? 'Tú estás' : `${primerNombre(m)} está`} leyendo <b>{m.otro_libro_titulo}</b>
            </li>
          ))}
          {sinEmpezar.map(m => (
            <li key={m.user_id}>
              <i style={{ background: colorDeId(m.user_id) }}>{primerNombre(m)[0]?.toUpperCase()}</i>
              {m.user_id === user?.id ? 'Todavía no empiezas' : `${primerNombre(m)} todavía no empieza`}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Anteriores({ c, onLeer }) {
  const { data: lecturas = [] } = useLecturasAnterioresQuery(c.id)
  if (!lecturas.length) return null
  return (
    <section className="cp-sec">
      <h3 className="com-label">Lecturas anteriores</h3>
      <div className="cp-estante">
        {lecturas.map(l => (
          <button key={l.id} type="button" className="cp-lomo" onClick={() => onLeer(l.libroId)}
            title={`${l.libroTitulo} · leído hasta el ${fechaLarga(l.fin.slice(0, 10))}`}>
            <PortadaMini c={l} />
          </button>
        ))}
      </div>
      <p className="com-nota">{lecturas.length === 1 ? '1 libro leído' : `${lecturas.length} libros leídos`}. Tócalo para abrirlo.</p>
    </section>
  )
}

// ── Gestión del moderador ──────────────────────────────────

function Subvista({ titulo, onVolver, children }) {
  return (
    <div className="cp-sub">
      <div className="com-dd-volver">
        <button type="button" className="com-btn sm" onClick={onVolver} aria-label="Volver">‹</button>
        <h3>{titulo}</h3>
      </div>
      {children}
    </div>
  )
}

function Guardar({ ocupado, texto = 'Guardar', error }) {
  return (
    <>
      {error && <p className="com-error" role="alert">{error}</p>}
      <button type="submit" className="com-btn solid cp-guardar" disabled={ocupado}>{ocupado ? 'Guardando…' : texto}</button>
    </>
  )
}

function Editar({ c, user, onVolver }) {
  const { editar, ocupado } = useGestionComunidad(c.id, user?.id)
  const [f, setF] = useState({ nombre: c.nombre, descripcion: c.descripcion || '', privada: c.privada })
  const [error, setError] = useState(null)
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setError(null) }

  const enviar = async (e) => {
    e.preventDefault()
    if (!f.nombre.trim()) { setError('Ponle un nombre a la comunidad.'); return }
    const r = await editar(f)
    if (r.error) setError(r.error)
    else onVolver()
  }

  return (
    <Subvista titulo="Editar comunidad" onVolver={onVolver}>
      <form className="cp-form" onSubmit={enviar}>
        <Campo id="cp-nombre" label="Nombre" extra={`${f.nombre.length} / ${NOMBRE_MAX}`}>
          <span className="com-input cc-box"><input id="cp-nombre" value={f.nombre} maxLength={NOMBRE_MAX} onChange={e => set('nombre', e.target.value)} /></span>
        </Campo>
        <Campo id="cp-desc" label="Descripción" extra={`Opcional · ${f.descripcion.length} / ${DESC_MAX}`}>
          <span className="com-input cc-box"><textarea id="cp-desc" rows={3} value={f.descripcion} maxLength={DESC_MAX} onChange={e => set('descripcion', e.target.value)} /></span>
        </Campo>
        <div className="cc-field">
          <span className="cc-label" id="cp-tipo-lbl">¿Quién puede entrar?</span>
          <div className="cc-tipos" role="radiogroup" aria-labelledby="cp-tipo-lbl">
            <button type="button" role="radio" aria-checked={!f.privada} className={'cc-tipo' + (!f.privada ? ' on' : '')} onClick={() => set('privada', false)}>
              <b><span className="cc-radio" />Pública</b><span>Aparece en el buscador.</span>
            </button>
            <button type="button" role="radio" aria-checked={f.privada} className={'cc-tipo' + (f.privada ? ' on' : '')} onClick={() => set('privada', true)}>
              <b><span className="cc-radio" />Privada</b><span>Solo con código.</span>
            </button>
          </div>
          {f.privada && !c.privada && c.codigo && (
            <p className="com-nota">Se entrará con el código <b>{c.codigo}</b>. Puedes cambiarlo en «Código».</p>
          )}
        </div>
        <Guardar ocupado={ocupado === 'editar'} error={error} />
      </form>
    </Subvista>
  )
}

const LECTURA_VACIA = { fechaMeta: '', encuentroLugar: '', encuentroFecha: '' }

function CambiarLibro({ c, user, onVolver }) {
  const { cambiarLibro, ocupado } = useGestionComunidad(c.id, user?.id)
  const [f, setF] = useState({ libro: null, ...LECTURA_VACIA })
  const [eligiendo, setEligiendo] = useState(true)
  const [error, setError] = useState(null)
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setError(null) }

  const enviar = async (e) => {
    e.preventDefault()
    if (!f.libro) { setError('Elige el libro de la nueva lectura.'); return }
    if (f.libro.id === c.libroId) { setError('Ese libro ya es la lectura actual.'); return }
    const r = await cambiarLibro(f)
    if (r.error) setError(r.error)
    else onVolver()
  }

  return (
    <Subvista titulo="Cambiar libro" onVolver={eligiendo && f.libro ? () => setEligiendo(false) : onVolver}>
      {eligiendo ? (
        <SelectorLibro seleccionado={f.libro} onElegir={(l) => { set('libro', l); setEligiendo(false) }} />
      ) : (
        <form className="cp-form" onSubmit={enviar}>
          <LibroElegido libro={f.libro} etiqueta="Nueva lectura" onElegir={() => setEligiendo(true)} />
          <CamposFechaEncuentro form={{ f, set }} />
          {c.libroTitulo && <p className="com-nota">«{c.libroTitulo}» pasará a Lecturas anteriores, con todo lo que el club escribió en él.</p>}
          <Guardar ocupado={ocupado === 'libro'} texto="Empezar esta lectura" error={error} />
        </form>
      )}
    </Subvista>
  )
}

function EditarEncuentro({ c, user, onVolver }) {
  const { editarLectura, ocupado } = useGestionComunidad(c.id, user?.id)
  const [f, setF] = useState({
    fechaMeta: c.lectura?.fecha_meta || '',
    encuentroLugar: c.lectura?.encuentro_lugar || '',
    encuentroFecha: aLocal(c.lectura?.encuentro_fecha),
  })
  const [error, setError] = useState(null)
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setError(null) }

  const enviar = async (e) => {
    e.preventDefault()
    const r = await editarLectura(f)
    if (r.error) setError(r.error)
    else onVolver()
  }

  return (
    <Subvista titulo={`Encuentro · ${c.libroTitulo}`} onVolver={onVolver}>
      <form className="cp-form" onSubmit={enviar}>
        <CamposFechaEncuentro form={{ f, set }} />
        <Guardar ocupado={ocupado === 'encuentro'} error={error} />
      </form>
    </Subvista>
  )
}

function Codigo({ c, user, onVolver }) {
  const { ponerCodigo, regenerarCodigo, ocupado } = useGestionComunidad(c.id, user?.id)
  const [nuevo, setNuevo] = useState('')
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  const guardar = async (e) => {
    e.preventDefault()
    setAviso(null)
    const r = await ponerCodigo(nuevo)
    if (r.error) { setError(r.error); return }
    setNuevo('')
    setAviso(`Listo: el código ahora es ${r.valor}. El anterior ya no sirve.`)
  }

  const alAzar = async () => {
    setError(null); setAviso(null)
    const r = await regenerarCodigo()
    if (r.error) setError(r.error)
    else setAviso(`Listo: el código ahora es ${r.valor}. El anterior ya no sirve.`)
  }

  return (
    <Subvista titulo="Código de invitación" onVolver={onVolver}>
      {!c.privada && <p className="com-nota">Es pública: se entra desde el buscador. El código sirve si la haces privada.</p>}
      {c.codigo && <div className="com-codigo"><b>{c.codigo}</b><BotonCopiar texto={c.codigo} /></div>}
      <form className="cp-form" onSubmit={guardar}>
        <Campo id="cp-codigo" label="Nuevo código" extra="6 a 20 letras o números">
          <span className="com-input cc-box code">
            <input id="cp-codigo" value={nuevo} maxLength={20} autoComplete="off" spellCheck="false" placeholder="JUEVES2026"
              onChange={e => { setNuevo(normalizarCodigo(e.target.value)); setError(null) }} />
          </span>
        </Campo>
        <p className="com-nota">Quien ya está dentro sigue dentro. El código anterior deja de servir para entrar.</p>
        <Guardar ocupado={ocupado === 'codigo'} texto="Guardar código" error={error} />
        <button type="button" className="com-btn" onClick={alAzar} disabled={ocupado === 'codigo'}>Generar uno al azar</button>
        {aviso && <p className="com-nota cp-aviso" role="status">{aviso}</p>}
      </form>
    </Subvista>
  )
}

function Miembros({ c, user, onVolver }) {
  const { data: filas = [], isLoading } = useProgresoComunidadQuery(c.id)
  const { expulsar, ocupado } = useGestionComunidad(c.id, user?.id)
  const [confirmar, setConfirmar] = useState(null)
  const [error, setError] = useState(null)

  const quitar = async (id) => {
    setError(null)
    const r = await expulsar(id)
    if (r.error) setError(r.error)
    setConfirmar(null)
  }

  return (
    <Subvista titulo={`Miembros · ${filas.length || c.miembros}`} onVolver={onVolver}>
      {isLoading ? <p className="com-dd-msg">Cargando…</p> : (
        <ul className="cp-miembros">
          {filas.map(m => {
            const yo = m.user_id === user?.id
            const nombre = [m.nombre, m.apellido].filter(Boolean).join(' ') || 'Lector'
            return (
              <li key={m.user_id}>
                <i style={{ background: colorDeId(m.user_id) }}>{primerNombre(m)[0]?.toUpperCase()}</i>
                <span className="com-body">
                  <span className="com-name">{nombre}{yo && ' (tú)'}</span>
                  <span className="com-meta">{m.rol === 'moderador' ? 'Modera' : m.porcentaje !== null ? `${m.porcentaje}% del libro` : 'Sin empezar'}</span>
                </span>
                {!yo && (confirmar === m.user_id ? (
                  <span className="cp-confirma">
                    <button type="button" className="com-btn sm cp-peligro" disabled={ocupado === 'expulsar'} onClick={() => quitar(m.user_id)}>Quitar</button>
                    <button type="button" className="com-btn sm cc-ghost" onClick={() => setConfirmar(null)}>No</button>
                  </span>
                ) : (
                  <button type="button" className="com-btn sm" onClick={() => setConfirmar(m.user_id)}>Quitar</button>
                ))}
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="com-error" role="alert">{error}</p>}
      <p className="com-nota">Quien sale deja de ver todo lo de la comunidad. Lo que escribió se queda para los demás.</p>
    </Subvista>
  )
}

function Salir({ c, user, onVolver, onFuera }) {
  const { salir, ocupado } = useGestionComunidad(c.id, user?.id)
  const { activaId, setActiva } = useComunidadActiva(user?.id)
  const [error, setError] = useState(null)

  const confirmar = async () => {
    const r = await salir()
    if (r.error) { setError(r.error); return }
    if (activaId === c.id) setActiva(null)
    onFuera()
  }

  return (
    <Subvista titulo="Salir de la comunidad" onVolver={onVolver}>
      <p className="cp-desc">
        {c.miembros <= 1
          ? `Eres el único miembro de «${c.nombre}». Si sales, la comunidad se borra con todo lo que tiene.`
          : c.rol === 'moderador'
            ? `Si sales de «${c.nombre}», la moderación pasa al miembro más antiguo.`
            : `Dejarás de ver todo lo de «${c.nombre}». Para volver, necesitarás entrar otra vez.`}
      </p>
      {error && <p className="com-error" role="alert">{error}</p>}
      <div className="cp-foot">
        <button type="button" className="com-btn cc-ghost" onClick={onVolver}>Cancelar</button>
        <button type="button" className="com-btn cp-peligro" disabled={ocupado === 'salir'} onClick={confirmar}>
          {ocupado === 'salir' ? 'Saliendo…' : c.miembros <= 1 ? 'Salir y borrar' : 'Salir'}
        </button>
      </div>
    </Subvista>
  )
}
