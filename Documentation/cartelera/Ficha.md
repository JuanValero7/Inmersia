# Ficha

**Tipo:** Componente de vista  
**Ruta:** `src/components/cartelera/Ficha.jsx`  
**Plataforma:** Web (desktop)  
**Exporta:** `default Ficha`

## Propósito

Vista de cuaderno a dos páginas: índice de ítems a la izquierda (con búsqueda), ficha de detalle a la derecha (imagen polaroid, tags, cap. inicial, timeline de apariciones). Los ítems llegan ya filtrados por capítulo desde `useCartelera`; aquí no hay lógica de spoilers.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `section` | `object` | Metadata de la sección activa (`key`, `label`, `singular`, `color`) |
| `items` | `Item[]` | Ítems de la sección (ya filtrados por capítulo) |
| `initialItemId` | `string \| null` | Ítem a preseleccionar al montar (salto desde X-ray) |
| `secciones` | `Section[]` | Array de secciones (para el Signpost) |
| `onBackTablero` | `fn` | Volver al tablero de la sección |
| `onBackPortada` | `fn` | Volver a la Portada |
| `onGoBack` | `fn \| undefined` | Navegar al Lector |
| `onGoForo` | `fn \| undefined` | Navegar al Foro |
| `onGoBiblioteca` | `fn \| undefined` | Navegar a Biblioteca |
| `onOpenList` | `fn(key) \| undefined` | Cambiar de sección (usado por Signpost) |

## Estado interno

| Estado | Inicial | Qué controla |
|---|---|---|
| `sel` | `initialItemId \| items[0]?.id \| null` | ID del ítem seleccionado en el índice |
| `query` | `''` | Texto de búsqueda en el índice |
| `scale` | `1` | Factor de escala del cuaderno (`transform: scale(scale)`) |
| `explorarOpen` | `false` | Popup Explorar abierto |

## Flujo principal

1. `filtered` filtra `items` por `nombre` o tags que contengan `query`.
2. `current` busca en `items` el ítem cuyo `id` o `allIds` incluya `sel`.
3. El cuaderno se escala con un listener de `window.resize` + fórmula hardcodeada.
4. Página izquierda: lista de `filtered` con dot de color, nombre, capítulo. Clic → `setSel`.
5. Página derecha: si no hay `current`, muestra panel vacío; si hay, muestra ficha con polaroid, tags, cap. inicial, y timeline si `entradas.length > 1`.

## Timeline (deltaDesc)

Cuando un ítem tiene múltiples entradas (fusionadas por `useCartelera`), se muestra como timeline de capítulos. `deltaDesc(prev, curr)` extrae solo el texto *nuevo* de cada entrada: si `curr` comienza con `prev`, retorna solo el sufijo agregado.

## Función `initial(s)`

Devuelve la primera letra significativa del nombre (ignora artículos "El", "La", "Los", "Las"). Usada para los dots y el placeholder del polaroid.

## Escalado del cuaderno

`window.addEventListener('resize', ...)` con la fórmula:
```js
const sw = (window.innerWidth - 64) / 1180
const sh = (window.innerHeight - 188) / 760
scale = Math.max(0.32, Math.min(sw, sh, 1))
```
`1180` = ancho total del cuaderno abierto (dos páginas), `760` = alto. `64` y `188` = márgenes estimados. Inconsistente con el resto de la Cartelera que usa `ResizeObserver` en el contenedor. Ver issue #8.

## Decisiones no obvias

**`sel` no se resetea al cambiar sección via Signpost:** como `<Ficha>` no tiene `key={view.key}` en `Cartelera.jsx`, React reutiliza la instancia cuando el usuario navega a otra sección desde el Signpost. `sel` apunta a un ID que no existe en los nuevos `items`, `current` es null, y el panel derecho queda en blanco aunque haya ítems. Ver issue #4.

**`rootStyle` con `--fscale: 1`:** la variable CSS `--fscale` está declarada en el estilo inline pero no se usa en el JSX ni en el escalado real (que va por `transform: scale(scale)`). Posible residuo. Ver issue #13.

## Conexiones de salida

- `Signpost.jsx` — navegación entre secciones
- `carteleraHelpers.js` → `getTags`, `getCap`, `shade`, `DOT_AMT`
- `guidedTour.js` → `getTourPhase`, `setTourPhase`

## ⚠️ Issues conocidos

| # | Línea | Descripción |
|---|---|---|
| 4 | (en Cartelera.jsx) | Ficha sin `key={view.key}` → `sel` obsoleto al navegar entre secciones via Signpost |
| 5 | 20, 23 | `initial` y `deltaDesc` duplicadas respecto a `CarteleraMobileFicha.jsx`; deberían estar en `carteleraHelpers.js` |
| 8 | 51–61 | Escala con `window.addEventListener` y constantes hardcodeadas en lugar de `ResizeObserver` |
| 13 | 73 | `--fscale: 1` en `rootStyle` no se usa en ningún lugar |
