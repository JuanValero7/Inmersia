-- =============================================================
-- INMERSIA — Migración 108
-- Rincón del escritor, fase 3 (parte 3): Ilustraciones
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 107 (_colocar_imagen_escritor) y la 106.
--
-- QUÉ HACE (maqueta pantalla 6; precios de Juan, 13 nov 2026)
--   1 · «ilustraciones_analisis» (5 $): el PC corre analyze.py con el
--       estilo elegido (uno de sus 9) y deja en el resultado del trabajo los
--       personajes, lugares y una escena por capítulo, con sus prompts.
--   2 · «ilustraciones» (0,50 $ cada una): el escritor marca qué dibujar;
--       el PC las genera y quedan como BORRADOR en imagenes_escritor.
--       Se cobran solo las que salieron.
--   3 · Carrusel: Guardar (la escena va a su capítulo como polaroid; el
--       personaje o lugar espera a la cartelera, fase 4), Descartar (se borra,
--       no se devuelve) o «rehacer» (0,25 $: otra con el mismo prompt, que
--       reemplaza a la anterior).
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- El prompt con el que se hizo (para rehacer). En inglés, como los de analyze.py.
ALTER TABLE public.imagenes_escritor ADD COLUMN IF NOT EXISTS prompt text;

ALTER TABLE public.trabajos DROP CONSTRAINT IF EXISTS trabajos_tipo_check;
ALTER TABLE public.trabajos ADD CONSTRAINT trabajos_tipo_check
  CHECK (tipo IN ('prueba', 'borrar', 'sonido', 'portada', 'fondo',
                  'ilustraciones_analisis', 'ilustraciones', 'rehacer'));


-- ═════════════════════════════════════════════════════════════
-- Guardar: igual que en la 106 + la escena va a su capítulo
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.guardar_imagen_escritor(p_imagen uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  i imagenes_escritor%ROWTYPE;
BEGIN
  SELECT im.* INTO i FROM imagenes_escritor im JOIN libros l ON l.id = im.libro_id
   WHERE im.id = p_imagen AND l.propietario_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa imagen no es de tu libro.' USING ERRCODE = 'P0002', HINT = 'imagen_invalida';
  END IF;
  IF i.estado = 'guardada' THEN RETURN; END IF;

  IF i.tipo IN ('portada', 'fondo') THEN
    DELETE FROM imagenes_escritor
     WHERE libro_id = i.libro_id AND tipo = i.tipo AND estado = 'guardada' AND id <> i.id;
  END IF;

  UPDATE imagenes_escritor SET estado = 'guardada', guardado = now() WHERE id = i.id;

  IF i.tipo = 'portada' THEN
    UPDATE libros SET portada_url = i.url WHERE id = i.libro_id;
  ELSIF i.tipo = 'fondo' THEN
    UPDATE libros
       SET metadata = coalesce(metadata, '{}'::jsonb)
                      || jsonb_build_object('hero_url', i.url, 'hero_url_mobile', coalesce(i.url_movil, i.url))
     WHERE id = i.libro_id;
  ELSIF i.tipo = 'escena' AND i.capitulo IS NOT NULL THEN
    PERFORM _colocar_imagen_escritor(i.id, i.capitulo);
  END IF;
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- pedir_trabajo: igual que en la 106 + los tres de ilustraciones
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
  v_n         int;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM escritores WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Tu cuenta no tiene el modo escritor.' USING ERRCODE = '42501', HINT = 'no_escritor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM libros WHERE id = p_libro AND propietario_id = v_uid) THEN
    RAISE EXCEPTION 'Ese libro no es tuyo o ya no existe.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;
  IF p_tipo NOT IN ('prueba', 'sonido', 'portada', 'fondo', 'ilustraciones_analisis', 'ilustraciones', 'rehacer') THEN
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

  IF p_tipo IN ('sonido', 'ilustraciones_analisis', 'ilustraciones', 'rehacer')
     AND NOT (SELECT es_ficcion FROM libros WHERE id = p_libro) THEN
    RAISE EXCEPTION 'Esto es para libros de ficción.' USING ERRCODE = '22023', HINT = 'no_ficcion';
  END IF;

  IF p_tipo = 'sonido' THEN
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

  ELSIF p_tipo IN ('portada', 'fondo') THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k
                WHERE k NOT IN ('sujeto', 'color') OR (k = 'color' AND p_tipo = 'fondo'))
       OR jsonb_typeof(v_params -> 'sujeto') IS DISTINCT FROM 'string'
       OR length(btrim(v_params ->> 'sujeto')) NOT BETWEEN 3 AND 400
       OR (p_tipo = 'portada' AND coalesce(v_params ->> 'color', '') !~ '^#[0-9a-fA-F]{6}$') THEN
      RAISE EXCEPTION 'Cuéntanos qué quieres que salga (entre 3 y 400 letras).' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := (v_precios ->> p_tipo)::numeric;

  ELSIF p_tipo = 'ilustraciones_analisis' THEN
    -- estilo: índice de ART_STYLES de analyze.py (0–8).
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k <> 'estilo')
       OR jsonb_typeof(v_params -> 'estilo') IS DISTINCT FROM 'number'
       OR (v_params ->> 'estilo')::numeric NOT IN (0, 1, 2, 3, 4, 5, 6, 7, 8) THEN
      RAISE EXCEPTION 'Elige un estilo.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := (v_precios ->> 'ilustraciones_analisis')::numeric;

  ELSIF p_tipo = 'ilustraciones' THEN
    -- {analisis: id del análisis hecho de este libro, items: [{tipo, nombre} | {tipo: 'escena', capitulo}]}
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k NOT IN ('analisis', 'items'))
       OR jsonb_typeof(v_params -> 'items') IS DISTINCT FROM 'array'
       OR coalesce(v_params ->> 'analisis', '') !~ '^[0-9a-f-]{36}$'
       OR NOT EXISTS (SELECT 1 FROM trabajos WHERE id = (v_params ->> 'analisis')::uuid AND libro_id = p_libro
                        AND tipo = 'ilustraciones_analisis' AND estado = 'hecho') THEN
      RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_n := jsonb_array_length(v_params -> 'items');
    IF v_n NOT BETWEEN 1 AND 80 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_params -> 'items') it
       WHERE jsonb_typeof(it) <> 'object'
          OR NOT (
               (it ->> 'tipo' IN ('personaje', 'lugar') AND jsonb_typeof(it -> 'nombre') = 'string'
                 AND length(it ->> 'nombre') BETWEEN 1 AND 160 AND (SELECT count(*) FROM jsonb_object_keys(it)) = 2)
            OR (it ->> 'tipo' = 'escena' AND jsonb_typeof(it -> 'capitulo') = 'number'
                 AND (SELECT count(*) FROM jsonb_object_keys(it)) = 2))
    ) THEN
      RAISE EXCEPTION 'Marca entre 1 y 80 imágenes.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := v_n * (v_precios ->> 'ilustracion')::numeric;

  ELSIF p_tipo = 'rehacer' THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k <> 'imagen')
       OR coalesce(v_params ->> 'imagen', '') !~ '^[0-9a-f-]{36}$'
       OR NOT EXISTS (SELECT 1 FROM imagenes_escritor WHERE id = (v_params ->> 'imagen')::uuid AND libro_id = p_libro
                        AND estado = 'borrador' AND tipo IN ('personaje', 'lugar', 'escena') AND prompt IS NOT NULL) THEN
      RAISE EXCEPTION 'Esa imagen ya no se puede rehacer.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := (v_precios ->> 'rehacer')::numeric;
  END IF;

  -- Reservar del cupón (bloqueando la fila: dos pedidos a la vez no gastan dos veces).
  IF v_reservado IS NOT NULL THEN
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
