// Formato: Plain JavaScript (.jsx)
// Configuración y utilidades compartidas de la Cartelera.

export const SECCIONES = [
  { key: 'personajes', label: 'Personajes', singular: 'Personaje', sub: 'Quiénes habitan el relato',     color: '#d56a52' },
  { key: 'lugares',    label: 'Lugares',    singular: 'Lugar',     sub: 'Dónde sucede todo',              color: '#86ad9e' },
  { key: 'hechos',     label: 'Hechos',     singular: 'Hecho',     sub: 'Lo que ya ha ocurrido',          color: '#e0b256' },
  { key: 'datos',      label: 'Datos',      singular: 'Dato',      sub: 'Pistas y detalles a recordar',   color: '#7d8db5' },
  { key: 'notas',      label: 'Notas',      singular: 'Nota',      sub: 'Tus predicciones y apuntes',     color: '#cf8ea4' },
]

// No-ficción: mismos colores que sus equivalentes visuales de ficción
// Glosario=Personajes, Datos=Lugares, Referencias=Hechos, Resumen=Datos
export const SECCIONES_NOFICCION = [
  { key: 'glosario',    label: 'Glosario',    singular: 'Término',    sub: 'Conceptos clave del libro',      color: '#d56a52' },
  { key: 'datos',       label: 'Datos',       singular: 'Dato',       sub: 'Referencias del mundo real',     color: '#86ad9e' },
  { key: 'referencias', label: 'Referencias', singular: 'Referencia', sub: 'Ideas y obras citadas',          color: '#e0b256' },
  { key: 'resumen',     label: 'Resumen',     singular: 'Capítulo',   sub: 'Lo esencial de cada capítulo',  color: '#7d8db5' },
  { key: 'notas',       label: 'Notas',       singular: 'Nota',       sub: 'Tus predicciones y apuntes',    color: '#cf8ea4' },
]

export const getSecciones = (esNoficcion) => esNoficcion ? SECCIONES_NOFICCION : SECCIONES

export const seccionMeta = (key) =>
  SECCIONES.find(s => s.key === key) || SECCIONES_NOFICCION.find(s => s.key === key)

// tags viven en metadata.tags (jsonb)
export const getTags = (item) => {
  const tags = item?.metadata?.tags
  return Array.isArray(tags) ? tags : []
}

export const getCap = (item) =>
  item?.capitulo_numero != null ? `Cap. ${item.capitulo_numero}` : ''

// RNG determinista (mismo patrón en todos los tableros → layout estable)
export function rng(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

// mezcla un hex con blanco (amt>0) o negro (amt<0) → rgb()
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt)
  const mix = (c) => Math.round((t - c) * p + c)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}

export const DOT_AMT = [0.02, -0.14, 0.16, -0.26, 0.30]

// Primera letra significativa (ignora artículos El/La/Los/Las)
export const initial = (s) => (s || '').replace(/^(El|La|Los|Las)\s+/i, '').charAt(0).toUpperCase()

// Extrae solo el texto nuevo de curr que no estaba en prev (descripción acumulada → delta)
export function deltaDesc(prev, curr) {
  if (!prev) return curr
  const p = prev.trim()
  const c = curr.trim()
  if (c.startsWith(p)) {
    const rest = c.slice(p.length).replace(/^[\s.,;:\-–—]+/, '').trim()
    return rest || c
  }
  return c
}
