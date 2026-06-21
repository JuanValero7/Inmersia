// src/components/mobile/LandingMobile.jsx
// ─────────────────────────────────────────────────────────────
// Variante MÓVIL de la landing. Sigue el patrón del proyecto
// (un componente por vista en components/mobile/), pero reutiliza
// la misma implementación que Landing.jsx pasando `mobile`, así
// no hay markup duplicado que mantener. Los ajustes de layout
// móvil viven en styles/landing.mobile.css (scopeados en .inm-mobile).
// ─────────────────────────────────────────────────────────────
import Landing from '../Landing.jsx'
import '../../styles/landing.mobile.css'

export default function LandingMobile({ onAuth, onGoTienda }) {
  return <Landing mobile onAuth={onAuth} onGoTienda={onGoTienda} />
}
