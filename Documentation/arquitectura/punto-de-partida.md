# Punto de partida — próximas sesiones

Estado de Inmersia al cerrar la sesión del **10 oct 2026**, y lo que queda por hacer.
Para arrancar una sesión nueva, basta con decir:

> Lee `Documentation/arquitectura/punto-de-partida.md` y arrancamos con la fase 3.

Documentos de referencia, en este orden:
1. [`revision-arquitectura-2026-10-10.md`](revision-arquitectura-2026-10-10.md): los
   hallazgos (A1–A4, M1–M8, B1–B7) y la hoja de ruta.
2. [`guia-desarrolladores.md`](guia-desarrolladores.md): cómo funciona el sistema.
3. [`../base-de-datos/copias-de-seguridad.md`](../base-de-datos/copias-de-seguridad.md):
   copias, restauración y cómo se rellenó el proyecto de pruebas.

---

## 1. Dónde estamos

| Fase | Estado |
|---|---|
| Revisión de arquitectura + guía | ✅ Hecha y en el repo |
| **1. Red de seguridad:** linter, Vite 8, CI, `guardar()` | ✅ En producción (commit `7546e4f`, CI verde, Vercel OK) |
| **2a. Copias de seguridad** | ✅ `npm run respaldo` + tarea de Windows a las 03:00 |
| **2b. Proyecto de pruebas** | ✅ `inmersia-pruebas`, usado por `npm run dev` |
| **3. Reglas a la base de datos** | 🔄 **Casi:** 3.0, 3.1 y 3.4 ✅; 3.3 (075) y 3.2 (076) + código en pruebas, falta desplegar |
| 4. Ordenar el código (lector duplicado, React Query, capa de datos, App.jsx) | Pendiente |
| Continuo: colores a la paleta, botones accesibles, tipado JSDoc, tests de recorridos | Al tocar cada archivo |

## 2. Cómo se trabaja ahora

**Dos proyectos de Supabase:**

| | Producción | Pruebas (`inmersia-pruebas`) |
|---|---|---|
| Lo usan | La web, Vercel, `npm run build`, `npm run respaldo`, el SEO | `npm run dev` |
| Claves en | `.env.local`, `.env.esquema.local` | `.env.development.local` (lleva también `SUPABASE_DB_URL`) |
| Datos | Reales | Estructura y libros reales; **sin usuarios**; imágenes apuntando a producción |

- El **MCP de Supabase** de Claude está conectado a **producción**, en solo lectura.
  Para pruebas, `psql` con el `SUPABASE_DB_URL` de `.env.development.local`. En Windows,
  el SQL se pasa por stdin (`-f -`) y con `PGCLIENTENCODING=UTF8`; con `-c`, las tildes
  rompen.
- **Datos personales de producción:** nunca sin permiso explícito de Juan, caso por caso.

**Una migración nueva:**
1. Se escribe en `supabase/Migration/NNN_….sql`, con la cabecera PROBLEMA / SOLUCIÓN /
   QUÉ NO CAMBIA.
2. Se aplica **en pruebas** y se comprueba con `npm run dev`.
3. `npm run respaldo`.
4. Se aplica en producción (SQL Editor). Todavía no hay registro automático de qué
   migraciones están aplicadas: anotarlo en el commit.

**Reglas de la casa** (decisiones de Juan, no reabrir):
- Antes de un cambio estructural, explicar la lógica y esperar el visto bueno.
- Antes de editar, listar los archivos que se van a tocar, para que Juan pueda hacer copia.
- Commits: un hook local bloquea de lunes a viernes de 9 a 18 (hora de Berlín). Nunca
  `--no-verify`.
- La CI **avisa, no bloquea**. Pasar a ramas + PR cuando entre un socio.
- Tipado: **JSDoc + `// @ts-check`** archivo a archivo, **no TypeScript**.
- Textos de la app en tuteo, español de Venezuela; nunca voseo.

**Comandos:**

```bash
npm run dev        # contra PRUEBAS
npm run lint       # 0 errores y no más de 504 hex (bajar el tope al quitar hex)
npm test           # 86 tests
npm run respaldo   # copia de producción ahora mismo
npm run esquema    # foto de la estructura de producción en supabase/esquema/
```

---

## 3. Fase 3 — Reglas a la base de datos

**Objetivo:** que las reglas de negocio las imponga la base y no el navegador, y que las
escrituras que van juntas se hagan en una sola transacción. Cubre **A3** y **M5** de la
revisión. El modelo a imitar es Comunidades (migraciones 051–057): trigger o función en
la base, `HINT` en el error y el cliente traduciéndolo a un mensaje (`useComunidades.js`,
`mensajeError`).

### 3.0 Calentamiento: migración 072 — ✅ Hecha

`supabase/Migration/072_limpieza_avisos_supabase.sql`: search_path fijo, REVOKE a anon e
índices duplicados. Aplicada en pruebas y en producción el 10 oct (copia previa
`2026-10-10_1541`).

### 3.1 Perfil y Manual al registrarse → trigger en `auth.users` — ✅ Hecha

> **Hecho (10 oct):** migración `073_perfil_al_registrarse.sql`, en pruebas y producción.
> Trigger → `_crear_perfil` + `_asignar_manual`, cada una con su `EXCEPTION`: un fallo
> deja un WARNING y nunca tumba el registro. Rellenó las cuentas sin perfil o sin Manual
> (la de abril incluida). Falta ver el trigger en un registro real (las pruebas fueron con
> altas simuladas).

- **Hoy:** `src/lib/ensureProfile.js`, desde el navegador en cada `SIGNED_IN`, inserta en
  `perfiles` y mete el Manual (`MANUAL_LIBRO_ID`) en `bibliotecas_usuarios`.
- **Propuesta:** función `SECURITY DEFINER` (con `SET search_path`) y trigger
  `AFTER INSERT ON auth.users`, que haga lo mismo leyendo `raw_user_meta_data`: `nombre`,
  `apellido`, `fecha_nacimiento`, y para Google `given_name`/`family_name`/`full_name`.
  `ensureProfile` se queda como red de seguridad para cuentas antiguas.
- **Ojo:** las cuentas de Google llegan sin fecha de nacimiento (la pide
  `CompletarCuenta.jsx`). Hay una cuenta de abril de 2026 sin perfil, anterior a
  `ensureProfile`, que se repara sola si vuelve a entrar.

### 3.2 Adquirir un libro → función `adquirir_libro()`

> **Hecho en pruebas (10 oct):** `076_adquirir_libro.sql`. Devuelve true/false (nuevo / ya lo
> tenía), HINT `limite_pendientes`; sin política de INSERT; UPDATE solo de `leido` y
> `categoria_id`. El rescate de la muestra se queda en el navegador (si falla, el libro ya
> está y empieza desde el principio). Desplegar el código y correr la 076 seguidas.

> **Orden acordado:** después de 3.3, porque el rescate de la muestra escribe progreso.
> **Agujero encontrado (10 oct):** la política UPDATE de `bibliotecas_usuarios` deja
> cambiar `libro_id` de una fila propia (otra forma de saltarse el límite). La app solo
> actualiza `leido` y `categoria_id`: limitar el UPDATE a esas columnas aquí.

- **Hoy:** tres inserts directos en `bibliotecas_usuarios`: `useCompraLibro.js:43`,
  `App.jsx:356` (tras registrarse desde la muestra) y `ensureProfile.js:67` (Manual). El
  límite de **5 pendientes** (sin contar el Manual; los superusuarios no tienen límite)
  solo se comprueba en el cliente, en dos sitios: `useCompraLibro` y `App.jsx`. La
  política de INSERT solo mira `user_id`, así que la API deja saltárselo.
- **Propuesta:** `adquirir_libro(p_libro_id, …)` que compruebe el límite (`HINT
  'limite_pendientes'`), inserte y, si viene de la muestra, cree el progreso, **todo en
  una transacción**. `rescatarMuestra` (`App.jsx:94`) pasa a la base o a esa misma llamada.
  Después, quitar o acotar la política de INSERT directo, para que solo se pueda adquirir
  por la función. El Manual lo mete el trigger de 3.1.
- **Decisión ya tomada:** no hay política de DELETE en `bibliotecas_usuarios`; nadie
  quita libros de su biblioteca. No reabrir.

### 3.3 Un único significado del progreso (M5)

> **Decisión de Juan (10 oct):** dos datos, no uno. `porcentaje` = % por palabras (lo que
> ve el usuario); `capitulos_completados` = lo que desbloquea (Cartelera, Álbum,
> Investigación, «Anteriormente en…»). Migración `075_capitulos_completados.sql` + código,
> **en pruebas**. Producción: correr la 075 y desplegar justo después.

- **Problema:** `progreso_lectura.porcentaje` se escribe por capítulos
  (`useLectorData.persistChapterAdvance`), por palabras (`App.rescatarMuestra`) y al 100 %
  (Lector y LectorMobile), y se lee como capítulos para desbloquear la Cartelera
  (`capituloActualDesdePct` en `components/cartelera/carteleraHelpers.js`). Con capítulos
  de longitud desigual puede destapar spoilers.
- **Propuesta:** guardar lo que importa (un entero con los **capítulos completados**) y
  calcular el porcentaje solo para mostrarlo. Hace falta migrar los datos existentes.
- **Quién lee `porcentaje` hoy:** `useCartelera`, `useBiblioteca`, `useAlbum`,
  `lib/queries.js` (`useInvestigacionRecienteQuery`, `useRepasoQuery`),
  `CarteleraLanding` (y su versión móvil), `ComunidadPanel`, y la función SQL de
  progreso de comunidad (migración 051, ~línea 620).
- Encaja con una función `completar_capitulo()` que actualice progreso y `leido` a la vez.
  Hoy son dos escrituras sueltas, en tres sitios.

### 3.4 Decisiones de Juan — ✅ Tomadas (10 oct)

> 1. **Cartelera: se queda como está.** Son obras de dominio público; "final de El
>    Principito" está en Google. No reabrir.
> 2. **Edad:** la fecha de nacimiento se pone **una sola vez** y no cambia. La regla 16+
>    del chat se queda **solo en la app** (un menor llamando a la API no es un caso real).
> 3. **`perfiles_publicos`:** visible para todos, pero **solo el nombre, sin apellido**.
>
> 2 y 3 van en `074_fecha_fija_y_sin_apellido.sql`: aplicada y probada en pruebas,
> **pendiente de producción**.
>
> Texto original de las preguntas:

1. **Spoilers de la Cartelera:** `cartelera_items` es `USING (true)` para cualquier
   sesión; el filtro por capítulo solo está en el cliente. ¿Basta (es dominio público) o
   se protege con una función que devuelva solo lo desbloqueado?
2. **Edad:** la política `Perfil propio` (ALL) deja al usuario cambiar su
   `fecha_nacimiento` por la API después de registrarse, y la regla 16+ del chat solo está
   en la app. ¿Se bloquea el cambio de fecha y se lleva la regla a la base?
3. **`perfiles_publicos`** deja listar nombre y apellido de todos los usuarios. ¿Se acota
   a quien comparte comunidad o foro?

### 3.5 Cómo probarlo

En pruebas, con cuentas de prueba. ✅ **Hecho (10 oct):** Juan configuró en el panel de
`inmersia-pruebas`:
- Authentication → URL Configuration: *Site URL* `http://localhost:5173` y redirect
  `http://localhost:5173/**`;
- Authentication → Sign In / Providers → Email: **Confirm email** desactivado.

Después se registra en `npm run dev`, y Claude mete ese usuario en `superusuarios` de
pruebas.

---

## 4. Lo demás, cada cosa en su sesión

| Tema | Qué hay | Dónde mirar |
|---|---|---|
| **Storage al 91 %** (0,91 de 1 GB) | ~5–6 libros más y Supabase deja de aceptar subidas. Opciones: Pro (~25 $/mes, además trae copias automáticas), recomprimir imágenes (medir con la copia local de `storage/`), o moverlas a otro almacenamiento (p. ej. Cloudflare R2) | Panel de Supabase → Usage |
| **Sentry** | El código está listo, pero falta `VITE_SENTRY_DSN` en Vercel: hoy los errores no llegan a ningún sitio | `src/lib/errores.js` |
| **SEO** | `generar-seo.mjs` mete `<style>` en línea que la CSP bloquea (error de consola en producción desde el 29 sep): sacarlo a un `.css`. Además: LCP móvil de 6,8 s en la landing, paquete inicial de ~148 kB, Search Console | `scripts/generar-seo.mjs`, `vercel.json` |
| **Correo a potenciales clientes** | Zoho (`juanvalero@inmersia.io`) para el trato uno a uno; Resend probablemente para los correos de la app. Ojo con UWG §7 (correo comercial en frío en Alemania). Primero definir a quién se escribe | — |
| **Fase 4** | A4 (lector duplicado), M1 (React Query en todo), M2 (capa de datos en `src/data/`, un solo `mapLibro`), M3 (`App.jsx` más ligero, `useSesion`) | Revisión |
| **Restos** | Portada huérfana `El corsario negro/portada/portada.webp` (minúsculas) en Storage: se puede borrar. ~29 `console.error` en escrituras secundarias, a pasar a `guardar()` al tocarlas. Script para subir el espejo de Storage si algún día hay que restaurarlo | — |
