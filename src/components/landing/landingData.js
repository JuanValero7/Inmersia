// src/components/landing/landingData.js
// ─────────────────────────────────────────────────────────────
// Contenido de la landing (compartido por Landing.jsx y LandingMobile.jsx).
// Las capturas viven en public/assets/landing/.
// ─────────────────────────────────────────────────────────────

// Mundos que rotan dentro del portal
export const WORLDS_IMG = [
  { src: '/assets/landing/mundo-mar.webp', cls: '' },
  { src: '/assets/landing/mundo-desierto.webp', cls: '' },
  { src: '/assets/landing/mundo-paris.webp', cls: 'paris' },
  { src: '/assets/landing/mundo-jardin.webp', cls: '' },
  { src: '/assets/landing/mundo-bosque.webp', cls: '' },
]

// Posiciones ancla de los chips flotantes
export const CHIP_POS = {
  topL: { left: '-4%', top: '15%', side: 'left' },
  topR: { right: '-4%', top: '15%', side: 'right' },
  midL: { left: '-16%', top: '44%', side: 'left' },
  midR: { right: '-16%', top: '46%', side: 'right' },
  lowL: { left: '-8%', bottom: '24%', side: 'left' },
  lowR: { right: '-8%', bottom: '22%', side: 'right' },
}

// Pares de chips por mundo (texto en español venezolano · tuteo)
export const CHIP_WORLDS = [
  [ { c: 'var(--inm-c-red)',  t: 'Investiga, predice, recuerda', a: 'topL' }, { c: 'var(--inm-c-teal)', t: 'Comenta, discute, aprende', a: 'lowR' } ],
  [ { c: 'var(--inm-c-gold)', t: 'Anota, subraya, inventa',  a: 'midR' }, { c: 'var(--inm-c-blue)', t: 'Organiza, crea, disfruta', a: 'lowL' } ],
  [ { c: 'var(--inm-c-teal)', t: 'Comenta, discute, aprende',    a: 'topR' }, { c: 'var(--inm-c-gold)', t: 'Anota, subraya, inventa', a: 'midL' } ],
  [ { c: 'var(--inm-c-blue)', t: 'Organiza, crea, disfruta',     a: 'lowL' }, { c: 'var(--inm-c-red)',  t: 'Investiga, predice, recuerda', a: 'topR' } ],
  [ { c: 'var(--inm-c-red)',  t: 'Investiga, predice, recuerda', a: 'topL' }, { c: 'var(--inm-c-gold)', t: 'Anota, subraya, inventa', a: 'midR' } ],
]

// Sufijo de cache-busting de las capturas: súbelo cada vez que reemplaces
// los .webp de public/assets/landing/ manteniendo el mismo nombre.
const V = '?v=3'

// Cada vista tiene dos capturas: `shot` (escritorio) y `shotM` (la misma vista
// en la app móvil, sufijo -m). Landing.jsx elige según la variante; si una
// vista no tiene `shotM` cae a la de escritorio con su marco ancho.

// El orden lo abre la Biblioteca: es la vista que el visitante reconoce sin que
// se la expliquen (sus libros, en un sitio), así que entra primero y el resto
// sigue como estaba. `flip` alterna el lado de la captura en escritorio; en
// móvil todo se apila con el texto arriba (ver landing.mobile.css).
export const FEATURES = [
  {
    id: 'biblioteca',
    idx: '01 — Biblioteca personalizada',
    title: 'Un escape y un encuentro.',
    bullets: [
      'Todos tus libros en un solo lugar',
      'Ordénalos en colecciones, como tú quieras',
      'Visita tu perfil, tu álbum y nuestra tienda',
    ],
    shot: `/assets/landing/shot-05-biblioteca.webp${V}`,
    shotM: `/assets/landing/shot-05-biblioteca-m.webp${V}`,
    flip: false,
  },
  {
    id: 'lector',
    idx: '02 — Lector inmersivo',
    title: 'Una historia que se ve y se oye.',
    bullets: [
      'Ilustraciones que aparecen en los momentos clave',
      'Efectos de sonido que acompañan la lectura',
      'Personalización total de tu experiencia',
    ],
    shot: `/assets/landing/shot-01-lector.webp${V}`,
    shotM: `/assets/landing/shot-01-lector-m.webp${V}`,
    flip: true,
  },
  {
    id: 'diario',
    idx: '03 — Diario del aventurero',
    title: 'Un recuerdo y un portal a tus pensamientos.',
    bullets: [
      'Escribe tus predicciones y al terminar comprueba si acertaste',
      'Subraya tus citas favoritas, anota tus pensamientos y compártelo con quien quieras',
      'Siempre a mano, en cualquier dispositivo',
    ],
    shot: `/assets/landing/shot-02-diario.webp${V}`,
    shotM: `/assets/landing/shot-02-diario-m.webp${V}`,
    flip: false,
  },
  {
    id: 'investigacion',
    idx: '04 — Zona de investigación',
    title: 'Un misterio, una misión, un lugar donde explorar.',
    bullets: [
      'Personajes, lugares, hechos. Todo lo que ha pasado en un solo lugar',
      'Tu progreso adelanta la «investigación». Cada capítulo desbloquea nueva información',
      'Si lo tuyo no es la ficción, no te preocupes. Glosario, datos, referencias y resumen toman la cartelera',
    ],
    shot: `/assets/landing/shot-03-investigacion.webp${V}`,
    shotM: `/assets/landing/shot-03-investigacion-m.webp${V}`,
    flip: true,
  },
  {
    id: 'foro',
    idx: '05 — Foro y Ágora',
    title: 'Un foro, una charla, un encuentro con motivo.',
    bullets: [
      'Conversa en tiempo real con otros lectores',
      'Deja comentarios y discute teorías, citas e ideas',
    ],
    shot: `/assets/landing/shot-04-foro.webp${V}`,
    shotM: `/assets/landing/shot-04-foro-m.webp${V}`,
    flip: false,
  },
  {
    id: 'album',
    idx: '06 — Tu álbum',
    title: 'Un premio que se colecciona.',
    bullets: [
      'Tu lugar de recompensas, sigue y guarda tus logros en Inmersia',
      'Cada libro es una página de tu álbum para coleccionar',
    ],
    // Sin shotM: en móvil el álbum pide girar el teléfono y en horizontal
    // apila las dos páginas, así que no da una captura en proporción de
    // teléfono. Se usa la de escritorio.
    shot: `/assets/landing/shot-06-album.webp${V}`,
    flip: true,
  },
]
