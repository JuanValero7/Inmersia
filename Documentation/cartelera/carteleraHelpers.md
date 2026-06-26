# carteleraHelpers

**Tipo:** Módulo de utilidades  
**Ruta:** `src/components/cartelera/carteleraHelpers.js`  
**Exporta:** `SECCIONES`, `SECCIONES_NOFICCION`, `getSecciones`, `seccionMeta`, `getTags`, `getCap`, `rng`, `shade`, `DOT_AMT`

## Propósito

Constantes y funciones puras compartidas por todos los componentes de la Cartelera (desktop y mobile). Nada de estado ni de Supabase aquí.

## Exports

### `SECCIONES` / `SECCIONES_NOFICCION`

Arrays de definición de secciones para ficción y no-ficción respectivamente.

```js
{ key: string, label: string, singular: string, sub: string, color: string }
```

| key (ficción) | key (no-ficción) | Tablero visual |
|---|---|---|
| `personajes` | `glosario` | TableroPersonajes |
| `lugares` | `datos` | TableroLugares |
| `hechos` | `referencias` | TableroHechos |
| `datos` | `resumen` | TableroDatos |
| `notas` | `notas` | TableroNotas |

### `getSecciones(esNoficcion)`

Retorna `SECCIONES_NOFICCION` si `esNoficcion` es `true`, `SECCIONES` en caso contrario.

### `seccionMeta(key)`

Busca una sección por `key` en `SECCIONES` primero y en `SECCIONES_NOFICCION` si no la encuentra. Retorna el objeto de sección o `undefined`.

⚠️ **Bug:** la clave `'datos'` existe en ambos arrays con colores distintos (`#7d8db5` en ficción, `#86ad9e` en no-ficción). Como la búsqueda siempre comienza por `SECCIONES`, la no-ficción obtiene siempre el color y label de ficción para `'datos'`. Ver issue #1.

### `getTags(item)`

Extrae `item.metadata.tags`; retorna `[]` si no existe o no es array.

### `getCap(item)`

Retorna `'Cap. N'` si `capitulo_numero` existe, `''` si es null/undefined.

### `rng(seed)`

Generador de números pseudo-aleatorios determinista (LCG: `s = (s * 1664525 + 1013904223) >>> 0`). Retorna una función que produce flotantes en `[0, 1)`. Usar con seed fija garantiza el mismo layout entre renders y entre plataformas.

### `shade(hex, amt)`

Mezcla un color hexadecimal con blanco (`amt > 0`) o negro (`amt < 0`). Retorna `rgb(r, g, b)`.

### `DOT_AMT`

Array de 5 valores de cantidad para `shade`, usado para colorear los dots del índice (cicla con `di % DOT_AMT.length`).

## ⚠️ Issues conocidos

| # | Descripción |
|---|---|
| 1 | `seccionMeta('datos')` siempre retorna la entrada de ficción (color `#7d8db5`); en no-ficción debería retornar `#86ad9e`. La función necesita recibir contexto (`esNoficcion`) o buscar según el tipo activo. |
| 5 | `deltaDesc` e `initial` están duplicadas en `Ficha.jsx` y `CarteleraMobileFicha.jsx` en lugar de vivir aquí. |
