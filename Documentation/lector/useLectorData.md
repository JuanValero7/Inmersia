# useLectorData

**Tipo:** Hook de datos  
**Ruta:** `src/hooks/useLectorData.js`  
**Plataforma:** Compartido (desktop + mobile)

## Propósito

Centraliza toda la lógica de datos del Lector inmersivo que es idéntica en desktop y mobile: carga de capítulos, restauración de progreso, caché de capítulos, reseñas, subrayados y operaciones de superusuario. Los componentes que lo consumen solo agregan geometría, paginación, chrome y audio.

La separación es explícita en el archivo: lo que va aquí (datos independientes de UI) vs. lo que queda en cada componente (guardado de progreso por página, marcar 100%, audio de ambiente, chrome).

## Entradas

| Parámetro | Tipo | De dónde viene |
|---|---|---|
| `book` | objeto libro | `LectorRoute` (mapeado de Supabase) |
| `setChapterIndex` | `fn` (setter de useState) | `Lector.jsx` / `LectorMobile.jsx` |
| `setPageIndex` | `fn` (setter de useState) | `Lector.jsx` / `LectorMobile.jsx` |

`setChapterIndex` y `setPageIndex` se reciben como parámetros porque la restauración de progreso necesita reposicionar la UI desde el hook — patrón poco común que evita duplicar el efecto de restauración en cada componente.

## Lo que retorna

| Valor | Tipo | Descripción |
|---|---|---|
| `userId` | `string \| null` | UID del usuario autenticado (null si invitado) |
| `capitulos` | `Capitulo[]` | Lista ordenada de capítulos del libro |
| `chapterCache` | `{ [capId]: ChapterEntry }` | Caché de capítulos ya cargados |
| `loading` | `boolean` | true durante la carga inicial de la lista de capítulos |
| `loadingCap` | `boolean` | true mientras se carga un capítulo individual |
| `error` | `string \| null` | Mensaje de error (si ocurrió alguno) |
| `isLeido` | `boolean` | Si el libro está marcado como terminado |
| `setIsLeido` | `fn` | Setter expuesto para que el componente pueda actualizarlo al llegar al 100% |
| `pendingRestore` | `string \| null` | ID del párrafo donde el usuario se quedó (para restaurar posición) |
| `setPendingRestore` | `fn` | Setter; el componente lo limpia una vez que restaura |
| `restoredRef` | `ref` | `useRef` que indica si ya se restauró el progreso (guard para no guardar antes de restaurar) |
| `setLoadingCap` | `fn` | Setter para que el componente controle el estado de carga del capítulo |
| `setError` | `fn` | Setter de error expuesto al componente |
| `fetchChapter` | `async fn` | Carga párrafos + media + ambient de un capítulo con caché |
| `playSfx` | `fn` | Reproduce un sonido puntual (botón ♪) sin estado |
| `persistChapterAdvance` | `async fn` | Actualiza `porcentaje` y marca `leido` si corresponde |
| `subrayar` | `async fn` | Inserta un subrayado en Supabase |
| `quitarMedia` | `async fn` | Elimina vínculo explícito párrafo↔media y actualiza caché |
| `marcarMedia` | `async fn` | Marca un media como `destacado=true` en `biblioteca_media` |
| `sugerirMedia` | `async fn` | Crea vínculo explícito párrafo↔media y actualiza caché |
| `borrarParrafo` | `async fn` | Borra un párrafo permanentemente via RPC `delete_parrafo_superuser` |
| `miResena` | `object \| null` | Reseña actual del usuario para este libro |
| `resenaForm` | `{ rating, texto }` | Draft del formulario de reseña |
| `setResenaForm` | `fn` | Setter del draft |
| `resenaEnviando` | `boolean` | true durante el submit de la reseña |
| `submitResena` | `async fn → boolean` | Guarda la reseña; retorna `true` si se guardó |

### Tipo `ChapterEntry`

```javascript
{
  parrafos: Parrafo[],
  mediaByParrafo: { [parrafoId]: Media[] },
  ambient: Media | null,   // primer audio de origen 'tag' (ambiente del capítulo)
}
```

## Flujo principal

1. **Usuario:** `supabase.auth.getUser()` resuelve `userId`. El flag `userReady` evita que el siguiente efecto corra dos veces (con `userId=null` y luego con el ID real).
2. **Capítulos:** Cuando `userReady` es `true` y cambia `book.libro_id`, carga la lista de capítulos de `capitulos` ordenados por `numero`. Si el usuario está autenticado, busca en `progreso_lectura` el `ultimo_parrafo_id` y resuelve en qué capítulo quedó. Llama `setChapterIndex(startChapter)` y guarda el párrafo en `pendingRestore`.
3. **Capítulo individual (`fetchChapter`):** Lazy y memoized. Hace dos queries en paralelo: `parrafos` y `media_por_parrafo` del capítulo. Agrupa la media por `parrafo_id`. Extrae el primer audio de origen `'tag'` como `ambient`. Guarda el resultado en `chapterCache`.
4. **Reseña:** Se carga solo si `isLeido === true` (no antes). Al cerrar el libro o al terminar, el componente puede llamar `submitResena()`.
5. **Operaciones de superusuario:** Todas actualizan `chapterCache` localmente después de la operación en Supabase — no hacen refetch. Esto permite al superusuario ver el efecto inmediatamente sin recargar.

## Decisiones no obvias

**`userReady` como guard:** Sin él, el efecto de carga de capítulos corre una vez con `userId=null` (antes de resolver la sesión) y otra con el ID real. La primera llamada limpia `chapterCache` y resetea la posición, perdiendo el progreso que la segunda encontraría. El flag asegura que el efecto solo corre después de conocer la identidad del usuario.

**`restoredRef` como ref en lugar de estado:** El guard de "no guardar progreso antes de restaurar" (`if (!restoredRef.current) return`) no necesita causar un re-render cuando cambia. Usar `useRef` evita un ciclo de render innecesario.

**Setters de UI como parámetros del hook:** `setChapterIndex` y `setPageIndex` son setters de `useState` del componente padre. Son referencias estables (React garantiza esto), por eso no van en las dependencias del efecto. El patrón permite que el hook reposicione la UI directamente sin callbacks ni contexto adicional.

**Caché de media por párrafo:** `mediaByParrafo` es un índice construido en memoria al cargar cada capítulo. Supabase devuelve la media como una lista plana con `parrafo_id`; el indexado hace que el render de cada párrafo sea O(1) en lugar de O(n).

**`ambient` = primer audio de origen `'tag'`:** El audio de ambiente del capítulo no tiene una columna dedicada — se detecta como el primer `media` de tipo `'audio'` cuyo campo `origen` es `'tag'` (asignado automáticamente por un trigger de Supabase al vincular via tags de escena). Si hay varios audios de tag, solo el primero se usa como ambiente.

**`persistChapterAdvance` vs. guardado por página:** Esta función solo se llama cuando el usuario cierra el cuaderno de lectura al avanzar de capítulo. Actualiza `porcentaje` pero no `ultimo_parrafo_id` — ese lo guarda cada componente en su propio efecto de página. Si el porcentaje calculado es ≥ 90 %, marca `leido=true` en `bibliotecas_usuarios` y activa `isLeido`.

## Dependencias de datos (Supabase)

| Tabla | Columnas | Operación |
|---|---|---|
| `capitulos` | `id, numero, titulo` | SELECT, filtro por `libro_id`, orden por `numero` |
| `parrafos` | `id, capitulo_id, numero, contenido, tipo, escena_tags, tiene_interactivo` | SELECT, filtro por `capitulo_id` |
| `media_por_parrafo` | `parrafo_id, media_id, slug, tipo, url, titulo, descripcion, metadata, origen` | SELECT, filtro por `capitulo_id` |
| `progreso_lectura` | `ultimo_parrafo_id` | SELECT para restaurar |
| `progreso_lectura` | `porcentaje, updated_at` | UPDATE al avanzar capítulo |
| `bibliotecas_usuarios` | `leido` | UPDATE cuando porcentaje ≥ 90% |
| `resenas_libros` | `rating, texto` | SELECT (al abrir si `isLeido`) / UPSERT |
| `subrayados_usuario` | `user_id, libro_id, capitulo_num, texto_original, parrafo_id` | INSERT |
| `elementos_interactivos` | `parrafo_id, media_id, metadata` | DELETE (quitarMedia) / INSERT (sugerirMedia) |
| `biblioteca_media` | `destacado` | UPDATE (marcarMedia) |
| `biblioteca_media` | `id, slug, tipo, url, titulo, descripcion, metadata` | SELECT (después de sugerirMedia, para actualizar caché) |
| RPC `delete_parrafo_superuser` | — | Borra párrafo + actualiza progreso_lectura (SECURITY DEFINER) |

## Conexiones de entrada

- `Lector.jsx` (`VistaLectura`) — desktop
- `LectorMobile.jsx` — mobile

## ⚠️ Deuda técnica

**`progreso_lectura.porcentaje` no se refleja en `bibliotecas_usuarios`:** El campo `progreso` en `bibliotecas_usuarios` no existe aún. Por eso la barra de progreso en la Biblioteca siempre muestra "Aún no registramos tu progreso". Ver también `useBiblioteca.js` línea 73.
