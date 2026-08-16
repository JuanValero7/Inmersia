-- =============================================================
-- INMERSIA — Onboarding (tutorial guiado para usuarios nuevos)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Agrega el flag `onboarding_completado` a `perfiles`. Es la ÚNICA fuente de
-- verdad del tutorial: vive en la DB (no en cache/cookies), atado al usuario,
-- así borrar cache u otro dispositivo nunca re-dispara el tutorial.
--
-- Regla: el tutorial corre en una sola sesión y se marca completado al INICIO
-- (ver src/context/onboarding.jsx), de modo que abandonar a mitad = completado.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

-- 1) Columna del flag. DEFAULT false → los NUEVOS registros (ensureProfile no la
--    setea) arrancan sin completar y ven el tutorial.
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS onboarding_completado boolean NOT NULL DEFAULT false;

-- 2) Backfill: los usuarios que YA existían al correr esta migración NO deben
--    ver el tutorial (no son nuevos). Se marcan como completado.
--    Solo afecta filas existentes; los registros futuros siguen con default false.
UPDATE perfiles SET onboarding_completado = true;

-- 3) Política de UPDATE: el cliente marca su propio flag como completado al
--    iniciar el tutorial. Un usuario solo puede tocar su propia fila.
DROP POLICY IF EXISTS "perfiles_update_propio" ON perfiles;
CREATE POLICY "perfiles_update_propio"
  ON perfiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
