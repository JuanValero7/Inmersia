# clay

**Tipo:** Tokens visuales + componente  
**Ruta:** `src/components/lector/clay.jsx`  
**Plataforma:** Compartido (desktop + mobile)

## Propósito

Define los tokens de color, gradientes y el componente `ClayButton` que dan coherencia visual al Lector. Es la fuente de verdad estética del módulo: chrome, páginas, modo noche. También expone la paleta de lectura (claro/oscuro) que afecta hoja y fondo del libro.

Está en `src/components/lector/` aunque sus tokens los usan componentes de todo el módulo Lector — no es utilidad global del proyecto.

## Lo que exporta

| Export | Tipo | Descripción |
|---|---|---|
| `INK` | `string` | Color de tinta base `#4a3622` |
| `ACCENT` | `string` | Terracota `#cf7b4c` — botones primarios, barra de progreso |
| `tint(hex, amt)` | `fn` | Mezcla `hex` con blanco (`amt > 0`) o negro (`amt < 0`) |
| `theme` | `object` | Tokens del chrome (navBg, navBorder, deskBg, pageBg, etc.) |
| `getReaderPalette(mode)` | `fn` | Devuelve `READER_LIGHT` o `READER_DARK` según `mode` |
| `ClayButton` | `component` | Botón pill con borde ink + sombra offset |

### `theme` (campos relevantes)

| Campo | Descripción |
|---|---|
| `deskBg` | Gradiente del escritorio (fondo detrás del libro) |
| `vignette` | Viñeta radial oscura superpuesta al fondo |
| `pageBg` | Gradiente de la hoja (modo claro) |
| `pageInk` | Color del texto de la página |
| `pageMeta` | Color de metadatos (nro. de página, separadores) |
| `pageEdge` | Color del canto de la hoja (cantos laterales) |
| `navBg` | Fondo del chrome (pills, paneles) |
| `lineRGBA` | Color en `rgba` de las líneas horizontales de la hoja |

### `getReaderPalette(mode)`

| Parámetro | Tipo | Valores |
|---|---|---|
| `mode` | `string` | `'light'` \| `'dark'` |

Devuelve un objeto con los mismos campos que `theme` pero ajustados para el modo elegido. El chrome (navBg, colores de botones) **no cambia** entre modos — solo cambia la hoja y el fondo del escritorio.

### `ClayButton`

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `children` | `ReactNode` | — | Contenido del botón |
| `onClick` | `fn` | — | Handler de click |
| `variant` | `'ghost'` \| `'primary'` | `'ghost'` | `'primary'` → fondo ACCENT + texto blanco |
| `style` | `object` | `{}` | Overrides de estilo |
| `title` | `string` | — | Tooltip |
| `disabled` | `boolean` | — | Reduce opacidad a 0.45, ignora clicks |

## Decisiones no obvias

**Chrome siempre claro:** `READER_LIGHT` y `READER_DARK` solo cambian `deskBg`, `vignette`, `pageBg`, `pageInk`, `pageMeta`, `pageEdge` y `lineRGBA`. Los tokens del chrome (`navBg`, `navText`, `navBorder`) son los mismos en ambos modos. Esto es deliberado: las pills y paneles de control se diseñaron sobre fondo claro y el contraste no escala bien a fondo oscuro.

**`tint` mezcla aditivamente, no multiplicativamente:** La función interpola entre el color base y blanco/negro. El parámetro `amt` es la fracción de mezcla (0.0–1.0), no una diferencia de luminosidad. Esto da resultados predecibles sin conversión a HSL.

**Formato `rgb()` en `lineRGBA`:** Se usa en `repeating-linear-gradient` para las rayas de la hoja. Necesita `rgba` porque las líneas son semitransparentes sobre el gradiente de la página.

## Conexiones de salida

- `theme` y `getReaderPalette` — importados por `BookReader.jsx`, `Lector.jsx`, `Notebook.jsx`, `RecorderPlayer.jsx`, `PolaroidStack.jsx`, `SuperuserSoundsPanel.jsx`, `WhiteNoisePlayer.jsx`, `LectorMobile.jsx`
- `INK` y `ACCENT` — importados directamente por `LectorMobile.jsx` (sin usar el objeto `theme`)
- `ClayButton` — usado en `Notebook.jsx` y `Lector.jsx`
