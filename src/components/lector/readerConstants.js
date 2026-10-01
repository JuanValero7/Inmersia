// Sonido de ambiente en ficción (RecorderPlayer / AudioSheet): oculto por ahora
// —los capítulos aún no traen pistas y el chip confundía— pero el código sigue
// vivo. Poner en true vuelve a mostrar el chip del lector y el ítem "Audio" del
// gato en móvil. No afecta a la no ficción, que usa el ruido ambiental.
export const AMBIENTE_FICCION_ACTIVO = false

// Modos del pie de página (ver etiquetaProgreso en utils/readerHelpers.js).
// La muestra es un símbolo y no un número: un número de ejemplo se confundía
// con el progreso real.
export const MODOS_PROGRESO = [
  { id: 'libro',    muestra: '%',    nombre: 'Del libro',    corto: 'Libro',    ayuda: 'Cuánto llevas del libro entero.' },
  { id: 'capitulo', muestra: '%',    nombre: 'Del capítulo', corto: 'Capítulo', ayuda: 'Cuánto llevas del capítulo que estás leyendo.' },
  { id: 'pagina',   muestra: '#',    nombre: 'Página',       corto: 'Página',   ayuda: 'El número de página dentro del capítulo.' },
]

export const READING_FONTS = [
  { label: 'Clásica', css: "'Crimson Text', Georgia, serif" },
  { label: 'Moderna', css: "'Lora', Georgia, serif" },
  { label: 'Cómoda',  css: "'Merriweather', Georgia, serif" },
  { label: 'Redonda', css: "'Baloo 2', system-ui, sans-serif" },
]

// Factor de ancho medio de carácter por fuente (estima caracteres/línea).
// Baloo 2 y Merriweather son más anchas que Crimson/Lora.
export const FONT_WIDTH = {
  "'Crimson Text', Georgia, serif": 0.46,
  "'Lora', Georgia, serif": 0.46,
  "'Merriweather', Georgia, serif": 0.50,
  "'Baloo 2', system-ui, sans-serif": 0.52,
}
