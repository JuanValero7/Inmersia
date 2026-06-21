# Lector (VistaLectura)

**Tipo:** Componente orquestador  
**Ruta:** `src/components/Lector.jsx`  
**Plataforma:** Web (desktop)  
**Export:** `default VistaLectura`

## Propósito

Orquestador visual del Lector desktop. Gestiona la geometría de doble página, la medición DOM de alturas de párrafos, la paginación, la navegación entre páginas y capítulos, el subrayado de texto, el tour guiado y la composición de todos los sub-componentes del Lector (BookReader, PolaroidStack, Notebook, SuperuserSoundsPanel, etc.).

Comparte la lógica de datos con `LectorMobile.jsx` via `useLectorData`. Solo vive acá lo que depende de la geometría desktop (doble página, medición DOM, progreso por página).

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `book` | `object` | Libro a leer (mapeado por LectorRoute) |
| `onGoBack` | `fn` | Navega a `/biblioteca` |
| `onGoCartelera` | `fn(itemId?)` | Navega a `/cartelera/:slug` con jump opcional |
| `onGoForo` | `fn` | Navega al foro del libro |
| `startWithNotebook` | `boolean` | Si debe abrir el Cuaderno al montar |
| `onNotebookStarted` | `fn` | Callback que limpia `startWithNotebook` en App |
| `isSuperuser` | `boolean` | Habilita el panel de media |
| `guestMode` | `boolean` | Si es un invitado (sin cuenta) |
| `onRequestAuth` | `fn(tab?)` | Navega a `/auth` para registro/login |

## Estado local

| Variable | Default | Descripción |
|---|---|---|
| `chapterIndex` | `0` | Índice del capítulo actual |
| `pageIndex` | `0` | Índice de la página actual |
| `doubleView` | `true` | Doble vs. una página |
| `notebookOpen` | `false` | Cuaderno abierto |
| `pendingChapter` | `null` | Capítulo al que se avanzará al cerrar el Cuaderno |
| `explorarOpen` | `false` | Popup "Explorar" (Foro / Investigación / Biblioteca) |
| `xrayOpen` | `false` | Panel X-ray (personajes/glosario) |
| `showPaywall` | `false` | Paywall de invitados |
| `pendingSelection` | `null` | Texto seleccionado pendiente de subrayar |
| `adminPanelOpen` | `false` | Panel de media del superusuario |
| `geom` | calculado | `{ pageW, pageH, charsPerLine, lineHeight, maxH }` |
| `measuredHeights` | `{}` | Alturas reales de párrafos medidas del DOM |
| `titleH` | `0` | Alto del encabezado de capítulo (reserva espacio en pág. 0) |
| `resenaOpen` | `false` | Modal de reseña |
| `fontSize` | `19` | Tamaño de fuente (localStorage) |
| `readingFont` | Crimson Text | Fuente de lectura (localStorage) |
| `readingTheme` | `'light'` | Tema claro/oscuro (localStorage) |
| `ledColor` | `'none'` | Color del glow LED (localStorage) |

## Flujo principal

### Geometría y paginación

1. `computeGeom(doubleView, fontSize, readingFont)` calcula `pageW`, `pageH`, `charsPerLine`, `lineHeight`, `maxH` según el viewport y las preferencias del usuario. Se recalcula en cada resize (con `requestAnimationFrame` como debounce).
2. Al cambiar el capítulo o sus preferencias, un `useEffect` crea un div oculto (`position:fixed; top:-9999px`) y renderiza todos los párrafos en él para medir `offsetHeight` con un único reflow del browser. Guarda los resultados en `measuredHeights` y `titleH`.
3. `currentPaginas` es un `useMemo` que llama a `paginarParrafos` con las alturas medidas + `firstPageMaxH = maxH - titleH`.

### Navegación

- **Página anterior/siguiente:** `handlePrevPage` / `handleNextPage`. Avanzan `pageIndex` en pasos de 2 (doble página) o 1 (simple). Al llegar al borde del capítulo, cambian `chapterIndex`.
- **Siguiente capítulo (no invitado):** Abre el `Notebook` modal antes de avanzar. Al cerrar el Cuaderno, `handleCloseNotebook` llama a `persistChapterAdvance(pendingChapter)` y luego salta al capítulo.
- **Siguiente capítulo (invitado):** Avanza sin cuaderno. Al llegar al fin del segundo capítulo, muestra el paywall.

### Progreso

- Cada vez que cambia `chapterIndex` o `pageIndex`, un `useEffect` hace un UPSERT en `progreso_lectura` con el `id` del primer párrafo de la página visible, con un debounce de 600ms.
- Al llegar a la última página del último capítulo, actualiza `porcentaje = 100` y `bibliotecas_usuarios.leido = true`.
- Ambos efectos tienen el guard `if (!restoredRef.current) return` para no guardar antes de haber restaurado la posición inicial.

### Imágenes (PolaroidStack)

`visibleImages` es un `useMemo` que recorre los párrafos de todas las páginas hasta la actual (inclusive la derecha en doble vista) y filtra los media de tipo `'imagen'` y `origen === 'explicito'`. Las imágenes se van "revelando" a medida que el lector avanza — no todas aparecen desde la primera página.

## Componentes internos

| Componente | Función |
|---|---|
| `NavButton` | Botón pill con ícono SVG (Explorar, Reseña) |
| `EstrellaLector` | 5 estrellas clicables para el formulario de reseña |

## Conexiones de salida

```
VistaLectura
  ├─ useLectorData          ← datos compartidos
  ├─ useXrayItems           ← personajes/glosario del capítulo
  ├─ paginarParrafos        ← distribución en páginas
  ├─ BookReader             ← renderizador de doble página + controles
  ├─ PolaroidStack          ← imágenes reveladas en la página actual
  ├─ Notebook               ← cuaderno modal
  ├─ SuperuserSoundsPanel   ← panel lateral de media (solo superusuario)
  └─ supabase               ← UPSERT progreso, UPDATE 100%
```

## Decisiones no obvias

**Medición DOM con un único reflow:** Se crea un solo `<div>` con todos los párrafos y se leen todos los `offsetHeight` en una sola iteración (no un elemento por párrafo). Esto minimiza los reflows del browser — la alternativa naive de crear y medir elemento por elemento sería O(n) reflows.

**LED color como `drop-shadow` en el wrapper del libro:** El glow de LED se aplica via `filter: drop-shadow(...)` en el `div.book-shadow` que envuelve las hojas. Esto colorea el resplandor del libro sin afectar el texto ni los colores internos de la página.

**`isLast` en doble vista:** Se considera "última página" cuando `pageIndex >= total - 2` (no `total - 1`). En doble vista, la segunda hoja puede estar vacía ("fin del capítulo"), pero el indicador de avance ya debe mostrarse en la primera.

**`X-ray` cierra al cambiar capítulo:** Un `useEffect` con `[chapterIndex]` como dependencia cierra `xrayOpen`. Si no, el panel quedaría visible pero mostraría personajes del capítulo anterior mientras carga el siguiente.

**Tutorial solo para usuarios registrados:** `guestMode` desactiva el tour guiado deliberadamente — el localStorage de fases del tour es global. Si un invitado lo completara, el registro posterior no volvería a mostrarle las guías.

## Dependencias de datos (Supabase)

| Tabla | Columnas | Operación |
|---|---|---|
| `progreso_lectura` | `user_id, libro_id, ultimo_parrafo_id, updated_at` | UPSERT por página |
| `progreso_lectura` | `porcentaje, updated_at` | UPDATE al 100% |
| `bibliotecas_usuarios` | `leido` | UPDATE al 100% |

(El resto de queries Supabase va por `useLectorData`.)

## ⚠️ Features no implementadas

| Feature | Estado |
|---|---|
| Tabs "Novedades" y "Recomendaciones" en Biblioteca | No implementados (ver `Shelves.md`) |
| `progreso` en `bibliotecas_usuarios` | No existe la columna; la barra de progreso del hero siempre muestra "sin progreso" |
