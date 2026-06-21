# Base de datos — Biblioteca

Tablas de Supabase que toca la feature de Biblioteca. Ver también `supabase/Migration/` para los SQL completos.

---

## `perfiles`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | FK → `auth.users.id` |
| `nombre` | `text` | Nombre del usuario |
| `apellido` | `text` | Apellido (puede ser null) |

**Usada por Biblioteca:** Solo para mostrar el saludo ("¡Hola otra vez, Javier!"). Se lee en `useBiblioteca` al montar.

**RLS:** El usuario solo puede leer su propia fila (`id = auth.uid()`).

---

## `categorias_usuario`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `auth.users.id` |
| `nombre` | `text` | Nombre de la categoría (ej: "Favoritos") |
| `color` | `text` | Color hex (ej: `#7d5bbe`) |
| `orden` | `integer` | Para ordenar las categorías del usuario |

**Operaciones:** SELECT (ordenado por `orden` luego `nombre`), INSERT, UPDATE, DELETE.  
**RLS:** El usuario solo puede leer/escribir sus propias categorías.  
**Restricción:** `nombre` único por usuario (error de duplicate que `createCategoria` maneja con mensaje amigable).

---

## `bibliotecas_usuarios`

| Columna | Tipo | Descripción |
|---|---|---|
| `user_id` | `uuid` | FK → `auth.users.id` |
| `libro_id` | `uuid` | FK → `libros.id` |
| `leido` | `boolean` | Si el usuario marcó el libro como leído |
| `categoria_id` | `uuid` | FK → `categorias_usuario.id` (nullable) |
| `progreso` | `numeric` | ⚠️ PENDIENTE — columna no creada aún |

**Usada por Biblioteca:** SELECT con join a `libros`, UPDATE de `categoria_id`.  
**RLS:** El usuario solo puede ver/editar sus propias filas.

**Nota sobre el join:** Supabase puede devolver `libros: null` para filas donde el libro fue borrado o bloqueado por RLS. `useBiblioteca` filtra estas filas con `.filter(r => r.libros)` para evitar errores en el `.map()`.

**Deuda pendiente:** La columna `progreso` (0..1) está documentada como TODO en `useBiblioteca.js:73`. Cuando se cree, hay que:
1. Añadirla a la migración SQL.
2. Incluirla en el `.select()` de `fetchUserBooks`.
3. Cambiar `progress: null` por `progress: typeof r.progreso === 'number' ? r.progreso : null`.
4. Actualiza también `Biblioteca.mobile.md` — la barra de progreso en el hero mobile también está preparada para esto.

---

## `libros`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | PK |
| `slug` | `text` | Identificador URL (ej: `el-principito`) |
| `titulo` | `text` | Título del libro |
| `autor` | `text` | Autor (nullable → default "Desconocido") |
| `paginas` | `integer` | Cantidad de páginas (nullable → default 200) |
| `descripcion` | `text` | Resumen |
| `color` | `text` | Color hex del libro |
| `portada_url` | `text` | URL de la portada (nullable → se genera portada) |
| `metadata` | `jsonb` | Metadata variada |
| `es_ficcion` | `boolean` | Si es ficción o no ficción |
| `animation_key` | `text` (?) | ⚠️ No está en el select actual — ver [BookOpenTransition.md](BookOpenTransition.md) |

**Accedida desde Biblioteca únicamente vía join en `bibliotecas_usuarios`.**

---

## `resenas_libros`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `auth.users.id` |
| `libro_id` | `uuid` | FK → `libros.id` |
| `rating` | `integer` | 1–5 estrellas |
| `texto` | `text` | Texto de la reseña (nullable) |

**Usada por:** `useResena` (que usan tanto `BibBookModal` como `BibBookSheet`).  
**RLS:** El usuario solo puede leer/escribir su propia reseña. La operación es un upsert (`INSERT ... ON CONFLICT DO UPDATE`).  
**Condición para mostrar:** La sección de reseña solo aparece si `book.leido === true` y el libro no es el manual.
