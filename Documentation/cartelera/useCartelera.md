# useCartelera

**Tipo:** Custom hook  
**Ruta:** `src/components/cartelera/useCartelera.js`  
**Exporta:** `useCartelera(libroId, userId, isSuperuser?)`

## Propósito

Carga todos los datos de la Cartelera para un libro y usuario específicos. Trae: porcentaje de avance del lector, ítems por sección (filtrados y agrupados), e imágenes/videos de fondo de cada tablero. Es la única fuente de verdad para los datos de Supabase en este módulo.

## Parámetros

| Parámetro | Tipo | Descripción |
|---|---|---|
| `libroId` | `string \| null` | ID del libro activo |
| `userId` | `string \| null` | ID del usuario autenticado |
| `isSuperuser` | `boolean` | Si es `true`, salta el filtro de spoilers y muestra todos los ítems |

## Retorna

| Campo | Tipo | Descripción |
|---|---|---|
| `loading` | `boolean` | `true` mientras carga o si faltan `libroId`/`userId` |
| `capituloActual` | `number` | Número de capítulo hasta el que el usuario puede ver (derivado de `porcentaje`) |
| `porcentaje` | `number` | Avance 0–100 (fuente: `progreso_lectura`) |
| `itemsBySeccion` | `Record<string, Item[]>` | Ítems filtrados y agrupados por clave de sección |
| `principal` | `Record<string, { url, titulo, videoUrl }>` | Imagen/video de fondo por sección |

## Flujo de carga

1. Si `libroId` o `userId` son `null`, retorna estado vacío inmediatamente.
2. Carga `progreso_lectura` → obtiene `porcentaje` (0–100).
3. En paralelo carga: `cartelera_items` (ítems), `cartelera_principal` (imágenes/videos), y cuenta de `capitulos`.
4. Deriva `capituloActual`: inversa de la fórmula del Lector (`pct = round(pendingIdx / total * 100)`) → `capActual = round(pct / 100 * total) + 1`.
5. Filtra ítems: solo pasan los que tienen `capitulo_numero < capActual`. Si `isSuperuser`, omite el filtro.
6. Agrupa por nombre canónico (deduplicación): ítems con el mismo nombre y sección se fusionan en un único objeto con `allIds[]` y `entradas[]` (timeline de apariciones por capítulo).

## Regla de revelado

- `porcentaje = 0` → `capActual = 0` → ningún ítem visible.
- `porcentaje > 0` → los ítems de capítulos anteriores al capActual son visibles.
- `porcentaje = 100` → todos los ítems visibles (`capActual = totalChaps + 1`).
- Ítems sin `capitulo_numero` (null) pasan el filtro porque `null < capActual` evalúa `0 < capActual` en JS, por lo que aparecen desde el primer avance.

## Estructura de un ítem agrupado

```js
{
  id: string,             // ID del primer registro (canónico)
  allIds: string[],       // todos los IDs de entradas fusionadas
  seccion: string,
  nombre: string,         // nombre canónico
  capitulo_numero: number, // del primer registro
  metadata: { tags: string[] },
  imagen: { url, slug, titulo } | null,
  entradas: [
    { capitulo_numero, descripcion },  // una entrada por capítulo
    ...
  ]
}
```

## Tablas de Supabase

| Tabla | Columnas | Operación |
|---|---|---|
| `progreso_lectura` | `porcentaje` | SELECT `.maybeSingle()` |
| `cartelera_items` | `id, seccion, nombre, descripcion, capitulo_numero, metadata` + join `biblioteca_media` | SELECT ORDER BY `capitulo_numero ASC` |
| `cartelera_principal` | `seccion` + join `biblioteca_media` (imagen + video) | SELECT |
| `capitulos` | `count` | SELECT HEAD (solo cuenta) |

## Decisiones no obvias

**Deduplicación por nombre:** la tabla `cartelera_items` puede tener múltiples filas para el mismo personaje/lugar en distintos capítulos. El hook las fusiona en un único ítem con timeline. La imagen se toma de la primera entrada que la tenga; el `metadata` se sobreescribe con la entrada más reciente que lo tenga.

**Cancelación de efecto:** usa `let cancelled = false` (sin `AbortController`). Funciona porque las queries de Supabase no son streams; si el componente se desmonta antes de que `cargar()` termine, los `setState` simplemente no se ejecutan.

**`isSuperuser` en deps:** si un superusuario cierra sesión y el componente se reutiliza, el efecto se relanza y aplica el filtro correcto.

## ⚠️ Issues conocidos

| # | Línea | Descripción |
|---|---|---|
| — | 46–57 | Ninguna query chequea `.error`; un fallo de red retorna datos vacíos silenciosamente sin notificar al usuario |
