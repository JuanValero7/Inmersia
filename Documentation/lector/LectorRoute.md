# LectorRoute

**Tipo:** Componente (guardia de ruta)  
**Ruta:** `src/components/LectorRoute.jsx`  
**Plataforma:** Compartido (desktop + mobile)

## Propósito

Punto de entrada a la experiencia de lectura para la ruta `/libro/:slug`. Resuelve quién es el usuario (autenticado vs. invitado), obtiene el libro correspondiente, y renderiza el componente Lector correcto (`LectorCmp`) con las props normalizadas. Es el único lugar donde se fetcha un libro por `slug` para invitados.

## Entradas (props)

| Prop | Tipo | De dónde viene |
|---|---|---|
| `LectorCmp` | `component` | Inyectado por `App.jsx` — `Lector.jsx` en desktop, `LectorMobile.jsx` en mobile |
| `user` | `object \| null` | Sesión Supabase de `App.jsx` |
| `currentBook` | `object \| null` | Libro seleccionado en Biblioteca (ya cargado en `App.jsx`) |
| `isSuperuser` | `boolean` | Flag de superusuario de `App.jsx` |
| `lectorStartNotebook` | `boolean` | Si debe abrir el cuaderno al entrar (desde `App.jsx`) |
| `setLectorStartNotebook` | `fn` | Limpia el flag después de que el Lector lo consume |
| `setCartelaJumpId` | `fn` | Setter de `App.jsx` para hacer jump a un item de cartelera |
| `setForoSource` | `fn` | Setter de `App.jsx` que indica al Foro que viene desde lectura |

## Flujo principal

1. Lee `slug` de `useParams()`.
2. **Si `user` existe:** usa `currentBook` directamente (ya estaba cargado en Biblioteca). Si `currentBook` es `null`, redirige a `/biblioteca`.
3. **Si `user` es `null` (invitado):** fetcha el libro desde la tabla pública `libros` por `slug`. Si no existe, redirige a `/`. Mientras carga, muestra `LoadingScreen`.
4. Renderiza `<LectorCmp>` con las props normalizadas: `book`, `guestMode`, `onRequestAuth`, `onGoBack`, `onGoCartelera`, `onGoForo`, `startWithNotebook`, `onNotebookStarted`, `isSuperuser`.

### `mapLibro(data)`

Función interna que convierte una fila de `libros` (tabla pública) a la estructura que espera el Lector:

```javascript
{
  id, libro_id,   // mismo valor — ambos usados por distintos consumidores
  slug, title, author, pages,
  _baseColor, summary, cover,
  es_ficcion,
  leido: false,   // siempre false para invitados
}
```

## Conexiones de salida

- `supabase` — fetch del libro por `slug` (solo invitados)
- `useParams`, `useNavigate`, `Navigate` — de `react-router-dom`

## Conexiones de entrada

- `App.jsx` — renderiza `LectorRoute` en la ruta `/libro/:slug`, inyecta `LectorCmp`

## Decisiones no obvias

**`currentBook` para usuarios autenticados, fetch para invitados:** Los usuarios llegan al Lector desde Biblioteca, donde el libro ya está cargado en el estado de `App`. Hacer un fetch adicional sería redundante. Los invitados llegan via URL directa (no tienen Biblioteca), así que necesitan el fetch.

**`leido: false` hardcodeado para invitados:** Los invitados no tienen registro en `bibliotecas_usuarios`. El Lector usa `isLeido` internamente para mostrar el formulario de reseña — forzarlo a `false` evita que aparezca para usuarios no registrados.

**`LectorCmp` como prop inyectada:** Permite que `App.jsx` pase `Lector.jsx` o `LectorMobile.jsx` según la plataforma, sin que `LectorRoute` tenga que conocer la diferencia. La lógica de routing es independiente del chrome visual.

## Dependencias de datos (Supabase)

| Tabla | Columnas | Operación |
|---|---|---|
| `libros` | `id, slug, titulo, autor, paginas, descripcion, color, portada_url, es_ficcion` | SELECT, filtro por `slug`, solo para invitados |

## ⚠️ Límite de capítulos para invitados

El límite de 2 capítulos para invitados **no lo implementa este componente** — lo implementa la RLS de Supabase en la tabla `parrafos`. `LectorRoute` solo pasa `guestMode={true}` al Lector, que a su vez muestra el paywall al llegar al final del segundo capítulo.
