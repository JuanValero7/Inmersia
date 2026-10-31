# RecorderPlayer

**Tipo:** Componente + íconos exportados (memoizado)  
**Ruta:** `src/components/lector/RecorderPlayer.jsx`  
**Plataforma:** Web (desktop) — mobile lo reimplementa en `AudioSheet`

## Propósito

Panel del sonido de ambiente de los libros de **ficción**: solo el volumen (a 0 no suena nada; decisión de Juan, 31 oct 2026: el lector no elige ni pausa nada más). Estética de grabadora analógica clay (carretes, medidor de barras). El sonido no vive aquí sino en el motor `useAmbiente`, que vive en el lector: cerrar el panel no lo corta. También exporta tres íconos ilustrados (`LupaIcon`, `ForoIcon`, `NotebookIcon`) que se usan en el popup "Explorar" y en el launcher del cuaderno del desktop.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `ambiente` | `ReturnType<useAmbiente>` | `{ volumen, setVolumen, nombre }` del motor de ambiente |
| `onClose` | `fn` | Botón "–": cierra el panel (el sonido sigue) |

## Lo que exporta

| Export | Tipo | Descripción |
|---|---|---|
| `RecorderPlayer` | `component (memo)` | El reproductor de ambiente |
| `LupaIcon` | `component` | Lupa ilustrada con hover (usada en Explorar) |
| `ForoIcon` | `component` | Burbujas de chat ilustradas (usada en Explorar) |
| `NotebookIcon` | `component` | Cuaderno espiral ilustrado (launcher del cuaderno en desktop) |

## Flujo principal

1. Slider de volumen → `setVolumen()` del motor. Subirlo desde 0 es el gesto que deja al navegador poner sonido.
2. El texto dice qué suena (`nombre` del ambiente del tramo actual), «Silencio en esta parte» si el tramo es `ninguno`, o «Sube el volumen…» a 0.
3. Botón "–" → `onClose`.

### Medidor de barras

14 barras (`<div>`) de altura variable (`3 + (i % 4) * 1.6` px). Una barra está "encendida" (`background: theme.meter`) si `volumen > 0 && i < Math.round(volumen * 14)`. Simula un VU meter proporcional al volumen.

## Íconos ilustrados (`LupaIcon`, `ForoIcon`, `NotebookIcon`)

Los tres comparten el mismo comportamiento hover: `rotate(-7deg) translateY(0px)` en reposo → `rotate(0deg) translateY(-3px)` al hacer hover, con `cubic-bezier(.3,1.3,.5,1)` (rebote suave). Están construidos exclusivamente con spans CSS y SVG — sin imágenes externas.

**`LupaIcon`:** Lente con gradiente azul-gris, mango de madera terracota, virola dorada. El mango se posiciona detrás del lente con `zIndex: 0`.

**`ForoIcon`:** Dos burbujas de chat superpuestas. La trasera es naranja oscuro, la principal es terracota claro con 3 líneas de texto simuladas.

**`NotebookIcon`:** Cuaderno espiral con tapa de cuero, páginas de papel, espiral dorado y marcador que asoma por arriba. Usa `clipPath: 'polygon(...)'` para el marcador triangular.

## Decisiones no obvias

**El motor no vive aquí:** antes el audio se creaba dentro de este componente y cerrar el panel lo cortaba. Ahora `useAmbiente` vive en `useLectorComun` (una vez por lector) y este panel solo lo controla. Cómo funciona el motor (tramos, bucle/detalles, fundidos): ver el encabezado de `src/hooks/useAmbiente.js`.

**`useState` en los íconos (hover):** Los tres íconos usan `useState(false)` local para el hover. Alternativa sería CSS `:hover`, pero la animación de transform necesita aplicarse al wrapper completo (no a un pseudo-elemento), y el `transition` de cubic-bezier con rebote no es fácil de expresar en CSS puro sin JS.

## Conexiones de salida

- `clay.jsx` — `theme`

## Conexiones de entrada

- `BookReader.jsx` — instancia `RecorderPlayer` dentro del panel de sonido (ficción, solo en capítulos con tramos de ambiente)
- `Lector.jsx` — importa `NotebookIcon` para el botón del cuaderno en el footer
