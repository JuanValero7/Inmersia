# BibShelvesMobile

**Tipo:** Componentes de UI (puros)  
**Ruta:** `src/components/mobile/biblioteca/BibShelvesMobile.jsx`  
**Plataforma:** Mobile

## Propósito

Renderiza los estantes de la biblioteca mobile. Equivalente mobile de `clay/Shelves.jsx`, pero con una estrategia de layout completamente diferente: scroll horizontal por categoría con un tope de 15 libros por fila.

## Exportaciones

### `MobileShelves`
Recibe `{ groups, onOpen }`.  
Renderiza un `ShelfCategory` por cada grupo. Cada categoría puede tener múltiples filas si supera el tope de 15 lomos.

### `CoverCarousel`
Recibe `{ books, onOpen }`.  
Carrusel de portadas face-out (para "Últimos abiertos"). Scroll horizontal, similar al `CoverShelf` desktop pero adaptado a móvil.

## Algoritmo de layout (MobileShelves)

1. Cada categoría pasa por `chunkByCount(books, CAP=15)` → divide sus libros en filas de máximo 15.
2. Cada fila es un `PlankRow`: nicho de pared + fila de lomos en scroll-H + tabla de madera.
3. Solo la última fila de cada categoría lleva una planta decorativa (`plantIdx = (i % 4) + 1`).
4. La etiqueta de la categoría (nombre + conteo) se posiciona bajo la última fila.

## Diferencias clave respecto a FlatShelves (desktop)

| Aspecto | FlatShelves (desktop) | MobileShelves |
|---|---|---|
| Layout | Posición absoluta por ancho de lomo | Flexbox con scroll-H |
| Categorías por fila | 3, en la misma repisa | 1 por repisa |
| Tope de libros | Sin tope (depende del ancho) | 15 por fila |
| Plantas | Distribuidas en huecos entre categorías | Una por categoría (última fila) |
| Filtro activo | Opacidad baja (visual) | Grupos removidos del array (en el padre) |
| Ancho fijo | `SHELF_W = 1216` | Scroll horizontal sin límite |

## Componentes internos

| Componente | Descripción |
|---|---|
| `Spine` | Lomo individual. Similar a `ShSpine` desktop. |
| `Plank` | Tabla de madera (idéntica en concepto a `CartoonPlank` desktop, ligeramente diferente en medidas). |
| `Plant` | Imagen decorativa (`m1..m4.webp`). |
| `PlankRow` | Una fila de lomos: nicho de pared + scroll + Plank + planta opcional. |
| `ShelfCategory` | Una categoría completa: N filas de PlankRow + etiqueta. |
| `chunkByCount` | Divide array en chunks de tamaño `cap`. |

## Conexiones de salida

- `bibmHelpers.jsx` → `INK`, `WALL`, `inmTint`, `hashOf`, `spineColor`, `spineW`, `spineH`, `BookCover`

## Conexiones de entrada

- `BibliotecaMobile` — `MobileShelves` para la colección, `CoverCarousel` para "Últimos abiertos"
