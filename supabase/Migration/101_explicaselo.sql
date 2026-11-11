-- =============================================================
-- INMERSIA — Migración 101
-- Explícaselo a… (cuarto juego de no ficción)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere de la 087 a la 100 (ovillos, juegos encendidos, desafío con sus
-- topes de IA, vista del profe, referencia de ovillos, mis_datos_juegos).
--
-- QUÉ HAY (decisiones de Juan, 10–11 nov 2026; reglas del contenido en
-- Documentation/colegios/explicaselo-prompt.md)
--   · Dos momentos por libro, como el Desafío: 'mitad' y 'final'. En cada uno
--     hay UNA idea del libro que explicar (consigna, 4 puntos clave, una
--     explicación de referencia y las palabras que el marciano no entiende).
--   · Una ruleta de 6 personajes fijos (los mismos en todos los libros):
--       abuela, primo (6 años), pirata (no más de 3 frases), marciano (no
--       entiende un concepto del libro: no se pueden usar esas palabras),
--       ceo (Kevin Escalada, CEO de Sinergix: véndele la idea aplicada a un
--       producto), granjero (medieval: nada posterior al año 1500).
--     La ruleta la gira el SERVIDOR (el alumno no elige al fácil). El primer
--     giro es gratis; volver a girar, 1 ovillo. Una vez escrito el primer
--     mensaje, el personaje ya no cambia.
--   · Como mucho 2 mensajes del alumno. Tras el primero el personaje pregunta
--     por lo que le faltó (o se da por entendido si estaban los 4 puntos);
--     tras el segundo, siempre veredicto.
--   · Veredicto: «lo entendió» (4 puntos) +3 ovillos; «casi» (2 o 3) +1;
--     «se quedó igual» (0 o 1) nada. Romper la regla del personaje deja el
--     veredicto en «casi» como mucho. Si la IA falla al dar el veredicto,
--     «casi» (no se castiga al alumno por un fallo nuestro).
--   · Las reglas que se pueden contar (las 3 frases del pirata y las
--     palabras del marciano) las comprueba la base de datos ANTES de llamar
--     a la IA; el navegador avisa antes de enviar.
--   · Se guarda lo que escribe el alumno: el profe lee la charla (y el
--     alumno lo sabe, como en el Desafío).
--   · Los topes de gasto de IA son los del Desafío y se COMPARTEN: las
--     llamadas van a desafio_llamadas (columna `juego`), 12 por alumno y día,
--     1.000 en toda la app.
--
--   · explicaselo_contenido: una fila por libro (la sube cargar_explicaselo.py).
--   · explicaselo_charlas: una fila por alumno, libro y momento.
--
-- QUIÉN LLAMA A QUÉ
--   Alumno (navegador): explicaselo_libro, explicaselo_girar.
--   Servidor (función explicaselo-evaluar, service_role): explicaselo_reservar
--     → Gemini → explicaselo_responder.
--   Profe: explicaselo_aula.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═════════════════════════════════════════════════════════════

-- datos: {momentos: [{momento: 'mitad'|'final', tras_capitulo, id, consigna,
--                     puntos: [{t, q}] (4; q = lo que pregunta el personaje si falta),
--                     referencia,
--                     prohibidas: {palabras: [para mostrar], raices: [minúsculas, sin tildes]}}]}
CREATE TABLE IF NOT EXISTS public.explicaselo_contenido (
  libro_id       uuid        PRIMARY KEY REFERENCES public.libros(id) ON DELETE CASCADE,
  version        int         NOT NULL DEFAULT 1 CHECK (version >= 1),
  datos          jsonb       NOT NULL,
  actualizado_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(datos->'momentos') = 'array' AND jsonb_array_length(datos->'momentos') BETWEEN 1 AND 2)
);
COMMENT ON TABLE public.explicaselo_contenido IS
  'Explícaselo: la idea de cada momento (mitad y final) de cada libro, con sus 4 puntos y la referencia (lo sube cargar_explicaselo.py). Solo lo leen las funciones explicaselo_*. Ver migración 101.';
-- Sin políticas: solo lo leen las funciones SECURITY DEFINER.
ALTER TABLE public.explicaselo_contenido ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.explicaselo_charlas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libro_id      uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  version       int         NOT NULL,
  momento       text        NOT NULL CHECK (momento IN ('mitad', 'final')),
  idea          text        NOT NULL,          -- id de la idea en el contenido
  personaje     text        NOT NULL CHECK (personaje IN ('abuela', 'primo', 'pirata', 'marciano', 'ceo', 'granjero')),
  giros         int         NOT NULL DEFAULT 1 CHECK (giros >= 1),
  -- ruleta = ya le tocó alguien pero aún no escribió (puede volver a girar)
  estado        text        NOT NULL DEFAULT 'ruleta' CHECK (estado IN ('ruleta', 'abierta', 'evaluando', 'terminada')),
  turnos        jsonb       NOT NULL DEFAULT '[]'::jsonb,   -- [{de: 'alumno'|'personaje', texto, at}]
  resultado     text        CHECK (resultado IN ('entendio', 'casi', 'igual')),
  puntos        jsonb,                          -- [bool × 4]: qué puntos tocó (lo dijo él)
  rompio_regla  boolean,
  para_el_profe text,
  plan_b        boolean     NOT NULL DEFAULT false,   -- el veredicto no lo dio la IA
  evaluando_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  terminada_at  timestamptz,
  UNIQUE (user_id, libro_id, momento),
  CHECK ((estado = 'terminada') = (terminada_at IS NOT NULL)),
  CHECK ((estado = 'terminada') = (resultado IS NOT NULL)),
  CHECK (jsonb_typeof(turnos) = 'array')
);
COMMENT ON TABLE public.explicaselo_charlas IS
  'Explícaselo: una fila por alumno, libro y momento, con el personaje que le tocó, la charla y el veredicto. Guarda el texto del alumno (lo lee su profe). Solo escriben las funciones explicaselo_*. Ver migración 101.';
ALTER TABLE public.explicaselo_charlas ENABLE ROW LEVEL SECURITY;


-- Los topes de IA se comparten con el Desafío: misma tabla, con el juego.
ALTER TABLE public.desafio_llamadas ADD COLUMN IF NOT EXISTS juego text NOT NULL DEFAULT 'desafio';
ALTER TABLE public.desafio_llamadas DROP CONSTRAINT IF EXISTS desafio_llamadas_juego_check;
ALTER TABLE public.desafio_llamadas ADD CONSTRAINT desafio_llamadas_juego_check CHECK (juego IN ('desafio', 'explicaselo'));
COMMENT ON TABLE public.desafio_llamadas IS
  'Una fila por cada llamada a la IA del desafío o de explícaselo (cuenta aunque falle). Los topes por alumno y por día son de las dos juntas. Ver migraciones 092 y 101.';

-- Los ovillos de explícaselo van al libro de cuentas común (087).
ALTER TABLE public.ovillos_movimientos DROP CONSTRAINT IF EXISTS ovillos_movimientos_motivo_check;
ALTER TABLE public.ovillos_movimientos ADD CONSTRAINT ovillos_movimientos_motivo_check CHECK (motivo IN (
  'mesa_jugar', 'mesa_premio', 'corazonada', 'concurso', 'tesoro',
  'comodin', 'pista_gato', 'expediente', 'recompensa', 'falsificador',
  'hilo_jugar', 'hilo_premio', 'hilo_ayuda',
  'explicaselo_girar', 'explicaselo_premio'));


-- ═════════════════════════════════════════════════════════════
-- 2. Uso interno
-- ═════════════════════════════════════════════════════════════

-- Los 6 personajes, en el orden de la ruleta (el mismo que src/utils/explicaselo.js).
CREATE OR REPLACE FUNCTION public._explicaselo_personajes()
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT ARRAY['abuela', 'primo', 'pirata', 'marciano', 'ceo', 'granjero'];
$fn$;

-- La idea de un momento (con tras_capitulo).
CREATE OR REPLACE FUNCTION public._explicaselo_idea(p_libro uuid, p_momento text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT m FROM explicaselo_contenido c, jsonb_array_elements(c.datos->'momentos') m
  WHERE c.libro_id = p_libro AND m->>'momento' = p_momento
  LIMIT 1;
$fn$;

-- Cuántas frases tiene un texto: trozos con letras o números entre . ! ?
-- (igual que contarFrases en src/utils/explicaselo.js). «…» no corta la frase
-- («Bien… y tú» es una); «¿» y «¡» no cuentan.
CREATE OR REPLACE FUNCTION public._explicaselo_frases(p_texto text)
RETURNS int
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT count(*)::int
  FROM regexp_split_to_table(coalesce(p_texto, ''), '[.!?]+') t
  WHERE t ~ '[[:alnum:]]';
$fn$;

-- La primera raíz prohibida que aparece al comienzo de una palabra (sin
-- mayúsculas ni tildes), o null. Igual que palabraProhibida en el navegador.
CREATE OR REPLACE FUNCTION public._explicaselo_prohibida(p_texto text, p_raices jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT r
  FROM jsonb_array_elements_text(coalesce(p_raices, '[]'::jsonb)) r
  WHERE r ~ '^[a-zñ]+$'
    AND translate(lower(coalesce(p_texto, '')), 'áéíóúüàèìòù', 'aeiouuaeiou') ~ ('(^|[^a-zñ0-9])' || r)
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public._explicaselo_turnos_alumno(p_turnos jsonb)
RETURNS int
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT count(*)::int FROM jsonb_array_elements(p_turnos) t WHERE t->>'de' = 'alumno';
$fn$;


-- Lo que ve el alumno. null si el libro no tiene explícaselo.
--   {version, max_turnos, con_profe, saldo,
--    momentos: [{momento, tras_capitulo, consigna, prohibidas: {palabras, raices},
--                estado: 'nueva'|'ruleta'|'abierta'|'evaluando'|'terminada',
--                personaje, giros, turnos: [{de, texto}],
--                al terminar: resultado, rompio_regla, puntos: [{t, cubierto}], referencia}]}
-- Los puntos y la referencia solo se ven con la charla terminada.
CREATE OR REPLACE FUNCTION public._explicaselo_estado(p_user uuid, p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ver int;
BEGIN
  SELECT version INTO v_ver FROM explicaselo_contenido WHERE libro_id = p_libro;
  IF v_ver IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'version', v_ver,
    'max_turnos', 2,
    'con_profe', EXISTS (SELECT 1 FROM comunidad_miembros cm JOIN comunidades co ON co.id = cm.comunidad_id
                         WHERE cm.user_id = p_user AND co.colegio_id IS NOT NULL AND co.libro_id = p_libro),
    'saldo', _ovillos_saldo(p_user, p_libro),
    'momentos', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'momento', m->>'momento',
          'tras_capitulo', (m->>'tras_capitulo')::int,
          'consigna', m->>'consigna',
          'prohibidas', coalesce(m->'prohibidas', '{"palabras": [], "raices": []}'::jsonb),
          'estado', coalesce(ch.estado, 'nueva'),
          'personaje', ch.personaje,
          'giros', coalesce(ch.giros, 0),
          'turnos', coalesce((SELECT jsonb_agg(jsonb_build_object('de', t->>'de', 'texto', t->>'texto') ORDER BY o)
                              FROM jsonb_array_elements(ch.turnos) WITH ORDINALITY x(t, o)), '[]'::jsonb))
        || CASE WHEN ch.estado = 'terminada' THEN jsonb_build_object(
             'resultado', ch.resultado,
             'rompio_regla', coalesce(ch.rompio_regla, false),
             'referencia', m->>'referencia',
             'puntos', (SELECT jsonb_agg(jsonb_build_object('t', p->>'t',
                                                            'cubierto', coalesce((ch.puntos->>((o - 1)::int))::boolean, false))
                                         ORDER BY o)
                        FROM jsonb_array_elements(m->'puntos') WITH ORDINALITY y(p, o)))
           ELSE '{}'::jsonb END
        ORDER BY CASE m->>'momento' WHEN 'mitad' THEN 1 ELSE 2 END)
      FROM explicaselo_contenido c
      CROSS JOIN LATERAL jsonb_array_elements(c.datos->'momentos') m
      LEFT JOIN explicaselo_charlas ch
        ON ch.user_id = p_user AND ch.libro_id = p_libro AND ch.momento = m->>'momento'
      WHERE c.libro_id = p_libro), '[]'::jsonb)
  );
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Lo que llama el alumno
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.explicaselo_libro(p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  RETURN _explicaselo_estado(auth.uid(), p_libro);
END;
$fn$;


-- Girar la ruleta. El primer giro es gratis; los siguientes cuestan 1 ovillo
-- (error 'sin_ovillos' si no le queda). Siempre sale alguien distinto del que
-- tenía. Solo antes del primer mensaje.
CREATE OR REPLACE FUNCTION public.explicaselo_girar(p_libro uuid, p_momento text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user  uuid := auth.uid();
  v_idea  jsonb;
  v_ch    explicaselo_charlas%ROWTYPE;
  v_todos text[] := _explicaselo_personajes();
  v_pj    text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('explicaselo:' || v_user || ':' || p_libro));

  v_idea := _explicaselo_idea(p_libro, p_momento);
  IF v_idea IS NULL THEN
    RAISE EXCEPTION 'Este libro no tiene explícaselo.';
  END IF;

  SELECT * INTO v_ch FROM explicaselo_charlas
  WHERE user_id = v_user AND libro_id = p_libro AND momento = p_momento FOR UPDATE;

  IF v_ch.id IS NULL THEN
    v_pj := v_todos[1 + floor(random() * array_length(v_todos, 1))::int];
    INSERT INTO explicaselo_charlas (user_id, libro_id, version, momento, idea, personaje)
    SELECT v_user, p_libro, c.version, p_momento, v_idea->>'id', v_pj
    FROM explicaselo_contenido c WHERE c.libro_id = p_libro;
  ELSIF v_ch.estado <> 'ruleta' THEN
    RAISE EXCEPTION 'Ya empezaste a explicárselo: el personaje no cambia.';
  ELSE
    IF _ovillos_saldo(v_user, p_libro) < 1 THEN
      RAISE EXCEPTION 'sin_ovillos';
    END IF;
    v_todos := array_remove(v_todos, v_ch.personaje);
    v_pj := v_todos[1 + floor(random() * array_length(v_todos, 1))::int];
    UPDATE explicaselo_charlas SET personaje = v_pj, giros = giros + 1 WHERE id = v_ch.id;
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
    VALUES (v_user, p_libro, -1, 'explicaselo_girar', v_ch.id,
            jsonb_build_object('momento', p_momento, 'giro', v_ch.giros + 1));
  END IF;

  RETURN jsonb_build_object('personaje', v_pj, 'estado', _explicaselo_estado(v_user, p_libro));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. Lo que llama la función del servidor (service_role)
-- ═════════════════════════════════════════════════════════════
-- p_user lo saca la función del servidor del token del alumno, ya verificado.

-- El alumno mandó un mensaje: comprueba todo (también la regla del pirata y
-- la del marciano), lo guarda, apunta la llamada y devuelve lo que la IA
-- necesita. Errores con mensaje fijo para que el servidor los traduzca:
--   'muy_corta', 'muy_larga', 'regla_frases', 'regla_palabra:<raíz>',
--   'limite_alumno', 'limite_global'.
CREATE OR REPLACE FUNCTION public.explicaselo_reservar(p_user uuid, p_libro uuid, p_momento text, p_texto text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_idea     jsonb;
  v_ch       explicaselo_charlas%ROWTYPE;
  v_turnos   jsonb;
  v_n        int;
  v_palabras int;
  v_raiz     text;
  v_hoy      timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('explicaselo:' || p_user || ':' || p_libro));

  v_idea := _explicaselo_idea(p_libro, p_momento);
  IF v_idea IS NULL THEN
    RAISE EXCEPTION 'Este libro no tiene explícaselo.';
  END IF;

  SELECT * INTO v_ch FROM explicaselo_charlas
  WHERE user_id = p_user AND libro_id = p_libro AND momento = p_momento FOR UPDATE;
  IF v_ch.id IS NULL THEN
    RAISE EXCEPTION 'Primero gira la ruleta.';
  END IF;
  IF v_ch.estado = 'terminada' THEN
    RAISE EXCEPTION 'Esta charla ya terminó.';
  END IF;
  IF v_ch.estado = 'evaluando' AND v_ch.evaluando_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Ya se está evaluando.';
  END IF;

  v_palabras := coalesce(array_length(regexp_split_to_array(btrim(coalesce(p_texto, '')), '\s+'), 1), 0);
  IF btrim(coalesce(p_texto, '')) = '' OR v_palabras < 2 THEN
    RAISE EXCEPTION 'muy_corta';
  END IF;
  IF v_palabras > 150 THEN
    RAISE EXCEPTION 'muy_larga';
  END IF;
  IF v_ch.personaje = 'pirata' AND _explicaselo_frases(p_texto) > 3 THEN
    RAISE EXCEPTION 'regla_frases';
  END IF;
  IF v_ch.personaje = 'marciano' THEN
    v_raiz := _explicaselo_prohibida(p_texto, v_idea->'prohibidas'->'raices');
    IF v_raiz IS NOT NULL THEN
      RAISE EXCEPTION 'regla_palabra:%', v_raiz;
    END IF;
  END IF;

  -- Un mensaje del alumno que quedó colgado sin respuesta se sustituye por el nuevo.
  v_turnos := v_ch.turnos;
  IF v_turnos->-1->>'de' = 'alumno' THEN
    v_turnos := v_turnos - (jsonb_array_length(v_turnos) - 1);
  END IF;
  v_n := _explicaselo_turnos_alumno(v_turnos);
  IF v_n >= 2 THEN
    RAISE EXCEPTION 'Esta charla ya terminó.';
  END IF;

  -- Los topes son los del Desafío, contando las dos (092).
  IF (SELECT count(*) FROM desafio_llamadas WHERE user_id = p_user AND created_at >= v_hoy) >= 12 THEN
    RAISE EXCEPTION 'limite_alumno';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('desafio:tope_global'));
  IF (SELECT count(*) FROM desafio_llamadas WHERE created_at >= v_hoy) >= 1000 THEN
    RAISE EXCEPTION 'limite_global';
  END IF;
  INSERT INTO desafio_llamadas (user_id, juego) VALUES (p_user, 'explicaselo');

  v_turnos := v_turnos || jsonb_build_array(jsonb_build_object('de', 'alumno', 'texto', btrim(p_texto), 'at', now()));
  UPDATE explicaselo_charlas SET estado = 'evaluando', turnos = v_turnos, evaluando_at = now() WHERE id = v_ch.id;

  RETURN jsonb_build_object(
    'libro', (SELECT titulo FROM libros WHERE id = p_libro),
    'cap', (v_idea->>'tras_capitulo')::int,
    'personaje', v_ch.personaje,
    'consigna', v_idea->>'consigna',
    'puntos', v_idea->'puntos',
    'referencia', v_idea->>'referencia',
    'prohibidas', v_idea->'prohibidas'->'palabras',
    'turnos', (SELECT jsonb_agg(jsonb_build_object('de', t->>'de', 'texto', t->>'texto') ORDER BY o)
               FROM jsonb_array_elements(v_turnos) WITH ORDINALITY x(t, o)),
    'turno', v_n + 1,
    'max', 2);
END;
$fn$;


-- El personaje contestó (la IA o el plan B). Si toca cerrar: veredicto y
-- ovillos. Tras el primer mensaje del alumno se cierra solo si la IA dice
-- que estaban los 4 puntos; tras el segundo, siempre.
--   p_puntos: [bool × 4] (null si la IA falló).
--   p_plan_b: el veredicto no lo dio la IA → «casi».
CREATE OR REPLACE FUNCTION public.explicaselo_responder(p_user uuid, p_libro uuid, p_momento text,
                                                        p_mensaje text, p_terminar boolean, p_puntos jsonb,
                                                        p_rompio boolean, p_para_el_profe text, p_plan_b boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ch     explicaselo_charlas%ROWTYPE;
  v_n      int;
  v_ok     int;
  v_fin    boolean;
  v_res    text;
  v_premio int := 0;
BEGIN
  IF btrim(coalesce(p_mensaje, '')) = '' OR length(p_mensaje) > 600 THEN
    RAISE EXCEPTION 'Mensaje del personaje vacío o demasiado largo.';
  END IF;
  IF p_puntos IS NOT NULL AND (jsonb_typeof(p_puntos) <> 'array' OR jsonb_array_length(p_puntos) <> 4) THEN
    RAISE EXCEPTION 'Los puntos tienen que ser 4.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('explicaselo:' || p_user || ':' || p_libro));

  SELECT * INTO v_ch FROM explicaselo_charlas
  WHERE user_id = p_user AND libro_id = p_libro AND momento = p_momento FOR UPDATE;
  IF v_ch.id IS NULL OR v_ch.estado <> 'evaluando' THEN
    RAISE EXCEPTION 'Esta charla no está esperando al personaje.';
  END IF;

  v_n := _explicaselo_turnos_alumno(v_ch.turnos);
  v_ok := CASE WHEN p_puntos IS NULL THEN 0
               ELSE (SELECT count(*) FROM jsonb_array_elements(p_puntos) b WHERE b = 'true'::jsonb)::int END;
  -- Tras el primero solo se cierra con los 4 puntos (y sin plan B).
  v_fin := v_n >= 2 OR (coalesce(p_terminar, false) AND NOT coalesce(p_plan_b, false) AND v_ok = 4);

  IF v_fin THEN
    v_res := CASE WHEN coalesce(p_plan_b, false) OR p_puntos IS NULL THEN 'casi'
                  WHEN v_ok = 4 THEN 'entendio'
                  WHEN v_ok >= 2 THEN 'casi'
                  ELSE 'igual' END;
    IF coalesce(p_rompio, false) AND v_res = 'entendio' THEN
      v_res := 'casi';
    END IF;
    v_premio := CASE v_res WHEN 'entendio' THEN 3 WHEN 'casi' THEN 1 ELSE 0 END;
  END IF;

  UPDATE explicaselo_charlas
  SET turnos = turnos || jsonb_build_array(jsonb_build_object('de', 'personaje', 'texto', btrim(p_mensaje), 'at', now())),
      estado = CASE WHEN v_fin THEN 'terminada' ELSE 'abierta' END,
      resultado = v_res,
      puntos = CASE WHEN v_fin THEN p_puntos END,
      rompio_regla = CASE WHEN v_fin THEN coalesce(p_rompio, false) END,
      para_el_profe = CASE WHEN v_fin THEN left(btrim(p_para_el_profe), 400) END,
      plan_b = CASE WHEN v_fin THEN coalesce(p_plan_b, false) OR p_puntos IS NULL ELSE false END,
      evaluando_at = NULL,
      terminada_at = CASE WHEN v_fin THEN now() END
  WHERE id = v_ch.id;

  IF v_premio > 0 THEN
    INSERT INTO ovillos_movimientos (user_id, libro_id, cantidad, motivo, referencia, detalle)
    VALUES (p_user, p_libro, v_premio, 'explicaselo_premio', v_ch.id,
            jsonb_build_object('momento', p_momento, 'resultado', v_res));
  END IF;

  RETURN jsonb_build_object('terminada', v_fin, 'resultado', v_res, 'premio', v_premio,
                            'estado', _explicaselo_estado(p_user, p_libro));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 5. Lo que ve el profe
-- ═════════════════════════════════════════════════════════════
--   {libro_id, encendido,
--    momentos: [{momento, tras_capitulo, consigna, puntos: [t], referencia}] | null,
--    alumnos: {user_id: {momento: {personaje, giros, estado, resultado, puntos,
--                                  rompio_regla, para_el_profe, plan_b, turnos}}}}
-- Igual que en el Desafío, el profe lee la charla entera.
CREATE OR REPLACE FUNCTION public.explicaselo_aula(p_aula uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_libro uuid;
  d       jsonb;
BEGIN
  PERFORM _profe_de_aula(p_aula);
  SELECT libro_id INTO v_libro FROM _meta_aula(p_aula, 'UTC');
  IF v_libro IS NULL THEN
    RETURN jsonb_build_object('libro_id', NULL);
  END IF;
  SELECT datos INTO d FROM explicaselo_contenido WHERE libro_id = v_libro;

  RETURN jsonb_build_object(
    'libro_id', v_libro,
    'encendido', (_juegos_mezclar(_juegos_aula_por_defecto(),
                                  (SELECT juegos FROM comunidades WHERE id = p_aula))->>'explicaselo')::boolean,
    'momentos', (SELECT jsonb_agg(jsonb_build_object(
                          'momento', m->>'momento', 'tras_capitulo', (m->>'tras_capitulo')::int,
                          'consigna', m->>'consigna', 'referencia', m->>'referencia',
                          'puntos', (SELECT jsonb_agg(p->>'t' ORDER BY o) FROM jsonb_array_elements(m->'puntos') WITH ORDINALITY y(p, o)))
                        ORDER BY CASE m->>'momento' WHEN 'mitad' THEN 1 ELSE 2 END)
                 FROM jsonb_array_elements(d->'momentos') m),
    'alumnos', coalesce((
      SELECT jsonb_object_agg(s.user_id, s.por_momento)
      FROM (SELECT ch.user_id, jsonb_object_agg(ch.momento, jsonb_build_object(
                     'personaje', ch.personaje, 'giros', ch.giros, 'estado', ch.estado,
                     'resultado', ch.resultado, 'puntos', ch.puntos, 'rompio_regla', ch.rompio_regla,
                     'para_el_profe', ch.para_el_profe, 'plan_b', ch.plan_b,
                     'turnos', coalesce((SELECT jsonb_agg(jsonb_build_object('de', t->>'de', 'texto', t->>'texto') ORDER BY o)
                                         FROM jsonb_array_elements(ch.turnos) WITH ORDINALITY x(t, o)), '[]'::jsonb))) AS por_momento
            FROM explicaselo_charlas ch
            JOIN comunidad_miembros cm ON cm.user_id = ch.user_id AND cm.comunidad_id = p_aula AND cm.rol = 'miembro'
            WHERE ch.libro_id = v_libro
            GROUP BY ch.user_id) s), '{}'::jsonb));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 6. La cuenta de ovillos del libro: la de la 100 con explícaselo
-- ═════════════════════════════════════════════════════════════
-- Máximo sin equivocarse: +3 por momento (el primer giro es gratis).
-- Apagado por defecto en las aulas.
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
  v_hilo  int;
  v_ex    int;
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
  v_ex   := coalesce((SELECT jsonb_array_length(datos->'momentos') * 3 FROM explicaselo_contenido WHERE libro_id = p_libro), 0);
  v_hilo := coalesce((
    SELECT sum(_hilo_premio(x)
               - CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements_text(x->'piezas') p
                                   WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.datos->'ideas') y WHERE y->>'id' = p))
                      THEN 1 ELSE 0 END)
    FROM hilo_contenido c, jsonb_array_elements(c.datos->'ideas') x
    WHERE c.libro_id = p_libro), 0)::int;
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
  IF NOT (v_on->>'hilo')::boolean         AND v_hilo > 0 THEN v_apag := v_apag || 'hilo'::text;         v_hilo := 0; END IF;
  IF NOT (v_on->>'explicaselo')::boolean  AND v_ex   > 0 THEN v_apag := v_apag || 'explicaselo'::text;  v_ex   := 0; END IF;
  IF NOT (v_on->>'concurso')::boolean     AND v_cc   > 0 THEN
    v_apag := v_apag || 'concurso'::text; v_cc := 0; v_ccmin := 0; v_ccmax := 0;
  END IF;

  RETURN jsonb_build_object(
    'solo_leyendo', v_leer,
    'maximo', v_leer + v_mesa + v_cz + v_mapa + v_cc + v_fx + v_hilo + v_ex,
    'desglose', jsonb_build_object('lectura', v_leer, 'mesa', v_mesa, 'corazonadas', v_cz,
                                   'mapa', v_mapa, 'concurso', v_cc, 'falsificador', v_fx, 'hilo', v_hilo,
                                   'explicaselo', v_ex),
    'concurso_rango', jsonb_build_array(v_ccmin, v_ccmax),
    'apagados', to_jsonb(v_apag));
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 7. «Descargar mis datos»: la de la 100 con explícaselo
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
    -- 100: cada «Jugar» del hilo de ideas y las ayudas que pidió.
    'hilo_de_ideas',        (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM hilo_jugadas t WHERE t.user_id = v_user),
    'hilo_de_ideas_ayudas', (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM hilo_ayudas t WHERE t.user_id = v_user),
    -- 101: cada charla de explícaselo, con el personaje y el veredicto.
    'explicaselo',          (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'user_id' ORDER BY t.created_at), '[]'::jsonb)
                             FROM explicaselo_charlas t WHERE t.user_id = v_user),
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
    -- 101: el desafío y explícaselo comparten tope; se dice de cuál fue cada una.
    'llamadas_ia_desafio',  (SELECT coalesce(jsonb_agg(jsonb_build_object('juego', t.juego, 'fecha', t.created_at) ORDER BY t.created_at), '[]'::jsonb)
                             FROM desafio_llamadas t WHERE t.user_id = v_user)
  );
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 8. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._explicaselo_personajes()                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._explicaselo_idea(uuid, text)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._explicaselo_frases(text)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._explicaselo_prohibida(text, jsonb)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._explicaselo_turnos_alumno(jsonb)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._explicaselo_estado(uuid, uuid)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._referencia_ovillos(uuid, jsonb)         FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.explicaselo_libro(uuid)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.explicaselo_girar(uuid, text)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.explicaselo_aula(uuid)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mis_datos_juegos()                       FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.explicaselo_libro(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.explicaselo_girar(uuid, text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.explicaselo_aula(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_datos_juegos()                    TO authenticated;

-- Solo el servidor: el alumno nunca ve los puntos antes de terminar ni escribe por el personaje.
REVOKE ALL ON FUNCTION public.explicaselo_reservar(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.explicaselo_responder(uuid, uuid, text, text, boolean, jsonb, boolean, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.explicaselo_reservar(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.explicaselo_responder(uuid, uuid, text, text, boolean, jsonb, boolean, text, boolean) TO service_role;


-- ═════════════════════════════════════════════════════════════
-- PRUEBAS (en el SQL Editor)
-- ═════════════════════════════════════════════════════════════
--   1. SELECT _explicaselo_frases('Hola. ¿Qué tal? Bien… y tú'); → 3
--   2. SELECT _explicaselo_prohibida('Lo CompRaban en la feria', '["compr","vend"]'); → compr
--   3. SELECT _referencia_ovillos('<libro con explícaselo>', '{"explicaselo": true}')->'desglose'->'explicaselo'; → 6
