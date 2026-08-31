-- =============================================================
-- INMERSIA — Migración 041
-- Realtime Authorization para la sala de espera del Foro
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA (#16 de la revisión pre-lanzamiento)
-- `foro-sala:<foro_id>` es un canal de presencia PÚBLICO. Los canales
-- públicos de Realtime no pasan por ninguna RLS: basta la anon key —
-- que va en el bundle, es pública por diseño — para unirse a la sala
-- de cualquier libro y ver quién está dentro, sin ni siquiera tener
-- cuenta. Un script podría quedarse escuchando en silencio.
--
-- (Los otros dos canales del chat, `chat-invite:<user>` y
-- `chat-msgs:<sesion>`, NO tienen este problema: solo transportan
-- `postgres_changes`, que sí aplica la RLS de chat_sesiones y
-- chat_mensajes a cada suscriptor.)
--
-- SOLUCIÓN
-- Volver el canal privado (`config: { private: true }` en ForoChat.jsx)
-- y autorizarlo con RLS sobre `realtime.messages`. Un canal privado
-- exige un JWT de usuario válido, así que la anon key sola ya no entra.
--
-- La regla replica la del Foro, no una más estricta: el foro es
-- visible para cualquier usuario con sesión (`foros_select` está en
-- USING (true) desde la 002, y los spoilers se manejan con etiquetas,
-- ver 027). Lo que se exige es tener sesión y que el topic apunte a un
-- foro que existe de verdad — así el canal no sirve de sala de chat
-- gratis para cualquier nombre inventado.
--
-- OJO — ORDEN DE DESPLIEGUE
-- Esta migración va ANTES de subir el código. Un canal privado contra
-- un proyecto sin estas políticas no conecta, y la sala de espera se
-- queda sin abrir.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- Nota sobre `realtime.messages`
-- Es la tabla que Supabase usa para autorizar canales privados. Ya
-- viene con RLS activada en todo proyecto; aquí solo se le añaden
-- políticas. Estas políticas NO afectan a los canales públicos
-- (chat-invite, chat-msgs), que ni pasan por aquí.
--
-- `realtime.topic()` devuelve el nombre del canal al que se intenta
-- entrar. 'foro-sala:' son 10 caracteres, así que el id empieza en 11.
-- La comparación se hace en texto (`f.id::text`) a propósito: si el
-- topic trae basura donde debería ir un uuid, esto da `false` en vez
-- de reventar con un error de casteo.
-- ─────────────────────────────────────────────────────────────

-- SELECT = poder unirse al canal y recibir la presencia de los demás.
DROP POLICY IF EXISTS "foro_sala_leer" ON realtime.messages;

CREATE POLICY "foro_sala_leer"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'foro-sala:%'
    AND EXISTS (
      SELECT 1 FROM public.foros f
      WHERE f.id::text = substring(realtime.topic() FROM 11)
    )
  );

-- INSERT = poder anunciarse (el `track()` de la presencia).
DROP POLICY IF EXISTS "foro_sala_escribir" ON realtime.messages;

CREATE POLICY "foro_sala_escribir"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() LIKE 'foro-sala:%'
    AND EXISTS (
      SELECT 1 FROM public.foros f
      WHERE f.id::text = substring(realtime.topic() FROM 11)
    )
  );


-- =============================================================
-- LO QUE ESTO **NO** ARREGLA — leer antes de darlo por cerrado
--
-- El contenido del `track()` lo escribe el cliente, y ninguna RLS
-- puede validarlo: quien modifique el JS puede anunciarse en la sala
-- con el `user_id` de otra persona.
--
-- Lo que sí se hizo en ForoChat.jsx es dejar de fiarse del nombre:
-- antes viajaba dentro del payload (`track({ user_id, nombre })`), así
-- que cualquiera podía aparecer en la sala firmando como quien
-- quisiera. Ahora solo viaja el `user_id` y el nombre se resuelve
-- contra `perfiles_publicos`. Ya no se puede inventar una identidad;
-- como mucho se puede suplantar la de un usuario que existe.
--
-- Cerrar eso del todo pide cambiar la presencia por una tabla con RLS
-- (`WITH CHECK (user_id = auth.uid())`) y postgres_changes, que es
-- bastante más obra. Queda anotado, no hecho.
-- =============================================================

-- =============================================================
-- COMPROBACIÓN
--   -- Las dos políticas existen:
--   SELECT policyname FROM pg_policies
--   WHERE schemaname = 'realtime' AND tablename = 'messages';
--
--   -- Desde la app, con dos cuentas distintas:
--   -- · las dos entran a la sala y se ven la una a la otra
--   -- · el nombre que sale es el de perfiles_publicos
-- =============================================================
