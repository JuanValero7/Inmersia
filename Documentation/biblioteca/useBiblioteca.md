# useBiblioteca

**Tipo:** Hook de datos  
**Ruta:** `src/hooks/useBiblioteca.js`  
**Plataforma:** Compartido (desktop + mobile)

## Propósito

Centraliza la lógica de datos del home de Biblioteca para que `VistaBiblioteca` (desktop) y `BibliotecaMobile` no dupliquen fetches ni CRUD. Solo vive aquí lo que es independiente de la UI (perfil, categorías, libros, memos derivados). Lo que depende del estado de cada plataforma (búsqueda, grupos filtrados, categoría activa, libro seleccionado) queda en cada componente.

## Entradas

| Parámetro | Tipo | De dónde viene |
|---|---|---|
| `user` | objeto sesión Supabase | App.jsx (sesión activa) |
| `lastOpenedBookIds` | `string[]` | `useLocalStorage('lastOpened', [])` en App.jsx |

## Lo que retorna

| Valor | Tipo | Descripción |
|---|---|---|
| `rawBooks` | `Book[]` | Libros de Supabase con `progress` (0–1) resuelto desde `progreso_lectura` + `MANUAL_USUARIO` al frente |
| `loadingBooks` | `boolean` | true mientras se fetcha la primera carga |
| `perfil` | `{nombre, apellido}` o `null` | Datos del perfil del usuario |
| `categories` | `Category[]` | Categorías del usuario, ordenadas por `orden` luego `nombre` |
| `categoriasMap` | `{[id]: Category}` | Memo: lookup O(1) de categoría por ID |
| `books` | `Book[]` | Memo: rawBooks con `color` y `categoryName` resueltos |
| `featured` | `Book` o `null` | Memo: el libro a destacar en el hero |
| `displayName` | `string` | Nombre para mostrar (nombre + apellido, o email username) |
| `inicial` | `string` | Primera letra de displayName, para el avatar |
| `fetchCategories` | `async fn` | Refresca categorías (usar tras CRUD externo) |
| `fetchUserBooks` | `async fn` | Refresca libros + progreso (usar tras CRUD externo) |
| `createCategoria` | `async (nombre, color) → err\|null` | Primitiva pura |
| `updateCategoria` | `async (id, fields) → err\|null` | Primitiva pura |
| `deleteCategoria` | `async (id) → err\|null` | Primitiva pura; NO limpia UI |
| `assignCategoriaToBook` | `async (libroId, catId) → void` | Primitiva pura; NO sincroniza selectedBook |

## Flujo principal

1. Al montar se lanzan 3 efectos independientes: fetch de perfil, fetch de categorías (`fetchCategories`), fetch de libros + progreso (`fetchUserBooks`).
2. `fetchUserBooks` lanza en paralelo (`Promise.all`) dos queries: `bibliotecas_usuarios → libros` y `progreso_lectura` (solo `libro_id, porcentaje`). Las dos queries corren al mismo tiempo; no hay latencia adicional respecto a cargar solo los libros.
3. Se construye `progMap = { [libro_id]: porcentaje }` y al mapear cada libro se resuelve `progress = progMap[id] / 100` (convierte 0–100 entero a 0–1 float que espera `HeroFeatured`). Si no hay registro en `progreso_lectura`, `progress` queda en `null`.
4. Se filtran filas donde `libros === null` (libro borrado o bloqueado por RLS en Supabase).
5. El resultado se mapea a un objeto normalizado y se antepone siempre `MANUAL_USUARIO` (el libro guía de bienvenida, hardcodeado en el cliente).
4. `categoriasMap` es un `useMemo` que construye un objeto `{[id]: categoría}` para lookups O(1).
5. `books` es un `useMemo` que recorre `rawBooks` y resuelve el color: si el libro tiene categoría, usa el color de la categoría; si no, usa `_baseColor` del libro.
6. `featured` es un `useMemo` que intenta encontrar el primer ID de `lastOpenedBookIds` en `books`. Si no lo encuentra, toma `books[0]` (excluyendo el manual).

## Conexiones de salida

- `supabase` (de `src/lib/supabase.js`) — todas las queries van por acá
- `MANUAL_USUARIO`, `COLOR_BOOK_FALLBACK2` (de `src/components/biblioteca/constants.js`)

## Conexiones de entrada

- `VistaBiblioteca` (`src/components/Biblioteca.jsx`)
- `BibliotecaMobile` (`src/components/mobile/BibliotecaMobile.jsx`)

## Decisiones no obvias

**Primitivas puras para delete y assign:** `deleteCategoria` y `assignCategoriaToBook` no tocan estado de UI deliberadamente. Cada componente las envuelve en un wrapper local que sí limpia su propio estado (categoría activa, libro seleccionado). Esto permite compartir el hook sin acoplar su lógica a cada plataforma.

**Flag `activo` en efectos:** Todos los efectos usan `let activo = true` con cleanup `() => { activo = false }`. Evita el error de "setState en componente desmontado" cuando el usuario navega antes de que llegue la respuesta.

**`MANUAL_USUARIO` hardcodeado:** El libro "Manual del Explorador" no está en Supabase para el usuario; se inserta en el cliente como primer elemento de `rawBooks`. Tiene `id: 'manual'` para que los componentes lo identifiquen y lo excluyan de conteos, asignación de categoría, reseñas, etc.

**`color` resuelto en `books`:** El color que ve el usuario no siempre es el del libro — si está en una categoría, hereda el color de esa categoría. Esto crea consistencia visual entre el lomo del libro y su etiqueta de categoría.

## Dependencias de datos (Supabase)

| Tabla | Columnas usadas | Operación |
|---|---|---|
| `perfiles` | `id`, `nombre`, `apellido` | SELECT, filtro por `id = user.id` |
| `categorias_usuario` | `id`, `nombre`, `color`, `orden` | SELECT, INSERT, UPDATE, DELETE — filtro por `user_id` |
| `bibliotecas_usuarios` | `leido`, `categoria_id`, join `libros(...)` | SELECT, UPDATE `categoria_id` |
| `libros` | `id`, `slug`, `titulo`, `autor`, `paginas`, `descripcion`, `color`, `portada_url`, `metadata`, `es_ficcion` | SELECT (vía join) |

## Dependencias de datos (Supabase)

| Tabla | Columnas usadas | Operación |
|---|---|---|
| `perfiles` | `id`, `nombre`, `apellido` | SELECT, filtro por `id = user.id` |
| `categorias_usuario` | `id`, `nombre`, `color`, `orden` | SELECT, INSERT, UPDATE, DELETE — filtro por `user_id` |
| `bibliotecas_usuarios` | `leido`, `categoria_id`, join `libros(...)` | SELECT, UPDATE `categoria_id` |
| `libros` | `id`, `slug`, `titulo`, `autor`, `paginas`, `descripcion`, `color`, `portada_url`, `metadata`, `es_ficcion` | SELECT (vía join) |
| `progreso_lectura` | `libro_id`, `porcentaje` | SELECT — filtro por `user_id`, en paralelo con el join de libros |
