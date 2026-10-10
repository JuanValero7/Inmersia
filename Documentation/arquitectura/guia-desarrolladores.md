# Inmersia — Guía para desarrolladores

Para quien llega al proyecto: cómo está montado, cómo viaja un dato desde la base hasta
la pantalla, dónde va cada cosa nueva y qué partes conviene no tocar sin entenderlas
antes.

Escrita el 10 oct 2026, junto con la
[revisión de arquitectura](revision-arquitectura-2026-10-10.md), que lista lo que está
pendiente de mejorar. Esta guía describe **cómo es el sistema hoy**, no cómo debería ser.

---

## 1. Qué es y qué lo condiciona

Inmersia es una plataforma de lectura inmersiva en español (**www.inmersia.io**). Cada
libro de dominio público llega con ilustraciones, sonido ambiente, un tablero de
investigación (la *Cartelera*), un álbum de barajitas, un foro y comunidades de lectura.
Todo es gratis.

Tres ideas condicionan casi todas las decisiones del código:

1. **El usuario objetivo es gente que lee poco y quiere leer más.** Por eso importan
   tanto el peso de la app (se lee en el metro), la accesibilidad, evitar spoilers y que
   el progreso no se pierda nunca.
2. **El libro manda.** Inmersia es ante todo la casa de la obra. La calidad y el cuidado
   pesan más que ir rápido o monetizar.
3. **Privacidad por defecto.** El responsable legal está en Alemania (RGPD + derecho
   alemán). Nada de cookies de seguimiento, nada de grabar lo que el usuario lee o escribe.

---

## 2. El sistema de un vistazo

```
                   ┌──────────────────────────────── Vercel ───────────────────────────────┐
  navegador  ───►  │  index.html + JS (React SPA)      dist/libro/<slug>/index.html        │
                   │  cabeceras de seguridad (CSP)     (HTML estático para SEO, por libro) │
                   └───────────────┬────────────────────────────────────────────────────────┘
                                   │ supabase-js (clave pública + sesión del usuario)
                   ┌───────────────▼─────────────────── Supabase ───────────────────────────┐
                   │  Auth (email + Google)    Postgres + RLS (35 tablas)    Storage (img,  │
                   │  Realtime (chat, sala)    funciones SQL / triggers      audio)         │
                   └───────────────▲────────────────────────────────────────────────────────┘
                                   │ escriben libros, capítulos, párrafos, fichas, medios
                   ┌───────────────┴──────────────┐
                   │  Pipeline de contenido       │   scripts Python FUERA de este repo:
                   │  (.docx → libro completo)    │   orquestadores, imágenes, cartelera
                   └──────────────────────────────┘

  Laterales:  PostHog (analítica sin cookies, carga diferida)   Sentry (solo al primer error)
```

- **No hay backend propio.** El navegador habla directamente con Supabase. La seguridad
  la ponen las **políticas RLS** de Postgres: cada tabla decide qué filas puede leer o
  escribir cada usuario.
- **No hay panel de administración de contenido.** Los libros se cargan con scripts
  externos, supervisados por el autor, que escriben directamente en Supabase.
- **La lógica compleja de servidor** (comunidades, denuncias, borrar cuenta, purgas)
  son funciones SQL y triggers en la base.

---

## 3. Stack

| Capa | Tecnología | Notas |
|---|---|---|
| UI | React 18 + Vite 8 | JavaScript con JSDoc, sin TypeScript |
| Rutas | react-router-dom 7 | `BrowserRouter`, rutas en `App.jsx` |
| Datos del servidor | @tanstack/react-query 5 | Solo en parte de la app (ver §7) |
| Backend | Supabase | Postgres, Auth, Realtime, Storage |
| Estilos | CSS por pantalla + estilos en línea | Paleta en `:root` de `src/index.css` |
| Analítica | posthog-js | Sin cookies, se carga después del primer pintado |
| Errores | @sentry/browser | Se descarga solo cuando ocurre un error |
| Tests | Vitest (lógica pura), Playwright (scripts de revisión) | |
| Hosting | Vercel | Cada push a `main` despliega |

---

## 4. Ponerlo en marcha

```bash
npm install
cp .env.example .env.local        # rellenar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

**Dos proyectos de Supabase.** `npm run dev` va contra **`inmersia-pruebas`**: Vite carga
`.env.development.local` solo en desarrollo y por encima de `.env.local`. El build,
Vercel, las copias de seguridad y el SEO siguen en **producción** (`.env.local`).

| | Pruebas (`inmersia-pruebas`) | Producción |
|---|---|---|
| Estructura | Igual que producción: tablas, RLS, funciones, triggers, cron, Realtime | — |
| Contenido | Los libros, capítulos, párrafos, fichas, medios y salas reales | — |
| Usuarios | **Ninguno**: perfiles, progreso, cuadernos y comunidades vacíos | Los reales |
| Imágenes y sonidos | No se copian: las filas apuntan a las URLs de producción (públicas). Así no se gasta el GB de Storage del plan gratis | Los reales |
| Analítica y errores | Apagados (`VITE_POSTHOG_KEY` y `VITE_SENTRY_DSN` vacíos) | Encendidos |

Para pedir un `.env.development.local`, habla con Juan: lleva la contraseña de la base de
pruebas. Una migración nueva se aplica **primero en pruebas** y se comprueba con
`npm run dev`; solo después en producción, con una copia de seguridad recién hecha
(`npm run respaldo`). Cómo se rellenó pruebas, y cómo volver a hacerlo:
`Documentation/base-de-datos/copias-de-seguridad.md`, sección «Ensayo».

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `vite build` + `scripts/generar-seo.mjs` (necesita las claves; `SEO_SKIP=1` lo salta) |
| `npm test` | Tests unitarios (78) |
| `npm run security-check` | ESLint + escáner de secretos + `npm audit` |
| `npm run esquema` | Vuelca la estructura de la base a `supabase/esquema/` (necesita `pg_dump`) |

Las variables opcionales (`VITE_POSTHOG_KEY`, `VITE_SENTRY_DSN`) siguen la regla de
"sin clave no hace nada": un clon del repo no envía datos a ninguna parte.

**Horario de commits:** hay un hook local de `pre-commit` que bloquea commits de lunes a
viernes de 9:00 a 18:00 (hora de Berlín). Es una decisión personal del autor, no un fallo.

---

## 5. Estructura de carpetas

```
src/
├── main.jsx              Arranque: Sentry y PostHog en espera, retira el HTML de SEO, monta React
├── App.jsx               Sesión, rutas, y algunos flujos (adquirir libro tras registrarse)
├── index.css             Reset base (ex-Preflight de Tailwind) + paleta de marca en :root
│
├── components/           Pantallas y piezas de UI
│   ├── Lector.jsx  Biblioteca.jsx  Tienda.jsx  Cartelera.jsx  Foro.jsx  Album.jsx  Perfil.jsx  Landing.jsx
│   ├── mobile/           La versión móvil de cada pantalla (misma lógica, otra maquetación)
│   ├── lector/           BookReader, Notebook (cuaderno), reproductores, panel de superusuario
│   ├── cartelera/        Tableros: personajes, lugares, hechos, datos, notas
│   ├── tienda/           Calle, catálogo, salas, ficha de libro, historia (stories)
│   ├── biblioteca/       Estanterías, portadas, categorías (clay/ = estilo plastilina)
│   ├── album/            Barajitas, estadísticas
│   ├── comunidades/      Panel, menú "Leer como", denuncias; capa/ = la comunidad dentro del lector
│   ├── foro/             Comentarios y chat en tiempo real
│   ├── onboarding/       Tutorial guiado y pistas de primera vez
│   ├── landing/          Escena animada de la portada
│   └── legal/            Páginas legales (renderizan Markdown)
│
├── hooks/                Datos y comportamiento reutilizable (29). La frontera con Supabase
├── lib/                  Infraestructura: cliente Supabase, queries compartidas, analítica,
│                         errores, edad, imágenes, geometría de la Cartelera
├── context/              authModal (abrir login), onboarding (tutorial), pistas (primera vez)
├── utils/                Funciones puras: paginación del lector, formato, estantería
├── styles/               Un CSS por pantalla y su variante .mobile.css
└── content/              Textos largos (página "Sobre")

scripts/                  generar-seo.mjs (build) + herramientas de revisión con Playwright
supabase/Migration/       Migraciones SQL numeradas (se aplican a mano, ver §10)
supabase/consultas/       SQL de solo lectura: mapa de la base, cohortes de retención
Documentation/            Revisiones, planes por pantalla, documentos legales
public/                   Iconos, imágenes de la landing, sonidos, robots.txt
```

---

## 6. Las capas y sus reglas

```
   COMPONENTES      ¿cómo se ve?           components/**
   ─────────────────────────────────────── ← frontera
   HOOKS            ¿qué datos hay?        hooks/**, lib/queries.js
   SUPABASE         ¿dónde viven?          lib/supabase.js  →  Postgres + RLS
```

**Regla 1. Solo los hooks hablan con Supabase.** Un componente que llama a `supabase`
directamente no se puede probar sin la red, y React Query no se entera de sus escrituras.
*Hoy hay 13 archivos que se la saltan (deuda conocida): no los tomes como ejemplo.*

**Regla 2. Escritorio y móvil comparten datos y lógica; solo se bifurca la maquetación.**
En móvil las pantallas no se encogen: se reordenan (hojas deslizantes en vez de paneles,
una página en vez de dos). Por eso hay dos árboles de componentes, `components/X.jsx` y
`components/mobile/XMobile.jsx`. Lo que **nunca** se duplica: consultas, cálculos,
primitivas de UI (portadas, estrellas). *Ojo: el Lector la incumple hoy (revisión, A4).*

**Regla 3. Un único corte: 820 px**, en `hooks/useIsMobile.js`. `App.jsx` lo usa para
elegir qué árbol montar. Mientras se lee, el tipo de lector queda fijo aunque el ancho
cruce el corte (al rotar un móvil grande), para no perder la posición.

**Regla 4. Colores desde la paleta** (`:root` en `src/index.css`). ESLint avisa de cada
hex nuevo. Excepción documentada: `components/lector/clay.jsx` repite dos colores en hex
para poder añadirles transparencia; un test (`src/index.tokens.test.js`) vigila que no se
separen de la paleta.

**Regla 5. La autoridad es la base, no la UI.** Si algo debe estar prohibido (leer más
allá de la muestra, pasar de 5 comunidades), lo impide una política RLS o un trigger. La
UI solo lo refleja para dar un buen mensaje. *Algunas reglas aún no cumplen esto:
revisión, A3.*

---

## 7. Datos y caché

### Dos patrones conviven

- **React Query** (el bueno): `lib/queries.js` define las claves (`queryKeys`) y las
  consultas compartidas: perfil, catálogo, biblioteca del usuario, salas, resúmenes de
  libro, repaso. También lo usan `useComunidades`, `useCapaComunidad`, `useDenuncias` y
  `usePerfilData`. Dos pantallas que piden lo mismo comparten una sola petición y la
  caché dura 60 s.
- **`useState` + `useEffect` a mano**: Álbum, Cartelera, Foro, reseñas, estadísticas,
  cuaderno y Lector. Cada uno gestiona su carga y sus errores.

**Para código nuevo, usa React Query** con una clave en `queryKeys`. Tras escribir,
invalida la clave afectada (`useInvalidateBibliotecaUsuario` es el ejemplo).

### Dónde vive cada tipo de estado

| Estado | Dónde |
|---|---|
| Qué libro / qué pantalla | La URL (`/libro/:slug`, `/investigacion/:slug`…) |
| El libro ya cargado, de dónde vengo | `location.state` de React Router (`{ book, from }`): evita volver a pedirlo y alimenta el botón "atrás" de la app |
| Sesión del usuario | `useState` en `App.jsx`, pasado por props |
| Datos del servidor | Caché de React Query, o estado local del hook |
| Preferencias de lectura (letra, tema) | `localStorage` (`useLocalStorage`) |
| Preferencias que siguen al usuario | Tabla `preferencias_usuario` (últimos libros, color del gato, pistas vistas, comunidad activa) |
| Tutorial | `perfiles.onboarding_completado` + contexto `onboarding` |
| Lo que leyó un invitado | Variable de módulo en `lib/progresoInvitado.js` (sobrevive al desmontar el lector) |

---

## 8. Recorrido completo: abrir un libro

El flujo más importante de la app y el que más piezas toca.

```
Usuario pulsa un libro en la Biblioteca
  │
  ▼
App.handleOpenBook(book)
  ├─ pushBookId → preferencias_usuario.ultimos_libros   ("Seguir leyendo")
  └─ navigate('/libro/<slug>', { state: { book } })
  │
  ▼
<LectorRoute>                                    components/LectorRoute.jsx
  ├─ ¿el state trae el libro de esta URL? → sí: lo usa · no: lo pide por slug
  ├─ ¿está en su biblioteca? (useBibliotecaUsuarioQuery, ya en caché)
  │     no, o sin sesión → guestMode = true (modo muestra)
  └─ monta <Lector> (escritorio) o <LectorMobile> según useIsMobile
  │
  ▼
<Lector> / <LectorMobile>
  ├─ useLectorData(book, …, guestMode)           hooks/useLectorData.js
  │    ├─ capítulos + progreso_lectura en paralelo → restaura capítulo y párrafo
  │    ├─ fetchChapter: párrafos (en muestra: solo en_muestra) → pinta
  │    │                media_por_parrafo (sonidos, imágenes) → llega después
  │    ├─ precarga el capítulo siguiente en un momento ocioso
  │    └─ subrayados, reseña, operaciones de superusuario
  ├─ paginación: utils/lectorPagination.js (escritorio) · lectorPaginationMobile.js (móvil)
  ├─ useSesionLectura → sesiones_lectura (tiempo activo, cada ~60 s)
  ├─ al pasar página (600 ms de pausa) → progreso_lectura.ultimo_parrafo_id + offset
  └─ al cerrar el cuaderno tras un capítulo → progreso_lectura.porcentaje (+ leído si ≥ 90 %)
```

**La muestra de invitados** (primeros ~10 minutos = 2.300 palabras) la marca la base con
`parrafos.en_muestra` (triggers de la migración 071) y la imponen las políticas RLS
`capitulos_guest_preview` y `parrafos_guest_preview`. El cliente filtra por la misma
columna solo para el superusuario, al que la RLS deja ver todo.

**Si el invitado se registra** desde el aviso del final de la muestra, `App.jsx`
(`acquireBookAfterAuth` + `rescatarMuestra`) añade el libro a su biblioteca y crea su
progreso donde se quedó.

---

## 9. Modelo de datos

35 tablas, **todas con RLS activado**, y 6 vistas. Agrupadas por dominio:

| Dominio | Tablas | Quién escribe |
|---|---|---|
| **Contenido** | `libros`, `capitulos`, `parrafos`, `biblioteca_media`, `elementos_interactivos` (párrafo ↔ medio), `libro_reels` (escenas del avance) | Pipeline externo; superusuario desde el lector |
| **Investigación** | `cartelera_items` (fichas por capítulo), `cartelera_principal` | Pipeline externo |
| **Tienda** | `salas`, `sala_libros` | A mano / migraciones |
| **Usuario** | `perfiles`, `preferencias_usuario`, `categorias_usuario`, `bibliotecas_usuarios` (libros adquiridos) | El propio usuario |
| **Lectura** | `progreso_lectura`, `sesiones_lectura`, `subrayados_usuario`, `anotaciones_usuario`, `predicciones_usuario`, `resenas_libros`, `album_barajitas_pegadas` | El propio usuario |
| **Social** | `foros`, `foros_comentarios`, `chat_sesiones`, `chat_mensajes`, `chat_historial`, `comentarios_lectura`, `mensajitos` | Usuarios con sesión (16+ para el chat) |
| **Comunidades** | `comunidades`, `comunidad_miembros`, `comunidad_codigos`, `comunidad_lecturas`, `creadores_comunidad` | Mediante funciones SQL (`crear_comunidad`, `unirse_con_codigo`) |
| **Moderación** | `denuncias`, `superusuarios` | Usuarios denuncian; moderación resuelve con `resolver_denuncia` |

Vistas: `libros_resumen` (cifras de cada libro para la ficha), `media_por_parrafo`
(medios de un capítulo, para el lector), `album_imagenes`, `elementos_con_contexto`,
`subrayados_populares`, `perfiles_publicos`.

Para un mapa completo con relaciones: `supabase/consultas/mapa-bd.sql` genera
`Documentation/mapa-bd.md` con un diagrama Mermaid.

### Roles

| Rol | Qué puede |
|---|---|
| `anon` (invitado) | Catálogo y la muestra de cada libro |
| `authenticated` | Sus libros completos, sus datos, foro; chat y comunidades según edad |
| superusuario | Fila en `superusuarios`. Lo comprueban las propias políticas (`EXISTS …`) y la función `es_superusuario()`. Ve todos los libros completos y puede editar medios y párrafos desde el lector |

---

## 10. Base de datos: migraciones y políticas

- **Copias de seguridad:** cada noche, en el ordenador de Juan, con `npm run respaldo`
  (ver `Documentation/base-de-datos/copias-de-seguridad.md`). Antes de aplicar una
  migración, lanza una a mano.
- Las migraciones están en `supabase/Migration/NNN_descripcion.sql` y **se ejecutan a
  mano** en el SQL Editor de Supabase. La base no guarda registro de cuáles se aplicaron:
  pregunta antes de asumir que una está aplicada.
- ⚠️ **`000_politicas_actuales.sql` no se ejecuta nunca.** Es una foto vieja: aplicarla
  reabriría políticas que se cerraron después. Para escribir una política nueva, parte del
  **BLOQUE 1 de `supabase/exportar-politicas.sql`**, que lee el estado real.
- En el SQL Editor, `auth.uid()` es `NULL` (corre como `postgres`): las comprobaciones que
  dependan del usuario hay que probarlas desde la app.
- Las funciones `SECURITY DEFINER` llevan `SET search_path = public` y se les quita
  `EXECUTE` a `anon` cuando no lo necesita (migración 072).

---

## 11. Despliegue y SEO

1. Push a `main` → Vercel ejecuta `npm run build`.
2. `vite build` genera la app en `dist/`.
3. `scripts/generar-seo.mjs` consulta el catálogo y escribe `dist/libro/<slug>/index.html`
   por libro (título, Open Graph, JSON-LD `Book`, sinopsis y **capítulo 1 completo**),
   reescribe la portada y `/tienda` con enlaces a todos los libros, y genera
   `sitemap.xml`.
4. Vercel sirve primero los archivos que existen y, si no hay, cae al `index.html`
   (`vercel.json`). Un libro sin su HTML funciona igual: solo pierde el SEO.
5. `src/main.jsx` borra el bloque `#seo-estatico` antes de montar React.

Cuando el pipeline carga un libro nuevo, dispara un redespliegue para que salga su página.

**Cabeceras de seguridad** (`vercel.json`): la CSP solo permite scripts propios y de
PostHog, imágenes y medios de Supabase, y conexiones a Supabase, PostHog y Sentry.
**Si añades un servicio externo, hay que añadirlo a la CSP**, o el navegador lo bloqueará
sin avisar. `scripts/verificar-csp.mjs` lo comprueba contra producción.

---

## 12. Observabilidad

| Qué | Dónde | Notas |
|---|---|---|
| Errores que rompen la app | Sentry | Oyentes globales + `ErrorBoundary`. El SDK se descarga al primer error |
| Uso del producto | PostHog | `evento('nombre', {props})` de `lib/analytics.js`. Sin cookies: la identidad rota cada día |
| Retención entre días | SQL: `supabase/consultas/cohortes.sql` | Sale de `sesiones_lectura`, no de PostHog |
| Fallos al guardar en la base | Sentry + aviso al lector | Las escrituras importantes pasan por `guardar()` de `lib/guardar.js` (ver abajo) |

---

## 13. Recetas

### Añadir una pantalla
1. Componente en `components/` y, si la maquetación móvil es distinta,
   `components/mobile/XMobile.jsx`.
2. La lógica y los datos, en un hook `hooks/useX.js` que usen las dos versiones.
3. La ruta en `App.jsx` con `lazy(() => import(...))`. Si requiere sesión, dentro de
   `<ProtectedRoute>`.
4. Estilos en `styles/x.css` y `styles/x.mobile.css`, con colores de la paleta.

### Añadir una consulta
1. Clave nueva en `queryKeys` (`lib/queries.js`).
2. `useQuery` en un hook, con `enabled` si depende de un id.
3. Si lo pide más de una pantalla, la función va en `lib/queries.js`.

### Cambiar la base
1. Nueva migración con el siguiente número libre, con cabecera de PROBLEMA / SOLUCIÓN /
   QUÉ NO CAMBIA, como las existentes.
2. Si toca políticas: parte del export en vivo (§10).
3. Si añade una regla de negocio, que la imponga la base (trigger o función) y devuelva un
   `HINT` que el cliente traduzca a un mensaje, como en `useComunidades.js`.

### Guardar algo que el lector no debe perder
```js
import { guardar, AVISOS } from '../lib/guardar.js'
const { ok } = await guardar(supabase.from('tabla').upsert(…), { que: 'nombre corto', aviso: AVISOS.progreso })
```
Si falla por un fallo nuestro (RLS, restricción, columna), va a Sentry; si es falta de red, no.
Con `aviso`, `<AvisoGuardado>` se lo dice al lector (una vez cada 30 s como mucho). Para
varias escrituras que van juntas, `guardarTodo([...])`. Los textos viven en `AVISOS`.

### Medir un evento de producto
`evento('libro_comprado', { libro_id })` desde `lib/analytics.js`. Nada de texto del
usuario en las propiedades.

---

## 14. Zonas delicadas

| Archivo / tema | Por qué |
|---|---|
| `utils/lectorPaginationMobile.js` | **No se refactoriza.** Sus fallos no dan error: mueven el texto de sitio. Tiene tests de caracterización: si fallan, la pregunta es "¿quería cambiar esto?" |
| `supabase/Migration/000_politicas_actuales.sql` | No ejecutar nunca (§10) |
| `lib/ensureProfile.js` y `onAuthStateChange` | Llamar a Supabase dentro del callback de auth produce un bloqueo mutuo: por eso va en `setTimeout(0)`. Tras editar este archivo o los contextos, reinicia el servidor de desarrollo: la recarga en caliente deja un estado falso de "login roto" |
| `progreso_lectura.porcentaje` | Hoy se calcula de formas distintas según quién escriba (revisión, M5). Desbloquea fichas de la Cartelera: un valor inflado destapa spoilers |
| Reset de `index.css` | Es estructural (todo el CSS asume `border-box` y títulos sin tamaño). Cambiarlo obliga a revisar pantalla por pantalla |
| Geometría de la Cartelera | Las constantes van por parámetro, nunca por clausura: escritorio y móvil usan nombres iguales con valores distintos |
| Capturas comparadas | La Cartelera elige hilos con `Math.random` y la landing está animada: fija la aleatoriedad antes de comparar píxeles |

---

## 15. Glosario

| Término | Qué es |
|---|---|
| **Muestra** | Los primeros ~10 minutos de cada libro, legibles sin cuenta o sin tener el libro |
| **Manual del Explorador** | Libro tutorial que todos tienen (`MANUAL_LIBRO_ID`). No cuenta para "Seguir leyendo" ni para el límite de pendientes |
| **Pendientes** | Libros adquiridos sin terminar. Máximo 5 (decisión de producto: una pila de 40 libros sin empezar da culpa, no ganas) |
| **Cartelera / Investigación** | Tablero por libro con fichas (personajes, lugares, hechos, datos) que se desbloquean al avanzar capítulos |
| **Barajitas / Álbum** | Cromos coleccionables con las imágenes de cada libro |
| **Salas** | Secciones temáticas de la Tienda |
| **Reels / Historia** | Escenas ilustradas con audio que presentan un libro, en formato stories |
| **Capa de comunidad** | La comunidad dentro del lector: comentarios por capítulo y "mensajitos" |
| **Pistas** | Carteles de primera vez que presentan cada función sin bloquear |
| **El gato** | Mascota guía. El usuario elige color (negro, blanco, naranja); abre la bandeja de herramientas en el lector móvil |
| **Superusuario** | Cuenta de edición: ve todo y ajusta sonidos e imágenes desde el lector |
| **Clay** | El estilo visual "plastilina" de Biblioteca y Lector |

---

## 16. Más documentación

- [`README.md`](../../README.md): visión general y convenciones (algunas cifras desactualizadas).
- [`revision-arquitectura-2026-10-10.md`](revision-arquitectura-2026-10-10.md): fortalezas, fallos y hoja de ruta.
- [`_mapa_dependencias.md`](../_mapa_dependencias.md): quién monta a quién, pantalla por pantalla.
- `Documentation/tienda/`, `cartelera/`, `lector/`, `biblioteca/`, `landing/`: planes y decisiones por pantalla.
- `Documentation/base-de-datos/`: respaldo de la estructura.
- `politica-de-privacidad.md`, `terminos-y-condiciones.md`, `impressum.md`: textos legales que el código tiene que cumplir.
