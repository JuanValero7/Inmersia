// Sonido de ambiente en ficción (RecorderPlayer / AudioSheet): oculto por ahora
// —los capítulos aún no traen pistas y el chip confundía— pero el código sigue
// vivo. Poner en true vuelve a mostrar el chip del lector y el ítem "Audio" del
// gato en móvil. No afecta a la no ficción, que usa el ruido ambiental.
export const AMBIENTE_FICCION_ACTIVO = false

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
