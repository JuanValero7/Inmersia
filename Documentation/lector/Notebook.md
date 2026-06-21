# Notebook

**Tipo:** Componente modal (memoizado)  
**Ruta:** `src/components/lector/Notebook.jsx`  
**Plataforma:** Compartido (desktop + mobile)

## Propósito

Cuaderno de lectura modal. Permite al usuario guardar predicciones y anotaciones por capítulo, y consultar sus subrayados. Se abre antes de avanzar al siguiente capítulo (tanto en desktop como en mobile), y también puede abrirse manualmente desde el botón del cuaderno.

Es el único componente del módulo Lector que se reutiliza tal cual en desktop y mobile — el orquestador lo instancia de forma idéntica en ambas plataformas.

## Entradas (props)

| Prop | Tipo | Descripción |
|---|---|---|
| `isOpen` | `boolean` | Controla si el modal está visible |
| `onClose` | `fn` | Callback al cerrar — el componente guarda los borradores antes de llamarlo |
| `userId` | `string \| null` | UID del usuario |
| `libroId` | `string` | ID del libro |
| `capituloNum` | `number` | Número del capítulo que el usuario está leyendo (marca la solapa activa) |
| `capitulos` | `Capitulo[]` | Lista de capítulos (para el tooltip de las solapas) |

## Lo que retorna

Modal de pantalla completa con:
- **Header** rojo con título "Cuaderno de lectura" y botón cerrar.
- **Tabs horizontales** de tipo: Predicciones (verde) · Anotaciones (rosa) · Subrayados (amarillo).
- **Cuerpo** con textarea (predicciones/anotaciones) o lista de subrayados.
- **Solapas laterales de capítulo** (derecha) — solo aparecen las que tienen nota o el que está leyendo.
- **Footer** con botón "Guardar y continuar →".

## Flujo principal

1. Al abrirse (`isOpen = true`), llama `loadIndex()` que hace 3 queries paralelas: `capitulo_num` de predicciones y anotaciones (para saber qué solapas mostrar) y todos los subrayados del libro.
2. Construye el set `tabCaps` = unión de capítulos con nota + `capituloNum` actual.
3. Llama `loadChapter(capituloNum)` para cargar el borrador del capítulo actual en `drafts`.
4. Al seleccionar una solapa de capítulo (`selectCap`), carga el borrador de ese capítulo si no estaba cargado.
5. Al editar un textarea, marca el draft como `dirty: true`.
6. Al cerrar (`handleClose`), itera todos los drafts `dirty` y los guarda en paralelo:
   - Predicciones → `upsert` con conflicto en `(user_id, libro_id, capitulo_num)`.
   - Anotaciones → `update` si ya tiene `anotId`, `insert` si es nueva.
7. Llama `onClose()` después de que se resuelven todos los saves.

## Decisiones no obvias

**Persistencia al cerrar, no al teclear:** Los drafts viven en estado local hasta que el usuario cierra el cuaderno. Guardar en tiempo real requeriría debounce + gestión de conflictos si el usuario navega entre solapas rápidamente. El costo de perder un borrador si la app crashea es bajo (el cuaderno no es el lugar principal de escritura del usuario).

**`tabCaps` dinámico:** Las solapas solo aparecen si hay algo escrito en ese capítulo (o es el que se está leyendo). El índice no incluye todos los capítulos — solo los que tienen al menos una nota o subrayado. Esto evita mostrar 40 solapas vacías en libros largos.

**`capituloNum •` en la solapa activa:** El punto indica visualmente que esa solapa corresponde al capítulo que el usuario está leyendo ahora, sin texto adicional que ocupe espacio en la solapa vertical.

**Líneas de cuaderno via `repeating-linear-gradient`:** El fondo del textarea reproduce el patrón de un cuaderno de rayas con `32px` de separación (coincide con `lineHeight: 32px` del textarea). Así las líneas del CSS y el texto quedan alineados.

**`subrayados` se trae completo sin paginación:** `loadIndex()` carga todos los subrayados del libro para construir `tabCaps`. En libros con muchos subrayados (> ~200) la lista puede tardar en cargar. Ver deuda técnica.

## Dependencias de datos (Supabase)

| Tabla | Columnas | Operación |
|---|---|---|
| `predicciones_usuario` | `capitulo_num` | SELECT (loadIndex — para solapas) |
| `predicciones_usuario` | `contenido` | SELECT (loadChapter) |
| `predicciones_usuario` | `user_id, libro_id, capitulo_num, contenido, updated_at` | UPSERT (al cerrar) |
| `anotaciones_usuario` | `capitulo_num` | SELECT (loadIndex — para solapas) |
| `anotaciones_usuario` | `id, contenido` | SELECT (loadChapter) |
| `anotaciones_usuario` | `user_id, libro_id, capitulo_num, contenido` | INSERT (al cerrar, si nueva) |
| `anotaciones_usuario` | `contenido` | UPDATE (al cerrar, si existente) |
| `subrayados_usuario` | `id, texto_original, capitulo_num` | SELECT (loadIndex — todos) |
| `subrayados_usuario` | `id` | DELETE (al eliminar subrayado) |

## Conexiones de salida

- `supabase` — todas las queries
- `clay.jsx` — `theme`, `ClayButton`
- `guidedTour.js` — `getTourPhase()` (para lanzar el tour del cuaderno)
- `tutorial.js` — `runGuidedNotebook1()`

## Conexiones de entrada

- `Lector.jsx` — lo instancia al fondo del render, siempre montado
- `LectorMobile.jsx` — ídem

## ⚠️ Deuda técnica

**`subrayados_usuario` sin límite:** `loadIndex()` trae todos los subrayados del libro sin `.limit()`. Un usuario con muchos subrayados (> ~200) generará una query lenta. Implementar paginación o traer solo los IDs de capítulo en el índice y los textos bajo demanda al seleccionar la solapa.
