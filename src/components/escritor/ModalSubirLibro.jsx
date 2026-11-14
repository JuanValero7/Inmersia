// Modal «Sube tu libro» (maqueta, pantallas 2a, 2b y 2c).
//   1 · Archivo: el .docx + las cuatro casillas de aviso.
//   2 · Revisa los capítulos: título, autor, ficción/no ficción y la lista
//       de capítulos que encontramos, con avisos si algo huele raro.
//   3 · Listo: el libro ya está en la repisa.
// El Word se lee aquí, en el navegador (lib/docxCapitulos.js); a la base
// solo llega el texto ya partido, al confirmar, y el .docx no se guarda.
// Al guardar no pasa por el PC de Juan (decisión del 13 nov): una sola
// llamada a crear_libro_escritor() guarda todo en menos de un segundo.
import { useState, useRef, useEffect, useMemo } from 'react'
import { leerDocx, detectarCapitulos, contarPalabras, capitulosRaros } from '../../lib/docxCapitulos.js'
import { useCrearLibroEscritor, mensajeErrorEscritor } from '../../hooks/useEscritor.js'

const TAMANO_MAX = 15 * 1024 * 1024
const AVISOS = [
  'Tu libro se guarda en la base de datos de Inmersia. Solo tú lo ves hasta que decidas publicarlo.',
  'Puedes eliminarlo cuando quieras, y se borra todo: texto, sonidos e imágenes.',
  'Los procesos de Inmersia (sonidos, imágenes, análisis, juegos) usan inteligencia artificial sobre tu texto.',
  'El texto es mío o tengo derecho a publicarlo.',
]

const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('es')} KB`
const tituloDesdeArchivo = (nombre) => nombre.replace(/\.docx$/i, '').replace(/[_]+/g, ' ').trim()

/**
 * @param {object} props
 * @param {{ id: string }} props.user
 * @param {string} props.autorPorDefecto
 * @param {() => void} props.onCerrar
 * @param {(libroId: string) => void} props.onGuardado
 */
export default function ModalSubirLibro({ user, autorPorDefecto, onCerrar, onGuardado }) {
  const [paso, setPaso] = useState(1)
  const [archivo, setArchivo] = useState(null)          // { nombre, tamano }
  const [leido, setLeido] = useState(null)              // { capitulos, descartadasAlInicio }
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState('')
  const [casillas, setCasillas] = useState(AVISOS.map(() => false))
  const [arrastrando, setArrastrando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [autor, setAutor] = useState(autorPorDefecto || '')
  const [esFiccion, setEsFiccion] = useState(true)
  const inputRef = useRef(null)
  const crear = useCrearLibroEscritor(user?.id)
  const guardando = crear.isPending

  // Esc cierra (salvo mientras se guarda).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !guardando) onCerrar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [guardando, onCerrar])

  const resumen = useMemo(() => {
    if (!leido) return null
    const palabras = leido.capitulos.map(c => c.reduce((s, p) => s + contarPalabras(p), 0))
    return {
      palabras,
      total: palabras.reduce((a, b) => a + b, 0),
      parrafos: leido.capitulos.reduce((s, c) => s + c.length, 0),
      raros: capitulosRaros(palabras),
    }
  }, [leido])

  const elegirArchivo = async (file) => {
    setError('')
    setLeido(null)
    setArchivo(null)
    if (!file) return
    if (!/\.docx$/i.test(file.name)) { setError('Tiene que ser un archivo de Word (.docx).'); return }
    if (file.size > TAMANO_MAX) { setError('El archivo pesa más de 15 MB. ¿Tiene imágenes dentro? Quítalas y vuelve a probar.'); return }
    setArchivo({ nombre: file.name, tamano: file.size })
    setLeyendo(true)
    try {
      const r = detectarCapitulos(await leerDocx(await file.arrayBuffer()))
      if (r.capitulos.length === 0) {
        setError('No encontramos ningún capítulo. Revisa que cada uno empiece con una línea propia: «Capítulo 1», «Capítulo 2»…')
      } else {
        setLeido(r)
        if (!titulo) setTitulo(tituloDesdeArchivo(file.name))
      }
    } catch {
      setError('No pudimos leer ese archivo. Ábrelo en Word, guárdalo otra vez como .docx y vuelve a probar.')
    } finally {
      setLeyendo(false)
    }
  }

  const guardar = async () => {
    setError('')
    try {
      const id = await crear.mutateAsync({
        titulo: titulo.trim(), autor: autor.trim(), esFiccion, capitulos: leido.capitulos,
      })
      onGuardado(id)
      setPaso(3)
    } catch (e) {
      setError(mensajeErrorEscritor(e, 'No pudimos guardar tu libro. Revisa tu conexión e inténtalo de nuevo.'))
    }
  }

  const todasMarcadas = casillas.every(Boolean)
  const claseDePaso = (n) => 'esc-paso' + (n < paso ? ' ok' : n === paso ? ' on' : '')

  return (
    <div className="esc-fondo-modal" role="dialog" aria-modal="true" aria-labelledby="esc-modal-tit">
      <div className="esc-modal">
        <div className="esc-modal-cab">
          <h2 id="esc-modal-tit">Sube tu libro</h2>
          <button type="button" className="esc-cerrar" onClick={onCerrar} disabled={guardando} aria-label="Cerrar">×</button>
        </div>
        <div className="esc-pasos">
          <div className={claseDePaso(1)}>1 · Archivo</div>
          <div className={claseDePaso(2)}>2 · Revisa los capítulos</div>
          <div className={claseDePaso(3)}>3 · Listo</div>
        </div>

        {paso === 1 && (
          <>
            <div className="esc-modal-cuerpo">
              <div className="esc-dos">
                <div
                  className={'esc-drop' + (archivo && leido ? ' cargado' : '') + (arrastrando ? ' arrastrando' : '')}
                  role="button" tabIndex={0}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
                  onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegirArchivo(e.dataTransfer.files?.[0]) }}
                >
                  <img src="/assets/landing/gatos/blanco-5.webp" alt="" />
                  <b>Arrastra aquí tu .docx</b>
                  <small>o <u>búscalo en tu computadora</u></small>
                  {archivo && (
                    <div className="esc-archivo">
                      <span className="esc-doc">DOCX</span>
                      <span className="esc-archivo-nombre">{archivo.nombre}</span>
                      <small>{leyendo ? 'Leyendo…' : kb(archivo.tamano)}</small>
                    </div>
                  )}
                  <input ref={inputRef} type="file" hidden
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => { elegirArchivo(e.target.files?.[0]); e.target.value = '' }} />
                </div>
                <div className="esc-reqs">
                  <h3>Antes de subirlo</h3>
                  <ul>
                    <li><i>✓</i><span>Un solo archivo de Word (.docx), con el libro completo.</span></li>
                    <li><i>✓</i><span>Cada capítulo empieza con una línea propia: <b>Capítulo 1</b>, <b>Capítulo 2</b>…</span></li>
                    <li><i>✓</i><span>Sin índice, dedicatoria ni notas al final (ya podrás añadirlos después).</span></li>
                  </ul>
                  <div className="esc-ejemplo">
                    <span className="esc-sepcap">Capítulo 1</span><br />
                    <span className="esc-resto">El viento llegó antes que el barco…</span><br /><br />
                    <span className="esc-sepcap">Capítulo 2</span><br />
                    <span className="esc-resto">Nadie en el pueblo quería hablar…</span>
                  </div>
                </div>
              </div>
              {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
              <div className="esc-avisos">
                <h3>Lo que pasa con tu libro</h3>
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
              <span className="esc-nota">
                {!archivo ? 'Elige tu archivo .docx.' : !todasMarcadas ? 'Marca las cuatro casillas para seguir.' : ''}
              </span>
              <button type="button" className="esc-pill esc-plana" onClick={onCerrar}>Cancelar</button>
              <button type="button" className="esc-pill esc-naranja" disabled={!todasMarcadas || !leido || leyendo}
                onClick={() => setPaso(2)}>Subir y leer capítulos</button>
            </div>
          </>
        )}

        {paso === 2 && leido && resumen && (
          <>
            <div className="esc-modal-cuerpo">
              <div className="esc-campos">
                <div className="esc-campo">
                  <label htmlFor="esc-titulo">Título</label>
                  <input id="esc-titulo" value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} />
                </div>
                <div className="esc-campo">
                  <label htmlFor="esc-autor">Nombre de autor (como aparecerá)</label>
                  <input id="esc-autor" value={autor} maxLength={120} onChange={(e) => setAutor(e.target.value)} />
                </div>
              </div>
              <div className="esc-tipo-libro">
                <label>¿Qué tipo de libro es?</label>
                <div className="esc-tipos">
                  <button type="button" className={'esc-tipo' + (esFiccion ? ' on' : '')} aria-pressed={esFiccion} onClick={() => setEsFiccion(true)}>
                    <b>Ficción</b>
                    <span>Novela, cuentos, teatro. Lleva efectos y ambientes de sonido, ilustraciones, cartelera de personajes y lugares, y juegos adaptados a este tipo de libro.</span>
                  </button>
                  <button type="button" className={'esc-tipo' + (!esFiccion ? ' on' : '')} aria-pressed={!esFiccion} onClick={() => setEsFiccion(false)}>
                    <b>No ficción</b>
                    <span>Ensayo, divulgación, filosofía, historia. Lleva ruidos para concentrarse, infografías por capítulo, glosario y referencias, y juegos adaptados a este tipo de libro.</span>
                  </button>
                </div>
                <small className="esc-nota">Esto decide qué podrás hacer después. No se puede cambiar sin volver a subir el libro.</small>
              </div>

              <div className="esc-resumen-cap">
                <b>Encontramos {leido.capitulos.length} {leido.capitulos.length === 1 ? 'capítulo' : 'capítulos'}</b>
                <span>· {resumen.total.toLocaleString('es')} palabras · revisa que estén todos</span>
              </div>
              <div className="esc-caps">
                {leido.capitulos.map((c, i) => {
                  const raro = resumen.raros.includes(i)
                  return (
                    <div key={i} className={'esc-cap' + (raro ? ' raro' : '')}>
                      <div className="n">{i + 1}</div>
                      <div><span className="t">Capítulo {i + 1}</span><span className="prim">{c[0]}</span></div>
                      <div className="pal">{resumen.palabras[i].toLocaleString('es')} pal.{raro ? ' ⚠' : ''}</div>
                    </div>
                  )
                })}
              </div>

              {resumen.raros.length > 0 && (
                <div className="esc-alerta"><span>⚠️</span><span>
                  {resumen.raros.length === 1
                    ? <>El <b>capítulo {resumen.raros[0] + 1}</b> es mucho más largo que los demás. A lo mejor le falta una línea de «Capítulo {resumen.raros[0] + 2}» en el Word.</>
                    : <>Los capítulos <b>{resumen.raros.map(i => i + 1).join(', ')}</b> son mucho más largos que los demás. A lo mejor les falta una línea de «Capítulo N» en el Word.</>}
                  {' '}Si es así, corrígelo y vuelve a subirlo.
                </span></div>
              )}
              {leido.descartadasAlInicio.length > 0 && (
                <div className="esc-alerta"><span>⚠️</span><span>
                  Lo que hay antes del <b>Capítulo 1</b> no se guarda ({leido.descartadasAlInicio.length}{' '}
                  {leido.descartadasAlInicio.length === 1 ? 'línea' : 'líneas'}, empieza por «{leido.descartadasAlInicio[0].slice(0, 60)}»).
                  Si ahí hay un prólogo, ponle delante una línea «Capítulo 1» y vuelve a subirlo.
                </span></div>
              )}
              {error && <div className="esc-alerta esc-error"><span>⚠️</span><span>{error}</span></div>}
            </div>
            <div className="esc-modal-pie">
              <button type="button" className="esc-pill esc-plana" disabled={guardando} onClick={() => { setPaso(1); setError('') }}>← Subir otro archivo</button>
              <span className="esc-hueco" />
              <button type="button" className="esc-pill esc-naranja" disabled={guardando || !titulo.trim() || !autor.trim()} onClick={guardar}>
                {guardando ? 'Guardando tu libro…' : 'Está bien, guardar libro'}
              </button>
            </div>
          </>
        )}

        {paso === 3 && resumen && (
          <>
            <div className="esc-modal-cuerpo">
              <div className="esc-cola">
                <img src="/assets/landing/gatos/blanco-7.webp" alt="" />
                <h3>Tu libro ya está en tu repisa</h3>
                <p>Lo guardamos capítulo a capítulo. Solo tú lo ves hasta que decidas publicarlo.</p>
                <div className="esc-barras">
                  <div className="esc-barra">
                    <div><span>Capítulos</span><span>{leido.capitulos.length} / {leido.capitulos.length}</span></div>
                    <div className="esc-riel"><i style={{ width: '100%' }} /></div>
                  </div>
                  <div className="esc-barra">
                    <div><span>Párrafos</span><span>{resumen.parrafos.toLocaleString('es')} / {resumen.parrafos.toLocaleString('es')}</span></div>
                    <div className="esc-riel"><i style={{ width: '100%' }} /></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="esc-modal-pie">
              <button type="button" className="esc-pill esc-naranja" onClick={onCerrar}>Ir a mi repisa</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
