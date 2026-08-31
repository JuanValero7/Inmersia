// =============================================================
// Tienda · helpers compartidos
// Color por categoría, utilidades de color para portadas generadas,
// y configuración de los telones por hora del día.
// =============================================================

// Color de acento por categoría (paleta storybook de la biblioteca).
// Color del ✦ de cada categoría. Las claves son el vocabulario cerrado que fija
// la migración 048 (9 de ficción + 3 de no ficción); cualquier categoría que no
// esté aquí cae al naranja de marca en `catalogoShared`.
export const CAT_COLOR = {
  // Ficción
  Aventura:            '#7d8db5',
  Fantasía:            '#86ad9e',
  'Ciencia ficción':   '#8778b8',
  Misterio:            '#5f7387',
  Terror:              '#4f4b5c',
  Romance:             '#cf8ea4',
  Drama:               '#b4705f',
  Cuentos:             '#d9a441',
  'Novela histórica':  '#9a8256',
  // No ficción
  Filosofía:           '#7c8a4f',
  Ensayo:              '#6d9099',
  Economía:            '#5f8a6d',
}

// Mezcla un color hex hacia blanco (amt>0) o negro (amt<0). Devuelve rgb().
export function itint(hex, amt) {
  const h = (hex || '#F2792A').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt)
  const mix = c => Math.round((t - c) * p + c)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}

// Clase de tamaño para el nombre del autor (.book-scribble): a más
// caracteres, fuente más pequeña, para que no desborde la portada. El título
// no usa clases: lo ajusta CoverTitle midiendo el texto real.
export function autorSizeClass(autor) {
  const len = (autor || '').length
  if (len > 28) return 'book-scribble-xs'
  if (len > 18) return 'book-scribble-sm'
  return ''
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
