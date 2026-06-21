# RecorderPlayer

**Tipo:** Componente + íconos exportados (memoizado)  
**Ruta:** `src/components/lector/RecorderPlayer.jsx`  
**Plataforma:** Web (desktop) — mobile lo reimplementa en `AudioSheet`

## Propósito

Reproductor de audio de ambiente del capítulo para libros de **ficción**. Estética de grabadora analógica clay (carretes, medidor de barras). También exporta tres íconos ilustrados (`LupaIcon`, `ForoIcon`, `NotebookIcon`) que se usan en el popup "Explorar" y en el launcher del cuaderno del desktop.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `ambient` | `Media \| null` | Objeto de audio del capítulo (`{ url, titulo, slug }`) |
| `onClose` | `fn \| undefined` | Si se pasa: botón "–" llama a `onClose`. Si no: minimiza a icono flotante |

## Lo que exporta

| Export | Tipo | Descripción |
|---|---|---|
| `RecorderPlayer` | `component (memo)` | El reproductor de ambiente |
| `LupaIcon` | `component` | Lupa ilustrada con hover (usada en Explorar) |
| `ForoIcon` | `component` | Burbujas de chat ilustradas (usada en Explorar) |
| `NotebookIcon` | `component` | Cuaderno espiral ilustrado (launcher del cuaderno en desktop) |

## Flujo principal

1. `useAmbientPlayer(ambient?.url)` crea y gestiona el `Audio` object. Al cambiar `ambient.url`, pausa, actualiza `src`, y si estaba reproduciéndose (`wasPlaying`), reanuda automáticamente.
2. Botón play/pausa → `toggle()` del hook.
3. Slider de volumen → `setVol(parseFloat(e.target.value))` del hook.
4. Botón "–": si `onClose` existe, lo llama (el padre cierra el panel completo). Si no, minimiza a un botón compacto `48×48` con dot pulsante cuando está playing.

### Medidor de barras

14 barras (`<div>`) de altura variable (`3 + (i % 4) * 1.6` px). Una barra está "encendida" (`background: theme.meter`) si `playing && i < Math.round(volume * 14)`. Simula un VU meter proporcional al volumen.

## Íconos ilustrados (`LupaIcon`, `ForoIcon`, `NotebookIcon`)

Los tres comparten el mismo comportamiento hover: `rotate(-7deg) translateY(0px)` en reposo → `rotate(0deg) translateY(-3px)` al hacer hover, con `cubic-bezier(.3,1.3,.5,1)` (rebote suave). Están construidos exclusivamente con spans CSS y SVG — sin imágenes externas.

**`LupaIcon`:** Lente con gradiente azul-gris, mango de madera terracota, virola dorada. El mango se posiciona detrás del lente con `zIndex: 0`.

**`ForoIcon`:** Dos burbujas de chat superpuestas. La trasera es naranja oscuro, la principal es terracota claro con 3 líneas de texto simuladas.

**`NotebookIcon`:** Cuaderno espiral con tapa de cuero, páginas de papel, espiral dorado y marcador que asoma por arriba. Usa `clipPath: 'polygon(...)'` para el marcador triangular.

## Decisiones no obvias

**Dos modos del botón "–":** El `RecorderPlayer` puede usarse de dos formas en el desktop: (1) dentro del panel de `BookReader` donde `onClose` cierra el panel completo, o (2) flotante donde "–" solo minimiza. El componente no necesita saber cuál es el contexto — la presencia o ausencia de `onClose` determina el comportamiento.

**`wasPlaying` capturado antes de pausar (en `useAmbientPlayer`):** Al cambiar de capítulo (nuevo `ambientUrl`), hay que pausar el audio anterior antes de cargar el nuevo. Si el audio estaba reproduciéndose, se quiere que el nuevo también empiece. Capturar `playing` como `wasPlaying` antes del `pause()` evita la condición de carrera donde el state se actualiza asíncronamente.

**`useState` en los íconos (hover):** Los tres íconos usan `useState(false)` local para el hover. Alternativa sería CSS `:hover`, pero la animación de transform necesita aplicarse al wrapper completo (no a un pseudo-elemento), y el `transition` de cubic-bezier con rebote no es fácil de expresar en CSS puro sin JS.

## Conexiones de salida

- `useAmbientPlayer` (`src/hooks/useAmbientPlayer.js`) — gestión del audio de ambiente
- `clay.jsx` — `theme`

## Conexiones de entrada

- `BookReader.jsx` — instancia `RecorderPlayer` dentro del panel de sonido (ficción)
- `Lector.jsx` — importa `NotebookIcon` para el botón del cuaderno en el footer
