# Copias de seguridad

El plan gratis de Supabase **no hace copias**. Estas las hace `scripts/respaldar.mjs`
en el ordenador de Juan, cada noche.

## Qué se guarda y dónde

Todo en `Documentos\Inmersia_copias_seguridad\`, **solo en ese disco** (cifrado con
BitLocker). Nunca en el repo, que es público: hay datos personales.

| Qué | Dónde | Cuántas |
|---|---|---|
| Cuentas: usuarios, identidades (Google), MFA | `base-de-datos/<fecha>/cuentas.dump` | 14 últimas |
| Todo el esquema `public`: estructura y datos (libros, progreso, cuadernos, comunidades…) | `base-de-datos/<fecha>/inmersia.dump` | 14 últimas |
| Lo que vive fuera de `public`: extensiones, triggers sobre auth, buckets, políticas de Storage, pg_cron, Realtime | `base-de-datos/<fecha>/estructura/` | 14 últimas |
| Cifras para comprobar de un vistazo | `base-de-datos/<fecha>/resumen.txt` | 14 últimas |
| Archivos de Storage (imágenes y sonidos, ~1,1 GB) | `storage/<bucket>/…` | Espejo: solo baja lo nuevo, nunca borra |
| Una línea por ejecución | `respaldo.log` | — |

**Lo que no se guarda, a propósito:** sesiones abiertas, refresh tokens, tokens de un
solo uso y el registro de auditoría de auth. No sirven para restaurar, y tener tokens
válidos en un disco es un riesgo.

**Por qué 14:** si alguien borra su cuenta, sus datos desaparecen de las copias en dos
semanas. Guardarlas indefinidamente chocaría con el RGPD.

**Storage nunca borra:** si un archivo desaparece de Supabase, aquí se conserva. El
resumen de cada ejecución dice cuántos hay en esa situación.

## Cuándo se ejecuta

Tarea programada de Windows **«Inmersia - copia de seguridad»**: cada día a las 03:00.
Si a esa hora el portátil está apagado o dormido, se ejecuta al encenderlo. También con
batería. Tarda unos 20 segundos; más los días en que se subieron libros.

A mano, cuando quieras (por ejemplo, antes de aplicar una migración):

```bash
npm run respaldo
```

## Cómo saber que funciona

- **Si falla**, aparece en el escritorio **«Respaldo de Inmersia FALLÓ.txt»** con el
  motivo. Desaparece solo la siguiente vez que sale bien.
- `respaldo.log` tiene una línea `OK` o `FALLO` por ejecución.
- `resumen.txt` de cada copia trae el número de cuentas, libros, párrafos… Si un día
  baja de golpe, algo se borró en producción.

## Requisitos

- PostgreSQL 17 o más nuevo, solo el cliente (`pg_dump`, `pg_restore`, `psql`), en
  `C:\Program Files\PostgreSQL\17\bin`. Ya está instalado.
- `.env.esquema.local` con `SUPABASE_DB_URL` (el mismo de `npm run esquema`).
- `.env.local` con `VITE_SUPABASE_URL` (para descargar Storage).

## Tráfico de Supabase

Descargar de Storage cuenta para el límite mensual de salida del plan gratis. La primera
copia bajó todo (~1,1 GB) una vez; las siguientes solo lo nuevo, que es casi nada salvo
los días en que se sube un libro. Si Supabase responde «demasiadas peticiones» (HTTP
429), el script espera y reintenta.

## Cómo restaurar

> **Ensayado el 10 oct 2026** sobre el proyecto de pruebas (ver «Ensayo» abajo): la
> estructura y el contenido se restauran idénticos a producción. **Sin ensayar:** el paso 2
> (cuentas), para no copiar datos personales a pruebas, y el paso 5 (Storage).

Se restaura sobre un **proyecto de Supabase nuevo**, nunca encima de producción. En
`<URL>`, la cadena de conexión del proyecto nuevo (botón **Connect → Session pooler**).

El orden importa: los perfiles de `public` apuntan a `auth.users`, así que las cuentas
van antes que los datos de Inmersia.

```bash
C="Documentos/Inmersia_copias_seguridad/base-de-datos/<fecha>"

# 1. Extensiones
psql "<URL>" -f "$C/estructura/01-extensiones.sql"

# 2. Cuentas (las tablas de auth ya existen en un proyecto nuevo)
pg_restore -d "<URL>" --data-only "$C/cuentas.dump"

# 3. Inmersia: estructura y datos de public
pg_restore -d "<URL>" --no-owner "$C/inmersia.dump"

# 4. Lo de fuera de public: triggers, buckets, políticas de Storage, cron, Realtime
psql "<URL>" -f "$C/estructura/03-fuera-de-public.sql"
```

5. **Archivos de Storage:** subir `storage/<bucket>/` a los buckets del proyecto nuevo.
   Falta el script que lo hace; se escribe en la fase 2b. Los archivos marcados con
   ` (2)` existen por duplicado en Supabase con nombres que solo se distinguen por
   mayúsculas (ver más abajo).
6. Cambiar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel y en `.env.local`.

## Ensayo: cómo se rellenó el proyecto de pruebas

El proyecto `inmersia-pruebas` se rellenó restaurando una copia **sin datos de usuarios**.
Es a la vez el ensayo de restauración y la forma de refrescar pruebas cuando producción
cambie (un libro nuevo, una migración). Con `PG*` apuntando a **pruebas**:

```bash
C=".../base-de-datos/<fecha>"

# 1. Extensiones
psql -f "$C/estructura/01-extensiones.sql"

# 2. Lista de lo que hay en la copia, comentando (;) los datos de las tablas de
#    usuarios. Solo se restauran datos de las 11 tablas de contenido; las otras 24
#    quedan con su estructura y vacías.
CONTENIDO='libros|capitulos|parrafos|biblioteca_media|elementos_interactivos|libro_reels|cartelera_items|cartelera_principal|salas|sala_libros|foros'
pg_restore -l "$C/inmersia.dump" | awk -v c="^($CONTENIDO)$" \
  '/ TABLE DATA public /{ split($0,a," "); t=a[length(a)-1]; if (t !~ c) { print ";" $0; next } } {print}' > lista.txt

# 3. Estructura completa + datos de contenido
pg_restore -d postgres --no-owner -L lista.txt "$C/inmersia.dump"

# 4. Lo de fuera de public
psql -f "$C/estructura/03-fuera-de-public.sql"
```

**Resultado del 10 oct 2026** (copia `2026-10-10_1402`), en 36 segundos: 35 tablas, 93
políticas, 38 funciones, 14 triggers, 2 buckets, 2 tareas de cron y 2 tablas en Realtime,
igual que producción. Contenido idéntico (64 libros, 922 capítulos, 50.963 párrafos,
3.495 medios, 11.014 fichas). Tablas de usuarios a cero.

`pg_restore` acaba con **4 avisos esperables**, que no son fallos:
- `schema "public" already exists`: un proyecto nuevo ya lo trae.
- 3 × `permission denied to change default privileges` para `supabase_admin`: solo
  Supabase puede tocarlos, y el proyecto nuevo ya los trae con «Automatically expose new
  tables» marcado al crearlo.

**Trampa de Windows:** si una consulta con tildes se pasa a `psql` con `-c`, falla con
`invalid byte sequence for encoding "UTF8": 0xed`. Hay que pasarla por stdin (`-f -`) y con
`PGCLIENTENCODING=UTF8`.

## Nombres que solo difieren en mayúsculas

Windows no distingue «El Corsario Negro» de «El corsario negro», y Storage sí. Cuando
pasa, el script guarda el segundo con ` (2)` antes de la extensión. En la primera copia
(10 oct 2026) solo hubo un caso: `El Corsario Negro/portada/portada.webp` y
`El corsario negro/portada/portada.webp`, probablemente una carpeta huérfana de cuando
cambió el título del libro.

## Cambiar algo

- **Otra carpeta:** variable `RESPALDO_DIR`. Para la tarea programada, edítala en el
  Programador de tareas (Acción → argumentos).
- **Quitar la tarea:** Programador de tareas → «Inmersia - copia de seguridad» →
  Eliminar. O en PowerShell:
  `Unregister-ScheduledTask -TaskName 'Inmersia - copia de seguridad'`
- **Guardar más o menos copias:** `CONSERVAR` en `scripts/respaldar.mjs`.
