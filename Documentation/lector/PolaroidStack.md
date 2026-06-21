# PolaroidStack

**Tipo:** Componente (memoizado)  
**Ruta:** `src/components/lector/PolaroidStack.jsx`  
**Plataforma:** Web (desktop)

## Propósito

Stack de polaroids flotante que aparece detrás del libro desktop. Muestra las imágenes del capítulo a medida que el lector las "descubre" (avanza a la página donde aparecen). Al hacer click, abre un visor modal completo con navegación y miniaturas.

Su posicionamiento absoluto es responsabilidad del padre (`Lector.jsx`) — el componente solo renderiza su contenido relativo.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `images` | `Media[]` | Imágenes visibles en la página actual (calculado por `visibleImages` en `Lector.jsx`) |

## Lo que retorna

Nada si `images` está vacío (retorna `null`). Con imágenes: el stack de polaroids + el overlay modal (via portal).

## Flujo principal

1. Muestra hasta 3 polaroids superpuestos en abanico con rotaciones fijas: `[-4°, 2.5°, -1.5°]`. Los offsets de posición y `zIndex` están hardcodeados.
2. Cada polaroid tiene un cintillo de cinta adhesiva (terracota semitransparente) arriba.
3. Si hay imágenes y el usuario aún no las abrió (`!hasOpened`), aplica la clase `.inm-glow` que pulsa con un `drop-shadow` animado.
4. Al hacer click en un polaroid, `openAt(i)` abre el overlay modal con la imagen `i` seleccionada y marca `hasOpened = true` (detiene el glow).
5. El overlay se renderiza con `createPortal(…, document.body)` para evitar problemas de z-index con el libro y sus sombras.
6. El visor muestra imagen grande + miniaturas clicables + botones anterior/siguiente + contador "X / N".

## Decisiones no obvias

**`hasOpened` se resetea cuando cambia `images.length`:** Al cambiar de página, `images` puede cambiar (nuevas imágenes aparecen). Si el usuario aún no abrió las nuevas, el glow vuelve a activarse. El reset no discrimina qué imágenes son nuevas — basta con que cambie la cantidad.

**Portal para el overlay:** El `Lector.jsx` aplica `filter: drop-shadow` al wrapper del libro, lo que crea un nuevo contexto de apilamiento. Cualquier `z-index` alto dentro de ese contenedor queda contenido al contexto local. El portal en `document.body` escapa ese contexto y garantiza que el overlay cubra todo, incluyendo el panel de superusuario.

**Solo 3 polaroids en el stack:** Mostrar más de 3 haría el stack muy ancho y taparía el libro. Las imágenes restantes son accesibles desde el visor (miniaturas). El número 3 está hardcodeado junto con las rotaciones — cambiar la cantidad requiere ajustar también `rots`, `tops` y `lefts`.

**`ClayBtn` interno:** El botón de anterior/siguiente en el visor está definido como función local al archivo (no exportado) para no engrosar la API pública del componente. Tiene el mismo estilo que `ClayButton` de `clay.jsx` pero sin las animaciones hover.

## Conexiones de salida

- `clay.jsx` — `theme`
- `createPortal` de React — para el overlay

## Conexiones de entrada

- `Lector.jsx` — lo renderiza posicionado absolutamente a la derecha del libro, pasando `visibleImages`
