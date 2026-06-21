# SuperuserSoundsPanel

**Tipo:** Componente  
**Ruta:** `src/components/lector/SuperuserSoundsPanel.jsx`  
**Plataforma:** Compartido (desktop + mobile)

## Propósito

Panel lateral exclusivo del superusuario para gestionar la media (audio, imágenes, video) del capítulo en lectura. Tiene dos pestañas: "Ver / Gestionar" (lista y desvincula media existente) y "Sugerir" (vincula nueva media a un párrafo, con opción de anclarla a una frase exacta y de borrar párrafos).

Se abre a la derecha del viewport (`position: fixed; right: 0`) sobre el contenido del libro.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `parrafos` | `Parrafo[]` | Párrafos del capítulo actual |
| `mediaByParrafo` | `object` | Media indexada por párrafo (del caché de `useLectorData`) |
| `onQuitar` | `fn(parrafoId, mediaId, capituloId)` | Elimina vínculo explícito |
| `onMarcar` | `fn(mediaId) → Promise<boolean>` | Marca media como `destacado` |
| `onSugerir` | `fn(parrafoId, mediaId, capituloId, textoRef?)` | Crea vínculo nuevo |
| `onBorrarParrafo` | `fn(parrafoId, capituloId) → Promise<boolean>` | Borra el párrafo (RPC) |
| `onClose` | `fn` | Cierra el panel |

## Flujo principal

### Pestaña "Ver / Gestionar"

- Lista todas las combinaciones párrafo↔media del capítulo (de `mediaByParrafo`).
- Cada item muestra: `§{numero}` del párrafo, tipo de media, nombre, y dos botones:
  - **★ Marcar**: Llama `onMarcar(mediaId)`. Actualiza `marcados[mediaId] = true` localmente para feedback inmediato (no refresca el panel).
  - **✕ Quitar**: Solo activo si `origen === 'explicito'` — los media de origen `'tag'` (automáticos) no pueden quitarse desde este panel.

### Pestaña "Sugerir"

Al abrir la pestaña, carga toda la `biblioteca_media` de Supabase (sin filtro por libro/capítulo).

**Flujo de vinculación:**
1. El superusuario filtra párrafos por texto (`parrafoBusqueda`) y selecciona el párrafo destino.
2. Opcionalmente, escribe una frase exacta del párrafo en "Anclar a frase". Si la frase no se encuentra en el párrafo, el sistema advierte y vincula al párrafo completo (sin `texto_ref`).
3. Busca media en el catálogo global por título, slug o tags. Puede filtrar por tipo (audio/imagen/video).
4. Hace click en "+ Vincular" → llama `onSugerir(parrafoId, mediaId, capituloId, textoRef?)`.

**Preview de audio:** Botón ▶ por cada media de tipo `audio` reproduce un preview. Solo un audio a la vez; el mismo botón detiene la reproducción.

**Borrar párrafo:** Botón con confirmación en 2 pasos (click → aparece confirmación → click en "Sí"). Llama `onBorrarParrafo(parrafoId, capituloId)` via RPC.

## Estado local

| Variable | Descripción |
|---|---|
| `tab` | `'ver'` \| `'sugerir'` |
| `marcados` | `{ [mediaId]: true }` — feedback local de marcaciones |
| `parrafoBusqueda` | Filtro de texto para el selector de párrafo |
| `sugerirParrafoId` | ID del párrafo seleccionado |
| `textoRef` | Frase de ancla (opcional) |
| `textoRefAviso` | Advertencia si la frase no se encontró |
| `confirmDelete` | ID del párrafo pendiente de confirmar borrado |
| `allMedia` | Lista completa de `biblioteca_media` (cargada al abrir la pestaña) |
| `tipoFiltro` | Filtro de tipo: `'todos' \| 'audio' \| 'imagen' \| 'video'` |
| `busqueda` | Filtro de texto en el catálogo de media |
| `playingId` | ID del media que se está previsualizando |

## Decisiones no obvias

**`allMedia` carga toda `biblioteca_media`:** No hay filtro por libro o capítulo al cargar el catálogo global — se trae todo y se filtra en cliente. Esto es aceptable porque `biblioteca_media` es un catálogo editorial (no crece con los usuarios) y esta pantalla solo la ve el superusuario.

**`onQuitar` no puede quitar media de origen `'tag'`:** La UI deshabilita el botón si `origen !== 'explicito'`. La media de tag está vinculada al párrafo por un trigger de Supabase al procesar el campo `escena_tags` del párrafo — quitarla requeriría editar el párrafo en la base de datos, lo cual está fuera del scope de este panel.

**Confirmación en 2 clicks para borrar párrafo:** El primer click guarda el `parrafoId` en `confirmDelete` y muestra los botones Sí/No. El segundo click en Sí ejecuta el borrado. Esto evita borrados accidentales al explorar el selector de párrafos.

**`sugerirParrafoId` se sincroniza con los párrafos visibles:** Un `useEffect` escucha cambios en `parrafos` y `parrafoBusqueda`. Si el párrafo seleccionado desaparece del filtro (por búsqueda o porque fue borrado), selecciona automáticamente el primero visible. Evita que `sugerirParrafoId` quede apuntando a un párrafo inexistente.

**Preview de audio usa `audioRef` mutable:** No hay estado para el objeto `Audio` en sí — se guarda en `useRef` y se gestiona imperativamente. Mezclar `Audio` con el ciclo de vida de React (setState) causaría re-renders innecesarios en cada tick de reproducción.

## Dependencias de datos (Supabase)

| Tabla | Columnas | Operación |
|---|---|---|
| `biblioteca_media` | `id, slug, tipo, url, titulo, descripcion, tags, destacado` | SELECT (al abrir pestaña Sugerir) |

(El resto de operaciones — `onQuitar`, `onMarcar`, `onSugerir`, `onBorrarParrafo` — las ejecuta `useLectorData`, no este componente directamente.)

## Conexiones de entrada

- `Lector.jsx` — instancia el panel cuando `isSuperuser && adminPanelOpen`
- `LectorMobile.jsx` — idem
