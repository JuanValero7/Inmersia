// src/components/landing/landingData.js
// ─────────────────────────────────────────────────────────────
// Contenido de la landing (compartido por Landing.jsx y LandingMobile.jsx).
// Las capturas viven en public/assets/landing/.
// ─────────────────────────────────────────────────────────────

export const HERO = {
  // El <em> marca la palabra en cursiva/terracota
  titleParts: ['Las mejores historias ', { em: 'nunca' }, ' estuvieron en el feed.'],
  lede:
    'Inmersia convierte cada libro en un mundo para habitar, no en una pantalla más para mirar. Con imágenes, sonido, pistas para investigar la trama y gente que lee contigo, adéntrate en una nueva aventura.',
}

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
  [ { c: 'var(--inm-c-red)',  t: 'Investiga, predice, recuerda', a: 'topL' }, { c: 'var(--inm-c-teal)', t: 'Comenta y discute la obra', a: 'lowR' } ],
  [ { c: 'var(--inm-c-gold)', t: 'Anota, subraya: tu impronta',  a: 'midR' }, { c: 'var(--inm-c-blue)', t: 'Organiza, crea, disfruta', a: 'lowL' } ],
  [ { c: 'var(--inm-c-teal)', t: 'Comenta y discute la obra',    a: 'topR' }, { c: 'var(--inm-c-gold)', t: 'Anota, subraya: tu impronta', a: 'midL' } ],
  [ { c: 'var(--inm-c-blue)', t: 'Organiza, crea, disfruta',     a: 'lowL' }, { c: 'var(--inm-c-red)',  t: 'Investiga, predice, recuerda', a: 'topR' } ],
  [ { c: 'var(--inm-c-red)',  t: 'Investiga, predice, recuerda', a: 'topL' }, { c: 'var(--inm-c-gold)', t: 'Anota, subraya: tu impronta', a: 'midR' } ],
]

// Las 5 vistas de Inmersia (recuadros con captura)
export const FEATURES = [
  {
    id: 'lector',
    idx: '01 — Lector inmersivo',
    title: 'Una historia que se ve y se oye.',
    body: 'Inmersia no te muestra texto y ya. Cada capítulo puede traer ilustraciones y un ambiente sonoro que acompaña la escena — la lluvia, la posada, el bosque al atardecer. Te metes en la historia sin darte cuenta.',
    bullets: [
      'Ilustraciones que aparecen en los momentos clave',
      'Sonido ambiente que sigue lo que estás leyendo',
      'Modo día y noche · retomas donde dejaste · sin anuncios',
    ],
    shot: '/assets/landing/shot-01-lector.webp',
    flip: false,
  },
  {
    id: 'diario',
    idx: '02 — Diario del aventurero',
    title: 'Un recuerdo y un portal a tus pensamientos.',
    body: 'Subraya una frase, deja una nota al margen, guarda esa cita que te dejó pensando. Tu diario de lectura viaja contigo de libro en libro — para volver, releer y recordar por qué te marcó tanto.',
    bullets: [
      'Subrayados y notas al margen',
      'Tus citas favoritas, todas juntas',
      'Siempre a mano, en cualquier dispositivo',
    ],
    shot: '/assets/landing/shot-02-diario.webp',
    flip: true,
  },
  {
    id: 'investigacion',
    idx: '03 — Zona de investigación',
    title: 'Un misterio, una misión, un lugar donde explorar.',
    body: 'Cada libro esconde un tablón secreto. Personajes, lugares, hechos y datos clave se van pinchando solos a medida que avanzas — como un detective armando el caso en la pared. Ves cómo todo se conecta, sin perderte y sin spoilers.',
    bullets: [
      'Personajes, lugares, hechos y datos de la trama',
      'Se desbloquea con tu lectura, capítulo a capítulo',
      'Imposible spoilearte: solo aparece lo que ya pasaste',
    ],
    shot: '/assets/landing/shot-03-investigacion.webp',
    flip: false,
  },
  {
    id: 'foro',
    idx: '04 — Foro y Ágora',
    title: 'Un foro, una charla, un encuentro con motivo.',
    body: 'Teoriza, cita lo que te marcó y discute los giros con gente que va por tu mismo capítulo. La parte buena de las redes — la conversación — sin todo lo demás.',
    bullets: [
      'Conversaciones por libro y por capítulo',
      'Teorías, citas y debate sano',
      'Lees solo, pero no aislado',
    ],
    shot: '/assets/landing/shot-04-foro.webp',
    flip: true,
  },
  {
    id: 'biblioteca',
    idx: '05 — Biblioteca personalizada',
    title: 'Un escape y un encuentro.',
    body: 'Todo lo tuyo en un solo lugar: lo que estás leyendo, lo que dejaste a medias y lo que tienes en cola para después. Inmersia lleva la cuenta de tu progreso para que siempre sepas dónde retomar.',
    bullets: [
      'Leyendo ahora, por leer y terminados',
      'Tu progreso de lectura, libro por libro',
      'Armas tu propia cola de lecturas',
    ],
    shot: '/assets/landing/shot-05-biblioteca.webp',
    flip: false,
  },
]
