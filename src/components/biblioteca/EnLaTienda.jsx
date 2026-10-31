import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { imgUrl } from '../../lib/img.js'
import { evento } from '../../lib/analytics.js'
import '../../styles/en-la-tienda.css'

// =============================================================
// EnLaTienda · libros de la Tienda que coinciden con la búsqueda de la
// Biblioteca y que el usuario aún no tiene (escritorio y móvil).
//
// No se le ponen delante: bajo el buscador solo sale una línea
// "Buscar «…» en la tienda". Al tocarla se despliega una lista hacia abajo
// (como un autocompletado) con los primeros `max`: portada, título y autor.
// Si hay más, el final lleva al catálogo de la Tienda con la búsqueda puesta.
//
// Props:
//   libros  · filas del catálogo que coinciden (buscarEnTienda)
//   texto   · lo que escribió
//   max     · cuántos caben en la lista
//   onAbrir · abre la ficha del libro
// =============================================================

const Flecha = () => (
  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export default function EnLaTienda({ libros, texto, max = 4, onAbrir }) {
  const [abierta, setAbierta] = useState(false)
  const cajaRef = useRef(null)
  const navigate = useNavigate()

  // Abierta, se cierra al tocar fuera o con Escape.
  useEffect(() => {
    if (!abierta) return
    const fuera = (e) => { if (!cajaRef.current?.contains(e.target)) setAbierta(false) }
    const tecla = (e) => { if (e.key === 'Escape') setAbierta(false) }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierta])

  if (!libros.length) return null
  const t = texto.trim()

  const alternar = () => {
    if (!abierta) evento('busqueda_tienda', { accion: 'desplegar' })
    setAbierta(a => !a)
  }
  const abrir = (l) => {
    evento('busqueda_tienda', { accion: 'abrir', libro: l.slug })
    setAbierta(false)
    onAbrir(l)
  }
  const verTodos = () => {
    evento('busqueda_tienda', { accion: 'ver_todos' })
    navigate(`/tienda/catalogo?q=${encodeURIComponent(t)}`)
  }

  return (
    <div className="elt" ref={cajaRef}>
      <button type="button" className={'elt-linea' + (abierta ? ' on' : '')} onClick={alternar} aria-expanded={abierta}>
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" strokeLinecap="round" /></svg>
        <span className="elt-linea-txt">Buscar <b>«{t}»</b> en la tienda</span>
        <span className="elt-n">{libros.length}</span>
        <span className="elt-giro"><Flecha /></span>
      </button>

      {abierta && (
        <div className="elt-menu">
          {libros.slice(0, max).map(l => (
            <button key={l.id} type="button" className="elt-fila" onClick={() => abrir(l)}>
              <span className="elt-portada" style={{ background: l.color || undefined }}>
                {l.portada_url && <img src={imgUrl(l.portada_url, { width: 84 })} alt="" loading="lazy" />}
              </span>
              <span className="elt-txt">
                <span className="elt-titulo">{l.titulo}</span>
                <span className="elt-autor">{l.autor}</span>
              </span>
            </button>
          ))}
          {libros.length > max && (
            <button type="button" className="elt-todos" onClick={verTodos}>
              Ver los {libros.length} en la tienda <Flecha />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
