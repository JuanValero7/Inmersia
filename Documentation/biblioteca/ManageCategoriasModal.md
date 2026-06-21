# ManageCategoriasModal

**Tipo:** Componente modal  
**Ruta:** `src/components/biblioteca/ManageCategoriasModal.jsx`  
**Plataforma:** Web (desktop)

## Propósito

Modal de gestión de categorías de usuario en el desktop. Permite crear nuevas categorías (con nombre y color) y editar o borrar las existentes. Es el equivalente desktop de `ManageScreen` en `BibScreensMobile`.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `categories` | `Category[]` | Lista actual de categorías del usuario |
| `onClose` | `fn` | Cierra el modal |
| `onCreate` | `async fn(nombre, color) → err\|null` | Crea categoría nueva |
| `onUpdate` | `async fn(id, {nombre, color}) → err\|null` | Actualiza categoría |
| `onDelete` | `async fn(id) → err\|null` | Borra categoría |

El contrato de las funciones CRUD es idéntico al de `ManageScreen` (mobile): devuelven `null` si OK o un string de error.

## Estado interno

| Estado | Descripción |
|---|---|
| `nuevoNombre` / `nuevoColor` | Campos del formulario de creación |
| `editingId` | ID de la categoría en modo edición (o `null`) |
| `editNombre` / `editColor` | Campos del formulario de edición inline |
| `busy` | Bloquea botones mientras hay una operación en curso |
| `error` | Mensaje de error a mostrar (ej: nombre duplicado) |

## Flujo principal

1. El formulario superior crea categorías (submit = Enter o botón "+ Crear").
2. La lista inferior muestra categorías existentes; cada una tiene botones "Editar" / "Borrar".
3. "Editar" expande el formulario inline de esa categoría; "Borrar" pide `window.confirm` antes de ejecutar.
4. Todos los callbacks son async y esperados: `busy = true` durante la operación, se resetea al terminar.

## Diferencias respecto a ManageScreen (mobile)

| Aspecto | ManageCategoriasModal (desktop) | ManageScreen (mobile) |
|---|---|---|
| Formato | Modal centrado con backdrop blur | Pantalla full-screen con slide desde la derecha |
| Selector de color | `<input type="color">` nativo + swatches | Solo swatches (`PALETTE`) |
| Paleta de swatches | 10 colores (`SUGGESTED_PALETTE`) | 10 colores (mismo set, misma variable nombre) |
| Muestra conteo de libros | No | Sí (ej: "3 libros") |

La diferencia más práctica es el `<input type="color">` desktop: permite al usuario elegir cualquier color arbitrario. Mobile solo tiene los 10 swatches.

## Conexiones de salida

No hace queries a Supabase directamente. Todo va a través de los callbacks `onCreate`, `onUpdate`, `onDelete` que vienen de `VistaBiblioteca`, que a su vez los delega a `useBiblioteca`.

## Conexiones de entrada

- `VistaBiblioteca` — lo monta cuando `showManageCats === true`
