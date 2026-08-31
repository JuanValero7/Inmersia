-- =============================================================
-- INMERSIA — Migración 042
-- `chat_historial`: una fila por pareja, no una por conversación
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA (#23 de la revisión pre-lanzamiento)
-- La tabla inserta una fila cada vez que dos personas abren un chat,
-- sin restricción única. Crece sin techo: cien conversaciones con el
-- mismo lector son cien filas.
--
-- Y no es solo desperdicio. La app pide las últimas 25 filas y las
-- deduplica en el cliente para quedarse con 5 personas distintas
-- (ForoChat.loadHistorial). Si hablas 25 veces seguidas con la misma
-- persona, esas 25 filas llenan la ventana y **el resto del historial
-- desaparece de la pantalla**: se ve un solo nombre donde deberían
-- verse cinco.
--
-- SOLUCIÓN
-- Índice único por (user_id, foro_id, partner_id) y `upsert` desde la
-- app, que reescribe `created_at` en vez de añadir una fila. Así el
-- historial es exactamente lo que la pantalla quiere mostrar: las
-- últimas personas, una vez cada una, por orden de recencia. El
-- cliente ya no deduplica nada.
--
-- OJO — hace falta política de UPDATE. La tabla solo tenía SELECT e
-- INSERT (migración 014), y un upsert que choca con el índice único
-- necesita UPDATE o la RLS lo rechaza.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. LIMPIAR LOS DUPLICADOS QUE YA HAY
--    Se queda la fila más reciente de cada trío. El desempate por
--    `id` es para el caso de dos filas con el mismo `created_at`:
--    sin él, la comparación es falsa en ambos sentidos y sobreviven
--    las dos, y entonces el índice único de abajo falla.
-- ─────────────────────────────────────────────────────────────
DELETE FROM public.chat_historial a
USING public.chat_historial b
WHERE a.user_id    = b.user_id
  AND a.foro_id    = b.foro_id
  AND a.partner_id = b.partner_id
  AND (a.created_at < b.created_at
       OR (a.created_at = b.created_at AND a.id < b.id));


-- ─────────────────────────────────────────────────────────────
-- 2. LA RESTRICCIÓN
--    Índice único y no CONSTRAINT: `ON CONFLICT` (que es lo que usa
--    el upsert de PostgREST) funciona igual con los dos, y el índice
--    es idempotente con IF NOT EXISTS.
--    Sustituye de paso al índice de la 014, que lideraba con las
--    mismas dos columnas.
-- ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS chat_historial_user_foro_partner
  ON public.chat_historial (user_id, foro_id, partner_id);


-- ─────────────────────────────────────────────────────────────
-- 3. POLÍTICA DE UPDATE
--    Sin esto el upsert falla en cuanto la pareja ya existe.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chat_historial_update" ON public.chat_historial;

CREATE POLICY "chat_historial_update"
  ON public.chat_historial FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));


-- =============================================================
-- COMPROBACIÓN
--   -- No queda ningún duplicado:
--   SELECT user_id, foro_id, partner_id, count(*)
--   FROM chat_historial
--   GROUP BY 1,2,3 HAVING count(*) > 1;     -- 0 filas
--
--   -- Desde la app: chatear dos veces con la misma persona y ver que
--   -- el historial sigue teniendo una sola entrada suya, arriba del
--   -- todo.
-- =============================================================
