-- =============================================================
-- INMERSIA — Migración 099
-- El falsificador (segundo juego de no ficción)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere de la 087 a la 098 (ovillos, juegos encendidos, vista del profe,
-- referencia de ovillos, mis_datos_juegos con la cápsula).
--
-- QUÉ HAY (decisiones de Juan, 10 nov 2026; reglas del contenido en
-- Documentation/colegios/falsificador-prompt.md)
--   · En el libro hay párrafos sospechosos: la mitad los escribió Claude
--     imitando al autor (falsos, que el lector mete en el capítulo) y la
--     otra mitad son del libro (reales). 8 por libro.
--   · Al intentar pasar la página se apagan las luces y se pregunta
--     «¿Quién escribió este párrafo?»: el autor o el gato. Sin «Ahora no».
--   · Acierto +1 ovillo; fallo −1 (si tiene alguno: el saldo no baja de 0).
--   · Al responder se revela todo: si era falso, «lo raro» y «lo que dice el
--     libro»; si era real, qué dice el autor ahí. El falso queda tachado.
--   · El profe ve por alumno «pilló X de N trampas» y «confió en el autor
--     X de N veces», y el párrafo que más engañó a la clase.
--
--   · falsificador_contenido: los sospechosos de cada libro (una fila por
--     libro). Lo sube cargar_falsificador.py. Nadie lo lee directamente.
--   · falsificador_jugadas: una fila por alumno y sospechoso (no se cambia).
--
-- QUIÉN LLAMA A QUÉ (el navegador)
--   Alumno: falsificador_libro, falsificador_responder.
--   Profe:  falsificador_aula.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═════════════════════════════════════════════════════════════

-- datos: {autor: 'Menger', items: [{id, cap, parrafo, falso, inicio, texto?, raro?, verdad}]}
--   parrafo: parrafos.numero. En un falso, el párrafo DESPUÉS del cual va;
--            en un real, el párrafo mismo.
--   inicio:  las primeras palabras (para el profe).
--   texto/raro: solo los falsos.
CREATE TABLE IF NOT EXISTS public.falsificador_contenido (
  libro_id       uuid        PRIMARY KEY REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL DEFAULT 1 CHECK (version >= 1),
  datos          jsonb       NOT NULL,
  actualizado_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(datos->'items') = 'array' AND jsonb_array_length(datos->'items') BETWEEN 1 AND 16)
);
COMMENT ON TABLE public.falsificador_contenido IS
  'Párrafos sospechosos del falsificador de cada libro (los sube cargar_falsificador.py). Solo los leen las funciones falsificador_*. Ver migración 099.';
-- Sin políticas: solo lo leen las funciones SECURITY DEFINER.
ALTER TABLE public.falsificador_contenido ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.falsificador_jugadas (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id   uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  item       text        NOT NULL,
  dijo       text        NOT NULL CHECK (dijo IN ('autor', 'gato')),
  acierto    boolean     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, libro_id, item)
);
COMMENT ON TABLE public.falsificador_jugadas IS
  'Falsificador: qué respondió cada alumno en cada párrafo sospechoso (una vez, no se cambia). Solo escribe falsificador_responder. Ver migración 099.';
ALTER TABLE public.falsificador_jugadas ENABLE ROW LEVEL SECURITY;

-- Los ovillos del falsificador van al libro de cuentas común (087).
ALTER TABLE public.ovillos_movimientos DROP CONSTRAINT IF EXISTS ovillos_movimientos_motivo_check;
ALTER TABLE public.ovillos_movimientos ADD CONSTRAINT ovillos_movimientos_motivo_check CHECK (motivo IN (
  'mesa_jugar', 'mesa_premio', 'corazonada', 'concurso', 'tesoro',
  'comodin', 'pista_gato', 'expediente', 'recompensa', 'falsificador'));


-- ═════════════════════════════════════════════════════════════
-- 2. Lo que ve el alumno
-- ═════════════════════════════════════════════════════════════
-- null si el libro no tiene falsificador.
--   {saldo, autor, items: [{id, cap, parrafo, texto?, respuesta?}]}
--   texto: solo los falsos (el lector lo mete en el capítulo).
--   respuesta (ya contestado): {dijo, acierto, falso, raro?, verdad}.
--   Antes de contestar no sale ni «falso», ni «raro», ni «verdad».
CREATE OR REPLACE FUNCTION public._falsificador_estado(p_user uuid, p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_datos jsonb;
BEGIN
  SELECT datos INTO v_datos FROM falsificador_contenido WHERE libro_id = p_libro;
  IF v_datos IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'saldo', _ovillos_saldo(p_user, p_libro),
    'autor', v_datos->'autor',
    'items', coalesce((
      SELECT jsonb_agg(
               jsonb_build_object('id', x->>'id', 'cap', (x->>'cap')::int, 'parrafo', (x->>'parrafo')::int)
               || CASE WHEN (x->>'falso')::boolean THEN jsonb_build_object('texto', x->>'texto') ELSE '{}'::jsonb END
               || CASE WHEN j.id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('respuesta',
                    jsonb_strip_nulls(jsonb_build_object('dijo', j.dijo, 'acierto', j.acierto,
                      'falso', (x->>'falso')::boolean, 'raro', x->>'raro', 'verdad', x->>'verdad'))) END
               ORDER BY o)
      FROM jsonb_array_elements(v_datos->'items') WITH ORDINALITY AS t(x, o)
      LEFT JOIN falsificador_jugadas j
        ON j.user_id = p_user AND j.libro_id = p_libro AND j.item = x->>'id'), '[]'::jsonb));
END;
$fn$;


CREATE OR REPLACE FUNCTION public.falsificador_libro(p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _falsificador_estado(auth.uid(), p_libro);
END;
$fn$;


-- Responder: p_dice = 'autor' | 'gato'. Una sola vez por párrafo.
--   {acierto, premio (+1, −1 o 0), estado}
CREATE OR REPLACE FUNCTION public.falsificador_responder(p_libro uuid, p_item text, p_dice text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user   uuid := auth.uid();
  v_x      jsonb;
  v_ok     boolean;
  v_premio int;
  v_id     uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  IF p_dice NOT IN ('autor', 'gato') THEN
    RAISE EXCEPTION 'Respuesta no válida.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('falsificador:' || v_user || ':' || p_libro));

  SELECT x INTO v_x
  FROM falsificador_contenido c, jsonb_array_elements(c.datos->'items') x
  WHERE c.libro_id = p_libro AND x->>'id' = p_item;
  IF v_x IS NULL THEN
    RAISE EXCEPTION 'Ese párrafo no está en el juego.';
  END IF;
  IF EXISTS (SELECT 1 FROM falsificador_jugadas WHERE user_id = v_user AND libro_id = p_libro AND item = p_item) THEN
    RAISE EXCEPTION 'ya_respondido';
  END IF;

  v_ok := (p_dice = 'gato') = (v_x->>'falso')::boolean;
  INSERT INTO falsificador_jugadas (user_id, libro_id, item, dijo, acierto)
  VALUES (v_user, p_libro, p_item, p_dice, v_ok)
  RETURNING id INTO v_id;

  -- Acierto +1. Fallo −1, solo si le queda alguno (el saldo no baja de 0).
  v_premio := CASE WHEN v_ok THEN 1 WHEN _ovillos_saldo(v_user, p_libro) >= 1 THEN -1 ELSE 0 END;
  IF v_premio <> 0 THEN
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
    VALUES (v_user, p_libro, v_premio, 'falsificador', v_id, jsonb_build_object('item', p_item));
  END IF;

  RETURN jsonb_build_object('acierto', v_ok, 'premio', v_premio,
                            'estado', _falsificador_estado(v_user, p_libro));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Lo que ve el profe
-- ═════════════════════════════════════════════════════════════
--   {libro_id, encendido, autor, items: [{id, cap, falso, inicio}] | null,
--    jugadas: {user_id: {item: acierto}}}
CREATE OR REPLACE FUNCTION public.falsificador_aula(p_aula uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_libro uuid;
  v_datos jsonb;
BEGIN
  PERFORM _profe_de_aula(p_aula);
  SELECT libro_id INTO v_libro FROM _meta_aula(p_aula, 'UTC');
  IF v_libro IS NULL THEN
    RETURN jsonb_build_object('libro_id', NULL);
  END IF;
  SELECT datos INTO v_datos FROM falsificador_contenido WHERE libro_id = v_libro;

  RETURN jsonb_build_object(
    'libro_id', v_libro,
    'encendido', (_juegos_mezclar(_juegos_aula_por_defecto(),
                                  (SELECT juegos FROM comunidades WHERE id = p_aula))->>'falsificador')::boolean,
    'autor', v_datos->'autor',
    'items', (SELECT jsonb_agg(jsonb_build_object('id', x->>'id', 'cap', (x->>'cap')::int,
                                                  'falso', (x->>'falso')::boolean, 'inicio', x->>'inicio') ORDER BY o)
              FROM jsonb_array_elements(v_datos->'items') WITH ORDINALITY AS t(x, o)),
    'jugadas', coalesce((
      SELECT jsonb_object_agg(s.user_id, s.porItem)
      FROM (SELECT j.user_id, jsonb_object_agg(j.item, j.acierto) AS porItem
            FROM falsificador_jugadas j
            JOIN comunidad_miembros cm ON cm.user_id = j.user_id AND cm.comunidad_id = p_aula AND cm.rol = 'miembro'
            WHERE j.libro_id = v_libro
            GROUP BY j.user_id) s), '{}'::jsonb));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. La cuenta de ovillos del libro: la de la 097 con el falsificador
-- ═════════════════════════════════════════════════════════════
-- Máximo del falsificador = 1 por párrafo (acertarlos todos). Apagado por
-- defecto en las aulas: solo cuenta si el profe lo enciende.

CREATE OR REPLACE FUNCTION public._referencia_ovillos(p_libro uuid, p_juegos jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  -- En un aula, el juego que el profe no tocó va como en _juegos_aula_por_defecto (093/098).
  v_on    jsonb := _juegos_mezclar(_juegos_aula_por_defecto(), coalesce(p_juegos, '{}'::jsonb));
  v_leer  int;
  v_mesa  int;
  v_cz    int;
  v_mapa  int;
  v_fx    int;
  v_cc    int := 0;
  v_ccmin int := 0;
  v_ccmax int := 0;
  v_apag  text[] := '{}';
BEGIN
  v_leer := 10 + 2 * (SELECT count(*) FROM capitulos WHERE libro_id = p_libro)::int;

  v_mesa := coalesce((SELECT jsonb_array_length(datos->'rasgos') * 2 FROM anderson_contenido WHERE libro_id = p_libro), 0);
  v_cz   := coalesce((SELECT jsonb_array_length(datos->'corazonadas') * 3 FROM corazonadas_contenido WHERE libro_id = p_libro), 0);
  v_mapa := coalesce((SELECT jsonb_array_length(datos->'tesoros') FROM mapa_contenido WHERE libro_id = p_libro), 0);
  v_fx   := coalesce((SELECT jsonb_array_length(datos->'items') FROM falsificador_contenido WHERE libro_id = p_libro), 0);
  SELECT coalesce(round(sum(CASE WHEN n >= 2 THEN 1.5 ELSE 1 END) * 3), 0)::int,
         coalesce(count(*) * 3, 0)::int,
         coalesce(sum(least(n, 2)) * 3, 0)::int
  INTO v_cc, v_ccmin, v_ccmax
  FROM (SELECT f->>'cap' AS cap, count(*) AS n
        FROM concurso_contenido c, jsonb_array_elements(c.datos->'frases') f
        WHERE c.libro_id = p_libro GROUP BY 1) s;

  IF NOT (v_on->>'mesa')::boolean         AND v_mesa > 0 THEN v_apag := v_apag || 'mesa'::text;         v_mesa := 0; END IF;
  IF NOT (v_on->>'corazonadas')::boolean  AND v_cz   > 0 THEN v_apag := v_apag || 'corazonadas'::text;  v_cz   := 0; END IF;
  IF NOT (v_on->>'mapa')::boolean         AND v_mapa > 0 THEN v_apag := v_apag || 'mapa'::text;         v_mapa := 0; END IF;
  IF NOT (v_on->>'falsificador')::boolean AND v_fx   > 0 THEN v_apag := v_apag || 'falsificador'::text; v_fx   := 0; END IF;
  IF NOT (v_on->>'concurso')::boolean     AND v_cc   > 0 THEN
    v_apag := v_apag || 'concurso'::text; v_cc := 0; v_ccmin := 0; v_ccmax := 0;
  END IF;

  RETURN jsonb_build_object(
    'solo_leyendo', v_leer,
    'maximo', v_leer + v_mesa + v_cz + v_mapa + v_cc + v_fx,
    'desglose', jsonb_build_object('lectura', v_leer, 'mesa', v_mesa, 'corazonadas', v_cz,
                                   'mapa', v_mapa, 'concurso', v_cc, 'falsificador', v_fx),
    'concurso_rango', jsonb_build_array(v_ccmin, v_ccmax),
    'apagados', to_jsonb(v_apag));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 5. «Descargar mis datos»: la de la 098 con el falsificador
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
    -- 098: las preguntas y lo que respondió al empezar y al terminar.
    'capsula_del_tiempo',   (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.sellada_at), '[]'::jsonb)
                             FROM capsula_respuestas t WHERE t.user_id = v_user),
    -- 099: qué dijo en cada párrafo sospechoso y si acertó.
    'falsificador',         (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM falsificador_jugadas t WHERE t.user_id = v_user),
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

REVOKE ALL ON FUNCTION public._falsificador_estado(uuid, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._referencia_ovillos(uuid, jsonb)              FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.falsificador_libro(uuid)                      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.falsificador_responder(uuid, text, text)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.falsificador_aula(uuid)                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mis_datos_juegos()                            FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.falsificador_libro(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.falsificador_responder(uuid, text, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.falsificador_aula(uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_datos_juegos()                         TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- PRUEBAS (en el SQL Editor)
-- ═════════════════════════════════════════════════════════════
--   1. Con un libro cargado (cargar_falsificador.py):
--      SELECT datos FROM falsificador_contenido c JOIN libros l ON l.id = c.libro_id WHERE l.titulo ILIKE 'Del origen%';
--   2. Alumno: falsificador_libro(libro) → items sin «falso» ni «verdad»; los falsos con texto.
--      falsificador_responder(libro, 'f1', 'gato') → acierto true, premio 1; el item ya trae la respuesta.
--      Otra vez → 'ya_respondido'. Un fallo con saldo 0 → premio 0.
--   3. Profe: falsificador_aula(aula) → jugadas de sus alumnos.
