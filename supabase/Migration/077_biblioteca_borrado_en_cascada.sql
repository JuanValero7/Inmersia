-- =============================================================
-- INMERSIA — Migración 077
-- Borrar una cuenta se lleva también su biblioteca
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA
-- eliminar_mi_cuenta() (043) borra auth.users y confía en que el CASCADE
-- se lleve lo demás. Todas las tablas lo tienen menos una:
-- bibliotecas_usuarios.user_id es ON DELETE NO ACTION. Como todas las
-- cuentas tienen al menos el Manual, borrar CUALQUIER cuenta falla con
-- "violates foreign key constraint bibliotecas_usuarios_user_id_fkey".
-- Afecta a "Borrar cuenta" del Perfil (derecho de supresión, RGPD art. 17)
-- y a CompletarCuenta, que borra la cuenta de quien tiene menos de 14.
-- Lo destapó la prueba de humo (scripts/humo.mjs) el 10 oct 2026.
--
-- SOLUCIÓN
-- Rehacer la clave foránea con ON DELETE CASCADE, como las demás.
--
-- QUÉ NO CAMBIA
--   · Nadie puede borrar filas de su biblioteca (no hay política DELETE).
--   · eliminar_mi_cuenta() no se toca.
--
-- Después de correrla: npm run esquema y commit del volcado.
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

ALTER TABLE bibliotecas_usuarios DROP CONSTRAINT IF EXISTS bibliotecas_usuarios_user_id_fkey;
ALTER TABLE bibliotecas_usuarios
  ADD CONSTRAINT bibliotecas_usuarios_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
