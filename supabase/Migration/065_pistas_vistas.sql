-- =============================================================
-- INMERSIA — Migración 065
-- Pistas de primera vez: cuáles vio ya cada usuario
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- El tour dejó de ser obligatorio. Las funciones se presentan con pistas
-- pequeñas la primera vez que el usuario se las encuentra (texto que suena,
-- primera ilustración, Investigación, Foro, Comunidades…). Cada pista sale una
-- sola vez por persona, también entre dispositivos: por eso vive acá y no en
-- localStorage (los invitados sí usan localStorage, y al registrarse se suma).
--
-- Va en preferencias_usuario, que ya tiene RLS por user_id (023) y que el
-- cliente escribe con upsert (ver pushBookId en App.jsx).
--
-- Sin esta migración la app no se rompe: las pistas se siguen mostrando, pero
-- al no poder guardarse reaparecen en la próxima sesión.
-- =============================================================

ALTER TABLE preferencias_usuario
  ADD COLUMN IF NOT EXISTS pistas_vistas text[] NOT NULL DEFAULT '{}';

-- Comprobación
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'preferencias_usuario' AND column_name = 'pistas_vistas';
