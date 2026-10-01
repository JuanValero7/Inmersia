// Pista de primera vez: el cartel chico que presenta una función la primera
// vez que el usuario se la encuentra. Es un <TutorialCartel> con ×: no bloquea
// nada y, al cerrarlo, la pista queda marcada como vista (ver context/pistas.jsx).
// Si trae `accion`, usarla también la marca.
//
// Los textos viven en onboarding/textos.js (PISTAS), con variante móvil cuando
// la instrucción cambia ("toca al gato" vs. "usa las lengüetas").
import TutorialCartel from './TutorialCartel.jsx'
import { usePistas } from '../../context/pistas.jsx'
import { PISTAS } from './textos.js'

export default function Pista({ id, movil = false, accion = null, inline = false, bottom }) {
  const { marcar } = usePistas()
  const texto = PISTAS[id]
  if (!texto) return null
  const cuerpo = (movil && texto.bodyMovil) || texto.body
  return (
    <TutorialCartel
      emoji={texto.emoji}
      title={texto.title}
      body={cuerpo}
      inline={inline}
      bottom={bottom}
      onClose={() => marcar(id)}
      accion={accion && { label: accion.label, onClick: () => { marcar(id); accion.onClick() } }}
    />
  )
}
