import Seccion from './Seccion.jsx'

// Página derecha: Personajes y Capítulos (ficción) · Infografías (no ficción).
export default function RightPage({ entry, onPegar }) {
  const { libro, secciones } = entry

  if (libro.es_ficcion === false) {
    return (
      <div className="album-page album-page-right">
        <Seccion label="Infografías" seccion="infografias" color="var(--oro)" data={secciones.infografias} onPegar={onPegar} />
      </div>
    )
  }

  return (
    <div className="album-page album-page-right">
      <Seccion label="Personajes" seccion="personajes" color="var(--rojo)" data={secciones.personajes} onPegar={onPegar} />
      <Seccion label="Capítulos" seccion="capitulos" color="var(--azul)" data={secciones.capitulos} tight onPegar={onPegar} />
    </div>
  )
}
