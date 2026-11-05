// Sección «Lista» del panel del colegio: las aulas, sus códigos y quién
// está dentro. Es la base del resto del panel: lo que se arma aquí decide
// de qué alumnos son los datos de Colegio y Salón.
//   · Administración: crea y borra aulas, ve y cambia los dos códigos, quita
//     a profesores y alumnos, y maneja a los otros administradores.
//   · Profesor: solo sus aulas, con el código de alumnos; puede cambiarlo y
//     quitar alumnos (es el moderador de su aula).
// Cambiar un código cierra la puerta pero no saca a nadie: para eso está
// «Quitar», persona por persona.
import { useState } from 'react'
import { useListaColegioQuery, useAdminsColegioQuery, useGestionColegio } from '../../hooks/useColegio.js'

export default function ListaColegio({ colegioId, esAdmin, user }) {
  const { data: aulas = [], isLoading, isError } = useListaColegioQuery(colegioId)
  const gestion = useGestionColegio(colegioId, user?.id)

  return (
    <div className="col-lista">
      <div className="col-head">
        <h2>Lista</h2>
        {!isLoading && aulas.length > 0 && (
          <span className="com-nota">
            {aulas.length} {aulas.length === 1 ? 'aula' : 'aulas'} · {aulas.reduce((n, a) => n + a.total_alumnos, 0)} alumnos
          </span>
        )}
      </div>

      {esAdmin && <CrearAula gestion={gestion} />}

      {isLoading ? <p className="com-dd-msg">Cargando las aulas…</p>
        : isError ? <p className="com-dd-msg">No pudimos cargar la lista. Revisa tu conexión.</p>
        : aulas.length === 0 ? <Vacia esAdmin={esAdmin} />
        : aulas.map(a => <Aula key={a.aula_id} a={a} esAdmin={esAdmin} user={user} gestion={gestion} />)}

      {esAdmin && <Administradores colegioId={colegioId} gestion={gestion} />}
    </div>
  )
}

function Vacia({ esAdmin }) {
  if (!esAdmin) return <p className="com-dd-msg">Todavía no tienes aulas asignadas.</p>
  return (
    <ol className="col-pasos">
      <li><b>Crea un aula</b> con su grado y sección.</li>
      <li><b>Pásale el código de profesor</b> a quien la tiene a cargo.</li>
      <li><b>El profesor reparte el código de alumnos</b> (o el enlace) a su clase. Cada alumno entra con su nombre y apellido.</li>
      <li><b>En «Salón», asigna el libro y la fecha meta.</b> El libro aparece solo en la biblioteca de cada alumno.</li>
    </ol>
  )
}

function CrearAula({ gestion }) {
  const [grado, setGrado] = useState('')
  const [seccion, setSeccion] = useState('')
  const [error, setError] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)
    if (!grado.trim()) { setError('Escribe el grado del aula.'); return }
    const r = await gestion.crearAula(grado, seccion)
    if (r.error) setError(r.error)
    else { setGrado(''); setSeccion('') }
  }

  return (
    <form className="col-crear" onSubmit={enviar}>
      <span className="com-label">Nueva aula</span>
      <div className="com-fila">
        <span className="com-input">
          <input value={grado} maxLength={30} placeholder="Grado (ej. 4.º)" aria-label="Grado"
            onChange={e => { setGrado(e.target.value); setError(null) }} />
        </span>
        <span className="com-input col-seccion">
          <input value={seccion} maxLength={20} placeholder="Sección (ej. B)" aria-label="Sección"
            onChange={e => { setSeccion(e.target.value); setError(null) }} />
        </span>
        <button type="submit" className="com-btn solid" disabled={gestion.ocupado === 'crear'}>
          {gestion.ocupado === 'crear' ? 'Creando…' : 'Crear aula'}
        </button>
      </div>
      {error && <p className="com-error" role="alert">{error}</p>}
    </form>
  )
}

function Aula({ a, esAdmin, user, gestion }) {
  const [error, setError] = useState(null)
  const [borrando, setBorrando] = useState(false)
  const conError = async (p) => { setError(null); const r = await p; if (r.error) setError(r.error); return r }

  return (
    <article className="col-aula">
      <header className="col-aula-head">
        <h3>{a.nombre}</h3>
        <span className="col-cuenta">{a.total_alumnos} {a.total_alumnos === 1 ? 'alumno' : 'alumnos'}</span>
        {esAdmin && (borrando ? (
          <span className="col-confirma">
            <span className="com-nota">¿Borrar el aula y todo lo que tiene?</span>
            <button type="button" className="com-btn sm cp-peligro" disabled={gestion.ocupado === `borrar:${a.aula_id}`}
              onClick={() => conError(gestion.borrarAula(a.aula_id))}>Borrar</button>
            <button type="button" className="com-btn sm cc-ghost" onClick={() => setBorrando(false)}>No</button>
          </span>
        ) : (
          <button type="button" className="com-btn sm cc-ghost col-borrar" onClick={() => setBorrando(true)}>Borrar aula</button>
        ))}
      </header>

      <div className="col-codigos">
        <Codigo etiqueta="Código de alumnos" codigo={a.codigo_alumnos} enlace
          nota="Para que los alumnos entren al aula."
          ocupado={gestion.ocupado === `alumnos:${a.aula_id}`}
          onCambiar={() => conError(gestion.cambiarCodigoAlumnos(a.aula_id))} />
        {esAdmin && (
          <Codigo etiqueta="Código de profesor" codigo={a.codigo_profesor}
            nota="Dáselo solo a quien da clase en esta aula."
            ocupado={gestion.ocupado === `profesor:${a.aula_id}`}
            onCambiar={() => conError(gestion.cambiarCodigoProfesor(a.aula_id))} />
        )}
      </div>

      <div className="col-grupo">
        <h4 className="com-label">Profesores</h4>
        {a.profesores.length === 0 ? (
          <p className="com-nota">Todavía no hay profesor. {esAdmin && 'Pásale el código de profesor.'}</p>
        ) : (
          <ul className="col-personas">
            {a.profesores.map(p => (
              <Persona key={p.user_id} nombre={p.nombre} yo={p.user_id === user?.id}
                puedeQuitar={esAdmin} ocupado={gestion.ocupado === `quitar:${a.aula_id}:${p.user_id}`}
                onQuitar={() => conError(gestion.quitarDelAula(a.aula_id, p.user_id))} />
            ))}
          </ul>
        )}
      </div>

      <div className="col-grupo">
        <h4 className="com-label">Alumnos</h4>
        {a.alumnos.length === 0 ? (
          <p className="com-nota">Nadie entró todavía.</p>
        ) : (
          <ul className="col-personas col-alumnos">
            {a.alumnos.map(p => (
              <Persona key={p.user_id} nombre={p.nombre} yo={p.user_id === user?.id}
                puedeQuitar ocupado={gestion.ocupado === `quitar:${a.aula_id}:${p.user_id}`}
                onQuitar={() => conError(gestion.quitarDelAula(a.aula_id, p.user_id))} />
            ))}
          </ul>
        )}
      </div>

      {error && <p className="com-error" role="alert">{error}</p>}
    </article>
  )
}

function Persona({ nombre, yo, puedeQuitar, ocupado, onQuitar }) {
  const [confirmar, setConfirmar] = useState(false)
  return (
    <li className="col-persona">
      <span className="col-persona-nombre">{nombre}{yo && ' (tú)'}</span>
      {puedeQuitar && !yo && (confirmar ? (
        <span className="col-confirma">
          <button type="button" className="com-btn sm cp-peligro" disabled={ocupado} onClick={onQuitar}>Quitar</button>
          <button type="button" className="com-btn sm cc-ghost" onClick={() => setConfirmar(false)}>No</button>
        </span>
      ) : (
        <button type="button" className="col-x" aria-label={`Quitar a ${nombre}`} title="Quitar" onClick={() => setConfirmar(true)}>×</button>
      ))}
    </li>
  )
}

// Un código con Copiar, Copiar enlace (solo el de alumnos) y Cambiar.
function Codigo({ etiqueta, codigo, nota, enlace = false, ocupado, onCambiar }) {
  const [confirmar, setConfirmar] = useState(false)
  const url = `${window.location.origin}/unirse/${codigo}`

  return (
    <div className="col-codigo">
      <span className="com-label">{etiqueta}</span>
      <b className="col-codigo-valor">{codigo || '—'}</b>
      <span className="com-nota">{nota}</span>
      <div className="col-codigo-acc">
        <BotonCopiar texto={codigo} />
        {enlace && <BotonCopiar texto={url} etiqueta="Copiar enlace" />}
        {confirmar ? (
          <span className="col-confirma">
            <button type="button" className="com-btn sm solid" disabled={ocupado}
              onClick={async () => { await onCambiar(); setConfirmar(false) }}>{ocupado ? 'Cambiando…' : 'Sí, cambiar'}</button>
            <button type="button" className="com-btn sm cc-ghost" onClick={() => setConfirmar(false)}>No</button>
          </span>
        ) : (
          <button type="button" className="com-btn sm cc-ghost" onClick={() => setConfirmar(true)}>Cambiar</button>
        )}
      </div>
      {confirmar && <span className="com-nota">El código actual deja de servir. Quien ya entró sigue dentro.</span>}
    </div>
  )
}

function BotonCopiar({ texto, etiqueta = 'Copiar' }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch { /* sin permiso de portapapeles: el código sigue a la vista */ }
  }
  return (
    <button type="button" className="com-btn sm" onClick={copiar} disabled={!texto}>
      {copiado ? 'Copiado' : etiqueta}
    </button>
  )
}

function Administradores({ colegioId, gestion }) {
  const { data: admins = [], isLoading } = useAdminsColegioQuery(colegioId)
  const [invitacion, setInvitacion] = useState(null)
  const [error, setError] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

  const invitar = async () => {
    setError(null)
    const r = await gestion.invitarAdmin()
    if (r.error) setError(r.error)
    else setInvitacion(r.valor)
  }

  const quitar = async (id) => {
    setError(null)
    const r = await gestion.quitarAdmin(id)
    if (r.error) setError(r.error)
    setConfirmar(null)
  }

  return (
    <section className="col-admins">
      <h3>Administradores</h3>
      {isLoading ? <p className="com-dd-msg">Cargando…</p> : (
        <ul className="col-personas">
          {admins.map(ad => (
            <li key={ad.user_id} className="col-persona">
              <span className="col-persona-nombre">{ad.nombre}{ad.soy_yo && ' (tú)'}</span>
              {admins.length > 1 && (confirmar === ad.user_id ? (
                <span className="col-confirma">
                  <button type="button" className="com-btn sm cp-peligro" disabled={gestion.ocupado === `admin:${ad.user_id}`}
                    onClick={() => quitar(ad.user_id)}>{ad.soy_yo ? 'Dejar de administrar' : 'Quitar'}</button>
                  <button type="button" className="com-btn sm cc-ghost" onClick={() => setConfirmar(null)}>No</button>
                </span>
              ) : (
                <button type="button" className="col-x" aria-label={ad.soy_yo ? 'Dejar de administrar' : `Quitar a ${ad.nombre}`}
                  title={ad.soy_yo ? 'Dejar de administrar' : 'Quitar'} onClick={() => setConfirmar(ad.user_id)}>×</button>
              ))}
            </li>
          ))}
        </ul>
      )}
      {admins.length === 1 && (
        <p className="com-nota">Te recomendamos sumar a una segunda persona: si un día no puedes entrar, el colegio no se queda sin administración.</p>
      )}

      {invitacion ? (
        <div className="col-codigo">
          <span className="com-label">Invitación de administrador</span>
          <b className="col-codigo-valor">{invitacion}</b>
          <span className="com-nota">Sirve una sola vez y vale 7 días. Que lo escriba en Inmersia → Comunidades → Tengo una invitación.</span>
          <div className="col-codigo-acc"><BotonCopiar texto={invitacion} /></div>
        </div>
      ) : (
        <button type="button" className="com-btn" onClick={invitar} disabled={gestion.ocupado === 'invitar'}>
          {gestion.ocupado === 'invitar' ? 'Generando…' : 'Invitar a otro administrador'}
        </button>
      )}
      {error && <p className="com-error" role="alert">{error}</p>}
    </section>
  )
}
