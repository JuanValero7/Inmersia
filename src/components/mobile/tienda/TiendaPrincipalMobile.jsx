import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { useCatalogoFiltro } from '../../../hooks/useCatalogoFiltro.js'
import { useFichaEnUrl } from '../../../hooks/useFichaEnUrl.js'
import { usePortadaTienda } from '../../../hooks/usePortadaTienda.js'
import { imgUrl } from '../../../lib/img.js'
import { evento } from '../../../lib/analytics.js'
import { CAT_COLOR } from '../../tienda/tiendaHelpers.jsx'
import { BookCard, CoverCard, Pagination, TIPOS } from '../../tienda/catalogoShared.jsx'
import { SalaCard } from '../../tienda/salaPiezas.jsx'
import FichaLibroMobile from './FichaLibroMobile.jsx'
import CabeceraTiendaMobile from './CabeceraTiendaMobile.jsx'
import '../../../styles/tienda-principal.css'
import '../../../styles/tienda.mobile.css'

// =============================================================
// TiendaPrincipalMobile · la portada de la Tienda en el teléfono
// (plan de la tienda, 1.2 móvil). De arriba abajo:
//   fila fija (Atrás, logo, lupa) → [Filtros] · Todos · Ficción · No ficción
//   (se desplazan con la página) → portada de temporada → carrusel de
//   salas → 2 carriles de 6 → «Todo el catálogo».
// La lupa convierte la fila en buscador con «Cancelar». Buscar o filtrar
// reemplaza el contenido por la rejilla de 2 columnas del catálogo.
// Filtros abre una hoja inferior con las categorías.
// Datos de la portada: usePortadaTienda, el mismo hook que escritorio.
// =============================================================

const MAX_POR_CARRIL = 6
const CARRILES_MOVIL = ['empezar', 'tarde']

const diaYMes = (fecha) => new Date(`${fecha}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'long' })

const IconoBuscar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>
)
const IconoFiltros = () => (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
)
const IconoCerrar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
)

// Hoja inferior con las categorías. «Ver N libros» cierra: los filtros ya
// se aplican al tocarlos, el número es para saber qué va a salir.
function HojaFiltros({ categorias, seleccion, onAlternar, onQuitar, total, onCerrar }) {
  // Mientras está abierta, la página de atrás no se desplaza.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  const cerrarFuera = (e) => { if (e.target === e.currentTarget) onCerrar() }
  return (
    <div className="tpm-velo" onClick={cerrarFuera}>
      <div className="tpm-hoja" role="dialog" aria-modal="true" aria-labelledby="tpm-hoja-titulo">
        <div className="tpm-hoja-cab">
          <h2 id="tpm-hoja-titulo">Filtros</h2>
          <button type="button" className="tpm-icono" onClick={onCerrar} aria-label="Cerrar los filtros"><IconoCerrar /></button>
        </div>
        <div className="tpm-hoja-cuerpo">
          <p className="tpm-hoja-sec">Categorías</p>
          <div className="tpm-hoja-chips">
            {categorias.map(c => (
              <button key={c} type="button" className={clsx('tp-chip', seleccion.has(c) && 'on')} onClick={() => onAlternar(c)} aria-pressed={seleccion.has(c)}>
                <span className="tp-punto" style={{ background: CAT_COLOR[c] || 'var(--accent)' }} />{c}
              </button>
            ))}
          </div>
        </div>
        <div className="tpm-hoja-pie">
          <button type="button" className="tpm-pill" onClick={onQuitar} disabled={seleccion.size === 0}>Quitar todo</button>
          <button type="button" className="tpm-pill tpm-pill-naranja" onClick={onCerrar}>Ver {total} {total === 1 ? 'libro' : 'libros'}</button>
        </div>
      </div>
    </div>
  )
}

export default function TiendaPrincipalMobile({ catalogo, loading, user, gatoColor = 'negro', tieneLibro, bloqueado = false, onComprar, onEmpezarLeer, onSalir, onIrCatalogo, onIrSala, porLaCalle = false }) {
  const { temporada, temporadaLibros, salas, librosDe, carriles } = usePortadaTienda(catalogo)
  const { libro: fichaLibro, abrir, cerrar } = useFichaEnUrl(catalogo)
  const [tipo, setTipo] = useState('todos')
  const [buscando, setBuscando] = useState(false)
  const [verFiltros, setVerFiltros] = useState(false)
  const filtro = useCatalogoFiltro(catalogo, tipo, tieneLibro, { amplia: true, donde: 'principal_movil' })
  const filtrando = !!filtro.q.trim() || tipo !== 'todos' || filtro.selCats.size > 0

  const origenVista = useRef(porLaCalle ? 'calle' : user ? 'directa' : 'invitado')
  useEffect(() => { evento('tienda_vista', { origen: origenVista.current }) }, [])

  // Al abrir el buscador, el teclado sale solo.
  const inputRef = useRef(null)
  useEffect(() => { if (buscando) inputRef.current?.focus() }, [buscando])

  const elegirTipo = (k) => { setTipo(k); evento('tienda_filtro', { tipo: k, categorias: [...filtro.selCats] }) }
  const alternarCategoria = (c) => {
    const nuevas = new Set(filtro.selCats)
    if (nuevas.has(c)) nuevas.delete(c); else nuevas.add(c)
    filtro.toggleCat(c)
    evento('tienda_filtro', { tipo, categorias: [...nuevas] })
  }
  const cancelarBusqueda = () => { filtro.handleQChange(''); setBuscando(false) }
  const limpiar = () => { filtro.resetFiltro(setTipo); setBuscando(false) }

  const carrilesMovil = carriles.filter(c => CARRILES_MOVIL.includes(c.clave))

  const buscador = buscando && (
    <>
      <label className="tpm-buscador">
        <IconoBuscar />
        <input ref={inputRef} type="search" enterKeyHint="search" value={filtro.q}
          onChange={e => filtro.handleQChange(e.target.value)} onKeyDown={filtro.handleQKeyDown}
          placeholder="Título, autor… o «piratas»" aria-label="Buscar en la tienda" />
      </label>
      <button type="button" className="tpm-cancelar" onClick={cancelarBusqueda}>Cancelar</button>
    </>
  )

  return (
    <div className="tpm">
      <CabeceraTiendaMobile
        etiquetaAtras={user ? 'Biblioteca' : 'Volver'}
        onAtras={onSalir}
        buscador={buscador}
        derecha={<button type="button" className="tpm-icono" onClick={() => setBuscando(true)} aria-label="Buscar"><IconoBuscar /></button>}
      />

      <nav className="tpm-chips" aria-label="Filtrar la tienda">
        <button type="button" className={clsx('tp-chip', filtro.selCats.size > 0 && 'on')} onClick={() => setVerFiltros(true)}>
          <IconoFiltros /> Filtros{filtro.selCats.size > 0 ? ` · ${filtro.selCats.size}` : ''}
        </button>
        <span className="tp-sep" aria-hidden="true" />
        {TIPOS.map(({ key, label }) => (
          <button key={key} type="button" className={clsx('tp-chip', tipo === key && 'on')} onClick={() => elegirTipo(key)}>{label}</button>
        ))}
      </nav>

      <main>
        {filtrando ? (
          <section className="tpm-resultados" aria-live="polite">
            <div className="tpm-resultados-cab">
              <h2>{filtro.list.length} {filtro.list.length === 1 ? 'libro' : 'libros'}{filtro.q.trim() ? ` para «${filtro.q.trim()}»` : ''}</h2>
              <button type="button" className="tpm-pill" onClick={limpiar}>Limpiar</button>
            </div>
            {filtro.list.length > 0 ? (
              <>
                <div className="int-grid" ref={filtro.gridRef}>
                  {filtro.paginatedList.map(b => <BookCard key={b.id} libro={b} adquirido={tieneLibro(b.id)} onOpen={abrir} />)}
                </div>
                <Pagination page={filtro.page} total={filtro.list.length} onChange={filtro.goToPage} />
              </>
            ) : (
              <p className="tp-vacio">No encontramos nada. Prueba con otra palabra, quita algún filtro o entra a una sala.</p>
            )}
          </section>
        ) : loading ? (
          <p className="tp-vacio">Cargando la tienda…</p>
        ) : (
          <>
            {temporada && (
              <section className="tpm-hero" style={temporada.imagen_url ? { backgroundImage: `url("${imgUrl(temporada.imagen_url, { width: 800 })}")` } : undefined}>
                <div className="tpm-hero-portadas" aria-hidden="true">
                  {temporadaLibros.slice(0, 2).map(l => <CoverCard key={l.id} libro={l} />)}
                </div>
                <div className="tpm-hero-txt">
                  <span className="tp-eyebrow">Temporada{temporada.hasta ? ` · hasta el ${diaYMes(temporada.hasta)}` : ''}</span>
                  <h1>{temporada.nombre}</h1>
                  {temporada.linea && <p>{temporada.linea}</p>}
                  <button type="button" className="tpm-pill tpm-pill-naranja" onClick={() => onIrSala(temporada.slug)}>
                    Ver {temporadaLibros.length === 1 ? 'el libro' : `los ${temporadaLibros.length}`}
                  </button>
                </div>
              </section>
            )}

            {salas.length > 0 && (
              <section className="tpm-sec" aria-label="Las salas">
                <div className="tpm-sec-cab">
                  <h2>Las salas</h2>
                  <p>Desliza para ver todas.</p>
                </div>
                <div className="tpm-pista tpm-salas">
                  {salas.map(s => (
                    <SalaCard key={s.id} sala={s} numLibros={librosDe(s).length} onAbrir={() => onIrSala(s.slug)} />
                  ))}
                </div>
              </section>
            )}

            {carrilesMovil.map(c => (
              <section key={c.clave} className="tpm-sec" aria-label={c.titulo}>
                <div className="tpm-sec-cab">
                  <h2>{c.titulo}</h2>
                  <p>{c.subtitulo}</p>
                </div>
                <div className="tpm-pista tpm-carril">
                  {c.libros.slice(0, MAX_POR_CARRIL).map(l => (
                    <button key={l.id} type="button" className="tp-libro" onClick={() => abrir(l)}
                      aria-label={`${l.titulo}, ${l.autor}${tieneLibro(l.id) ? ' (ya está en tu biblioteca)' : ''}`}>
                      {tieneLibro(l.id) && <span className="tp-check" aria-hidden="true">✓</span>}
                      <CoverCard libro={l} grande />
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <section className="tpm-todo">
              <div className="tpm-todo-fila">
                <img src={`/assets/tienda/gato-${gatoColor}-5.webp`} alt="" />
                <div>
                  <h2>Todo el catálogo</h2>
                  <p>{catalogo.length} libros, con filtros por categoría.</p>
                </div>
              </div>
              <button type="button" className="tpm-pill tpm-pill-naranja" onClick={onIrCatalogo}>Ver todo el catálogo</button>
            </section>
          </>
        )}
      </main>

      {verFiltros && (
        <HojaFiltros
          categorias={filtro.availableCats}
          seleccion={filtro.selCats}
          onAlternar={alternarCategoria}
          onQuitar={filtro.clearCats}
          total={filtro.list.length}
          onCerrar={() => setVerFiltros(false)}
        />
      )}

      {fichaLibro && (
        <FichaLibroMobile
          key={fichaLibro.id}
          libro={fichaLibro}
          user={user}
          yaAdquirido={tieneLibro(fichaLibro.id)}
          bloqueado={bloqueado}
          onComprar={() => { onComprar(fichaLibro); cerrar() }}
          onEmpezarLeer={() => onEmpezarLeer(fichaLibro)}
          onCerrar={cerrar}
          origen="tienda"
        />
      )}
    </div>
  )
}
