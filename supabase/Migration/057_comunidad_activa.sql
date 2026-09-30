-- =============================================================
-- INMERSIA — Migración 057
-- Comunidad activa ("Leer como") en preferencias_usuario
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- El selector de Comunidades de la Biblioteca elige con qué comunidad
-- lee el usuario: "Solo yo" (NULL) o una de las suyas. Se guarda aquí,
-- junto a gato_color y ultimos_libros, para que se mantenga entre
-- dispositivos y el lector pueda leerla más adelante.
--
-- Es solo un puntero: no da acceso a nada. Si el usuario deja de ser
-- miembro, el cliente lo trata como "Solo yo"; si la comunidad se
-- borra, el FK lo pone en NULL.
--
-- Las políticas de preferencias_usuario (023) ya cubren la columna.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

ALTER TABLE public.preferencias_usuario
  ADD COLUMN IF NOT EXISTS comunidad_activa uuid
    REFERENCES public.comunidades(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.preferencias_usuario.comunidad_activa IS
  'Comunidad con la que lee el usuario ("Leer como"). NULL = solo yo. Ver migración 057.';
