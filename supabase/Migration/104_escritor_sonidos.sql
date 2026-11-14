-- =============================================================
-- INMERSIA — Migración 104
-- Rincón del escritor, fase 2a: el escritor pone sonidos a su libro a mano
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 103 (escritores, libros.propietario_id).
--
-- QUÉ HACE (plan acordado con Juan, 13 nov 2026)
--   · Efectos: el dueño de un libro puede vincular y desvincular sonidos de
--     la biblioteca común (elementos_interactivos) SOLO en párrafos de su
--     libro. Solo audios, y la única metadata permitida es la frase
--     (texto_ref). La biblioteca común (biblioteca_media) no la toca.
--   · Ambientes: guardar_ambientes_escritor(capitulo, tramos) guarda los
--     tramos de un capítulo de su libro, validando la forma.
--   · Es gratis y sin límite (decisión de Juan): no hay cobro aquí.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Efectos: vincular y desvincular en párrafos propios
-- ═════════════════════════════════════════════════════════════
-- Las políticas del superusuario (superusuario_ei_*) siguen igual; estas
-- se suman (las políticas permisivas se combinan con OR).
DROP POLICY IF EXISTS escritor_ei_insert ON public.elementos_interactivos;
CREATE POLICY escritor_ei_insert ON public.elementos_interactivos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.parrafos p
              JOIN public.libros l ON l.id = p.libro_id
             WHERE p.id = elementos_interactivos.parrafo_id
               AND l.propietario_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.biblioteca_media m
                 WHERE m.id = elementos_interactivos.media_id AND m.tipo = 'audio')
    AND (metadata - 'texto_ref') = '{}'::jsonb
    AND length(coalesce(metadata ->> 'texto_ref', '')) <= 500
  );

DROP POLICY IF EXISTS escritor_ei_delete ON public.elementos_interactivos;
CREATE POLICY escritor_ei_delete ON public.elementos_interactivos
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.parrafos p
              JOIN public.libros l ON l.id = p.libro_id
             WHERE p.id = elementos_interactivos.parrafo_id
               AND l.propietario_id = (SELECT auth.uid()))
  );


-- ═════════════════════════════════════════════════════════════
-- 2. Ambientes por tramos de un capítulo propio
-- ═════════════════════════════════════════════════════════════
-- p_tramos = [{desde, hasta, ambiente}, …] con el mismo formato que usa el
-- lector (migración 080, hooks/useAmbiente.js). [] o null = sin ambiente.
-- El catálogo vive en src/lib/ambientes.js: aquí se valida la forma del
-- nombre; uno que no exista, el lector simplemente no lo toca.
CREATE OR REPLACE FUNCTION public.guardar_ambientes_escritor(p_capitulo uuid, p_tramos jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid  uuid := auth.uid();
  v_n    int;
  v_max  int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM capitulos c JOIN libros l ON l.id = c.libro_id
                  WHERE c.id = p_capitulo AND l.propietario_id = v_uid) THEN
    RAISE EXCEPTION 'Ese capítulo no es de tu libro.' USING ERRCODE = 'P0002', HINT = 'libro_invalido';
  END IF;

  IF p_tramos IS NULL OR p_tramos = '[]'::jsonb THEN
    UPDATE capitulos SET ambientes = NULL WHERE id = p_capitulo;
    RETURN;
  END IF;

  IF jsonb_typeof(p_tramos) <> 'array' OR jsonb_array_length(p_tramos) > 60 THEN
    RAISE EXCEPTION 'Tramos inválidos.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  SELECT count(*) INTO v_n FROM parrafos WHERE capitulo_id = p_capitulo;
  SELECT max(numero) INTO v_max FROM parrafos WHERE capitulo_id = p_capitulo;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_tramos) t
     WHERE jsonb_typeof(t) <> 'object'
        OR jsonb_typeof(t -> 'desde') <> 'number' OR jsonb_typeof(t -> 'hasta') <> 'number'
        OR coalesce(t ->> 'ambiente', '') !~ '^[a-z0-9_]{1,40}$'
        OR (t ->> 'desde')::numeric <> floor((t ->> 'desde')::numeric)
        OR (t ->> 'hasta')::numeric <> floor((t ->> 'hasta')::numeric)
        OR (t ->> 'desde')::int < 1
        OR (t ->> 'hasta')::int < (t ->> 'desde')::int
        OR (t ->> 'hasta')::int > coalesce(v_max, v_n)
        OR (SELECT count(*) FROM jsonb_object_keys(t)) <> 3
  ) THEN
    RAISE EXCEPTION 'Tramos inválidos.' USING ERRCODE = '22023', HINT = 'formato';
  END IF;

  -- Sin solaparse: ordenados por «desde», cada uno empieza después del anterior.
  IF EXISTS (
    SELECT 1 FROM (
      SELECT (t ->> 'desde')::int AS desde,
             lag((t ->> 'hasta')::int) OVER (ORDER BY (t ->> 'desde')::int) AS hasta_previo
        FROM jsonb_array_elements(p_tramos) t
    ) x WHERE x.desde <= x.hasta_previo
  ) THEN
    RAISE EXCEPTION 'Dos tramos se pisan.' USING ERRCODE = '22023', HINT = 'tramos_solapados';
  END IF;

  UPDATE capitulos
     SET ambientes = (SELECT jsonb_agg(jsonb_build_object(
                               'desde', (t ->> 'desde')::int,
                               'hasta', (t ->> 'hasta')::int,
                               'ambiente', t ->> 'ambiente')
                             ORDER BY (t ->> 'desde')::int)
                        FROM jsonb_array_elements(p_tramos) t)
   WHERE id = p_capitulo;
END;
$fn$;

REVOKE ALL ON FUNCTION public.guardar_ambientes_escritor(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_ambientes_escritor(uuid, jsonb) TO authenticated;
