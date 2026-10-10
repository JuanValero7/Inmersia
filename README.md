# Inmersia

Plataforma de lectura inmersiva en español, desplegada en **[www.inmersia.io](https://www.inmersia.io)**.

Convierte cada libro en un mundo para habitar: ilustraciones, sonido ambiente, un tablero
de investigación donde reconstruir la trama, un álbum de barajitas y un foro por libro.

El usuario objetivo es **gente que lee poco y quiere leer más**. Esa frase decide muchas
cosas del código: por qué la accesibilidad importa más de lo normal, por qué el peso del
JavaScript se vigila, y por qué la métrica que interesa es la retención y no el número de
registros.

Todo el catálogo es de dominio público y el acceso es gratuito.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 8 |
| Rutas | react-router-dom 7 |
| Estado de servidor | @tanstack/react-query 5 |
| Backend / Auth / DB | Supabase (Postgres + RLS + Realtime + Storage) |
| Analítica | posthog-js, en modo *cookieless* |
| Errores | @sentry/browser, cargado solo cuando ocurre un error |
| Estilos | CSS propio por vista + estilos inline |
| Clases condicionales | clsx |
| Hosting | Vercel |

No hay Tailwind (se retiró), ni Redux/Zustand (React Query cubre el estado de servidor),
ni TypeScript (ver *Convenciones*).

---

## Arquitectura

### Las tres capas y su frontera

```
   COMPONENTES     ¿cómo se ve?        Lector.jsx, Perfil.jsx, ForoChat.jsx …
   ────────────────────────────────── ← la frontera
   HOOKS           ¿qué datos hay?     19 hooks en src/hooks/
   SUPABASE        dónde viven         src/lib/supabase.js
```

**Solo los hooks deberían cruzar esa línea.** Cuando un componente llama a `supabase`
directamente pasan dos cosas: deja de poder probarse sin simular la red entera, y React
Query no se entera de esa escritura, así que su caché se queda con el dato viejo.

Hoy quedan 14 componentes que se la saltan. Es deuda conocida, no un patrón a imitar.

### El fork desktop / mobile es intencional

Existe `src/components/mobile/` con una versión de casi cada pantalla, más 7 hojas
`*.mobile.css`. Son alrededor del 25% del código, y **es deliberado**.

Según el dispositivo hay que **ordenar los elementos de forma distinta**, no solo
redimensionarlos: en escritorio el Lector es un escritorio de doble página con barras
flotantes; en móvil es una página a pantalla completa con hojas deslizantes. Eso no se
resuelve con media queries.

La regla de qué se bifurca:

| Capa | ¿Se forkea? |
|---|---|
| Wiring de datos (queries, estado de servidor) | **Nunca** |
| Lógica pura (geometría, formateo, cálculos) | **Nunca** |
| Primitivas de UI (estrellas, portadas, skeletons) | **Nunca** — se parametrizan |
| Layout y chrome (orden, hoja vs panel, qué se ve) | **Sí, siempre** |

**El Lector es la plantilla correcta:** `useLectorData` concentra el wiring compartido,
`<Notebook>` se reutiliza tal cual, y encima hay dos cáscaras distintas.

El objetivo no es cero duplicación. Es que las dos cáscaras contengan **solo estructura
JSX y ninguna lógica**.

### El breakpoint son 820 px

Lo decide `src/hooks/useIsMobile.js`, y es el mismo corte que usa `App.jsx` para elegir
qué árbol monta. **No definas otro corte en un componente suelto**: hubo un bug así, con
un `useIsMobile` local a 640 px, que hacía que entre 641 y 820 px la app se creyera móvil
y la Tienda se creyera escritorio dentro de la misma pantalla.

---

## Vistas

| Vista | Ruta | Descripción |
|---|---|---|
| **Landing** | `/` | Portada pública |
| **Auth** | pop-up | Login y registro con carnet de acceso |
| **Tienda** | `/tienda` | Catálogo público, con fachada de calle y panel de detalle |
| **Biblioteca** | `/biblioteca` | Colección personal por categorías, en estanterías |
| **Lector** | `/libro/:slug` | Lector paginado con cuaderno, subrayados y predicciones |
| **Cartelera** | `/investigacion/:slug` | Tablero: personajes, lugares, hechos, datos y notas |
| **Foro** | `/foro/:slug` | Comentarios y chat en tiempo real por libro |
| **Álbum** | `/album` | Barajitas coleccionables y estadísticas |
| **Perfil** | `/perfil` | Carnet de socio, seguridad, legal y descarga de datos |

Los invitados pueden leer los **primeros 10 minutos** de cualquier libro: los primeros párrafos
hasta 2300 palabras (`parrafos.en_muestra`, migración 071). Ese límite lo imponen las políticas
RLS `capitulos_guest_preview` y `parrafos_guest_preview`, no la UI.

---

## Configuración

### 1. Clonar e instalar

```bash
git clone <url-del-repo>
cd inmersia
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

| Variable | Obligatoria | Sin ella |
|---|---|---|
| `VITE_SUPABASE_URL` | sí | la app no arranca |
| `VITE_SUPABASE_ANON_KEY` | sí | la app no arranca |
| `VITE_POSTHOG_KEY` | no | la analítica queda dormida |
| `VITE_POSTHOG_HOST` | no | por defecto `https://eu.i.posthog.com` |
| `VITE_SENTRY_DSN` | no | el reporte de errores queda dormido |

Las claves de Supabase están en tu proyecto → **Settings → API**.

Las tres opcionales siguen el mismo patrón a propósito: **sin la clave, el módulo entero
no hace nada**, para que un repo clonado o una build de prueba no manden datos a ninguna
parte.

### 3. Desarrollo y build

```bash
npm run dev      # servidor de desarrollo
npm run build    # vite build + generación de SEO (ver abajo)
npm run preview  # previsualizar el build
```

`npm run build` necesita las claves de Supabase: el paso de SEO consulta el catálogo. Si
Supabase está caído y hay que desplegar igualmente: `SEO_SKIP=1 npm run build`.

---

## Cómo se cargan los libros

**No hay panel de carga de contenido en la app, y no hace falta construirlo.** El autor
tiene dos scripts externos (ficción y no ficción) que procesan un `.docx` de punta a punta
de forma supervisada y escriben directamente en Supabase.

Esos scripts son hoy la pieza más crítica del proyecto y **no están en este repositorio**.
Conviene versionarlos, aunque sea en un repo privado aparte.

Las migraciones que parecen contenido (`002_mock_principito.sql`,
`044_manual_gato_negro_capitulo.sql`…) eran de prueba.

---

## SEO

Inmersia es un SPA: `vercel.json` reescribe todas las rutas a `index.html`, así que el
`<body>` llega vacío por el cable. Eso rompía el SEO de forma medible — en septiembre de
2026, Search Console reportaba 50 URLs en *«Descubierta: actualmente sin indexar»*.

`scripts/generar-seo.mjs` corre después de `vite build` y, por cada libro visible, escribe
`dist/libro/<slug>/index.html` con:

- las etiquetas `<title>`, `og:` y `twitter:` propias del libro
- un JSON-LD `schema.org/Book` en el `<head>`
- el bloque `<div id="seo-estatico">` relleno con título, portada, sinopsis y **el capítulo
  1 completo**

También reescribe la home y `/tienda` con el catálogo como lista de enlaces, para que
exista un grafo de enlaces internos en el HTML crudo.

`src/main.jsx` retira el bloque estático antes de montar React, así que el usuario solo lo
ve durante la misma ventana en la que antes veía una pantalla en blanco. El JSON-LD va en
el `<head>` y se queda: sobrevive al renderizado.

Vercel sirve estos archivos porque **el sistema de archivos se consulta antes que los
rewrites**. Un libro sin archivo cae al catch-all de siempre: se degrada solo.

---

## Verificación

No hay tests de componentes. La red de seguridad son los tests unitarios de la lógica pura
y los scripts de Playwright.

```bash
npm run lint            # ESLint: 0 errores y no más hex que el tope (ver abajo)
npm test                # 78 tests: paginación, geometría, tokens, edad, anclaje
npm run security-check  # lint + escáner de secretos + npm audit
npm run typecheck       # JSDoc vía tsc (ver jsconfig.json) — hoy no comprueba nada
```

**CI.** `.github/workflows/ci.yml` corre lint, tests, build, el escáner de secretos y
`npm audit` en cada push y cada pull request. No despliega ni bloquea a Vercel: avisa.

**Lint.** La única regla que queda en aviso es la de colores hex en JSX (~500
heredados). `npm run lint` topa ese número con `--max-warnings`: un hex nuevo lo pasa del
tope y falla. Al quitar hex, baja el tope en `package.json`. Las dependencias de los
hooks de React (`exhaustive-deps`) son **error**: si hay que omitir una, va un
`eslint-disable-next-line` con el motivo escrito encima.

**Tipos.** `typecheck` solo revisa los archivos con `// @ts-check` en la primera línea, y
hoy no lo lleva ninguno, así que no comprueba nada (por eso no está en la CI). Activarlo
solo en `src/hooks` y `src/lib` da ~650 errores (medido el 10 oct 2026). El JSDoc de los
hooks sí sirve ya: el editor autocompleta sus props.

| Script | Para qué |
|---|---|
| `scripts/revisar-pantallas.mjs` | Barrido de adaptabilidad en varios anchos, con capturas |
| `scripts/capturar-layout.mjs` | Banco de pruebas de layout sobre `probe.html` |
| `scripts/medir-desborde.mjs` | Detecta desbordes de layout |
| `scripts/verificar-csp.mjs` | Comprueba que la CSP no rompe nada en producción |
| `scripts/generar-seo.mjs` | Fichas por libro y `sitemap.xml` (corre en cada build) |

Los dos primeros necesitan `.env.revision.local` con `INMERSIA_EMAIL` y
`INMERSIA_PASSWORD` de una cuenta real: casi todas las pantallas piden sesión.

### Al comparar capturas, cuidado con lo que se mueve solo

Varias pantallas **cambian entre dos capturas idénticas** sin que nadie toque el código:
el tablero de la Cartelera elige los hilos rojos con `Math.random`, y la Landing y el
Álbum tienen elementos animados. Antes de dar por buena una diferencia de píxeles:

1. Siembra `Math.random` con `addInitScript` para fijar la aleatoriedad.
2. Captura dos veces del **mismo** build y mide ese ruido.
3. Solo lo que supere ese suelo es una diferencia real.

---

## Base de datos

**Copias de seguridad:** el plan gratis de Supabase no las hace. `npm run respaldo`
(cada noche por tarea programada de Windows) guarda la base y los archivos de Storage en
el disco local. Qué guarda, cómo saber si falla y cómo restaurar:
[`Documentation/base-de-datos/copias-de-seguridad.md`](Documentation/base-de-datos/copias-de-seguridad.md).

73 migraciones en `supabase/Migration/`, y la seguridad vive en las políticas RLS: la
autorización de superusuario se comprueba en la propia policy
(`EXISTS (SELECT 1 FROM superusuarios …)`), no solo en la UI.

### ⚠️ De dónde salen las políticas

`supabase/Migration/000_politicas_actuales.sql` es un **retrato con fecha** de producción.
No se ejecuta, y **no se puede convertir en migración**: hay políticas que cambiaron
después y ahí siguen en su versión vieja. Ejecutarlo revertiría, entre otras,
`capitulos_select` y `subrayados_select` a `USING (true)`, que abre el catálogo entero y
los subrayados ajenos.

Para una migración ejecutable se usa siempre el **BLOQUE 1** de
`supabase/exportar-politicas.sql`, que lee el catálogo **vivo** y emite `DROP + CREATE`
idempotente. Eso no puede quedarse viejo.

### Consultas de apoyo

| Archivo | Para qué |
|---|---|
| `supabase/exportar-politicas.sql` | Exportar el estado real de RLS al repo |
| `supabase/consultas/mapa-bd.sql` | Genera `Documentation/mapa-bd.md` (tablas, RLS, Mermaid) |
| `supabase/consultas/cohortes.sql` | Retención por cohortes desde `sesiones_lectura` |

Todas son de solo lectura y se ejecutan a mano en el SQL Editor de Supabase. No hay script
de Node para esto: `pg_class` y `pg_policies` viven en `pg_catalog`, que PostgREST no
expone — devuelve 404 con cualquier clave.

### Por qué las cohortes no salen de PostHog

PostHog está en modo *cookieless* y su hash de identidad rota cada día, así que un lector
que vuelve cuenta como persona nueva cada jornada. **La retención entre días no se puede
medir ahí.** Sí en Supabase, porque `sesiones_lectura` guarda un `user_id` real y estable.

---

## Convenciones

Reglas que ya costó descubrir una vez. Romperlas no da error: da un fallo silencioso.

- **Ningún archivo en `components/` importa `lib/supabase.js`.** Los datos entran por un
  hook. (Excepción viva: `Auth.jsx` y `ResetPassword.jsx` usan `supabase.auth`, que es
  autenticación y no datos.)

- **Ningún hex literal nuevo en `.jsx`.** La paleta está en el bloque `:root` de
  `src/index.css`. ESLint lo marca como aviso mientras escribes.

  `clay.jsx` repite `--ink` y `--accent` como hex **a propósito**: 116 sitios hacen
  `` `${INK}33` `` para pegarle un alfa, y eso con `var(--ink)` produce CSS inválido que
  el navegador descarta sin avisar. `src/index.tokens.test.js` impide que las dos copias
  se separen.

- **El reset del principio de `index.css` no es decorativo, es estructural.** Era el
  Preflight de Tailwind. Todo el CSS del proyecto está escrito dando por hecho
  `box-sizing: border-box`, `body{margin:0}` y `h1-h6` sin tamaño propio. Cambiarlo por
  otro reset obliga a comparar pantalla por pantalla.

- **Un solo breakpoint: 820 px, en `useIsMobile`.** No definas otro en un componente.

- **Desktop y móvil comparten datos y lógica; solo se bifurca el layout.**

- **La geometría de la Cartelera recibe las constantes por parámetro, nunca por clausura.**
  Los dos tableros usan constantes con el mismo nombre y valores distintos (1180×720 frente
  a 860×1000). Si `pinAbs` leyera `MAP` por clausura, el tablero móvil se descolocaría
  entero sin un solo error en consola.

- **Toda política RLS nace del export en vivo, nunca copiando el volcado 000.**

- **`src/utils/lectorPaginationMobile.js` no se refactoriza.** Costó mucho estabilizarlo y
  sus fallos no explotan: mueven el texto de sitio en silencio. Tiene tests de
  caracterización — si fallan, la pregunta es «¿quería cambiar esto?», no «¿qué expectativa
  arreglo?».

- **Sin PropTypes.** `react/prop-types` está desactivada a propósito. Para tipado, JSDoc
  con `// @ts-check` (ver `jsconfig.json`), no TypeScript.

---

## Estructura

```
src/
├── components/
│   ├── Biblioteca.jsx  Lector.jsx  Tienda.jsx  Cartelera.jsx  Foro.jsx
│   ├── Album.jsx  Perfil.jsx  Auth.jsx  NoEncontrada.jsx  ErrorBoundary.jsx
│   ├── album/        (9)   Barajitas, estadísticas, predicciones
│   ├── biblioteca/   (5)   + clay/ (7): estanterías, categorías, portadas
│   ├── cartelera/   (12)   Tableros, zonas, hilos y fichas
│   ├── foro/         (3)   Chat en tiempo real y comentarios
│   ├── landing/      (2)   Datos y escena de la portada
│   ├── lector/       (8)   Notebook, RecorderPlayer, clay (paleta)
│   ├── legal/        (1)   Modal de términos y privacidad
│   ├── onboarding/   (4)   Tutorial guiado por fases
│   ├── tienda/       (6)   CalleEscena, CatalogoInterior, PanelLibro
│   └── mobile/      (13)   Cáscaras móviles + biblioteca/ lector/ tienda/
├── hooks/           (19)   La frontera con Supabase
├── lib/             (12)   supabase, queries, analytics, errores,
│                           carteleraGeometria, edad, misDatos…
├── context/          (2)   authModal, onboarding
├── styles/          (16)   CSS por vista, con su variante .mobile
├── utils/            (3)   Paginación del lector (desktop y móvil), helpers
├── index.css               Reset base + paleta de marca + utilidades
├── App.jsx                 Rutas y estado de sesión
└── main.jsx                Arranque: errores, analítica, render
scripts/                    Verificación y generación (ver Verificación)
supabase/
├── Migration/       (51)   Esquema y políticas
├── consultas/              SQL de apoyo, solo lectura
└── exportar-politicas.sql
Documentation/              Checklists y notas de trabajo
```

---

## Deuda conocida

Cosas pendientes de verdad, para que nadie las descubra otra vez desde cero:

- **14 componentes importan `supabase` directamente**, saltándose la frontera de hooks.
- **89 `<div>`/`<span>` con `onClick`** sin semántica de control: el tabulador no los
  alcanza y un lector de pantalla no los anuncia como pulsables. Pesa más de lo normal
  aquí, porque el público objetivo se solapa con quien navega por teclado.
- **~440 hex literales heredados** en `.jsx`, que se van sustituyendo por pantalla.
- **Tienda:** la paginación del catálogo requiere implementar «Cargar más» antes de poder
  usar `.limit()` en la query de libros.
- **Perfil → Transacciones e Historial:** UI preparada, sin tablas detrás.
- **Perfil → Foto de perfil:** falta subirla a Supabase Storage.
- Revisión de arquitectura completa, con hoja de ruta:
  [`Documentation/arquitectura/`](Documentation/arquitectura/).
