// Inmersia — Tour guiado global.
// Persiste la fase actual en localStorage. Todos los componentes leen de aquí.
//
// Fases (en orden):
//   bib_1          → primera visita a Biblioteca
//   wait_modal     → esperando que BibBookModal aparezca
//   wait_lector    → esperando que Lector monte
//   lector_1       → tour principal del Lector
//   wait_chapter   → usuario debe avanzar al próximo capítulo
//   notebook_1     → tour del Cuaderno
//   lector_2       → tour post-cuaderno (Explorar)
//   wait_cartelera → usuario debe ir a Investigación
//   cart_portada_1 → primera visita a Portada de Cartelera
//   wait_personajes→ usuario debe clickear Personajes
//   cart_personajes→ tour del tablero Personajes
//   wait_notas     → usuario debe ir a Notas
//   cart_notas     → tour del tablero Notas
//   wait_portada_2 → usuario debe volver a Portada
//   cart_portada_2 → segunda visita a Portada (→ Foro)
//   wait_foro      → usuario debe ir al Foro
//   foro_1         → tour del Foro
//   wait_bib_2     → usuario debe volver a Biblioteca
//   bib_2          → segunda visita a Biblioteca (→ Tienda)
//   wait_tienda    → usuario debe clickear Tienda
//   tienda_calle   → tour de la fachada de la Tienda
//   tienda_interior→ tour del catálogo interior
//   done           → tour completado (solo marca, no se guarda como fase)

const PHASE_KEY = 'inm_tour_phase'
const DONE_KEY  = 'inm_tour_done'

export const getTourPhase = () => localStorage.getItem(PHASE_KEY)
export const isTourDone   = () => !!localStorage.getItem(DONE_KEY)
export const shouldStart  = () => !getTourPhase() && !isTourDone()

export function setTourPhase(p) {
  if (p === 'done') {
    localStorage.setItem(DONE_KEY, '1')
    localStorage.removeItem(PHASE_KEY)
  } else {
    localStorage.setItem(PHASE_KEY, p)
  }
}

export function resetTour() {
  localStorage.removeItem(DONE_KEY)
  localStorage.removeItem(PHASE_KEY)
}
