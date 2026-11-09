-- =============================================================
-- INMERSIA — Migración 097
-- Ovillos: la cuenta exacta para el profe y el bote de la clase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere de la 087 a la 096 (mis_datos_juegos es de la 096).
--
-- QUÉ CAMBIA (decisiones de Juan, 9 nov 2026)
--   1. La referencia del profe al crear una recompensa pasa de «a ojo» a
--      la cuenta exacta de lo que paga cada juego si el alumno no se
--      equivoca nunca, y solo con los juegos encendidos en su aula:
--        lectura      10 + 2 por capítulo
--        mesa         2 por deducción (+3 de premio, −1 por combinar)
--        corazonadas  3 cada una (juega 3 y acierta: recibe 6)
--        mapa         1 por tesoro
--        concurso     3 por frase; a cada alumno le tocan 1 o 2 por
--                     capítulo (si el capítulo tiene 2 o más), así que
--                     se da la media y el rango
--        desafío      no da ovillos
--      Antes la mesa contaba 3 por deducción (sin restar el ovillo de
--      combinar) y se sumaban los juegos apagados.
--   2. El precio lo pone el profe a su gusto: de 1 a 9.999 (antes 999).
--      Inmersia solo sugiere (eso está en la página).
--   3. Bote de la clase (limite = 'bote'): el profe pone un precio total,
--      cada alumno aporta los ovillos que quiera (del libro del aula) y
--      todos ven cuánto se juntó. Al llenarse le aparece al profe en
--      «Por entregar». Si lo borra antes de entregarlo, a cada uno se le
--      devuelve lo que puso. Nadie puede aportar más de lo que falta.
--
-- PRIVACIDAD
--   Los alumnos ven el total del bote y lo suyo. El profe ve cuánto puso
--   cada alumno (son cantidades, nada escrito por el alumno).
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. La cuenta de ovillos de un libro
-- ═════════════════════════════════════════════════════════════
-- _referencia_ovillos(libro, juegos del aula):
--   {solo_leyendo, maximo, desglose: {lectura, mesa, corazonadas, mapa, concurso},
--    concurso_rango: [min, max], apagados: [juegos con contenido que el aula apagó]}

CREATE OR REPLACE FUNCTION public._referencia_ovillos(p_libro uuid, p_juegos jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  -- En un aula, el juego que el profe no tocó está encendido (093).
  v_on    jsonb := _juegos_mezclar('{"mesa": true, "corazonadas": true, "mapa": true, "concurso": true, "desafio": true}'::jsonb,
                                   coalesce(p_juegos, '{}'::jsonb));
  v_leer  int;
  v_mesa  int;
  v_cz    int;
  v_mapa  int;
  v_cc    int := 0;
  v_ccmin int := 0;
  v_ccmax int := 0;
  v_apag  text[] := '{}';
BEGIN
  v_leer := 10 + 2 * (SELECT count(*) FROM capitulos WHERE libro_id = p_libro)::int;

  v_mesa := coalesce((SELECT jsonb_array_length(datos->'rasgos') * 2 FROM anderson_contenido WHERE libro_id = p_libro), 0);
  v_cz   := coalesce((SELECT jsonb_array_length(datos->'corazonadas') * 3 FROM corazonadas_contenido WHERE libro_id = p_libro), 0);
  v_mapa := coalesce((SELECT jsonb_array_length(datos->'tesoros') FROM mapa_contenido WHERE libro_id = p_libro), 0);
  SELECT coalesce(round(sum(CASE WHEN n >= 2 THEN 1.5 ELSE 1 END) * 3), 0)::int,
         coalesce(count(*) * 3, 0)::int,
         coalesce(sum(least(n, 2)) * 3, 0)::int
  INTO v_cc, v_ccmin, v_ccmax
  FROM (SELECT f->>'cap' AS cap, count(*) AS n
        FROM concurso_contenido c, jsonb_array_elements(c.datos->'frases') f
        WHERE c.libro_id = p_libro GROUP BY 1) s;

  IF NOT (v_on->>'mesa')::boolean        AND v_mesa > 0 THEN v_apag := v_apag || 'mesa'::text;        v_mesa := 0; END IF;
  IF NOT (v_on->>'corazonadas')::boolean AND v_cz   > 0 THEN v_apag := v_apag || 'corazonadas'::text; v_cz   := 0; END IF;
  IF NOT (v_on->>'mapa')::boolean        AND v_mapa > 0 THEN v_apag := v_apag || 'mapa'::text;        v_mapa := 0; END IF;
  IF NOT (v_on->>'concurso')::boolean    AND v_cc   > 0 THEN
    v_apag := v_apag || 'concurso'::text; v_cc := 0; v_ccmin := 0; v_ccmax := 0;
  END IF;

  RETURN jsonb_build_object(
    'solo_leyendo', v_leer,
    'maximo', v_leer + v_mesa + v_cz + v_mapa + v_cc,
    'desglose', jsonb_build_object('lectura', v_leer, 'mesa', v_mesa, 'corazonadas', v_cz,
                                   'mapa', v_mapa, 'concurso', v_cc),
    'concurso_rango', jsonb_build_array(v_ccmin, v_ccmax),
    'apagados', to_jsonb(v_apag));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 2. Recompensas: precio libre y el bote
-- ═════════════════════════════════════════════════════════════

ALTER TABLE public.recompensas DROP CONSTRAINT IF EXISTS recompensas_limite_check;
ALTER TABLE public.recompensas
  ADD CONSTRAINT recompensas_limite_check CHECK (limite IN ('alumno', 'semana', 'clase', 'libre', 'bote'));
ALTER TABLE public.recompensas DROP CONSTRAINT IF EXISTS recompensas_precio_check;
ALTER TABLE public.recompensas
  ADD CONSTRAINT recompensas_precio_check CHECK (precio BETWEEN 1 AND 9999);
ALTER TABLE public.recompensas
  ADD COLUMN IF NOT EXISTS entregado_at timestamptz;   -- solo botes: cuándo lo entregó el profe

COMMENT ON COLUMN public.recompensas.entregado_at IS
  'Solo botes (limite = bote): cuándo el profe lo marcó entregado. Ver migración 097.';


CREATE TABLE IF NOT EXISTS public.recompensas_aportes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recompensa_id uuid        NOT NULL REFERENCES public.recompensas(id) ON DELETE CASCADE,
  aula_id       uuid        NOT NULL REFERENCES public.comunidades(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id      uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  cantidad      int         NOT NULL CHECK (cantidad >= 1),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aportes_recompensa ON public.recompensas_aportes (recompensa_id);
CREATE INDEX IF NOT EXISTS idx_aportes_user       ON public.recompensas_aportes (user_id, libro_id);

COMMENT ON TABLE public.recompensas_aportes IS
  'Ovillos que cada alumno puso en un bote de la clase. Solo escribe recompensa_aportar; si el profe borra el bote, recompensa_borrar los devuelve. Ver migración 097.';

ALTER TABLE public.recompensas_aportes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recompensas_aportes_select_own" ON public.recompensas_aportes;
CREATE POLICY "recompensas_aportes_select_own" ON public.recompensas_aportes
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- Lo que lleva juntado un bote.
CREATE OR REPLACE FUNCTION public._bote_juntado(p_rec uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce(sum(cantidad), 0)::int FROM recompensas_aportes WHERE recompensa_id = p_rec;
$fn$;


-- La de la 095 con los botes: 'lleno' (esperando al profe) y 'entregado'.
CREATE OR REPLACE FUNCTION public._recompensa_bloqueo(p_user uuid, p_rec uuid, p_libro uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE r.limite
    WHEN 'alumno' THEN CASE WHEN EXISTS (
        SELECT 1 FROM recompensas_canjes c WHERE c.recompensa_id = r.id AND c.libro_id = p_libro
          AND c.user_id = p_user AND c.estado <> 'devuelto') THEN 'ya_canjeado' END
    WHEN 'semana' THEN CASE WHEN EXISTS (
        SELECT 1 FROM recompensas_canjes c WHERE c.recompensa_id = r.id
          AND c.user_id = p_user AND c.estado <> 'devuelto' AND c.created_at > now() - interval '7 days') THEN 'esta_semana' END
    WHEN 'clase' THEN CASE WHEN EXISTS (
        SELECT 1 FROM recompensas_canjes c WHERE c.recompensa_id = r.id AND c.libro_id = p_libro
          AND c.estado <> 'devuelto') THEN 'agotado' END
    WHEN 'bote' THEN CASE WHEN r.entregado_at IS NOT NULL THEN 'entregado'
                          WHEN _bote_juntado(r.id) >= r.precio THEN 'lleno' END
    ELSE NULL END
  FROM recompensas r WHERE r.id = p_rec;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Lo que llama el alumno
-- ═════════════════════════════════════════════════════════════
-- tienda_recompensas: la de la 095, con los botes:
--   recompensas[].juntado / .mio   (solo botes; null en los vales)
--   canjes[] con tipo 'bote': lo que puso, estado 'aportado' | 'lleno' | 'entregado'

CREATE OR REPLACE FUNCTION public.tienda_recompensas(p_libro uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user   uuid := auth.uid();
  v_libros jsonb;
  v_libro  uuid := p_libro;
  v_caps   int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Inicia sesión.' USING ERRCODE = '42501'; END IF;

  WITH aula AS (
    SELECT DISTINCT a.libro_id FROM _aulas_de_alumno(v_user) a WHERE a.libro_id IS NOT NULL
  ),
  con_exp AS (
    SELECT bu.libro_id FROM bibliotecas_usuarios bu JOIN expedientes_contenido e ON e.libro_id = bu.libro_id
    WHERE bu.user_id = v_user
  ),
  todos AS (
    SELECT l.id, l.titulo, EXISTS (SELECT 1 FROM aula WHERE aula.libro_id = l.id) AS de_aula
    FROM libros l WHERE l.id IN (SELECT libro_id FROM aula UNION SELECT libro_id FROM con_exp)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'titulo', titulo, 'de_aula', de_aula)
                            ORDER BY de_aula DESC, titulo), '[]'::jsonb)
  INTO v_libros FROM todos;

  IF v_libro IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_libros) x WHERE (x->>'id')::uuid = v_libro) THEN
    v_libro := (v_libros->0->>'id')::uuid;
  END IF;
  IF v_libro IS NULL THEN
    RETURN jsonb_build_object('libros', '[]'::jsonb, 'libro_id', NULL);
  END IF;

  SELECT count(*) INTO v_caps FROM capitulos WHERE libro_id = v_libro;

  RETURN jsonb_build_object(
    'libros', v_libros,
    'libro_id', v_libro,
    'saldo', _ovillos_saldo(v_user, v_libro),
    'solo_leyendo', 10 + 2 * v_caps,
    'recompensas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'titulo', r.titulo, 'precio', r.precio, 'limite', r.limite, 'aula', a.nombre,
        'bloqueo', _recompensa_bloqueo(v_user, r.id, v_libro),
        'desde', CASE WHEN r.limite = 'semana' THEN (
                   SELECT max(c.created_at) + interval '7 days' FROM recompensas_canjes c
                   WHERE c.recompensa_id = r.id AND c.user_id = v_user AND c.estado <> 'devuelto'
                     AND c.created_at > now() - interval '7 days') END,
        'juntado', CASE WHEN r.limite = 'bote' THEN _bote_juntado(r.id) END,
        'mio', CASE WHEN r.limite = 'bote' THEN (
                 SELECT coalesce(sum(ap.cantidad), 0) FROM recompensas_aportes ap
                 WHERE ap.recompensa_id = r.id AND ap.user_id = v_user) END
      ) ORDER BY (r.limite = 'bote') DESC, r.precio, r.created_at)
      FROM _aulas_de_alumno(v_user) a JOIN recompensas r ON r.aula_id = a.aula_id
      WHERE a.libro_id = v_libro AND r.activa), '[]'::jsonb),
    'expedientes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x->>'id', 'titulo', x->>'titulo', 'descripcion', x->>'descripcion',
        'precio', (x->>'precio')::int,
        'comprado', EXISTS (SELECT 1 FROM expedientes_compras ec
                            WHERE ec.user_id = v_user AND ec.libro_id = v_libro AND ec.expediente = x->>'id')
      ) ORDER BY o)
      FROM expedientes_contenido e, jsonb_array_elements(e.datos->'expedientes') WITH ORDINALITY t(x, o)
      WHERE e.libro_id = v_libro), '[]'::jsonb),
    'canjes', coalesce((
      SELECT jsonb_agg(c ORDER BY c->>'fecha' DESC) FROM (
        SELECT jsonb_build_object('tipo', 'vale', 'id', rc.id, 'titulo', rc.titulo, 'precio', rc.precio,
                                  'estado', rc.estado, 'fecha', rc.created_at) AS c
        FROM recompensas_canjes rc WHERE rc.user_id = v_user AND rc.libro_id = v_libro
        UNION ALL
        SELECT jsonb_build_object('tipo', 'expediente', 'id', ec.expediente,
                                  'titulo', coalesce((SELECT x->>'titulo' FROM expedientes_contenido e, jsonb_array_elements(e.datos->'expedientes') x
                                                      WHERE e.libro_id = ec.libro_id AND x->>'id' = ec.expediente), 'Expediente'),
                                  'precio', ec.precio, 'estado', 'abierto', 'fecha', ec.created_at)
        FROM expedientes_compras ec WHERE ec.user_id = v_user AND ec.libro_id = v_libro
        UNION ALL
        SELECT jsonb_build_object('tipo', 'bote', 'id', ap.id, 'titulo', r.titulo, 'precio', ap.cantidad,
                                  'estado', CASE WHEN r.entregado_at IS NOT NULL THEN 'entregado'
                                                 WHEN _bote_juntado(r.id) >= r.precio THEN 'lleno'
                                                 ELSE 'aportado' END,
                                  'fecha', ap.created_at)
        FROM recompensas_aportes ap JOIN recompensas r ON r.id = ap.recompensa_id
        WHERE ap.user_id = v_user AND ap.libro_id = v_libro
      ) s), '[]'::jsonb)
  );
END;
$fn$;


-- La de la 095: un bote no se canjea, se le aporta.
CREATE OR REPLACE FUNCTION public.recompensa_canjear(p_recompensa uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user  uuid := auth.uid();
  v_rec   record;
  v_libro uuid;
  v_bloq  text;
  v_id    uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Inicia sesión.' USING ERRCODE = '42501'; END IF;

  SELECT r.*, a.libro_id AS libro_aula INTO v_rec
  FROM recompensas r JOIN _aulas_de_alumno(v_user) a ON a.aula_id = r.aula_id
  WHERE r.id = p_recompensa;
  IF v_rec.id IS NULL THEN RAISE EXCEPTION 'Esta recompensa no es de tu aula.' USING ERRCODE = '42501'; END IF;
  IF v_rec.limite = 'bote' THEN RAISE EXCEPTION 'Esto es un bote de la clase: pon los ovillos que quieras.'; END IF;  -- 097
  IF NOT v_rec.activa THEN RAISE EXCEPTION 'Tu profe quitó esta recompensa de la tienda.'; END IF;
  v_libro := v_rec.libro_aula;
  IF v_libro IS NULL THEN RAISE EXCEPTION 'Tu aula todavía no tiene libro.'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || v_libro));
  -- Los de toda la clase, en fila: dos alumnos no se llevan el mismo vale único.
  PERFORM pg_advisory_xact_lock(hashtext('recompensa:' || p_recompensa));

  v_bloq := _recompensa_bloqueo(v_user, p_recompensa, v_libro);
  IF v_bloq = 'ya_canjeado' THEN RAISE EXCEPTION 'Ya canjeaste esta recompensa.'; END IF;
  IF v_bloq = 'esta_semana' THEN RAISE EXCEPTION 'Esta recompensa se canjea una vez por semana.'; END IF;
  IF v_bloq = 'agotado'     THEN RAISE EXCEPTION 'Alguien de tu clase ya se la llevó.'; END IF;

  IF _ovillos_saldo(v_user, v_libro) < v_rec.precio THEN
    RAISE EXCEPTION 'No te alcanzan los ovillos.';
  END IF;

  INSERT INTO recompensas_canjes (recompensa_id, aula_id, user_id, libro_id, titulo, precio)
  VALUES (p_recompensa, v_rec.aula_id, v_user, v_libro, v_rec.titulo, v_rec.precio)
  RETURNING id INTO v_id;

  INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
  VALUES (v_user, v_libro, -v_rec.precio, 'recompensa', v_id, jsonb_build_object('recompensa', p_recompensa));

  RETURN jsonb_build_object('saldo', _ovillos_saldo(v_user, v_libro), 'canje', v_id);
END;
$fn$;


-- Poner ovillos en un bote de la clase (del libro que lee el aula).
-- Si pide más de lo que falta, pone solo lo que falta.
CREATE OR REPLACE FUNCTION public.recompensa_aportar(p_recompensa uuid, p_cantidad int)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user    uuid := auth.uid();
  v_rec     record;
  v_libro   uuid;
  v_juntado int;
  v_cant    int;
  v_id      uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Inicia sesión.' USING ERRCODE = '42501'; END IF;

  SELECT r.*, a.libro_id AS libro_aula INTO v_rec
  FROM recompensas r JOIN _aulas_de_alumno(v_user) a ON a.aula_id = r.aula_id
  WHERE r.id = p_recompensa;
  IF v_rec.id IS NULL THEN RAISE EXCEPTION 'Esta recompensa no es de tu aula.' USING ERRCODE = '42501'; END IF;
  IF v_rec.limite <> 'bote' THEN RAISE EXCEPTION 'Esta recompensa se canjea, no es un bote.'; END IF;
  IF NOT v_rec.activa THEN RAISE EXCEPTION 'Tu profe quitó este bote de la tienda.'; END IF;
  v_libro := v_rec.libro_aula;
  IF v_libro IS NULL THEN RAISE EXCEPTION 'Tu aula todavía no tiene libro.'; END IF;
  IF p_cantidad IS NULL OR p_cantidad < 1 THEN RAISE EXCEPTION 'Pon al menos 1 ovillo.'; END IF;

  -- Primero el bote y después el saldo, igual que recompensa_borrar (sin cruces).
  PERFORM pg_advisory_xact_lock(hashtext('recompensa:' || p_recompensa));
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || v_libro));

  IF (SELECT entregado_at FROM recompensas WHERE id = p_recompensa) IS NOT NULL THEN
    RAISE EXCEPTION 'Este bote ya se entregó.';
  END IF;
  v_juntado := _bote_juntado(p_recompensa);
  IF v_juntado >= v_rec.precio THEN RAISE EXCEPTION '¡El bote ya está lleno!'; END IF;
  v_cant := least(p_cantidad, v_rec.precio - v_juntado);

  IF _ovillos_saldo(v_user, v_libro) < v_cant THEN
    RAISE EXCEPTION 'No te alcanzan los ovillos.';
  END IF;

  INSERT INTO recompensas_aportes (recompensa_id, aula_id, user_id, libro_id, cantidad)
  VALUES (p_recompensa, v_rec.aula_id, v_user, v_libro, v_cant)
  RETURNING id INTO v_id;

  INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
  VALUES (v_user, v_libro, -v_cant, 'recompensa', v_id, jsonb_build_object('bote', p_recompensa));

  RETURN jsonb_build_object('saldo', _ovillos_saldo(v_user, v_libro), 'puesto', v_cant,
                            'juntado', v_juntado + v_cant, 'lleno', v_juntado + v_cant >= v_rec.precio);
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. Lo que llama el profe
-- ═════════════════════════════════════════════════════════════
-- recompensas_aula: la de la 095 con:
--   referencia: la de _referencia_ovillos (+ 'jugando' = maximo, por la página vieja)
--   recompensas[] de bote: juntado, entregado_at, aportes [{alumno, cantidad}]
--                 (en un bote, 'canjes' = cuántos aportaron)
--   botes_por_entregar: [{id, titulo, precio, aportaron}]
--   entregados: también los botes entregados (alumno = 'Toda la clase')

CREATE OR REPLACE FUNCTION public.recompensas_aula(p_aula uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_libro  uuid;
  v_juegos jsonb;
  v_users  uuid[];
  v_ref    jsonb;
BEGIN
  PERFORM _profe_de_aula(p_aula);

  SELECT libro_id, juegos INTO v_libro, v_juegos FROM comunidades WHERE id = p_aula;
  SELECT coalesce(array_agg(user_id), '{}') INTO v_users
  FROM comunidad_miembros WHERE comunidad_id = p_aula AND rol = 'miembro';

  IF v_libro IS NOT NULL THEN
    v_ref := _referencia_ovillos(v_libro, v_juegos);
    v_ref := v_ref || jsonb_build_object('jugando', v_ref->'maximo');
  END IF;

  RETURN jsonb_build_object(
    'libro_id', v_libro,
    'alumnos', cardinality(v_users),
    'referencia', v_ref,
    'recompensas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'titulo', r.titulo, 'precio', r.precio, 'limite', r.limite, 'activa', r.activa,
        'canjes', CASE WHEN r.limite = 'bote'
                    THEN (SELECT count(DISTINCT ap.user_id) FROM recompensas_aportes ap WHERE ap.recompensa_id = r.id)
                    ELSE (SELECT count(*) FROM recompensas_canjes c WHERE c.recompensa_id = r.id AND c.estado <> 'devuelto') END,
        'juntado', CASE WHEN r.limite = 'bote' THEN _bote_juntado(r.id) END,
        'entregado_at', r.entregado_at,
        'aportes', CASE WHEN r.limite = 'bote' THEN coalesce((
                     SELECT jsonb_agg(jsonb_build_object('alumno', _nombre_en_aula(p_aula, s.user_id), 'cantidad', s.total)
                                      ORDER BY s.total DESC)
                     FROM (SELECT ap.user_id, sum(ap.cantidad)::int AS total FROM recompensas_aportes ap
                           WHERE ap.recompensa_id = r.id GROUP BY ap.user_id) s), '[]'::jsonb) END
      ) ORDER BY r.activa DESC, r.created_at)
      FROM recompensas r WHERE r.aula_id = p_aula), '[]'::jsonb),
    'pendientes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'alumno', _nombre_en_aula(p_aula, c.user_id), 'titulo', c.titulo,
        'precio', c.precio, 'fecha', c.created_at) ORDER BY c.created_at)
      FROM recompensas_canjes c WHERE c.aula_id = p_aula AND c.estado = 'pendiente'), '[]'::jsonb),
    'botes_por_entregar', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'titulo', r.titulo, 'precio', r.precio,
        'aportaron', (SELECT count(DISTINCT ap.user_id) FROM recompensas_aportes ap WHERE ap.recompensa_id = r.id))
        ORDER BY r.created_at)
      FROM recompensas r WHERE r.aula_id = p_aula AND r.limite = 'bote' AND r.entregado_at IS NULL
        AND _bote_juntado(r.id) >= r.precio), '[]'::jsonb),
    'entregados', coalesce((
      SELECT jsonb_agg(e ORDER BY e->>'fecha' DESC) FROM (
        SELECT jsonb_build_object(
          'id', c.id, 'alumno', _nombre_en_aula(p_aula, c.user_id), 'titulo', c.titulo,
          'precio', c.precio, 'estado', c.estado, 'fecha', c.resuelto_at) AS e
        FROM recompensas_canjes c WHERE c.aula_id = p_aula AND c.estado <> 'pendiente'
          AND c.resuelto_at > now() - interval '30 days'
        UNION ALL
        SELECT jsonb_build_object(
          'id', r.id, 'alumno', 'Toda la clase', 'titulo', r.titulo,
          'precio', r.precio, 'estado', 'entregado', 'fecha', r.entregado_at)
        FROM recompensas r WHERE r.aula_id = p_aula AND r.limite = 'bote'
          AND r.entregado_at > now() - interval '30 days'
      ) s), '[]'::jsonb),
    'expedientes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x->>'id', 'titulo', x->>'titulo',
        'abrieron', (SELECT count(*) FROM expedientes_compras ec
                     WHERE ec.libro_id = v_libro AND ec.expediente = x->>'id' AND ec.user_id = ANY (v_users))
      ) ORDER BY o)
      FROM expedientes_contenido e, jsonb_array_elements(e.datos->'expedientes') WITH ORDINALITY t(x, o)
      WHERE e.libro_id = v_libro), '[]'::jsonb)
  );
END;
$fn$;


-- La de la 095: precio de 1 a 9.999 y el límite 'bote'.
CREATE OR REPLACE FUNCTION public.recompensa_crear(p_aula uuid, p_titulo text, p_precio int, p_limite text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  PERFORM _profe_de_aula(p_aula);
  IF length(btrim(coalesce(p_titulo, ''))) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Escribe qué es (de 3 a 120 letras).';
  END IF;
  IF p_precio IS NULL OR p_precio NOT BETWEEN 1 AND 9999 THEN
    RAISE EXCEPTION 'El precio va de 1 a 9999 ovillos.';
  END IF;
  IF p_limite NOT IN ('alumno', 'semana', 'clase', 'libre', 'bote') THEN
    RAISE EXCEPTION 'Límite no válido.';
  END IF;
  IF (SELECT count(*) FROM recompensas WHERE aula_id = p_aula) >= 30 THEN
    RAISE EXCEPTION 'Máximo 30 recompensas por aula. Borra o reutiliza alguna.';
  END IF;

  INSERT INTO recompensas (aula_id, titulo, precio, limite, creada_por)
  VALUES (p_aula, btrim(p_titulo), p_precio, p_limite, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;


-- La de la 095. Un bote sin entregar sí se puede borrar: antes se le
-- devuelve a cada alumno lo que puso. Uno entregado no (se apaga).
CREATE OR REPLACE FUNCTION public.recompensa_borrar(p_recompensa uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_r record;
  v_a record;
BEGIN
  SELECT aula_id, limite, entregado_at INTO v_r FROM recompensas WHERE id = p_recompensa;
  IF v_r.aula_id IS NULL THEN RAISE EXCEPTION 'Esa recompensa no existe.'; END IF;
  PERFORM _profe_de_aula(v_r.aula_id);

  IF v_r.limite = 'bote' THEN
    IF v_r.entregado_at IS NOT NULL THEN
      RAISE EXCEPTION 'Ese bote ya se entregó: apágalo en vez de borrarlo.';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('recompensa:' || p_recompensa));
    FOR v_a IN
      SELECT user_id, libro_id, sum(cantidad)::int AS total FROM recompensas_aportes
      WHERE recompensa_id = p_recompensa GROUP BY user_id, libro_id ORDER BY user_id
    LOOP
      PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_a.user_id || ':' || v_a.libro_id));
      INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
      VALUES (v_a.user_id, v_a.libro_id, v_a.total, 'recompensa', p_recompensa,
              jsonb_build_object('bote', p_recompensa, 'devuelto', true));
    END LOOP;
    DELETE FROM recompensas WHERE id = p_recompensa;   -- los aportes se van con él (CASCADE)
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM recompensas_canjes WHERE recompensa_id = p_recompensa) THEN
    RAISE EXCEPTION 'Ya la canjearon: apágala en vez de borrarla.';
  END IF;
  DELETE FROM recompensas WHERE id = p_recompensa;
END;
$fn$;


-- El profe entregó el bote lleno.
CREATE OR REPLACE FUNCTION public.bote_entregar(p_recompensa uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_r record;
BEGIN
  SELECT aula_id, limite, precio, entregado_at INTO v_r FROM recompensas WHERE id = p_recompensa;
  IF v_r.aula_id IS NULL THEN RAISE EXCEPTION 'Esa recompensa no existe.'; END IF;
  PERFORM _profe_de_aula(v_r.aula_id);
  IF v_r.limite <> 'bote' THEN RAISE EXCEPTION 'Eso no es un bote.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('recompensa:' || p_recompensa));
  IF v_r.entregado_at IS NOT NULL THEN RAISE EXCEPTION 'Este bote ya estaba entregado.'; END IF;
  IF _bote_juntado(p_recompensa) < v_r.precio THEN RAISE EXCEPTION 'El bote todavía no está lleno.'; END IF;
  UPDATE recompensas SET entregado_at = now() WHERE id = p_recompensa;
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 5. «Descargar mis datos»: la de la 096 con los aportes a botes
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mis_datos_juegos()
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
    'ovillos',              (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM ovillos_movimientos t WHERE t.user_id = v_user),
    'mesa_investigacion',   (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM anderson_jugadas t WHERE t.user_id = v_user),
    'corazonadas',          (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM corazonadas_jugadas t WHERE t.user_id = v_user),
    'concurso',             (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM concurso_jugadas t WHERE t.user_id = v_user),
    'mapa_del_tesoro',      (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM mapa_jugadas t WHERE t.user_id = v_user),
    -- La charla entera, con la nota, el comentario y el resumen; sin quién la calificó.
    'desafio',              (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - 'nota_por' ORDER BY t.created_at), '[]'::jsonb)
                             FROM desafio_charlas t WHERE t.user_id = v_user),
    'expedientes_comprados', (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM expedientes_compras t WHERE t.user_id = v_user),
    -- Sin quién del colegio lo entregó.
    'vales_canjeados',      (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - 'resuelto_por' ORDER BY t.created_at), '[]'::jsonb)
                             FROM recompensas_canjes t WHERE t.user_id = v_user),
    -- 097: lo que puso en botes de la clase, con el nombre del bote.
    'aportes_a_botes',      (SELECT coalesce(jsonb_agg(jsonb_build_object('bote', r.titulo, 'cantidad', t.cantidad,
                                                                          'libro_id', t.libro_id, 'fecha', t.created_at)
                                                       ORDER BY t.created_at), '[]'::jsonb)
                             FROM recompensas_aportes t JOIN recompensas r ON r.id = t.recompensa_id
                             WHERE t.user_id = v_user),
    -- Solo la hora: cuántas veces se le pidió a la IA (para los topes diarios).
    'llamadas_ia_concurso', (SELECT coalesce(jsonb_agg(t.created_at ORDER BY t.created_at), '[]'::jsonb)
                             FROM concurso_llamadas t WHERE t.user_id = v_user),
    'llamadas_ia_desafio',  (SELECT coalesce(jsonb_agg(t.created_at ORDER BY t.created_at), '[]'::jsonb)
                             FROM desafio_llamadas t WHERE t.user_id = v_user)
  );
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 6. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._referencia_ovillos(uuid, jsonb)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bote_juntado(uuid)                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._recompensa_bloqueo(uuid, uuid, uuid)   FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tienda_recompensas(uuid)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompensa_canjear(uuid)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompensa_aportar(uuid, int)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompensas_aula(uuid)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompensa_crear(uuid, text, int, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompensa_borrar(uuid)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bote_entregar(uuid)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mis_datos_juegos()                      FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.tienda_recompensas(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompensa_canjear(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompensa_aportar(uuid, int)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompensas_aula(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompensa_crear(uuid, text, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompensa_borrar(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.bote_entregar(uuid)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_datos_juegos()                      TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- PRUEBAS (en el SQL Editor)
-- ═════════════════════════════════════════════════════════════
--   1. SELECT _referencia_ovillos(id, '{}') FROM libros WHERE titulo ILIKE 'El signo%';
--      → solo_leyendo 34, maximo 192 (mesa 28, corazonadas 27, mapa 49, concurso 54).
--   2. Con '{"concurso": false}' → maximo 138 y apagados ["concurso"].
--   3. Profe: recompensa_crear(aula, 'Ver la película', 500, 'bote'); alumno:
--      recompensa_aportar(id, 20) → saldo −20, juntado 20. Al llegar a 500
--      sale en botes_por_entregar; bote_entregar(id) lo cierra.
--   4. Profe borra un bote a medias → cada alumno recupera lo suyo.
