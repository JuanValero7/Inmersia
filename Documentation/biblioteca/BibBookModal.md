# BibBookModal

**Tipo:** Componente modal  
**Ruta:** `src/components/biblioteca/BibBookModal.jsx`  
**Plataforma:** Web (desktop)

## Propósito

Modal de detalle de libro en la biblioteca desktop. Muestra resumen, categoría, acciones de navegación (leer, foro, cuaderno) y reseña del usuario. Es el equivalente desktop de `BibBookSheet` (mobile).

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `book` | `Book` | El libro a mostrar (con `color`, `title`, `author`, `categoryName`, etc.) |
| `user` | objeto sesión | Para las queries de reseña |
| `onClose` | `fn` | Cierra el modal |
| `onOpenBook` | `fn(book)` | Navega al Lector |
| `onGoForo` | `fn(book)` | Navega al Foro |
| `onGoNotebook` | `fn(book)` | Navega al Cuaderno |
| `categories` | `Category[]` | Para el selector de categorías |
| `onAssignCategory` | `async fn(libroId, catId)` | Reasigna el libro a otra categoría |

## Flujo principal

1. Al montar, si la fase del tour es `'wait_modal'`, dispara `runGuidedModal()` con 600 ms de delay.
2. Escucha `Escape` para cerrar.
3. El usuario puede cambiar la categoría con un `<select>` — llama a `onAssignCategory` y muestra estado "guardando" mientras.
4. Las reseñas se gestionan vía `useResena`: si `book.leido === true` y no es el manual, se muestra la sección de reseña.

## Lo que renderiza

- Banda superior con el color del libro (título, autor, etiqueta de categoría, cantidad de páginas, botón cerrar).
- Cuerpo: resumen, selector de categoría, botones de acción (Abrir libro / Ir al Foro / Cuaderno).
- Sección de reseña (solo si `book.leido && !esManual`): estrellas + texto opcional, modo lectura y modo edición.

## Diferencias respecto a BibBookSheet (mobile)

| Aspecto | BibBookModal (desktop) | BibBookSheet (mobile) |
|---|---|---|
| Formato | Modal centrado con backdrop blur | Bottom sheet deslizante |
| Selector de categoría | `<select>` dropdown nativo | Botones tipo chip (expandible) |
| Cierre | Click fuera o Escape | Click en backdrop, grip, o Escape |
| Notas privadas | No (dead code en el padre) | No |
| Animación de entrada | Ninguna | CSS transition (clase `entering`) |

## Conexiones de salida

- `useResena` (de `src/hooks/useResena.js`) → Supabase: `resenas_libros`
- `clay/helpers.jsx` → `inmTint`
- `guidedTour.js` → `getTourPhase`
- `tutorial.js` → `runGuidedModal`

## Conexiones de entrada

- `VistaBiblioteca` — lo monta cuando `selectedBook !== null`

## ⚠️ Código muerto / inconsistencias

| Descripción |
|---|
| El comentario del archivo dice "MISMAS conexiones que el real (reseñas, **notas**, asignar categoría…)". No hay ninguna UI de notas en este componente. El comentario es un vestigio de cuando se planeaba agregar notas privadas por libro (relacionado con el `notes` dead code en `VistaBiblioteca`). |
| El comentario dice "MISMAS que el real" — "el real" se refería al componente anterior que reemplazó. Ya no es relevante. |
