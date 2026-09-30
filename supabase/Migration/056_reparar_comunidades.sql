-- =============================================================
-- INMERSIA — Migración 056
-- Reparación: comunidades creadas mientras la 051 estaba a medias
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ANTES: volver a ejecutar 051 y después 052 (ver ORDEN abajo).
--
-- QUÉ PASÓ (29 sep 2026)
-- La 051 quedó aplicada solo en parte: existían sus tablas y funciones,
-- pero NO sus triggers ni sus políticas. Consecuencias:
--   · Sin _comunidad_al_crear, la comunidad "Prueba 1" nació sin
--     moderador (0 miembros) y sin código de invitación.
--   · Sin políticas, la RLS denegaba todo en comunidades y
--     comunidad_miembros (403 al unirse).
-- La causa exacta no se pudo confirmar; la sospecha es que se ejecutó
-- con el botón "Run and enable RLS" del aviso del SQL Editor en vez de
-- correr el script tal cual.
--
-- ORDEN
--   1. 051_comunidades.sql       (idempotente: crea lo que falta)
--   2. 052_comunidad_subrayados.sql (la 051 reescribe el trigger de
--      denuncias con su versión vieja; la 052 lo deja en la buena)
--   3. Este archivo.
-- En los tres, si sale el aviso, elegir "Run without RLS": los propios
-- scripts ya activan la RLS tabla por tabla.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

-- ── 1. Cada comunidad sin miembros recupera a su creador como moderador.
INSERT INTO public.comunidad_miembros (comunidad_id, user_id, rol, unido_at)
SELECT c.id, c.creador_id, 'moderador', c.created_at
FROM public.comunidades c
WHERE c.creador_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.comunidad_miembros m WHERE m.comunidad_id = c.id);

-- ── 2. Cada comunidad sin código recibe uno generado.
INSERT INTO public.comunidad_codigos (comunidad_id)
SELECT c.id
FROM public.comunidades c
WHERE NOT EXISTS (SELECT 1 FROM public.comunidad_codigos k WHERE k.comunidad_id = c.id);


-- =============================================================
-- COMPROBACIÓN — deben salir TODAS estas filas:
--
-- SELECT 'trigger' AS tipo, tgname AS nombre, tgrelid::regclass::text AS tabla
-- FROM pg_trigger WHERE tgname LIKE 'trg_comunidad%' OR tgname LIKE 'trg_denuncia%'
-- UNION ALL
-- SELECT 'politica', policyname, tablename FROM pg_policies
-- WHERE tablename IN ('comunidades','comunidad_miembros','comunidad_codigos',
--   'comunidad_lecturas','comentarios_lectura','mensajitos','denuncias',
--   'creadores_comunidad','foros_comentarios')
-- ORDER BY 1, 3, 2;
--
-- Triggers (5): trg_comunidad_al_crear, trg_comunidad_cambio_libro,
--   trg_comunidad_tope_miembro, trg_comunidad_tras_baja,
--   trg_denuncia_copiar_contenido
-- Políticas: comunidades (4), comunidad_miembros (3), comunidad_codigos (1),
--   comunidad_lecturas (2), comentarios_lectura (3), mensajitos (4),
--   denuncias (3), creadores_comunidad (1), y en foros_comentarios
--   foros_comentarios_select/_insert/_delete, superusuario_comentarios_delete
--   y moderador_comentarios_delete.
-- =============================================================
