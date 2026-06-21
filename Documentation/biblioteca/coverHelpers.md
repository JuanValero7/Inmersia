# coverHelpers — Funciones de color y portada

Este documento cubre tres archivos que forman una cadena de herencia: el módulo base compartido y sus dos versiones especializadas (desktop y mobile).

---

## coverHelpers.shared.js

**Tipo:** Utilidad (funciones puras)  
**Ruta:** `src/components/biblioteca/coverHelpers.shared.js`  
**Plataforma:** Compartido

### Propósito
Funciones de color y paleta que son idénticas en desktop y mobile. Al centralizarlas aquí se garantiza que ambas plataformas usen el mismo algoritmo de tinting y la misma paleta de colores de lomo.

### Exportaciones

| Nombre | Tipo | Qué hace |
|---|---|---|
| `INK` | `string` | Color de tinta base `#4a3622` — usado en todos los bordes y textos |
| `inmTint(hex, amt)` | `fn` | Mezcla un color hex con blanco (amt > 0) o negro (amt < 0) |
| `hashOf(s)` | `fn` | Hash numérico determinista de un string — da variación visual sin aleatoriedad |
| `lum(hex)` | `fn` | Luminancia percibida (0–1) — decide si el texto encima debe ser claro u oscuro |
| `STORYBOOK` | `string[]` | Paleta de 14 colores "libro de cuento" — da el look acuarela |
| `spineColor(b)` | `fn` | Asigna un color de `STORYBOOK` al libro usando `hashOf(b.id)` |

### Decisiones no obvias

`hashOf` usa el mismo algoritmo que Java's `String.hashCode()`. Es determinista: dado el mismo `id` de libro siempre produce el mismo color, sin necesitar guardarlo en base de datos.

`lum` usa los coeficientes estándar ITU-R BT.601 (no BT.709) — suficiente para decidir contraste en UI sin necesitar transformación gamma.

---

## clay/helpers.jsx (desktop)

**Tipo:** Utilidad de UI  
**Ruta:** `src/components/biblioteca/clay/helpers.jsx`  
**Plataforma:** Web (desktop)

### Propósito
Re-exporta todo de `coverHelpers.shared.js` y agrega los elementos propios del desktop: tamaños de lomo y el componente `BookCover` con las dimensiones del desktop.

### Agrega sobre el base

| Nombre | Qué hace |
|---|---|
| `spineW(b)` | Ancho del lomo en px: varía entre 30–60 según `b.pages` y `hashOf(b.id)` |
| `spineH(b)` | Alto del lomo en px: varía entre 96–152 usando `hashOf(b.id + 'h')` |
| `BookCover` | Componente: portada face-out (imagen real o generada con degradado + título) |

`BookCover` recibe `{ book, h = 174, ink = INK }`. Si `book.cover` existe, muestra la imagen; si no, genera una portada con título y autor sobre el color del libro.

---

## bibmHelpers.jsx (mobile)

**Tipo:** Utilidad de UI  
**Ruta:** `src/components/mobile/biblioteca/bibmHelpers.jsx`  
**Plataforma:** Mobile

### Propósito
Equivalente mobile de `clay/helpers.jsx`. Re-exporta el mismo base compartido y define sus propias medidas de lomo (más chicas) y su `BookCover` (sin parámetro `ink`, usa siempre `INK` del shared).

### Diferencias con el desktop

| | Desktop (`clay/helpers.jsx`) | Mobile (`bibmHelpers.jsx`) |
|---|---|---|
| `spineW` | 30–60 px | 26–52 px |
| `spineH` | 96–152 px | 112–156 px |
| `BookCover` acepta `ink` | Sí | No (siempre usa `INK`) |
| Exportaciones extra | — | `ACCENT`, `GREEN`, `WALL` |

### Exportaciones adicionales

| Nombre | Valor | Uso |
|---|---|---|
| `ACCENT` | `#cf7b4c` | Botón primario, barra de progreso |
| `GREEN` | `#6f9457` | Botón "Cuaderno" |
| `WALL` | `#b0bdca` | Color base del nicho de pared de los estantes |

## Conexiones

```
coverHelpers.shared.js
  ├─ clay/helpers.jsx (re-exporta + agrega BookCover desktop)
  │   ├─ clay/Shelves.jsx (usa spineW, spineH, BookCover, inmTint, hashOf, spineColor)
  │   └─ clay/HeaderSwimlane.jsx (usa INK, inmTint, BookCover)
  └─ mobile/biblioteca/bibmHelpers.jsx (re-exporta + agrega BookCover mobile)
      ├─ mobile/biblioteca/BibShelvesMobile.jsx
      └─ mobile/biblioteca/BibBookSheet.jsx
```
