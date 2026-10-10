-- =============================================================
-- INMERSIA — Extensiones
-- Volcado de producción del 2026-10-10 con `npm run esquema`.
-- NO SE EDITA A MANO: se regenera. Cómo restaurarlo:
-- Documentation/base-de-datos/respaldo-estructura.md
-- =============================================================

-- Un proyecto nuevo de Supabase ya trae varias: las que existan se saltan.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
