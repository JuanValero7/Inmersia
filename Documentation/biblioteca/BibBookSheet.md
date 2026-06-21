# BibBookSheet

**Tipo:** Componente bottom sheet  
**Ruta:** `src/components/mobile/biblioteca/BibBookSheet.jsx`  
**Plataforma:** Mobile

## Propósito

Hoja inferior deslizante con el detalle de un libro, en la biblioteca mobile. Es el equivalente mobile de `BibBookModal`. Mismas acciones (leer, foro, cuaderno, reseña, cambiar categoría), distinta presentación.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `book` | `Book` | Libro a mostrar |
| `user` | objeto sesión | Para queries de reseña |
| `categories` | `Category[]` | Para el selector de categorías |
| `onClose` | `fn` | Cierra la hoja |
| `onOpenBook` | `fn(book)` | Navega al Lector |
| `onGoForo` | `fn(book)` | Navega al Foro |
| `onGoNotebook` | `fn(book)` | Navega al Cuaderno |
| `onAssignCategory` | `async fn(libroId, catId)` | Reasigna categoría |
| `transparentBackdrop` | `boolean` | Si `true`, el fondo del backdrop es transparente (sin blur). Default `false`. |

## Flujo principal

1. Monta con clase CSS `entering` (hoja fuera de pantalla hacia abajo). Tras 20 ms, se remueve → transición CSS slide-up.
2. Si la fase del tour es `'wait_modal'`, dispara `runGuidedModalMobile()` con 500 ms de delay.
3. Escucha `Escape` para cerrar.
4. Click en el backdrop cierra; click dentro de la hoja no propaga.

## Lo que renderiza (`SheetBody`)

La lógica visual vive en `SheetBody` (componente interno):
- Portada + título + autor + etiqueta de categoría + páginas.
- Barra de progreso (si `book.progress` es un número).
- Resumen.
- "Mover a otra categoría": toggle que expande chips de todas las categorías disponibles.
- Botones de acción: Abrir libro, Foro (si no es el manual), Cuaderno (si no es el manual).
- Sección de reseña (solo si `book.leido && !esManual`): igual que `BibBookModal`.

## Patrón de animación de entrada

```
mount → entering=true (hoja fuera de pantalla)
  → setTimeout(20ms) → entering=false (trigger CSS transition)
```
Los 20 ms aseguran que el navegador pinte el estado inicial antes de iniciar la transición. Es más robusto que `requestAnimationFrame` porque funciona aunque las animaciones estén pausadas (modo ahorro de batería, etc.).

## Diferencias respecto a BibBookModal (desktop)

Ver tabla completa en [BibBookModal.md](BibBookModal.md).

La diferencia más notable en la lógica: el cambio de categoría usa chips desplegables (`moving` state + botones) en lugar del `<select>` dropdown del desktop.

## Conexiones de salida

- `useResena` → Supabase: `resenas_libros`
- `bibmHelpers.jsx` → `INK`, `ACCENT`, `inmTint`, `BookCover`
- `guidedTour.js` → `getTourPhase`
- `tutorial.mobile.js` → `runGuidedModalMobile`

## Conexiones de entrada

- `BibliotecaMobile` — lo monta cuando `selectedBook !== null`
