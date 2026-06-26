# Portada (cartelera)

**Tipo:** Componente de vista  
**Ruta:** `src/components/cartelera/Portada.jsx`  
**Plataforma:** Web (desktop)  
**Exporta:** `default Portada`

## Propósito

Pantalla inicial de la Cartelera: 5 paneles verticales estilo acuarela. Al hover, el panel activo se expande y muestra el nombre y descripción de la sección. Al hacer clic navega a esa sección (BoardView). También monta el popup "Explorar" para saltar a Foro, Lectura o Biblioteca.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `subtitle` | `string` | Título del libro (se muestra en el topbar) |
| `onOpen` | `fn(key)` | Navegar a la sección `key` |
| `onGoBack` | `fn` | Navegar al Lector |
| `onGoForo` | `fn \| undefined` | Navegar al Foro (opcional) |
| `onGoBiblioteca` | `fn \| undefined` | Navegar a Biblioteca (opcional) |
| `secciones` | `Section[]` | Array de secciones activas (default: `SECCIONES`) |

## Estado interno

| Estado | Inicial | Qué controla |
|---|---|---|
| `hover` | `null` | Clave de la sección con hover activo |
| `explorarOpen` | `false` | Si el popup Explorar está desplegado |

## Componente interno: `Panel`

Recibe `{ sec, open, hoveredAny, last, idx, onEnter, onOpen }`. Controla:
- `flexBasis`: 40% si `open`, 13% si hay otro con hover, 20% si ninguno.
- `clipPath`: el `BOLT` (forma de rayo) excepto en el último panel.
- Capas internas: `ink-fill` (degradado acuarela), `wash` (efecto SVG `washBleed`), `grain`, `vignette`.
- Contenido revelado al hover: `sec.label`, `sec.sub`, botón "Explorar →".
- `sec.initial` es la primera letra del label (añadida por el `.map` en Portada).

## Tour guiado

`useEffect([], [])` al montar: si la fase del tour es `cart_portada_1` o `cart_portada_2`, lanza el popover correspondiente con 700ms de delay.

## Decisiones no obvias

**`SECTIONS` se re-deriva en cada render:** `const SECTIONS = secciones.map(s => ({ ...s, initial: s.label[0] }))` se ejecuta en cada render. Debería ser `useMemo`. Ver issue #12.

**Popup Explorar duplicado:** el bloque JSX del popup (botones Foro/Lectura/Biblioteca) es copia literal de BoardView y Ficha. No existe como componente compartido.

**`onGoBack` sin guard:** los botones `onGoForo` y `onGoBiblioteca` se renderizan condicionalmente (`{onGoForo && ...}`), pero el botón "Lectura" llama `onGoBack()` sin verificar si la prop existe. Ver issue #3.

## ⚠️ Issues conocidos

| # | Línea | Descripción |
|---|---|---|
| 3 | ~107 | Botón "Lectura" llama `onGoBack()` incondicionalmente; si la prop no se pasa, crashea. `onGoForo` y `onGoBiblioteca` sí están protegidos. |
| 12 | 60 | `SECTIONS` recalculado en cada render (`.map` inline). |
