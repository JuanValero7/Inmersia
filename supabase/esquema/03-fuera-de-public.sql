-- =============================================================
-- INMERSIA — Lo que vive fuera del esquema public
-- Volcado de producción del 2026-10-10 con `npm run esquema`.
-- NO SE EDITA A MANO: se regenera. Cómo restaurarlo:
-- Documentation/base-de-datos/respaldo-estructura.md
-- =============================================================

-- Va DESPUÉS de 02-esquema.sql: los triggers llaman a funciones de public.

-- ── Triggers sobre auth.* y storage.* ──
DROP TRIGGER IF EXISTS trg_perfil_al_registrarse ON auth.users;
CREATE TRIGGER trg_perfil_al_registrarse AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION _trg_perfil_al_registrarse();

-- ── Buckets de Storage (solo la configuración, no los archivos) ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('Biblioteca de Imagenes', 'Biblioteca de Imagenes', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('Biblioteca de Sonidos', 'Biblioteca de Sonidos', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- ── Políticas de Storage ──
-- (políticas de Storage: ninguno)

-- ── Tareas programadas (pg_cron) ──
SELECT cron.schedule('purgar-chat-90-dias', '17 4 * * *', 'SELECT public.purgar_chat_antiguo();');
SELECT cron.schedule('purgar-denuncias-6-meses', '27 4 * * *', 'SELECT public.purgar_denuncias_resueltas();');

-- ── Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensajes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sesiones;
