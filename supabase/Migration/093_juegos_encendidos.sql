-- =============================================================
-- INMERSIA — Migración 093
-- Encender y apagar los juegos de lectura
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ HAY (decisiones de Juan, 8 nov 2026)
--   Los 5 juegos: mesa de investigación (Anderson), corazonadas, concurso,
--   mapa del tesoro y desafío del gato.
--   · Fuera del aula manda el usuario: lo elige en su Perfil. Por defecto,
--     mesa, corazonadas y mapa encendidos; concurso y desafío apagados.
--     Se guarda en preferencias_usuario.juegos (solo lo que tocó).
--   · En un aula que lee ese libro manda el profe: comunidades.juegos. Si
--     no eligió nada, los 5 encendidos (es lo que compra el colegio). La
--     pantalla del profe para cambiarlo llega con su vista del Salón.
--   Apagar un juego solo lo esconde: lo jugado no se borra.
--
-- QUIÉN LLAMA A QUÉ (el navegador)
--   · juegos_libro(libro) → qué juegos salen en ese libro y quién lo decide.
--   · mis_juegos()        → lo del Perfil: lo elegido y si está en algún aula.
--   · juegos_guardar(juego, encendido) → el interruptor del Perfil.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Columnas
-- ═════════════════════════════════════════════════════════════

ALTER TABLE public.preferencias_usuario
  ADD COLUMN IF NOT EXISTS juegos jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.preferencias_usuario DROP CONSTRAINT IF EXISTS preferencias_usuario_juegos_objeto;
ALTER TABLE public.preferencias_usuario
  ADD CONSTRAINT preferencias_usuario_juegos_objeto CHECK (jsonb_typeof(juegos) = 'object');

COMMENT ON COLUMN public.preferencias_usuario.juegos IS
  'Juegos de lectura que el usuario encendió o apagó en su Perfil ({mesa, corazonadas, concurso, mapa, desafio}: true|false). Solo lo que tocó; el resto, por defecto. Ver migración 093.';

-- Solo cuenta en las aulas (comunidades con colegio). El cliente no puede
-- cambiarla: en comunidades solo tiene UPDATE de nombre, descripción, privada
-- y libro. Al crear una comunidad normal da igual lo que ponga: solo valen las aulas.
ALTER TABLE public.comunidades
  ADD COLUMN IF NOT EXISTS juegos jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.comunidades DROP CONSTRAINT IF EXISTS comunidades_juegos_objeto;
ALTER TABLE public.comunidades
  ADD CONSTRAINT comunidades_juegos_objeto CHECK (jsonb_typeof(juegos) = 'object');

COMMENT ON COLUMN public.comunidades.juegos IS
  'Solo en aulas: los juegos que el profe encendió o apagó para su aula. Si falta uno, encendido. Ver migración 093.';


-- ═════════════════════════════════════════════════════════════
-- 2. Uso interno
-- ═════════════════════════════════════════════════════════════

-- Los 5 juegos con su valor por defecto fuera del aula.
CREATE OR REPLACE FUNCTION public._juegos_por_defecto()
RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT '{"mesa": true, "corazonadas": true, "mapa": true, "concurso": false, "desafio": false}'::jsonb;
$fn$;

-- La base con lo elegido encima, solo con los 5 juegos y solo si es true/false.
CREATE OR REPLACE FUNCTION public._juegos_mezclar(p_base jsonb, p_elegido jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT jsonb_object_agg(k, CASE WHEN jsonb_typeof(p_elegido->k) = 'boolean' THEN p_elegido->k ELSE p_base->k END)
  FROM jsonb_object_keys(p_base) k;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Lo que llama el navegador
-- ═════════════════════════════════════════════════════════════

-- Qué juegos salen en un libro: los del aula si la tiene, si no los suyos.
-- Devuelve {mesa, corazonadas, concurso, mapa, desafio, fuente: 'aula'|'perfil'}.
CREATE OR REPLACE FUNCTION public.juegos_libro(p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_aula jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;

  -- Si está en más de un aula con ese libro (raro), manda la primera a la que entró.
  SELECT co.juegos INTO v_aula
  FROM comunidad_miembros cm JOIN comunidades co ON co.id = cm.comunidad_id
  WHERE cm.user_id = v_user AND co.colegio_id IS NOT NULL AND co.libro_id = p_libro
  ORDER BY cm.unido_at
  LIMIT 1;

  IF FOUND THEN
    RETURN _juegos_mezclar('{"mesa": true, "corazonadas": true, "mapa": true, "concurso": true, "desafio": true}'::jsonb, v_aula)
           || jsonb_build_object('fuente', 'aula');
  END IF;

  RETURN _juegos_mezclar(_juegos_por_defecto(),
                         coalesce((SELECT juegos FROM preferencias_usuario WHERE user_id = v_user), '{}'::jsonb))
         || jsonb_build_object('fuente', 'perfil');
END;
$fn$;


-- Lo del Perfil: lo elegido (con los valores por defecto) y si está en algún aula.
CREATE OR REPLACE FUNCTION public.mis_juegos()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'juegos', _juegos_mezclar(_juegos_por_defecto(),
                              coalesce((SELECT juegos FROM preferencias_usuario WHERE user_id = v_user), '{}'::jsonb)),
    'en_aula', EXISTS (SELECT 1 FROM comunidad_miembros cm JOIN comunidades co ON co.id = cm.comunidad_id
                       WHERE cm.user_id = v_user AND co.colegio_id IS NOT NULL));
END;
$fn$;


-- El interruptor del Perfil: un juego cada vez, sin pisar los demás.
CREATE OR REPLACE FUNCTION public.juegos_guardar(p_juego text, p_encendido boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  IF NOT (_juegos_por_defecto() ? p_juego) OR p_encendido IS NULL THEN
    RAISE EXCEPTION 'Ese juego no existe.';
  END IF;

  INSERT INTO preferencias_usuario (user_id, juegos, updated_at)
  VALUES (v_user, jsonb_build_object(p_juego, p_encendido), now())
  ON CONFLICT (user_id) DO UPDATE
  SET juegos = preferencias_usuario.juegos || jsonb_build_object(p_juego, p_encendido), updated_at = now();

  RETURN mis_juegos();
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._juegos_por_defecto()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._juegos_mezclar(jsonb, jsonb)    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.juegos_libro(uuid)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mis_juegos()                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.juegos_guardar(text, boolean)    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.juegos_libro(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_juegos()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.juegos_guardar(text, boolean) TO authenticated;
