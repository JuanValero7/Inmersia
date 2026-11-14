-- =============================================================
-- INMERSIA — Migración 122
-- Rincón del escritor: el sonido automático baja a 0,05 $ por efecto
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere 119.
--
-- QUÉ HACE (Juan, 14 nov 2026)
--   · «sonido_nuevo» pasa de 0,15 a 0,05 $. La clave se queda con su
--     nombre (la usa pedir_trabajo para reservar), pero ahora se cobra por
--     CADA efecto colocado, no solo por los creados (el worker cuenta todos).
--   · El resto de precios, igual que en la 119.
-- Idempotente. Después: npm run esquema y commit del volcado.
-- =============================================================

CREATE OR REPLACE FUNCTION public.precios_escritor() RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $fn$
  SELECT '{"sonido_analisis": 5.00, "sonido_nuevo": 0.05, "sonido_max_efectos": 12,
           "portada": 0.00, "fondo": 1.00,
           "ilustracion": 0.50, "rehacer": 0.25, "ilustraciones_analisis": 5.00,
           "infografia": 0.50, "infografia_texto": 0.00, "cartelera": 5.00,
           "avance": 0.00, "avance_rehacer": 0.25,
           "juegos": [0, 3.00, 5.40, 7.80, 9.60, 12.00]}'::jsonb;
$fn$;
