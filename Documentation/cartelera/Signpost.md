# Signpost

**Tipo:** Componente UI  
**Ruta:** `src/components/cartelera/Signpost.jsx`  
**Plataforma:** Web (desktop)  
**Exporta:** `default Signpost`

## Propósito

Letrero esquinero fijo (posición absoluta en el lienzo) con hasta 4 botones para saltar a las otras secciones de la Cartelera. Visible en `BoardView` y en `Ficha`. Integrado con el tour guiado para la transición a la sección "Notas".

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `current` | `string` | Clave de la sección activa (se excluye del listado) |
| `onOpenSection` | `fn(key)` | Navegar a la sección `key` |
| `secciones` | `Section[]` | Array de secciones (default: `SECCIONES` de ficción) |

## Comportamiento

- Filtra `secciones` excluyendo `current` y toma los primeros 4 resultados.
- Cada botón se posiciona con `top: YS[i]%` donde `YS = [8.6, 25.8, 44.5, 64.5]` (porcentajes fijos verticales en la imagen del letrero).
- Al hacer clic en `'notas'` con fase `'wait_notas'`, avanza el tour a `'cart_notas'`.

## Decisiones no obvias

**`YS` es fija para 4 botones:** con 5 secciones siempre hay 4 "otros", así que el array de 4 posiciones siempre tiene elemento para cada botón. Si el número de secciones cambiara (e.g., añadir una 6ª), el slice(0,4) mantendría 4 botones pero podría ocultar una sección.

**No hay posiciones para no-ficción:** `SECCIONES_NOFICCION` también tiene 5 secciones, por lo que el comportamiento es idéntico. Los botones muestran los labels de no-ficción pero en las mismas posiciones verticales.
