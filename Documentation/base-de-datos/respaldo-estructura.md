# Respaldo de la estructura de la base de datos

Si a la base de datos de Supabase le pasa algo, la estructura tiene que poder levantarse otra vez sin depender de memoria ni de migraciones sueltas. Esa estructura son las tablas, las columnas, las funciones, los triggers, las políticas RLS y los permisos. El contenido (libros, imágenes) se vuelve a cargar con los procesos de siempre.

Las migraciones de `supabase/Migration/` no sirven para esto:
- hay cosas que se aplicaron a mano en el dashboard, como la muestra para invitados y las tablas `perfiles`, `bibliotecas_usuarios` y `categorias_usuario`;
- hay migraciones que nunca se corrieron enteras: `cartelera_items.nombre_canonico` no existe en producción;
- hay políticas que se cambiaron varias veces.

Por eso el respaldo es un **volcado de producción**: lo que hay de verdad, no lo que dicen los archivos.

---

## 1. Preparación (una sola vez)

1. **Instala las herramientas de PostgreSQL.** En PowerShell:
   ```
   winget install PostgreSQL.PostgreSQL.17 --override "--mode unattended --disable-components server,pgAdmin,stackbuilder"
   ```
   - Hay que correrlo como administrador.
   - El `--override` deja solo las herramientas de línea de comandos. Sin él, se instala también un servidor PostgreSQL que se queda corriendo en tu PC sin hacer falta.
   - Quedan en `C:\Program Files\PostgreSQL\17\bin`, donde `npm run esquema` ya las busca.
   - Trae `pg_dump` y `psql`. No hace falta Docker.
   - La versión debe ser igual o más nueva que la del proyecto. Para verla, corre `select version();` en el SQL Editor (o mira **Settings → Infrastructure → Service versions**, al final de la página). El 2 de octubre de 2026 era la 17.6: basta con que coincida el número grande (17). Si algún día Supabase pasa el proyecto a la 18, instala la 18.
2. **Crea el archivo de conexión.** Copia `.env.esquema.local.ejemplo` a `.env.esquema.local`, en la raíz del repo.
3. **Pega la cadena de conexión** en `SUPABASE_DB_URL`.
   - Sale de Supabase → botón **Connect**, arriba → **Session pooler**.
   - Cambia `[YOUR-PASSWORD]` por la contraseña de la base de datos, que no es la de tu cuenta. Si no la recuerdas: **Settings → Database → Reset database password**.
   - `.env.esquema.local` está cubierto por `.gitignore`, así que no se sube nunca.

## 2. Volcar

```
npm run esquema
```

Escribe tres archivos en `supabase/esquema/`:

| Archivo | Qué tiene |
|---|---|
| `01-extensiones.sql` | Las extensiones instaladas (`pg_cron`, …) |
| `02-esquema.sql` | Todo el esquema `public`: tablas, columnas, índices, claves, funciones, triggers, vistas, RLS, políticas y permisos (`GRANT`) de `anon` y `authenticated` |
| `03-fuera-de-public.sql` | Lo que no está en `public`: triggers sobre `auth.users`, buckets y políticas de Storage, tareas de `pg_cron` y tablas de Realtime |

Al terminar muestra cuántas tablas, funciones, triggers, vistas y políticas encontró. Después:

```
git diff --stat supabase/esquema
git add supabase/esquema
git commit -m "Esquema: volcado AAAA-MM-DD"
```

El diff de git enseña exactamente qué cambió en producción desde el volcado anterior. Si aparece algo que no esperabas, eso ya es información: alguien tocó la base a mano.

**Cuándo volcar:**
- después de correr cualquier migración en el SQL Editor;
- antes de un cambio grande (como la muestra de 10 minutos);
- y, si no ha pasado ninguna de las dos cosas, una vez al mes.

Todo es de **solo lectura**: el comando no cambia nada en la base.

## 3. Restaurar en un proyecto nuevo

Sirve igual para un desastre que para una prueba.

1. **Crea un proyecto nuevo en Supabase**, en la misma región si es posible.
2. **Copia su cadena de conexión** (Connect → Session pooler). Quítale la contraseña: `psql` te la pedirá y así no queda en el historial.
3. **Ejecuta los tres archivos en orden**, desde la raíz del repo:
   ```
   psql "postgresql://postgres.NUEVA-REF@aws-0-REGION.pooler.supabase.com:5432/postgres" -f supabase/esquema/01-extensiones.sql
   psql "…la misma…" -f supabase/esquema/02-esquema.sql
   psql "…la misma…" -f supabase/esquema/03-fuera-de-public.sql
   ```
   - Hazlo con `psql`, no con el SQL Editor del dashboard: `02-esquema.sql` lleva líneas `\restrict` que solo entiende `psql`.
   - Algunos errores «already exists» son normales: un proyecto nuevo ya trae el esquema `public` y algunas extensiones. `psql` sigue con la siguiente sentencia.
4. **Rehaz a mano la configuración de la sección 4.**
5. **Carga el contenido:**
   - los libros, con el proceso de carga de siempre;
   - las filas que no son libros pero la app necesita: `superusuarios` (tu usuario), `salas` y `sala_libros`, y el orden del catálogo (`libros.orden`).
6. **Apunta la app al proyecto nuevo:** `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env.local` y en el hosting. En un proyecto nuevo, la URL y las claves cambian.

> **Haz la prueba completa una vez**, con un proyecto gratis de prueba. Un respaldo que nunca se restauró no está probado.

## 4. Lo que ningún volcado guarda

Esta configuración vive en el dashboard, no en la base de datos. Apunta aquí los valores actuales y actualízalos cuando cambien.

| Dónde | Qué | Valor actual |
|---|---|---|
| Authentication → URL Configuration | Site URL | `https://inmersia.io` |
| Authentication → URL Configuration | Redirect URLs | (anótalas; la de `http://localhost:5173/**` todavía falta) |
| Authentication → Sign In / Providers | Google: Client ID y Client Secret (vienen de Google Cloud Console) | (no pongas el secreto aquí; anota dónde está guardado) |
| Authentication → Emails | Plantillas de los correos y SMTP propio, si lo hay | |
| Authentication → Sign In / Providers | Confirmación de correo, registro abierto | |
| Storage | Los **archivos** de los buckets (portadas, ilustraciones, sonidos) | Se recargan con `upload.py` |
| Project Settings → API | URL y claves (`anon`, `service_role`) | Cambian en un proyecto nuevo |

## 5. Relación con las migraciones

- **`supabase/esquema/` manda.** Es lo que hay en producción.
- **`supabase/Migration/` queda como historial:** cuenta por qué se hizo cada cambio.
- **Los cambios nuevos se siguen haciendo igual:** una migración numerada (la siguiente libre es la 071) que corres en el SQL Editor. Después, `npm run esquema` y commit, en ese orden.
- **Archivos que este volcado reemplaza:** `supabase/Migration/000_politicas_actuales.sql` y `supabase/exportar-politicas.sql` tienen el mismo propósito, pero solo para las políticas y con copiar y pegar a mano. Cuando el primer volcado esté en git, se pueden archivar.
