# BookReader

**Tipo:** Componente renderizador (memoizado)  
**Ruta:** `src/components/lector/BookReader.jsx`  
**Plataforma:** Web (desktop)

## Propósito

Renderiza las páginas del libro desktop con su chrome de controles. Es un componente "tonto" desde el punto de vista de datos: recibe las páginas ya paginadas y delega toda la lógica de datos al orquestador (`Lector.jsx`). Contiene la geometría visual del libro (lomo, cantos, doble página, LED glow).

## Entradas (props)

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `chapter` | `Capitulo` | — | Capítulo actual (para título y número) |
| `chapters` | `Capitulo[]` | — | Lista de todos los capítulos (para el selector) |
| `chapterIndex` | `number` | — | Índice del capítulo actual |
| `paginas` | `Page[]` | — | Páginas del capítulo (de `paginarParrafos`) |
| `pageIndex` | `number` | — | Índice de la página visible |
| `doubleView` | `boolean` | — | Doble vs. una página |
| `mediaByParrafo` | `object` | — | Media indexada por párrafo |
| `onPlaySfx` | `fn` | — | Reproduce audio puntual |
| `onPrevPage` | `fn` | — | Navegar página anterior |
| `onNextPage` | `fn` | — | Navegar página siguiente |
| `onNextChapter` | `fn` | — | Avanzar al siguiente capítulo |
| `onToggleView` | `fn` | — | Alternar doble/simple página |
| `onChapterSelect` | `fn(idx)` | — | Saltar a un capítulo |
| `onTextSelect` | `fn` | — | Callback cuando el usuario selecciona texto |
| `pageW` | `number` | `470` | Ancho de página en px |
| `pageH` | `number` | `560` | Alto de página en px |
| `fontSize` | `number` | `18` | Tamaño de fuente en px |
| `readingFont` | `string` | Crimson Text | CSS de font-family |
| `readingTheme` | `string` | `'light'` | Paleta de colores |
| `onFontSize` | `fn` | — | Callback para cambiar tamaño |
| `onReadingFont` | `fn` | — | Callback para cambiar fuente |
| `onReadingTheme` | `fn` | — | Callback para cambiar tema |
| `xrayOpen` | `boolean` | `false` | Si el X-ray está abierto |
| `xrayItems` | `array` | `[]` | Personajes/términos del capítulo |
| `onToggleXray` | `fn` | — | Toggle del panel X-ray |
| `onXrayItemClick` | `fn(id)` | — | Click en item del X-ray → navega a Cartelera |
| `ambient` | `Media \| null` | `null` | Audio de ambiente del capítulo |
| `ledColor` | `string` | `'none'` | Color del glow LED |
| `onLedColor` | `fn` | `null` | Callback para cambiar el LED |
| `esNoficcion` | `boolean` | `false` | Usa WhiteNoisePlayer en vez de RecorderPlayer |

## Componentes internos

### `PageContent` (memo)

Renderiza los párrafos de una página. Para cada párrafo con `sfx` (audio explícito):
1. Busca la frase ancla (`metadata.texto_ref`) dentro del párrafo con `indexOf`.
2. Si la frase no se encuentra exacta (puede estar cortada por la paginación), intenta `findPrefixAtEnd` (la frase empezó al final de esta página, continúa en la siguiente) y `findSuffixAtStart` (la frase empezó en la página anterior, termina acá).
3. Envuelve la frase encontrada en `<span class="sfx-glow">` con onClick que dispara el audio.
4. Si el audio no tiene `texto_ref`, aplica el glow al párrafo completo.

Usa `data-parrafo-id` en cada `<p>` para que el sistema de subrayado pueda identificar el párrafo de la selección.

### `ChapterSelect`

Selector de capítulos en píldora. Al abrir, mide la posición del botón con `getBoundingClientRect()` y renderiza el menú con `createPortal` en `document.body` — evita problemas de `overflow:hidden` en ancestros.

### `TypographyControl`

Panel desplegable de tipografía (tamaño + fuente + tema + LED). Mismo patrón de portal que `ChapterSelect`. Opciones de LED: None, Azul (`50,130,255`), Rojo (`220,50,50`), Verde (`40,200,80`) — los valores RGB se usan en el `drop-shadow` de `.book-shadow`.

### `Leaf` (memo)

Una hoja individual del libro (`side: 'left' | 'right' | 'single'`). Aplica:
- Gradiente de sombra interior (simula el lomo): `inset -16px 0 26px` en la izquierda, `inset 16px 0 26px` en la derecha.
- Líneas horizontales via `repeating-linear-gradient` (de `pal.lineRGBA`).
- Padding proporcional al ancho de página (`pageW * 0.11`).
- Número de página en esquina exterior.

### `SideTurn`

Lateral clicable de la hoja para avanzar/retroceder páginas. En hover muestra un gradiente sutil y una esquina doblada (triángulo CSS en la esquina inferior) con transición de `border-width`.

## Decisiones no obvias

**`findPrefixAtEnd` / `findSuffixAtStart`:** Cuando la paginación corta un párrafo en medio de la frase ancla de un audio, el fragmento visible no contiene la frase completa. Estos helpers buscan coincidencias parciales (inicio o final de la frase) para aplicar el glow aunque la frase esté dividida entre páginas. Viven en `src/utils/readerHelpers.js` (compartidos con `LectorMobile.jsx`).

**Doble página con "lomo" central:** Entre las dos hojas hay un `<div>` de 20px con `background: linear-gradient(...)` y `box-shadow: inset ...` que simula la encuadernación. Los cantos laterales son listas de líneas alternas con `tint(pageEdge, -0.12)` para dar profundidad de papel.

**`React.memo` en BookReader, Leaf y PageContent:** El orquestador `Lector.jsx` re-renderiza al escribir en el selector de texto (hover) y en otros efectos menores. Sin memo, las 2 hojas + su contenido se repintarían en cada re-render, incluso sin cambios en los datos de lectura.

**Audio en `soundOpen` como div oculto:** El panel de `RecorderPlayer` o `WhiteNoisePlayer` no se desmonta al cerrarse — se oculta con `display: soundOpen ? 'block' : 'none'`. Esto conserva el estado de reproducción del audio sin interrumpirlo al cerrar el panel.

## Conexiones de salida

```
BookReader
  ├─ PageContent       ← párrafos + audio anclado
  │   └─ sfx-glow spans
  ├─ ChapterSelect     ← selector de capítulo (portal)
  ├─ TypographyControl ← panel tipografía/tema/LED (portal)
  ├─ RecorderPlayer    ← audio de ambiente (ficción)
  ├─ WhiteNoisePlayer  ← ruido generativo (no ficción)
  ├─ Leaf (×2)         ← hojas de la página
  │   └─ SideTurn (×1 por hoja)
  └─ getReaderPalette  ← colores de la hoja
```
