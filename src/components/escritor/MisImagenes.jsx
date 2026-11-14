// Mis imágenes (maqueta, pantallas 6, 6b y 6c; migración 107).
// El escritor sube sus propias ilustraciones, gratis: hasta 20 por libro.
// Cada una va a un capítulo (polaroid en el lector, en el párrafo N-5) o a
// ninguno por ahora. Personajes y lugares llegan con la cartelera (fase 4).
// El navegador las pasa a WebP (lib/imagenWebp.js) antes de subirlas.
import { useState, useRef, useEffect, useMemo } from 'react'
import { aWebp, TIPOS_ACEPTADOS, TAMANO_MAX } from '../../lib/imagenWebp.js'
import {
  useImagenesLibro, useCapitulosLibro, useSubirImagenPropia, useActualizarImagen,
  useDescartarImagen, mensajeErrorEscritor,
} from '../../hooks/useEscritor.js'

const TOPE = 20
const AVISOS = [
  'Las imágenes son mías o tengo permiso para usarlas y publicarlas.',
  'No muestran a personas reales sin su permiso, ni contenido sexual o violencia explícita (en Inmersia leen chicos desde 14 años).',
  'Se guardan en Inmersia junto a tu libro y puedes borrarlas cuando quieras.',
]
const mb = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString('es', { maximumFractionDigits: 1 })} MB` : `${Math.round(b / 1024)} KB`)

/** Select de capítulo: '' = ninguno por ahora. */
function SelectCapitulo({ capitulos, value, onChange, id }) {
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
      <option value="">Ninguno por ahora</option>
      {capitulos.map(c => <option key={c.numero} value={c.numero}>Capítulo {c.numero}</option>)}
    </select>
  )
}

export default function MisImagenes({ user, libro }) {
  const { data: imagenes = [] } = useImagenesLibro(libro.id)
  const { data: capitulos = [] } = useCapitulosLibro(libro.id)
  const [subiendo, setSubiendo] = useState(false)
  const propias = imagenes.filter(i => i.tipo === 'propia')

  return (
    <section className="esc-vidrio">
      <div className="esc-propias-cab">
        <div>
          <h2>Tus propias imágenes</h2>
          <ul className="esc-vinetas">
            <li>¿Tienes tus propias ilustraciones? Súbelas <b>gratis</b>.</li>
            <li>Elige en qué capítulo va cada una: aparece en el lector en ese punto.</li>
            {libro.es_ficcion && <li>Más adelante podrás ponerlas también en las fichas de personajes y lugares.</li>}
            <li>Llevas <b>{propias.length} de {TOPE}</b>{propias.length >= TOPE ? ': borra alguna para subir otra' : ''}. JPG, PNG o WebP, hasta 5 MB cada una.</li>
          </ul>
        </div>
        <button type="button" className="esc-pill esc-naranja" disabled={propias.length >= TOPE} onClick={() => setSubiendo(true)}>＋ Subir imágenes</button>
      </div>

      {propias.length === 0 ? (
        <p className="esc-gris">Todavía no has subido ninguna.</p>
      ) : (
        <div className="esc-propias">
          {propias.map(img => <TarjetaPropia key={img.id} img={img} capitulos={capitulos} user={user} libro={libro} />)}
        </div>
      )}

      {subiendo && (
        <ModalSubirImagenes user={user} libro={libro} capitulos={capitulos}
          quedan={TOPE - propias.length} llevas={propias.length} onCerrar={() => setSubiendo(false)} />
      )}
    </section>
  )
}

function TarjetaPropia({ img, capitulos, user, libro }) {
  const actualizar = useActualizarImagen(libro.id)
  const quitar = useDescartarImagen(user?.id, libro.id)
  const [capitulo, setCapitulo] = useState(img.capitulo)
  const [pie, setPie] = useState(img.pie || '')
  const [error, setError] = useState('')
  useEffect(() => { setCapitulo(img.capitulo); setPie(img.pie || '') }, [img.capitulo, img.pie])
  const cambiado = capitulo !== img.capitulo || pie.trim() !== (img.pie || '')

  const guardar = async () => {
    setError('')
    try { await actualizar.mutateAsync({ id: img.id, capitulo, pie: pie.trim() }) }
    catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos guardar el cambio.')) }
  }
  const borrar = async () => {
    if (!window.confirm('¿Borrar esta imagen? Desaparece de tu libro.')) return
    try { await quitar.mutateAsync(img.id) } catch (e) { setError(mensajeErrorEscritor(e, 'No pudimos borrarla.')) }
  }

  return (
    <figure className="esc-propia">
      <a href={img.url} target="_blank" rel="noreferrer"><img src={img.url} alt={img.pie || ''} loading="lazy" /></a>
      <label>Va en
        <SelectCapitulo capitulos={capitulos} value={capitulo} onChange={setCapitulo} />
      </label>
      <label>Pie de imagen
        <input value={pie} maxLength={200} placeholder="(opcional)" onChange={(e) => setPie(e.target.value)} />
      </label>
      {error && <p className="esc-falta esc-letra">{error}</p>}
      <div className="esc-fila-botones">
        <button type="button" className="esc-borrar" onClick={borrar} disabled={quitar.isPending}>Borrar</button>
        {cambiado && <button type="button" className="esc-pill esc-naranja esc-chica" onClick={guardar} disabled={actualizar.isPending}>
          {actualizar.isPending ? 'Guardando…' : 'Guardar cambio'}</button>}
      </div>
    </figure>
  )
}

// ── Modal de subida (maqueta 6b y 6c) ─────────────────────────

function ModalSubirImagenes({ user, libro, capitulos, quedan, llevas, onCerrar }) {
  const subir = useSubirImagenPropia(user?.id, libro.id)
  const [paso, setPaso] = useState(1)
  const [archivos, setArchivos] = useState([]) // { id, file, preview, capitulo, pie }
  const [casillas, setCasillas] = useState(AVISOS.map(() => false))
  const [aviso, setAviso] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const [enviando, setEnviando] = useState(null) // { hecho, total }
  const [errores, setErrores] = useState([])
  const inputRef = useRef(null)

  // Al cerrar, liberar las vistas previas que queden.
  const archivosRef = useRef(archivos)
  archivosRef.current = archivos
  useEffect(() => () => archivosRef.current.forEach(a => URL.revokeObjectURL(a.preview)), [])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !enviando) onCerrar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enviando, onCerrar])

  const agregar = (lista) => {
    const nuevos = []
    const rechazos = []
    for (const file of Array.from(lista || [])) {
      if (!TIPOS_ACEPTADOS.includes(file.type)) { rechazos.push(`${file.name}: tiene que ser JPG, PNG o WebP`); continue }
      if (file.size > TAMANO_MAX) { rechazos.push(`${file.name}: pesa más de 5 MB`); continue }
      nuevos.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), capitulo: null, pie: '' })
    }
    const caben = Math.max(0, quedan - archivos.length)
    if (nuevos.length > caben) rechazos.push(`Solo caben ${quedan} más en este libro: dejamos las primeras.`)
    nuevos.slice(caben).forEach(a => URL.revokeObjectURL(a.preview))
    setArchivos(prev => [...prev, ...nuevos.slice(0, caben)])
    setAviso(rechazos.join(' · '))
  }
  const cambiar = (id, campos) => setArchivos(prev => prev.map(a => (a.id === id ? { ...a, ...campos } : a)))
  const quitar = (id) => setArchivos(prev => {
    const a = prev.find(x => x.id === id); if (a) URL.revokeObjectURL(a.preview)
    return prev.filter(x => x.id !== id)
  })

  const guardar = async () => {
    setErrores([])
    const fallos = []
    for (let i = 0; i < archivos.length; i++) {
      const a = archivos[i]
      setEnviando({ hecho: i, total: archivos.length })
      try {
        const blob = await aWebp(a.file)
        await subir.mutateAsync({ blob, capitulo: a.capitulo, pie: a.pie.trim() })
        // Subida: fuera de la lista, para no duplicarla si se reintenta.
        URL.revokeObjectURL(a.preview)
        setArchivos(prev => prev.filter(x => x.id !== a.id))
      } catch (e) {
        fallos.push(`${a.file.name}: ${mensajeErrorEscritor(e, 'no se pudo subir')}`)
        if (e?.hint === 'limite_imagenes') break
      }
    }
    setEnviando(null)
    if (fallos.length) setErrores(fallos)
    else onCerrar()
  }

  const todas = casillas.every(Boolean)
  const clase = (n) => 'esc-paso' + (n < paso ? ' ok' : n === paso ? ' on' : '')
  const llevaras = useMemo(() => llevas + archivos.length, [llevas, archivos.length])

  return (
    <div className="esc-fondo-modal" role="dialog" aria-modal="true" aria-labelledby="esc-subir-img-tit">
      <div className="esc-modal">
        <div className="esc-modal-cab">
          <h2 id="esc-subir-img-tit">Sube tus imágenes</h2>
          <button type="button" className="esc-cerrar" onClick={onCerrar} disabled={!!enviando} aria-label="Cerrar">×</button>
        </div>
        <div className="esc-pasos">
          <div className={clase(1)}>1 · Archivos</div>
          <div className={clase(2)}>2 · Dónde va cada una</div>
        </div>

        {paso === 1 && (
          <>
            <div className="esc-modal-cuerpo">
              <div className="esc-dos">
                <div className={'esc-drop' + (archivos.length ? ' cargado' : '') + (arrastrando ? ' arrastrando' : '')}
                  role="button" tabIndex={0}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
                  onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={(e) => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files) }}>
                  <img src="/assets/landing/gatos/blanco-5.webp" alt="" />
                  <b>Arrastra aquí tus imágenes</b>
                  <small>o <u>búscalas en tu computadora</u> · puedes subir varias a la vez</small>
                  {archivos.map(a => (
                    <div key={a.id} className="esc-archivo">
                      <span className="esc-doc">{a.file.type.split('/')[1].toUpperCase().replace('JPEG', 'JPG')}</span>
                      <span className="esc-archivo-nombre">{a.file.name}</span>
                      <small>{mb(a.file.size)}</small>
                    </div>
                  ))}
                  <input ref={inputRef} type="file" hidden multiple accept={TIPOS_ACEPTADOS.join(',')}
                    onChange={(e) => { agregar(e.target.files); e.target.value = '' }} />
                </div>
                <div className="esc-reqs">
                  <h3>Antes de subirlas</h3>
                  <ul>
                    <li><i>✓</i><span>JPG, PNG o WebP, hasta 5 MB cada una.</span></li>
                    <li><i>✓</i><span>Mejor en horizontal: así se ven completas en el lector.</span></li>
                    <li><i>✓</i><span>Puedes tener hasta {TOPE} imágenes propias por libro. Llevas {llevas}: te quedan {quedan}.</span></li>
                    <li><i>✓</i><span>Subirlas es gratis.</span></li>
                  </ul>
                </div>
              </div>
              {aviso && <div className="esc-alerta"><span>⚠️</span><span>{aviso}</span></div>}
              <div className="esc-avisos">
                <h3>Sobre tus imágenes</h3>
                {AVISOS.map((txt, i) => (
                  <label key={txt}>
                    <input type="checkbox" checked={casillas[i]}
                      onChange={(e) => setCasillas(c => c.map((v, j) => (j === i ? e.target.checked : v)))} />
                    {txt}
                  </label>
                ))}
              </div>
            </div>
            <div className="esc-modal-pie">
              <span className="esc-nota">{!archivos.length ? 'Elige tus imágenes.' : !todas ? 'Marca las tres casillas para seguir.' : ''}</span>
              <button type="button" className="esc-pill esc-plana" onClick={onCerrar}>Cancelar</button>
              <button type="button" className="esc-pill esc-naranja" disabled={!todas || !archivos.length} onClick={() => setPaso(2)}>
                Seguir con {archivos.length} {archivos.length === 1 ? 'imagen' : 'imágenes'}
              </button>
            </div>
          </>
        )}

        {paso === 2 && (
          <>
            <div className="esc-modal-cuerpo">
              <p className="esc-letra">Dinos dónde va cada imagen. Las que pongas en un capítulo aparecen en el lector en ese punto.</p>
              <div className="esc-donde">
                {archivos.map(a => (
                  <div key={a.id} className="esc-donde-fila">
                    <img src={a.preview} alt="" />
                    <div className="esc-donde-campos">
                      <b>{a.file.name}</b>
                      <label>Va en
                        <SelectCapitulo capitulos={capitulos} value={a.capitulo} onChange={(v) => cambiar(a.id, { capitulo: v })} />
                      </label>
                      <label>Pie de imagen (opcional)
                        <input value={a.pie} maxLength={200} onChange={(e) => cambiar(a.id, { pie: e.target.value })} />
                      </label>
                    </div>
                    <button type="button" className="esc-borrar" disabled={!!enviando} onClick={() => quitar(a.id)}>Quitar</button>
                  </div>
                ))}
              </div>
              {errores.length > 0 && (
                <div className="esc-alerta esc-error"><span>⚠️</span><span>{errores.join(' · ')}</span></div>
              )}
            </div>
            <div className="esc-modal-pie">
              <span className="esc-nota">
                {enviando ? `Subiendo ${enviando.hecho + 1} de ${enviando.total}…` : `Después de guardar llevarás ${llevaras} de ${TOPE}.`}
              </span>
              <button type="button" className="esc-pill esc-plana" disabled={!!enviando} onClick={() => setPaso(1)}>← Atrás</button>
              <button type="button" className="esc-pill esc-naranja" disabled={!!enviando || !archivos.length} onClick={guardar}>
                {enviando ? 'Subiendo…' : 'Guardar imágenes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
