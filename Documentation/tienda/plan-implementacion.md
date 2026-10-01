# Tienda nueva: plan de implementación (escritorio y móvil)

Estado al 1 oct 2026. El diseño está cerrado y aprobado por Juan en dos prototipos navegables. **F0–F4 hechas (escritorio completo y principal + catálogo en móvil); faltan las salas en móvil (F5) y el cierre (F6).** Este documento es la guía para programarlo: qué se construye, en qué orden, qué archivos cambian y qué falta decidir.

## Referencias
- **Prototipo escritorio:** https://claude.ai/artifact/2qkUWTuEPtTLGSqhfpzbid
- **Prototipo móvil:** https://claude.ai/artifact/5EdtA7wNctZjEroMUcRv4b
- **Maquetas de exploración:** https://claude.ai/artifact/JN1KSu7WAZrYUtnGMYYft7 (A salas, B feed, C carriles). La versión final mezcla C con A y B.
- Los prototipos son HTML sueltos con los 51 libros reales. Sirven de especificación visual y de comportamiento. **No se copia su código**: se reimplementa en React con los componentes y estilos de la app.

## Cómo trabajar (heredado de `contexto-gamificacion.md`)
- **Tono:** tuteo en toda la copy, nunca voseo.
- **Respaldos:** antes de editar un archivo existente, listarlo y copiarlo a `Documents\Inmersia_respaldos\<fecha>_tienda\`.
- **Migraciones:** las corre Juan en Supabase → SQL Editor. Siguiente número libre: **066**. La migración va siempre antes que el código que la usa.
- **Verificación:** `npx eslint <archivos>`, `npm test` y `npm run build`. En el navegador prueba Juan.
- **Al reemplazar algo, se borra lo viejo** (componentes, CSS y fallbacks).
- **Commits:** separados por fase, a `main`, solo cuando Juan lo pida.

---

## 1. Lo que se construye (especificación cerrada)

### 1.1 Recorrido y botón Atrás

| Pantalla | Cómo se llega | Atrás lleva a |
|---|---|---|
| Calle (fachada, `CalleEscena`) | Desde la Biblioteca, con sesión | Biblioteca |
| **Tienda principal** | Desde la calle; un invitado llega directo desde la landing | Biblioteca (con sesión) o landing (invitado) |
| **Sala** | Tarjeta de sala, «Ver los N» de la temporada, pasillo de otras salas | Tienda principal |
| **Catálogo completo** | «Ver todo el catálogo», o el buscador de la sala | Tienda principal |
| **Ficha** (modal en escritorio, hoja en móvil) | Cualquier libro de la tienda; botón Ficha de la historia | Cierra y vuelve a donde estabas |
| **Historia** (móvil a pantalla completa) | Tocar un libro en una sala | X: vuelve a la estantería con ese libro resaltado |

**La calle nunca es destino de Atrás.** Volver de una sala o del catálogo a la tienda principal no debe mostrar la fachada otra vez (ver Riesgos).

### 1.2 Tienda principal
**Escritorio**
- **Cabecera:** Atrás (Biblioteca o Volver), logo, buscador ancho y, si es invitado, Iniciar sesión / Crear cuenta.
- **Fila de chips sin cortes:** `[Filtros]`, separador, `Todos · Ficción · No ficción`. **Filtros** abre debajo un panel con las 12 categorías (selección múltiple, contador y «Quitar categorías»).
- **Al buscar o filtrar,** el contenido de la página se reemplaza por los resultados, sin navegar. Usan **la misma tarjeta y rejilla que el Catálogo** (3 columnas, 15 por página), con «Limpiar».
  - La búsqueda es en vivo, no distingue tildes y busca en título, autor, categorías y sinopsis.
- **Orden de la página:**
  1. Portada de temporada («Octubre de miedo») con «Ver los N», que abre la sala de temporada.
  2. **Las salas:** 4 tarjetas con portal, cada una con el color de su categoría.
  3. **3 carriles** de 8 libros como máximo, solo portada (sin título ni autor debajo), con flechas.
  4. Tarjeta «Todo el catálogo».
- **Fuera:** «Ver avances», el cambio Biblioteca/Tienda y «Sorpréndeme».

**Móvil**
- **Solo va fija la fila de arriba:** Atrás, logo y lupa. La lupa despliega el buscador con «Cancelar».
- **Chips** `[Filtros] · Todos · Ficción · No ficción`, que se desplazan con la página. Filtros abre una **hoja inferior** con las categorías y el botón «Ver N libros».
- **Orden de la página:**
  1. Portada de temporada.
  2. **Salas en carrusel horizontal**, con la siguiente tarjeta asomando.
  3. **2 carriles** deslizables de **6** libros como máximo: Para empezar y Se leen en una tarde.
  4. «Todo el catálogo».
- **Resultados de búsqueda o filtro:** la rejilla de 2 columnas del catálogo móvil.

### 1.3 Sala
**Común a escritorio y móvil**
- **Estantería:** 2 baldas de 5 libros. Si la balda tiene **3 o más** libros, el de **mayor `orden`** va **de lomo** en una posición aleatoria, fija durante la visita. Con menos de 3, todos de frente.
- **Lomo:** el título va centrado en vertical y en horizontal.
- **Más de 10 libros:** un numerador «Estantería 1 de N» con flechas debajo de las baldas.
- **Título de la sala:** texto blanco sin cartel, con «categoría · N libros».
- **Fondo:** degradado oscuro sacado del color de la sala (v1; ver decisiones pendientes).
- **Sonido:** sin sonido de sala. Cada reel trae su propio audio.

**Escritorio**
- **Arriba a la izquierda:** Atrás («Tienda») y un **buscador grande** que busca en toda la tienda; con Enter abre el Catálogo con esa búsqueda. No hay botón «Todo el catálogo».
- **Estanterías a la izquierda,** empezando desde la izquierda. **Panel de historia a la derecha,** en formato 9:16.
- **Panel antes de elegir libro:** el gato y «Toca un libro del estante para ver su historia».
- **Al tocar un libro,** el panel muestra su historia:
  - Escenas con avance automático cada 6 s y clic a izquierda o derecha.
  - Debajo, el botón grande naranja **Comenzar a leer** y, en la misma línea, **Ficha** y **Guardar en mi biblioteca**.
  - **«Desliza · sigue X»:** rueda del ratón, ↓ o el botón pasan al siguiente libro de la misma sala. En el último no hace nada. La estantería acompaña la selección y cambia de página si hace falta.
- **Pasillo de otras salas** abajo a la izquierda, con flechas solo si no caben.

**Móvil**
- **Arriba:** Atrás («Tienda») y lupa.
- **Portadas de ≈71 px solo con la ilustración.** Debajo de cada una cuelga una **etiqueta de papel** con el título (3 líneas como máximo, inclinada ±1,2°). Tocar la etiqueta también abre la historia.
- **Línea de ayuda:** «Toca un libro para ver su historia».
- **Otras salas:** una sola fila deslizable con las mismas tarjetas de la principal.
- **Tocar un libro** abre la **historia a pantalla completa**, al estilo del feed B, sin los canales «Para ti…»:
  - X arriba.
  - **Ficha** y **Añadir a mi biblioteca** en la columna derecha.
  - Botón grande **Comenzar a leer** abajo.
  - **Gestos:** deslizar hacia arriba pasa al siguiente libro de la sala (en el último, un pequeño rebote); hacia abajo, al anterior. Tocar a izquierda o derecha cambia de escena.

### 1.4 Ficha del libro
La misma estructura en los dos formatos. Sustituye a `PanelLibro`.

1. **Cabecera** con la imagen de la escena 2 del reel. Etiqueta con la sala del libro y botón **«Ver el avance · N escenas»**, que abre la historia en modo avance (sin Desliza, con «Comenzar a leer»).
2. **Portada sin título ni autor impresos,** porque ya aparecen al lado. Título, «autor · año» y etiquetas de categoría.
3. **Botones:** **Comenzar a leer** (naranja) y **+ A mi biblioteca**. Al invitado se le muestra «Los dos primeros capítulos, sin crear cuenta».
4. **Izquierda:**
   - **«Así empieza»**, plegable y **abierto al entrar**. Si no hay una primera línea buena, no se muestra.
   - Debajo, **«Lo que trae en Inmersia»** (ver 2.2).
5. **Derecha:** **solo la sinopsis.** El primer párrafo va en negrita y el resto lleva «Leer más».
6. **Fuera:** «Si te gusta este», las reseñas (hay 0; siguen en `BibBookModal`) y las frases subrayadas.

**Móvil:** hoja a pantalla completa con el mismo orden: Así empieza → Lo que trae (tarjetas deslizables) → Sinopsis. La barra fija abajo lleva **Comenzar a leer** y el marcador para guardar.

**Texto del botón:** es **«Comenzar a leer»** en todas partes; «Leer el capítulo 1» desaparece.

### 1.5 Catálogo completo
- **Igual que hoy:** título, buscador, Todos/Ficción/No ficción, Filtrar, contador y paginación de 15.
- **Cambios:**
  - Las tarjetas son **solo el libro**, sin título ni autor debajo.
  - La búsqueda es en vivo y sin tildes; adiós al «(Enter)».
  - «Nuevo» marca los libros de los **últimos 30 días**.
  - Tocar un libro abre **la ficha**, no el reel.
  - Atrás lleva a la Tienda principal.
- **Móvil:** 2 columnas y la hoja de filtros actual.

### 1.6 Guardar y límite
- **Sin cambios de regla:** se sigue usando `useCompraLibro` con el límite de 5 pendientes.
- **Invitado** que pulsa Guardar: se abre el registro con `openAuth('registro')`.
- **Con sesión:** aviso «quedó en tu biblioteca · N de 5»; al llegar a 5, el aviso del límite.

---

## 2. Datos (Supabase)

### 2.1 Migración 066: salas
Juan quiere crear salas, meter los libros que quiera y que **un libro pueda estar en varias salas**. Eso pide tabla: es dato de alto valor.

```sql
salas (
  id uuid pk, slug text unique,          -- /tienda/la-sala-oscura
  nombre text, linea text,               -- «Para leer con la luz encendida.»
  color text,                            -- hex de la paleta de categorías
  tipo text check (tipo in ('sala','temporada','carril')),
  orden int, visible bool default true,
  desde date null, hasta date null,      -- temporada: se muestra solo entre fechas
  imagen_url text null                   -- fondo de la portada de temporada
)
sala_libros (sala_id → salas, libro_id → libros, orden int, primary key (sala_id, libro_id))
```

- **RLS:** lectura pública de lo visible. Escritura solo con `es_superusuario()` (ya existe desde la 051).
- **`tipo = 'carril'`** permite curar los carriles con el mismo sistema (decisión pendiente 4). La portada de temporada sale de la sala `tipo = 'temporada'` vigente.
- **Siembra inicial:** las 4 salas del prototipo (oscura, puerto, jardín, corazones) con sus libros por categoría, y «Octubre de miedo» (8 libros, del 1 al 31 de octubre).
- **Cómo las administra Juan:**
  - **v1:** en Supabase → Table Editor. No hace falta código.
  - **v2 (después):** un modo editor de superusuario dentro de la sala (añadir, quitar y reordenar).
- `slug` no puede ser `catalogo`; la ruta está reservada.

### 2.2 Migración 067: resumen por libro (sin tablas nuevas)
Una vista o función (`libros_resumen`) que **calcula** sin guardar nada nuevo, en la línea de «no crear datos de poco valor». Con permisos del dueño, porque el invitado solo ve 2 capítulos por RLS y aquí se exponen solo números agregados:

- `capitulos`: count de `capitulos`.
- `palabras`: suma de `capitulos.palabras` (ya existe desde la 062). El tiempo de lectura se calcula en la app con `palabras / 230` (decisión pendiente 2).
- `ilustraciones`: imágenes distintas del libro (`media_por_parrafo`, tipo `imagen`).
- `sonidos` (cambiado en la **069**): **momentos con sonido**, es decir, efectos anclados a una frase (`origen = 'explicito'`). El ambiente por etiqueta está apagado en ficción (`AMBIENTE_FICCION_ACTIVO = false`) y no cuenta. En no ficción da 0.
- **Regla de la ficha:** la tarjeta que vale 0 no se muestra (sonidos en no ficción; fichas en Lupin, El cupón falso, Una vida sin principios y Ensayos; ilustraciones en El ocaso de los ídolos).
- `fichas`: de `cartelera_items`, contando cada una una vez aunque aparezca en varios capítulos. **Ficción:** personajes y lugares; la etiqueta dice «personajes y lugares de la Cartelera». **No ficción:** no tiene personajes, así que cuenta todas sus secciones (glosario, referencias, datos…), como «Infografías» en el Álbum; la etiqueta dice «fichas en la Investigación». Se agrupa por `nombre` normalizado, como el Álbum; la columna `nombre_canonico` de la 017 no existe en la base de datos.
- Sin `barajitas`: se solapaban con ilustraciones y fichas (decisión 1).
- `primera_linea`: **`libros.primera_linea` si está rellena (069)**; si no, el primer párrafo del capítulo 1 con ≥ 90 caracteres. Así se saltan dedicatorias y títulos («A Leon Werth:», «HISTORIA»). Si no hay ninguno, `null` y la ficha oculta «Así empieza». La regla falla en algunos libros (Meditaciones empieza con «3. De mi madre…», y en El banquete o los Ensayos de Emerson no saldría bien): Juan lo revisa libro a libro y, si hace falta, se fija a mano (decisión pendiente 6).

### 2.3 Migración 068: limpieza del catálogo
- **Año:** `anio` es entero y no sirve para «s. V a. C.». Se añade `anio_texto text` (lo que se muestra) y se rellena:
  - Sun Tzu → «s. V a. C.»
  - Platón → «s. IV a. C.»
  - Marco Aurelio → «s. II»
  - Hawthorne → 1853 (hoy dice 1984)
  - Noches blancas → 1848
  - Wollstonecraft → 1792
- **Título:** «Arsene» → «Arsène Lupin, caballero ladrón».
- **Categoría:** «Policíaca» → «Misterio» (vocabulario cerrado de la 048).
- **Comprobar que la 064 está aplicada:** el 1 oct El Principito seguía con `orden` 10.

### 2.4 Lo que ya existe y se reutiliza
`libros` (orden, categorias, es_ficcion, created_at, color, portada_url, descripcion), `libro_reels` (5 escenas por libro, **todas con audio**), `capitulos.palabras` y `useCompraLibro`.

---

## 3. Arquitectura del código

Regla de la casa: **un hook por dato, una sola fuente de verdad**, compartida entre escritorio y móvil, como ya se hace con `useTiendaData`.

### 3.1 Compartido (`src/lib`, `src/hooks`, `src/utils`)
| Pieza | Qué hace |
|---|---|
| `lib/queries.js` + `useSalasQuery()` | Salas visibles con sus `sala_libros`. Cache de React Query, como el catálogo. |
| `lib/queries.js` + `useLibrosResumenQuery()` | La vista 067 para fichas y carriles. |
| `hooks/useTiendaData.js` | Ya existe. Suma salas, temporada vigente y carriles. |
| `hooks/useCatalogoFiltro.js` | Ya existe. Búsqueda en vivo y sin tildes, tipo + categorías múltiples, opción de búsqueda «ancha» (sinopsis y categorías) para la principal. |
| `utils/estanteria.js` (**nuevo, puro**) | `armarEstanterias(libros, salaId)`: páginas de 2 baldas × 5 con la regla del lomo. La posición aleatoria se guarda en `sessionStorage` por sala, página y balda. **Con tests en vitest.** |
| `hooks/useHistoria.js` (**nuevo**) | Escena actual, temporizador de 6 s, audio del reel (sale de `LibroReel`), libro siguiente y anterior en la secuencia de la sala, precarga de imágenes del siguiente libro. |
| `utils/formato.js` | `anioMostrar(libro)`, `tiempoLectura(palabras)`. |

### 3.2 Escritorio (`src/components/tienda/`)
| Componente | Estado |
|---|---|
| `Tienda.jsx` | **Reescribir** como cáscara: calle (solo al entrar desde Biblioteca), principal, sala y catálogo según la ruta. |
| `TiendaPrincipal.jsx` | Nuevo: cabecera, `BarraFiltros`, `HeroTemporada`, `SalasGrid`/`SalaCard`/`Portal`, `Carril`, `TodoCatalogoCard`, resultados. |
| `SalaVista.jsx` | Nuevo: buscador, título, `Estanteria` (`Balda`, `Lomo`), `Paginador`, `Pasillo`, `PanelHistoria`. |
| `Historia.jsx` | Nuevo; **reemplaza `LibroReel.jsx`**. Modos `sala` y `avance`; variante `panel` (escritorio) o `pantalla` (móvil). |
| `FichaLibro.jsx` | Nuevo; **reemplaza `PanelLibro.jsx`**. |
| `CatalogoInterior.jsx`, `catalogoShared.jsx` | Ajustar: tarjeta solo portada, búsqueda en vivo, abre la ficha. |
| `CalleEscena.jsx`, `tiendaHelpers.jsx` | Sin cambios de fondo. |

### 3.3 Móvil (`src/components/mobile/tienda/`)
| Componente | Estado |
|---|---|
| `TiendaMobile.jsx` | Reescribir como cáscara. |
| `TiendaPrincipalMobile.jsx` | Nuevo: fila fija, chips, `HojaFiltros`, carrusel de salas, 2 carriles de 6. |
| `SalaMobile.jsx` | Nuevo: baldas con **etiquetas**, paginador, carrusel de otras salas. |
| `HistoriaMobile` | Variante `pantalla` de `Historia.jsx` con gestos (pointer events, `touch-action: none`). |
| `FichaLibroMobile.jsx` | Nuevo: hoja con barra fija. Reemplaza el uso de `PanelLibro` en móvil. |
| `CatalogoInteriorMobile.jsx` | Ajustar: tarjeta solo portada, abre la ficha. |
| Atrás de Android | Extender el patrón `pushState`/`popstate` que ya usa `CatalogoInteriorMobile` para el panel: primero cierra historia/ficha y después sale de la sala. |

### 3.4 Rutas (`App.jsx`)
- `/tienda` → principal (la calle solo si llegas con `state.calle` desde la Biblioteca).
- `/tienda/catalogo` → catálogo completo.
- `/tienda/:sala` → sala por `slug` (si no existe, vuelve a `/tienda`).
- **Ficha por URL:** `?libro=<slug>` en cualquiera de las anteriores, para compartirla y enlazarla desde Instagram. **No** `/libro/<slug>`, que ya es el lector. Reemplaza al `state.libro` de `useFichaPedida` (la estantería de la landing pasa a usar `?libro=`).

### 3.5 Estilos
- Hoy `tienda.css` mezcla escritorio y móvil (498 líneas). Se parte como el resto de módulos: `tienda.css` y `tienda.mobile.css`.
- Se borran las clases de las piezas eliminadas: `.bkp-*`, `.reel-*`, la `.bk-foot` de la tarjeta, etc.

### 3.6 Biblioteca
`Biblioteca.jsx` y `BibliotecaMobile.jsx` abren hoy `PanelLibro`/`LibroReel` (Novedades, Recomendaciones, «Leer como»). Pasan a `FichaLibro`/`Historia` para que haya **una sola ficha** en toda la app. Después se borran `PanelLibro.jsx` y `LibroReel.jsx` (decisión pendiente 3).

---

## 4. Fases

Cada fase se puede probar y subir sola. **Antes de cada una se listan sus archivos y se respaldan.**

| Fase | Qué | Archivos principales | Se ve en producción |
|---|---|---|---|
| **F0 · Datos** | Migraciones 066 (salas + siembra), 067 (resumen), 068 (limpieza). Juan revisa la primera línea de cada libro. | `supabase/Migration/066-068_*.sql` | Nada todavía |
| **F1 · Base compartida** | `estanteria.js` + tests, `useHistoria`, queries, `formato.js`, `Historia`, `FichaLibro` (escritorio y móvil). La ficha nueva entra ya en la tienda actual en lugar de `PanelLibro`. | `lib/queries.js`, `hooks/*`, `utils/*`, `tienda/Historia.jsx`, `tienda/FichaLibro.jsx`, `mobile/tienda/FichaLibroMobile.jsx`, `Tienda.jsx`, `TiendaMobile.jsx` | La ficha nueva |
| **F2 · Escritorio: principal + catálogo + rutas** | Tienda principal, resultados en la página, catálogo ajustado, rutas nuevas y Atrás. | `App.jsx`, `Tienda.jsx`, `TiendaPrincipal.jsx`, `CatalogoInterior.jsx`, `catalogoShared.jsx`, `useCatalogoFiltro.js`, `tienda.css` | Tienda nueva en escritorio |
| **F3 · Escritorio: salas** | `SalaVista`, estantería, panel de historia, pasillo, buscador. | `SalaVista.jsx` y piezas | Salas en escritorio |
| **F4 · Móvil: principal + catálogo + ficha** | Fila fija, chips, hoja de filtros, carruseles. | `TiendaMobile.jsx`, `TiendaPrincipalMobile.jsx`, `CatalogoInteriorMobile.jsx`, `tienda.mobile.css` | Tienda nueva en móvil |
| **F5 · Móvil: salas + historia** | Baldas con etiquetas, historia a pantalla completa, gestos, Atrás de Android. | `SalaMobile.jsx`, `Historia.jsx` (variante) | Salas en móvil |
| **F6 · Cierre** | Biblioteca usa la ficha nueva; se borran `PanelLibro`, `LibroReel` y el CSS viejo. Analítica (sección 5). Revisión con `scripts/revisar-pantallas.mjs` en 860–1440 px y en móvil. | `Biblioteca.jsx`, `BibliotecaMobile.jsx`, `useFichaPedida.js`, `landing/Estanteria.jsx` | Una sola ficha en toda la app |

**Orden de prioridad:** F0 → F1 → F2 → F3 → F4 → F5 → F6. Si se quiere sacar valor antes, F1 (ficha nueva) ya mejora la tienda actual por sí sola.

---

## 5. Analítica (PostHog, con `evento()`)
Hoy la tienda solo registra `libro_comprado`. Se añaden:
- `tienda_vista` {origen: calle | landing | atras}
- `tienda_busqueda` {termino, resultados}: las búsquedas sin resultado dicen qué falta en el catálogo.
- `tienda_filtro` {tipo, categorias}
- `sala_abierta` {sala}
- `historia_vista` {libro, sala, escenas_vistas, de_total}
- `historia_desliza` {sala, desde, hacia}
- `ficha_abierta` {libro, origen: carril | sala | catalogo | resultados | biblioteca}
- `cta_comenzar` {libro, origen}
- `avance_abierto` {libro}

Con esto se arma el embudo: tienda → sala/ficha → historia → comenzar a leer.

---

## 6. Riesgos y trampas
- **Fachada en bucle:** hoy `Tienda.jsx` muestra la calle a todo usuario con sesión que entra a `/tienda` sin `state.entrar`. Con rutas nuevas, volver de una sala a `/tienda` la mostraría otra vez. La calle tiene que depender de un `state.calle` que solo pone la Biblioteca.
- **Paso del onboarding `'tienda'`:** el aviso del límite vive en la fachada. Se mantiene; solo hay que comprobarlo tras F2.
- **Audio:** el navegador solo deja sonar audio después de un gesto. El toque al libro es ese gesto, así que el audio arranca ahí. Hay que parar el audio al cerrar, al cambiar de libro y al abrir la ficha.
- **Peso de las imágenes:** las escenas originales pesan ~460 KB. Siempre con `imgUrl(..., { width })` y precarga solo del libro **siguiente**, no de toda la sala.
- **Lomo estable:** si la posición aleatoria no se guarda, la estantería «salta» en cada render.
- **Ficha por URL:** abrir y cerrar no debe llenar el historial de entradas. Hay que usar `replace` al cerrar.
- **SEO:** `generar-seo.mjs` genera las páginas `/libro/<slug>`. Las salas podrían sumarse al sitemap más adelante; no es parte de este plan.
- **Reseñas:** salen de la ficha de la tienda pero siguen en `BibBookModal`. Si algún día hay volumen, se puede devolver una línea de estrellas a la ficha.

---

## 7. Decisiones (respondidas por Juan el 1 oct)
1. **«Lo que trae en Inmersia» lleva 4 tarjetas:** tiempo de lectura · ilustraciones · ambientes sonoros · personajes y lugares de la Cartelera (en no ficción: fichas en la Investigación). Sin «barajitas».
2. **Velocidad de lectura:** 230 palabras por minuto. «Se leen en una tarde» = 2 h o menos.
3. **Una sola ficha en toda la app:** la Biblioteca también pasa a la ficha nueva.
4. **Carriles:** reglas fijas en código en v1 (Para empezar = `orden`; Una tarde = tiempo; Recién llegados = fecha). La tabla ya admite `tipo = 'carril'` para curarlos después.
5. **Fondos de sala:** degradado del color en v1; concept art por sala más adelante.
6. **Primera línea:** automática y revisada libro a libro. A Juan no le convence del todo: si al revisarla fallan varios, se pasa a fijarla a mano.
7. **«Recién llegados» se queda.** Esta semana entran libros nuevos que no son de filosofía.

## 8. Estado
- **F0:** Juan corrió `066_salas.sql`, `067_libros_resumen.sql` y `068_limpieza_catalogo_tienda.sql` el 1 oct (comprobado: salas 9/10/20/10/8, años, Arsène, Misterio). **Falta correr la 064**: El Principito sigue con `orden` 10. **069 escrita**: sonidos reales y primera línea fijada a mano en Meditaciones, El pragmatismo y Ensayos. Pendiente de Juan: dedicatoria o comienzo en El Principito y Largo viaje hacia la noche.
- **F1 hecha (sin commit) el 1 oct:** la ficha nueva ya sustituye a `PanelLibro` y `LibroReel` en el catálogo actual, en escritorio y en móvil.
  - **Archivos nuevos:** `utils/formato.js` y `utils/estanteria.js` (con tests), `hooks/useFichaLibro.js`, `hooks/useHistoria.js`, `tienda/Historia.jsx` (con `AvanceLibro`), `tienda/FichaLibro.jsx`, `tienda/fichaPiezas.jsx`, `mobile/tienda/FichaLibroMobile.jsx`, `styles/ficha.css`, `ficha.mobile.css` e `historia.css`.
  - **Archivos tocados:** `lib/queries.js` (salas, resumen, reels y `anio_texto`), `CatalogoInterior.jsx`, `CatalogoInteriorMobile.jsx`, `Tienda.jsx`, `TiendaMobile.jsx` y `useTiendaData.js` (fuera `libroLeido`, que solo usaban las reseñas). Respaldo en `Inmersia_respaldos/2026-10-01_tienda-F1/`.
  - **Analítica:** `ficha_abierta`, `avance_abierto` y `cta_comenzar`.
  - **Verificado:** eslint sin errores, 77 tests y build. Probado en el navegador como invitado: ficha, avance, Escape y cierre.
  - **Adelantado de la F6** (a pedido de Juan, el mismo 1 oct): la Biblioteca (Novedades, Recomendaciones, «Leer como», escritorio y móvil) usa ya `FichaLibro`/`FichaLibroMobile`, y el botón de avance de Novedades abre `AvanceLibro`. En móvil, las tarjetas de Novedades y «Para ti» abren la ficha directamente, sin pasar por el reel. **Borrados** `PanelLibro.jsx`, `LibroReel.jsx` y sus estilos `.bkp-*` y `.reel-*` de `tienda.css`. Respaldo en la misma carpeta.
  - **Login con Google en local:** vuelve a inmersia.io si `http://localhost:5173/**` no está en Supabase → Authentication → URL Configuration → Redirect URLs. No es código.
- **F2 hecha (sin commit) el 1 oct.** Necesita la **migración 070** (`salas.genero`), pendiente de correr. Sin ella la consulta de salas falla: sale el aviso «No pudimos cargar tus datos» y faltan la portada de temporada y las salas.
  - **Rutas:** `/tienda` (principal), `/tienda/catalogo` y `/tienda/:sala`. La sala muestra por ahora un aviso provisional: llega en la F3.
  - **La calle** solo aparece si la Biblioteca navega con `state.calle`. Al cruzar la puerta se borra esa marca (`replace`), así que Atrás no vuelve a la fachada.
  - **Archivos nuevos:** `TiendaPrincipal.jsx`, `salaPiezas.jsx` (Portal, SalaCard, `mezclar`), `useFichaEnUrl.js` (la ficha vive en `?libro=`; reemplaza `useFichaPedida`, borrado, y el `pushState` del catálogo móvil), `tienda-principal.css` y `070_salas_genero.sql`.
  - **Archivos tocados:**
    - `App.jsx`: rutas; la landing usa `?libro=`; la Biblioteca pasa `state.calle`.
    - `Tienda.jsx`: cáscara de las tres vistas.
    - `TiendaMobile.jsx`: entiende `/tienda/catalogo`; `/tienda/:sala` redirige a `/tienda` hasta la F4/F5.
    - `CatalogoInterior.jsx` y `CatalogoInteriorMobile.jsx`: ficha en la URL, búsqueda en vivo, Atrás a la tienda.
    - `catalogoShared.jsx`: tarjeta solo con el libro (`book-lg`, 150 px) y ✓ si ya es tuyo.
    - `useCatalogoFiltro.js`: búsqueda en vivo y sin tildes, búsqueda amplia, `?q=` y evento `tienda_busqueda`.
    - `useTiendaData.js`: «Nuevo» = últimos 30 días.
    - `queries.js`: `genero` y `useLibrosPalabrasQuery`.
    - `tienda.css`: la tarjeta.
    - Respaldo en `Inmersia_respaldos/2026-10-01_tienda-F2/`.
  - **Verificado:** eslint sin errores, 77 tests y build. En el navegador, como invitado: carriles, buscar «fantasma» (3), filtrar por Terror (5), ficha por URL y Atrás, catálogo y vuelta, enlace `?libro=` y la ruta de sala.
  - **Ajuste tras la prueba de Juan:** nueva `CabeceraTienda.jsx`, la barra de arriba compartida por la principal y el catálogo completo (y la usarán las salas). El botón Atrás queda siempre en el mismo sitio (medido: x=124, y=16 en las dos). Se quitaron del catálogo de escritorio el botón fijo `.int-back` y la cabecera de invitado `.tienda-guest-nav`; el móvil las sigue usando hasta la F4.
  - **La 070 ya está corrida** y verificada: las 5 salas con su género.
- **Libros nuevos:** no entran solos en ninguna sala.

- **F3 hecha (sin commit) el 1 oct:** las salas en escritorio (`/tienda/<slug>`, también la temporada vigente).
  - **Archivos nuevos:** `tienda/SalaVista.jsx` y `styles/sala.css`.
  - **Archivos tocados:**
    - `Tienda.jsx`: la vista `sala` monta `SalaVista` con `key={slug}`, así que el pasillo abre una sala nueva.
    - `Historia.jsx`: prop `alSalir`, que al desmontarse informa hasta qué escena llegó (evento `historia_vista`).
    - `salaPiezas.jsx`: `esVisitable(sala)`. Las salas siempre; la temporada, solo entre sus fechas. La usan la principal y la sala.
    - `TiendaPrincipal.jsx`: usa `esVisitable` en lugar de su propio `hoyLocal`.
    - Respaldo en `Inmersia_respaldos/2026-10-01_tienda-F3/`.
  - **Comportamiento:**
    - La cabecera es `CabeceraTienda` («Tienda»). El buscador abre `/tienda/catalogo?q=…` con Enter.
    - La posición del lomo se guarda en `sessionStorage` (`inmersia:lomo:<sala>:<pág>-<balda>`).
    - «Desliza» funciona con la rueda sobre el panel, ↓/↑ (fuera del buscador y con la ficha cerrada) o el botón, y cambia la estantería de página.
    - Se precargan las escenas del libro siguiente.
    - La ficha va en `?libro=` y pausa la historia.
    - Al guardar sale el aviso «quedó en tu biblioteca · N de 5». **Solo en la sala:** la principal y el catálogo todavía no tienen ese aviso.
    - Un slug que no existe, o una temporada fuera de fecha, vuelve a `/tienda`.
  - **Analítica:** `sala_abierta`, `historia_vista`, `historia_desliza` y `cta_comenzar` (origen `sala`).
  - **Verificado:** eslint sin errores, 77 tests y build. En el navegador, como invitado, a 860, 1024 y 1440 px, sin desborde:
    - el numerador en el jardín (20 libros) y el paso de la página 1 a la 2 con la rueda;
    - la ficha desde la historia, con Escape y la URL;
    - el buscador, un slug inexistente, el pasillo con sus flechas, el Atrás del navegador y el botón Tienda.
  - **Arreglo de la medición:** el texto del lomo va en un `span` interior con `writing-mode` vertical. Dentro de un elemento vertical, el `cqi` de `--cw` se mide contra otro eje y el lomo salía más alto que las portadas.
  - **Falta probar con sesión:** guardar desde la historia (el aviso N de 5) y el límite de 5.

- **F4 hecha (sin commit) el 1 oct:** la tienda principal y el catálogo en el móvil.
  - **Archivos nuevos:**
    - `hooks/usePortadaTienda.js`: temporada, salas y carriles para escritorio y móvil. Escritorio muestra 3 × 8 y el móvil 2 × 6.
    - `mobile/tienda/TiendaPrincipalMobile.jsx`, que incluye la `HojaFiltros`.
    - `mobile/tienda/CabeceraTiendaMobile.jsx`: Atrás, logo y un hueco a la derecha. La usará también la sala móvil.
    - `styles/tienda.mobile.css` (`.tpm-*`).
  - **Archivos tocados:**
    - `TiendaMobile.jsx`: ahora es una cáscara igual que la de escritorio. La calle solo sale con `state.calle`. `/tienda/:sala` muestra un aviso provisional hasta la F5.
    - `CatalogoInteriorMobile.jsx`: cabecera nueva (Atrás «Tienda», más «Crear cuenta» si es invitado) y lectura de `?q=`.
    - `TiendaPrincipal.jsx`: usa `usePortadaTienda`.
    - `tienda.css`: se borró `.tienda-guest-*`. `.int-back` se queda porque lo usa la calle.
    - Respaldo en `Inmersia_respaldos/2026-10-01_tienda-F4/`.
  - **Verificado:** eslint sin errores, 77 tests y build. En el navegador, como invitado en 390 × 844, sin desborde:
    - la fila de arriba se queda fija al bajar;
    - la lupa enfoca el buscador; «fantasma» da 3 y Cancelar vuelve;
    - en la hoja, Terror da «Ver 5 libros»;
    - la ficha se abre desde un carril y el Atrás del navegador la cierra;
    - una sala muestra el aviso, el catálogo vuelve a la tienda y `?q=platon` da 1.
  - **Escritorio, sin cambios tras el ajuste:** temporada, 4 salas y 3 carriles de 8.

## 9. Para retomar (siguiente sesión: F5, las salas y la historia en el móvil)
- **Sin commit:** todo lo de F0–F4 está sin commit, porque Juan aún no lo ha pedido.
- **Qué falta:** la vista `sala` de `TiendaMobile.jsx` es un aviso provisional. La F5 la sustituye por `SalaMobile.jsx` (sección 1.3 móvil y prototipo móvil):
  - baldas con portadas de ≈71 px solo con la ilustración y las **etiquetas** de papel colgando;
  - numerador;
  - «Otras salas» como fila deslizable con las tarjetas de la principal;
  - la historia a pantalla completa con X, Ficha y Añadir en la columna derecha y «Comenzar a leer»;
  - gestos: hacia arriba, el libro siguiente; hacia abajo, el anterior; un rebote en el último;
  - el Atrás de Android cierra primero la historia o la ficha.
- **Se reutiliza:**
  - `armarEstanterias`, `secuenciaVisual`, `estanteriaDe` y la posición del lomo en `sessionStorage` (hoy está en `SalaVista.jsx`, y conviene moverla a `utils/estanteria.js`);
  - `Historia` (prop `lateral`), `useHistoria`, `PanelHistoria` y `AccionesHistoria` de `SalaVista`;
  - `CabeceraTiendaMobile` y `SalaCard`;
  - la variante `.hist-velo-movil` de `historia.css`.
- **Pendiente pequeño:** el aviso «quedó en tu biblioteca · N de 5» de la principal y el catálogo (hoy solo está en la sala).
- **Pendiente para el final (Juan, 1 oct):** en pantallas anchas (≈2000 px o más) la sala deja un gran hueco vacío a la derecha de las baldas, entre los libros y el panel. Las portadas tienen un tope de 140 px (`--cw` en `sala.css`) y las baldas ocupan todo el ancho. Se resuelve al terminar las fases.
