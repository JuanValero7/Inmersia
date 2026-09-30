// Formulario "Crear comunidad". Mismas piezas en dos envoltorios:
//   · CrearComunidadModal    — escritorio, se abre desde el panel ＋ de la
//                              barra (ComunidadesMenu). Dos columnas: datos
//                              a la izquierda, lectura a la derecha.
//   · CrearComunidadPantalla — móvil, dentro de /comunidades
//                              (ComunidadesMobile). Elegir libro es una
//                              pantalla aparte.
// Solo se ofrece a quien está en creadores_comunidad; la base lo vuelve a
// comprobar en crear_comunidad() (migración 054).
//
// El encuentro (lugar + fecha y hora) y la fecha meta pertenecen a la
// lectura, así que solo se piden cuando hay libro elegido.
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useCatalogoLibrosQuery } from '../../lib/queries.js'
import { MANUAL_LIBRO_ID } from '../../lib/constants.js'
import { imgUrl } from '../../lib/img.js'
import { useCrearComunidad, CODIGO_RE, normalizarCodigo } from '../../hooks/useComunidades.js'
import { IconoLupa } from './comunidadesShared.jsx'
import '../../styles/comunidades.css'

const NOMBRE_MAX = 60
const DESC_MAX = 500
const LUGAR_MAX = 200

const VACIO = {
  nombre: '', descripcion: '', privada: false, codigo: '',
  libro: null, fechaMeta: '', encuentroLugar: '', encuentroFecha: '',
}

// Estado + validación + envío, comunes a los dos envoltorios.
function useFormCrear(user, onCreada) {
  const [f, setF] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [errorEnvio, setErrorEnvio] = useState(null)
  const { crear, creando } = useCrearComunidad(user?.id)

  const set = (campo, valor) => {
    setF(prev => ({ ...prev, [campo]: valor }))
    setErrores(prev => ({ ...prev, [campo]: null }))
    setErrorEnvio(null)
  }

  const validar = () => {
    const e = {}
    if (!f.nombre.trim()) e.nombre = 'Ponle un nombre a la comunidad.'
    if (f.privada && !CODIGO_RE.test(f.codigo)) e.codigo = 'El código debe tener entre 6 y 20 letras o números.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const enviar = async (ev) => {
    ev?.preventDefault()
    if (creando || !validar()) return
    const r = await crear({ ...f, nombre: f.nombre.trim() })
    if (r.error) { setErrorEnvio(r.error); return }
    onCreada({ id: r.id, privada: f.privada, codigo: r.codigo })
  }

  return { f, set, errores, errorEnvio, creando, enviar }
}

// ── Piezas ─────────────────────────────────────────────────

export function Campo({ id, label, extra, error, children }) {
  return (
    <div className="cc-field">
      <label className="cc-label" htmlFor={id}>{label}{extra && <small>{extra}</small>}</label>
      {children}
      {error && <p className="com-error" role="alert">{error}</p>}
    </div>
  )
}

function CamposComunidad({ form }) {
  const { f, set, errores } = form
  return (
    <>
      <Campo id="cc-nombre" label="Nombre" extra={`${f.nombre.length} / ${NOMBRE_MAX}`} error={errores.nombre}>
        <span className="com-input cc-box">
          <input id="cc-nombre" value={f.nombre} maxLength={NOMBRE_MAX} placeholder="Club de los jueves"
            onChange={e => set('nombre', e.target.value)} />
        </span>
      </Campo>

      <Campo id="cc-desc" label="Descripción" extra={`Opcional · ${f.descripcion.length} / ${DESC_MAX}`}>
        <span className="com-input cc-box">
          <textarea id="cc-desc" value={f.descripcion} maxLength={DESC_MAX} rows={3}
            placeholder="Qué leen, cada cuánto se ven…" onChange={e => set('descripcion', e.target.value)} />
        </span>
      </Campo>

      <div className="cc-field">
        <span className="cc-label" id="cc-tipo-lbl">¿Quién puede entrar?</span>
        <div className="cc-tipos" role="radiogroup" aria-labelledby="cc-tipo-lbl">
          <button type="button" role="radio" aria-checked={!f.privada} className={'cc-tipo' + (!f.privada ? ' on' : '')}
            onClick={() => set('privada', false)}>
            <b><span className="cc-radio" />Pública</b>
            <span>Cualquiera la encuentra en el buscador y se une.</span>
          </button>
          <button type="button" role="radio" aria-checked={f.privada} className={'cc-tipo' + (f.privada ? ' on' : '')}
            onClick={() => set('privada', true)}>
            <b><span className="cc-radio" />Privada</b>
            <span>Solo entra quien tenga el código de invitación.</span>
          </button>
        </div>
      </div>

      {f.privada && (
        <Campo id="cc-codigo" label="Código de invitación" extra="6 a 20 letras o números" error={errores.codigo}>
          <span className="com-input cc-box code">
            <input id="cc-codigo" value={f.codigo} maxLength={20} autoComplete="off" spellCheck="false"
              placeholder="JUEVES2026" onChange={e => set('codigo', normalizarCodigo(e.target.value))} />
          </span>
          <p className="com-nota">Es lo que tus amigos escribirán en «Tengo una invitación».</p>
        </Campo>
      )}
    </>
  )
}

// Portada del catálogo: la imagen si hay, si no un lomo del color del libro.
export function Portada({ libro, className }) {
  return libro.portada_url
    ? <img className={className} src={imgUrl(libro.portada_url, { width: 180 })} alt="" loading="lazy" />
    : <span className={className} style={{ background: libro.color || 'var(--accent)' }} aria-hidden="true" />
}

// Fecha meta + encuentro de una lectura. Lo usan el formulario de crear
// y la gestión del moderador (ComunidadPanel). `form` = { f, set } con
// fechaMeta, encuentroLugar, encuentroFecha.
export function CamposFechaEncuentro({ form }) {
  const { f, set } = form
  return (
    <>
      <Campo id="cc-meta" label="¿Para cuándo?" extra="Opcional">
        <span className="com-input cc-box">
          <input id="cc-meta" type="date" value={f.fechaMeta} onChange={e => set('fechaMeta', e.target.value)} />
        </span>
        <p className="com-nota">La fecha en la que el club quiere terminar el libro.</p>
      </Campo>

      <div className="cc-field">
        <span className="cc-label">Encuentro<small>Opcional · solo lo ven los miembros</small></span>
        <span className="com-input cc-box">
          <input aria-label="Lugar del encuentro" value={f.encuentroLugar} maxLength={LUGAR_MAX}
            placeholder="Dirección, café o enlace de la videollamada" onChange={e => set('encuentroLugar', e.target.value)} />
        </span>
        <span className="com-input cc-box">
          <input aria-label="Fecha y hora del encuentro" type="datetime-local" value={f.encuentroFecha}
            onChange={e => set('encuentroFecha', e.target.value)} />
        </span>
      </div>
    </>
  )
}

// Libro elegido (con "Cambiar") o, sin libro, el botón para elegirlo.
export function LibroElegido({ libro, etiqueta, extra, onElegir, onQuitar }) {
  if (!libro) {
    return (
      <div className="cc-field">
        <span className="cc-label">{etiqueta}{extra && <small>{extra}</small>}</span>
        <button type="button" className="cc-libro-vacio" onClick={onElegir}>＋ Elegir un libro del catálogo</button>
      </div>
    )
  }
  return (
    <div className="cc-field">
      <span className="cc-label">{etiqueta}{extra && <small>{extra}</small>}</span>
      <div className="cc-libro-sel">
        <Portada libro={libro} className="com-cover" />
        <span className="com-body">
          <span className="com-name">{libro.titulo}</span>
          <span className="com-meta">{libro.autor}</span>
        </span>
        <button type="button" className="com-btn sm" onClick={onElegir}>Cambiar</button>
      </div>
      {onQuitar && <button type="button" className="cc-quitar" onClick={onQuitar}>Quitar libro</button>}
    </div>
  )
}

// Primera lectura del formulario de crear: libro opcional y, si hay
// libro, su fecha meta y encuentro.
function CamposLectura({ form, onElegirLibro }) {
  const { f, set } = form
  return (
    <>
      <LibroElegido libro={f.libro} etiqueta="Primera lectura" extra="Opcional"
        onElegir={onElegirLibro} onQuitar={() => set('libro', null)} />
      {f.libro
        ? <CamposFechaEncuentro form={form} />
        : <p className="com-nota">Puedes crear la comunidad sin libro y elegirlo después.</p>}
    </>
  )
}

// Buscador del catálogo, en el orden curado de la Tienda.
const normal = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function SelectorLibro({ seleccionado, onElegir }) {
  const { data: catalogo = [], isLoading, isError } = useCatalogoLibrosQuery()
  const [q, setQ] = useState('')
  const libros = useMemo(() => {
    const t = normal(q.trim())
    return catalogo
      .filter(l => l.id !== MANUAL_LIBRO_ID)
      .filter(l => !t || normal(l.titulo).includes(t) || normal(l.autor).includes(t))
  }, [catalogo, q])

  return (
    <div className="cc-selector">
      <span className="com-input">
        <IconoLupa />
        <input value={q} placeholder="Título o autor" aria-label="Buscar libro" autoFocus onChange={e => setQ(e.target.value)} />
      </span>
      {isLoading ? <p className="com-dd-msg">Cargando el catálogo…</p>
        : isError ? <p className="com-dd-msg">No pudimos cargar el catálogo. Revisa tu conexión.</p>
        : libros.length === 0 ? <p className="com-dd-msg">Ningún libro coincide.</p>
        : (
          <div className="cc-grid">
            {libros.map(l => (
              <button key={l.id} type="button" className={'cc-gl' + (seleccionado?.id === l.id ? ' on' : '')}
                aria-pressed={seleccionado?.id === l.id} onClick={() => onElegir(l)}>
                <span className="cc-gl-c"><Portada libro={l} className="cc-gl-img" /></span>
                <b>{l.titulo}</b>
                <span>{l.autor}</span>
              </button>
            ))}
          </div>
        )}
    </div>
  )
}

// ── Escritorio: modal ──────────────────────────────────────

export function CrearComunidadModal({ user, onClose, onCreada }) {
  const form = useFormCrear(user, onCreada)
  const [eligiendo, setEligiendo] = useState(false)

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  return createPortal(
    <div className="cc-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <form className="cc-modal" role="dialog" aria-label="Crear comunidad" onSubmit={form.enviar}>
        <div className="cc-main">
          <h2>Crear comunidad</h2>
          <CamposComunidad form={form} />
          {form.errorEnvio && <p className="com-error" role="alert">{form.errorEnvio}</p>}
          <div className="cc-foot">
            <button type="button" className="com-btn cc-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="com-btn solid" disabled={form.creando}>
              {form.creando ? 'Creando…' : 'Crear comunidad'}
            </button>
          </div>
        </div>
        <div className="cc-side">
          {eligiendo ? (
            <>
              <div className="cc-side-head">
                <span className="cc-label">Elige la primera lectura</span>
                <button type="button" className="com-btn cc-ghost sm" onClick={() => setEligiendo(false)}>Listo</button>
              </div>
              <SelectorLibro seleccionado={form.f.libro}
                onElegir={(l) => { form.set('libro', l); setEligiendo(false) }} />
            </>
          ) : (
            <>
              <CamposLectura form={form} onElegirLibro={() => setEligiendo(true)} />
              <p className="com-nota cc-side-nota">
                Cuando el club termine, eliges el siguiente libro desde la comunidad. Los anteriores quedan en «Lecturas anteriores».
              </p>
            </>
          )}
        </div>
      </form>
    </div>,
    document.body
  )
}

// ── Móvil: pantalla ────────────────────────────────────────
// Se dibuja dentro de .comm-screen (ComunidadesMobile), que pone el fondo
// y la cabecera; aquí va solo el cuerpo. `eligiendo` lo controla el padre
// para que su botón "atrás" vuelva del selector al formulario.

export function CrearComunidadPantalla({ user, onCreada, eligiendo, setEligiendo }) {
  const form = useFormCrear(user, onCreada)

  if (eligiendo) {
    return (
      <div className="comm-body">
        <SelectorLibro seleccionado={form.f.libro}
          onElegir={(l) => { form.set('libro', l); setEligiendo(false) }} />
      </div>
    )
  }

  return (
    <form className="comm-body cc-movil" onSubmit={form.enviar}>
      <CamposComunidad form={form} />
      <CamposLectura form={form} onElegirLibro={() => setEligiendo(true)} />
      {form.errorEnvio && <p className="com-error" role="alert">{form.errorEnvio}</p>}
      <div className="cc-movil-foot">
        <button type="submit" className="com-btn solid comm-big" disabled={form.creando}>
          {form.creando ? 'Creando…' : 'Crear comunidad'}
        </button>
      </div>
    </form>
  )
}
