# LectorMobile

**Tipo:** Componente orquestador  
**Ruta:** `src/components/mobile/LectorMobile.jsx`  
**Plataforma:** Mobile  
**Export:** `default LectorMobile`

## Propósito

Cáscara mobile del Lector inmersivo. Reescribe solo el chrome respecto al desktop: layout vertical de una sola página, controles como sheets deslizables desde abajo, mascota gato como launcher de acciones, y sistema de subrayado multi-página. Reutiliza `useLectorData`, `paginarParrafos`, `Notebook` y `SuperuserSoundsPanel` exactamente igual que el desktop.

Mismo contrato de props que `Lector.jsx`.

## Entradas (props)

Idénticas a `Lector.jsx` (ver [Lector.md](Lector.md)):  
`book`, `onGoBack`, `onGoCartelera`, `onGoForo`, `startWithNotebook`, `onNotebookStarted`, `isSuperuser`, `guestMode`, `onRequestAuth`.

## Estado local (selección)

| Variable | Descripción |
|---|---|
| `chapterIndex`, `pageIndex` | Navegación de lectura |
| `sheet` | Sheet activa: `'chapters' \| 'typo' \| 'audio' \| 'noise' \| 'nav' \| 'xray' \| null` |
| `imageOpen` | Overlay de imagen abierto |
| `notebookOpen` | Cuaderno abierto |
| `catOpen` | Tray del gato abierto |
| `pendingChapter` | Capítulo al que se avanzará al cerrar el Cuaderno |
| `modoSubrayado` | Subrayado persistente activo |
| `pendingConfirm` | Fragmento de texto seleccionado pendiente de confirmar |
| `segmentos` | Segmentos acumulados de páginas anteriores (subrayado multi-página) |
| `geom` | `{ contentW, contentH, charsPerLine, lineH }` medido del DOM |
| `playing`, `volume` | Estado del audio de ambiente |

## Geometría mobile

`measureGeom()` lee el alto real disponible para el contenido del libro usando `data-lm-pagebox` como referencia del DOM. Descuenta el espacio que ocupa la mascota en la parte inferior. Se llama en `useLayoutEffect` post-render y en resize con debounce. Esto garantiza que la paginación use el alto real visible y no el del viewport completo.

## Flujo principal

El flujo de datos es idéntico al desktop (ver [Lector.md](Lector.md) y [useLectorData.md](useLectorData.md)). Las diferencias están en el chrome:

1. **Header compacto:** Nombre del libro + botón brújula (abre `NavSheet`). Selector de capítulo como píldora naranja. Botón `Aa` para tipografía.
2. **Página única (`MobileBookPage`):** Ocupa todo el viewport disponible. Los laterales clicables avanzan/retroceden. El gesto de selección de texto tiene un delay de 50ms para que Chrome finalice la selección antes de leerla.
3. **Mascota gato:** Botón flotante abajo-derecha. Al tocarlo abre un tray horizontal con 4 opciones:
   - `CassetteIcon` → audio de ambiente (ficción) / ruido (no ficción)
   - `PolaroidsIcon` → overlay de imágenes del capítulo
   - `SpiralNotebookIcon` → Cuaderno
   - `HighlighterIcon` → modo subrayado
4. **Audio de ambiente:** `useAmbientPlayer(currentAmbient?.url)` gestiona el ciclo de vida del audio. Al cambiar de capítulo, el hook detecta el cambio de URL, pausa, actualiza `src`, carga y reanuda si estaba playing.
5. **Autoshow de imagen:** Si `autoImages` está activado y hay imágenes en la página actual, abre `ImageOverlay` automáticamente al cambiar de página.

## Subrayado mobile (multi-página)

El subrayado en mobile es diferente al desktop:

1. El usuario activa **modo subrayado** tocando el marcador en el tray del gato.
2. Selecciona texto en la página actual. Después de 2.5s (o al tocar el texto), se detecta la selección y aparece `ConfirmSubrayadoSheet`.
3. El sheet ofrece tres opciones:
   - **Descartar:** limpia todo.
   - **+ Siguiente página:** guarda el fragmento en `segmentos` y avanza de página, permitiendo que el usuario seleccione en la siguiente página también.
   - **Guardar:** une todos los `segmentos` + el fragmento actual y llama a `subrayar()`.
4. Al guardar, `segmentos` se limpia y el modo subrayado se desactiva.

Este flujo permite subrayar pasajes que abarcan varias páginas, cosa que en desktop se hace en una sola selección porque la página es más grande.

## Componentes internos (sheets y overlays)

| Componente | Trigger | Descripción |
|---|---|---|
| `ChapterSheet` | Píldora capítulo | Lista de capítulos para navegar |
| `TypoSheet` | Botón `Aa` | Tamaño, fuente, tema claro/oscuro |
| `AudioSheet` | Cassette (gato) | Reproductor de ambiente — ficción |
| `WhiteNoiseSheet` | Cassette (gato) | Ruido generativo — no ficción |
| `NavSheet` | Brújula (header) | Biblioteca / Investigación / Foro |
| `XraySheet` | Botón X-ray | Personajes o glosario del capítulo |
| `ImageOverlay` | Polaroids (gato) | Visor de imágenes del capítulo |
| `ResenaSheet` | Botón estrella | Formulario de reseña (cuando `isLeido`) |
| `ConfirmSubrayadoSheet` | Selección de texto | Confirmación de subrayado (uno o multi-página) |

**`MobileBookPage`** (`src/components/mobile/lector/MobileBookPage.jsx`) — Única hoja del libro. Reutiliza la misma lógica de audio anclado (`texto_ref`) que `PageContent` en desktop. Usa `findPrefixAtEnd` y `findSuffixAtStart` de `src/utils/readerHelpers.js`.

## Conexiones de salida

```
LectorMobile
  ├─ useLectorData          ← datos compartidos (igual al desktop)
  ├─ useXrayItems           ← personajes/glosario
  ├─ paginarParrafos        ← paginación (sin measuredHeights)
  ├─ Notebook               ← cuaderno reutilizado ídem desktop
  ├─ SuperuserSoundsPanel   ← panel de media (solo superusuario)
  ├─ useAmbientPlayer       ← audio de ambiente (ficción)
  ├─ MobileBookPage         ← hoja única del libro (src/components/mobile/lector/)
  ├─ LectorSheets.jsx       ← sheets y overlays extraídos (XraySheet, ChapterSheet, TypoSheet,
  │                            WhiteNoiseSheet, AudioSheet, NavSheet, ImageOverlay,
  │                            ResenaSheet, ConfirmSubrayadoSheet)
  └─ supabase               ← UPSERT progreso, UPDATE 100%
```

## Decisiones no obvias

**Sin `measuredHeights` en la paginación:** Mobile no hace la medición DOM. Usa solo estimación por caracteres con `FONT_WIDTH` y `lineH = fontSize * 1.72`. La medición DOM requiere un render extra con el div oculto, lo cual en mobile es más costoso y la estimación es suficientemente precisa para una sola columna de texto.

**`findPrefixAtEnd` / `findSuffixAtStart`:** Ahora viven en `src/utils/readerHelpers.js`, compartidas con `BookReader.jsx`. (`splitSentences` estaba definida pero nunca usada; se eliminó.)

**Preferencias compartidas con desktop via localStorage:** Las claves `inm_lector_fontSize`, `inm_lector_font` e `inm_lector_theme` son las mismas en desktop y mobile. Si el usuario cambia el tamaño en desktop y abre mobile, verá el mismo tamaño (y viceversa).

**`setSheetRaw` con wrapper `setSheet`:** No visible en el fragmento, pero el componente tiene un wrapper interno que cierra el tray del gato antes de abrir un sheet — evita que gato y sheet estén abiertos al mismo tiempo.

## Deuda técnica resuelta

- **`BookPage` inline** → extraído a `MobileBookPage.jsx` (y sheets a `LectorSheets.jsx`). Archivo reducido de ~1097 a ~629 líneas.
- **`findPrefixAtEnd` / `findSuffixAtStart` duplicadas** → movidas a `src/utils/readerHelpers.js`.
- **Audio de ambiente duplicado** → reemplazado por `useAmbientPlayer`.

## Nota

**Paginación sin `measuredHeights`:** Mobile no hace la medición DOM. Usa solo estimación por caracteres con `FONT_WIDTH` y `lineH = fontSize * 1.72`. La medición DOM requiere un render extra con el div oculto, lo cual en mobile es más costoso y la estimación es suficientemente precisa para una sola columna de texto.
