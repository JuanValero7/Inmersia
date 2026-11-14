// src/components/mobile/LandingEscritoresMobile.jsx
// ─────────────────────────────────────────────────────────────
// Variante MÓVIL de la landing de escritores. Como la de colegios: reutiliza
// LandingEscritores.jsx pasando `mobile`, así no hay markup duplicado. Los
// ajustes de layout viven en styles/landing-escritores.mobile.css (.le-mobile):
// la imagen arriba, el texto debajo y cada lámina se lee en vertical.
// ─────────────────────────────────────────────────────────────
import LandingEscritores from '../LandingEscritores.jsx'
import '../../styles/landing-escritores.mobile.css'

export default function LandingEscritoresMobile(props) {
  return <LandingEscritores mobile {...props} />
}
