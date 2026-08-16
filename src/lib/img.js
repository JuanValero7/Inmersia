// src/lib/img.js
// ─────────────────────────────────────────────────────────────
// Reescribe una URL pública de Supabase Storage para pasarla por el
// endpoint de transformación de imágenes (render/image), sirviéndola
// redimensionada y recomprimida en vez de a resolución completa.
//
// Motivo: las portadas pesan ~214 KB y cada slide de preview ~462 KB a
// tamaño original. Pedir width/quality al tamaño real de pantalla baja
// el peso ~70% (medido: 214 KB → 64 KB con width=400&quality=70).
//
// Solo toca URLs de Storage (contienen /storage/v1/object/public/).
// Cualquier otra (assets locales /assets/…, data URIs, null) se devuelve
// tal cual, así es seguro envolver cualquier src con esta función.
// ─────────────────────────────────────────────────────────────
const OBJECT_MARKER = '/storage/v1/object/public/'

export function imgUrl(url, { width, height, quality = 70 } = {}) {
  if (!url || typeof url !== 'string') return url
  const i = url.indexOf(OBJECT_MARKER)
  if (i === -1) return url // no es Storage de Supabase → se deja igual

  const base = url.slice(0, i)
  const path = url.slice(i + OBJECT_MARKER.length)
  const params = new URLSearchParams()
  if (width)  params.set('width', String(width))
  if (height) params.set('height', String(height))
  params.set('quality', String(quality))
  // IMPORTANTE: sin resize, el default de Supabase es `cover`, que RECORTA la
  // imagen a la caja (con solo width devolvía 420x1536 en vez de 420x630 →
  // la portada salía "con zoom" y se perdían los lados). `contain` la escala
  // proporcional sin recortar; el encuadre final lo hace el object-fit del CSS.
  params.set('resize', 'contain')
  return `${base}/storage/v1/render/image/public/${path}?${params.toString()}`
}

// Precarga una lista de URLs (dispara la descarga en segundo plano para
// que estén en caché cuando el componente las pinte). Ignora vacíos.
export function preloadImages(urls = []) {
  urls.filter(Boolean).forEach((u) => { const img = document.createElement('img'); img.src = u })
}
