# CarteleraMobile

**Tipo:** Componente orquestador  
**Ruta:** `src/components/mobile/CarteleraMobile.jsx`  
**Plataforma:** Mobile  
**Exporta:** `default CarteleraMobile`

## Propósito

Cáscara mobile de la Cartelera. Reutiliza **todos** los tableros de escritorio (TableroPersonajes, Lugares, Hechos, Datos, Notas) y el hook `useCartelera` sin modificación. Solo reescribe el cromo: header, portada vertical, pestañas Mural/Lista, cat-dock (navegación entre secciones) y bottom-sheet Explorar.

## Entradas (props)

Mismas que `CartelaView` (desktop):

| Prop | Tipo | Descripción |
|---|---|---|
| `onGoBack` | `fn` | Navegar al Lector |
| `book` | `object` | Libro activo |
| `user` | `object sesión` | Usuario autenticado |
| `onGoForo` | `fn \| undefined` | Navegar al Foro |
| `onGoBiblioteca` | `fn \| undefined` | Navegar a Biblioteca |
| `jumpToItemId` | `string \| null` | Salto directo a ítem desde X-ray |
| `onJumpConsumed` | `fn` | Limpia `jumpToItemId` en App |
| `isSuperuser` | `boolean` | Omite filtro de spoilers |

## Vistas

| Vista | Condición |
|---|---|
| `portada` | Vista inicial; portada vertical con 5 paneles rasgados |
| `board` | Sección activa con tablero (Mural) + tabs (Mural/Lista) + cat-dock |

La navegación de ficha ocurre **dentro** de `SectionView` con el estado `tab` (mural/lista/ficha), no a nivel de la vista principal.

## Componentes internos

| Componente | Función |
|---|---|
| `Portada` (local) | 5 paneles verticales con borde rasgado (`TORN[]`). Clic → `openSection(key)`. |
| `SectionView` | Tablero + tabs + CatDock. Gestiona el sub-estado `tab` (mural/lista/ficha) y `selId`. |
| `Header` | Header fijo: botón Back (opcional), título del libro, botón Explorar (Compass). |
| `CatDock` | Botón gato en esquina. Al hacer clic abre bandeja con los 4 atajos de sección. |
| `ExploreSheet` | Bottom-sheet modal para navegar a Lectura/Biblioteca/Foro. |
| `useFitScale()` | ResizeObserver en el contenedor del tablero → escala el lienzo 700×860. |
| `Filters` | SVG `<defs>` con los mismos filtros de grano/acuarela que el desktop (duplicado). |

## Flujo principal

1. Lazy init: si hay `jumpToItemId` arranca en `board` (sección[0]); si no, lee `?seccion=` de la URL.
2. `SectionView` recibe `data` al que se le añade `book` manualmente (`dataWithBook = { ...data, book }`), ya que `useCartelera` no retorna `book`.
3. Al seleccionar un ítem en `CarteleraMobileLista` → `setSelId(id); setTab('ficha')`. `CarteleraMobileFicha` recibe el `current` directamente.
4. Al cambiar de sección via CatDock, `useEffect([sectionKey])` resetea `tab = 'mural'` y `selId = null`.

## Tour guiado (mobile)

Usa las mismas fases del tour que el desktop (`cart_portada_1`, `cart_portada_2`, `cart_personajes`, `cart_notas`), pero lanza las funciones de `tutorial.mobile.js` en lugar de `tutorial.js`.

## Portada vertical vs. desktop

La portada mobile usa bordes rasgados (`TORN[]`, clip-path) y orientación vertical (paneles apilados) en lugar del layout horizontal con `BOLT`. Los estilos son distintos (`pv-*` en lugar de `panel`).

La Portada local usa `SECCIONES.length - 1` (constante importada) en lugar de `secciones.length - 1` (prop). Ver issue #7.

## ExploreSheet y goForoTour

`goForoTour` es siempre una función (referencia de flecha) y se pasa como `onGoForo` a `ExploreSheet`. Dentro de `ExploreSheet`, `onGoForo && { ... }` siempre evalúa truthy, por lo que el botón Foro aparece incluso cuando el prop `onGoForo` de CarteleraMobile no fue pasado. Al hacer clic, llama al `onGoForo` original que podría ser `undefined`. Ver issue #2.

## `useFitScale` — doble listener

Registra tanto `ResizeObserver` como `window.addEventListener('resize', fit)` en el mismo elemento. `fit` se ejecuta dos veces en cada resize del viewport. Ver issue #9.

## Dependencias de datos (Supabase)

Ver `useCartelera.md`.

## Conexiones de salida

```
CarteleraMobile
  ├─ useCartelera               ← datos + progreso
  ├─ TableroPersonajes/Lugares/Hechos/Datos/Notas (reutilizados del desktop)
  ├─ CarteleraMobileFicha.jsx   → CarteleraMobileLista + CarteleraMobileFicha
  ├─ tutorial.mobile.js         → guided tour mobile
  ├─ guidedTour.js              → getTourPhase, setTourPhase
  ├─ cartelera.css + cartelera.mobile.css
  └─ carteleraHelpers.js        → SECCIONES, seccionMeta, shade, getSecciones
```

## ⚠️ Issues pendientes

| # | Línea | Descripción |
|---|---|---|
| 2 | ~320 | `goForoTour` (siempre función) reemplaza `onGoForo` en `exploreProps` → botón Foro siempre visible → crash si `onGoForo` no se pasó. **Diferido — relacionado con refactor del tour.** |
| 11 | ~287 | Efecto `jumpToItemId` usa `onJumpConsumed` y `secciones[0].key` en el cuerpo sin listarlos en deps (ESLint warning, no bug real). Diferido. |

## ✅ Issues resueltos

| # | Descripción |
|---|---|
| 7 | `Portada` local: `SECCIONES.length - 1` → `secciones.length - 1` |
| 9 | `useFitScale`: eliminado `window.addEventListener('resize')` redundante (ResizeObserver es suficiente) |
