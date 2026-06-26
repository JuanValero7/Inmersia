# TableroNotas

**Tipo:** Componente visual  
**Ruta:** `src/components/cartelera/TableroNotas.jsx`  
**Plataforma:** Web desktop y mobile  
**Exporta:** `default TableroNotas`

## Propósito

Tablero "corcho de investigación" de 700×860 px. Combina: 4 miniaturas en vivo de los otros tableros (vinculadas en tiempo real al progreso), hasta 60 notas decorativas (sin datos reales) que se revelan con el avance, y una red de hilos rojos que une todo. También contiene una hoja plana central.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `pct` | `number` | Porcentaje 0–100 del avance del lector |
| `scale` | `number` | Factor de escala visual |
| `principal` | `Record<string, { url }>` | URLs de imágenes de fondo por sección (para las miniaturas) |
| `onOpenSection` | `fn(key) \| undefined` | Al hacer clic en una miniatura, navega a esa sección |
| `esNoficcion` | `boolean` | Cambia los labels y keys de las miniaturas |

## Estructura visual

```
cart-canvas cart-cork
  ├─ cart-flatsheet          (hoja central rotada –3°)
  ├─ cart-nota × N           (notas decorativas, N = round(pct/100 * 60))
  ├─ svg.cart-threads         (hilos rojos entre nodos)
  └─ cart-embed × 4          (miniaturas en vivo de los 4 tableros)
```

## Miniaturas en vivo (`Miniatura`)

Las 4 miniaturas son instancias reales de `TableroPersonajes`, `TableroLugares`, `TableroHechos` y `TableroDatos` renderizadas a escala `MINI_SCALE = 150/700 ≈ 0.214`. Reciben el mismo `pct` que el corcho, así que se actualizan en tiempo real. Están sobre un `<button>` con `tape` decorativa, `veil` de hover y label.

Posiciones fijas (cx, cy) en `EMBEDS_FICCION` / `EMBEDS_NOFICCION`. Los keys y labels cambian entre ficción y no-ficción pero las posiciones `cx/cy` son **idénticas**, por lo que el layout del corcho no varía entre tipos de libro.

## Notas decorativas

60 notas con posición, rotación, color y decoración pseudo-aleatorias (seed `20260606`), calculadas **una sola vez al cargar el módulo** (`ALL_NOTAS` es una constante IIFE). No dependen de datos de Supabase.

Al calcular las posiciones se excluyen las celdas que caen sobre una miniatura (`onEmbed`) o sobre la hoja central (`onCenter`). El RNG se consume **antes** de saber si la celda es válida → la secuencia de números es siempre la misma independientemente de cuántas celdas se descartan.

`visibleCount = round(pct/100 * 60)`: se muestran `ALL_NOTAS.slice(0, visibleCount)`.

## Hilos rojos

`links` (calculado con `useMemo`) tiene dos tipos de conexiones:
1. **Loop entre miniaturas:** conecta cada miniatura con la siguiente en orden circular (4 líneas fijas).
2. **Cada nota a su miniatura más cercana:** por cada nota visible, se encuentra la miniatura a menor distancia euclidiana y se traza un arco cuadrático con sag proporcional a la distancia.

```js
const links = useMemo(() => { ... }, [visibleCount, esNoficcion])
```

El memo depende de `visibleCount` (no de `visibleNotas` directamente) porque `visibleNotas` es una derivación directa de `visibleCount` y `ALL_NOTAS` (constante de módulo). Incluir `visibleNotas` en deps causaría recalcular en cada render (nueva referencia de array). Ver issue #10.

## Ficción vs. no-ficción

`esNoficcion` selecciona:
- `EMBEDS_NOFICCION` / `EMBEDS_FICCION` → labels y keys de las miniaturas
- `TABLEROS_NOFICCION` / `TABLEROS_FICCION` → qué componente visual renderiza cada miniatura

La constante de exclusión `EMBEDS` usa siempre `EMBEDS_FICCION` porque las posiciones `cx/cy` son iguales en ambas versiones.

## ⚠️ Issues pendientes

| # | Línea | Descripción |
|---|---|---|
| 10 | 121 | `links` `useMemo` usa `visibleNotas` en el cuerpo pero depende de `visibleCount` en el array de deps. Funciona, pero ESLint avisa y confunde a lectores del código. **Diferido — TableroNotas sin trabajar aún.** |
