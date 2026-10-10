# Revisión de diseño y arquitectura — 10 oct 2026

Revisión completa del código de Inmersia (`src/`, `scripts/`, configuración) y de la
estructura de la base de datos en producción (tablas, políticas RLS, triggers, vistas;
**sin leer datos de usuarios**). Se mide contra las prácticas actuales para una aplicación
React + Supabase de este tamaño (~35.000 líneas en `src`, 35 tablas, 73 migraciones).

No es una revisión de bugs línea a línea (eso fueron las del
[12 jul](../revision-codigo-2026-07-12.md) y el [31 ago](../estado-revision-2026-08-31.md)).
Aquí la pregunta es otra: **¿está organizado el código de forma que se pueda mantener,
crecer y entregar a otra persona sin miedo?**

Esta fase fue de solo lectura: no se cambió nada del código.

---

## Resumen en un minuto

**El veredicto:** Inmersia está por encima de la media de un proyecto de una sola persona
en tres cosas que suelen fallar: **seguridad en la base de datos, privacidad y
documentación del porqué**. Los problemas no están en el diseño de la app, sino en
**lo que la rodea**: un único entorno (se desarrolla contra producción), nada que
compruebe automáticamente un cambio antes de publicarlo, y varias reglas de negocio que
solo se cumplen si el navegador colabora.

Dentro del código, el problema principal es **la duplicación**: el lector de escritorio y
el de móvil tienen la misma lógica copiada, y conviven dos formas distintas de pedir datos.
Cada arreglo hay que hacerlo dos veces, y a veces solo se hace una.

| | Cuántos | Lo más importante |
|---|---|---|
| Fortalezas | 8 | RLS en las 35 tablas, privacidad por diseño, comentarios que explican el porqué |
| 🔴 Alta | 4 | Desarrollo contra producción · sin CI · reglas solo en el navegador · lector duplicado |
| 🟠 Media | 8 | Dos patrones de datos · errores silenciosos · `porcentaje` con tres significados · Vite 5 |
| 🟡 Baja | 7 | Accesibilidad · tests de flujos · documentación desfasada · scripts de carga fuera del repo |

**Escala de esfuerzo** usada abajo: **S** = menos de un día · **M** = 2 a 5 días ·
**L** = más de una semana, se hace por partes.

---

## Fortalezas

Las cosas que un desarrollador nuevo debería **conservar**, no "modernizar".

### F1. Los comentarios explican el porqué, con datos medidos
Casi cada decisión no obvia lleva un comentario que cuenta qué se probó, qué falló y por qué
se eligió lo que hay (ej. `src/lib/errores.js`, `src/App.jsx:164-171`,
`scripts/generar-seo.mjs`). Muchos citan mediciones reales ("12.000 avisos", "~85 ms",
"Search Console el 18-09"). Es lo más valioso del repositorio para quien llegue nuevo:
evita deshacer decisiones que costó tomar.

### F2. La seguridad vive en la base de datos, no en la pantalla
Las **35 tablas tienen RLS activado**. Lo que puede leer un invitado (los primeros 10
minutos de cada libro) lo deciden las políticas `capitulos_guest_preview` y
`parrafos_guest_preview`, no la interfaz. El superusuario se comprueba dentro de la propia
política. Las operaciones delicadas (borrar cuenta, unirse a comunidad, resolver denuncias)
son funciones en la base (`eliminar_mi_cuenta`, `unirse_con_codigo`, `resolver_denuncia`).
Es la arquitectura correcta para Supabase.

### F3. Comunidades es el patrón de referencia
`src/hooks/useComunidades.js` + migraciones 051–057 hacen todo bien a la vez: el tope de
5 comunidades lo impone un **trigger en la base** (no solo el botón), los errores llegan
con un código (`hint`) que la app traduce a un mensaje humano, y los datos pasan por React
Query con claves compartidas. **Es el modelo a copiar** para el resto de la app (ver A3).

### F4. Privacidad por diseño
PostHog sin cookies y sin captura automática (no graba el texto de los libros ni el
cuaderno), Sentry sin datos personales y sin grabación de sesiones, y los dos módulos se
quedan dormidos si falta su clave: un repo clonado no manda nada a ninguna parte. Purgas
automáticas (chat a 90 días, denuncias resueltas), descarga de datos (RGPD art. 20) y
borrado de cuenta.

### F5. Rendimiento cuidado
Cada pantalla se descarga solo cuando se visita (`lazy` por ruta, y por separado escritorio
y móvil). Sentry (~154 kB) y PostHog no entran en la primera carga. El lector se precarga en
un momento ocioso, **salvo** con ahorro de datos o 2G. Las consultas independientes van en
paralelo, y el capítulo siguiente se pide antes de llegar a él.

### F6. Reglas de convivencia escritas
El README fija reglas claras: un único corte entre móvil y escritorio (820 px), qué se puede
duplicar entre escritorio y móvil y qué no, nada de colores sueltos. Hay **tests de
caracterización** para la paginación móvil, la parte más frágil, que protegen el
comportamiento actual en vez de un ideal. Y un test que impide que las dos copias de la
paleta se separen.

### F7. SEO resuelto en el momento de construir la app
`scripts/generar-seo.mjs` genera en cada despliegue una página estática por libro, con el
capítulo 1 y datos estructurados de schema.org. Si falla, Vercel mantiene la versión
anterior (nunca rompe el sitio), y si un libro no tiene su página, la app sigue funcionando
igual. Además, buenas cabeceras de seguridad: política de contenido (CSP), HSTS y
protección contra incrustación.

### F8. Pocas piezas y todas estándar
React, React Router, React Query y Supabase. Sin Redux, sin frameworks de estilos, sin
capas exóticas. Cualquier desarrollador React lo reconoce en una tarde.

---

## Fallos

Ordenados por gravedad. Cada uno dice qué pasa, por qué importa y qué haría yo.

### 🔴 A1. Un solo entorno: se desarrolla contra la base de producción
**Qué pasa.** `.env.local` apunta al mismo proyecto de Supabase que la web pública. Las
migraciones se pegan a mano en el editor SQL: la base **no tiene registro** de cuáles se
aplicaron (`list_migrations` devuelve vacío). La numeración tiene huecos y repeticiones
(dos `002_`, falta la `034`), hay migraciones escritas y sin aplicar (la 072), y la `000`
es una foto vieja que no se puede ejecutar.

**Por qué importa.** Cualquier prueba en desarrollo (crear una cuenta, borrar un párrafo
como superusuario, probar una migración) ocurre **sobre los lectores reales**. Y no hay forma
de reconstruir la base desde cero: un socio que llegue no puede montarse una copia propia
para trabajar sin tocar producción. Es el riesgo más alto del proyecto, aunque hoy no haya
dado problemas.

**Qué haría.**
1. Un segundo proyecto de Supabase (gratis) como **entorno de pruebas**, o la base local
   de la CLI de Supabase (`supabase start`).
2. Una **migración de partida** sacada del esquema actual (`npm run esquema` ya está
   preparado; falta instalar `pg_dump`). A partir de ahí, las migraciones se aplican con
   `supabase db push`, que sí deja registro.
3. `.env.local` apuntando al entorno de pruebas; producción solo en Vercel.

**Esfuerzo:** M.

### 🔴 A2. Nada comprueba un cambio antes de publicarlo
**Qué pasa.** Cada `push` a `main` se publica directamente en Vercel. Los 78 tests, el
linter y la comprobación de tipos solo corren si alguien se acuerda de lanzarlos a mano.
No hay CI (no existe `.github/`). Además, `npm run typecheck` **no comprueba ningún
archivo**: solo revisa los que llevan `// @ts-check`, y hoy no lo lleva ninguno (el README
dice lo contrario). `npm run security-check` falla siempre por `npm audit` (ver M6).

**Por qué importa.** Un error que rompa el lector llega a los lectores en el mismo minuto,
sin que nada haya avisado antes. Con dos personas trabajando el riesgo se multiplica,
porque nadie sabe qué comprobó el otro.

**Qué haría.** Un flujo de GitHub Actions que en cada `push` y cada pull request ejecute
`eslint` (solo errores), `vitest` y `vite build`. Activar en Vercel las **previsualizaciones**
por rama para probar antes de fusionar con `main`. Corregir la frase del README sobre el
tipado, o añadir `// @ts-check` a `src/hooks` y `src/lib`, que ya tienen JSDoc.

**Esfuerzo:** S.

### 🔴 A3. Reglas de negocio que solo se cumplen si el navegador colabora
**Qué pasa.** Varias reglas viven solo en el código de la app, sin respaldo en la base:

| Regla | Dónde está | En la base |
|---|---|---|
| Máx. 5 lecturas pendientes | `useCompraLibro.js` y, repetida, `App.jsx:348` | La política de INSERT de `bibliotecas_usuarios` solo comprueba `user_id` |
| Crear perfil + Manual al registrarse | `lib/ensureProfile.js`, desde el navegador | No hay trigger sobre `auth.users` |
| Adquirir un libro tras registrarse y recuperar la muestra | `App.jsx:92-128` y `323-361`: 4-5 escrituras seguidas | Nada las agrupa: si la red falla a mitad, queda a medias |
| Marcar un libro como leído | 3 sitios: `useLectorData`, `Lector.jsx`, `LectorMobile.jsx` | — |
| No mostrar fichas de la Cartelera de capítulos no leídos | Filtro en el cliente | `cartelera_items` es `USING (true)` para cualquier sesión |

La clave pública de Supabase va siempre dentro de la app (es lo normal), así que cualquiera
puede llamar a la base saltándose la interfaz.

**Por qué importa.** Hoy, siendo todo gratis, saltarse el límite de 5 no hace daño real.
El problema es **la consistencia**: si el navegador se cierra o pierde la red entre dos
escrituras, el usuario queda con un perfil sin Manual, o un libro adquirido sin su
progreso. Y en cuanto algo tenga valor (un libro de pago, una insignia, un ranking), la
regla habrá que moverla igualmente. Comunidades (F3) ya demuestra cómo hacerlo bien.

**Qué haría.**
- Trigger `on auth.users insert` que cree el perfil y el Manual (patrón estándar de
  Supabase). `ensureProfile` queda solo como red de seguridad.
- Una función `adquirir_libro(libro_id, muestra_caps)` que compruebe el límite, inserte y
  rescate la muestra **en una sola transacción**. La Tienda y `App.jsx` llaman a esa misma
  función.
- Para los spoilers: decidir si basta con el filtro de la app (es contenido de dominio
  público) o se protege en la base con una función que devuelva solo lo desbloqueado. Si
  se decide que basta, dejarlo escrito como decisión tomada.

**Esfuerzo:** M.

### 🔴 A4. El lector de escritorio y el de móvil tienen la lógica copiada
**Qué pasa.** El README dice que las dos versiones solo deben diferir en la maquetación, y
pone el lector como ejemplo de cómo hacerlo. Pero `Lector.jsx` (848 líneas) y
`LectorMobile.jsx` (883) tienen cada uno 16–19 estados y 16–18 efectos, y varios bloques
son copia literal:

- guardar el progreso: `Lector.jsx:323-337` ≈ `LectorMobile.jsx:434-447`
- marcar el libro al 100 %: `Lector.jsx:339-363` ≈ `LectorMobile.jsx:449-464`
- el aviso para invitados, la puerta del tutorial, las preferencias de lectura, el registro
  de la muestra

Ya han empezado a divergir: el de escritorio tiene en cuenta la doble página al detectar
la última página y el móvil no. 14 de los 28 avisos de dependencias de React
(`exhaustive-deps`) están en estos dos archivos. Pasa lo mismo, en menor medida, en
Biblioteca (búsqueda, grupos y contadores copiados).

**Por qué importa.** El lector es el corazón del producto. Cada arreglo hay que hacerlo dos
veces, y el día que se haga solo una vez, escritorio y móvil se comportarán distinto sin
que nadie lo note.

**Qué haría.** Sacar los bloques comunes a hooks (`useProgresoLectura`,
`useMuestraInvitado`, `usePreferenciasLector`) y dejar en cada versión solo la
maquetación. **Sin tocar `lectorPaginationMobile.js`**, como pide el README.

**Esfuerzo:** M. Es un cambio estructural: antes de hacerlo, explicar el plan y revisarlo.

---

### 🟠 M1. Conviven dos formas de pedir datos
**Qué pasa.** Biblioteca, Tienda, Comunidades y Perfil usan **React Query** (caché
compartida, reintentos, invalidación). Álbum, Cartelera, Foro, reseñas, estadísticas, el
cuaderno y el lector usan **`useState` + `useEffect` hechos a mano**. `useLectorData` se
construye su propia caché de capítulos, con espejo en `ref` y control de peticiones
duplicadas: es reimplementar React Query. Consecuencias concretas:

- Las reseñas se piden y guardan en dos hooks distintos (`useResena` y `useLectorData`).
- Los subrayados se piden dos veces (`useLectorData` y `Notebook.jsx`) y se sincronizan a
  mano con un callback (`olvidarSubrayado`).
- El progreso de la Biblioteca (`useBiblioteca.js:113`) no está en la caché: si cambia en
  otra pantalla, la Biblioteca no se entera hasta que se vuelve a montar.

**Por qué importa.** Dos pantallas pueden mostrar datos distintos de lo mismo, y cada
patrón falla a su manera.

**Qué haría.** Pasar progresivamente a React Query, empezando por lo que se pide en más de
un sitio (reseñas, subrayados, progreso) y usando `useMutation` para las escrituras.
**Esfuerzo:** M–L, por partes.

### 🟠 M2. La frontera de datos tiene agujeros, y el modelo se traduce en siete sitios
**Qué pasa.** La regla es "solo los hooks hablan con Supabase", pero **13 archivos de
fuera** lo hacen: `App.jsx`, `LectorRoute.jsx`, `Lector.jsx`, `LectorMobile.jsx`,
`Notebook.jsx`, `SuperuserSoundsPanel.jsx`, `ForoChat.jsx`, `ForoComentarios.jsx`,
`foroUtils.jsx`, `Perfil.jsx`, `CompletarCuenta.jsx` y los dos contextos (`onboarding`,
`pistas`). Además, `lib/queries.js` importa de `components/` y de `hooks/`: la capa de
abajo depende de la de arriba.

La "traducción" de una fila de `libros` al objeto que usa la UI (`titulo → title`,
`autor → author`, color por defecto `#F2792A`, 200 páginas por defecto…) está escrita en
7 sitios: los hooks `useBiblioteca`, `useAlbum`, `useCompraLibro` y `useBookBySlug`, y los
componentes `HeaderSwimlane`, `NovedadesSpotlight` y `UltimosAbiertosMobile`.

**Por qué importa.** Si cambia una columna, hay que encontrar todos los sitios. Y lo que no
pasa por un hook no se puede probar sin simular la red.

**Qué haría.** Una carpeta de datos por entidad (`src/data/libros.js`, `progreso.js`…, la
carpeta `src/data/` ya existe y está vacía) con las consultas y **un único** `mapLibro`.
Los hooks usan esas funciones; los componentes, los hooks. **Esfuerzo:** M.

### 🟠 M3. `App.jsx` hace demasiadas cosas
**Qué pasa.** Además de las rutas, `App.jsx` gestiona la sesión, guarda "últimos libros"
en la base, adquiere libros tras registrarse, rescata la muestra del invitado, precarga el
lector y pinta un aviso. La sesión es un `useState` que se pasa por props a cada pantalla
(`user`, `gatoColor`, `isSuperuser` viajan a casi todas), y `useLectorData` vuelve a
pedirla por su cuenta.

**Qué haría.** Un `SesionProvider` con `useSesion()` para leer usuario, superusuario y gato
desde cualquier sitio. Los flujos de negocio, a hooks o a la función de A3. Las rutas, a
su propio archivo. **Esfuerzo:** S–M.

### 🟠 M4. Los fallos al guardar no los ve nadie
**Qué pasa.** Sentry solo recibe los errores que **rompen** la app. Pero si falla una
escritura en la base (guardar progreso, un subrayado, una reseña), el código hace
`console.error` y sigue: hay 37 así. Al marcar un libro como leído, el resultado de
`Promise.all` ni se mira. El lector no ve ningún aviso y tú tampoco te enteras.

**Por qué importa.** "Perdí dónde iba" es justo el tipo de fallo que hace que un lector
ocasional abandone, y hoy sería invisible.

**Qué haría.** Una función común para guardar que, si falla, mande el error a Sentry
(`reportarError` ya existe) y, cuando el usuario deba saberlo, muestre un aviso. Con
React Query (M1) esto sale casi gratis con `onError`. **Esfuerzo:** S.

### 🟠 M5. `progreso_lectura.porcentaje` tiene tres significados
**Qué pasa.**
- Se **escribe por capítulos** al avanzar (`useLectorData.js:300`:
  capítulos completados ÷ total).
- Se **escribe por palabras** al rescatar la muestra de un invitado (`App.jsx:123`).
- Se **lee como capítulos** para desbloquear la Cartelera
  (`capituloActualDesdePct`: `round(pct × capítulos) + 1`).
- El "% del libro" del pie del lector se calcula por palabras.

El propio comentario de `App.jsx:85` avisa de que un porcentaje inflado destapa spoilers.
Con capítulos de longitud desigual, un porcentaje por palabras traducido a capítulos puede
desbloquear fichas de capítulos que el lector no ha leído.

**Qué haría.** Guardar el dato que de verdad importa (**último capítulo completado**, un
entero) y calcular el porcentaje solo para mostrarlo. Si se mantiene el porcentaje, que lo
calcule una sola función compartida. **Esfuerzo:** S–M (necesita migración de datos).

### 🟠 M6. Dependencias atrasadas
**Qué pasa.** Vite 5.4 (la actual es la 8; la rama 5 ya no recibe parches de seguridad y es
la causa de las alertas `high` de `npm audit`), `@vitejs/plugin-react` 4 (actual 6), React
18 (actual 19). `@types/react` está en la 19 con React 18, así que el autocompletado
describe una versión que no usas.

**Qué haría.** Subir Vite y su plugin primero (arregla `npm audit` y desbloquea
`security-check`). React 19 después, con calma: casi no rompe nada en una app como esta,
pero hay que pasar por todas las pantallas. **Esfuerzo:** S (Vite) + M (React).

### 🟠 M7. Los estilos no tienen un sistema
**Qué pasa.** Tres formas de dar estilo a la vez: 26 hojas CSS por pantalla, **1.011
objetos `style={{…}}`** en línea y **581 colores hex** escritos a mano en JSX (el README
decía ~440: van subiendo, no bajando). La paleta existe en `:root` de `index.css`, pero
la mayoría del código no la usa.

**Por qué importa.** Cambiar un color de marca, ajustar contraste o algún día un modo
oscuro obliga a buscar a mano por todo el código.

**Qué haría.** No una reescritura. Regla de boy scout: cada pantalla que se toque pasa sus
colores a variables y sus estilos en línea repetidos a clases. Medir el número en cada
revisión para que baje. **Esfuerzo:** L, por partes.

### 🟠 M8. El linter da tanto ruido que nadie lo escucha
**Qué pasa.** `eslint` da 0 errores y **776 avisos**: 504 son colores hex, 242 son
`security/detect-object-injection` (falsos positivos casi siempre en código de navegador),
y entre medias se esconden los 28 avisos de dependencias de React, que **sí** pueden
causar fallos reales (efectos que leen datos viejos).

**Qué haría.** Apagar `detect-object-injection`, poner `exhaustive-deps` como error
(arreglando o justificando los 28), y que la regla de colores solo avise en archivos
modificados. Así un aviso nuevo se ve. **Esfuerzo:** S.

---

### 🟡 B1. Accesibilidad: 92 elementos pulsables que no son botones
`<div>`/`<span>` con `onClick` sin `role` ni teclado (solo 3 llevan `role="button"`). El
README lo tenía en 89: sube. Con un público que lee poco, y que en parte navega con
teclado o lector de pantalla, importa más de lo normal. Cambiar a `<button>` al tocar cada
pantalla. **M.**

### 🟡 B2. Los tests cubren cálculos, no recorridos
Los 78 tests protegen lógica pura (paginación, geometría, edad). Ninguno comprueba un
recorrido: registrarse, adquirir un libro, guardar el progreso y volver a él. Ya tienes
Playwright instalado: 3 o 4 pruebas de humo de esos recorridos contra el entorno de
pruebas (A1), ejecutadas en CI (A2). **M.**

### 🟡 B3. La documentación se ha quedado atrás
El README dice 51 migraciones (hay 73), 19 hooks (hay 29), 2 contextos (hay 3), "14
componentes" que se saltan la frontera (son 13, contando otros archivos), y que los hooks
pasan `typecheck` (no se comprueba ninguno). La regla "ningún componente importa
supabase" contradice la deuda listada en el mismo README. La
[guía para desarrolladores](guia-desarrolladores.md) nueva lo cubre; falta actualizar
el README y enlazarla. **S.**

### 🟡 B4. La pieza más crítica no está en el repositorio
Los scripts que procesan un `.docx` y cargan el libro en Supabase (ficción y no ficción,
orquestadores, generación de imágenes) viven fuera de este repo. El propio README lo
señala. Para un socio, es la mitad del sistema. Versionarlos en un repo privado aparte,
con su propio README. **S.**

### 🟡 B5. Primera carga: 158 kB comprimidos antes de pintar nada
El paquete principal pesa 529 kB (158 kB comprimidos) e incluye el cliente completo de
Supabase, también el de tiempo real, aunque la portada no lo necesita. El README dice
"~150 kB el bundle entero". Se cruza con el LCP móvil de 6,8 s medido en la landing:
**se ve en la sesión de SEO.**

### 🟡 B6. El tipado está a medio camino
Hay JSDoc en los hooks (el editor autocompleta), pero la comprobación no está encendida en
ningún archivo. Mi recomendación para un proyecto de este tamaño con previsión de más de
una persona: activar `// @ts-check` archivo a archivo empezando por `hooks/` y `lib/`, y
valorar más adelante pasar a TypeScript. Es el estándar actual en React y lo que
esperará un socio técnico. **M**: medido después de la revisión, encenderlo solo en
`hooks/` y `lib/` da ~650 errores (77 en `useLectorData`, 62 en `useAlbum`, 51 en
`queries.js`). No es barato: va por partes, al tocar cada archivo.

### 🟡 B7. Orden del repositorio
`probe.html` y `src/probe.jsx` (banco de pruebas de maquetación) conviven con el código de
producción; el paquete se llama `biblioteca-lectura`; `src/data/` está vacía. Menor, pero
es lo primero que ve quien abre el repo. **S.**

---

## Pendientes que ya conocías (no son nuevos)

Siguen abiertos y se cruzan con esta revisión:

- **Migración 072** (avisos de Supabase) escrita y sin aplicar.
- **`perfiles_publicos`** deja a cualquier usuario con sesión listar nombre y apellido de
  todos. Pendiente de decidir.
- **Protección de contraseñas filtradas (HIBP)** apagada en Supabase Auth.
- **Regla 16+ del chat** solo en la app. Además, la política `Perfil propio` (ALL) permite
  al usuario cambiar su propia `fecha_nacimiento` llamando a la API: el límite de edad se
  puede saltar después del registro. Encaja con A3.
- **Vistas sin RLS** (`media_por_parrafo`, `album_imagenes`): exponen URLs de imágenes y
  sonidos más allá de la muestra (no el texto).
- **Login con Google y edad**: sin fecha de nacimiento la cuenta cuenta como 16+.

---

## Hoja de ruta recomendada

El orden importa más que la velocidad. Primero lo que protege todo lo demás.

> **Avance (10 oct 2026, misma sesión).** Fase 1 en curso: hechos M8 (linter: 0 errores,
> solo quedan los 504 hex, con tope), M6 en su parte de Vite (Vite 8, plugin de React 6,
> Vitest 4.1.11; `npm audit` a 0) y A2 en su parte de CI (`.github/workflows/ci.yml`).
> La CI **avisa, no bloquea** (decisión de Juan: pasar a ramas + PR cuando entre un socio).
> M4 hecho: `src/lib/guardar.js` + `<AvisoGuardado>` en progreso, libro terminado,
> subrayados, cuaderno, reseñas y adquirir libro. De paso: el cuaderno insertaba la misma
> anotación nueva en cada cierre (filas duplicadas) y borrar un subrayado lo quitaba de la
> pantalla aunque fallara. Quedan ~29 `console.error` en lecturas y escrituras secundarias
> (superusuario, foro, comunidades), a migrar cuando se toquen. **Fase 1 terminada.**
>
> **Fase 2a (copias de seguridad), hecha el mismo día.** `npm run respaldo` + tarea programada
> de Windows a las 03:00: base (cuentas + public) con 14 copias y espejo de Storage en el
> disco local. Contenido verificado tabla a tabla; la restauración completa se ensaya en la
> 2b, sobre el proyecto de pruebas. Ver `Documentation/base-de-datos/copias-de-seguridad.md`.
>
> **Fase 2b (proyecto de pruebas), hecha el mismo día.** `inmersia-pruebas` en Supabase,
> rellenado restaurando la copia sin datos de usuarios: estructura idéntica a producción y
> contenido real; las imágenes siguen en producción. `npm run dev` va contra pruebas vía
> `.env.development.local`. Queda de A1: que las migraciones dejen registro (`supabase db
> push`); por ahora se aplican a mano, primero en pruebas.

| Fase | Qué | Hallazgos | Esfuerzo |
|---|---|---|---|
| **1. Red de seguridad** | CI con lint + tests + build, previsualizaciones en Vercel, linter limpio, subir Vite, aviso de errores al guardar | A2, M8, M6 (Vite), M4 | ~1 semana de tardes |
| **2. Entorno propio** | Proyecto de pruebas, migración de partida, migraciones con registro | A1 | 2–4 tardes |
| **3. Reglas a la base** | Trigger de perfil, `adquirir_libro()`, un único significado de progreso | A3, M5 | 3–5 tardes |
| **4. Ordenar el código** | Lector sin duplicar, React Query en todo, capa de datos, `App.jsx` adelgazado | A4, M1, M2, M3 | 2–3 semanas, por partes |
| **Continuo** | Estilos, accesibilidad, tests de recorridos, tipado | M7, B1, B2, B6 | al tocar cada pantalla |

Las fases 1 y 2 no cambian nada de lo que ve el lector, y hacen las fases 3 y 4 mucho más
seguras. **Antes de empezar la fase 4 conviene tener ya la 1 y la 2.**

---

## Cómo se hizo

- Lectura de `src/` completo por capas (arranque, rutas, `lib`, `context`, hooks y las
  pantallas principales en sus dos versiones), `scripts/`, configuración de Vite, ESLint,
  `jsconfig` y Vercel.
- Mediciones: `vitest` (78/78 en verde), `eslint` (0 errores, 776 avisos, desglosados por
  regla), `vite build` (tamaño por paquete), `npm outdated`, `npm audit`, recuento de
  patrones (`style={{`, hex, `onClick` en `div`, accesos directos a Supabase).
- Base de datos en producción, **solo estructura**: tablas y RLS, políticas de
  `bibliotecas_usuarios`, `perfiles`, `progreso_lectura`, `preferencias_usuario`,
  `cartelera_items` y `elementos_interactivos`, triggers, vistas y registro de migraciones.
  Ninguna consulta leyó datos de usuarios.
- Se incluyen los cambios sin commit de `TiraPrediccion.jsx` y `CarteleraMobile.jsx`, que
  van a producción.
