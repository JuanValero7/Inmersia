// src/components/landing/landingData.js
// ─────────────────────────────────────────────────────────────
// Contenido de la landing (compartido por Landing.jsx y LandingMobile.jsx).
// Las capturas y los gatos reducidos viven en public/assets/landing/.
//
// Maqueta de referencia (aprobada el 2026-10-01):
// Documentation/landing/maqueta-gatos/index.html
// ─────────────────────────────────────────────────────────────

// Mundos que rotan dentro del portal
export const WORLDS_IMG = [
  { src: '/assets/landing/mundo-mar.webp', cls: '' },
  { src: '/assets/landing/mundo-desierto.webp', cls: '' },
  { src: '/assets/landing/mundo-paris.webp', cls: 'paris' },
  { src: '/assets/landing/mundo-jardin.webp', cls: '' },
  { src: '/assets/landing/mundo-bosque.webp', cls: '' },
]

// ── Gatos ──
// Los tres gatos de Inmersia, con el color que usa preferencias_usuario.gato_color.
export const GATOS = {
  naranja: 'Yuri',
  blanco: 'Mancha',
  negro: 'Katana',
}
export const COLORES_GATO = ['naranja', 'blanco', 'negro']

// Copias reducidas (560 px) de los 7 poses: los originales llegan a 1400 px y
// aquí algunos se pintan a 44 px. Poses: 1 salta · 2 asomado a un libro ·
// 3 panza arriba · 4 se estira · 5 duerme junto a libros · 6 tumbado mirando ·
// 7 enroscado mirando.
export const gatoSrc = (color, pose) => `/assets/landing/gatos/${color}-${pose}.webp`

// En móvil no hay selector: cada gato de la página sale de un color distinto.
export const COLOR_MOVIL = {
  hero: 'naranja',
  estante: 'blanco',
  lector: 'negro',
  investigacion: 'naranja',
  album: 'blanco',
  faq: 'negro',
  cierre: 'naranja',
}

// Lo que dice cada gato al tocarlo (el primero es el que se ve al cargar).
export const FRASES = {
  hero: (nombre) => ['¡Vamos adentro!', `Soy ${nombre}. Te acompaño mientras lees.`, 'Cada libro es un mundo. Literal.'],
  estante: () => ['¿Cuál abrimos hoy?', 'Yo voto por uno de piratas.', 'No paran de llegar libros.'],
  lector: () => ['Toca el botón y escucha el mar.', 'Las ilustraciones salen solas, en el momento justo.', 'Shh… estoy leyendo.'],
  investigacion: () => ['¿Lo resuelves?', 'Cada capítulo, una pista nueva.', 'Sin spoilers, prometido.'],
  album: () => ['Esa barajita es mía.', 'Me faltan dos para llenar la página.', '¿Me la cambias?'],
  cierre: () => ['Zzz…', 'Cinco minutitos más…', 'Zzz… capítulo 1… zzz…'],
}

// Comentarios del gato de la estantería al pasar por un libro.
export const COMENTARIOS_LIBRO = ['buena elección.', 'ese me lo leí dos veces.', 'ese tiene un final…', 'perfecto para hoy.']

// ── Estantería ──
// Cuántos libros pasan por la cinta. Pocos a propósito: cargan rápido y,
// duplicados para el bucle, ya se siente como una fila que no se acaba.
export const LIBROS_ESTANTE = 15

// ── Funciones ──
const V = '?v=3' // cache-busting de las capturas: súbelo al reemplazarlas

export const LECTOR = {
  eyebrow: 'El Lector',
  title: 'Una historia que se ve y se oye.',
  bullets: [
    'Ilustraciones que aparecen en los momentos clave',
    'Sonido que acompaña cada escena',
    'Letra, tamaño y fondo a tu gusto',
  ],
  shot: `/assets/landing/shot-01-lector.webp${V}`,
  shotM: `/assets/landing/shot-01-lector-m.webp${V}`,
  sonido: '/sounds/olas.mp3', // la captura es de Capitanes intrépidos
}

export const INVESTIGACION = {
  eyebrow: 'La Investigación',
  title: 'Cada capítulo desbloquea una pista.',
  bullets: [
    'Personajes, lugares y hechos en un tablero',
    'Se desbloquea a medida que lees, sin spoilers',
    '¿No es ficción? Glosario, datos y referencias',
  ],
  shot: `/assets/landing/shot-03-investigacion.webp${V}`,
  shotM: `/assets/landing/shot-03-investigacion-m.webp${V}`,
}

export const ALBUM = {
  eyebrow: 'El Álbum',
  title: 'Un premio que se colecciona.',
  bullets: [
    'Cada libro llena una página de tu álbum',
    'Barajitas de personajes, lugares y capítulos',
    'Se ganan leyendo, capítulo a capítulo',
  ],
  // Sin captura móvil: en el teléfono el álbum pide girar la pantalla.
  shot: `/assets/landing/shot-06-album.webp${V}`,
  barajita: { nombre: 'Harvey Cheyne', libro: 'Capitanes intrépidos', slug: 'capitanes-intrepidos' },
}

// ── Acertijos (Investigación) ──
// `ok`: palabras que cuentan como acierto (sin tildes, en minúscula). Basta con
// que la respuesta contenga una.
export const ACERTIJOS = [
  {
    q: 'Tiene ciudades, pero no casas; ríos, pero no agua; bosques, pero no árboles. ¿Qué es?',
    ok: ['mapa', 'mapas', 'atlas', 'plano'],
    pista: 'Ningún explorador sale sin él.',
    respuesta: 'un mapa',
  },
  {
    q: 'Cuanto más le quitas, más grande se hace. ¿Qué es?',
    ok: ['agujero', 'hoyo', 'hueco', 'pozo', 'foso', 'zanja'],
    pista: 'Piensa en una pala.',
    respuesta: 'un agujero',
  },
  {
    q: 'Un hombre entra en un bar y pide un vaso de agua. El camarero saca una pistola y le apunta. El hombre le da las gracias y se va. ¿Por qué?',
    ok: ['hipo'],
    pista: 'El hombre no tenía sed. Tenía otro problema, y el susto se lo quitó.',
    respuesta: 'tenía hipo',
  },
  {
    q: 'Tengo hojas y no soy árbol, tengo lomo y no soy caballo. ¿Qué soy?',
    ok: ['libro', 'libros'],
    pista: 'Ahora mismo estás rodeado de ellos.',
    respuesta: 'un libro',
  },
]
export const ACIERTOS = ['¡Correcto! Tienes madera de detective.', '¡Exacto! Ni Holmes lo habría dicho mejor.', '¡Bien! Me quito el sombrero. Si tuviera.']

// ── Preguntas frecuentes (responde el gato) ──
export const FAQ = [
  { q: '¿Es gratis?', a: 'Leer, sí. Lo demás… mi dueño tiene que comer.' },
  { q: '¿Necesito una cuenta?', a: 'Para probar, no. Para disfrutar, sí.' },
  { q: '¿Para qué es la cuenta?', a: 'Para guardar por dónde vas, tu Cuaderno, tus Predicciones y tu Álbum. Con Google te registras en un minuto.' },
]
