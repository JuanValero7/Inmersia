# CarteleraMobileFicha + CarteleraMobileLista

**Tipo:** Componentes de vista  
**Ruta:** `src/components/mobile/CarteleraMobileFicha.jsx`  
**Plataforma:** Mobile  
**Exporta:** `default CarteleraMobileFicha`, `CarteleraMobileLista` (named)

## Propósito

Lista y ficha de detalle de una sección, versión mobile. Misma fuente de datos que el `Ficha.jsx` de escritorio (ítems ya filtrados por capítulo desde `useCartelera`). Sin lógica de spoilers.

## CarteleraMobileLista

### Props

| Prop | Tipo | Descripción |
|---|---|---|
| `section` | `object` | Metadata de la sección (`color`, `label`) |
| `items` | `Item[]` | Ítems de la sección |
| `onPick` | `fn(id)` | El usuario selecciona un ítem → mostrar ficha |

### Comportamiento

- Input de búsqueda filtra `items` por nombre y tags.
- Filas: dot de color con inicial + nombre + cap. inicial + chevron.
- El color del dot varía con `shade(sec, DOT_AMT[di % DOT_AMT.length])` donde `di = items.indexOf(it)` (índice en la lista no filtrada).
- Si `items.length === 0`: mensaje "sin datos". Si `filtered.length === 0` con búsqueda activa: mensaje "sin resultados".

## CarteleraMobileFicha

### Props

| Prop | Tipo | Descripción |
|---|---|---|
| `section` | `object` | Metadata de la sección |
| `item` | `Item \| null` | Ítem a mostrar. Si es `null`, retorna `null` (no renderiza). |
| `onBack` | `fn` | Volver a la lista |

### Comportamiento

- Botón "Lista" en la parte superior (con BackIcon).
- Polaroid: imagen del ítem o placeholder con inicial.
- Kicker (tipo de ítem), nombre, chips de tags, cap. inicial.
- Wave decorativa del color de la sección.
- Si `entradas.length > 1`: timeline de capítulos con `deltaDesc`. Si no: descripción directa.

## Funciones utilitarias locales

```js
const initial = (s) => s.replace(/^(El|La|Los|Las)\s+/i, '').charAt(0).toUpperCase()

function deltaDesc(prev, curr) { ... }
```

Ambas son **duplicados exactos** de las funciones del mismo nombre en `Ficha.jsx`. Deberían vivir en `carteleraHelpers.js`. Ver issue #5.

## Conexiones de salida

- `carteleraHelpers.js` → `getTags`, `getCap`, `shade`, `DOT_AMT`
- Usada directamente por `SectionView` dentro de `CarteleraMobile.jsx`

## ⚠️ Issues conocidos

| # | Línea | Descripción |
|---|---|---|
| 5 | 16–27 | `initial` y `deltaDesc` duplicadas respecto a `Ficha.jsx`. Mover a `carteleraHelpers.js`. |
