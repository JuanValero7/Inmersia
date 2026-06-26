# Tableros visuales (Personajes / Lugares / Hechos / Datos)

**Rutas:**
- `src/components/cartelera/TableroPersonajes.jsx`
- `src/components/cartelera/TableroLugares.jsx`
- `src/components/cartelera/TableroHechos.jsx`
- `src/components/cartelera/TableroDatos.jsx`

**Plataforma:** Web desktop y mobile (reutilizados tal cual en `CarteleraMobile.jsx` y como miniaturas en `TableroNotas.jsx`)

## Propósito

Cada tablero es un lienzo fijo de 700×860 px que revela una imagen de fondo (`imageUrl`) según el porcentaje de avance del lector (`pct` 0–100). La mecánica de revelado es distinta en cada uno. Al llegar al 100% con `videoUrl`, todos muestran un video en loop en lugar de la imagen.

## Interfaz común (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `pct` | `number` | Porcentaje 0–100 de avance del lector |
| `scale` | `number` | Factor de escala aplicado vía `transform: scale()` |
| `imageUrl` | `string \| undefined` | URL de la imagen de fondo a revelar |
| `videoUrl` | `string \| undefined` | URL del video (mostrado al 100%) |
| `onOpenList` | `fn \| undefined` | Click en el lienzo → navegar a la Ficha. Si es `undefined`, `cursor: default`. |

## Mecánicas de revelado

### TableroPersonajes — Polaroids

- 30 marcos (5×6 grilla) generados con RNG determinista (seed `20260601`).
- Cada marco tiene posición, rotación, y opcionalmente "cinta" (tape).
- `revealed = round(pct/100 * 30)`. Los marcos se revelan en orden aleatorio fijo (`order[]`).
- La imagen de fondo se recorta con `clip-path: path(...)` que une los polígonos de los marcos revelados. Al 0%, `path('M 0 0 Z')` → imagen invisible.
- `quadPath(cx, cy, w, h, deg)`: convierte un rectángulo rotado en un subpath SVG para el clip.

### TableroLugares — Capa raspable

- Una capa verde (efecto "manto") cubre la imagen y se revela en manchas irregulares.
- Campo de ruido Perlin (value noise, 3 octavas) de 700×860 px generado con seed fija (`20260602`). **Cacheado a nivel de módulo** → se calcula una sola vez por sesión, aunque el tablero se monte/desmonte varias veces (incluidas las miniaturas del corcho).
- `paint(pct)`: para cada pixel, compara el valor del campo con un umbral `T = pct/100 * 1.06 - 0.03`. Los pixels por debajo de T son transparentes (imagen visible); los de arriba son opacos (manto verde). Borde suavizado (feather) y reborde luminoso (rim).
- `Reveal` es un componente interno con un `<canvas>` que actualiza la imagen en `useEffect` cuando `percent` cambia.
- El "manto" (color verde con sheen y grain) también se genera con RNG y se cachea.

### TableroHechos — Ventanas con persianas

- Fachada de 4×5 = 20 ventanas. Cada ventana tiene marco, vidrio, persiana y glow de color.
- El vidrio muestra un recorte de la imagen de fondo (background-position precalculada por ventana).
- `openCount = round(pct/100 * 20)`. Las ventanas se abren en orden aleatorio fijo (seed `20260603`). `rank[i] < openCount` → ventana `i` está abierta (persiana retraída via CSS `.open`).
- Cada ventana tiene un color de glow fijo (`GLOWS[]`, 12 colores ciclando por posición).

### TableroDatos — Libros que se retiran

- 2 grillas entrelazadas de 6×8 = 96 libros cada una (192 total), superpuestas en el lienzo.
- Los libros cubren la imagen al 0%; al avanzar se van retirando (opacity → 0, scale → 0.5) en orden aleatorio (seed `20260604`).
- `removed = round(pct/100 * 192)`. `remRank[i] >= removed` → el libro `i` sigue visible.
- Cada libro tiene animación CSS de drift (`--dur`, `--del` aleatorios negativos para que empiecen en distintas fases).
- Libros abiertos y cerrados con colores pasteles (`COVERS[]`).

## Diseño determinista

Todos los tableros usan `rng(seedFija)` para generar layouts que son **idénticos en cada render y para todos los usuarios**. El seed está hardcodeado por tablero para garantizar consistencia visual.

Los layouts se calculan **una sola vez** gracias a `useMemo(buildLayout, [])` (con array de deps vacío). En `TableroLugares`, el campo de ruido se cachea a nivel de módulo por razones de performance (~600k pixels).

## Video al 100%

Todos los tableros comprueban `pct >= 100 && videoUrl`: si ambas son verdaderas, montan un `<video autoPlay loop muted playsInline>` en lugar del lienzo interactivo. El video es el "premio" por completar el libro.

## ⚠️ Issues conocidos

| # | Componente | Descripción |
|---|---|---|
| — | `TableroLugares.jsx` | El cache de módulo (`_fieldCache`, `_coatCache`) nunca se limpia entre libros distintos. Intencional por diseño (seed fija, resultado único), pero si se quisieran campos distintos por libro habría que hacerlos dependientes del `libroId`. |
| — | `TableroLugares.jsx` ~106 | `paint` dentro de `Reveal` no está en los deps del segundo `useEffect`. ESLint lo marcaría (funciona en práctica porque `paint` solo usa refs). |
