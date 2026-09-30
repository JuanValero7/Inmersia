-- =============================================================
-- INMERSIA — Migración 059
-- Retención de las denuncias: 6 meses una vez resueltas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- Una denuncia (051) guarda una COPIA del texto denunciado
-- (contenido_denunciado), para poder revisarla aunque el autor lo borre
-- o se trate de un mensajito que "se borra cuando lo lea". Esa copia es
-- un dato personal de otra persona y hasta ahora no tenía plazo.
--
-- Regla (Política de Privacidad, sección 4):
--   · Pendiente  → se conserva hasta que se resuelva.
--   · Revisada o descartada → se borra a los 6 meses de la denuncia.
-- Seis meses dan margen para ver si alguien reincide.
--
-- Usa el mismo pg_cron que la purga del chat (043), con su propio job.
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

CREATE OR REPLACE FUNCTION public.purgar_denuncias_resueltas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  borradas integer;
BEGIN
  DELETE FROM public.denuncias
   WHERE estado <> 'pendiente'
     AND created_at < now() - interval '6 months';
  GET DIAGNOSTICS borradas = ROW_COUNT;
  RETURN borradas;
END;
$fn$;

-- Nadie la llama desde el cliente: la dispara el cron.
REVOKE ALL ON FUNCTION public.purgar_denuncias_resueltas() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.purgar_denuncias_resueltas() IS
  'Borra las denuncias revisadas o descartadas de más de 6 meses. Retención declarada en la Política de Privacidad, sección 4.';


-- ─────────────────────────────────────────────────────────────
-- Programación diaria (pg_cron)
-- Si la extensión no está disponible el bloque no rompe la migración:
-- avisa y deja la función lista para llamarla a mano.
-- ─────────────────────────────────────────────────────────────
DO $do$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purgar-denuncias-6-meses') THEN
    PERFORM cron.unschedule('purgar-denuncias-6-meses');
  END IF;

  PERFORM cron.schedule(
    'purgar-denuncias-6-meses',
    '27 4 * * *',                       -- todos los días a las 04:27 UTC
    'SELECT public.purgar_denuncias_resueltas();'
  );

  RAISE NOTICE 'Purga de denuncias programada: purgar-denuncias-6-meses, diaria 04:27 UTC.';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo programar la purga con pg_cron (%). Actívala en Dashboard → Database → Extensions → pg_cron y vuelve a correr esta migración, o llama a SELECT public.purgar_denuncias_resueltas(); a mano.', SQLERRM;
END
$do$;


-- =============================================================
-- COMPROBACIÓN
--   SELECT jobname, schedule FROM cron.job;   -- 2 filas: chat y denuncias
-- =============================================================
