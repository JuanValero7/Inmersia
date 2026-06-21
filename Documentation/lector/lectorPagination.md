# lectorPagination

**Tipo:** Utilidad (pure function)  
**Ruta:** `src/utils/lectorPagination.js`  
**Plataforma:** Compartido (desktop + mobile)

## Propósito

Distribuye una lista plana de párrafos en páginas, respetando la altura máxima disponible en píxeles. Cuando el DOM ya midió los párrafos reales, usa esas alturas exactas; si no, estima por recuento de caracteres como fallback. Es la única lógica de paginación del proyecto — desktop y mobile la comparten con distintos parámetros.

## Entradas

### `paginarParrafos(parrafos, isDouble, opts)`

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `parrafos` | `Parrafo[]` | — | Lista ordenada de párrafos del capítulo |
| `isDouble` | `boolean` | `true` | Si es doble página (afecta el default de `charsPerLine`) |
| `opts` | `object` | `{}` | Opciones de geometría (ver abajo) |

**Opciones (`opts`):**

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `charsPerLine` | `number` | 50 (doble) / 86 (simple) | Caracteres estimados por línea (fallback) |
| `lineHeight` | `number` | `33` | Alto de línea en px |
| `maxH` | `number` | calculado de `window.innerHeight` | Alto máximo de página en px |
| `firstPageMaxH` | `number` | `maxH` | Alto máximo de la primera página (menor porque lleva el encabezado de capítulo) |
| `paragraphGap` | `number` | `6` | Espacio entre párrafos en px |
| `measuredHeights` | `{ [id]: number }` | `null` | Alturas reales medidas del DOM por párrafo |
| `originalLengths` | `{ [id]: number }` | `null` | Longitud original de cada párrafo (para escalar fragmentos) |

## Lo que retorna

`Page[]` donde `Page = Parrafo[]`. Cada elemento del array es una página con los párrafos que entran en ella. Garantiza al menos un elemento (`[[]]`).

## Flujo principal

1. Inicializa una página vacía (`cur = []`, `curH = 0`) y una cola con todos los párrafos.
2. Para cada párrafo, calcula su altura con `parrafoH()`:
   - Si hay `measuredHeights[p.id]`, usa esa altura real.
   - Si el párrafo es un fragmento (su texto es más corto que el original), aplica `measured * (curLen / origLen) * 1.1` para estimar la porción.
   - Fallback: estima líneas por caracteres y multiplica por `lineHeight`.
3. Si el párrafo cabe en la página actual → lo agrega.
4. Si no cabe → intenta dividirlo en el último espacio en blanco antes del punto de corte, asegurando `MIN_SPLIT_LINES = 2` en cada mitad.
   - La primera mitad completa la página actual; la segunda va al inicio de la cola (se reprocessa en la siguiente iteración).
5. Si no se puede dividir (párrafo más corto que `MIN_SPLIT_LINES * 2` o es un separador) → cierra la página y abre la siguiente con ese párrafo.
6. Caso extremo: si un párrafo es más grande que la página completa y no se puede dividir, se agrega igual para evitar loop infinito.

## Decisiones no obvias

**`FILL_FACTOR = 0.88`:** El texto raro vez llena una línea completa (signos de puntuación, palabras cortas al final). El 12% de margen evita subestimar la altura y que los párrafos se desborden visualmente.

**Fragmentación proporcional con margen del 10%:** Cuando un párrafo dividido se mide luego en el DOM, se necesita escalar la altura del fragmento. Se usa `curLen / origLen * 1.1` (no `1.0`) porque las últimas líneas de un párrafo suelen ser más cortas que las del inicio — sin el margen se subestima la altura y el fragmento desborda.

**`firstPageMaxH` separado:** La primera página de cada capítulo incluye el encabezado (nro. de capítulo + título + separador). Ese encabezado consume espacio que no se puede conocer hasta medir el DOM. `Lector.jsx` lo mide en un `useEffect` y lo pasa como `titleH`; `firstPageMaxH = maxH - titleH`.

**El punto de corte busca hacia atrás un espacio:** `while (splitAt > minCharsPerSide && text[splitAt] !== ' ') splitAt--` — nunca corta en medio de una palabra.

## Conexiones de salida

- No tiene dependencias externas. Es una función pura en JavaScript.

## Conexiones de entrada

- `Lector.jsx` — llama con `measuredHeights` reales + `originalLengths` + `firstPageMaxH`
- `LectorMobile.jsx` — llama sin `measuredHeights` (usa solo estimación por caracteres)

## ⚠️ Deuda técnica

El archivo carece de tests. La lógica de fragmentación (punto de corte proporcional + margen 1.1) es sutil y difícil de verificar visualmente. Un error aquí causa desbordamiento de texto silencioso.
