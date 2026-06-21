# VistaBiblioteca (Biblioteca.jsx)

**Tipo:** Componente orquestador  
**Ruta:** `src/components/Biblioteca.jsx`  
**Plataforma:** Web (desktop)  
**Exporta:** `default VistaBiblioteca`

## Propósito

Orquestador desktop del home de Biblioteca. Consume datos de `useBiblioteca`, gestiona el estado propio de la UI desktop (búsqueda, filtros activos, modal abierto, tutorial), y delega el renderizado a subcomponentes. Nada de lógica de Supabase vive aquí.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `user` | objeto sesión | Usuario autenticado (viene de App.jsx) |
| `lastOpenedBookIds` | `string[]` | IDs de libros abiertos recientemente, en orden |
| `onSignOut` | `fn` | Cerrar sesión |
| `onOpenBook` | `fn(book)` | Navegar al Lector |
| `onGoTienda` | `fn` | Navegar a la Tienda |
| `onGoPerfil` | `fn` | Navegar al Perfil |
| `onGoForo` | `fn(book)` | Navegar al Foro del libro |
| `onGoNotebook` | `fn(book)` | Navegar al Cuaderno del libro |

## Estado interno (UI únicamente)

| Estado | Inicial | Qué controla |
|---|---|---|
| `notes` | `{}` | ⚠️ DEAD CODE — ver abajo |
| `selectedBook` | `null` | Qué libro tiene el modal abierto |
| `showManageCats` | `false` | Si el modal de gestión de categorías está abierto |
| `showFilters` | `false` | Si el panel de filtros por categoría está visible |
| `searchInput` | `''` | Texto en el input (instantáneo) |
| `search` | `''` | Texto de búsqueda aplicado (solo al presionar Enter) |
| `activeCategory` | `null` | `null` = todos, `uuid` = una categoría, `'none'` nunca se usa |

## Flujo principal

1. Llama a `useBiblioteca(user, lastOpenedBookIds)` para obtener libros, categorías y CRUD.
2. El tutorial se dispara una sola vez al terminar la primera carga (`tourStartedRef` evita relanzarlo en recargas por CRUD).
3. El usuario busca: `searchInput` se actualiza en cada tecla; `search` solo se actualiza al presionar Enter o limpiar con Escape.
4. `searchedBooks` filtra `books` por título/autor contra `search`.
5. `groups` agrupa `searchedBooks` por categoría (+ "Sin categoría" al final); solo muestra grupos con libros.
6. `portadas` son los últimos 3 libros abiertos (o los primeros 3 si no hay historial).
7. El usuario abre un libro → `setSelectedBook` → monta `BibBookModal`.
8. El usuario gestiona categorías → `setShowManage(true)` → monta `ManageCategoriasModal`.

## Wrappers de UI sobre las primitivas del hook

`deleteCategoria`: llama a `deleteCategoriaBase` y, si tuvo éxito, limpia `activeCategory` si la categoría borrada estaba activa.

`assignCategoriaToBook`: llama a `assignCategoriaToBookBase` y sincroniza el `selectedBook` si es el libro afectado (para que el modal se refresque sin cerrarse).

## Conexiones de salida

- `useBiblioteca` — datos y CRUD
- `clay/HeaderSwimlane.jsx` → `InmHeader`, `Swimlane`
- `clay/Shelves.jsx` → `FlatShelves`, `CoverShelf`
- `BibBookModal.jsx` — modal de detalle de libro
- `ManageCategoriasModal.jsx` — modal de gestión de categorías
- `tutorial.js` → `runGuidedBib1`, `runGuidedBib2`
- `guidedTour.js` → `getTourPhase`, `setTourPhase`, `shouldStart`
- `useLocalStorage` — para `notes` (⚠️ dead code) y el estado `bv_notes`
- `biblioteca/constants.js` → `SIN_CATEGORIA_ID`, `COLOR_DEFAULT`
- `styles/biblioteca.css`

## Conexiones de entrada

- `App.jsx` — lo monta cuando el usuario está autenticado y la ruta es `/biblioteca`

## Decisiones no obvias

**Búsqueda en dos pasos (input vs search):** `searchInput` actualiza el input visualmente en tiempo real; `search` (el valor que filtra los estantes) solo cambia al presionar Enter. Evita recalcular `searchedBooks` y `groups` en cada pulsación.

**`shelvesCount`:** Calculado pero nunca usado en el JSX actual. Probable vestigio de cuando la altura de la página se calculaba manualmente.

**`chip` inline:** La función que genera los estilos de los botones de filtro está definida inline en el render. No está memoizada porque depende de `activeCategory` y se recalcula en cada render de todas formas.

**Tour con `ref`:** `tourStartedRef.current = true` garantiza que el tour no se relanza aunque `loadingBooks` vuelva a ser `true` y luego `false` por un refetch (ej.: al reasignar una categoría).

## ⚠️ Código muerto / inconsistencias

| Línea | Descripción |
|---|---|
| 33 | `const [notes, setNotes] = useLocalStorage('bv_notes', {})` — `notes` y `setNotes` nunca se usan en este archivo ni se pasan a ningún hijo. Probablemente un vestigio de "notas privadas por libro" que nunca se terminó de implementar. Puede eliminarse sin efecto. |
| ~114 | `const handleGoTienda` podría ser un `useCallback` o simplemente inline; tal como está no hay ventaja. |
