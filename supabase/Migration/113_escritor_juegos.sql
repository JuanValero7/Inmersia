-- =============================================================
-- INMERSIA — Migración 113
-- Rincón del escritor, fase 5: Sala de juegos (pedidos)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 111 (_libro_del_escritor).
--
-- QUÉ HACE (Juan, 13 nov 2026)
--   · Los juegos NO son automáticos: el escritor los pide, Juan los prepara
--     con las skills (/juegos-ficcion, /juegos-noficcion) y marca el pedido
--     como listo. Al escritor se le dice que no es inmediato.
--   · Aviso a Juan: el worker de su PC ve los pedidos nuevos (avisado =
--     false) y le salta una notificación de Windows. Sin correo por ahora.
--   · Precio por libro, en escalera con descuento (la de 5/9/13/16/20 llevada
--     a 3 $ por juego): 1 = 3 $, 2 = 5,40, 3 = 7,80 (máximo 3: tres juegos por
--     tipo de libro; el concurso, el desafío y Explícaselo quedan para colegios).
--     Se cuenta ACUMULADO por libro: pedir 2 y luego 1 cuesta lo mismo que
--     pedir 3 juntos. Cancelar devuelve el último escalón.
--   · Requisito: el libro tiene cartelera (los juegos salen de ella).
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================

CREATE OR REPLACE FUNCTION public.precios_escritor() RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $fn$
  SELECT '{"sonido_analisis": 5.00, "sonido_nuevo": 0.15, "sonido_max_efectos": 12,
           "portada": 0.00, "fondo": 1.00,
           "ilustracion": 0.50, "rehacer": 0.25, "ilustraciones_analisis": 5.00,
           "infografia": 0.50, "infografia_texto": 0.00, "cartelera": 5.00,
           "juegos": [0, 3.00, 5.40, 7.80, 9.60, 12.00]}'::jsonb;
$fn$;

-- Lo que cuestan n juegos de un mismo libro, en total.
CREATE OR REPLACE FUNCTION public._precio_juegos(n int) RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $fn$
  SELECT (precios_escritor() -> 'juegos' ->> least(greatest(n, 0), 5))::numeric;
$fn$;

CREATE TABLE IF NOT EXISTS public.pedidos_juegos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libro_id   uuid NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  juego      text NOT NULL,
  estado     text NOT NULL DEFAULT 'pedido',
  nota       text,                      -- lo que Juan le dice al escritor (p. ej. por qué no se pudo)
  avisado    boolean NOT NULL DEFAULT false,
  creado     timestamptz NOT NULL DEFAULT now(),
  actualizado timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_juegos_juego_check CHECK (juego IN ('anderson', 'corazonadas', 'desafio', 'concurso', 'mapa',
                                                        'hilo', 'falsificador', 'explicaselo', 'capsula')),
  CONSTRAINT pedidos_juegos_estado_check CHECK (estado IN ('pedido', 'en_curso', 'listo', 'cancelado'))
);
-- Un juego activo por libro.
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_juegos_activo_uidx ON public.pedidos_juegos (libro_id, juego)
  WHERE estado <> 'cancelado';
CREATE INDEX IF NOT EXISTS pedidos_juegos_sin_aviso_idx ON public.pedidos_juegos (creado) WHERE NOT avisado;

ALTER TABLE public.pedidos_juegos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pedidos_juegos_select ON public.pedidos_juegos;
CREATE POLICY pedidos_juegos_select ON public.pedidos_juegos
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.es_superusuario());
-- Sin políticas de escritura: todo por las funciones de abajo.
REVOKE INSERT, UPDATE, DELETE ON public.pedidos_juegos FROM anon, authenticated;


-- El escritor pide uno o varios juegos para su libro.
CREATE OR REPLACE FUNCTION public.pedir_juegos(p_libro uuid, p_juegos text[]) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  l          libros%ROWTYPE := _libro_del_escritor(p_libro);
  -- Juan, 13 nov: el concurso, el desafío y Explícaselo son de colegio; al escritor no se le ofrecen.
  v_validos  text[] := CASE WHEN l.es_ficcion THEN ARRAY['anderson', 'corazonadas', 'mapa']
                            ELSE ARRAY['hilo', 'falsificador', 'capsula'] END;
  v_activos  int;
  v_nuevos   int;
  v_costo    numeric(8,2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM escritores WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Tu cuenta no tiene el modo escritor.' USING ERRCODE = '42501', HINT = 'no_escritor';
  END IF;
  IF p_juegos IS NULL OR cardinality(p_juegos) = 0 OR cardinality(p_juegos) > 3
     OR NOT (p_juegos <@ v_validos)
     OR (SELECT count(DISTINCT j) FROM unnest(p_juegos) j) <> cardinality(p_juegos) THEN
    RAISE EXCEPTION 'Elige juegos de este tipo de libro.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cartelera_items WHERE libro_id = p_libro) THEN
    RAISE EXCEPTION 'Primero genera la cartelera en la Sala de análisis: los juegos salen de ella.'
      USING ERRCODE = '22023', HINT = 'sin_cartelera';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pedir_juegos:' || p_libro));
  IF EXISTS (SELECT 1 FROM pedidos_juegos WHERE libro_id = p_libro AND estado <> 'cancelado' AND juego = ANY (p_juegos)) THEN
    RAISE EXCEPTION 'Alguno de esos juegos ya está pedido.' USING ERRCODE = '22023', HINT = 'duplicado';
  END IF;
  SELECT count(*) INTO v_activos FROM pedidos_juegos WHERE libro_id = p_libro AND estado <> 'cancelado';
  v_nuevos := cardinality(p_juegos);
  v_costo := _precio_juegos(v_activos + v_nuevos) - _precio_juegos(v_activos);

  UPDATE escritores SET saldo_cupon = saldo_cupon - v_costo
   WHERE user_id = auth.uid() AND saldo_cupon >= v_costo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tu saldo no alcanza para esto.' USING ERRCODE = '42501', HINT = 'saldo_insuficiente';
  END IF;

  INSERT INTO pedidos_juegos (libro_id, user_id, juego)
  SELECT p_libro, auth.uid(), j FROM unnest(p_juegos) j;
  RETURN v_costo;
END;
$fn$;

-- Cancelar: devuelve el último escalón de la escalera al dueño del pedido.
CREATE OR REPLACE FUNCTION public._cancelar_pedido_juego(p_id uuid, p_nota text) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  pj         pedidos_juegos%ROWTYPE;
  v_activos  int;
  v_devuelve numeric(8,2);
BEGIN
  SELECT * INTO pj FROM pedidos_juegos WHERE id = p_id FOR UPDATE;
  PERFORM pg_advisory_xact_lock(hashtext('pedir_juegos:' || pj.libro_id));
  SELECT count(*) INTO v_activos FROM pedidos_juegos WHERE libro_id = pj.libro_id AND estado <> 'cancelado';
  v_devuelve := _precio_juegos(v_activos) - _precio_juegos(v_activos - 1);
  UPDATE pedidos_juegos SET estado = 'cancelado', nota = p_nota, actualizado = now() WHERE id = p_id;
  UPDATE escritores SET saldo_cupon = saldo_cupon + v_devuelve WHERE user_id = pj.user_id;
  RETURN v_devuelve;
END;
$fn$;
REVOKE ALL ON FUNCTION public._cancelar_pedido_juego(uuid, text) FROM PUBLIC, anon, authenticated;

-- El escritor cancela un pedido que Juan todavía no empezó.
CREATE OR REPLACE FUNCTION public.cancelar_juego(p_id uuid) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pedidos_juegos WHERE id = p_id AND user_id = auth.uid() AND estado = 'pedido') THEN
    RAISE EXCEPTION 'Ese juego ya no se puede cancelar.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  RETURN _cancelar_pedido_juego(p_id, NULL);
END;
$fn$;

-- Juan (superusuario) mueve el pedido: en_curso, listo o cancelado (devuelve).
CREATE OR REPLACE FUNCTION public.actualizar_pedido_juego(p_id uuid, p_estado text, p_nota text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actual text;
BEGIN
  IF NOT public.es_superusuario() THEN
    RAISE EXCEPTION 'Solo para administración.' USING ERRCODE = '42501', HINT = 'no_superusuario';
  END IF;
  SELECT estado INTO v_actual FROM pedidos_juegos WHERE id = p_id;
  IF v_actual IS NULL OR v_actual = 'cancelado' OR p_estado NOT IN ('pedido', 'en_curso', 'listo', 'cancelado') THEN
    RAISE EXCEPTION 'Ese pedido no se puede cambiar.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF p_estado = 'cancelado' THEN
    PERFORM _cancelar_pedido_juego(p_id, nullif(btrim(coalesce(p_nota, '')), ''));
  ELSE
    UPDATE pedidos_juegos SET estado = p_estado, actualizado = now(),
           nota = coalesce(nullif(btrim(coalesce(p_nota, '')), ''), nota)
     WHERE id = p_id;
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.pedir_juegos(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancelar_juego(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.actualizar_pedido_juego(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_juegos(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_juego(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_pedido_juego(uuid, text, text) TO authenticated;
GRANT SELECT, UPDATE ON public.pedidos_juegos TO service_role;
