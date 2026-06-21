# Shelves (estantería desktop)

Este documento cubre tres archivos del chrome desktop que trabajan juntos: los estantes, el header y el swimlane hero.

---

## clay/Shelves.jsx

**Tipo:** Componentes de UI (puros, memoizados)  
**Ruta:** `src/components/biblioteca/clay/Shelves.jsx`  
**Plataforma:** Web (desktop)

### Propósito
Renderiza la estantería ilustrada de la biblioteca desktop. Dos variantes: `FlatShelves` (lomos parados, 3 categorías por fila) y `CoverShelf` (portadas face-out, para "Últimos abiertos").

### Exportaciones

#### `FlatShelves`
Recibe `{ groups, activeCat, onOpen }`.
- `groups`: `[{ cat: {id, nombre, color}, books: Book[] }]`
- `activeCat`: ID de la categoría activa (o `null`). Cuando hay un filtro activo, los libros de otras categorías bajan a 26% de opacidad; las plantas también.
- `onOpen`: `fn(book, rect)` — se llama al hacer click en un lomo.

**Algoritmo de layout:**
1. Pre-procesa `groups` con `chunkByWidth`: si una categoría tiene tantos libros que sus lomos superan `SHELF_W` px de ancho, se parte en tramos. Cada tramo se trata como grupo independiente en el paso siguiente pero mantiene el mismo `cat` (y por tanto la misma etiqueta).
2. Agrupa en filas de 3 tramos (`catRows`).
3. Para cada fila, calcula el ancho total de los lomos de cada tramo (`spineW`).
4. Distribuye el espacio sobrante como `gap = max(0, SHELF_W - totalAncho) / (tramos + 1)`. El clamp a 0 evita que los libros se pisen cuando varios tramos grandes comparten fila.
5. Posiciona cada lomo en `x` absoluto acumulado.
6. Coloca plantas decorativas (imgs `m1..m4.webp`) en los huecos entre grupos, usando `hashOf` para que siempre caiga la misma planta en el mismo hueco.
7. Las plantas se distribuyen en round-robin para que ningún tipo aparezca mucho más que los otros.

#### `CoverShelf`
Recibe `{ books, onOpen }`.  
Muestra portadas face-out (usando `BookCover` de `helpers.jsx`) alineadas al fondo sobre un nicho de pared. No tiene lógica de layout — flexbox con `justify-content: space-around`.

#### `ShSpine` (interno, pero exportado)
El lomo individual. Dimensiones por `spineW`/`spineH`, color base por `spineColor`, variación de bordes redondeados por `hashOf`.

#### `CartoonPlank` (exportado)
La tabla de madera dibujada con CSS puro. Sin lógica — puro visual.

### Decisiones no obvias

**CSS inyectado dinámicamente:** Al cargarse el módulo, inyecta una `<style>` tag con el CSS de hover de los lomos (`.inm-bk`, `.inm-bk:hover`, `.inm-bk-ttl`). Esto porque la animación hover necesita `will-change: transform` y no está en los archivos `.css` globales. Es la única excepción al patrón de estilos del proyecto.

**`SHELF_W = 1216`:** Ancho base de los estantes en px. El contenedor tiene `overflowX: auto` y `minWidth: SHELF_W`, así que en viewports más angostos aparece scroll horizontal y ningún libro se corta. En viewports más anchos el contenedor crece libremente y el gap entre categorías se amplía.

**`React.memo`:** Tanto `FlatShelves` como `CoverShelf` están memoizados. El orquestador (`VistaBiblioteca`) re-renderiza al teclear en el buscador, pero `groups` y `books` son memos estables; `onOpen` es un `useCallback`. Sin `memo`, los estantes se repintarían con cada tecla.

---

## clay/HeaderSwimlane.jsx

**Tipo:** Componentes de UI  
**Ruta:** `src/components/biblioteca/clay/HeaderSwimlane.jsx`  
**Plataforma:** Web (desktop)

### Propósito
Header de la biblioteca desktop (logo, buscador, botones de navegación) y el Swimlane hero (tabs + libro destacado).

### Exportaciones

#### `InmHeader`
Recibe: `search, onSearch, onSearchKeyDown, displayName, inicial, onGoPerfil, onGoTienda, onSignOut`.  
Renderiza la barra superior: logo, input de búsqueda, botones de Tienda / Perfil / Salir.  
Completamente sin estado interno.

#### `Swimlane`
Recibe: `{ featured, onOpen }`.  
Tiene estado interno: `tab` ('seguir' | 'novedades' | 'recom').

- Tab "Seguir leyendo": si hay `featured`, muestra `HeroFeatured`; si no, mensaje vacío.
- Tabs "Novedades" y "Recomendaciones": muestran placeholder "Próximamente". **Son features futuras sin implementar.**

#### `HeroFeatured` (interno)
Muestra el libro destacado: portada girada, título grande, barra de progreso (si `book.progress` es un número) o mensaje "Aún no registramos tu progreso" (si `progress === null`). Botón "Empezar a leer" / "Continuar".

### ⚠️ Features no implementadas

| Tab | Estado |
|---|---|
| Novedades | Siempre muestra "Pronto verás acá los libros recién llegados". Sin datos. |
| Recomendaciones | Siempre muestra "Estamos preparando recomendaciones". Sin datos. |
| Barra de progreso en HeroFeatured | Siempre en el branch `progress === null` porque el campo no existe en Supabase aún. |

## Conexiones

```
VistaBiblioteca
  ├─ InmHeader
  ├─ Swimlane → HeroFeatured → BookCover (de helpers.jsx)
  ├─ FlatShelves → ShSpine, CartoonPlank
  └─ CoverShelf → BookCover (de helpers.jsx)

Todo usa INK e inmTint de helpers.jsx → coverHelpers.shared.js
```
