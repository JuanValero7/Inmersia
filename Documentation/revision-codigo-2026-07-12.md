# Revisión de código — 12 jul 2026

Detección de bugs, código muerto y problemas de performance. **Solo detección, nada está arreglado.**
Severidad: 🔴 Alta · 🟠 Media · 🟡 Baja. Tipo: [BUG] [MUERTO] [PERF] [PENDIENTE].

---

## A. Problemas generales (transversales)

### A1. 🔴 [BUG] `pushBookId` nunca guarda "últimos libros" — `src/App.jsx:128-139`
El `supabase.from('preferencias_usuario').upsert(...)` se llama **sin `await` ni `.then()`** dentro del updater de `setLastOpenedBookIds`. En supabase-js v2 (usás `^2.45.4`) las queries son *lazy thenables*: **la petición HTTP nunca se envía** si nadie la "awaitea". Resultado: `ultimos_libros` nunca se persiste desde aquí (solo vive en memoria hasta recargar). Además, ejecutar efectos secundarios dentro de un updater de `setState` es un antipatrón (el updater debe ser puro).

### A2. 🔴 [BUG] Sonidos de ambiente inexistentes — `src/hooks/useWhiteNoise.js:18-21` vs `public/sounds/`
`AMBIENCIAS` referencia `/sounds/cafe.mp3` y `/sounds/bosque.mp3`, pero en `public/sounds/` solo existen `lluvia.mp3` y `fuego.mp3`. Elegir "Café" o "Bosque" produce un 404 silencioso (opción muda). Además hay dos mp3 huérfanos sin referenciar: `guillermoanaya-water-relaxing-sound-121599 (1).mp3` y `miaquirele-calm-shoreline-waves-baltic-sea-427923 (1).mp3`.

### A3. 🔴 [MUERTO] Carpeta `src/public/` completa (~1 MB)
Vite solo sirve `public/` (raíz); `src/public/` **no se sirve ni se importa desde ningún lado**. Casi todo son duplicados de `public/assets/` (fondos, gatos, decor, logos). `src/public/assets/lector/cat-mascot.png` solo existe ahí y tampoco se referencia. Toda la carpeta es peso muerto en el repo.

### A4. 🟠 [MUERTO] Assets huérfanos en `public/assets/`
Sin ninguna referencia en `src/` ni CSS:
- `assets/foro-cats.webp` y `assets/foro-libros.webp` (el foro usa `foro-gatos.webp`)
- `assets/wallpapers/acuarela-pattern.webp`, `acuarela-pattern 3.webp`, `acuarela-pattern3.webp`, `acuarela-pattern4.jpg`, `acuarela-pattern5.webp` (las 5)

### A5. 🟠 [MUERTO] Dependencia `driver.js` sin uso — `package.json`
No hay ningún `import` de `driver.js` en `src/` (los comentarios de "tour" en Foro/useForoData mencionan un tour que ya no existe en el código). Se instala y empaqueta en vano.

### A6. 🟠 [BUG-riesgo] Duplicación Tienda desktop/mobile ya divergió
`Tienda.jsx` y `mobile/TiendaMobile.jsx` duplican ~100 líneas idénticas (fetch, comprar, comprarYLeer, reqId); `CatalogoInterior.jsx` y `CatalogoInteriorMobile.jsx` duplican `Pagination`, `CoverCard`, `BookCard` y el filtrado completo. Ya produjo el bug B1 (filtro `visible` solo en desktop). Candidato a hook compartido (`useTiendaData`) como se hizo con `useBiblioteca`/`useLectorData`.

### A7. 🟠 [BUG] X-ray no acumula personajes de capítulos anteriores — `src/hooks/useXrayItems.js:17`
El comentario dice "personajes visibles **hasta** el capítulo actual", pero la query filtra `.eq('capitulo_numero', chapterNum)`: solo trae los del capítulo exacto. Un personaje presentado en el cap. 2 no aparece en el X-ray del cap. 5. O el comentario o la query están mal (probablemente debería ser `.lte`+dedup, como hace el Álbum/Cartelera).

### A8. 🟡 [BUG visual] `border: 'none'` pisa `borderBottom` en style objects
En objetos de estilo JS la clave `border` (shorthand) definida **después** de `borderBottom` la anula: el separador entre items nunca se pinta.
- `src/components/lector/BookReader.jsx:366` (items del X-ray desktop)
- `src/components/mobile/lector/LectorSheets.jsx:36` (XraySheet mobile)

### A9. 🟠 [BUG-riesgo] Errores de Supabase ignorados en escrituras clave
Patrón repetido: se hace `await supabase...` sin mirar `error`, y la UI asume éxito. Los más sensibles:
- `useBiblioteca.assignCategoriaToBook` (no revisa error)
- `useResena.submitResena` y `useLectorData.submitResena` (marcan la reseña como guardada aunque falle)
- `useLectorData.subrayar` y `persistChapterAdvance`
- `Notebook.handleClose` (guardado de predicciones/anotaciones)
- `Auth.jsx` registro (ver F1, el más grave)

### A10. 🟡 [MUERTO] `src/.DS_Store` versionado en el repo.

---

## B. Tienda

### B1. 🔴 [BUG] El catálogo móvil muestra libros ocultos — `src/components/mobile/TiendaMobile.jsx:33-39`
El fetch de `libros` **no filtra `.eq('visible', true)`** (el desktop `Tienda.jsx:44-51` sí lo hace). En móvil se ven libros marcados como no visibles en la base.

### B2. 🟠 [BUG] En móvil el filtro Ficción/No ficción puede quedar inaccesible — `CatalogoInteriorMobile.jsx:263`
El botón "Filtrar" (que da acceso al filtro de Tipo dentro del overlay) solo se renderiza si `availableCats.length > 0`. Si ningún libro tiene categorías, en móvil no hay forma de filtrar por tipo; en desktop la barra de Tipos se muestra siempre.

### B3. 🟡 [PERF] Memo de `list` inútil — `CatalogoInterior.jsx:134-145` y su gemelo mobile
`tieneLibro` es una arrow function nueva en cada render de `Tienda.jsx`, y está en las deps del `useMemo` → el filtrado+sort de todo el catálogo se recalcula en **cada** render (al tipear, abrir panel, etc.).

### B4. 🟡 [PERF] "Frases más subrayadas" descarga todos los subrayados del libro — `PanelLibro.jsx:90-94,116-121`
Trae todas las filas de `subrayados_usuario` del libro para contar el top 3 en cliente. Con un libro popular esto crece sin límite; candidato a RPC/vista con `group by`.

### B5. 🟡 [BUG menor] `loading` puede quedar colgado en fetch obsoleto — `Tienda.jsx:39-65` / `TiendaMobile.jsx`
Si `myId !== reqIdRef.current` el fetch retorna temprano sin `setLoading(false)`. Hoy lo rescata el fetch más nuevo, pero el early-return de la 2ª comprobación (después de cargar catálogo) deja el catálogo nuevo puesto y el loading en true si el componente sigue montado.

### B6. 🟡 [PENDIENTE ya conocido] Query del catálogo sin `.limit()`
La paginación es client-side (PG_SIZE 15) pero se descargan todos los libros con todas las columnas. Pendiente conocido para la fase High Severity ("Cargar más" primero).

---

## C. Biblioteca

### C1. 🟠 [MUERTO] `CoverShelf` — `src/components/biblioteca/clay/Shelves.jsx:203-228` + import en `Biblioteca.jsx:12`
Definido, memoizado, exportado e importado… y nunca renderizado (lo reemplazó `UltimosAbiertos`). El propio import tiene el comentario "Este capaz ya no es necesario". Confirmado: no se usa en ningún lado.

### C2. 🟠 [MUERTO] `CatalogRow` — `src/components/biblioteca/clay/HeaderSwimlane.jsx:81-105`
Reemplazado por `NovedadesSpotlight`/`RecomendacionSpotlight`; ya no se referencia.

### C3. 🟡 [MUERTO] Prop `ink` fantasma en `BookCover`
`HeaderSwimlane.jsx` y `Shelves.jsx` llaman `<BookCover ... ink={ink} />` pero la firma de `BookCover` (`clay/helpers.jsx:21`) solo acepta `{ book, h }`. Prop muerta que sugiere una firma vieja.

### C4. 🟡 [MUERTO] Rama `activeCategory === 'none'` — `Biblioteca.jsx:43,180`
`setCategory` solo recibe `null` o un uuid; el valor `'none'` nunca se asigna, así que el mapeo `activeCategory === 'none' ? SIN_CATEGORIA_ID : ...` es inalcanzable. Consecuencia funcional: en desktop **no existe** chip "Sin categoría" en el filtro (en móvil sí, vía `FilterScreen`). Decidir: agregar el chip o borrar la rama.

### C5. 🟡 [MUERTO] Re-exports sin consumidores
`lum` y `STORYBOOK` se re-exportan en `clay/helpers.jsx` y `bibmHelpers.jsx` pero ningún componente los importa (solo `coverHelpers.shared.js` usa `STORYBOOK` internamente). `lum` no se usa en ningún lado.

### C6. 🟡 [PERF] Catálogo completo para Novedades/Recomendaciones — `src/hooks/useBiblioteca.js:113-122`
Se baja toda la tabla `libros` (visible) con 14 columnas para terminar mostrando 5+5 items. Bastaría un `.limit()` para novedades y una selección más corta, o reutilizar la query de la Tienda.

### C7. 🟡 [BUG menor] `recomendaciones` no rota a medianoche — `useBiblioteca.js:189-192`
La seed usa `new Date()` **dentro** del useMemo: si la sesión queda abierta pasada la medianoche no se recalcula (deps: `elegiblesTienda`, `user.id`). Cosmético.

---

## D. Lector

### D1. 🟠 [MUERTO] Paginador viejo `paginarParrafos` + `FILL_FACTOR` — `src/utils/lectorPagination.js:1-126`
Desktop y mobile usan los paginadores DOM (`paginarParrafosDesktopDOM` / `paginarParrafosMobileDOM`). El paginador por estimación solo lo importa **el test** (`lectorPagination.test.js`): ~125 líneas de producción muertas y un test que valida código que ya no corre. Decidir: borrar ambos o migrar los tests al paginador DOM.

### D2. 🟡 [MUERTO] `computeGeom` calcula valores sin uso — `src/components/Lector.jsx:26-39`
`charsPerLine`, `lineHeight` y `maxH` (y con ellos el uso de `FONT_WIDTH`) son restos del paginador viejo; el componente solo consume `pageW`/`pageH`. En `LectorMobile.jsx:235` pasa igual con `geom.charsPerLine` (se calcula y compara pero nunca se consume).

### D3. 🟠 [MUERTO] `LupaIcon` y `ForoIcon` — `src/components/lector/RecorderPlayer.jsx:58-115`
Exportados, nunca importados (el popup Explorar usa SVGs inline).

### D4. 🟡 [MUERTO] Selección de texto muerta en `MobileBookPage.jsx`
`onSelectText`, `handleSel` y los handlers `onMouseUp/onTouchEnd` que lo llaman nunca reciben la prop (LectorMobile usa su propio listener `selectionchange`). El `import { findPrefixAtEnd... }` sí se usa para sfx, pero todo el camino `handleSel` es inerte.

### D5. 🟠 [BUG] Ruido blanco puede arrancar solo — `BookReader.jsx:343-348`
`WhiteNoisePlayer`/`RecorderPlayer` están **siempre montados** (solo se oculta el div con `display:none`). `useWhiteNoise` arranca según la preferencia guardada en localStorage: si el usuario dejó "Blanco" activo, al abrir cualquier libro de no ficción el generador se crea y empieza a sonar sin abrir el panel (tras el primer gesto que desbloquee el AudioContext). Montarlos solo cuando `soundOpen` (o guardar también un flag on/off) lo arregla.

### D6. 🟡 [BUG menor] Doble cleanup de AudioContext — `src/hooks/useWhiteNoise.js:107-110,149-155`
Al desmontar, el cleanup del efecto de `tipo` y el efecto final llaman ambos `src.stop()`/`ctx.close()` sobre el mismo contexto → segunda llamada lanza (promise rejection silenciosa). Cosmético pero ensucia consola.

### D7. 🟡 [BUG menor] Espacio (SFX) no encuentra anclas partidas — `Lector.jsx:300-317`
`visibleSfx` filtra sfx anclados con `contenido.includes(texto_ref)` a secas; el render (`PageContent`) sí usa `findPrefixAtEnd/findSuffixAtStart` para fragmentos partidos por la paginación. Un sfx cuyo texto quedó dividido entre dos páginas brilla en pantalla pero la tecla espacio no lo dispara.

### D8. 🟡 [BUG menor] Notebook no permite borrar una nota — `src/components/lector/Notebook.jsx:70-90`
`handleClose` solo hace upsert **si hay texto**: vaciar una predicción/anotación existente y cerrar no borra ni actualiza nada; al reabrir reaparece el texto viejo.

### D9. 🟡 [BUG menor] Auto-imagen no se dispara en la primera página — `LectorMobile.jsx:405-407`
El efecto depende de `[pageIndex, chapterIndex, autoImages]` pero lee `currentPageNewImages`; cuando la paginación termina tarde (fonts.ready) y el usuario sigue en la página 0, el efecto no se re-ejecuta y la imagen de esa página no se auto-abre.

### D10. 🟡 [BUG UX] Refrescar `/libro/:slug` expulsa al usuario logueado — `src/components/LectorRoute.jsx:52`
`currentBook` vive solo en memoria: con sesión activa y F5 en el lector, `currentBook` es null → `Navigate` a `/biblioteca`. Los invitados sí recuperan el libro por slug; los usuarios no. (Mismo patrón afecta el botón "volver" de Foro/Cartelera tras un refresh.)

---

## E. Cartelera (Investigación)

### E1. 🟠 [BUG] `seccionMeta('datos')` devuelve la meta equivocada en no ficción — `src/components/cartelera/carteleraHelpers.js:24-25`
`'datos'` existe en ambas listas: en ficción es "Pistas y detalles" (#7d8db5) y en no ficción "Referencias del mundo real" (#86ad9e, equivalente visual de Lugares). `seccionMeta` busca primero en `SECCIONES` (ficción), así que en libros de no ficción el tablero/lista/ficha de "Datos" muestra el subtítulo y color de la sección de ficción. Afecta a `BoardView`, `SectionView` (mobile), `CatDock` (que re-mapea con `seccionMeta`) y `Ficha`.

### E2. 🟠 [BUG] Salto desde X-ray con libro no ficción aterriza en sección inexistente
- Desktop `Cartelera.jsx:126-131`: el efecto de `jumpToItemId` corre con deps `[jumpToItemId]`; si el libro aún no cargó, `esNoficcion` es false → abre `'personajes'` aunque el libro sea no ficción.
- Mobile `CarteleraMobile.jsx:272-290`: mismo problema y peor: `TABLEROS_NOFICCION` no tiene `'personajes'` → si el usuario toca "Mural", `Tablero` es `undefined` y **el componente crashea** (lo atrapa el ErrorBoundary global).

### E3. 🟡 [BUG menor] Ficha desktop no selecciona el primer item al cargar — `Ficha.jsx:25`
`sel` se inicializa con `items[0]?.id` en el primer render, cuando `items` todavía está vacío (datos async); no hay efecto que lo sincronice cuando llegan. Entrar directo a una sección muestra "Elegí un nombre del índice" en vez de la primera ficha.

### E4. 🟡 [BUG menor] Keys duplicables en la línea de tiempo — `Ficha.jsx:158` y `CarteleraMobileFicha.jsx:109`
`key={e.capitulo_numero}`: dos entradas del mismo capítulo (posible en `entradas`) duplican key → warning y render inestable.

### E5. 🟡 [PERF] El corcho de Notas monta 4 tableros completos en miniatura — `TableroNotas.jsx:89-103`
Cada miniatura renderiza el tablero real a escala. En particular `TableroLugares` pinta un canvas de 700×860 (~602k píxeles con `createImageData`+loop JS) **por instancia** — en el corcho hay una de esas miniaturas, más la grande si estás en Lugares. En móviles modestos se nota al abrir Notas.

---

## F. Auth / Landing / Perfil

### F1. 🔴 [BUG-riesgo] Registro: inserts sin sesión ni manejo de errores — `src/components/Auth.jsx:57-70`
Tras `signUp`, se insertan `perfiles` y `bibliotecas_usuarios` (Manual del Explorador) **sin revisar `error`**. Si el proyecto exige confirmación de email, `data.session` es null → los inserts corren **sin usuario autenticado** y con RLS típico fallan en silencio: el usuario nuevo queda sin perfil y sin Manual. Verificar si una migración/trigger del lado DB lo cubre; si no, es un bug real de onboarding.

### F2. 🟠 [PENDIENTE visible] Perfil: Transacciones e Historial son datos falsos — `Perfil.jsx:67-78,216-288`
`TXN_DEMO` y `HIST_DEMO` hardcodeados (plan $5.99, libros que el usuario no tiene). Está etiquetado "Vista previa · datos de ejemplo", pero es UI de producción con datos inventados; Historial podría cablearse ya a `progreso_lectura`/`bibliotecas_usuarios.leido`.

### F3. 🟠 [PENDIENTE] Avatar solo en memoria — `src/hooks/usePerfilData.js:62-69`
`onPickAvatar` genera un data-URL local; no sube a Storage ni persiste (TODO documentado). El usuario "cambia" su foto y la pierde al recargar, sin aviso.

### F4. 🟡 [MUERTO] `HERO` en `src/components/landing/landingData.js:7-12`
Nadie lo importa; el texto del hero está duplicado hardcodeado en `Landing.jsx:49-56` (ya divergieron en estructura). Riesgo de editar el archivo de datos y que no pase nada.

### F5. 🟡 [MUERTO] `ilum` en `src/components/tienda/tiendaHelpers.jsx:27-31` — exportado, sin usos.

### F6. 🟡 [Cosmético] `index.html` título genérico "Biblioteca · Lectura · Cartelera" — no menciona Inmersia (afecta pestaña/SEO).

---

## G. Foro

### G1. 🟠 [BUG] La sesión de chat activa no filtra por libro — `src/components/foro/ForoChat.jsx:21-40`
Al montar busca en `chat_sesiones` cualquier sesión donde participe el usuario (`or(usuario_a/b)`), **sin filtrar por `libro_id`**: una sesión abierta en el foro de otro libro aparece como chat activo en este. Si es intencional (una sola sesión global), el insert con `libro_id` y el texto de la UI ("otros lectores de este libro") no lo reflejan.

### G2. 🟡 [BUG menor] Flash "No se encontró el foro" al entrar por URL directa — `src/hooks/useForoData.js:25-29`
Cuando el libro llega async (useBookBySlug), `loading` ya quedó en false y `foro` sigue null mientras corre el fetch → se ve el mensaje de error un instante.

### G3. 🟡 [BUG menor] El propio mensaje depende de realtime — `ForoChat.jsx:225-233`
`enviarMensaje` limpia el input y espera que el INSERT vuelva por la suscripción; si el insert falla o realtime está caído, el mensaje se esfuma sin feedback. Un append optimista (o revisar `error`) lo cubre.

### G4. 🟡 [UX menor] Responder/comentar resetea la paginación — `ForoComentarios.jsx:141-170`
`submitComentario`/`submitReply` refetchean la página 0: si el usuario había cargado más páginas, pierde la posición y los comentarios cargados.

---

## H. Álbum

### H1. 🟠 [BUG/Incompleto] La barajita "video" no tiene video — `album/Barajita.jsx:19-55` y `mobile/AlbumMobile.jsx:27-50`
La primera casilla siempre pinta etiqueta "video" + botón play, pero `heroItem` solo trae `{url, name}` de imagen y no hay ningún handler de reproducción (en desktop ni siquiera hay onClick). UI que promete algo que no existe; en la sección Capítulos (sin hero) la etiqueta cae sobre una barajita normal.

### H2. 🟠 [BUG UX] Ir a Foro/Investigación desde el Álbum rompe el botón "volver" — `album/LeftPage.jsx:43-47`, `AlbumMobile.jsx:309-313`
Se navega con `navigate()` directo sin actualizar `foroSource`/`carteleraSource`/`currentBook` en App: el "volver" del Foro/Cartelera usa el estado viejo (p. ej. te manda al lector de otro libro o a biblioteca en vez de regresar al Álbum).

### H3. 🟡 [PERF] Filtros O(n·m) en `useAlbum` — `src/hooks/useAlbum.js:208-224`
`carteleraImgRes.data.filter(...)` y `parrafoImgRes.data.filter(...)` corren dentro del `.map` de libros (recorren todas las filas por cada libro). Con biblioteca grande conviene indexar por `libro_id` una vez, como ya se hace con los otros datasets.

---

## Resumen por prioridad

| # | Severidad | Item |
|---|-----------|------|
| A1 | 🔴 | `pushBookId` upsert sin await: últimos libros nunca se guardan |
| A2 | 🔴 | cafe.mp3/bosque.mp3 no existen (404) |
| F1 | 🔴 | Registro: perfil + Manual pueden fallar en silencio (RLS/confirmación email) |
| B1 | 🟠 | Tienda móvil muestra libros no visibles |
| E1 | 🟠 | Meta equivocada de "Datos" en no ficción |
| E2 | 🟠 | Salto X-ray en no ficción → sección errónea / crash móvil |
| A7 | 🟠 | X-ray solo muestra personajes del capítulo exacto |
| D5 | 🟠 | Ruido blanco puede arrancar solo al abrir no ficción |
| G1 | 🟠 | Chat activo no filtra por libro |
| H1/H2 | 🟠 | Álbum: video fantasma + navegación con "volver" roto |
| A3–A5, C1–C2, D1–D4, F4–F5 | 🟠/🟡 | Código muerto (src/public, assets, componentes, paginador viejo, driver.js) |
| Resto | 🟡 | Bugs menores, perf y pendientes documentados arriba |
