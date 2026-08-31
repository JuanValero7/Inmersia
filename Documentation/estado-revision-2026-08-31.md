# Revisión de código pre-lanzamiento — 31 ago 2026

Punto de partida para una sesión nueva. Contexto: Juan iba a enseñar Inmersia a
sus seguidores de Instagram (~20 personas) y pidió una revisión completa
priorizada por impacto, con foco en seguridad, adaptabilidad de pantallas y
posibles crashes.

**Cómo usar este archivo:** la sección "Pendiente" es la lista de trabajo. Los
números (#8, #9…) son los de la revisión original y se conservan para que las
referencias cruzadas sigan teniendo sentido.

---

## Estado del repositorio

- **Nada commiteado.** Todo el trabajo está en el árbol de trabajo de `main`.
  `git checkout .` revierte el código; las imágenes originales están además en
  `_originales/` (ignorado por git).
- **Migraciones 037, 038 y 039 YA aplicadas en producción.** El código sin
  commitear depende de ellas — en particular la vista `perfiles_publicos`.
- **Las migraciones 040, 041, 042 y 043 están escritas pero NO aplicadas**, y
  todas van ANTES de desplegar el código:
  - sin la **040**, la sección "Frases más subrayadas" de la ficha de Tienda
    sale vacía (la vista no existe todavía);
  - sin la **041**, la sala de espera del Foro **no abre**: el canal ya pide
    `private: true` y sin las políticas de `realtime.messages` no conecta;
  - sin la **042**, el historial del chat deja de guardarse: la app ya hace
    `upsert` y sin el índice único no hay contra qué resolver el conflicto;
  - sin la **043**, el botón de eliminar cuenta da error (la función no
    existe), la descarga de datos sale sin `genero` y la retención de 90 días
    del chat que promete la política no se cumple.
- Build, ESLint (`--quiet`) y los 26 tests pasan.

---

## Hecho

### P0 — bloqueantes

1. **Cualquier usuario logueado podía leer cualquier libro completo por URL.**
   `LectorRoute.jsx` no comprobaba propiedad y la RLS daba `USING (true)` a
   `authenticated`. Arreglado en dos capas: comprobación de propiedad vía la
   query compartida de React Query (sin viajes de red extra si viene de
   Biblioteca/Tienda), y recorte de capítulos en `useLectorData` cuando está en
   modo muestra. En la BD, migración **037**. El paywall ahora distingue
   invitado (`Crear cuenta`) de usuario sin el libro (`Ir a la Tienda`).

2. **Deadlock de auth.** `ensureProfile` se llamaba dentro del callback de
   `onAuthStateChange`, que corre dentro del lock exclusivo de supabase-js.
   Movido a `setTimeout(…, 0)`.

3. **El usuario nuevo no veía el tutorial.** Carrera entre el `SELECT` de
   `onboarding_completado` (1 viaje) y el `SELECT`+`INSERT` de `ensureProfile`
   (2 viajes). `ensureProfile` ahora está memoizado por `user.id` y el
   controlador de onboarding espera su promesa.

4. **Políticas RLS de prod fuera del repo.** Exportadas a
   `supabase/Migration/000_politicas_actuales.sql` (retrato, no se ejecuta).
   La utilidad para regenerarlo es `supabase/exportar-politicas.sql`.

### Hallazgo extra durante P0

**Todos los nombres del Foro salían como "Lector".** Las tres políticas de
`perfiles` restringen a la fila propia, así que la app no podía leer el nombre
de nadie más. Resuelto con la vista `perfiles_publicos` (migración **038**,
solo `id/nombre/apellido`) y repuntando los cuatro sitios de lectura cruzada.
`fecha_nacimiento` sigue sin salir de `perfiles`.

> Corrige el punto #14 de la revisión original, donde se dijo lo contrario
> (que había una fuga de datos). No la había.

### P1

5. **Peso de imágenes.**
   - Tres `<img>` de fondos por libro (`hero_url`) iban en crudo:
     `LateralHome`, `UltimosAbiertos`, `CategoriasHome`. Ahora pasan por
     `imgUrl()`. Cinco fondos: 587 KB → 94 KB.
   - Landing: solo el primer mundo bloquea el primer pintado; los otros cuatro
     se cargan por DOM en `requestIdleCallback`. **No usar estado de React
     aquí**: `usePortal` gobierna la clase `active` de esos mismos `<img>` de
     forma imperativa.
   - Assets recodificados: 1509 KB → 357 KB. Logos a PNG de 256 colores
     manteniendo nombre y extensión (cero cambios en las 14 referencias).
     `inmersia-logo-stacked.png` borrado (0 usos).
   - Landing eager: **1338 KB → 113 KB**.

6. **Navegador in-app de Instagram.** Seis accesos a storage sin proteger, no
   tres. El peor estaba en la limpieza del efecto de `useSesionLectura`, así
   que reventaba al *salir* de un libro. "Confirm email" desactivado en el
   dashboard. Banner de "abrir en tu navegador" **descartado** por decisión de
   Juan (en iOS no hay forma fiable de todos modos).

7. **Foro.** Migración **039**: `CHECK` de 2000 en `contenido`, máximo 5
   etiquetas, trigger que recorta cada etiqueta a 40 (no cabe en un `CHECK`:
   Postgres no admite subconsultas), `CHECK` de 1000 en `resenas_libros.texto`,
   y política `superusuario_comentarios_delete`. En la UI, botón
   "Eliminar (moderar)" con confirmación, y los envíos ya no vacían el cuadro
   de texto en silencio si la BD rechaza.

8. **Un fallo de red se veía como una pantalla vacía y muda.** Biblioteca,
   Tienda, Álbum y Perfil consumen `.data ?? []` y ningún error de query se
   mostraba. Resuelto con `components/AvisoRed.jsx`, montado una vez en
   `App.jsx`: se suscribe al caché de React Query y solo mira queries
   **activas** (con observadores montados), así un error viejo de una pantalla
   ya abandonada no da la lata. Distingue dos casos porque React Query los trata
   distinto:
   - **Sin conexión** → con `networkMode: 'online'` la query no falla, queda en
     `fetchStatus: 'paused'` y la pantalla giraría para siempre. El aviso dice
     *"Parece que no tienes conexión"* y **no** ofrece "Reintentar": no serviría
     de nada y React Query reanuda sola al volver la señal.
   - **Con conexión, query en error** → *"No pudimos cargar tus datos"* +
     botón, que hace `refetchQueries({ type: 'active' })` acotado por
     `predicate` a las que fallaron.

   Además, `retry` bajado de 3 (el default) a 2 en `main.jsx`: con backoff
   exponencial, tres reintentos dejaban ~7 s de pantalla muda antes de poder
   avisar; con dos son ~3 s, y sigue absorbiendo un hipo de red sin avisar en
   falso.

   **Alcance:** cubre las tres queries compartidas de `lib/queries.js` (perfil,
   catálogo, biblioteca del usuario). **Fuera de cobertura** a propósito: los
   fetches sueltos que no pasan por React Query — `categorias_usuario` y
   `progreso_lectura` en `useBiblioteca.js`, y las nueve queries del
   `Promise.all` de `useAlbum.js`. Se evaluó migrarlas a React Query para que
   el aviso las cubriera; **descartado por Juan** (el Álbum no debería fallar y
   su fallo no es grave). El estado vacío de cada pantalla sigue pintándose
   debajo del aviso; también se descartó silenciarlo, porque obligaba a tocar
   los 8 componentes (desktop + móvil) por una mejora cosmética.

9. **Adaptabilidad de pantallas: el Swimlane y las polaroids del Lector.**

   **La franja no era 821–1023.** Medido con Playwright sobre el layout real:
   las pestañas **Novedades** y **Recomendaciones** del Swimlane estaban rotas
   desde 821 hasta **~1500 px**, o sea también en un portátil normal. Las dos
   ponen una portada incompresible (`flexShrink: 0`, 207 px) y una lista
   lateral de ancho fijo (300 / 210 px) en una columna que es `flex:3` de la
   fila superior, es decir ~60 % del ancho útil. Como la columna del medio
   tenía `minWidth: 0`, era la que cedía: **título, autor, reseña y los botones
   se colapsaban a cero** antes de que se viera desbordamiento. Al final la
   fila de botones "Ver detalle"+"Preview" (234 px, no se dejan encoger) se
   salía de la caja. El iPad apaisado son 1024 px, así que estaba dentro.

   Arreglado midiendo la caja real —no el viewport, que aquí no dice nada— con
   un hook nuevo, `useAnchoContenedor` en `clay/helpers.jsx` (mismo idioma que
   el `ResizeObserver` que ya usaba `CategoriasHome`). Por debajo de 880 px
   (Recomendaciones) / 800 px (Novedades) la lista lateral **no se esconde**:
   baja a una tira horizontal debajo del spotlight, que es la única forma de
   traer otro libro al centro. Ahí la portada baja a 220 px para que todo entre
   en los 500 px de alto fijos de la tarjeta, y por debajo de 560 px se
   compactan tipografías y botones para que los dos sigan en una línea.

   > Se probó una talla intermedia de lista (200 px, para que un portátil de
   > 1440 la tuviera al lado). **Descartada:** entra por geometría pero deja la
   > reseña en una línea y los botones apilados. La tira se lee mejor.

   Dos cosas más que salieron de las mediciones:
   - Las tres píldoras de pestañas suman 428 px y se salían por debajo de
     ~870 px de viewport. Ahora envuelven.
   - El contenido de la tarjeta se centraba con `justifyContent: center` sobre
     un `overflowY: auto`. Al crecer el contenido, eso deja la parte de ARRIBA
     fuera del alcance del scroll (bug conocido de flexbox) y se comía la
     píldora del título. Cambiado a `margin: auto 0` en el hijo.

   **Lector.** La página en sí ya era responsive (`computeGeom`); el problema
   era `PolaroidStack`, anclado a `calc(50% + halfBook − 110px)`. El `- 64` de
   `computeGeom` dejaba 32 px de margen lateral y las polaroids piden 50, así
   que se salían y `overflow-x: hidden` las dejaba recortadas e inalcanzables.
   **Tampoco era cosa de la franja:** cuando el ancho manda, ese margen es 32
   SIEMPRE — en una ventana de 1440x1080 también. Se subió el margen a 56
   (`MARGEN_LATERAL`), que cuesta 24 px de página por lado y hace que quepan en
   todos los anchos y en las dos vistas (comprobado por aritmética en
   860/1024/1280/1440/1920 × alto 800/1080). Queda un `cabenPolaroids` como red
   de seguridad para cuando muerda el suelo de 300 px.

   **Herramientas** (Playwright instalado como dev dependency):
   - `probe.html` + `src/probe.jsx` — banco de pruebas: monta la fila superior
     REAL de Biblioteca con datos falsos, así se mide sin pasar por el login.
     Solo en dev (`/probe.html`); el build solo empaqueta `index.html`.
   - `node scripts/medir-layout.mjs <url>` — por ancho y pestaña: desbordes y
     ancho real de la columna de texto.
   - `node scripts/capturar-layout.mjs <url> <carpeta>` — capturas.
   - `node scripts/medir-desborde.mjs <url> [anchos]` — detector genérico para
     cualquier pantalla pública.
   - `node scripts/crear-cuenta-revision.mjs` — crea una cuenta desechable con
     biblioteca poblada y deja las credenciales en `.env.revision.local`
     (ignorado por git vía `.env.*.local`). **Escribe en producción.**
   - `node scripts/revisar-pantallas.mjs [urlBase] [carpeta]` — el barrido de
     las siete pantallas con esa cuenta.

   **Barrido de TODAS las pantallas (hecho después, con cuenta real).**
   `scripts/revisar-pantallas.mjs` entra con una cuenta y recorre Biblioteca,
   Tienda, Álbum, Perfil, Lector, Cartelera y Foro en 860/900/1024/1100/1280/
   1440. Resultado: **ninguna pantalla tiene un problema real de adaptabilidad**
   aparte de los ya arreglados. Todo lo que marcó el detector resultó ser
   adorno superpuesto a propósito:
   - Tienda — `.img-plate` se sale [-228..1088] en 860 px: es la ilustración de
     la calle, a sangre y más ancha que la pantalla por diseño. Está centrada y
     el **único** hotspot (la tienda Inmersia) queda visible y clicable en los
     seis anchos (comprobado midiendo su caja contra el viewport).
   - Cartelera — `.cart-file-peek` (una carpeta que asoma), `.cart-placa` 3 px
     fuera de su holder, el `.edge` de `.cart-bk-closed`: todos absolutos y
     dibujados para sobresalir. El tablero escala bien a 900 px.
   - Lector — un `<span>` de 74 px con hijos absolutos de hasta 92: es el icono
     del cuaderno, dibujado por piezas.
   - Perfil — `.pf-field-locked` se pasa 2 px a 860 px, y solo con un correo de
     43 caracteres (el de la cuenta de prueba). Con un email normal no ocurre.
   - Biblioteca y Foro: limpios en los seis anchos.

   > **Aprendizaje sobre el método:** el detector de "no cabe en su caja"
   > (`scrollWidth > clientWidth`) da muchísimos falsos positivos en este
   > código, porque la estética ilustrada usa solapes deliberados por todas
   > partes. El que vale es el de "se sale del viewport", y aun ese hay que
   > contrastarlo a ojo. Y ninguno de los dos habría cazado el fallo grande de
   > #9: allí **no** había desbordamiento, el texto simplemente se colapsaba a
   > cero ancho. Por eso el barrido lleva capturas además de números.

   Sin arreglar, cosméticos y anotados aquí para no volver a investigarlos:
   `.pf-nav` de Perfil es `width: 336px; flex-shrink: 0` y a 900 px se come el
   37 % de la pantalla para tres enlaces; en Álbum los contadores "0 de 0"
   envuelven feo a 900 px.

   La landing sí se verificó (es pública): sin desbordes de 860 a 1440. El
   detector marca `.inm-chips`, pero es falso positivo — los chips se colocan a
   propósito fuera de su caja (`left: -16%`) y caen dentro del viewport.

10. **#11 — `viewport-fit=cover`.** Decidido: **añadirlo**, no quitar el código.
    Las 17 reglas con `env(safe-area-inset-*)` están en 6 de las 7 hojas
    móviles, así que la intención era clara y solo faltaba el meta. Además, sin
    él la página queda encajonada y en el Lector con tema oscuro se veía una
    banda crema arriba (el fondo del body) que no pega con nada.

    Al activarlo, esas reglas empiezan a trabajar — pero también quedan al
    descubierto los sitios que NO las tenían. Encontré tres y los arreglé:
    - `album.mobile.css` era la única hoja móvil sin una sola `env()`.
      `.album-m-top` tenía 7 px de padding pelados y se habría metido bajo la
      muesca.
    - `.album-m-gato-wrap` y `.album-m-pegarhint` van `position:absolute` con
      `bottom:6px/10px`. Ojo con esto: **un `padding-bottom` en la raíz NO los
      sube**, porque un absoluto se resuelve contra la caja de relleno del
      ancestro. Hubo que meterles el `env()` en su propio `bottom`.
    - `.inm-nav` de la landing es `position:fixed; top:0`. Lleva
      `padding-top: env(...)` para que el fondo siga yendo a sangre bajo el
      notch pero el contenido baje.

    > **Sin verificar y hay que hacerlo en un iPhone real.** Chromium no expone
    > safe-area insets, así que Playwright no puede probar esto: los `env()`
    > valen 0 igual que antes. Lo que sí está comprobado es que no hay
    > regresión en escritorio. Mirar: la barra del Álbum móvil, el gato y el
    > chip de "pegar barajita" abajo, y la barra de la landing.

11. **#12 — Cartelera.** El punto original decía "tablero fijo de 1180×760 con
    escala mínima 0.32; por debajo de ~1100 px las fichas quedan muy pequeñas".
    **No es lo que pasa.** El tablero usa `useFitScale` con mínimo 0.2 y escala
    bien: a 900 px se lee perfectamente (ver `capturas-revision/`). El código
    cambió desde la revisión. Lo que sí había, en la ficha interior:

    - **El gato tapaba nombres del índice a CUALQUIER ancho**, no solo en la
      franja. `.cart-signpost` estaba suelto en la escena, anclado al viewport
      (`left:20px; bottom:44px`), mientras que la lista se ancla al cuaderno
      —que además va escalado por `.book-scale`—. Por ese desajuste **ningún
      `calc` fijo lo arregla**: probé reservar hueco al pie de la lista y el
      solape seguía variando entre 80 y 126 px según el alto de la ventana.
      La solución fue mover `<Signpost>` DENTRO de `.page.left` (Ficha.jsx),
      así escala con el cuaderno y su sitio es exacto en coordenadas de libro;
      la lista le reserva 200 px al pie. Solape final: 7-10 px, todo dentro del
      relleno inferior de la lista. Ningún nombre queda tapado. De paso el gato
      queda sentado sobre la página, que se ve mejor que flotando encima.
    - **La pista central chocaba con el título** por debajo de ~1150 px:
      `.cart-sec-hint` va centrada en absoluto sobre una `topbar` cuyo chip de
      título crece hacia el centro. Media query que la saca del absoluto y la
      baja a una segunda línea. Aquí una media query de viewport SÍ vale: la
      topbar ocupa el ancho de la pantalla, al revés que el Swimlane de #9.

    Para poder abrir la ficha hizo falta un libro con contenido de cartelera y
    progreso de lectura; la cuenta de revisión tiene "Capitanes Intrépidos"
    (192 items) al 100 %. La ficha es enrutable directamente:
    `/investigacion/<slug>?seccion=personajes`.

### P3 — Seguridad de segundo orden

12. **#13 — `subrayados_usuario` con SELECT `USING (true)`.** La migración 013
    abrió la tabla entera para poder contar el "top 3" de frases subrayadas, de
    modo que cualquier logueado podía leer `user_id, libro_id, capitulo_num,
    texto_original` de todo el mundo. Migración **040**: vista
    `subrayados_populares` (una fila por libro+párrafo, `count(DISTINCT
    user_id)`, sin `user_id` en la salida, `security_invoker = false` como
    `perfiles_publicos`) y la política de la tabla de vuelta a
    `auth.uid() = user_id`, que es la que traía la 011.

    Solo había un consumidor de datos ajenos, `PanelLibro.jsx`; los otros tres
    (`Notebook.jsx`, `useLectorData.js` ×2) ya filtraban por `user_id`. De paso
    se corrigen dos fallos del conteo viejo, que traía 500 filas y agregaba en
    el cliente: el "top 3" era arbitrario en cuanto un libro pasara de 500
    subrayados, y contaba dos veces a quien subrayara el mismo párrafo dos
    veces. Ahora bajan 3 filas ya ordenadas. El scan lo cubre
    `idx_subrayados_libro_con_parrafo` (migración 030), parcial sobre
    exactamente el mismo `WHERE parrafo_id IS NOT NULL`.

    > Se consideró un umbral (`HAVING count(DISTINCT user_id) >= 2`) para no
    > publicar la frase que subrayó una sola persona. **Descartado por ahora:**
    > la vista no expone `user_id`, así que un total de 1 dice "alguien subrayó
    > esto", no quién, y con ~20 usuarios el umbral dejaría la sección vacía.
    > Queda comentado en la migración.

13. **#15 — `vercel.json` sin cabeceras de seguridad.** Añadidas siete:
    `Content-Security-Policy`, `Strict-Transport-Security`,
    `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
    `Permissions-Policy` y `Cross-Origin-Opener-Policy`.

    La CSP pudo salir **estricta** porque la superficie externa resultó ser
    mínima: Supabase (REST, Storage, Auth y el `wss://` del Realtime del Foro)
    y Google Fonts, y nada más — sin OAuth, sin analytics todavía, sin
    iframes, sin `eval`. Así que `script-src 'self'` sin `'unsafe-inline'`, que
    es donde está casi todo el valor de una CSP.

    **`style-src` también quedó sin `'unsafe-inline'`, y eso costó un cambio.**
    `clay/Shelves.jsx` inyectaba un `<style>` al importar el módulo, con las
    reglas `.inm-bk` (el hover que levanta los libros) y `.inm-bk-ttl`. No era
    código muerto: las usa `CategoriasHome`, que sí está viva. Movidas a
    `styles/biblioteca.css` y borrada la inyección. Los `style={{…}}` de React
    no estorban: los aplica por CSSOM, que la CSP no gobierna.

    > Ojo con `subrayados_populares` de la 040 y con esto: son los dos sitios
    > donde el `USING (true)` o el `'unsafe-inline'` habrían sido el atajo.

    **Verificado, no supuesto.** `node scripts/verificar-csp.mjs` levanta un
    servidor estático sobre `dist/` con las cabeceras **leídas de
    `vercel.json`** (no copiadas, para que no puedan divergir), entra con la
    cuenta de revisión y recorre las siete pantallas escuchando el evento
    `securitypolicyviolation` del documento. Hacía falta ese evento: una CSP
    bloquea en silencio, no rompe el render, así que mirar capturas no sirve.
    Resultado: **cero violaciones, cero errores de consola**, las fuentes web
    cargan y la regla `.inm-bk:hover` sigue presente.

    Tres cosas que hay que recordar:
    - **El host de Supabase va escrito a mano** en `vercel.json`: ese archivo
      es JSON estricto y Vercel no interpola variables de entorno ahí. Si
      cambia el proyecto de Supabase, hay que tocar la CSP.
    - **PostHog y Sentry ya vienen autorizados**, aunque todavía no estén
      instalados: `eu.i.posthog.com` y `eu-assets.i.posthog.com` (PostHog EU,
      que es la decisión del checklist) y `*.ingest.de.sentry.io` /
      `*.ingest.us.sentry.io` para cualquiera de las dos regiones de Sentry.
      Se abrieron por adelantado a propósito: si no, al conectarlos fallan en
      silencio y no hay nada en la app que explique por qué. Si acabas usando
      otro host (PostHog en EEUU, o un proxy propio), es cambiar esa línea.
      `worker-src` lleva `blob:` porque el grabador de sesiones de PostHog
      levanta su worker así.
    - **Si tienes Vercel Analytics o Speed Insights activados** en el
      dashboard, `script-src 'self'` los bloquea. Se ve en la consola del
      navegador la primera vez que abras producción.

    HSTS va con `max-age=63072000; includeSubDomains` pero **sin `preload`**:
    entrar en la lista de precarga de los navegadores es una puerta de un solo
    sentido y no hace falta para esto.

14. **#16 — la sala de espera del Foro era un canal público.**
    `foro-sala:<foro_id>` es un canal de presencia, y los canales públicos de
    Realtime no pasan por ninguna RLS: bastaba la anon key —que va en el
    bundle— para unirse a la sala de cualquier libro y ver quién estaba, sin
    tener siquiera cuenta.

    Migración **041**: el canal pasa a privado (`config: { private: true }`) y
    se autoriza con RLS sobre `realtime.messages`, que exige un JWT de usuario.
    La regla replica la del Foro, no una más estricta: tener sesión y que el
    topic apunte a un foro que exista de verdad. El Foro es visible para
    cualquier usuario con sesión desde la 002 y los spoilers se manejan con
    etiquetas (027), así que gatear la sala por propiedad del libro habría sido
    inventar una regla que el producto no tiene.

    Los otros dos canales del chat, `chat-invite:<user>` y `chat-msgs:<sesion>`,
    **no** tenían este problema: solo transportan `postgres_changes`, que sí
    aplica la RLS de `chat_sesiones` y `chat_mensajes` a cada suscriptor.

    **Un agujero peor, encontrado al mirarlo.** El nombre viajaba dentro del
    payload de presencia (`track({ user_id, nombre })`), y ese payload lo
    escribe quien se anuncia. Con el JS modificado, cualquiera podía aparecer
    en la sala de cualquier libro firmando con el nombre que quisiera —
    incluido el tuyo— y el que picara «Chatear» abría sesión contra el
    `user_id` que el impostor hubiera puesto. Ahora solo viaja el `user_id` y
    el nombre se resuelve contra `perfiles_publicos`.

    > **Lo que sigue abierto:** ninguna RLS puede validar el contenido de un
    > `track()`, así que todavía se puede reclamar el `user_id` de otra
    > persona. Ya no se puede inventar una identidad, pero sí suplantar a
    > alguien que existe. Cerrarlo del todo pide cambiar la presencia por una
    > tabla con RLS (`WITH CHECK (user_id = auth.uid())`) y postgres_changes.
    > Anotado, no hecho: es bastante más obra y el impacto es que aparezca un
    > nombre falso en una lista de sala.

    De paso, `entrarSala()` ignoraba `CHANNEL_ERROR`: si el canal no conectaba,
    el botón simplemente no hacía nada y no había forma de saber por qué. Ahora
    hay aviso (`.sala-error`, mismo idioma que `.pf-err`).

15. **#18 — `npm audit`: de 9 vulnerabilidades a 2.** `npm audit fix` sin
    `--force` resolvió siete: `brace-expansion`, `js-yaml`, `nanoid`,
    `postcss`, `undici` y la única de runtime, `react-router` 7.18.0 → 7.18.3.
    Verificado después con lint, los 19 tests, el build y el barrido completo
    de `verificar-csp.mjs`, que recorre las siete pantallas — o sea que el
    enrutado sobrevivió al bump.

    **Quedan 2 y se dejan a propósito:** `esbuild` ≤0.24.2 y el `vite` que
    depende de él. Arreglarlas es `vite` 5 → 8, un salto de dos mayores en la
    herramienta de build, justo antes de lanzar. El fallo es del **servidor de
    desarrollo** (cualquier web abierta en tu navegador puede pedirle cosas
    mientras corres `npm run dev`) y no viaja al usuario: no toca ni el bundle
    ni producción. Cuando se haga, que sea con tiempo y no en la misma semana
    del lanzamiento.

### P4 — Bugs concretos

16. **#19 — `useWhiteNoise`: el `AudioContext` se cerraba tres veces.** La capa
    de ruido se desmontaba en el cuerpo del efecto al ENTRAR, en su propio
    cleanup, y otra vez en un tercer efecto de desmontaje. React ejecuta el
    cleanup antes de volver a entrar, así que el desmontaje de arriba siempre
    llegaba a un contexto ya cerrado; `close()` devuelve una promesa y la
    segunda se rechaza, sin nadie que la recogiera: un unhandled rejection por
    cada cambio de tipo de ruido. El tercer efecto repetía la jugada al salir
    del lector, porque los refs no se anulaban.

    Ahora el cleanup del efecto es el único dueño de esa capa (y anula los
    refs), y el efecto de desmontaje se eliminó: el `<audio>` del ambiente ya
    se limpia en el efecto que lo crea. Añadido también `ctx.resume()` cuando
    nace `suspended`, que es lo que pasa en iOS —el efecto corre después del
    render, ya fuera de la ventana del gesto del usuario— y dejaba el ruido
    mudo sin ningún error que lo explicara.

17. **#20 — `fetchChapter` cambiaba de identidad en cada capítulo.** Llevaba
    `chapterCache` en sus deps. El caché tiene que seguir siendo estado porque
    el render lo lee (`currentChapData`), así que la solución es un espejo en
    un `useRef`: es lo que consultan `fetchChapter` y el nuevo `peekChapter`,
    y las dos se quedan con deps vacías.

    **Cuidado si se toca esto:** hay cuatro escritores del caché, no uno —
    `fetchChapter` y tres mutaciones de superusuario (`quitarMedia`,
    `sugerirMedia`, `borrarParrafo`). Si el ref y el estado se actualizan por
    separado se desincronizan y un párrafo borrado reaparece al volver al
    capítulo. Todos pasan ahora por `actualizarCache()`.

    En los dos lectores, el efecto que carga el capítulo usa `peekChapter` en
    vez de leer el caché directamente, así que sus deps son todas estables y
    ya no necesita excluir nada.

18. **#21 — `subrayar()` pintaba marcas fantasma.** Ignoraba el error del
    insert y añadía la marca amarilla con `id: null`. El resultado era un
    subrayado que se veía en la página, no salía en el Cuaderno y **no se podía
    borrar**, porque el Cuaderno borra por id. Ahora, si el insert falla, no se
    pinta nada y la función devuelve `false`.

19. **#23 — `chat_historial` crecía sin techo.** Migración **042**: índice
    único por `(user_id, foro_id, partner_id)`, borrado previo de los
    duplicados y política de UPDATE (faltaba: sin ella el upsert que choca
    contra el índice lo rechaza la RLS). En la app, `upsert` en vez de
    `insert`.

    No era solo desperdicio: `loadHistorial` pedía 25 filas y las deduplicaba
    en el cliente para sacar 5 personas, así que **hablar 25 veces con la misma
    persona escondía el resto del historial**. Ahora pide 5 y no deduplica
    nada.

20. **#22 — los 29 avisos de `exhaustive-deps` son ruido, no bugs.** Los revisé
    uno por uno y ninguno esconde un fallo real. Se reparten en tres familias:

    - **Identidades que ESLint no puede saber que son estables:** refs
      (`restoredRef`), setters de `useState` que llegan por el objeto que
      devuelve `useLectorData` (`setError`, `setLoadingCap`, `setIsLeido`…) y
      `useCallback` con deps vacías (`invalidateBiblioteca`). Son la mayoría.
    - **Callbacks de un solo disparo** que consumen una bandera:
      `onNotebookStarted`, `onJumpConsumed`, `onToggleXray`. Incluirlos haría
      que volvieran a dispararse si el padre pasa una función en línea, que es
      justo lo contrario de lo que se quiere.
    - **Valores ya cubiertos por una dep más estrecha:** `user?.id` en lugar de
      `user`, `currentChapter?.id` en lugar de `currentChapter`.

    **No se tocaron a propósito.** Añadir deps a los efectos del Lector —
    paginación, restauración de posición, persistencia de progreso— es
    exactamente donde una dep de más provoca un salto de página visible, y no
    hay ningún bug que lo justifique. Lo que sí bajó es el acoplamiento real:
    el arreglo de #20 quitó `chapterCache`/`fetchChapter` de las deps de los
    dos efectos que cargan capítulo. Si algún día molesta el ruido, el camino
    es silenciar las dos primeras familias con un `eslint-disable` razonado,
    no añadir las deps.

### Revisión legal (31 ago 2026) — resuelve #17

21. **#17 y revisión completa de los dos documentos legales.** El punto era
    que los Términos prometían un botón de borrar cuenta inexistente. Al
    contrastar frase por frase contra el código aparecieron nueve promesas
    más que la app no cumplía, y datos que se recogían sin declarar. Ambos
    documentos reescritos y la app alineada:

    - **Responsable y jurisdicción.** De «desarrollador individual, Estonia»
      a persona física en Berlín, con dirección postal (§ 5 DDG) y derecho
      alemán. Correo `legal@inmersia.io` en lugar del gmail personal. Cuando
      exista la OÜ estonia hay que volver a cambiarlo — está anotado dentro
      de los propios documentos.
    - **Datos sin declarar.** Fecha de nacimiento y género (obligatorios en
      el registro y ausentes de la política), reseñas, subrayados, sesiones
      de lectura, álbum, predicciones y preferencias. Todos en la tabla ahora.
      Y una sección nueva que dice sin rodeos qué ven los demás usuarios:
      nombre y apellido reales firman foro, reseñas y sala de chat.
    - **Base legal del género.** Era «consentimiento explícito» sobre un
      campo obligatorio, lo que no se sostiene: un consentimiento forzado no
      es consentimiento. Pasa a interés legítimo (art. 6.1.f), que es lo que
      corresponde al uso real (análisis y recomendaciones).
    - **Edad.** 14 para tener cuenta, 16 para el chat privado uno a uno —
      decisión de Juan sobre las opciones planteadas. El registro **valida**
      la fecha (antes se pedía y no se comprobaba nada) y la sala de espera
      del Foro se cierra a los menores de 16: sin sala no hay presencia, y
      sin presencia nadie los puede invitar. Límites en `src/lib/edad.js`,
      con tests.
    - **Borrar cuenta (el #17).** Botón real en Perfil → Legal, con
      confirmación escribiendo ELIMINAR. Detrás, `eliminar_mi_cuenta()`:
      función SECURITY DEFINER que borra de `auth.users` con `auth.uid()`
      y deja que el CASCADE se lleve el resto. Elegida sobre una Edge
      Function porque no hay que desplegar nada aparte ni custodiar la
      `service_role`, y el uid no es un parámetro: no se puede pedir que
      borre a otro.
    - **Retención del chat.** La política prometía 90 días y no había purga
      ninguna. `purgar_chat_antiguo()` + job diario de `pg_cron`.
    - **Portabilidad.** Botón «Descargar mis datos» (JSON con perfil,
      biblioteca, progreso, notas, subrayados, reseñas y comentarios). Los
      mensajes de chat quedan fuera a propósito: son conversación de dos.
    - **Aceptación.** Casilla obligatoria en el registro en lugar de un «al
      continuar aceptas» al pie, y se guarda en el metadata qué versión se
      aceptó y cuándo (`LEGAL_VERSION` en `constants.js`).
    - **Acceso a los documentos.** Enlaces en el pie de la landing: hasta
      ahora solo se llegaba a ellos desde el registro o el perfil, o sea que
      quien no tenía cuenta no podía leer la política.
    - **Cláusulas que con derecho alemán se caían.** El tope de
      responsabilidad a 3 meses de pagos y la renuncia a demandas colectivas.
      Reescrito el §9 con el esquema de dolo/culpa grave/obligaciones
      esenciales, y eliminada la renuncia.
    - **Modelo de negocio.** Los Términos describían un Premium mensual que
      no existe (y ponían el Foro detrás del pago). Ahora describen lo que
      hay —todo gratis, muestra de dos capítulos, límite de 5 pendientes— y
      reservan el derecho a cobrar en el futuro con 30 días de aviso y sin
      cobrar retroactivamente por lo ya obtenido.
    - Quitado el aviso final de «revisar con un abogado», que se le estaba
      mostrando al usuario dentro del modal legal.

### Limpieza

- **`FlatShelves` es código muerto.** `clay/Shelves.jsx` exporta `FlatShelves`
  y `ShSpine`, pero de ese archivo solo se importa `CartoonPlank`. Son ~120
  líneas con un `minWidth: 1216` y un layout entero de posiciones absolutas
  calculadas contra esa rejilla fija. Era el sospechoso número uno de #9 y
  resultó no estar conectado a nada. **Pendiente de borrar** (no se tocó: es
  una eliminación grande y merece su propio repaso).
- `HojasOtono` eliminado por completo (componente, uso en `HeaderSwimlane`,
  ~25 líneas de CSS). Era legacy. Con él se fue el único breakpoint de 1023 px,
  que resuelve el punto #10.

---

## Pendiente

### Bloqueante de la revisión legal

- **Correr la migración 043 antes de desplegar.** Sin ella el botón de borrar
  cuenta da error de función inexistente, la descarga de datos sale sin la
  columna `genero` y la retención de 90 días del chat no se cumple.
  Si `pg_cron` no está activo, la migración avisa por WARNING y hay que
  habilitarlo en Dashboard → Database → Extensions.

### Hallazgos nuevos, sin priorizar

- `media_por_parrafo` y `album_imagenes` son vistas y no aparecen en
  `pg_policies`: probablemente saltan la RLS. Un invitado podría leer imágenes
  y sonidos más allá del capítulo 2 (metadatos y URLs, no el texto).
- `cartelera_items` y `elementos_interactivos` siguen en `USING (true)` para
  `authenticated`: se puede leer el contenido de investigación (spoilers) de
  libros no adquiridos.
- `libro2-cutout.webp` (87,5 KB) es ahora lo más pesado de la landing: 1200 px
  de ancho para pintarse a ~690. Bajaría a ~35 KB.
- `biblioteca.css` pide `font-family:'Caveat', cursive` en `.book-scribble`,
  pero **Caveat no está en el `<link>` de Google Fonts** de `index.html`, así
  que esa nota manuscrita de las portadas siempre cae a la cursiva del sistema.
  Salió al comprobar qué fuentes web cargan de verdad bajo la CSP (#15).
  Cosmético: o se añade la familia al link, o se quita de la hoja.

### Decisiones tomadas, no volver sobre ellas

- **`bibliotecas_usuarios` no tendrá política de DELETE.** Nadie puede quitar
  un libro de su biblioteca; con el límite de 5 pendientes, es deliberado.
- **Sin banner de "abrir en tu navegador"** para el WebView de Instagram.
- **La calidad de las imágenes recodificadas está aprobada.** No revisarla.
- **La suplantación en la sala del Foro se deja abierta** (ver punto 14).
  Decisión de Juan el 2026-08-31, con el análisis delante: el impostor no
  puede leer ninguna conversación —`chat_mensajes_select` exige ser parte de
  la sesión—, así que el daño máximo es un nombre falso en la lista y una
  lluvia de invitaciones de chat a la persona suplantada. Muy rebuscado para
  la escala actual. Cerrarlo pide sustituir la presencia por una tabla con
  RLS (~150 líneas, y trae fantasmas de sesión), y **eso dejaría sin función
  a la 041**. Se revisará si algún día aparece alguien dispuesto a hacerlo.
  Nota aparte: cambiarse el nombre en Perfil logra el mismo efecto visual sin
  tocar código, así que cerrar la presencia tampoco lo resolvería del todo.

---

## Notas de entorno

- Reiniciar el dev server tras editar módulos con estado a nivel de módulo
  (`ensureProfile.js`) o contextos: el HMR deja la app en estado inconsistente
  y da síntomas falsos de "login/logout roto".
- En el SQL Editor de Supabase, `auth.uid()` es `NULL` (corre como `postgres`).
  Las comprobaciones que dependan de un usuario autenticado hay que hacerlas
  desde la app.
- **`npm audit fix` puede dejar el árbol mentido.** Aquí actualizó
  `package-lock.json` y su lockfile oculto (`node_modules/.package-lock.json`)
  pero NO llegó a escribir los archivos: `npm audit` cantaba «2
  vulnerabilidades» mientras en disco seguían las versiones viejas. La culpa
  era de tres `esbuild.exe` y tres `vite` de dev servers abiertos, que
  bloqueaban los binarios nativos en Windows. Después de tocar dependencias,
  comprobar la versión **en disco**
  (`grep '"version"' node_modules/<paquete>/package.json`), no lo que diga
  `npm ls` — que puede estar mostrando el árbol ideal. Si no cuadra: cerrar
  los dev servers y `npm ci`.
- Las imágenes de `public/` se sirven desde Vercel, **no** desde Supabase
  Storage, así que `imgUrl()` no las toca. Solo reescribe URLs que contengan
  `/storage/v1/object/public/`.
