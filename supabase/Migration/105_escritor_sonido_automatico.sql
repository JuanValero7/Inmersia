-- =============================================================
-- INMERSIA — Migración 105
-- Rincón del escritor, fase 2b: sonido automático (de pago, con el cupón)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 103 (escritores, trabajos, pedir_trabajo).
--
-- QUÉ HACE (plan acordado con Juan, 13 nov 2026)
--   · Nuevo tipo de trabajo «sonido»: el PC de Juan hace lo mismo que
--     orquestar.py (sugerir → simplificar → generar_sfx → upload_sonidos)
--     y, si se pide, los ambientes. Solo libros de ficción.
--   · Precios en un solo sitio, precios_escritor(), que también lee la
--     pantalla. Costo real medido el 13 nov: sonido nuevo de ElevenLabs
--     0,025 $ (2.372 sonidos de 42 libros) y Gemini ~1 $ por libro; aquí
--     ×5 redondeado: 5 $ el análisis y 0,15 $ cada sonido NUEVO (los que ya
--     están en la biblioteca no se cobran). El cupón se decide después.
--   · Cobro: al pedirlo se RESERVA el máximo posible (análisis + capítulos ×
--     tope de efectos × precio) y se descuenta del saldo; si no alcanza, no
--     se acepta. Al terminar, el worker llama a cerrar_cobro(trabajo, costo)
--     y se devuelve la diferencia. Si falla, cerrar_cobro(trabajo, 0)
--     devuelve todo.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Precios
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.precios_escritor() RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $fn$
  SELECT '{"sonido_analisis": 5.00, "sonido_nuevo": 0.15, "sonido_max_efectos": 12}'::jsonb;
$fn$;

GRANT EXECUTE ON FUNCTION public.precios_escritor() TO anon, authenticated, service_role;


-- ═════════════════════════════════════════════════════════════
-- 2. Trabajos: tipo «sonido» y lo cobrado
-- ═════════════════════════════════════════════════════════════
ALTER TABLE public.trabajos ADD COLUMN IF NOT EXISTS reservado numeric(8,2);
ALTER TABLE public.trabajos ADD COLUMN IF NOT EXISTS costo     numeric(8,2);

ALTER TABLE public.trabajos DROP CONSTRAINT IF EXISTS trabajos_tipo_check;
ALTER TABLE public.trabajos ADD CONSTRAINT trabajos_tipo_check
  CHECK (tipo IN ('prueba', 'borrar', 'sonido'));


-- ═════════════════════════════════════════════════════════════
-- 3. pedir_trabajo: igual que en la 103 + el caso «sonido»
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.pedir_trabajo(p_libro uuid, p_tipo text, p_parametros jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_id        uuid;
  v_params    jsonb := coalesce(p_parametros, '{}'::jsonb);
  v_precios   jsonb := precios_escritor();
  v_reservado numeric(8,2);
  v_max       int;
  v_caps      int;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM escritores WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Tu cuenta no tiene el modo escritor.' USING ERRCODE = '42501', HINT = 'no_escritor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM libros WHERE id = p_libro AND propietario_id = v_uid) THEN
    RAISE EXCEPTION 'Ese libro no es tuyo o ya no existe.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;
  -- Lo que puede pedir el escritor (los internos, como «borrar», no).
  IF p_tipo NOT IN ('prueba', 'sonido') THEN
    RAISE EXCEPTION 'Ese trabajo no existe.' USING ERRCODE = '22023', HINT = 'tipo_invalido';
  END IF;
  IF jsonb_typeof(v_params) <> 'object' OR length(v_params::text) > 10000 THEN
    RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pedir_trabajo:' || p_libro || ':' || p_tipo));
  IF EXISTS (SELECT 1 FROM trabajos WHERE libro_id = p_libro AND tipo = p_tipo
             AND estado IN ('pendiente', 'en_proceso')) THEN
    RAISE EXCEPTION 'Ya hay uno en marcha para este libro.' USING ERRCODE = '42501', HINT = 'trabajo_en_curso';
  END IF;

  IF p_tipo = 'sonido' THEN
    IF NOT (SELECT es_ficcion FROM libros WHERE id = p_libro) THEN
      RAISE EXCEPTION 'Los libros de no ficción no llevan efectos.' USING ERRCODE = '22023', HINT = 'no_ficcion';
    END IF;
    -- Solo estos dos parámetros, con su forma.
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k NOT IN ('max_efectos', 'ambientes'))
       OR jsonb_typeof(v_params -> 'max_efectos') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_params -> 'ambientes') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_max := (v_params ->> 'max_efectos')::numeric::int;
    IF v_max::numeric <> (v_params ->> 'max_efectos')::numeric
       OR v_max NOT BETWEEN 1 AND (v_precios ->> 'sonido_max_efectos')::int THEN
      RAISE EXCEPTION 'El tope de efectos va de 1 a %.', v_precios ->> 'sonido_max_efectos'
        USING ERRCODE = '22023', HINT = 'formato';
    END IF;

    SELECT count(*) INTO v_caps FROM capitulos WHERE libro_id = p_libro;
    v_reservado := (v_precios ->> 'sonido_analisis')::numeric
                 + v_caps * v_max * (v_precios ->> 'sonido_nuevo')::numeric;

    -- Reservar del cupón (bloqueando la fila: dos pedidos a la vez no gastan dos veces).
    UPDATE escritores SET saldo_cupon = saldo_cupon - v_reservado
     WHERE user_id = v_uid AND saldo_cupon >= v_reservado;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tu saldo no alcanza para esto.' USING ERRCODE = '42501', HINT = 'saldo_insuficiente';
    END IF;
  END IF;

  INSERT INTO trabajos (user_id, libro_id, tipo, parametros, reservado)
  VALUES (v_uid, p_libro, p_tipo, v_params, v_reservado)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. Cerrar el cobro (solo el worker)
-- ═════════════════════════════════════════════════════════════
-- Cobra p_costo (nunca más de lo reservado) y devuelve el resto al saldo.
-- Una sola vez por trabajo: si ya tiene costo, no hace nada.
CREATE OR REPLACE FUNCTION public.cerrar_cobro(p_trabajo uuid, p_costo numeric)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  t       trabajos%ROWTYPE;
  v_costo numeric(8,2);
BEGIN
  SELECT * INTO t FROM trabajos WHERE id = p_trabajo FOR UPDATE;
  IF NOT FOUND OR t.costo IS NOT NULL OR t.reservado IS NULL THEN
    RETURN t.costo;
  END IF;
  v_costo := least(greatest(coalesce(p_costo, 0), 0), t.reservado);
  UPDATE trabajos SET costo = v_costo WHERE id = p_trabajo;
  IF t.user_id IS NOT NULL THEN
    UPDATE escritores SET saldo_cupon = saldo_cupon + (t.reservado - v_costo) WHERE user_id = t.user_id;
  END IF;
  RETURN v_costo;
END;
$fn$;

REVOKE ALL ON FUNCTION public.cerrar_cobro(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_cobro(uuid, numeric) TO service_role;


-- ═════════════════════════════════════════════════════════════
-- 5. Si se borra el libro con un cobro reservado, se devuelve
-- ═════════════════════════════════════════════════════════════
-- Igual que en la 103 + devolver lo reservado de los trabajos pendientes
-- (los que están en proceso los cierra el worker al fallar).
CREATE OR REPLACE FUNCTION public._trabajo_borrar_libro() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM trabajos WHERE libro_id = OLD.id AND estado = 'pendiente' AND reservado IS NOT NULL AND costo IS NULL LOOP
    PERFORM cerrar_cobro(r.id, 0);
  END LOOP;
  DELETE FROM trabajos WHERE libro_id = OLD.id AND estado = 'pendiente';
  INSERT INTO trabajos (user_id, libro_id, tipo) VALUES (NULL, OLD.id, 'borrar');
  RETURN OLD;
END;
$fn$;

REVOKE ALL ON FUNCTION public._trabajo_borrar_libro() FROM PUBLIC, anon, authenticated;
