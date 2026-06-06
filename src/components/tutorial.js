// Inmersia — Product tours con driver.js
// Para resetear y ver de nuevo: borrar las claves en
// DevTools > Application > Local Storage, o llamar resetTutorials().

import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '../styles/tutorial.css'
import { setTourPhase, resetTour } from './guidedTour.js'

const BASE_OPTS = {
  showProgress:  true,
  progressText:  '{{current}} de {{total}}',
  nextBtnText:   'Siguiente →',
  prevBtnText:   '← Anterior',
  overlayColor:  'rgba(50, 34, 18, 0.72)',
  smoothScroll:  true,
  allowClose:    true,
}

// ── Reset (para botón "Ver tutorial de nuevo" en Perfil) ──────
export function resetTutorials() {
  resetTour()
}

// =============================================================
// TOUR GUIADO — funciones por fase
// =============================================================

// ── Fase bib_1 · Primera visita a Biblioteca ─────────────────
export function runGuidedBib1() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Vamos!',
    onDestroyed: () => setTourPhase('wait_modal'),
    steps: [
      {
        popover: {
          title: '¡Bienvenido a Inmersia!',
          description: 'Te mostraremos en pocos pasos cómo funciona todo. Puedes cerrar esto en cualquier momento con la ✕.',
        },
      },
      {
        element: '#tutorial-swimlane',
        popover: {
          title: 'Tu punto de partida',
          description: 'Tu aventura está comenzando. Por ahora tienes el <strong>Manual del Explorador</strong>, tu guía de bienvenida a Inmersia.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tutorial-coleccion',
        popover: {
          title: 'Tu colección',
          description: 'Acá están todos tus libros. A medida que agregues más podrás organizarlos y encontrarlos rápido.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '#tutorial-gestionar-btn',
        popover: {
          title: 'Gestionar categorías',
          description: 'Primero crea y edita tus propias categorías para organizar tu biblioteca como quieras.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tutorial-filtrar-btn',
        popover: {
          title: 'Filtrar',
          description: 'Luego filtra los libros por categoría para ver solo lo que quieres en cada momento.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tutorial-swimlane',
        popover: {
          title: '¡Empezieza tu aventura!',
          description: 'Haz click en el <strong>Manual del Explorador</strong> (o en el botón <em>Empezar a leer</em>) para ver las opciones y abrir el libro.',
          side: 'bottom',
          align: 'start',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase wait_modal · BibBookModal ───────────────────────────
export function runGuidedModal() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Abrir!',
    onDestroyed: () => setTourPhase('wait_lector'),
    steps: [
      {
        element: '#tutorial-abrir-libro-btn',
        popover: {
          title: 'Abre el libro',
          description: 'Presiona <strong>Abrir libro</strong> para comenzar tu experiencia de lectura inmersiva.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase lector_1 · Lector principal ────────────────────────
export function runGuidedLector1() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Entendido!',
    onDestroyed: () => setTourPhase('wait_chapter'),
    steps: [
      {
        popover: {
          title: 'Bienvenido al Lector',
          description: 'Aquí vives la experiencia de lectura inmersiva. Cada capítulo tiene su propio ambiente visual y sonoro.',
        },
      },
      {
        element: '#tutorial-recorder',
        popover: {
          title: 'Reproductor de ambiente',
          description: 'Cada capítulo tiene su propio sonido ambiental que acompaña la lectura. Ajusta el volumen o pausa el audio a tu gusto.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '#tutorial-typography-btn',
        popover: {
          title: 'Tamaño y fuente',
          description: 'Personaliza tu lectura: cambia el tamaño del texto y elige entre cuatro estilos tipográficos.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tutorial-chapter-btn',
        popover: {
          title: 'Navegación por capítulos',
          description: 'Desde acá puedes saltar directamente a cualquier capítulo del libro.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        popover: {
          title: 'Tu próxima parada',
          description: 'Avanza leyendo hasta llegar al final del capítulo actual. Cuando termines, el <strong>Cuaderno</strong> se abrirá automáticamente y continuaremos el tour desde ahí.',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase notebook_1 · Cuaderno ──────────────────────────────
export function runGuidedNotebook1() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Entendido!',
    onDestroyed: () => setTourPhase('lector_2'),
    steps: [
      {
        popover: {
          title: 'Tu Cuaderno de lectura',
          description: 'Se abre automáticamente al terminar cada capítulo. Acá puedes escribir predicciones sobre lo que va a pasar y anotaciones sobre lo que leíste.',
        },
      },
      {
        popover: {
          title: 'Tres tipos de notas',
          description: '<strong>Predicciones:</strong> tus hipótesis sobre la trama. <strong>Anotaciones:</strong> reflexiones y análisis. <strong>Subrayados:</strong> las frases que marcaste durante la lectura.',
        },
      },
      {
        popover: {
          title: 'Acceso directo',
          description: 'También puedes abrir el Cuaderno en cualquier momento desde el botón <strong>Cuaderno</strong> en la esquina inferior derecha del Lector.',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase lector_2 · Post-cuaderno (Explorar) ────────────────
export function runGuidedLector2() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Vamos a Investigación!',
    onDestroyed: () => setTourPhase('wait_cartelera'),
    steps: [
      {
        popover: {
          title: 'Explora el universo del libro',
          description: 'Además de leer, Inmersia tiene otras dos herramientas poderosas: la <strong>Cartelera de Investigación</strong> y el <strong>Foro</strong>.',
        },
      },
      {
        element: '#tutorial-explorar-header',
        popover: {
          title: 'El botón Explorar',
          description: 'Desde acá (arriba a la derecha) puedes navegar a <strong>Investigación</strong> (la Cartelera del libro) y al <strong>Foro</strong> de la comunidad.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        popover: {
          title: 'Primero: Investigación',
          description: 'Presiona <strong>Explorar</strong> y luego <strong>Investigación</strong> para descubrir la Cartelera del libro.',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase cart_portada_1 · Cartelera Portada (1ra visita) ────
export function runGuidedCartPortada1() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Vamos!',
    onDestroyed: () => setTourPhase('wait_personajes'),
    steps: [
      {
        popover: {
          title: 'La Cartelera de Investigación',
          description: 'Este es tu tablero de investigación del libro. Cada sección agrupa un tipo de información que se va revelando a medida que leés.',
        },
      },
      {
        element: '#tutorial-portada-paneles',
        popover: {
          title: 'Los 5 paneles',
          description: 'Personajes, Lugares, Hechos, Datos y Notas. Pasá el cursor sobre cada panel para previsualizarlo. Haz click para entrar.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        popover: {
          title: 'Empieza por Personajes',
          description: 'Haz click en el panel <strong>Personajes</strong> para explorar la primera sección.',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase cart_personajes · Tablero Personajes ────────────────
export function runGuidedCartPersonajes() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Entendido!',
    onDestroyed: () => setTourPhase('wait_notas'),
    steps: [
      {
        popover: {
          title: 'El tablero de Personajes',
          description: 'Las primeras <strong>4 secciones</strong> (Personajes, Lugares, Hechos y Datos) van revelando una imagen especial a medida que avanzás en la lectura.',
        },
      },
      {
        element: '#tutorial-lista-btn',
        popover: {
          title: 'Ver el detalle',
          description: 'Presiona <strong>Lista</strong> para ver todos los personajes que ya aparecieron en tu lectura, con sus descripciones completas.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        popover: {
          title: 'Ahora: Notas',
          description: 'Usa el <strong>letrero de la esquina inferior izquierda</strong> para navegar a la sección <strong>Notas</strong>.',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase cart_notas · Tablero Notas ─────────────────────────
export function runGuidedCartNotas() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Entendido!',
    onDestroyed: () => setTourPhase('wait_portada_2'),
    steps: [
      {
        popover: {
          title: 'Tu centro de operaciones',
          description: 'El tablero de Notas es el corazón de tu investigación. Tu corcho se llena con predicciones, anotaciones y pistas a medida que avanzás.',
        },
      },
      {
        popover: {
          title: 'Tus predicciones',
          description: 'Las predicciones que escribas en el Cuaderno aparecen aquí. Al terminar el libro podrás ver si tus hipótesis fueron acertadas.',
        },
      },
      {
        popover: {
          title: 'Volvé a la Portada',
          description: 'Usa el botón <strong>← Investigación</strong> de arriba para volver a la Portada de la Cartelera.',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase cart_portada_2 · Cartelera Portada (2da visita) ────
export function runGuidedCartPortada2() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Vamos al Foro!',
    onDestroyed: () => setTourPhase('wait_foro'),
    steps: [
      {
        popover: {
          title: '¡Bien hecho!',
          description: 'Ya conoces la Cartelera. Ahora es momento de conectarte con otros lectores en el <strong>Foro</strong> del libro.',
        },
      },
      {
        popover: {
          title: 'Ir al Foro',
          description: 'Presiona el botón <strong>Explorar</strong> (arriba a la derecha) y elige <strong>Foro</strong>.',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase foro_1 · Foro ──────────────────────────────────────
export function runGuidedForo1() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Entendido!',
    onDestroyed: () => setTourPhase('wait_bib_2'),
    steps: [
      {
        popover: {
          title: 'El Foro del libro',
          description: 'Este es el espacio de comunidad. Conectate con otros lectores, comparte teorías y discute la trama.',
        },
      },
      {
        element: '#tutorial-foro-tabs',
        popover: {
          title: 'Dos espacios',
          description: '<strong>Comentarios</strong>: reflexiones escritas que perduran en el tiempo. <strong>Chat</strong>: conversaciones en tiempo real con lectores activos.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        popover: {
          title: '¡Cuida los spoilers!',
          description: 'Otros lectores pueden estar en capítulos distintos al tuyo. Usa etiquetas de capítulo cuando compartas algo importante de la trama.',
        },
      },
      {
        popover: {
          title: 'Vuelve a la Biblioteca',
          description: 'Presiona <strong>Explorar</strong> (arriba a la derecha) y elige <strong>Biblioteca</strong> para continuar.',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase bib_2 · Segunda visita a Biblioteca ────────────────
export function runGuidedBib2() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡A la Tienda!',
    onDestroyed: () => setTourPhase('wait_tienda'),
    steps: [
      {
        popover: {
          title: '¡Excelente!',
          description: 'Ya conoces las herramientas principales de Inmersia. Ahora exploremos la <strong>Tienda</strong> para agregar más libros.',
        },
      },
      {
        element: '#tutorial-tienda-btn',
        popover: {
          title: 'La Tienda de los Guardianes',
          description: 'Aquí encontrarás todos los títulos disponibles. Presiona el botón <strong>Tienda</strong> para explorar el catálogo.',
          side: 'bottom',
          align: 'end',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase tienda_calle · Fachada de la Tienda ────────────────
export function runGuidedTiendaCalle() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Entrar!',
    onDestroyed: () => setTourPhase('tienda_interior'),
    steps: [
      {
        popover: {
          title: 'La Tienda de los Guardianes',
          description: 'Aquí encontrarás todos los títulos disponibles para agregar a tu biblioteca personal.',
        },
      },
      {
        popover: {
          title: 'El límite de lecturas pendientes',
          description: 'Puedes tener hasta <strong>5 libros pendientes de leer</strong> a la vez. Si ya tienes 5, deberás terminar alguno antes de poder volver a agregar.',
        },
      },
      {
        popover: {
          title: 'Entrá al catálogo',
          description: 'Presiona <strong>Entrar</strong> para explorar todos los títulos disponibles.',
        },
      },
    ],
  })
  d.drive()
}

// ── Fase tienda_interior · Catálogo interior ────────────────
export function runGuidedTiendaInterior() {
  const d = driver({
    ...BASE_OPTS,
    doneBtnText: '¡Explorar!',
    onDestroyed: () => setTourPhase('done'),
    steps: [
      {
        popover: {
          title: 'El catálogo completo',
          description: 'Todos los títulos disponibles. Los libros que ya tienes en tu biblioteca aparecen marcados.',
        },
      },
      {
        popover: {
          title: 'Explorá los libros',
          description: 'Haz click en cualquier portada para ver sus datos: título, autor, descripción, año de publicación, categorías y estado de ánimo (mood).',
        },
      },
      {
        popover: {
          title: 'El Preview',
          description: 'Cada libro tiene un botón <strong>Preview</strong> que te muestra los primeros párrafos para que puedas decidir si te interesa antes de agregarlo.',
        },
      },
      {
        popover: {
          title: '¡Elegí tu próxima aventura!',
          description: 'Selecciona un libro que te llame la atención y presioná <strong>Agregar</strong> para sumarlo a tu colección. ¡Tu próxima aventura de lectura comienza ahora!',
        },
      },
    ],
  })
  d.drive()
}
