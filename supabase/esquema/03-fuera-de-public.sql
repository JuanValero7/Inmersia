-- =============================================================
-- INMERSIA — Lo que vive fuera del esquema public
-- Volcado de producción del 2026-11-14 con `npm run esquema`.
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
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('escritores', 'escritores', true, 10485760, '{image/webp,image/png,image/jpeg,audio/mpeg}'::text[]) ON CONFLICT (id) DO NOTHING;

-- ── Políticas de Storage ──
DROP POLICY IF EXISTS escritores_subir_propias ON storage.objects;
CREATE POLICY escritores_subir_propias
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'escritores'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM libros l
  WHERE (((l.id)::text = (storage.foldername(objects.name))[2]) AND (l.propietario_id = ( SELECT auth.uid() AS uid))))) AND (name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'::text)));

-- ── Tareas programadas (pg_cron) ──
SELECT cron.schedule('purgar-borradores-escritor', '37 4 * * *', 'SELECT public.purgar_borradores_escritor()');
SELECT cron.schedule('purgar-chat-90-dias', '17 4 * * *', 'SELECT public.purgar_chat_antiguo();');
SELECT cron.schedule('purgar-denuncias-6-meses', '27 4 * * *', 'SELECT public.purgar_denuncias_resueltas();');

-- ── Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensajes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sesiones;
