// src/lib/imagenWebp.js
// Pasa una imagen del escritor (JPG/PNG/WebP) a WebP de como mucho 1600 px
// de lado, en el navegador, antes de subirla (Rincón del escritor, 107).
// Ahorra almacenamiento: el plan gratis de Supabase tiene 1 GB para todo.

export const LADO_MAX = 1600
export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp']
export const TAMANO_MAX = 5 * 1024 * 1024

/**
 * Medidas finales manteniendo la proporción.
 * @param {number} ancho @param {number} alto @param {number} [max]
 */
export function medidasReducidas(ancho, alto, max = LADO_MAX) {
  const escala = Math.min(1, max / Math.max(ancho, alto))
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) }
}

/**
 * @param {File} archivo
 * @returns {Promise<Blob>} WebP
 */
export async function aWebp(archivo) {
  const bitmap = await globalThis.createImageBitmap(archivo)
  const { ancho, alto } = medidasReducidas(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  canvas.getContext('2d').drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close?.()
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.85))
  if (!blob || blob.type !== 'image/webp') throw new Error('sin_webp')
  return blob
}
