# CartelaView (Cartelera.jsx)

**Tipo:** Componente orquestador  
**Ruta:** `src/components/Cartelera.jsx`  
**Plataforma:** Web (desktop)  
**Exporta:** `default CartelaView`

## Propósito

Orquestador desktop de la Cartelera de investigación. Gestiona la navegación entre tres vistas (Portada → Tablero de sección → Ficha de ítem), sincroniza la sección activa con la URL (`?seccion=`), y responde al salto directo a un ítem (`jumpToItemId`) que llega desde el Lector via X-ray. Toda la lógica de datos vive en `useCartelera`; toda la lógica visual vive en los sub-componentes.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `onGoBack` | `fn` | Navegar al Lector |
| `book` | `object` | Libro activo (`libro_id`, `title`, `es_ficcion`) |
| `user` | `object sesión` | Usuario autenticado |
| `onGoForo` | `fn` | Navegar al Foro |
| `onGoBiblioteca` | `fn` | Navegar a Biblioteca |
| `jumpToItemId` | `string \| null` | ID de ítem al que saltar (desde X-ray del Lector) |
| `onJumpConsumed` | `fn` | Callback que limpia `jumpToItemId` en App |
| `isSuperuser` | `boolean` | Muestra todos los ítems sin filtro de spoilers |

## Estado interno

| Variable | Inicial | Qué controla |
|---|---|---|
| `view` | `{ kind: 'portada' \| 'board' \| 'ficha', key: string \| null }` | Vista activa y sección |
| `fichaInitItemId` | `null` | Ítem a preseleccionar al abrir la Ficha |

## Flujo principal

1. Al montar, lee `?seccion=` de la URL; si es válida arranca en `board`, si no en `portada`.
2. El hook `useCartelera(libroId, userId, isSuperuser)` carga los datos una vez y los mantiene en memoria.
3. La vista se resuelve por `view.kind`:
   - `portada` → `<Portada>` (5 paneles acuarela)
   - `board` → `<BoardView>` (tablero + topbar + dock de avance)
   - `ficha` → `<Ficha>` (cuaderno a dos páginas)
4. Cuando llega `jumpToItemId`, fuerza vista `ficha` en sección `'personajes'` con el ítem preseleccionado.
5. `view.key` se refleja en la URL con `setSearchParams` (replace, sin history).

## Componentes internos

| Componente | Función |
|---|---|
| `Filters` | SVG `<defs>` con los filtros SVG (`mesaGrain`, `paperGrain`, `washBleed`). Se monta una sola vez en el `cart-root`. |
| `BoardView` | Tablero activo + topbar (título, botón Lista, popup Explorar) + dock de avance. Gestiona el popup Explorar con un `mousedown` global. |
| `useFitScale(ref)` | Hook local que usa `ResizeObserver` para escalar el lienzo 700×860 al espacio disponible. |

## Conexiones de salida

```
CartelaView
  ├─ useCartelera            ← datos + progreso
  ├─ Portada.jsx             ← pantalla inicial (5 paneles)
  ├─ Ficha.jsx               ← cuaderno (índice + detalle)
  ├─ Signpost.jsx            ← letrero de navegación entre secciones
  ├─ TableroPersonajes.jsx
  ├─ TableroLugares.jsx
  ├─ TableroHechos.jsx
  ├─ TableroDatos.jsx
  ├─ TableroNotas.jsx
  ├─ tutorial.js             → runGuidedCartPersonajes, runGuidedCartNotas
  ├─ guidedTour.js           → getTourPhase, setTourPhase
  └─ cartelera.css
```

## Conexiones de entrada

- `App.jsx` — monta `CartelaView` cuando la ruta es `/cartelera/:slug`.
- `LectorRoute.jsx` — puede pasar `jumpToItemId` para saltar directo a un ítem desde X-ray.

## Decisiones no obvias

**Ficción vs. no-ficción:** `TABLEROS_FICCION` mapea `personajes → TableroPersonajes`, etc. `TABLEROS_NOFICCION` redirige las secciones de no-ficción a los mismos componentes visuales (`glosario → TableroPersonajes`, `datos → TableroLugares`, etc.). El tablero visual es el mismo; solo cambia el `sectionKey` y los datos que le llegan.

**`VALID_SECCIONES` duplicada:** tanto `Cartelera.jsx` como `CarteleraMobile.jsx` declaran la misma lista. No existe una constante compartida en `carteleraHelpers.js`.

**`boardView` sin key en Ficha:** `<Ficha>` no recibe `key={view.key}`. Si se navega entre secciones via Signpost desde dentro de la Ficha, React reutiliza la instancia y el estado `sel` queda obsoleto → ver ⚠️ issue #4.

**Popup Explorar inline:** el bloque JSX del popup (botones Foro/Lectura/Biblioteca con íconos SVG) está copiado literalmente en `BoardView`, `Portada.jsx` y `Ficha.jsx`. No existe como componente compartido.

## Tablas de Supabase (indirecto, vía hook)

Ver `useCartelera.md`.

## ⚠️ Issues conocidos

| # | Dónde | Descripción |
|---|---|---|
| 4 | `Cartelera.jsx` (~202) | `<Ficha>` sin `key={view.key}` → `sel` obsoleto al navegar entre secciones via Signpost → panel derecho en blanco |
| 11 | `Cartelera.jsx` (~186) | Efecto `jumpToItemId` usa `onJumpConsumed` en el cuerpo sin incluirlo en deps → ESLint warning |
