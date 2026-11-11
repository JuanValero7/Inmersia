// src/components/mobile/LandingColegiosMobile.jsx
// ─────────────────────────────────────────────────────────────
// Variante MÓVIL de la landing para colegios. Sigue el patrón del proyecto
// (un componente por vista en components/mobile/), pero reutiliza la misma
// implementación que LandingColegios.jsx pasando `mobile`, así no hay markup
// duplicado que mantener. Los ajustes de layout móvil viven en
// styles/landing-colegios.mobile.css (scopeados en .lc-mobile).
// ─────────────────────────────────────────────────────────────
import LandingColegios from '../LandingColegios.jsx'
import '../../styles/landing-colegios.mobile.css'

export default function LandingColegiosMobile(props) {
  return <LandingColegios mobile {...props} />
}
