-- =============================================================
-- INMERSIA — Migración 110
-- Rincón del escritor, fase 3 (parte 4): Infografías (no ficción)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 109 (pedir_trabajo), la 108 (guardar_imagen_escritor) y la 107
-- (_colocar_imagen_escritor).
--
-- QUÉ HACE (maqueta pantalla 6, pestaña Infografías; Juan, 13 nov 2026)
--   · «infografias» (0,50 $ CADA una): {estilo: 0 Art Nouveau | 1 Pulp,
--     capitulos: [n, …]}. El PC resume cada capítulo (Gemini: idea central +
--     5 puntos) y rellena las plantillas de Documents/Info html, rotando los
--     3 formatos (bandas, cintas, revista). Quedan como BORRADOR. Los
--     capítulos muy cortos se saltan y no se cobran.
--   · Guardar: la infografía va a su capítulo (polaroid en el párrafo N-5,
--     como upload_infografias.py) y reemplaza a la guardada de ese capítulo.
--   · imagenes_escritor.datos: el texto con que se hizo (título, idea
--     central, puntos, plantilla). Para «corregir texto», que llega después.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


ALTER TABLE public.imagenes_escritor ADD COLUMN IF NOT EXISTS datos jsonb;

ALTER TABLE public.trabajos DROP CONSTRAINT IF EXISTS trabajos_tipo_check;
ALTER TABLE public.trabajos ADD CONSTRAINT trabajos_tipo_check
  CHECK (tipo IN ('prueba', 'borrar', 'sonido', 'portada', 'fondo',
                  'ilustraciones_analisis', 'ilustraciones', 'rehacer', 'infografias'));


-- ═════════════════════════════════════════════════════════════
-- Guardar: igual que en la 108 + la infografía va a su capítulo
-- (una por capítulo: la guardada anterior se va)
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
  ELSIF i.tipo = 'infografia' THEN
    DELETE FROM imagenes_escritor
     WHERE libro_id = i.libro_id AND tipo = 'infografia' AND estado = 'guardada'
       AND capitulo IS NOT DISTINCT FROM i.capitulo AND id <> i.id;
  END IF;

  UPDATE imagenes_escritor SET estado = 'guardada', guardado = now() WHERE id = i.id;

  IF i.tipo = 'portada' THEN
    UPDATE libros SET portada_url = i.url WHERE id = i.libro_id;
  ELSIF i.tipo = 'fondo' THEN
    UPDATE libros
       SET metadata = coalesce(metadata, '{}'::jsonb)
                      || jsonb_build_object('hero_url', i.url, 'hero_url_mobile', coalesce(i.url_movil, i.url))
     WHERE id = i.libro_id;
  ELSIF i.tipo IN ('escena', 'infografia') AND i.capitulo IS NOT NULL THEN
    PERFORM _colocar_imagen_escritor(i.id, i.capitulo);
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.guardar_imagen_escritor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_imagen_escritor(uuid) TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- pedir_trabajo: igual que en la 109 + «infografias» (solo no ficción)
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
  IF p_tipo NOT IN ('prueba', 'sonido', 'portada', 'fondo', 'ilustraciones_analisis', 'ilustraciones', 'rehacer',
                    'infografias') THEN
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
  IF p_tipo = 'infografias' AND (SELECT es_ficcion FROM libros WHERE id = p_libro) THEN
    RAISE EXCEPTION 'Las infografías son para libros de no ficción.' USING ERRCODE = '22023', HINT = 'ficcion';
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
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k <> 'estilo')
       OR jsonb_typeof(v_params -> 'estilo') IS DISTINCT FROM 'number'
       OR (v_params ->> 'estilo')::numeric NOT IN (0, 1, 2, 3, 4, 5, 6, 7, 8) THEN
      RAISE EXCEPTION 'Elige un estilo.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := (v_precios ->> 'ilustraciones_analisis')::numeric;

  ELSIF p_tipo = 'ilustraciones' THEN
    -- {estilo: 0–8, items: [id de ilustraciones_propuestas de este libro]}
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k NOT IN ('estilo', 'items'))
       OR jsonb_typeof(v_params -> 'estilo') IS DISTINCT FROM 'number'
       OR (v_params ->> 'estilo')::numeric NOT IN (0, 1, 2, 3, 4, 5, 6, 7, 8)
       OR jsonb_typeof(v_params -> 'items') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_n := jsonb_array_length(v_params -> 'items');
    IF v_n NOT BETWEEN 1 AND 80
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_params -> 'items') it
                   WHERE jsonb_typeof(it) <> 'string' OR (it #>> '{}') !~ '^[0-9a-f-]{36}$')
       OR (SELECT count(*) FROM ilustraciones_propuestas
            WHERE libro_id = p_libro
              AND id IN (SELECT (it #>> '{}')::uuid FROM jsonb_array_elements(v_params -> 'items') it)) <> v_n THEN
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

  ELSIF p_tipo = 'infografias' THEN
    -- {estilo: 0 Art Nouveau | 1 Pulp, capitulos: [números de capítulo de este libro, sin repetir]}
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_params) k WHERE k NOT IN ('estilo', 'capitulos'))
       OR jsonb_typeof(v_params -> 'estilo') IS DISTINCT FROM 'number'
       OR (v_params ->> 'estilo')::numeric NOT IN (0, 1)
       OR jsonb_typeof(v_params -> 'capitulos') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_n := jsonb_array_length(v_params -> 'capitulos');
    IF v_n NOT BETWEEN 1 AND 300
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_params -> 'capitulos') c
                   WHERE jsonb_typeof(c) <> 'number' OR (c #>> '{}') !~ '^[0-9]{1,4}$')
       OR (SELECT count(DISTINCT numero) FROM capitulos
            WHERE libro_id = p_libro
              AND numero IN (SELECT (c #>> '{}')::int FROM jsonb_array_elements(v_params -> 'capitulos') c)) <> v_n THEN
      RAISE EXCEPTION 'Elige los capítulos de tu libro.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    v_reservado := v_n * (v_precios ->> 'infografia')::numeric;
  END IF;

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
