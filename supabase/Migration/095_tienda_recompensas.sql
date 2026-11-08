-- =============================================================
-- INMERSIA — Migración 095
-- Tienda de recompensas: expedientes de Inmersia y vales del profe
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 087 (ovillos_movimientos, _ovillos_saldo) y la 094
-- (_profe_de_aula). También la 084 (_meta_aula).
--
-- QUÉ HAY (decisiones de Juan, 6 nov 2026, maqueta 5YpgxrcjrXGv2QGQo5SLAX)
--   · La tienda es el local de la izquierda en la calle de la Tienda.
--     Dos estantes: «De tu profe» (vales que crea el profe en el Salón) y
--     «Expedientes» (de autor y época, los pone Inmersia por libro).
--   · Se paga con los ovillos de UN libro: el libro de cuentas es por
--     libro (087). Los vales del profe se pagan con el libro que lee el
--     aula en ese momento; los expedientes, con el libro al que
--     pertenecen. La tienda siempre está abierta: gastar es decisión
--     del alumno (antes de canjear se le avisa cuántos le quedan).
--   · Un expediente se compra una vez y queda para siempre.
--   · Cada vale tiene un límite: 'alumno' (una vez por alumno en cada
--     libro), 'semana' (una vez cada 7 días por alumno), 'clase' (uno
--     solo en toda la clase en cada libro) o 'libre'.
--   · El canje del profe queda «pendiente» hasta que lo marca
--     «entregado». Si no puede darlo, «devolver» le regresa los ovillos.
--   · El profe apaga un vale sin borrarlo. Solo se borra si nadie lo
--     canjeó (si no, se perdería el historial de quién lo tuvo).
--
-- PRIVACIDAD
--   El profe ve quién canjeó cada vale (tiene que entregarlo). De los
--   expedientes, solo cuántos alumnos lo abrieron, sin nombres.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- Contenido: Documents/scripts ficcion/cargar_expedientes.py.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.expedientes_contenido (
  libro_id       uuid        PRIMARY KEY REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL DEFAULT 1 CHECK (version >= 1),
  datos          jsonb       NOT NULL,   -- {expedientes: [{id, titulo, descripcion, precio, parrafos: [texto]}]}
  actualizado_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.expedientes_contenido IS
  'Expedientes de autor y época de cada libro (JSON de cargar_expedientes.py). Solo lo leen las funciones de la tienda: el texto se entrega a quien lo compró. Los ids no se cambian una vez publicado. Ver migración 095.';

-- Sin políticas: solo lo leen las funciones SECURITY DEFINER.
ALTER TABLE public.expedientes_contenido ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.expedientes_compras (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id    uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  expediente  text        NOT NULL,
  precio      int         NOT NULL CHECK (precio >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, libro_id, expediente)
);

CREATE INDEX IF NOT EXISTS idx_expedientes_compras_libro ON public.expedientes_compras (libro_id, expediente);

COMMENT ON TABLE public.expedientes_compras IS
  'Expedientes que compró cada alumno (una vez cada uno). Solo escribe expediente_comprar. Ver migración 095.';

ALTER TABLE public.expedientes_compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expedientes_compras_select_own" ON public.expedientes_compras;
CREATE POLICY "expedientes_compras_select_own" ON public.expedientes_compras
  FOR SELECT TO authenticated USING (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS public.recompensas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id     uuid        NOT NULL REFERENCES public.comunidades(id) ON DELETE CASCADE,
  titulo      text        NOT NULL CHECK (length(btrim(titulo)) BETWEEN 3 AND 120),
  precio      int         NOT NULL CHECK (precio BETWEEN 1 AND 999),
  limite      text        NOT NULL DEFAULT 'alumno' CHECK (limite IN ('alumno', 'semana', 'clase', 'libre')),
  activa      boolean     NOT NULL DEFAULT true,
  creada_por  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recompensas_aula ON public.recompensas (aula_id);

COMMENT ON TABLE public.recompensas IS
  'Vales que el profe ofrece a su aula en la tienda de recompensas («2 puntos en el examen»). Solo escriben las funciones recompensa_*. Ver migración 095.';

-- Sin políticas: se leen por tienda_recompensas y recompensas_aula.
ALTER TABLE public.recompensas ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.recompensas_canjes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recompensa_id uuid        NOT NULL REFERENCES public.recompensas(id) ON DELETE CASCADE,
  aula_id       uuid        NOT NULL REFERENCES public.comunidades(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id      uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  titulo        text        NOT NULL,   -- copia: lo que canjeó, aunque el profe cambie el vale
  precio        int         NOT NULL CHECK (precio >= 1),
  estado        text        NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'entregado', 'devuelto')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  resuelto_at   timestamptz,
  resuelto_por  uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_canjes_recompensa ON public.recompensas_canjes (recompensa_id, libro_id);
CREATE INDEX IF NOT EXISTS idx_canjes_aula       ON public.recompensas_canjes (aula_id, estado);
CREATE INDEX IF NOT EXISTS idx_canjes_user       ON public.recompensas_canjes (user_id, libro_id);

COMMENT ON TABLE public.recompensas_canjes IS
  'Cada canje de un vale del profe. Pendiente → entregado (o devuelto, con los ovillos de vuelta). Ver migración 095.';

ALTER TABLE public.recompensas_canjes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recompensas_canjes_select_own" ON public.recompensas_canjes;
CREATE POLICY "recompensas_canjes_select_own" ON public.recompensas_canjes
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- ═════════════════════════════════════════════════════════════
-- 2. Uso interno
-- ═════════════════════════════════════════════════════════════

-- Nombre del alumno en el aula (igual que el resto del Salón).
CREATE OR REPLACE FUNCTION public._nombre_en_aula(p_aula uuid, p_user uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce(
    (SELECT coalesce(m.nombre_en_aula, nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''))
     FROM comunidad_miembros m LEFT JOIN perfiles pf ON pf.id = m.user_id
     WHERE m.comunidad_id = p_aula AND m.user_id = p_user),
    'Lector');
$fn$;


-- ¿Se puede canjear este vale ahora? NULL = sí; si no, el motivo:
--   'ya_canjeado' (límite alumno), 'esta_semana' (límite semana), 'agotado' (límite clase).
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
    ELSE NULL END
  FROM recompensas r WHERE r.id = p_rec;
$fn$;


-- Aulas (de colegio) donde el usuario es alumno.
CREATE OR REPLACE FUNCTION public._aulas_de_alumno(p_user uuid)
RETURNS TABLE (aula_id uuid, nombre text, libro_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT co.id, co.nombre, co.libro_id
  FROM comunidad_miembros m JOIN comunidades co ON co.id = m.comunidad_id
  WHERE m.user_id = p_user AND m.rol = 'miembro' AND co.colegio_id IS NOT NULL;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Lo que llama el alumno
-- ═════════════════════════════════════════════════════════════
-- tienda_recompensas(libro): todo lo de la tienda en una llamada.
--   libros:      [{id, titulo, de_aula}]  libros con los que puede pagar
--                (los de sus aulas y los de su biblioteca con expedientes)
--   libro_id:    el elegido (si no se pasa: el de su aula, o el primero)
--   saldo, solo_leyendo (10 + 2 × capítulos del libro: lo que da leer)
--   recompensas: [{id, titulo, precio, limite, aula, bloqueo, desde}]
--                bloqueo = null | 'ya_canjeado' | 'esta_semana' | 'agotado'
--                desde   = cuándo vuelve a estar disponible (límite semana)
--   expedientes: [{id, titulo, descripcion, precio, comprado}]
--   canjes:      [{tipo: 'vale'|'expediente', id, titulo, precio, estado, fecha}]

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
                     AND c.created_at > now() - interval '7 days') END
      ) ORDER BY r.precio, r.created_at)
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
      ) s), '[]'::jsonb)
  );
END;
$fn$;


-- Comprar un expediente: se paga con los ovillos de su libro, una sola vez.
CREATE OR REPLACE FUNCTION public.expediente_comprar(p_libro uuid, p_expediente text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user   uuid := auth.uid();
  v_precio int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Inicia sesión.' USING ERRCODE = '42501'; END IF;

  -- Una compra a la vez por alumno y libro (dos pestañas no gastan dos veces el mismo ovillo).
  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_user || ':' || p_libro));

  SELECT (x->>'precio')::int INTO v_precio
  FROM expedientes_contenido e, jsonb_array_elements(e.datos->'expedientes') x
  WHERE e.libro_id = p_libro AND x->>'id' = p_expediente;
  IF v_precio IS NULL THEN RAISE EXCEPTION 'Ese expediente no existe.'; END IF;

  IF EXISTS (SELECT 1 FROM expedientes_compras
             WHERE user_id = v_user AND libro_id = p_libro AND expediente = p_expediente) THEN
    RAISE EXCEPTION 'Ya tienes este expediente.';
  END IF;
  IF _ovillos_saldo(v_user, p_libro) < v_precio THEN
    RAISE EXCEPTION 'No te alcanzan los ovillos.';
  END IF;

  INSERT INTO expedientes_compras (user_id, libro_id, expediente, precio)
  VALUES (v_user, p_libro, p_expediente, v_precio);
  IF v_precio > 0 THEN
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, detalle)
    VALUES (v_user, p_libro, -v_precio, 'expediente', jsonb_build_object('expediente', p_expediente));
  END IF;

  RETURN jsonb_build_object('saldo', _ovillos_saldo(v_user, p_libro));
END;
$fn$;


-- El texto de un expediente: solo a quien lo compró.
CREATE OR REPLACE FUNCTION public.expediente_leer(p_libro uuid, p_expediente text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_exp  jsonb;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
       SELECT 1 FROM expedientes_compras
       WHERE user_id = v_user AND libro_id = p_libro AND expediente = p_expediente) THEN
    RAISE EXCEPTION 'Primero canjea este expediente.' USING ERRCODE = '42501';
  END IF;

  SELECT x INTO v_exp
  FROM expedientes_contenido e, jsonb_array_elements(e.datos->'expedientes') x
  WHERE e.libro_id = p_libro AND x->>'id' = p_expediente;

  RETURN jsonb_build_object('titulo', v_exp->>'titulo', 'descripcion', v_exp->>'descripcion',
                            'parrafos', coalesce(v_exp->'parrafos', '[]'::jsonb));
END;
$fn$;


-- Canjear un vale del profe: se paga con el libro que lee su aula ahora.
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


-- ═════════════════════════════════════════════════════════════
-- 4. Lo que llama el profe (pestaña «Recompensas» del Salón)
-- ═════════════════════════════════════════════════════════════
-- recompensas_aula(aula):
--   libro_id, alumnos (cuántos)
--   referencia: {solo_leyendo, jugando}  ovillos que junta un alumno en el
--               libro solo leyendo, y unos cuantos si juega todo y le va bien
--   recompensas: [{id, titulo, precio, limite, activa, canjes}]
--   pendientes:  [{id, alumno, titulo, precio, fecha}]
--   entregados:  [{id, alumno, titulo, precio, estado, fecha}]  últimos 30 días (entregados y devueltos)
--   expedientes: [{id, titulo, abrieron}]   del libro del aula, sin nombres

CREATE OR REPLACE FUNCTION public.recompensas_aula(p_aula uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_libro  uuid;
  v_users  uuid[];
  v_caps   int;
  v_jugar  int := 0;
BEGIN
  PERFORM _profe_de_aula(p_aula);

  SELECT libro_id INTO v_libro FROM comunidades WHERE id = p_aula;
  SELECT coalesce(array_agg(user_id), '{}') INTO v_users
  FROM comunidad_miembros WHERE comunidad_id = p_aula AND rol = 'miembro';

  IF v_libro IS NOT NULL THEN
    SELECT count(*) INTO v_caps FROM capitulos WHERE libro_id = v_libro;
    -- Lo más que se puede ganar jugando, a ojo: 3 por deducción de la mesa,
    -- 3 netos por corazonada (juega 3 y acierta), 1 por tesoro y 3 por
    -- frase difícil (a cada alumno le tocan 1 o 2 por capítulo con frases).
    v_jugar := v_jugar + coalesce((SELECT jsonb_array_length(datos->'rasgos') * 3 FROM anderson_contenido WHERE libro_id = v_libro), 0);
    v_jugar := v_jugar + coalesce((SELECT jsonb_array_length(datos->'corazonadas') * 3 FROM corazonadas_contenido WHERE libro_id = v_libro), 0);
    v_jugar := v_jugar + coalesce((SELECT jsonb_array_length(datos->'tesoros') FROM mapa_contenido WHERE libro_id = v_libro), 0);
    v_jugar := v_jugar + coalesce((SELECT round(count(DISTINCT f->>'cap') * 1.5 * 3)::int
                                   FROM concurso_contenido c, jsonb_array_elements(c.datos->'frases') f
                                   WHERE c.libro_id = v_libro), 0);
  END IF;

  RETURN jsonb_build_object(
    'libro_id', v_libro,
    'alumnos', cardinality(v_users),
    'referencia', CASE WHEN v_libro IS NULL THEN NULL ELSE jsonb_build_object(
      'solo_leyendo', 10 + 2 * v_caps,
      'jugando', 10 + 2 * v_caps + v_jugar) END,
    'recompensas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'titulo', r.titulo, 'precio', r.precio, 'limite', r.limite, 'activa', r.activa,
        'canjes', (SELECT count(*) FROM recompensas_canjes c WHERE c.recompensa_id = r.id AND c.estado <> 'devuelto')
      ) ORDER BY r.activa DESC, r.created_at)
      FROM recompensas r WHERE r.aula_id = p_aula), '[]'::jsonb),
    'pendientes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'alumno', _nombre_en_aula(p_aula, c.user_id), 'titulo', c.titulo,
        'precio', c.precio, 'fecha', c.created_at) ORDER BY c.created_at)
      FROM recompensas_canjes c WHERE c.aula_id = p_aula AND c.estado = 'pendiente'), '[]'::jsonb),
    'entregados', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'alumno', _nombre_en_aula(p_aula, c.user_id), 'titulo', c.titulo,
        'precio', c.precio, 'estado', c.estado, 'fecha', c.resuelto_at) ORDER BY c.resuelto_at DESC)
      FROM recompensas_canjes c WHERE c.aula_id = p_aula AND c.estado <> 'pendiente'
        AND c.resuelto_at > now() - interval '30 days'), '[]'::jsonb),
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


-- Crear un vale para la tienda del aula.
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
  IF p_precio IS NULL OR p_precio NOT BETWEEN 1 AND 999 THEN
    RAISE EXCEPTION 'El precio va de 1 a 999 ovillos.';
  END IF;
  IF p_limite NOT IN ('alumno', 'semana', 'clase', 'libre') THEN
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


-- Encender o apagar un vale (apagado no se ve en la tienda; no se borra).
CREATE OR REPLACE FUNCTION public.recompensa_activar(p_recompensa uuid, p_activa boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_aula uuid;
BEGIN
  SELECT aula_id INTO v_aula FROM recompensas WHERE id = p_recompensa;
  IF v_aula IS NULL THEN RAISE EXCEPTION 'Esa recompensa no existe.'; END IF;
  PERFORM _profe_de_aula(v_aula);
  UPDATE recompensas SET activa = coalesce(p_activa, false) WHERE id = p_recompensa;
END;
$fn$;


-- Borrar un vale: solo si nadie lo canjeó nunca.
CREATE OR REPLACE FUNCTION public.recompensa_borrar(p_recompensa uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_aula uuid;
BEGIN
  SELECT aula_id INTO v_aula FROM recompensas WHERE id = p_recompensa;
  IF v_aula IS NULL THEN RAISE EXCEPTION 'Esa recompensa no existe.'; END IF;
  PERFORM _profe_de_aula(v_aula);
  IF EXISTS (SELECT 1 FROM recompensas_canjes WHERE recompensa_id = p_recompensa) THEN
    RAISE EXCEPTION 'Ya la canjearon: apágala en vez de borrarla.';
  END IF;
  DELETE FROM recompensas WHERE id = p_recompensa;
END;
$fn$;


-- Resolver un canje pendiente: 'entregado', o 'devuelto' (los ovillos vuelven al alumno).
CREATE OR REPLACE FUNCTION public.canje_resolver(p_canje uuid, p_estado text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_c record;
BEGIN
  IF p_estado NOT IN ('entregado', 'devuelto') THEN RAISE EXCEPTION 'Estado no válido.'; END IF;
  SELECT * INTO v_c FROM recompensas_canjes WHERE id = p_canje;
  IF v_c.id IS NULL THEN RAISE EXCEPTION 'Ese canje no existe.'; END IF;
  PERFORM _profe_de_aula(v_c.aula_id);

  PERFORM pg_advisory_xact_lock(hashtext('ovillos:' || v_c.user_id || ':' || v_c.libro_id));
  UPDATE recompensas_canjes SET estado = p_estado, resuelto_at = now(), resuelto_por = auth.uid()
  WHERE id = p_canje AND estado = 'pendiente';
  IF NOT FOUND THEN RAISE EXCEPTION 'Este canje ya estaba resuelto.'; END IF;

  IF p_estado = 'devuelto' THEN
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
    VALUES (v_c.user_id, v_c.libro_id, v_c.precio, 'recompensa', v_c.id, jsonb_build_object('devuelto', true));
  END IF;
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 5. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._nombre_en_aula(uuid, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._recompensa_bloqueo(uuid, uuid, uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._aulas_de_alumno(uuid)                   FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tienda_recompensas(uuid)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expediente_comprar(uuid, text)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expediente_leer(uuid, text)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompensa_canjear(uuid)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompensas_aula(uuid)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompensa_crear(uuid, text, int, text)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompensa_activar(uuid, boolean)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompensa_borrar(uuid)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.canje_resolver(uuid, text)               FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.tienda_recompensas(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.expediente_comprar(uuid, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.expediente_leer(uuid, text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompensa_canjear(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompensas_aula(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompensa_crear(uuid, text, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompensa_activar(uuid, boolean)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompensa_borrar(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.canje_resolver(uuid, text)              TO authenticated;
