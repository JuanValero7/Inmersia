# BibliotecaMobile

**Tipo:** Componente orquestador  
**Ruta:** `src/components/mobile/BibliotecaMobile.jsx`  
**Plataforma:** Mobile  
**Exporta:** `default BibliotecaMobile`

## Propósito

Equivalente mobile de `VistaBiblioteca`. Usa exactamente el mismo hook de datos (`useBiblioteca`), pero con una UI completamente diferente: header compacto, hero con tabs, estantes en scroll horizontal, y filtros/gestión como pantallas full-screen en lugar de modales.

## Entradas (props)

Idénticas a `VistaBiblioteca`: `user`, `lastOpenedBookIds`, `onSignOut`, `onOpenBook`, `onGoTienda`, `onGoPerfil`, `onGoForo`, `onGoNotebook`.

## Estado interno (UI únicamente)

| Estado | Inicial | Qué controla |
|---|---|---|
| `selectedBook` | `null` | Libro con la hoja de detalle abierta |
| `search` | `''` | Input de búsqueda (instantáneo aquí, no hay Enter) |
| `deferredSearch` | — | Valor diferido de `search` para filtrado (ver abajo) |
| `activeCategory` | `null` | Filtro de categoría activo |
| `heroTab` | `'seguir'` | Tab activo en el hero (`seguir` / `novedades` / `recom`) |
| `screen` | `null` | Pantalla overlay activa (`null` / `'filter'` / `'manage'`) |

## Flujo principal

1. Igual que el desktop: llama a `useBiblioteca`, el tutorial arranca una sola vez.
2. El usuario escribe en el buscador → `search` se actualiza en cada tecla; `deferredSearch` se actualiza con `useDeferredValue` (React 18), lo que pospone el recálculo de estantes sin bloquear el input.
3. `groups` filtra por `deferredSearch` Y además por `activeCategory` (en desktop `activeCategory` solo afecta la opacidad visual, no filtra los grupos).
4. `counts` cuenta libros por categoría para mostrarlo en la `FilterScreen`.
5. El usuario filtra → abre `FilterScreen` (pantalla full-screen) → elige → `setScreen(null)` + `setActiveCategory`.
6. El usuario gestiona → abre `ManageScreen` (pantalla full-screen).
7. El usuario abre un libro → `setSelectedBook` → monta `BibBookSheet` (bottom sheet).

## Diferencias clave respecto al desktop

| Aspecto | Desktop (VistaBiblioteca) | Mobile (BibliotecaMobile) |
|---|---|---|
| Búsqueda | Enter para aplicar | Instantánea con `useDeferredValue` |
| Filtro activo | Oculta grupos (opacidad baja en FlatShelves) | Remueve grupos del array |
| Filtrar | Chips inline toggle | FilterScreen (pantalla completa) |
| Gestionar | Modal centrado | ManageScreen (pantalla completa) |
| Detalle de libro | BibBookModal (modal centrado) | BibBookSheet (bottom sheet) |
| `counts` | No se calcula | Sí, para mostrar conteo en FilterScreen |
| `ultimosVisible` | Fijo (portadas) | Se filtra también por búsqueda activa |

## Wrappers de UI (idénticos al desktop)

`deleteCategoria`: limpia `activeCategory` si la categoría borrada estaba activa.  
`assignCategoriaToBook`: sincroniza `selectedBook` si es el libro afectado.

## Conexiones de salida

- `useBiblioteca` — datos y CRUD
- `mobile/biblioteca/bibmHelpers.jsx` → `INK`, `BookCover`
- `mobile/biblioteca/BibShelvesMobile.jsx` → `MobileShelves`, `CoverCarousel`
- `mobile/biblioteca/BibBookSheet.jsx`
- `mobile/biblioteca/BibScreensMobile.jsx` → `FilterScreen`, `ManageScreen`
- `tutorial.mobile.js` → `runGuidedBib1Mobile`, `runGuidedBib2Mobile`
- `guidedTour.js` → `getTourPhase`, `setTourPhase`, `shouldStart`
- `biblioteca/constants.js` → `SIN_CATEGORIA_ID`, `COLOR_DEFAULT`
- `styles/biblioteca.mobile.css`

## Conexiones de entrada

- `App.jsx` — lo monta cuando el usuario está autenticado, la ruta es `/biblioteca`, y el viewport es mobile (detectado vía `useIsMobile`)
