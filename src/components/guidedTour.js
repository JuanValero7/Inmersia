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
  window.dispatchEvent(new CustomEvent('inm-tour-change'))
}

export function resetTour() {
  localStorage.removeItem(DONE_KEY)
  localStorage.removeItem(PHASE_KEY)
  window.dispatchEvent(new CustomEvent('inm-tour-change'))
}

const PHASE_INFO = {
  'bib_1':          { label: 'Biblioteca',              hint: 'Seguí los pasos del tour de bienvenida.' },
  'wait_modal':     { label: 'Biblioteca',              hint: 'Abrí el Manual del Explorador y presioná <strong>Empezar a leer</strong>. Cuando aparezca el modal, presioná <strong>Abrir libro</strong>.' },
  'wait_lector':    { label: 'Biblioteca',              hint: 'Presioná <strong>Abrir libro</strong> en el modal del Manual del Explorador.' },
  'lector_1':       { label: 'Lector',                  hint: 'Seguí los pasos del tour del Lector.' },
  'wait_chapter':   { label: 'Lector',                  hint: 'Avanzá leyendo hasta llegar al final del capítulo actual. El Cuaderno se abrirá automáticamente.' },
  'notebook_1':     { label: 'Cuaderno',                hint: 'Terminá el capítulo para que el Cuaderno se abra, o abrilo desde el botón <strong>Cuaderno</strong> (abajo a la derecha).' },
  'lector_2':       { label: 'Lector',                  hint: 'Cerrá el Cuaderno para continuar el tour.' },
  'wait_cartelera': { label: 'Lector',                  hint: 'Presioná <strong>Explorar</strong> (arriba a la derecha) y elegí <strong>Investigación</strong>.' },
  'cart_portada_1': { label: 'Cartelera',               hint: 'Seguí los pasos del tour de la Cartelera.' },
  'wait_personajes':{ label: 'Cartelera',               hint: 'Hacé click en el panel <strong>Personajes</strong>.' },
  'cart_personajes':{ label: 'Cartelera — Personajes',  hint: 'Seguí los pasos del tour de Personajes.' },
  'wait_notas':     { label: 'Cartelera — Personajes',  hint: 'Usá el letrero de la esquina inferior izquierda para ir a <strong>Notas</strong>.' },
  'cart_notas':     { label: 'Cartelera — Notas',       hint: 'Seguí los pasos del tour de Notas.' },
  'wait_portada_2': { label: 'Cartelera — Notas',       hint: 'Presioná <strong>← Investigación</strong> (arriba) para volver a la Portada.' },
  'cart_portada_2': { label: 'Cartelera',               hint: 'Seguí los pasos del tour.' },
  'wait_foro':      { label: 'Cartelera',               hint: 'Presioná <strong>Explorar</strong> y elegí <strong>Foro</strong>.' },
  'foro_1':         { label: 'Foro',                    hint: 'Seguí los pasos del tour del Foro.' },
  'wait_bib_2':     { label: 'Foro',                    hint: 'Presioná <strong>Explorar</strong> (arriba a la derecha) y elegí <strong>Biblioteca</strong>.' },
  'bib_2':          { label: 'Biblioteca',              hint: 'Seguí los pasos del tour.' },
  'wait_tienda':    { label: 'Biblioteca',              hint: 'Presioná el botón <strong>Tienda</strong> en el header.' },
  'tienda_calle':   { label: 'Tienda',                  hint: 'Seguí los pasos del tour de la Tienda.' },
  'tienda_interior':{ label: 'Tienda — Catálogo',       hint: 'Explorá el catálogo y elegí un libro para agregar a tu biblioteca.' },
}

export const getPhaseInfo = (phase) => PHASE_INFO[phase] || null
