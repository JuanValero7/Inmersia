// Genera, después de `vite build`, un HTML por libro y el sitemap.
//
// POR QUÉ EXISTE
// Inmersia es un SPA: vercel.json reescribe todas las rutas a index.html, así
// que el servidor devuelve siempre el mismo archivo y es React, ya en el
// navegador, quien decide qué pintar. Eso funciona para personas y para Google
// (que ejecuta JavaScript), pero NO para los bots de WhatsApp, Instagram, X o
// Telegram: esos leen el HTML tal como llega por el cable, sacan las etiquetas
// og: y cierran la conexión. Sin esto, compartir /libro/el-principito enseña la
// misma tarjeta genérica que compartir la portada — mismo título, misma imagen,
// y un og:url que apunta a la home.
//
// QUÉ HACE
// Por cada libro visible escribe dist/libro/<slug>.html: el index.html del build
// tal cual (mismos bundles, mismos hashes) con seis cadenas sustituidas. Vercel
// lo sirve en /libro/<slug> gracias a cleanUrls, porque el sistema de archivos
// se consulta ANTES que los rewrites. Si un libro no tiene su archivo, la ruta
// cae al catch-all de siempre y la app funciona igual: se degrada sola.
//
// CUÁNDO SE EJECUTA
// En cada build de Vercel (npm run build). No hay archivos generados en el
// repo, así que no hay nada que commitear ni nada que se quede viejo. Los
// orquestadores disparan un redespliegue al terminar de cargar un libro.
//
// SI SUPABASE FALLA el build falla, y Vercel deja viva la versión anterior: el
// peor caso es "el sitio no se actualiza", nunca "el sitio se rompe". Para
// desplegar igualmente durante una caída: SEO_SKIP=1 npm run build
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const DIST   = 'dist'
const ORIGEN = 'https://www.inmersia.io'

const URL_SB = process.env.VITE_SUPABASE_URL
const KEY_SB = process.env.VITE_SUPABASE_ANON_KEY

if (process.env.SEO_SKIP === '1') {
  console.log('[seo] SEO_SKIP=1 — saltando la generación.')
  process.exit(0)
}
if (!URL_SB || !KEY_SB) {
  console.error('[seo] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.')
  process.exit(1)
}

// Escapa lo que va DENTRO de un atributo HTML. Los títulos traen comillas y
// ampersands ("Ensayos: primera serie", "La gota de sangre y…"), y una comilla
// sin escapar parte el atributo y se lleva por delante la etiqueta entera.
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

// Las tarjetas sociales cortan sobre los 200 caracteres y Google sobre los 160.
// Cortamos por palabra para no dejar una sílaba huérfana antes de los puntos.
function recortar(txt, max = 100) {
  const t = String(txt ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const corte = t.slice(0, max)
  return corte.slice(0, corte.lastIndexOf(' ')).replace(/[,;:.]$/, '') + '…'
}

async function libros() {
  const campos = 'slug,titulo,autor,descripcion,portada_url,metadata'
  const res = await fetch(
    `${URL_SB}/rest/v1/libros?select=${campos}&visible=eq.true&slug=not.is.null`,
    { headers: { apikey: KEY_SB, Authorization: `Bearer ${KEY_SB}` } })
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}: ${await res.text()}`)
  return res.json()
}

// El hero es la acuarela apaisada de "Seguir leyendo": es el formato que quieren
// las tarjetas (1200x630 aprox.). La portada es vertical y WhatsApp la recorta
// por el centro, que en un libro suele ser justo el título.
const imagenDe = (l) => l?.metadata?.hero_url || l?.portada_url || `${ORIGEN}/og-image.png`

function paginaLibro(plantilla, l) {
  const titulo = `${l.titulo} — ${l.autor} | Inmersia`
  const desc   = l.descripcion
    ? `${recortar(l.descripcion, 100)} Ilustrado, con sonido y pistas para investigar la trama.`
    : `Lee ${l.titulo}, de ${l.autor}: ilustrado, con sonido y pistas para investigar la trama.`
  const url = `${ORIGEN}/libro/${l.slug}`
  const img = imagenDe(l)

  return plantilla
    .replace(
      '<title>Inmersia — Lee, investiga y colecciona</title>',
      `<title>${esc(titulo)}</title>\n    <link rel="canonical" href="${esc(url)}" />`)
    .replace(/<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${esc(desc)}" />`)
    .replace('<meta property="og:type" content="website" />',
      `<meta property="og:type" content="book" />\n    <meta property="book:author" content="${esc(l.autor)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${esc(titulo)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${esc(url)}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/,
      `<meta property="og:image" content="${esc(img)}" />`)
    // Las medidas del og:image genérico (1200x630) no valen para el hero de
    // cada libro. Mejor no declararlas: el bot mide la imagen él mismo.
    .replace(/\s*<meta property="og:image:width" content="[^"]*" \/>/, '')
    .replace(/\s*<meta property="og:image:height" content="[^"]*" \/>/, '')
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/,
      `<meta name="twitter:title" content="${esc(titulo)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${esc(desc)}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/,
      `<meta name="twitter:image" content="${esc(img)}" />`)
}

// Solo rutas públicas. /investigacion y /foro viven detrás de ProtectedRoute,
// así que meterlas aquí sería mandar a Google contra una pantalla de login.
function sitemap(lista) {
  const hoy = new Date().toISOString().slice(0, 10)
  const url = (loc, prio, freq) =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${hoy}</lastmod>\n` +
    `    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [ url(`${ORIGEN}/`, '1.0', 'weekly'),
      url(`${ORIGEN}/tienda`, '0.9', 'weekly'),
      ...lista.map(l => url(`${ORIGEN}/libro/${l.slug}`, '0.8', 'monthly')),
    ].join('\n') + '\n</urlset>\n'
}

const lista     = await libros()
const plantilla = await readFile(join(DIST, 'index.html'), 'utf8')

await mkdir(join(DIST, 'libro'), { recursive: true })
for (const l of lista) {
  await writeFile(join(DIST, 'libro', `${l.slug}.html`), paginaLibro(plantilla, l), 'utf8')
}
await writeFile(join(DIST, 'sitemap.xml'), sitemap(lista), 'utf8')

const sinHero = lista.filter(l => !l?.metadata?.hero_url).length
console.log(`[seo] ${lista.length} libros · sitemap con ${lista.length + 2} URLs` +
            (sinHero ? ` · ${sinHero} sin hero_url (usan la portada)` : ''))
