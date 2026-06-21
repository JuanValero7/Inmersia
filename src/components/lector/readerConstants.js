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
