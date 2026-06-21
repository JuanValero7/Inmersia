# readerConstants

**Tipo:** Constantes  
**Ruta:** `src/components/lector/readerConstants.js`  
**Plataforma:** Compartido (desktop + mobile)

## Propósito

Define las cuatro fuentes tipográficas disponibles para la lectura. Es el único lugar donde vive esta lista; tanto `BookReader` (desktop) como `TypoSheet` (mobile) la importan directamente.

## Lo que exporta

| Export | Tipo | Descripción |
|---|---|---|
| `READING_FONTS` | `Array<{ label: string, css: string }>` | Lista ordenada de fuentes disponibles |

**Valores:**

| label | css |
|---|---|
| Clásica | `'Crimson Text', Georgia, serif` |
| Moderna | `'Lora', Georgia, serif` |
| Cómoda | `'Merriweather', Georgia, serif` |
| Redonda | `'Baloo 2', system-ui, sans-serif` |

## Conexiones de entrada

- `BookReader.jsx` (`TypographyControl`) — muestra la grilla de fuentes en el panel desplegable desktop
- `LectorMobile.jsx` (`TypoSheet`) — ídem en el sheet de tipografía mobile

## Decisiones no obvias

**`css` es la cadena completa de `font-family`:** Se pasa directamente como valor de estilo, no es solo un nombre. El componente que lo usa puede aplicarlo sin formateo adicional.

**`Baloo 2` como opción de fuente de lectura:** Es la misma fuente del chrome de Inmersia (botones, labels). Incluirla acá permite leer con la fuente de interfaz, dándole un tono más casual/juvenil al texto.
