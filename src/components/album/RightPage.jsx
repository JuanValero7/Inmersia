import Seccion from './Seccion.jsx'

// Página derecha: Personajes y Capítulos.
export default function RightPage({ entry }) {
  const { secciones } = entry
  return (
    <div className="album-page album-page-right">
      <Seccion label="Personajes" color="var(--rojo)" data={secciones.personajes} />
      <Seccion label="Capítulos" color="var(--azul)" data={secciones.capitulos} tight />
    </div>
  )
}
