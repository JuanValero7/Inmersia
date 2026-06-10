// Inmersia — Tour guiado MOBILE (driver.js).
// Espeja el flujo de tutorial.js (mismas fases y mismas transiciones
// onDestroyed → setTourPhase), pero con anclas (#tutorial-m-*) y copy
// adaptadas al chrome mobile (sheets, dock del gato, brújula Explorar).
//
// Las fases solo-popover (notebook_1, tienda_calle, tienda_interior) NO se
// reescriben: se reusan desde tutorial.js, disparadas por sus componentes
// (Notebook y Tienda son compartidos / sin anclas de layout).
//
// Regla clave: driver.js no puede resaltar un elemento NO montado, así que
// los pasos apuntan al botón que abre cada sheet, nunca a su contenido interno.

import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '../styles/tutorial.css'
import { setTourPhase } from './guidedTour.js'

const BASE_OPTS = {
  showProgress:  true,
  progressText:  '{{current}} de {{total}}',
  nextBtnText:   'Siguiente →',
  prevBtnText:   '← Anterior',
  overlayColor:  'rgba(50, 34, 18, 0.72)',
  smoothScroll:  true,
  allowClose:    true,
}

// ── bib_1 · Primera visita a Biblioteca (mobile) ─────────────
export function runGuidedBib1Mobile() {
  driver({
    ...BASE_OPTS,
    doneBtnText: '¡Vamos!',
    onDestroyed: () => setTourPhase('wait_modal'),
    steps: [
      { popover: { title: '¡Bienvenido a Inmersia!', description: 'Te mostramos en pocos pasos cómo funciona todo. Podés cerrar esto cuando quieras con la ✕.' } },
      { element: '#tutorial-m-coleccion', popover: { title: 'Tu colección', description: 'Acá están todos tus libros. A medida que agregues más vas a poder organizarlos por categorías.', side: 'top', align: 'center' } },
      { element: '#tutorial-m-gestionar', popover: { title: 'Gestionar categorías', description: 'Creá y editá tus propias categorías para ordenar la biblioteca como quieras.', side: 'bottom', align: 'end' } },
      { element: '#tutorial-m-filtrar', popover: { title: 'Filtrar', description: 'Después filtrá los libros por categoría para ver solo lo que querés.', side: 'bottom', align: 'start' } },
      { element: '#tutorial-m-manual', popover: { title: '¡Empezá tu aventura!', description: 'Tocá el <strong>Manual del Explorador</strong> para abrir su ficha y empezar a leer.', side: 'bottom', align: 'center' } },
    ],
  }).drive()
}

// ── wait_modal · BibBookSheet (mobile) ───────────────────────
export function runGuidedModalMobile() {
  driver({
    ...BASE_OPTS,
    doneBtnText: '¡Abrir!',
    onDestroyed: () => setTourPhase('wait_lector'),
    steps: [
      { element: '#tutorial-m-abrir-libro', popover: { title: 'Abrí el libro', description: 'Tocá <strong>Abrir libro</strong> para comenzar la lectura inmersiva.', side: 'top', align: 'center' } },
    ],
  }).drive()
}

// ── lector_1 · Lector principal (mobile) ─────────────────────
export function runGuidedLector1Mobile() {
  driver({
    ...BASE_OPTS,
    doneBtnText: '¡Entendido!',
    onDestroyed: () => setTourPhase('wait_chapter'),
    steps: [
      { popover: { title: 'Bienvenido al Lector', description: 'Acá vivís la lectura inmersiva. Cada capítulo tiene su propio ambiente visual y sonoro.' } },
      { element: '#tutorial-m-cap', popover: { title: 'Capítulos', description: 'Tocá acá para saltar a cualquier capítulo del libro.', side: 'bottom', align: 'start' } },
      { element: '#tutorial-m-typo', popover: { title: 'Tamaño, fuente y tema', description: 'Personalizá tu lectura: tamaño del texto, tipografía y el nuevo <strong>modo noche</strong>.', side: 'bottom', align: 'end' } },
      { element: '#tutorial-m-dock', popover: { title: 'El gato: tus herramientas', description: 'Tocá la mascota para abrir <strong>Audio</strong> (ambiente del capítulo), <strong>Imagen</strong> y <strong>Cuaderno</strong>.', side: 'top', align: 'start' } },
      { popover: { title: 'Tu próxima parada', description: 'Avanzá leyendo (tocando los laterales de la hoja) hasta el final del capítulo. Al terminar, el <strong>Cuaderno</strong> se abre solo y seguimos el tour.' } },
    ],
  }).drive()
}

// ── lector_2 · Post-cuaderno (mobile) ────────────────────────
export function runGuidedLector2Mobile() {
  driver({
    ...BASE_OPTS,
    doneBtnText: '¡Vamos a Investigación!',
    onDestroyed: () => setTourPhase('wait_cartelera'),
    steps: [
      { popover: { title: 'Explorá el universo del libro', description: 'Además de leer, Inmersia tiene la <strong>Cartelera de Investigación</strong> y el <strong>Foro</strong>.' } },
      { element: '#tutorial-m-explorar', popover: { title: 'El botón Explorar', description: 'Desde la brújula navegás a <strong>Investigación</strong>, <strong>Foro</strong> y <strong>Biblioteca</strong>.', side: 'bottom', align: 'end' } },
      { popover: { title: 'Primero: Investigación', description: 'Tocá la brújula y elegí <strong>Investigación</strong> para descubrir la Cartelera.' } },
    ],
  }).drive()
}

// ── cart_portada_1 · Cartelera Portada 1ra visita (mobile) ───
export function runGuidedCartPortada1Mobile() {
  driver({
    ...BASE_OPTS,
    doneBtnText: '¡Vamos!',
    onDestroyed: () => setTourPhase('wait_personajes'),
    steps: [
      { popover: { title: 'La Cartelera de Investigación', description: 'Tu tablero del libro. Cada sección revela información a medida que leés.' } },
      { element: '#tutorial-m-paneles', popover: { title: 'Los 5 paneles', description: 'Personajes, Lugares, Hechos, Datos y Notas. Tocá un panel para entrar.', side: 'top', align: 'center' } },
      { popover: { title: 'Empezá por Personajes', description: 'Tocá el panel <strong>Personajes</strong> para explorar la primera sección.' } },
    ],
  }).drive()
}

// ── cart_personajes · Tablero Personajes (mobile) ────────────
export function runGuidedCartPersonajesMobile() {
  driver({
    ...BASE_OPTS,
    doneBtnText: '¡Entendido!',
    onDestroyed: () => setTourPhase('wait_notas'),
    steps: [
      { popover: { title: 'El tablero de Personajes', description: 'Las primeras 4 secciones revelan una imagen a medida que avanzás en la lectura.' } },
      { element: '#tutorial-m-lista', popover: { title: 'Mural y Lista', description: 'Cambiá a <strong>Lista</strong> para ver todos los personajes que ya aparecieron, con su descripción.', side: 'bottom', align: 'center' } },
      { element: '#tutorial-m-catdock', popover: { title: 'Saltar de sección', description: 'Tocá el gato y elegí <strong>Notas</strong> para ir a la siguiente sección.', side: 'top', align: 'start' } },
    ],
  }).drive()
}

// ── cart_notas · Tablero Notas (mobile) ──────────────────────
export function runGuidedCartNotasMobile() {
  driver({
    ...BASE_OPTS,
    doneBtnText: '¡Entendido!',
    onDestroyed: () => setTourPhase('wait_portada_2'),
    steps: [
      { popover: { title: 'Tu centro de operaciones', description: 'El corcho de Notas reúne tus predicciones y anotaciones a medida que avanzás.' } },
      { popover: { title: 'Tus predicciones', description: 'Lo que escribís en el Cuaderno aparece acá. Al terminar el libro vas a ver si acertaste.' } },
      { popover: { title: 'Volvé a la Portada', description: 'Usá la <strong>flecha de atrás</strong> (arriba a la izquierda) para volver a la Portada de la Cartelera.' } },
    ],
  }).drive()
}

// ── cart_portada_2 · Cartelera Portada 2da visita (mobile) ───
export function runGuidedCartPortada2Mobile() {
  driver({
    ...BASE_OPTS,
    doneBtnText: '¡Vamos al Foro!',
    onDestroyed: () => setTourPhase('wait_foro'),
    steps: [
      { popover: { title: '¡Bien hecho!', description: 'Ya conocés la Cartelera. Ahora conectá con otros lectores en el <strong>Foro</strong>.' } },
      { popover: { title: 'Ir al Foro', description: 'Tocá la brújula <strong>Explorar</strong> y elegí <strong>Foro</strong>.' } },
    ],
  }).drive()
}

// ── foro_1 · Foro (mobile) ───────────────────────────────────
export function runGuidedForo1Mobile() {
  driver({
    ...BASE_OPTS,
    doneBtnText: '¡Entendido!',
    onDestroyed: () => setTourPhase('wait_bib_2'),
    steps: [
      { popover: { title: 'El Foro del libro', description: 'El espacio de comunidad: compartí teorías y discutí la trama con otros lectores.' } },
      { element: '#tutorial-foro-tabs', popover: { title: 'Dos espacios', description: '<strong>Comentarios</strong>: reflexiones que perduran. <strong>Chat</strong>: charla en tiempo real.', side: 'bottom', align: 'center' } },
      { popover: { title: '¡Cuidá los spoilers!', description: 'Otros pueden ir por capítulos distintos. Usá etiquetas de capítulo al compartir algo de la trama.' } },
      { popover: { title: 'Volvé a la Biblioteca', description: 'Tocá la brújula <strong>Explorar</strong> y elegí <strong>Biblioteca</strong> para continuar.' } },
    ],
  }).drive()
}

// ── bib_2 · Segunda visita a Biblioteca (mobile) ─────────────
export function runGuidedBib2Mobile() {
  driver({
    ...BASE_OPTS,
    doneBtnText: '¡A la Tienda!',
    onDestroyed: () => setTourPhase('wait_tienda'),
    steps: [
      { popover: { title: '¡Excelente!', description: 'Ya conocés las herramientas principales. Ahora veamos la <strong>Tienda</strong> para sumar más libros.' } },
      { element: '#tutorial-m-tienda', popover: { title: 'La Tienda de los Guardianes', description: 'Tocá <strong>Tienda</strong> (arriba) para explorar el catálogo.', side: 'bottom', align: 'end' } },
    ],
  }).drive()
}
