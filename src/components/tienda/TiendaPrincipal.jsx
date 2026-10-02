import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { useCatalogoFiltro } from '../../hooks/useCatalogoFiltro.js'
import { useFichaEnUrl } from '../../hooks/useFichaEnUrl.js'
import { usePortadaTienda } from '../../hooks/usePortadaTienda.js'
import { imgUrl } from '../../lib/img.js'
import { evento } from '../../lib/analytics.js'
import { CAT_COLOR } from './tiendaHelpers.jsx'
import { BookCard, CoverCard, Pagination, TIPOS } from './catalogoShared.jsx'
import { SalaCard } from './salaPiezas.jsx'
import FichaLibro from './FichaLibro.jsx'
import CabeceraTienda from './CabeceraTienda.jsx'
import '../../styles/tienda-principal.css'

// =============================================================
// TiendaPrincipal · la portada de la Tienda en escritorio
// (plan de la tienda, 1.2). De arriba abajo:
//   cabecera (Atrás, logo, buscador) → [Filtros] · Todos · Ficción · No ficción →
//   portada de temporada → las salas → 3 carriles → «Todo el catálogo».
// Buscar o filtrar reemplaza todo eso por los resultados, con la misma
// tarjeta y rejilla que el catálogo; «Limpiar» vuelve. No se navega:
// así el botón Atrás no se enreda.
// La ficha se abre encima y vive en la URL (?libro=, ver useFichaEnUrl).
// =============================================================

const MAX_POR_CARRIL = 8
const CARRILES = ['empezar', 'tarde', 'nuevos']

const diaYMes = (fecha) => new Date(`${fecha}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'long' })

const IconoBuscar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>
)
const IconoFiltros = () => (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
)
const Flecha = ({ dir }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir < 0 ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
  </svg>
)

function Carril({ titulo, subtitulo, libros, tieneLibro, onAbrir }) {
  const pista = useRef(null)
  const mover = (dir) => pista.current?.scrollBy({ left: dir * pista.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section className="tp-sec" aria-label={titulo}>
      <div className="tp-sec-cab">
        <div className="tp-sec-txt">
          <h2>{titulo}</h2>
          <p>{subtitulo}</p>
        </div>
        <button type="button" className="tp-flecha" onClick={() => mover(-1)} aria-label={`${titulo}: anteriores`}><Flecha dir={-1} /></button>
        <button type="button" className="tp-flecha" onClick={() => mover(1)} aria-label={`${titulo}: siguientes`}><Flecha dir={1} /></button>
      </div>
      <div className="tp-pista" ref={pista}>
        {libros.map(l => (
          <button key={l.id} type="button" className="tp-libro" onClick={() => onAbrir(l)}
            aria-label={`${l.titulo}, ${l.autor}${tieneLibro(l.id) ? ' (ya está en tu biblioteca)' : ''}`}>
            {tieneLibro(l.id) && <span className="tp-check" aria-hidden="true">✓</span>}
            <CoverCard libro={l} grande />
          </button>
        ))}
      </div>
    </section>
  )
}

export default function TiendaPrincipal({ catalogo, loading, user, gatoColor = 'negro', tieneLibro, bloqueado = false, onComprar, onEmpezarLeer, onSalir, onIrCatalogo, onIrSala, porLaCalle = false }) {
  const { temporada, temporadaLibros, salas: salasPasillo, librosDe, carriles } = usePortadaTienda(catalogo, { claves: CARRILES, porCarril: MAX_POR_CARRIL })
  const { libro: fichaLibro, abrir, cerrar } = useFichaEnUrl(catalogo)
  const [tipo, setTipo] = useState('todos')
  const [verFiltros, setVerFiltros] = useState(false)
  const filtro = useCatalogoFiltro(catalogo, tipo, tieneLibro, { amplia: true, donde: 'principal' })
  const filtrando = !!filtro.q.trim() || tipo !== 'todos' || filtro.selCats.size > 0

  // Una vez al llegar, no en cada cambio de la URL (la ficha también la cambia).
  const origenVista = useRef(porLaCalle ? 'calle' : user ? 'directa' : 'invitado')
  useEffect(() => { evento('tienda_vista', { origen: origenVista.current }) }, [])

  const elegirTipo = (k) => { setTipo(k); evento('tienda_filtro', { tipo: k, categorias: [...filtro.selCats] }) }
  const alternarCategoria = (c) => {
    const nuevas = new Set(filtro.selCats)
    if (nuevas.has(c)) nuevas.delete(c); else nuevas.add(c)
    filtro.toggleCat(c)
    evento('tienda_filtro', { tipo, categorias: [...nuevas] })
  }
  const limpiar = () => { filtro.resetFiltro(setTipo); setVerFiltros(false) }

  return (
    <div className="tp">
      <CabeceraTienda etiquetaAtras={user ? 'Biblioteca' : 'Volver'} onAtras={onSalir} user={user}>
          <label className="tp-buscador">
            <IconoBuscar />
            <input type="text" value={filtro.q} onChange={e => filtro.handleQChange(e.target.value)} onKeyDown={filtro.handleQKeyDown}
              placeholder="Busca un título, un autor… o prueba «piratas», «fantasma», «amor»" aria-label="Buscar en la tienda" />
            {filtro.q && <button type="button" className="tp-limpiar-q" onClick={() => filtro.handleQChange('')} aria-label="Borrar la búsqueda">×</button>}
          </label>
      </CabeceraTienda>

      <nav className="tp-chips" aria-label="Filtrar la tienda">
        <button type="button" className={clsx('tp-chip', filtro.selCats.size > 0 && 'on')} onClick={() => setVerFiltros(v => !v)} aria-expanded={verFiltros}>
          <IconoFiltros /> Filtros{filtro.selCats.size > 0 ? ` · ${filtro.selCats.size}` : ''}
        </button>
        <span className="tp-sep" aria-hidden="true" />
        {TIPOS.map(({ key, label }) => (
          <button key={key} type="button" className={clsx('tp-chip', tipo === key && 'on')} onClick={() => elegirTipo(key)}>{label}</button>
        ))}
      </nav>
      {verFiltros && (
        <div className="tp-panel-filtros">
          <span className="tp-panel-lbl">Categorías</span>
          {filtro.availableCats.map(c => (
            <button key={c} type="button" className={clsx('tp-chip', filtro.selCats.has(c) && 'on')} onClick={() => alternarCategoria(c)}>
              <span className="tp-punto" style={{ background: CAT_COLOR[c] || 'var(--accent)' }} />{c}
            </button>
          ))}
          {filtro.selCats.size > 0 && <button type="button" className="tp-enlace" onClick={filtro.clearCats}>Quitar categorías</button>}
        </div>
      )}

      <main className="tp-main">
        {filtrando ? (
          <section className="tp-resultados" aria-live="polite">
            <div className="tp-resultados-cab">
              <h2>{filtro.list.length} {filtro.list.length === 1 ? 'libro' : 'libros'}{filtro.q.trim() ? ` para «${filtro.q.trim()}»` : ''}</h2>
              <button type="button" className="tp-pill" onClick={limpiar}>Limpiar</button>
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
              <section className="tp-hero" style={temporada.imagen_url ? { backgroundImage: `url("${imgUrl(temporada.imagen_url, { width: 1400 })}")` } : undefined}>
                <div className="tp-hero-txt">
                  <span className="tp-eyebrow">Temporada{temporada.hasta ? ` · hasta el ${diaYMes(temporada.hasta)}` : ''}</span>
                  <h1>{temporada.nombre}</h1>
                  {temporada.linea && <p>{temporada.linea}</p>}
                  <button type="button" className="tp-pill tp-pill-naranja tp-pill-grande" onClick={() => onIrSala(temporada.slug)}>
                    Ver {temporadaLibros.length === 1 ? 'el libro' : `los ${temporadaLibros.length}`}
                  </button>
                </div>
                <div className="tp-hero-portadas" aria-hidden="true">
                  {temporadaLibros.slice(0, 3).map(l => <CoverCard key={l.id} libro={l} grande />)}
                </div>
              </section>
            )}

            {salasPasillo.length > 0 && (
              <section className="tp-sec" aria-label="Las salas">
                <div className="tp-sec-cab">
                  <div className="tp-sec-txt">
                    <h2>Las salas</h2>
                    <p>Cada sala tiene su estantería y sus historias.</p>
                  </div>
                </div>
                <div className="tp-salas">
                  {salasPasillo.map(s => (
                    <SalaCard key={s.id} sala={s} numLibros={librosDe(s).length} onAbrir={() => onIrSala(s.slug)} />
                  ))}
                </div>
              </section>
            )}

            {carriles.map(c => (
              <Carril key={c.clave} titulo={c.titulo} subtitulo={c.subtitulo} libros={c.libros} tieneLibro={tieneLibro} onAbrir={abrir} />
            ))}

            <section className="tp-todo">
              <img src={`/assets/tienda/gato-${gatoColor}-5.webp`} alt="" />
              <div className="tp-todo-txt">
                <h2>Todo el catálogo · {catalogo.length} libros</h2>
                <p>Busca por título o autor y filtra por categoría.</p>
              </div>
              <button type="button" className="tp-pill tp-pill-naranja tp-pill-grande" onClick={onIrCatalogo}>Ver todo el catálogo</button>
            </section>
          </>
        )}
      </main>

      {fichaLibro && (
        <FichaLibro
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
