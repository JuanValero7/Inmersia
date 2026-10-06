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
// Y TAMPOCO PARA GOOGLE, como se creía. Google sí ejecuta JavaScript, pero en
// dos pasadas: primero rastrea el HTML crudo y lo indexa, y solo después, en
// una cola aparte que puede tardar días o no llegar nunca, lo renderiza. Con el
// <body> vacío, las 51 fichas de libro llegaban a esa primera pasada como 51
// documentos idénticos y sin contenido. El resultado medido en Search Console
// el 18-09-2026: 50 URLs en «Descubierta: actualmente sin indexar». Bing y los
// rastreadores de IA directamente no renderizan nada.
//
// QUÉ HACE
// Por cada libro visible escribe dist/libro/<slug>/index.html: el index.html del
// build tal cual (mismos bundles, mismos hashes) con las etiquetas del <head>
// sustituidas, un JSON-LD de schema.org/Book y —esto es lo nuevo— el bloque
// <div id="seo-estatico"> relleno con contenido real: título, autor, portada,
// sinopsis y el capítulo 1 entero. Son obras de dominio público: no hay nada
// que proteger y cada capítulo es una puerta de entrada orgánica.
//
// El bloque lo retira src/main.jsx antes de montar React, así que el usuario
// solo lo ve durante la misma ventana en la que hoy ve una pantalla en blanco.
// El JSON-LD va en el <head> y sí se queda: sobrevive al renderizado.
//
// Vercel sirve el archivo en /libro/<slug> porque el sistema de archivos se
// consulta ANTES que los rewrites. Si un libro no tiene su archivo, la ruta cae
// al catch-all de siempre y la app funciona igual: se degrada sola.
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
import { parseMarkdown, INLINE_RE } from '../src/components/legal/parseMarkdown.js'
import { SOBRE } from '../src/content/sobre.js'

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

const CABECERAS = { apikey: KEY_SB, Authorization: `Bearer ${KEY_SB}` }

async function pedir(ruta) {
  const res = await fetch(`${URL_SB}/rest/v1/${ruta}`, { headers: CABECERAS })
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}: ${await res.text()}`)
  return res.json()
}

async function libros() {
  const campos = 'id,slug,titulo,autor,descripcion,portada_url,metadata'
  return pedir(`libros?select=${campos}&visible=eq.true&slug=not.is.null`)
}

// El capítulo 1 de cada libro. Se puede leer con la clave pública: las
// políticas capitulos_guest_preview y parrafos_guest_preview ya abren los dos
// primeros capítulos al rol `anon` — es la misma muestra que ve un invitado en
// el lector. Aquí no hace falta ninguna credencial de servicio.
async function primerosCapitulos(ids) {
  const caps = await pedir(
    `capitulos?select=id,libro_id,titulo&numero=eq.1&libro_id=in.(${ids.join(',')})`)
  return new Map(caps.map(c => [c.libro_id, c]))
}

// Un libro con 117 párrafos en el capítulo 1 no cabe en una consulta conjunta
// sin paginar (el REST de Supabase corta en 1000 filas), así que se pide uno a
// uno con el pool de abajo. Solo texto y diálogo: los separadores son "* * *"
// y las notas marginales son voz del narrador ficticio de Inmersia, no del
// original — meterlas confundiría a un buscador sobre qué obra es esta.
async function parrafosDe(capituloId) {
  return pedir(`parrafos?select=numero,contenido,tipo&capitulo_id=eq.${capituloId}` +
               `&tipo=in.(texto,dialogo)&order=numero`)
}

// 51 peticiones secuenciales alargarían el build un minuto largo; todas a la
// vez son 51 conexiones simultáneas contra Supabase. Seis es el punto medio.
async function enPool(items, limite, tarea) {
  const salida = new Array(items.length)
  let siguiente = 0
  const obreros = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (siguiente < items.length) {
      const i = siguiente++
      salida[i] = await tarea(items[i])
    }
  })
  await Promise.all(obreros)
  return salida
}

// El hero es la acuarela apaisada de "Seguir leyendo": es el formato que quieren
// las tarjetas (1200x630 aprox.). La portada es vertical y WhatsApp la recorta
// por el centro, que en un libro suele ser justo el título.
const imagenDe = (l) => l?.metadata?.hero_url || l?.portada_url || `${ORIGEN}/og-image.png`

// schema.org/Book en JSON-LD. Va en el <head>, que es lo que lo hace fiable:
// no lo toca nadie al renderizar, así que Google lo lee en las dos pasadas.
// Habilita los resultados enriquecidos (autor, portada, "gratis") en la página
// de resultados. `isAccessibleForFree` es cierto y conviene declararlo: hoy
// todo Inmersia es gratis, y Google lo usa para no marcar la página como muro
// de pago cuando ve texto que el rastreador sí lee y un visitante debe registrarse.
function jsonLdLibro(l, url, img) {
  const datos = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: l.titulo,
    author: { '@type': 'Person', name: l.autor || 'Desconocido' },
    url,
    image: img,
    inLanguage: 'es',
    bookFormat: 'https://schema.org/EBook',
    isAccessibleForFree: true,
    publisher: { '@type': 'Organization', name: 'Inmersia', url: ORIGEN },
  }
  if (l.descripcion) datos.description = String(l.descripcion).replace(/\s+/g, ' ').trim()
  // `<` escapado: un "</script>" dentro de un título cerraría la etiqueta y
  // volcaría el resto del JSON como HTML en mitad del <head>.
  const json = JSON.stringify(datos, null, 2).replace(/</g, '\\u003c')
  return `<script type="application/ld+json">\n${json}\n    </script>`
}

// El contenido que se lleva el rastreador que no ejecuta JavaScript. Estilo
// propio y mínimo, sin depender del CSS de la app: durante el instante que se
// ve, antes de que React monte, tiene que parecerse a Inmersia y no a un
// documento sin formato. Los colores son los de la marca (index.css).
function bloqueEstatico(l, parrafos) {
  const texto = parrafos
    .map(p => `<p>${esc(p.contenido)}</p>`)
    .join('\n          ')

  const portada = l.portada_url
    ? `<img src="${esc(l.portada_url)}" alt="Portada de ${esc(l.titulo)}" width="220" loading="eager" />`
    : ''

  return `<div id="seo-estatico">
      <style>
        #seo-estatico { max-width: 44rem; margin: 0 auto; padding: 2rem 1.25rem 4rem;
          font-family: Lora, Georgia, serif; color: #4a3622; background: #fffdf8; }
        #seo-estatico h1 { font-family: 'Playfair Display', Georgia, serif;
          font-size: 2rem; margin: 0 0 .25rem; line-height: 1.2; }
        #seo-estatico h2 { font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.35rem; margin: 2.5rem 0 1rem; }
        #seo-estatico .autor { font-size: 1.05rem; opacity: .75; margin: 0 0 1.5rem; }
        #seo-estatico img { max-width: 100%; height: auto; border-radius: 6px; }
        #seo-estatico p { line-height: 1.7; margin: 0 0 1.1rem; }
        #seo-estatico .leer { display: inline-block; margin: 1.5rem 0; padding: .7rem 1.4rem;
          background: #f2792a; color: #fffdf8; border-radius: 999px; text-decoration: none; }
      </style>
      <article>
        <h1>${esc(l.titulo)}</h1>
        <p class="autor">${esc(l.autor || 'Autor desconocido')}</p>
        ${portada}
        ${l.descripcion ? `<p>${esc(l.descripcion)}</p>` : ''}
        <p><a class="leer" href="${ORIGEN}/libro/${esc(l.slug)}">Leer ${esc(l.titulo)} en Inmersia</a></p>
        ${texto ? `<h2>${esc(l.capituloTitulo || 'Capítulo 1')}</h2>\n          ${texto}` : ''}
      </article>
    </div>`
}

// El catálogo como lista de enlaces en el HTML crudo.
//
// POR QUÉ IMPORTA MÁS QUE EL RESTO
// Un sitemap le dice a Google que una URL existe; los enlaces internos le dicen
// que merece la pena rastrearla. Hasta ahora ninguna página de Inmersia
// enlazaba a otra en el HTML crudo —los enlaces los pinta React— así que los 51
// libros eran 51 URLs sueltas sin nada que apuntara a ellas. Eso es justo lo
// que Search Console llama «Descubierta: actualmente sin indexar».
function bloqueCatalogo(lista, titulo, intro) {
  const items = lista
    .map(l => `<li><a href="${ORIGEN}/libro/${esc(l.slug)}">${esc(l.titulo)}</a>` +
              `<span> — ${esc(l.autor || 'Autor desconocido')}</span></li>`)
    .join('\n          ')

  return `<div id="seo-estatico">
      <style>
        #seo-estatico { max-width: 44rem; margin: 0 auto; padding: 2rem 1.25rem 4rem;
          font-family: Lora, Georgia, serif; color: #4a3622; background: #fffdf8; }
        #seo-estatico h1 { font-family: 'Playfair Display', Georgia, serif;
          font-size: 2rem; margin: 0 0 .75rem; line-height: 1.2; }
        #seo-estatico p { line-height: 1.7; margin: 0 0 1.5rem; }
        #seo-estatico ul { list-style: none; padding: 0; margin: 0; }
        #seo-estatico li { padding: .5rem 0; border-bottom: 1px solid rgba(74,54,34,.12); }
        #seo-estatico a { color: #8b4d2a; text-decoration: none; font-weight: 600; }
        #seo-estatico span { opacity: .7; font-weight: 400; }
      </style>
      <article>
        <h1>${esc(titulo)}</h1>
        <p>${esc(intro)}</p>
        <ul>
          ${items}
        </ul>
        <!-- Google comprueba que la portada enlace la política de privacidad
             para verificar la marca del inicio de sesión. -->
        <p><a href="${ORIGEN}/privacidad">Política de Privacidad</a> · <a href="${ORIGEN}/terminos">Términos y Condiciones</a> · <a href="${ORIGEN}/impressum">Impressum</a> · <a href="${ORIGEN}${SOBRE.ruta}">Sobre Inmersia</a></p>
      </article>
    </div>`
}

// ── Páginas sueltas: /sobre y los documentos legales ─────────────────────
// Hasta ahora /impressum, /privacidad y /terminos caían al index.html de la
// home, así que un rastreador sin JavaScript leía el catálogo en vez del
// Impressum. El verificador del programa de startups de Google tiene que poder
// ver en el HTML crudo quién está detrás (negocio, equipo y producto): por eso
// /sobre y los legales salen ahora con su propio contenido estático.

const ESTILO_PAGINA = `<style>
        #seo-estatico { max-width: 44rem; margin: 0 auto; padding: 2rem 1.25rem 4rem;
                        color: #4a3622; font-family: Georgia, serif; }
        #seo-estatico h1, #seo-estatico h2, #seo-estatico h3 {
                        font-family: 'Playfair Display', Georgia, serif; line-height: 1.25; }
        #seo-estatico p, #seo-estatico li { line-height: 1.7; }
        #seo-estatico img { max-width: 100%; height: auto; border-radius: 12px; }
        #seo-estatico a { color: #8b4d2a; }
        #seo-estatico table { border-collapse: collapse; width: 100%; }
        #seo-estatico th, #seo-estatico td { text-align: left; padding: .4rem .6rem;
                        border-bottom: 1px solid rgba(74,54,34,.15); vertical-align: top; }
      </style>`

const PIE_PAGINAS = `<p><a href="${ORIGEN}/">Inmersia</a> · <a href="${ORIGEN}/terminos">Términos y Condiciones</a> · ` +
  `<a href="${ORIGEN}/privacidad">Política de Privacidad</a> · <a href="${ORIGEN}/impressum">Impressum</a> · ` +
  `<a href="${ORIGEN}${SOBRE.ruta}">Sobre Inmersia</a></p>`

const bloquePagina = (cuerpo) => `<div id="seo-estatico">
      ${ESTILO_PAGINA}
      <article>
        ${cuerpo}
        ${PIE_PAGINAS}
      </article>
    </div>`

// Lo inline del markdown legal, igual que renderInline() de LegalModal: los
// enlaces a los otros .md pasan a ser sus rutas públicas.
function inlineHtml(texto) {
  let out = '', ultimo = 0, m
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(texto))) {
    out += esc(texto.slice(ultimo, m.index))
    if (m[1] !== undefined) {
      const href = /\.md$/i.test(m[2]) && m[2].includes('privacidad') ? `${ORIGEN}/privacidad`
        : /\.md$/i.test(m[2]) && m[2].includes('terminos') ? `${ORIGEN}/terminos` : m[2]
      out += `<a href="${esc(href)}">${esc(m[1])}</a>`
    } else if (m[3] !== undefined) out += `<strong>${esc(m[3])}</strong>`
    else if (m[4] !== undefined) out += `<em>${esc(m[4])}</em>`
    ultimo = INLINE_RE.lastIndex
  }
  return out + esc(texto.slice(ultimo))
}

function docHtml(raw) {
  return parseMarkdown(raw).map((b) => {
    if (b.type === 'hr') return '<hr />'
    if (/^h[1-4]$/.test(b.type)) return `<${b.type}>${inlineHtml(b.text)}</${b.type}>`
    if (b.type === 'ul' || b.type === 'ol')
      return `<${b.type}>${b.items.map(it => `<li>${inlineHtml(it)}</li>`).join('')}</${b.type}>`
    if (b.type === 'table')
      return `<table><thead><tr>${b.header.map(c => `<th>${inlineHtml(c)}</th>`).join('')}</tr></thead>` +
        `<tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${inlineHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    return `<p>${inlineHtml(b.text).replace(/\n/g, '<br />')}</p>`
  }).join('\n        ')
}

function sobreHtml() {
  const { fundador: f, proceso: pr, modelo: mo, contacto: c, english: en } = SOBRE
  const parrafos = (lista) => lista.map(t => `<p>${esc(t)}</p>`).join('')
  return `<h1>${esc(SOBRE.titulo)}</h1>
        ${parrafos(SOBRE.intro)}
        <h2>${esc(f.titulo)}</h2>
        <img src="${ORIGEN}${esc(f.foto)}" alt="${esc(f.fotoAlt)}" width="240" />
        <p><strong>${esc(f.nombre)}</strong>, ${esc(f.cargo.toLowerCase())}.</p>
        ${parrafos(f.bio)}
        <p><em>${esc(f.credito)}</em></p>
        <h2>${esc(pr.titulo)}</h2>
        <p>${esc(pr.intro)}</p>
        <ol>${pr.pasos.map(x => `<li><strong>${esc(x.titulo)}.</strong> ${esc(x.texto)}</li>`).join('')}</ol>
        <p>${esc(pr.cierre)}</p>
        <h2>${esc(mo.titulo)}</h2>
        <p>${esc(mo.texto)}</p>
        <h2>${esc(c.titulo)}</h2>
        <ul><li>Correo: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` +
        c.enlaces.map(e => `<li>${esc(e.label)}: <a href="${esc(e.href)}">${esc(e.texto)}</a></li>`).join('') + `</ul>
        <section lang="en"><h2>${esc(en.titulo)}</h2>${parrafos(en.parrafos)}</section>`
}

// schema.org/Organization con fundador: lo mismo que dice la página, en el
// formato que leen Google y los validadores automáticos.
const jsonLdOrganizacion = () => `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Inmersia',
  url: `${ORIGEN}/`,
  logo: `${ORIGEN}/icons/icon-512.png`,
  email: SOBRE.contacto.email,
  foundingDate: '2026-04-27',
  foundingLocation: 'Berlin, Germany',
  founder: { '@type': 'Person', name: SOBRE.fundador.nombre, jobTitle: SOBRE.fundador.cargo },
  sameAs: SOBRE.contacto.enlaces.filter(e => !e.href.includes('/in/')).map(e => e.href),
}).replace(/</g, '\\u003c')}</script>`

function paginaSuelta(plantilla, { ruta, titulo, desc, cuerpo, head = '' }) {
  const url = `${ORIGEN}${ruta}`
  return plantilla
    .replace('<title>Inmersia — Lee, investiga y colecciona</title>', `<title>${esc(titulo)}</title>`)
    .replace('<link rel="canonical" href="https://www.inmersia.io/" />',
      `<link rel="canonical" href="${esc(url)}" />${head ? `\n    ${head}` : ''}`)
    .replace('<div id="seo-estatico"></div>', bloquePagina(cuerpo))
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(titulo)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${esc(url)}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(titulo)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(desc)}" />`)
}

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
      `<title>${esc(titulo)}</title>`)
    .replace(
      '<link rel="canonical" href="https://www.inmersia.io/" />',
      `<link rel="canonical" href="${esc(url)}" />\n    ${jsonLdLibro(l, url, img)}`)
    .replace(
      '<div id="seo-estatico"></div>',
      bloqueEstatico(l, l.parrafos || []))
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
      url(`${ORIGEN}${SOBRE.ruta}`, '0.5', 'monthly'),
      ...lista.map(l => url(`${ORIGEN}/libro/${l.slug}`, '0.8', 'monthly')),
    ].join('\n') + '\n</urlset>\n'
}

const lista     = await libros()
const plantilla = await readFile(join(DIST, 'index.html'), 'utf8')

// Cada libro se lleva colgado el capítulo 1 que se va a publicar. Si un libro
// no lo tiene (aún sin cargar, o el capítulo 1 no existe) se queda sin texto y
// su ficha sale igual, solo con sinopsis: se degrada sola, como el resto.
const caps = await primerosCapitulos(lista.map(l => l.id))
await enPool(lista, 6, async (l) => {
  const cap = caps.get(l.id)
  if (!cap) return
  l.capituloTitulo = cap.titulo
  l.parrafos = await parrafosDe(cap.id)
})

// Un directorio por libro con su index.html, no `<slug>.html`: así Vercel lo
// sirve en /libro/<slug> con la resolución normal de índices, sin cleanUrls
// (que rompía el rewrite catch-all y dejaba /tienda y las rutas protegidas en
// 404). Un slug sin carpeta atraviesa el filesystem y cae al SPA, como antes.
for (const l of lista) {
  const dir = join(DIST, 'libro', l.slug)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'index.html'), paginaLibro(plantilla, l), 'utf8')
}
// La home y la tienda también dejan de llegar con el cuerpo vacío. Se
// sobrescriben DESPUÉS de las fichas, porque `plantilla` ya está en memoria y
// las fichas deben salir del index.html limpio del build.
const INTRO = 'Obras de dominio público ilustradas, con sonido y pistas para ' +
              'investigar la trama. Leer en Inmersia es gratis.'

const home = plantilla.replace(
  '<div id="seo-estatico"></div>',
  bloqueCatalogo(lista, 'Inmersia — Lee, investiga y colecciona', INTRO))
await writeFile(join(DIST, 'index.html'), home, 'utf8')

const tienda = plantilla
  .replace('<title>Inmersia — Lee, investiga y colecciona</title>',
           '<title>Catálogo — Inmersia</title>')
  .replace('<link rel="canonical" href="https://www.inmersia.io/" />',
           `<link rel="canonical" href="${ORIGEN}/tienda" />`)
  .replace(/<meta property="og:url" content="[^"]*" \/>/,
           `<meta property="og:url" content="${ORIGEN}/tienda" />`)
  .replace('<div id="seo-estatico"></div>',
           bloqueCatalogo(lista, `Catálogo — ${lista.length} libros`, INTRO))
await mkdir(join(DIST, 'tienda'), { recursive: true })
await writeFile(join(DIST, 'tienda', 'index.html'), tienda, 'utf8')

// /sobre y los legales, también desde la plantilla limpia.
const LEGALES = [
  { ruta: '/terminos',   archivo: 'terminos-y-condiciones.md', titulo: 'Términos y Condiciones · Inmersia',
    desc: 'Términos y condiciones de uso de Inmersia.' },
  { ruta: '/privacidad', archivo: 'politica-de-privacidad.md', titulo: 'Política de Privacidad · Inmersia',
    desc: 'Qué datos trata Inmersia, para qué y con qué derechos.' },
  { ruta: '/impressum',  archivo: 'impressum.md',              titulo: 'Impressum · Inmersia',
    desc: 'Impressum de Inmersia (§ 5 DDG).' },
]
const sueltas = [
  { ruta: SOBRE.ruta, titulo: `${SOBRE.titulo} · Inmersia`, desc: SOBRE.descripcion,
    cuerpo: sobreHtml(), head: jsonLdOrganizacion() },
  ...await Promise.all(LEGALES.map(async (d) => ({
    ...d, cuerpo: docHtml(await readFile(join('Documentation', d.archivo), 'utf8')),
  }))),
]
for (const pg of sueltas) {
  const dir = join(DIST, pg.ruta.slice(1))
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'index.html'), paginaSuelta(plantilla, pg), 'utf8')
}

await writeFile(join(DIST, 'sitemap.xml'), sitemap(lista), 'utf8')

const sinHero  = lista.filter(l => !l?.metadata?.hero_url).length
const sinTexto = lista.filter(l => !l.parrafos?.length).length
console.log(`[seo] ${lista.length} libros · ${sueltas.length} páginas sueltas · sitemap con ${lista.length + 3} URLs` +
            (sinHero  ? ` · ${sinHero} sin hero_url (usan la portada)` : '') +
            (sinTexto ? ` · ⚠️ ${sinTexto} sin capítulo 1 indexable` : ''))
