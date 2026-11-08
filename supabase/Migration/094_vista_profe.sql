-- =============================================================
-- INMERSIA — Migración 094
-- Vista del profe: pestaña «Comprensión» del Salón y nota del desafío
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere de la 087 a la 093 (los 5 juegos) y la 084 (_meta_aula).
--
-- QUÉ HAY (decisiones de Juan, 8 nov 2026)
--   · comprension_aula(aula): todo lo de los 5 juegos del libro del aula,
--     alumno por alumno, de una vez. Las cuentas (porcentajes, quién
--     necesita apoyo) y el filtro por capítulo o personaje los hace la
--     pantalla: son pocos datos y así no hay que volver a pedirlos.
--   · desafio_charla_aula(aula, alumno, momento): la charla entera, solo
--     cuando el profe toca «Ver la charla».
--   · desafio_calificar(aula, alumno, momento, nota, comentario): la nota
--     del profe en el desafío, de 0 a 20, y un comentario libre. Inmersia
--     no pone nota: la tarjeta «Opinar con argumentos» resume estas.
--   · El alumno ve la nota y el comentario en su Cuaderno (_desafio_estado).
--   · Se borra anderson_aula (087): devolvía las conclusiones falsas y los
--     señuelos, que Juan descartó. Nadie la llamaba.
--
-- LA MESA PARA EL PROFE
--   El foco es dar con el trío, no elegir la conclusión. «Intentos» de una
--   deducción = combinaciones que probó el alumno con ese personaje desde
--   la deducción anterior que encontró, hasta dar con esta (incluida). Una
--   combinación que no encaja no dice qué buscaba el alumno, así que se le
--   cuenta a la siguiente que encuentre. Al final del libro quedan menos
--   pistas y sale más fácil: es inevitable.
--
-- PRIVACIDAD
--   Del concurso solo el resultado y las ayudas: el texto nunca se guardó.
--   Del desafío sí la charla: el alumno sabe que la lee su profe.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Nota del profe en el desafío
-- ═════════════════════════════════════════════════════════════

ALTER TABLE public.desafio_charlas
  ADD COLUMN IF NOT EXISTS nota       smallint,
  ADD COLUMN IF NOT EXISTS comentario text,
  ADD COLUMN IF NOT EXISTS nota_por   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nota_at    timestamptz;

ALTER TABLE public.desafio_charlas DROP CONSTRAINT IF EXISTS desafio_charlas_nota_rango;
ALTER TABLE public.desafio_charlas
  ADD CONSTRAINT desafio_charlas_nota_rango CHECK (nota BETWEEN 0 AND 20);
ALTER TABLE public.desafio_charlas DROP CONSTRAINT IF EXISTS desafio_charlas_comentario_largo;
ALTER TABLE public.desafio_charlas
  ADD CONSTRAINT desafio_charlas_comentario_largo CHECK (length(comentario) <= 1000);

COMMENT ON COLUMN public.desafio_charlas.nota IS
  'Nota del profe, de 0 a 20. La pone el profe con desafio_calificar; el alumno la ve en su Cuaderno. Ver migración 094.';
COMMENT ON COLUMN public.desafio_charlas.comentario IS
  'Comentario libre del profe sobre la charla (máx. 1000). El alumno lo ve. Ver migración 094.';


-- ═════════════════════════════════════════════════════════════
-- 2. Uso interno
-- ═════════════════════════════════════════════════════════════

-- ¿Puedo ver esta aula? Lanza error si no.
CREATE OR REPLACE FUNCTION public._profe_de_aula(p_aula uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM comunidades WHERE id = p_aula AND colegio_id IS NOT NULL)
     OR NOT (es_admin_de_aula(p_aula) OR es_moderador(p_aula)) THEN
    RAISE EXCEPTION 'Solo el colegio ve los datos de esta aula.' USING ERRCODE = '42501';
  END IF;
END;
$fn$;


-- El alumno de esta aula en ese libro y momento: su charla del desafío. Lanza error si no es alumno del aula.
CREATE OR REPLACE FUNCTION public._charla_de_alumno(p_aula uuid, p_user uuid, p_momento text)
RETURNS public.desafio_charlas
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_libro uuid;
  v_ch    desafio_charlas%ROWTYPE;
BEGIN
  PERFORM _profe_de_aula(p_aula);
  IF NOT EXISTS (SELECT 1 FROM comunidad_miembros
                 WHERE comunidad_id = p_aula AND user_id = p_user AND rol = 'miembro') THEN
    RAISE EXCEPTION 'Ese alumno no está en esta aula.';
  END IF;
  SELECT libro_id INTO v_libro FROM _meta_aula(p_aula, 'UTC');
  SELECT * INTO v_ch FROM desafio_charlas
  WHERE user_id = p_user AND libro_id = v_libro AND momento = p_momento;
  IF v_ch.id IS NULL THEN
    RAISE EXCEPTION 'Ese alumno todavía no hizo este desafío.';
  END IF;
  RETURN v_ch;
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Lo que llama el profe
-- ═════════════════════════════════════════════════════════════
-- Devuelve:
--   libro_id, total_capitulos, meta_capitulo, juegos {mesa, corazonadas, concurso, mapa, desafio}
--   alumnos: [{user_id, nombre, capitulos}]            capitulos = capítulos completados
--   mesa:        {personajes: [{id, nombre, aparece}],
--                 deducciones: [{id, pj, texto, pistas: [{texto, cap} | {texto, deduccion}]}],
--                 jugadas: {user_id: {deduccion: {intentos, armada}}}}
--   corazonadas: {preguntas: [{id, cap, rev, sorpresa, pregunta, opciones, correcta}],
--                 jugadas: {user_id: {corazonada: {estado, opcion, ovillos, acierto}}}}
--   concurso:    {frases: [{id, cap, tipo, cita}],
--                 asignadas: {user_id: [frase]},
--                 jugadas: {user_id: {frase: {veredicto, contexto, cincuenta}}}}
--   mapa:        {tesoros: [{id, cap, tipo, pregunta}],
--                 jugadas: {user_id: {encontrados: [tesoro], fallos: {tesoro: n}, fallos_cap: {cap: n}}}}
--   desafio:     {momentos: [{momento, tras_capitulo, preguntas: [{id, tipo, consigna}]}],
--                 charlas: {user_id: {momento: {pregunta, estado, resumen, nota, comentario}}}}
--   Un juego sin contenido en ese libro sale como null.

CREATE OR REPLACE FUNCTION public.comprension_aula(p_aula uuid, p_zona text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_meta  record;
  v_users uuid[];
  d       jsonb;
  v_mesa  jsonb;
  v_cz    jsonb;
  v_cc    jsonb;
  v_mapa  jsonb;
  v_df    jsonb;
BEGIN
  PERFORM _profe_de_aula(p_aula);

  SELECT * INTO v_meta FROM _meta_aula(p_aula, _zona_valida(p_zona));
  IF v_meta.libro_id IS NULL THEN
    RETURN jsonb_build_object('libro_id', NULL);
  END IF;

  SELECT coalesce(array_agg(user_id), '{}') INTO v_users
  FROM comunidad_miembros WHERE comunidad_id = p_aula AND rol = 'miembro';

  -- ── Mesa de investigación
  SELECT datos INTO d FROM anderson_contenido WHERE libro_id = v_meta.libro_id;
  IF d IS NOT NULL THEN
    WITH
    j AS (
      SELECT user_id, personaje, rasgo, resultado, created_at FROM anderson_jugadas
      WHERE libro_id = v_meta.libro_id AND user_id = ANY (v_users)
    ),
    -- La primera vez que dio con el trío de cada deducción.
    primera AS (
      SELECT DISTINCT ON (user_id, rasgo) user_id, personaje, rasgo, created_at
      FROM j WHERE rasgo IS NOT NULL
      ORDER BY user_id, rasgo, created_at
    ),
    tramos AS (
      SELECT p.*, lag(p.created_at) OVER (PARTITION BY p.user_id, p.personaje ORDER BY p.created_at) AS antes
      FROM primera p
    ),
    por_ded AS (
      SELECT t.user_id, t.rasgo,
             1 + (SELECT count(*) FROM j x
                  WHERE x.user_id = t.user_id AND x.personaje = t.personaje
                    AND x.resultado IN ('no_encajan', 'casi')
                    AND x.created_at < t.created_at
                    AND (t.antes IS NULL OR x.created_at > t.antes)) AS intentos,
             EXISTS (SELECT 1 FROM j x WHERE x.user_id = t.user_id AND x.rasgo = t.rasgo
                     AND x.resultado = 'acierto') AS armada
      FROM tramos t
    )
    SELECT jsonb_build_object(
      'personajes', (SELECT jsonb_agg(jsonb_build_object('id', x->>'id', 'nombre', x->>'nombre',
                                                         'aparece', (x->>'aparece')::int) ORDER BY o)
                     FROM jsonb_array_elements(d->'personajes') WITH ORDINALITY t(x, o)),
      'deducciones', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', r->>'id', 'pj', r->>'pj',
          'texto', r->'opciones'->>((r->>'correcta')::int),
          -- El grupo de pistas: cualquier 3 la abren. Una deducción dentro del grupo es un cambio de 2.º nivel.
          'pistas', (SELECT jsonb_agg(coalesce(
                        (SELECT jsonb_build_object('texto', pi->>'resumen', 'cap', (pi->>'cap')::int)
                         FROM jsonb_array_elements(d->'pistas') pi WHERE pi->>'id' = pid),
                        (SELECT jsonb_build_object('texto', r2->'opciones'->>((r2->>'correcta')::int), 'deduccion', r2->>'id')
                         FROM jsonb_array_elements(d->'rasgos') r2 WHERE r2->>'id' = pid)) ORDER BY po)
                     FROM jsonb_array_elements_text(r->'pool') WITH ORDINALITY q(pid, po))
        ) ORDER BY o)
        FROM jsonb_array_elements(d->'rasgos') WITH ORDINALITY t(r, o)),
      'jugadas', coalesce((
        SELECT jsonb_object_agg(u.user_id, u.ded)
        FROM (SELECT user_id, jsonb_object_agg(rasgo, jsonb_build_object('intentos', intentos, 'armada', armada)) AS ded
              FROM por_ded GROUP BY user_id) u), '{}'::jsonb)
    ) INTO v_mesa;
  END IF;

  -- ── Corazonadas
  SELECT datos INTO d FROM corazonadas_contenido WHERE libro_id = v_meta.libro_id;
  IF d IS NOT NULL THEN
    SELECT jsonb_build_object(
      'preguntas', (SELECT jsonb_agg(jsonb_build_object(
                      'id', x->>'id', 'cap', (x->'chip'->>'cap')::int, 'rev', (x->'rev'->>'cap')::int,
                      'sorpresa', x->>'clase' = 'sorpresa', 'pregunta', x->>'pregunta',
                      'opciones', x->'opciones', 'correcta', (x->>'correcta')::int) ORDER BY o)
                    FROM jsonb_array_elements(d->'corazonadas') WITH ORDINALITY t(x, o)),
      'jugadas', coalesce((
        SELECT jsonb_object_agg(u.user_id, u.cz)
        FROM (SELECT user_id, jsonb_object_agg(corazonada, jsonb_build_object(
                'estado', estado, 'opcion', opcion, 'ovillos', ovillos, 'acierto', acierto)) AS cz
              FROM corazonadas_jugadas
              WHERE libro_id = v_meta.libro_id AND user_id = ANY (v_users)
              GROUP BY user_id) u), '{}'::jsonb)
    ) INTO v_cz;
  END IF;

  -- ── Frases difíciles (concurso)
  SELECT datos INTO d FROM concurso_contenido WHERE libro_id = v_meta.libro_id;
  IF d IS NOT NULL THEN
    SELECT jsonb_build_object(
      'frases', (SELECT jsonb_agg(jsonb_build_object('id', x->>'id', 'cap', (x->>'cap')::int,
                                                     'tipo', x->>'tipo', 'cita', x->>'cita') ORDER BY (x->>'cap')::int, o)
                 FROM jsonb_array_elements(d->'frases') WITH ORDINALITY t(x, o)),
      -- Las que le tocan a cada uno (el mismo sorteo que ve el alumno): sin esto no se sabe cuál omitió.
      'asignadas', coalesce((
        SELECT jsonb_object_agg(u, (SELECT coalesce(jsonb_agg(f->>'id'), '[]'::jsonb) FROM _concurso_frases(u, v_meta.libro_id) f))
        FROM unnest(v_users) u), '{}'::jsonb),
      'jugadas', coalesce((
        SELECT jsonb_object_agg(u.user_id, u.cc)
        FROM (SELECT user_id, jsonb_object_agg(frase, jsonb_build_object(
                'veredicto', veredicto, 'contexto', contexto, 'cincuenta', cincuenta)) AS cc
              FROM concurso_jugadas
              WHERE libro_id = v_meta.libro_id AND user_id = ANY (v_users)
              GROUP BY user_id) u), '{}'::jsonb)
    ) INTO v_cc;
  END IF;

  -- ── Tesoros (mapa)
  SELECT datos INTO d FROM mapa_contenido WHERE libro_id = v_meta.libro_id;
  IF d IS NOT NULL THEN
    SELECT jsonb_build_object(
      'tesoros', (SELECT jsonb_agg(jsonb_build_object('id', x->>'id', 'cap', (x->>'cap')::int,
                                                      'tipo', x->>'tipo', 'pregunta', x->>'pregunta') ORDER BY (x->>'cap')::int, o)
                  FROM jsonb_array_elements(d->'tesoros') WITH ORDINALITY t(x, o)),
      'jugadas', coalesce((
        SELECT jsonb_object_agg(u, jsonb_build_object(
          'encontrados', (SELECT coalesce(jsonb_agg(m.tesoro), '[]'::jsonb) FROM mapa_jugadas m
                          WHERE m.user_id = u AND m.libro_id = v_meta.libro_id AND m.acierto),
          'fallos', (SELECT coalesce(jsonb_object_agg(s.tesoro, s.n), '{}'::jsonb)
                     FROM (SELECT m.tesoro, count(*) AS n FROM mapa_jugadas m
                           WHERE m.user_id = u AND m.libro_id = v_meta.libro_id AND NOT m.acierto AND m.tesoro IS NOT NULL
                           GROUP BY m.tesoro) s),
          'fallos_cap', (SELECT coalesce(jsonb_object_agg(s.capitulo, s.n), '{}'::jsonb)
                         FROM (SELECT m.capitulo, count(*) AS n FROM mapa_jugadas m
                               WHERE m.user_id = u AND m.libro_id = v_meta.libro_id AND NOT m.acierto
                               GROUP BY m.capitulo) s)))
        FROM unnest(v_users) u
        WHERE EXISTS (SELECT 1 FROM mapa_jugadas m WHERE m.user_id = u AND m.libro_id = v_meta.libro_id)), '{}'::jsonb)
    ) INTO v_mapa;
  END IF;

  -- ── Desafío
  SELECT datos INTO d FROM desafio_contenido WHERE libro_id = v_meta.libro_id;
  IF d IS NOT NULL THEN
    SELECT jsonb_build_object(
      'momentos', (SELECT jsonb_agg(jsonb_build_object(
                     'momento', m->>'momento', 'tras_capitulo', (m->>'tras_capitulo')::int,
                     'preguntas', (SELECT jsonb_agg(jsonb_build_object('id', q->>'id', 'tipo', q->>'tipo', 'consigna', q->>'consigna'))
                                   FROM jsonb_array_elements(m->'preguntas') q)))
                   FROM jsonb_array_elements(d->'momentos') m),
      -- La pregunta que le toca a cada uno aunque no haya empezado; la charla, si existe.
      'charlas', coalesce((
        SELECT jsonb_object_agg(u, (
          SELECT jsonb_object_agg(mo, jsonb_build_object(
                   'pregunta', q->>'id',
                   'estado', coalesce(ch.estado, 'nueva'),
                   'resumen', ch.resumen,
                   'nota', ch.nota,
                   'comentario', ch.comentario))
          FROM unnest(ARRAY['mitad', 'final']) mo
          CROSS JOIN LATERAL _desafio_pregunta(u, v_meta.libro_id, mo) q
          LEFT JOIN desafio_charlas ch ON ch.user_id = u AND ch.libro_id = v_meta.libro_id AND ch.momento = mo
          WHERE q IS NOT NULL))
        FROM unnest(v_users) u), '{}'::jsonb)
    ) INTO v_df;
  END IF;

  RETURN jsonb_build_object(
    'libro_id', v_meta.libro_id,
    'total_capitulos', v_meta.total_capitulos,
    'meta_capitulo', v_meta.meta_capitulo,
    'juegos', (SELECT _juegos_mezclar('{"mesa": true, "corazonadas": true, "mapa": true, "concurso": true, "desafio": true}'::jsonb, juegos)
               FROM comunidades WHERE id = p_aula),
    'alumnos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'user_id', m.user_id,
               'nombre', coalesce(m.nombre_en_aula, nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Lector'),
               'capitulos', coalesce(pl.capitulos_completados, 0))
             ORDER BY coalesce(m.nombre_en_aula, nullif(btrim(concat_ws(' ', pf.nombre, pf.apellido)), ''), 'Lector'))
      FROM comunidad_miembros m
      LEFT JOIN perfiles pf ON pf.id = m.user_id
      LEFT JOIN progreso_lectura pl ON pl.user_id = m.user_id AND pl.libro_id = v_meta.libro_id
      WHERE m.comunidad_id = p_aula AND m.rol = 'miembro'), '[]'::jsonb),
    'mesa', v_mesa,
    'corazonadas', v_cz,
    'concurso', v_cc,
    'mapa', v_mapa,
    'desafio', v_df
  );
END;
$fn$;


-- La charla entera de un alumno, para leerla.
CREATE OR REPLACE FUNCTION public.desafio_charla_aula(p_aula uuid, p_user uuid, p_momento text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ch desafio_charlas%ROWTYPE := _charla_de_alumno(p_aula, p_user, p_momento);
BEGIN
  RETURN jsonb_build_object(
    'momento', v_ch.momento,
    'consigna', (SELECT q->>'consigna'
                 FROM desafio_contenido c, jsonb_array_elements(c.datos->'momentos') m, jsonb_array_elements(m->'preguntas') q
                 WHERE c.libro_id = v_ch.libro_id AND m->>'momento' = v_ch.momento AND q->>'id' = v_ch.pregunta),
    'estado', v_ch.estado,
    'turnos', coalesce((SELECT jsonb_agg(jsonb_build_object('de', t->>'de', 'texto', t->>'texto') ORDER BY o)
                        FROM jsonb_array_elements(v_ch.turnos) WITH ORDINALITY x(t, o)), '[]'::jsonb),
    'resumen', v_ch.resumen,
    'nota', v_ch.nota,
    'comentario', v_ch.comentario);
END;
$fn$;


-- Poner, cambiar o quitar (nota y comentario en null) la nota de una charla terminada.
CREATE OR REPLACE FUNCTION public.desafio_calificar(p_aula uuid, p_user uuid, p_momento text,
                                                   p_nota int, p_comentario text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ch  desafio_charlas%ROWTYPE := _charla_de_alumno(p_aula, p_user, p_momento);
  v_com text := nullif(btrim(coalesce(p_comentario, '')), '');
BEGIN
  IF v_ch.estado <> 'terminada' THEN
    RAISE EXCEPTION 'La charla todavía no terminó.';
  END IF;
  IF p_nota IS NOT NULL AND (p_nota < 0 OR p_nota > 20) THEN
    RAISE EXCEPTION 'La nota va de 0 a 20.';
  END IF;
  IF length(v_com) > 1000 THEN
    RAISE EXCEPTION 'El comentario es demasiado largo.';
  END IF;

  UPDATE desafio_charlas
  SET nota = p_nota, comentario = v_com,
      nota_por = CASE WHEN p_nota IS NULL AND v_com IS NULL THEN NULL ELSE auth.uid() END,
      nota_at  = CASE WHEN p_nota IS NULL AND v_com IS NULL THEN NULL ELSE now() END
  WHERE id = v_ch.id;

  RETURN jsonb_build_object('nota', p_nota, 'comentario', v_com);
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 4. El alumno ve la nota en su Cuaderno (reemplaza la de la 092)
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public._desafio_estado(p_user uuid, p_libro uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ver int;
BEGIN
  SELECT version INTO v_ver FROM desafio_contenido WHERE libro_id = p_libro;
  IF v_ver IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'version', v_ver,
    'max_turnos', 3,
    -- Está en un aula que lee este libro: solo entonces el gato dice «Lo lee tu profe».
    'con_profe', EXISTS (SELECT 1 FROM comunidad_miembros cm JOIN comunidades co ON co.id = cm.comunidad_id
                         WHERE cm.user_id = p_user AND co.colegio_id IS NOT NULL AND co.libro_id = p_libro),
    'momentos', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'momento', mo.momento,
          'tras_capitulo', (q->>'tras_capitulo')::int,
          'pregunta', jsonb_build_object('id', q->>'id', 'tipo', q->>'tipo', 'consigna', q->>'consigna'),
          'estado', coalesce(ch.estado, 'nueva'),
          'turnos', coalesce((SELECT jsonb_agg(jsonb_build_object('de', t->>'de', 'texto', t->>'texto') ORDER BY o)
                              FROM jsonb_array_elements(ch.turnos) WITH ORDINALITY x(t, o)), '[]'::jsonb),
          'nota', ch.nota,
          'comentario', ch.comentario)
        ORDER BY mo.orden)
      FROM (VALUES ('mitad', 1), ('final', 2)) mo(momento, orden)
      CROSS JOIN LATERAL _desafio_pregunta(p_user, p_libro, mo.momento) q
      LEFT JOIN desafio_charlas ch
        ON ch.user_id = p_user AND ch.libro_id = p_libro AND ch.momento = mo.momento
      WHERE q IS NOT NULL), '[]'::jsonb)
  );
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 5. Fuera lo que ya no se usa
-- ═════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.anderson_aula(uuid);


-- ═════════════════════════════════════════════════════════════
-- 6. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._profe_de_aula(uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._charla_de_alumno(uuid, uuid, text)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._desafio_estado(uuid, uuid)             FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.comprension_aula(uuid, text)                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.desafio_charla_aula(uuid, uuid, text)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.desafio_calificar(uuid, uuid, text, int, text)     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comprension_aula(uuid, text)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.desafio_charla_aula(uuid, uuid, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.desafio_calificar(uuid, uuid, text, int, text)  TO authenticated;
