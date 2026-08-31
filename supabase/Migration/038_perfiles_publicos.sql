-- =============================================================
-- INMERSIA — Migración 038
-- Vista `perfiles_publicos`: nombres visibles en Foro / reseñas / chat
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA
-- Las tres políticas de `perfiles` restringen a la fila propia
-- (auth.uid() = id). Correcto para la privacidad — pero la app necesita
-- leer el nombre de OTROS usuarios en cuatro sitios:
--   · Foro, autor de cada comentario   (ForoComentarios.jsx)
--   · Foro, historial de chats         (ForoChat.jsx)
--   · Foro, nombre del interlocutor    (foroUtils.fetchNombre)
--   · Tienda, autor de cada reseña     (PanelLibro.jsx)
-- Como esas consultas no devuelven nada, TODO el mundo aparecía
-- firmado como "Lector" salvo uno mismo.
--
-- SOLUCIÓN
-- Una vista con las TRES columnas que hacen falta para mostrar un
-- nombre. `perfiles` sigue cerrada a la fila propia, así que
-- fecha_nacimiento y onboarding_completado nunca salen de ahí.
--
-- security_invoker = false (a propósito): la vista corre con los
-- permisos de su dueño y por eso puede leer todas las filas de
-- `perfiles`. Es lo que la hace funcionar; el filtro de privacidad
-- son las columnas del SELECT, no la RLS. El linter de Supabase la
-- marcará como "SECURITY DEFINER view" — es esperado.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

CREATE OR REPLACE VIEW public.perfiles_publicos AS
  SELECT id, nombre, apellido
  FROM public.perfiles;

ALTER VIEW public.perfiles_publicos SET (security_invoker = false);

COMMENT ON VIEW public.perfiles_publicos IS
  'Nombre público de cada usuario para Foro, reseñas y chat. Solo id/nombre/apellido: el resto de perfiles sigue siendo privado (RLS por fila propia). Ver migración 038.';

-- Solo usuarios con sesión. Los invitados no necesitan nombres de nadie
-- (Foro y reseñas están detrás de autenticación) y así no se puede
-- enumerar la base de usuarios con la anon key.
REVOKE ALL ON public.perfiles_publicos FROM PUBLIC, anon;
GRANT SELECT ON public.perfiles_publicos TO authenticated;


-- =============================================================
-- COMPROBACIÓN
--   SELECT count(*) FROM perfiles;            -- 1 (solo tu fila)
--   SELECT count(*) FROM perfiles_publicos;   -- el total de usuarios
--   SELECT * FROM perfiles_publicos LIMIT 3;  -- id, nombre, apellido
-- =============================================================
