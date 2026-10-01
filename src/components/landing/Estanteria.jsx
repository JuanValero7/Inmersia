// src/components/landing/Estanteria.jsx
// ─────────────────────────────────────────────────────────────
// Cinta de portadas de la landing: LIBROS_ESTANTE libros al azar que pasan sin
// parar (la lista va duplicada y la animación se mueve medio ancho, así el
// bucle no tiene costura).
//
// Usa la misma consulta que la Tienda: al pulsar "Entra ahora" el catálogo ya
// está en la caché de React Query y abre sin esperar.
//
// El orden se baraja UNA vez por carga de página y se guarda en memoria del
// módulo, no en el navegador: volver a la landing dentro de la misma visita
// enseña los mismos libros, y no se escribe nada en el dispositivo (la
// analítica de Inmersia va sin almacenamiento a propósito, ver lib/analytics.js).
// ─────────────────────────────────────────────────────────────
import { useMemo } from 'react'
import { useCatalogoLibrosQuery } from '../../lib/queries.js'
import { imgUrl } from '../../lib/img.js'
import { LIBROS_ESTANTE } from './landingData.js'

let ordenDeEstaVisita = null // ids barajados

function elegirLibros(libros) {
  const conPortada = libros.filter((l) => l.portada_url)
  // Mientras el catálogo no ha llegado no se baraja nada: si se guardara el
  // orden de una lista vacía, la estantería se quedaría vacía toda la visita.
  if (!conPortada.length) return []
  if (!ordenDeEstaVisita) {
    const ids = conPortada.map((l) => l.id)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    ordenDeEstaVisita = ids
  }
  const porId = new Map(conPortada.map((l) => [l.id, l]))
  return ordenDeEstaVisita.map((id) => porId.get(id)).filter(Boolean).slice(0, LIBROS_ESTANTE)
}

/**
 * @param onElegir(libro)  al tocar una portada (abre su ficha en la Tienda)
 * @param onMirar(libro)   al pasar el ratón o enfocar una portada (el gato la comenta)
 */
export default function Estanteria({ onElegir, onMirar }) {
  const { data: catalogo = [] } = useCatalogoLibrosQuery()
  const libros = useMemo(() => elegirLibros(catalogo), [catalogo])

  if (!libros.length) return <div className="inm-marquee inm-marquee-vacia" aria-hidden="true" />

  const tarjeta = (l, copia) => (
    <button
      key={`${copia ? 'b' : 'a'}-${l.id}`}
      type="button"
      className="inm-bk"
      onClick={() => onElegir?.(l)}
      onMouseEnter={() => onMirar?.(l)}
      onFocus={() => onMirar?.(l)}
      // La segunda vuelta solo existe para que el bucle no se corte.
      tabIndex={copia ? -1 : undefined}
      aria-hidden={copia ? 'true' : undefined}
    >
      <span className="inm-bk-cv">
        <img src={imgUrl(l.portada_url, { width: 264 })} alt="" loading="lazy" decoding="async" />
      </span>
      <b>{l.titulo}</b>
      <small>{l.autor}</small>
    </button>
  )

  return (
    <div className="inm-marquee">
      <div className="inm-track">
        {libros.map((l) => tarjeta(l, false))}
        {libros.map((l) => tarjeta(l, true))}
      </div>
    </div>
  )
}
