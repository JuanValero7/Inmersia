# Punto de partida — sesión de SEO

Para arrancar, basta con decir:

> Lee `Documentation/seo/punto-de-partida.md` y arrancamos con el SEO.

Estado al **10 oct 2026**. Antes de tocar nada, leer también la sección «SEO» del
[README](../../README.md) y la cabecera de `scripts/generar-seo.mjs`, que explica por qué
existe el HTML estático.

---

## 1. Cómo funciona hoy (resumen)

- Inmersia es un SPA: `vercel.json` reescribe las rutas a `index.html`.
- `npm run build` = `vite build` + `scripts/generar-seo.mjs`, que escribe un HTML por libro
  (`dist/libro/<slug>/index.html`) con etiquetas `og:`, JSON-LD de `schema.org/Book` y un
  bloque `<div id="seo-estatico">` con título, autor, portada, sinopsis y el capítulo 1.
  También el sitemap. Vercel sirve esos archivos antes que los rewrites.
- `src/main.jsx` retira `#seo-estatico` antes de montar React: el usuario no lo ve.
- Los orquestadores de carga de libros disparan un redespliegue (deploy hook): son las filas
  repetidas de «Portada…» en *Deployments* de Vercel.
- Search Console ya existe: el 18-09-2026 marcaba 50 URLs en «Descubierta: actualmente sin
  indexar» (por eso nació el HTML estático).

## 2. Lo que hay que hacer, por orden

> **Hecho el 10 oct:** 2.1 (commit 8f01a64) y la parte de fuentes del 2.2 (2fa9285).
> Lo siguiente es el **2.3**. Detalle y números de cada punto, debajo.

### 2.1 El `<style>` en línea que bloquea la CSP — ✅ HECHO (8f01a64)

Resuelto: el CSS vive en `public/seo-estatico.css` (clases `seo-libro`, `seo-catalogo`,
`seo-pagina`) y se enlaza desde dentro de `#seo-estatico`. La consola de producción ya sale
limpia, con JS y sin JS. Lo de abajo queda como registro.

- **Síntoma:** en producción, en cada página, la consola enseña *«Applying inline style
  violates the following Content Security Policy directive 'style-src 'self'
  https://fonts.googleapis.com'»* (p. ej. `biblioteca:59`). Desde el 29 sep.
- **Causa:** `generar-seo.mjs` mete bloques `<style>` dentro del HTML (líneas ~174, ~213 y la
  constante `ESTILO_PAGINA`, ~244). La CSP de `vercel.json` no permite estilos en línea.
- **Efecto:** a los usuarios, ninguno (main.jsx borra el bloque). A Google y a quien no
  ejecuta JavaScript: el contenido estático sale sin formato. A Sentry: nada (las
  violaciones de CSP no pasan por `errores.js`).
- **Arreglo propuesto:** sacar ese CSS a un archivo propio (p. ej. `public/seo-estatico.css`)
  enlazado con `<link rel="stylesheet">` desde el HTML generado. **No** relajar la CSP con
  `'unsafe-inline'`.
- **Cómo comprobarlo:** `npm run build` (usa las claves de producción para leer el
  catálogo) y abrir `dist/libro/<slug>/index.html`; luego, tras desplegar, la consola de
  producción sin el error. Herramienta existente: `scripts/verificar-csp.mjs`.

### 2.2 Rendimiento de la portada (LCP móvil)

- **Medido el 1 oct:** LCP móvil de **6,8 s** en la landing (ver la revisión de la landing).
- **Paquete inicial hoy (10 oct, medido en producción):** ~160 kB comprimidos entre
  `index-*.js` (~91 kB), `queries-*.js` (~60 kB, lleva supabase-js y React Query), CSS y
  runtime. La portada no necesita la mayoría: candidatos a carga diferida.
- Medir antes y después (PageSpeed Insights / Lighthouse móvil) y no dar nada por ganado sin
  número.

**Hecho el 10 oct — fuentes propias (2fa9285).** Google Fonts fuera: los mismos `.woff2` en
`public/fonts/` + `src/styles/fuentes.css`, la CSP ya no permite Google. Motivo doble: legal
(IP a Google, LG München I 3 O 17493/20) y el CSS externo bloqueaba el primer pintado.
Producción, Lighthouse móvil: **FCP 3,1 → ~2,2 s**. El LCP no se movió (4,7 s antes; después
entre 3,7 y 6,3 s, mediana 5,0 s: ruido).

**Probado y descartado (no repetir sin una idea nueva):**
- `modulepreload` de los trozos de la landing desde el HTML de `/`: el trozo llega antes,
  pero el LCP no baja.
- Retrasar los mundos 2–5 del portal (~320 kB) hasta el `load`: tampoco.

**Dónde está de verdad el LCP:** la imagen del hero (`img.inm-book`) baja pronto y se pinta
3 s después, porque la pinta React. Antes tienen que bajar y ejecutarse `index` + `queries`
(supabase-js), hacerse `getSession` (App.jsx: `if (!authReady) return Fallback`) y montarse la
landing. Las dos vías reales, las dos de cambio estructural (hablarlas antes):
1. Pintar la landing sin esperar a `getSession` cuando no hay sesión guardada en localStorage.
2. Que el hero forme parte del HTML estático de `/` (generar-seo.mjs) y React lo herede.

**Decisión de Juan (10 oct): medir a los visitantes reales antes de tocar nada.** Desde ese
día PostHog recibe el evento `web_vital` (librería oficial `web-vitals`, en
`src/lib/analytics.js`). Para leerlo: evento `web_vital`, filtros `metrica = LCP` y
`ruta = /`, y el **percentil 75** de `valor`, que es el que usa Google (bueno: ≤ 2500 ms).
`$device_type` separa móvil de escritorio. Revisar al cabo de 1–2 semanas:
- p75 ≤ 2,5 s → no se toca nada.
- Peor → **prerenderizado de la landing** (generar en el build el HTML de la portada con
  el propio React y que el navegador lo «despierte»). Es lo estándar. Lo delicado: la
  landing de móvil o escritorio y el gato elegido se deciden en el navegador.
- La «copia a mano del hero» en el HTML está **descartada** por Juan.

**Cómo medir en laboratorio:** la API de PSI sin clave suele tener la cuota agotada. Lighthouse local con el
Chromium de Playwright: `CHROME_PATH=<playwright chromium> npx lighthouse@12 <url>
--only-categories=performance`. Tres pasadas como mínimo y mirar *qué* elemento es el LCP: a
veces cuenta el bloque estático (1,7 s) y no la imagen.

### 2.3 Search Console

- Revisar el estado de indexación de las fichas de libro desde que existe el HTML estático
  y si el sitemap está enviado.

## 3. Reglas que aplican

- **No tocar el preview de la Tienda** ni la paginación del lector (decisiones de Juan).
- Antes de un cambio estructural, explicar la lógica y esperar el visto bueno; listar los
  archivos que se van a tocar.
- Commits: el hook bloquea de lunes a viernes de 9 a 18 (Berlín). Nunca `--no-verify`.
- `npm run lint`, `npm test` y `npm run humo` en verde antes de cada commit.
