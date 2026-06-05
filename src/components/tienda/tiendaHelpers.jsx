// =============================================================
// Tienda · helpers compartidos
// Color por categoría, utilidades de color para portadas generadas,
// y configuración de los telones por hora del día.
// =============================================================

// Color de acento por categoría (paleta storybook de la biblioteca).
export const CAT_COLOR = {
  Aventura:  '#7d8db5',
  Romance:   '#cf8ea4',
  Fantasía:  '#86ad9e',
  Misterio:  '#7a8fa6',
  Poesía:    '#e0b256',
}

// Mezcla un color hex hacia blanco (amt>0) o negro (amt<0). Devuelve rgb().
export function itint(hex, amt) {
  const h = (hex || '#cf8a6e').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt)
  const mix = c => Math.round((t - c) * p + c)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}

// Luminosidad percibida 0..1 (para decidir texto claro/oscuro sobre la portada).
export function ilum(hex) {
  const h = (hex || '#cf8a6e').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

// ── Telones por hora del día ────────────────────────────────────
// 3 fondos pintados con crossfade. Las imágenes viven en public/assets/tienda/.
export const BG = {
  dia:   '/assets/tienda/bg-dia-final.webp',
  tarde: '/assets/tienda/bg-tarde-final.webp',
  noche: '/assets/tienda/bg-noche-final.webp',
}

// preset de franja horaria → telón
export const IMG_FOR = { manana: 'dia', mediodia: 'dia', atardecer: 'tarde', noche: 'noche' }

// Hora real (0..23) → franja del día.
export function presetForHour(h) {
  if (h >= 6  && h < 10) return 'manana'
  if (h >= 10 && h < 16) return 'mediodia'
  if (h >= 16 && h < 19) return 'atardecer'
  return 'noche'
}

// Telón que corresponde a la hora actual del usuario.
export function telonActual() {
  return IMG_FOR[presetForHour(new Date().getHours())] || 'dia'
}
