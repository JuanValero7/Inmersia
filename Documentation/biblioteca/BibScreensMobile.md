# BibScreensMobile

**Tipo:** Componentes de pantalla (overlays)  
**Ruta:** `src/components/mobile/biblioteca/BibScreensMobile.jsx`  
**Plataforma:** Mobile

## Propósito

Dos pantallas full-screen que reemplazan, en mobile, lo que en desktop son el panel de filtros inline y el modal de gestión de categorías. Entran desde la derecha con una transición slide.

## Exportaciones

### `FilterScreen`

Recibe: `{ categories, counts, active, hasSinCategoria, onPick, onClose }`.

Muestra una lista de todas las categorías (más "Todos" y opcionalmente "Sin categoría") con su conteo de libros. Al seleccionar una categoría, llama a `onPick(id)` y luego `onClose()` automáticamente.

Si hay un filtro activo, el footer muestra un botón "Quitar filtro".

### `ManageScreen`

Recibe: `{ categories, counts, onCreate, onUpdate, onDelete, onClose }`.

Pantalla de gestión de categorías: formulario de creación + lista de categorías con edición inline y borrado con confirmación. El contrato async (`onCreate/onUpdate/onDelete → err|null`) es idéntico al de `ManageCategoriasModal` (desktop).

## Patrón de animación (ScreenShell)

Ambas pantallas usan el componente interno `ScreenShell` que aplica el mismo patrón de entrada que `BibBookSheet`:

```
mount → entering=true (pantalla fuera de pantalla a la derecha)
  → setTimeout(20ms) → entering=false → CSS transition slide desde derecha
```

También escucha `Escape` para cerrar.

## Componentes internos

| Componente | Descripción |
|---|---|
| `ScreenShell` | Wrapper con header (botón volver + título), área de contenido scrolleable, y footer opcional. |
| `ColorPicker` | Grid de círculos de color (`PALETTE`, 10 colores). Sin input nativo — solo swatches. |

## ⚠️ Inconsistencias

| Línea | Descripción |
|---|---|
| 13 | `const SIN_CATEGORIA_ID = '__sin_categoria'` — redeclarado localmente en lugar de importarse desde `src/components/biblioteca/constants.js`. Si ese ID cambia, hay que actualizarlo en dos lugares. |
| `PALETTE` | Los mismos 10 colores que `SUGGESTED_PALETTE` en `ManageCategoriasModal`, pero nombrados diferente. Podrían compartir una constante. |

## Diferencias respecto a ManageCategoriasModal (desktop)

Ver tabla en [ManageCategoriasModal.md](ManageCategoriasModal.md).

La diferencia más importante: `ManageScreen` muestra el conteo de libros por categoría (recibe `counts` como prop); `ManageCategoriasModal` no.

## Conexiones de salida

- `bibmHelpers.jsx` → `INK`, `ACCENT`
- Todo el CRUD va vía callbacks al padre (`BibliotecaMobile`)

## Conexiones de entrada

- `BibliotecaMobile` — `FilterScreen` cuando `screen === 'filter'`; `ManageScreen` cuando `screen === 'manage'`
