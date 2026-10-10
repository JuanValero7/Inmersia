-- =============================================================
-- INMERSIA — Migración 072
-- Limpieza de avisos del linter de Supabase (revisión del 4 oct)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA
-- El linter de Supabase (Advisors) marca tres cosas que se pueden
-- arreglar sin tocar el código de la app:
--   · 9 funciones sin search_path fijo: resuelven los nombres de tabla
--     según el search_path de quien las llama.
--   · 2 funciones SECURITY DEFINER ejecutables por `anon`. Ninguna es un
--     agujero (delete_parrafo_superuser comprueba superusuario por dentro;
--     _crear_foro_para_libro es de trigger y no se puede llamar por RPC),
--     pero un invitado no tiene por qué poder llamarlas. La 020 ya hacía
--     REVOKE FROM PUBLIC; el GRANT a anon lo ponen los privilegios por
--     defecto de Supabase, así que hay que quitarlo con nombre.
--   · 9 grupos de índices duplicados (mismas columnas, mismo orden).
--     Cada escritura los actualiza todos sin que ninguno sume nada.
--
-- SOLUCIÓN
--   1. SET search_path = public en las 9 funciones.
--   2. REVOKE EXECUTE ... FROM anon en las 2 funciones.
--   3. De cada grupo duplicado se queda el más usado (pg_stat_user_indexes
--      del 4 oct) y se borran los demás.
--
-- QUÉ NO CAMBIA
--   · El código: los upsert usan onConflict por columnas
--     ('user_id,libro_id'), nunca por nombre de índice, y en
--     bibliotecas_usuarios queda una UNIQUE (user_id, libro_id).
--   · Los triggers: Postgres no comprueba EXECUTE al dispararlos.
--   · El borrado de párrafos del superusuario: él siempre tiene sesión.
--
-- FUERA DE ESTA MIGRACIÓN (a propósito)
--   · perfiles_publicos (vista SECURITY DEFINER): cualquier usuario con
--     sesión puede listar nombre y apellido de todos. Pendiente de decidir
--     si se acota a quien comparte comunidad/foro.
--   · Protección de contraseñas filtradas: es un interruptor del
--     Dashboard (Authentication → Sign In / Providers → Email).
--   · Políticas RLS con auth.uid() por fila, índices sin usar y FKs sin
--     índice: no pesan con el volumen actual; revisar tras el lanzamiento.
--
-- Después de correrla: npm run esquema y commit del volcado.
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

-- ── 1. search_path fijo ──────────────────────────────────────
ALTER FUNCTION contar_palabras(text)              SET search_path = public;
ALTER FUNCTION trg_palabras_insert()              SET search_path = public;
ALTER FUNCTION trg_palabras_update()              SET search_path = public;
ALTER FUNCTION trg_palabras_delete()              SET search_path = public;
ALTER FUNCTION trg_muestra_insert()               SET search_path = public;
ALTER FUNCTION trg_muestra_update()               SET search_path = public;
ALTER FUNCTION trg_muestra_delete()               SET search_path = public;
ALTER FUNCTION _crear_foro_para_libro()           SET search_path = public;
ALTER FUNCTION _check_usuario_sin_sesion_activa() SET search_path = public;


-- ── 2. SECURITY DEFINER fuera del alcance de invitados ───────
REVOKE EXECUTE ON FUNCTION delete_parrafo_superuser(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION delete_parrafo_superuser(uuid) TO authenticated;

-- De trigger: nadie la llama directamente.
REVOKE EXECUTE ON FUNCTION _crear_foro_para_libro() FROM PUBLIC, anon, authenticated;


-- ── 3. Índices duplicados ────────────────────────────────────
-- bibliotecas_usuarios: dos UNIQUE (user_id, libro_id). Queda
-- bibliotecas_usuarios_user_libro_unique (3681 usos vs 134).
ALTER TABLE bibliotecas_usuarios DROP CONSTRAINT IF EXISTS bibliotecas_usuarios_user_id_libro_id_key;

-- bibliotecas_usuarios (user_id): queda idx_bibliotecas_usuarios_user.
DROP INDEX IF EXISTS idx_bibliotecas_user;

-- cartelera_items (libro_id, capitulo_numero): queda idx_cartelera_items_libro_cap.
DROP INDEX IF EXISTS idx_cartelera_libro_capitulo;

-- chat_historial (user_id, foro_id, created_at DESC): queda
-- chat_historial_user_id_foro_id_created_at_idx (los otros dos, 0 usos).
DROP INDEX IF EXISTS idx_chat_historial_user_foro;
DROP INDEX IF EXISTS idx_chat_historial_user_foro_fecha;

-- chat_mensajes (sesion_id, created_at): queda idx_chat_mensajes_sesion.
DROP INDEX IF EXISTS chat_mensajes_sesion_id_created_at_idx;

-- elementos_interactivos (parrafo_id): queda idx_elementos_interactivos_parrafo.
DROP INDEX IF EXISTS idx_interactivos_parrafo;

-- foros_comentarios: ninguno se ha usado aún; quedan los de nombre más claro.
DROP INDEX IF EXISTS idx_foro_comentarios_foro_parent;   -- queda idx_foros_comentarios_foro_parent_fecha
DROP INDEX IF EXISTS idx_foro_comentarios_parent;        -- queda foros_comentarios_parent_id_idx

-- progreso_lectura (user_id, libro_id): queda idx_progreso_lectura_user_libro.
DROP INDEX IF EXISTS idx_progreso_user_libro;
