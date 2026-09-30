# Contexto — Comunidades en Inmersia (para arrancar sesión nueva)

Estado al 30 sep 2026. La capa de comunidad **dentro del lector** está programada (escritorio y móvil) y pendiente de que Juan la pruebe; ver «Capa en el lector» abajo.

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
- **Subrayados y notas siguen siendo solo del usuario.** Se descartó el subrayado compartido y la casilla "Compartir con…" (Opción B): con sonidos + subrayados propios, otro subrayado era un circo. `comentarios_lectura.texto_citado` (052) queda sin uso.
- **Al abrir un libro** (reemplaza el "¿Cómo quieres leer?", que ya no existe): la capa solo aparece si alguna comunidad mía leyó o está leyendo ese libro (`comunidad_lecturas`).
  - Si es la de "Leer como" → arranca **encendida**.
  - Si no (Solo yo u otra) → se toma la de **más miembros** (empate: cualquiera) y arranca **apagada**, con un aviso la primera vez por libro (localStorage `inm_capa_aviso_<libro>`). No toca `comunidad_activa`.
  - La comunidad solo se cambia desde la Biblioteca.
- **Dos cosas distintas en el libro**:
  - `comentarios_lectura`: comentario **para toda la comunidad**, anclado a un párrafo. **No se responden.** Los borra el autor o el moderador; los demás los denuncian.
  - `mensajitos`: regalito **1 a 1** (16+ en ambos lados; sin fecha de nacimiento cuenta como permitido, el campo es obligatorio). Anclado al primer párrafo que empieza en la página donde se escribió; aparece en esa página. **No se responden.** Opción "Se borra cuando lo lea" (`efimero`): el cliente lo borra al cerrarlo. Solo los borra **quien los recibe** (o Juan tras una denuncia); ni el que envía ni el moderador. **No caducan.**
  - Si alguien sale de la comunidad, sus comentarios y mensajitos se quedan.
- **Spam**: sin tope por ahora (control social). Si hace falta, un trigger de N comentarios/hora.
- **Relecturas del mismo libro**: "problema del futuro", no resolver ahora.

## Mockups aprobados
- **Capa en el lector (definitivo)**: https://claude.ai/artifact/26p6iHJ4u4asXzo1HzSzwB — botón del margen = **Caritas** (iniciales de quien comentó; más adelante sirve para silenciar a alguien); mensajitos = listón diagonal en la esquina de afuera de la hoja; móvil: chip solo-ícono + "Comunidad" en la bandeja del gato; puntito naranja si hay un mensajito sin abrir en el capítulo.
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
| 058 | `mensajitos.efimero`; `mensajitos_delete` solo para `para_id` o superusuario; RPC `puede_recibir_mensajitos(comunidad)` (solo ids, vacío si quien pregunta es menor de 16). **Pendiente de correr.** |
| 059 | Purga diaria (pg_cron) de denuncias resueltas a los 6 meses. |
| 060 | Revisión de denuncias (ver Pendientes → Denuncias). |

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

## Capa en el lector (hecho el 30 sep, sin probar en navegador)
- Datos: `src/hooks/useCapaComunidad.js` (`useComunidadDelLibro`, `useCapaComunidad`). Comentarios por capítulo (join `parrafos!inner(capitulo_id)`), mensajitos por libro, nombres de `perfiles_publicos`. Claves en `queries.js`.
- UI en `src/components/comunidades/capa/`:
  - `capaShared.jsx`: `useCapaNucleo` (on/off, aviso, puntito), `CapaHoja` (caritas, listón y "lámina" de elegir párrafo, superpuesta a la hoja), `Hilo`, `Nota`, `Acciones` (⋯ Borrar/Denunciar), formularios.
  - `CapaEscritorio.jsx` → `useCapaEscritorio` devuelve `chip`, `renderHoja`, `flotante`. `BookReader` recibe `comunidadChip` y `renderCapa` (prop `overlay` de `Leaf`).
  - `CapaMovil.jsx` → `useCapaMovil` devuelve `chip`, `herramienta` (bandeja del gato), `overlay` (prop de `MobileBookPage`), `capas`.
- Elegir párrafo = una lámina transparente sobre la hoja: no toca el texto, ni el subrayado, ni los sonidos, ni la paginación.
- Párrafos partidos entre páginas: la carita va solo donde empieza el párrafo.
- El enlace "Discútelo en el foro de la comunidad" está **comentado** en `Hilo` (sin decidir si se usa).
- Estilos: prefijo `cl-` al final de `comunidades.css` y `comunidades.mobile.css`.
- Probado por Juan el 30 sep: todo bien. Futuro: silenciar a alguien desde la carita.
- Legal (30 sep): `misDatos.js` suma comunidades, comentarios, mensajitos **enviados** y denuncias hechas (sin la copia del texto ajeno). Política y Términos actualizados (qué ven los miembros, moderación, denuncias, retención, 16+ en mensajitos). Migración **059**: purga diaria de denuncias resueltas a los 6 meses (pg_cron). **Pendiente de correr.**

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
- **Denuncias** (hecho 30 sep, falta probar): migración **060** (denunciado_id, libro_id, parrafo_id, resolucion, resuelta_at; RPC denuncias_para_revisar y resolver_denuncia, solo superusuario; la purga de 059 pasa a contar desde resuelta_at). Revisión en **Perfil → Denuncias** (SecDenuncias.jsx, solo superusuario, numerito de pendientes). Denunciar comunidad con motivo: ⋯ del buscador (escritorio y móvil) y enlace «Denunciar» en el pie de «Ver comunidad» (no para moderadores). Acciones: descartar, borrar, sacar, renombrar («Comunidad sin nombre»), cerrar (escribir el nombre), deshacer. Sin ocultado automático: decide Juan. Sacar no bloquea: si es pública puede volver a unirse. Avisar al autor cuando se le borra algo: para más adelante.
- **Códigos de invitación**: limitar los intentos para que no se puedan adivinar.
- **Chat**: pasar la regla de 16 años del chat a la base de datos (hoy solo la aplica el cliente, en `src/lib/edad.js`).
- **Gamificación** (plan aparte, sin empezar): tiempo por capítulo, barajitas y tiempo leído en el hero, "Tu viaje por el libro" y los puntos C–H de tracción a la cartelera.
