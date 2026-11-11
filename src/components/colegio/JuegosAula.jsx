// Tarjeta «Juegos del aula», arriba de la pestaña «Comprensión» del Salón
// (migración 102). El profe enciende y apaga los juegos de su aula. En el
// aula todo viene encendido; en el libro del aula los alumnos ven lo que
// diga el profe, en los demás libros lo de su Perfil. Solo salen los juegos
// del tipo del libro (ficción o no ficción) que tienen contenido cargado.
// Mismos interruptores que el Perfil (JuegosLectura en Perfil.jsx).
import { useCambiarJuegoAula } from '../../hooks/useColegio.js'
import { JUEGOS } from '../../hooks/useJuegos.js'

/**
 * @param {{ aulaId: string, datos: { es_ficcion: boolean, disponibles: string[], juegos: Record<string, boolean> } | undefined }} props
 */
export default function JuegosAula({ aulaId, datos }) {
  const cambiar = useCambiarJuegoAula(aulaId)
  if (!datos) return null
  const lista = JUEGOS.filter(j => j.noficcion === !datos.es_ficcion && datos.disponibles.includes(j.id))
  if (!lista.length) return null
  return (
    <section className="col-tarjeta">
      <h3>Juegos del aula</h3>
      <p className="col-sub">
        {datos.es_ficcion ? 'Libro de ficción' : 'Libro de no ficción'}. Tus alumnos ven en este libro los juegos que dejes encendidos.
      </p>
      <div className="col-juegos">
        {lista.map(j => {
          const encendido = datos.juegos[j.id] !== false
          return (
            <div key={j.id} className="col-juego">
              <div className="col-juego-txt"><b>{j.nombre}</b><span>{j.texto}</span></div>
              <button type="button" role="switch" aria-checked={encendido} aria-label={j.nombre}
                className={'col-switch' + (encendido ? ' is-on' : '')}
                onClick={() => cambiar.mutate({ juego: j.id, encendido: !encendido })}><span /></button>
            </div>
          )
        })}
      </div>
      {cambiar.isError && <p className="col-juegos-err">No se pudo guardar. Prueba otra vez.</p>}
    </section>
  )
}
