-- =============================================================
-- INMERSIA — Migración 115
-- Rincón del escritor: editar El falsificador (mismo patrón que la 114)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 099 y la 114 (_libro_del_escritor, _guardar_juego, _texto_juego).
--
-- QUÉ HACE (Juan, 13 nov 2026)
--   · editar_falsificador(libro, autor, items): el navegador manda SOLO
--     textos. La base parte del JSON guardado y cambia:
--       falso → texto (el párrafo inventado), raro, verdad
--       real  → verdad (el párrafo es del libro: no se toca)
--     y el nombre del autor («Lo escribió …»).
--   · No se tocan: id (las respuestas van por id), cap, parrafo (dónde va),
--     si es falso o real. «inicio» (lo que ve el profe) se recalcula del
--     texto nuevo en los falsos.
--   · Se pueden quitar sospechosos, pero queda al menos un falso y un real
--     (si no, el juego no tiene sentido).
--   · Original y «Volver al original»: los de la 114.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================

-- p_items = [{id, verdad, texto?, raro?}] en el orden en que quedan.
CREATE OR REPLACE FUNCTION public.editar_falsificador(p_libro uuid, p_autor text, p_items jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actual jsonb;
  v_nuevo  jsonb := '[]'::jsonb;
  v_autor  text  := btrim(coalesce(p_autor, ''));
  it       jsonb;
  sx       jsonb;
  v_texto  text;
  v_pal    text[];
  n_falsos int := 0;
  n_reales int := 0;
BEGIN
  PERFORM _libro_del_escritor(p_libro);
  SELECT datos INTO v_actual FROM falsificador_contenido WHERE libro_id = p_libro;
  IF v_actual IS NULL THEN
    RAISE EXCEPTION 'Este libro todavía no tiene El falsificador.' USING ERRCODE = 'P0002', HINT = 'formato';
  END IF;
  IF length(v_autor) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Escribe cómo firmas (hasta 60 letras).' USING ERRCODE = '22023', HINT = 'formato';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 2 AND 16 THEN
    RAISE EXCEPTION 'Deja al menos un párrafo inventado y uno del libro.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT x INTO sx FROM jsonb_array_elements(v_actual -> 'items') x WHERE x ->> 'id' = it ->> 'id';
    IF sx IS NULL THEN
      RAISE EXCEPTION 'Un párrafo ya no está. Recarga la página.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    IF v_nuevo @> jsonb_build_array(jsonb_build_object('id', sx ->> 'id')) THEN
      RAISE EXCEPTION 'Hay un párrafo repetido. Recarga la página.' USING ERRCODE = '22023', HINT = 'formato';
    END IF;
    IF _texto_juego(it -> 'verdad', 400) IS NULL THEN
      RAISE EXCEPTION 'Falta «lo que dice el libro» (hasta 400 letras).' USING ERRCODE = '22023', HINT = 'formato';
    END IF;

    IF (sx ->> 'falso')::boolean THEN
      v_texto := _texto_juego(it -> 'texto', 1500);
      IF v_texto IS NULL OR _texto_juego(it -> 'raro', 300) IS NULL THEN
        RAISE EXCEPTION 'Revisa el párrafo inventado «%»: el párrafo (hasta 1.500 letras) y «lo raro» (hasta 300) no pueden quedar vacíos.',
          left(coalesce(it ->> 'texto', ''), 60) USING ERRCODE = '22023', HINT = 'formato';
      END IF;
      -- Como cargar_falsificador.py: las 12 primeras palabras.
      v_pal := regexp_split_to_array(v_texto, '\s+');
      sx := sx || jsonb_build_object(
        'texto', v_texto, 'raro', _texto_juego(it -> 'raro', 300), 'verdad', _texto_juego(it -> 'verdad', 400),
        'inicio', array_to_string(v_pal[1:12], ' ') || CASE WHEN cardinality(v_pal) > 12 THEN '…' ELSE '' END);
      n_falsos := n_falsos + 1;
    ELSE
      sx := sx || jsonb_build_object('verdad', _texto_juego(it -> 'verdad', 400));
      n_reales := n_reales + 1;
    END IF;
    v_nuevo := v_nuevo || jsonb_build_array(sx);
  END LOOP;

  IF n_falsos = 0 OR n_reales = 0 THEN
    RAISE EXCEPTION 'Deja al menos un párrafo inventado y uno del libro.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  PERFORM _guardar_juego(p_libro, 'falsificador',
    v_actual || jsonb_build_object('autor', v_autor, 'items', v_nuevo));
END;
$fn$;

REVOKE ALL ON FUNCTION public.editar_falsificador(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_falsificador(uuid, text, jsonb) TO authenticated;
