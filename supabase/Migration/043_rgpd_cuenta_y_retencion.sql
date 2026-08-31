-- =============================================================
-- INMERSIA — Migración 043
-- Cumplimiento RGPD: borrado de cuenta, retención del chat y
-- `genero` en `perfiles`
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO (revisión legal del 31 ago 2026)
-- Los dos documentos legales prometían tres cosas que la base de
-- datos no podía cumplir:
--   · «puedes eliminar tu cuenta»           → no había forma de borrar
--     de `auth.users` desde la app (la RLS no alcanza a ese esquema);
--   · «los mensajes de chat se conservan un máximo de 90 días»
--                                           → no existía ninguna purga;
--   · el género se pedía «para análisis y recomendaciones» pero vivía
--     solo en `auth.users.raw_user_meta_data`, donde no se puede
--     cruzar con nada en SQL.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. `perfiles.genero` — que el dato sea consultable
-- ═════════════════════════════════════════════════════════════
-- La fecha de nacimiento ya se copiaba al perfil (ensureProfile.js);
-- el género no. Con la columna acá, los dos datos declarados en la
-- Política de Privacidad viven en una tabla con RLS y se pueden
-- cruzar con lecturas, biblioteca y reseñas.

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS genero text;

-- Backfill desde el metadata de Auth para los usuarios que ya existen.
UPDATE public.perfiles p
   SET genero = u.raw_user_meta_data->>'genero'
  FROM auth.users u
 WHERE u.id = p.id
   AND p.genero IS NULL
   AND u.raw_user_meta_data->>'genero' IS NOT NULL;

-- Lo mismo con la fecha de nacimiento: ensureProfile solo la escribe al
-- CREAR el perfil, así que las cuentas anteriores a ese cambio la tienen
-- en el metadata pero no en la tabla.
UPDATE public.perfiles p
   SET fecha_nacimiento = (u.raw_user_meta_data->>'fecha_nacimiento')::date
  FROM auth.users u
 WHERE u.id = p.id
   AND p.fecha_nacimiento IS NULL
   AND u.raw_user_meta_data->>'fecha_nacimiento' IS NOT NULL;

-- NOT VALID: obliga a los valores del <select> del registro de aquí en
-- adelante sin bloquear la migración por una fila vieja rara.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'perfiles_genero_valido'
  ) THEN
    ALTER TABLE public.perfiles
      ADD CONSTRAINT perfiles_genero_valido
      CHECK (genero IS NULL OR genero IN ('masculino', 'femenino', 'diverso'))
      NOT VALID;
  END IF;
END
$do$;

COMMENT ON COLUMN public.perfiles.genero IS
  'Género declarado en el registro. Base legal: interés legítimo (art. 6.1.f), análisis y recomendaciones. Ver Política de Privacidad, secciones 2 y 3.';


-- ═════════════════════════════════════════════════════════════
-- 2. Borrado de cuenta por el propio usuario
-- ═════════════════════════════════════════════════════════════
-- POR QUÉ UNA FUNCIÓN Y NO UNA EDGE FUNCTION
-- Borrar la fila de `auth.users` es lo único que hace falta: TODAS las
-- tablas de la app la referencian con ON DELETE CASCADE (comprobado
-- tabla por tabla), así que una sola sentencia se lleva perfil,
-- biblioteca, progreso, notas, subrayados, reseñas, comentarios,
-- chats, álbum, predicciones y preferencias.
--
-- Pero `auth.users` está fuera del alcance de la RLS del cliente. La
-- alternativa habitual es una Edge Function con la `service_role`, que
-- obliga a desplegar código aparte y a custodiar esa llave. Una función
-- SECURITY DEFINER hace lo mismo sin ninguna de las dos cosas: corre
-- con los permisos de su dueño y solo puede borrar la fila de quien la
-- llama, porque el `uid` no es un parámetro — sale de auth.uid(). No
-- hay forma de pedirle que borre a otro.

CREATE OR REPLACE FUNCTION public.eliminar_mi_cuenta()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa: eliminar_mi_cuenta() solo se puede llamar desde la app, autenticado.';
  END IF;

  -- El CASCADE de auth.users se lleva todo lo demás.
  DELETE FROM auth.users WHERE id = uid;
END;
$fn$;

-- Solo un usuario con sesión. Ni `anon` ni PUBLIC.
REVOKE ALL ON FUNCTION public.eliminar_mi_cuenta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_mi_cuenta() TO authenticated;

COMMENT ON FUNCTION public.eliminar_mi_cuenta() IS
  'Borra la cuenta de quien la llama (auth.uid()) y, por CASCADE, todos sus datos. Derecho de supresión, art. 17 RGPD. La usa el botón de Perfil → Legal.';


-- ═════════════════════════════════════════════════════════════
-- 3. Retención del chat: 90 días
-- ═════════════════════════════════════════════════════════════
-- La Política de Privacidad promete un máximo de 90 días. Hasta ahora
-- los mensajes se quedaban para siempre pese a que el esquema llama al
-- chat «efímero».

CREATE OR REPLACE FUNCTION public.purgar_chat_antiguo()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  borrados integer;
BEGIN
  DELETE FROM public.chat_mensajes
   WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS borrados = ROW_COUNT;

  -- Sesiones vacías y viejas: sin mensajes ya no representan nada.
  -- (Una sesión activa nunca llega a 90 días: se borra al cerrar el chat.)
  DELETE FROM public.chat_sesiones s
   WHERE s.created_at < now() - interval '90 days'
     AND NOT EXISTS (
       SELECT 1 FROM public.chat_mensajes m WHERE m.sesion_id = s.id
     );

  -- El historial de «con quién hablaste» es igual de personal.
  DELETE FROM public.chat_historial
   WHERE created_at < now() - interval '90 days';

  RETURN borrados;
END;
$fn$;

-- Nadie la llama desde el cliente: la dispara el cron.
REVOKE ALL ON FUNCTION public.purgar_chat_antiguo() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.purgar_chat_antiguo() IS
  'Borra mensajes, sesiones vacías e historial de chat de más de 90 días. Retención declarada en la Política de Privacidad, sección 4.';


-- ─────────────────────────────────────────────────────────────
-- Programación diaria (pg_cron)
-- Si la extensión no está disponible el bloque no rompe la migración:
-- avisa y deja la función lista para llamarla a mano.
-- ─────────────────────────────────────────────────────────────
DO $do$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Quita el job anterior si esta migración ya corrió una vez.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purgar-chat-90-dias') THEN
    PERFORM cron.unschedule('purgar-chat-90-dias');
  END IF;

  PERFORM cron.schedule(
    'purgar-chat-90-dias',
    '17 4 * * *',                       -- todos los días a las 04:17 UTC
    'SELECT public.purgar_chat_antiguo();'
  );

  RAISE NOTICE 'Purga de chat programada: purgar-chat-90-dias, diaria 04:17 UTC.';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo programar la purga con pg_cron (%). Actívala en Dashboard → Database → Extensions → pg_cron y vuelve a correr esta migración, o llama a SELECT public.purgar_chat_antiguo(); a mano.', SQLERRM;
END
$do$;

-- Primera pasada inmediata: limpia lo que ya lleva más de 90 días.
SELECT public.purgar_chat_antiguo() AS mensajes_borrados;


-- =============================================================
-- COMPROBACIÓN
--   SELECT genero, count(*) FROM perfiles GROUP BY genero;
--   SELECT jobname, schedule FROM cron.job;              -- 1 fila
--   SELECT max(now() - created_at) FROM chat_mensajes;   -- < 90 días
--   -- El borrado de cuenta hay que probarlo DESDE LA APP: en el SQL
--   -- Editor auth.uid() es NULL y la función levanta la excepción.
-- =============================================================
