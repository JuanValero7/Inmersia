# WhiteNoisePlayer

**Tipo:** Componente (memoizado)  
**Ruta:** `src/components/lector/WhiteNoisePlayer.jsx`  
**Plataforma:** Web (desktop) — mobile lo reimplementa en `WhiteNoiseSheet`

## Propósito

Panel de sonido ambiente para libros de **no ficción**. A diferencia de `RecorderPlayer` (que reproduce un archivo de audio del capítulo), este componente genera ruido y ambiences: ruido generativo via Web Audio API + sonidos de ambiente pregrabados (`/public/sounds/`). Se activa cuando `book.es_ficcion === false`.

No acepta props de datos — el estado sonoro es completamente local y se persiste en localStorage.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `onClose` | `fn` | Callback para cerrar el panel |

## Lo que exporta

`default WhiteNoisePlayer` (componente memo)

## Flujo principal

El estado y la lógica de audio los maneja el hook `useWhiteNoise`. El componente es puramente visual: muestra los controles y delega todo al hook.

**Secciones del panel:**
1. **Ruido** — pills: Off · Blanco · Rosa · Marrón + slider de volumen (deshabilitado si Off)
2. **Ambiente** — pills: Ninguno · Lluvia · Café · Bosque · Fuego + slider de volumen (deshabilitado si Ninguno)

## `useWhiteNoise` (hook asociado)

Ruta: `src/hooks/useWhiteNoise.js`

Gestiona dos contextos de audio independientes:

### Ruido generativo (Web Audio API)

| Tipo | Algoritmo |
|---|---|
| Blanco | Buffer con valores `Math.random() * 2 - 1` |
| Rosa | Algoritmo Paul Kellett (suma de 7 corrientes filtradas): `-3 dB/octava` |
| Marrón | Integración de ruido blanco: `(prev + 0.02 * white) / 1.02`: `-6 dB/octava` |

Los buffers se generan una vez y se reproducen en loop via `AudioBufferSourceNode`. Al cambiar de tipo, se destruye el nodo anterior y se crea uno nuevo.

### Ambiente pregrabado

Archivos en `/public/sounds/` (lluvia, café, bosque, fuego). Se reproducen con `HTMLAudioElement` en loop. Al cambiar de ambiente, actualiza `src` sin destruir el elemento.

### Persistencia

Estado guardado en `localStorage` bajo la clave `inm_noise_pref` como JSON: `{ tipo, volNoise, ambiente, volAmb }`. Se restaura al montar.

## Constantes exportadas por `useWhiteNoise`

```javascript
TIPOS_RUIDO = [
  { key: 'off',    label: 'Off' },
  { key: 'blanco', label: 'Blanco' },
  { key: 'rosa',   label: 'Rosa' },
  { key: 'marron', label: 'Marrón' },
]

AMBIENCIAS = [
  { key: 'ninguno', label: 'Ninguno' },
  { key: 'lluvia',  label: 'Lluvia' },
  { key: 'cafe',    label: 'Café' },
  { key: 'bosque',  label: 'Bosque' },
  { key: 'fuego',   label: 'Fuego' },
]
```

Estas constantes las importa también `WhiteNoiseSheet` en `LectorMobile.jsx`.

## Decisiones no obvias

**Dos AudioContext separados:** El ruido generativo y el ambiente usan contextos de audio distintos. Esto permite mezclar ambos con volúmenes independientes sin enrutamiento explícito (Web Audio Mixer). Si fueran el mismo contexto habría que usar `GainNode` para cada canal.

**Ruido rosa via Paul Kellett:** El algoritmo no es intuitivo (7 variables `b0..b6` que acumulan valores previos). Es el estándar para ruido rosa eficiente en Web Audio sin FFT. La alternativa (filtrar ruido blanco en frecuencia) sería más costosa computacionalmente.

**`WhiteNoisePlayer` no tiene props de datos:** A diferencia de `RecorderPlayer` (que recibe el audio del capítulo), el ruido es independiente del contenido del libro. El usuario elige su ambiente preferido y se mantiene constante mientras lee, incluso al cambiar de capítulo.

## Conexiones de salida

- `useWhiteNoise` — toda la lógica de audio
- `clay.jsx` — `theme` (tokens visuales)

## Conexiones de entrada

- `BookReader.jsx` — lo instancia en el panel de sonido cuando `esNoficcion === true`
- `LectorMobile.jsx` — `WhiteNoiseSheet` usa el mismo hook `useWhiteNoise` (no el componente directamente)
