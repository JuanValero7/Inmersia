-- =============================================================
-- INMERSIA — Sistema de Superusuarios
-- Migración 019
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Tabla superusuarios
--    Solo el service_role puede añadir o quitar superusuarios.
--    Un usuario autenticado ÚNICAMENTE puede leer su propio
--    registro (para que el hook useSuperuser() funcione).
--    Sin políticas de INSERT/UPDATE/DELETE para 'authenticated':
--    ningún usuario puede escalarse a sí mismo.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS superusuarios (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE superusuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superusuarios_select_own" ON superusuarios;
CREATE POLICY "superusuarios_select_own"
  ON superusuarios FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Columna destacado en biblioteca_media
--    Permite al superusuario marcar un sonido/imagen como destacado.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE biblioteca_media
  ADD COLUMN IF NOT EXISTS destacado BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────
-- 3. Políticas RLS para acciones exclusivas del superusuario
-- ─────────────────────────────────────────────────────────────

-- Superusuario puede vincular media a párrafos (sugerir sonidos/imágenes)
DROP POLICY IF EXISTS "superusuario_ei_insert" ON elementos_interactivos;
CREATE POLICY "superusuario_ei_insert"
  ON elementos_interactivos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM superusuarios WHERE user_id = auth.uid())
  );

-- Superusuario puede eliminar vínculos media↔párrafo (quitar sonidos/imágenes)
DROP POLICY IF EXISTS "superusuario_ei_delete" ON elementos_interactivos;
CREATE POLICY "superusuario_ei_delete"
  ON elementos_interactivos FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM superusuarios WHERE user_id = auth.uid())
  );

-- Superusuario puede actualizar biblioteca_media (marcar como destacado)
DROP POLICY IF EXISTS "superusuario_media_update" ON biblioteca_media;
CREATE POLICY "superusuario_media_update"
  ON biblioteca_media FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM superusuarios WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM superusuarios WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 4. Para añadirte como superusuario ejecuta esto en el
--    SQL Editor del dashboard de Supabase (NO desde el cliente):
--
--    INSERT INTO superusuarios (user_id)
--    VALUES ((SELECT id FROM auth.users WHERE email = 'tu@email.com'));
--
--    Para revocar acceso:
--    DELETE FROM superusuarios
--    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tu@email.com');
-- ─────────────────────────────────────────────────────────────
