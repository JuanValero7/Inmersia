# Contexto — Comunidades en Inmersia (para arrancar sesión nueva)

Estado al 30 sep 2026. Lo que sigue es la capa de comunidades **dentro del lector**; Juan ya tiene el plan y lo explica en el mensaje.

## Cómo trabajar con Juan
- Español de Venezuela, **tuteo** (nunca voseo) en toda la copy.
- **Antes de un cambio estructural**, explicar la lógica y pedir el OK. **Antes de editar archivos existentes**, listarlos: guardo copia automática en `Documents\Inmersia_respaldos\<fecha>\` y lo digo.
- Diseño: **primero mockup** (página HTML publicada como artifact, con la paleta real: naranja `#F2792A`, tinta `#4a3622`, crema `#fffdf8`, papel `#FBF5EC`, Baloo 2 + Poppins; el texto del libro en Lora), Juan lo aprueba y **después** se programa.
- Diagnosticar la causa antes de parchear. Al reemplazar algo, borrar lo viejo (archivos, estilos, rutas).
- Las migraciones las corre Juan en Supabase → SQL Editor. Si sale el aviso de RLS, elegir **"Run without RLS"** (los scripts ya activan la RLS).
- Verificar con `npx eslint <archivos>` y `npm run build`. No se ha probado nada en el navegador desde aquí: lo prueba Juan.

## El modelo acordado
- **La comunidad es una capa sobre el libro**, no una página. No existe `/comunidad/:id` (se borró).
- **"Leer como"**: en la Biblioteca el usuario elige "Solo yo" o una de sus comunidades. Se guarda en `preferencias_usuario.comunidad_activa` (NULL = solo yo).
- **Panel "Ver comunidad"** (`ComunidadPanel`): lateral en escritorio y hoja en móvil. Contiene lectura actual, encuentro, el camino de los miembros, lecturas anteriores, gestión del moderador y la opción de salir.
- **Un solo libro, un solo progreso**: la capa solo AGREGA lo compartido por el club. Las notas y subrayados propios siguen siendo del usuario.
- **Opción B**: al subrayar o anotar con la capa activa, el contenido es **privado por defecto**. La casilla "Compartir con <comunidad>" viene **desmarcada**.
- **Al abrir un libro**: si pertenece a la comunidad activa, entra con la capa. Solo se pregunta "¿Cómo quieres leer?" cuando el libro es de otra comunidad del usuario, o de varias, con la opción "Recordar para este libro". **Aún no está hecho**: dónde guardar ese "recordar" está por decidir.
- **Dos cosas distintas en el libro**:
  - `comentarios_lectura`: comentario y/o subrayado **para toda la comunidad**.
  - `mensajitos`: nota **1 a 1** a un miembro (el "bestie"). Exige 16+ en ambos lados.
  - Ambas se anclan a `parrafo_id` y **solo se muestran en párrafos que el lector ya pasó** (anti-spoiler, en el cliente).
- **Relecturas del mismo libro**: "problema del futuro", no resolver ahora.

## Mockups aprobados
- Capa del libro (incluye el lector): https://claude.ai/artifact/8mf8a7n1KMBrwX7tqnB6yk
  - Pastilla arriba "Leyendo con: <comunidad> ▾" para cambiar de capa sin salir.
  - En el margen, un lápiz con número abre el hilo de comentarios del párrafo.
  - Un papelito doblado marca un mensajito.
  - Subrayados propios en amarillo y los del club en naranja.
  - Al seleccionar texto: Subrayar / Nota / Mensajito… + la casilla de compartir.
- Crear comunidad: https://claude.ai/artifact/7ebuJN48tunTJKNtyTUbxq
- Acceso y lista: https://claude.ai/artifact/SbAWMvw9qXE2oPgmS7MgZq

## Base de datos (`supabase/Migration/`)
| Migración | Qué hace |
|---|---|
| 051 | Crea `comunidades`, `comunidad_miembros` (rol moderador/miembro), `comunidad_codigos`, `comentarios_lectura`, `mensajitos`, `denuncias`, `creadores_comunidad` (permiso binario, el "premium" provisional), y agrega `foros_comentarios.comunidad_id`. Helpers `es_miembro`, `es_moderador`, `es_superusuario`, `edad_permite_contacto`. Triggers: el creador entra como moderador, tope de 5 comunidades por persona, herencia de la moderación, copia del texto en denuncias. RPC `unirse_con_codigo`, `regenerar_codigo`, `progreso_comunidad`. |
| 052 | `comentarios_lectura.texto_citado` (subrayado); `contenido` pasa a opcional, pero debe haber uno de los dos. `mensajitos.texto_citado`. |
| 053 | `buscar_comunidades(texto)`: solo públicas, máx. 20, con número de miembros. |
| 054 | `comunidad_lecturas` (libro, `fecha_meta`, `encuentro_lugar`, `encuentro_fecha`, `inicio`, `fin`; la actual tiene `fin` NULL, solo la ven los miembros). Un trigger arma el historial al cambiar `comunidades.libro_id`. El código de invitación lo elige el creador: 6–20 caracteres `A-Z0-9`. `_comunidad_poner_codigo`. |
| 055 | `crear_comunidad(...)` SECURITY DEFINER, con comprobaciones explícitas (sesión y permiso de creador). |
| 056 | Reparación. La 051 había quedado a medias (sin triggers ni políticas). **Incluye la consulta de verificación**: deben salir 5 triggers y 26 políticas (31 filas). |
| 057 | `preferencias_usuario.comunidad_activa`. Confirmar con Juan que ya la corrió. |

**Trampas ya vividas**
- `INSERT ... RETURNING` exige pasar la política de **SELECT**. Un creador todavía no es miembro en ese instante, así que falla con 42501.
- Un `UPDATE` sin permiso bajo RLS **no da error**: afecta 0 filas. Por eso las mutaciones usan `.select('id')` y cuentan las filas.
- Antes de culpar al código, verificar que las políticas y triggers existen (`pg_policies`, `pg_trigger`).

## Frontend actual
- `src/hooks/useComunidades.js`: todas las queries y acciones.
  - Lectura: `useMisComunidadesQuery`, `useComunidadActiva` (una sola fuente vía caché de React Query), `useComunidadQuery`, `useProgresoComunidadQuery`, `useLecturasAnterioresQuery`, `useBuscarComunidadesQuery`.
  - Acciones: `useUnirseComunidad`, `useCrearComunidad`, `useGestionComunidad`.
  - Utilidades: `mensajeError` (mapea los `HINT` de SQL a texto), `normalizarCodigo`, `aISO`/`aLocal`.
  - Las claves de caché están en `src/lib/queries.js`.
- `src/components/comunidades/`:
  - `ComunidadesMenu.jsx`: menú de la barra de escritorio. Exporta `LeerComo`.
  - `LeerComoSheet.jsx`: la misma lista en hoja, para móvil.
  - `ComunidadPanel.jsx`: el panel y su gestión.
  - `CrearComunidad.jsx`: modal de escritorio y pantalla móvil. Exporta `Campo`, `CamposFechaEncuentro`, `LibroElegido`, `SelectorLibro`, `Portada`.
  - `comunidadesShared.jsx`: `Sello` (iniciales + `colorDeId`), filas, `fechaLarga`, `fechaEncuentro`, `diaMes`, `useDebounced`.
- `src/components/mobile/ComunidadesMobile.jsx`: ruta `/comunidades` (solo móvil) para invitación, búsqueda y creación. Recibe `state.vista` y vuelve a `/biblioteca` con `state.verComunidad`.
- Integración:
  - `Biblioteca.jsx`: el menú va dentro de `InmHeader` (prop `comunidades`) y además monta el panel.
  - `BibliotecaMobile.jsx`: su botón de la cabecera abre `LeerComoSheet`.
  - En ambos, `leerLibroDeComunidad(libroId)` abre el libro si el usuario lo tiene; si no, abre `PanelLibro` del catálogo.
- Estilos: `src/styles/comunidades.css` (prefijos `com-`, `cc-`, `cp-`) y `comunidades.mobile.css` (prefijo `comm-`).

## Lector: dónde tocar y restricciones
- `Lector.jsx` y `LectorMobile.jsx` orquestan el lector, y `useLectorData.js` maneja progreso, subrayados (`subrayados_usuario`: `texto_original` + `parrafo_id` + `capitulo_num`) y reseñas.
- Por plataforma:
  - Escritorio: `lector/BookReader.jsx`.
  - Móvil: `mobile/lector/MobileBookPage.jsx` y `mobile/lector/LectorSheets.jsx`.
  - Compartido: `lector/Notebook.jsx` (predicciones, anotaciones, subrayados).
- **Paginación móvil estable (100svh)**: costó mucho dejarla así. Marcas, lápices y papelitos van **superpuestos**, nunca dentro del flujo del texto.
- El progreso se guarda por `ultimo_parrafo_id` + `ultimo_parrafo_offset`. De ahí sale qué párrafos ya se leyeron, para decidir qué se revela.

## Pendientes fuera del lector (no urgentes)
- **Foro de comunidad**: filtrar el foro general con `.is('comunidad_id', null)` en `ForoComentarios.jsx` antes de activarlo.
- **Denuncias**: la interfaz, la política de privacidad y comunidades en `misDatos.js` (descarga de datos).
- **Códigos de invitación**: limitar los intentos para que no se puedan adivinar.
- **Chat**: pasar la regla de 16 años del chat a la base de datos (hoy solo la aplica el cliente, en `src/lib/edad.js`).
- **Gamificación** (plan aparte, sin empezar): tiempo por capítulo, barajitas y tiempo leído en el hero, "Tu viaje por el libro" y los puntos C–H de tracción a la cartelera.
