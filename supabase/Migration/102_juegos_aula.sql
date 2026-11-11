-- =============================================================
-- INMERSIA — Migración 102
-- El profe enciende y apaga los juegos de su aula desde el Salón
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere de la 093 a la 101 (juegos encendidos y los 9 juegos).
--
-- QUÉ CAMBIA (decisión de Juan, 11 nov 2026)
--   · En el aula TODO viene encendido por defecto (antes, falsificador y
--     explícaselo venían apagados y ningún colegio podía usarlos).
--   · El profe (moderador del aula) o el admin del colegio lo cambian con
--     los botones del Salón.
--   · La regla del alumno no cambia (juegos_libro, 093/098): en el libro de
--     su aula manda el profe; en cualquier otro libro, su Perfil.
--
-- QUIÉN LLAMA A QUÉ (el navegador, desde el Salón)
--   · juegos_aula(aula) → si el libro es de ficción, qué juegos tienen
--     contenido para ese libro y cuáles están encendidos.
--   · juegos_aula_guardar(aula, juego, encendido) → un interruptor.
--
-- Idempotente. Después de correrla: npm run esquema y commit del volcado.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. En el aula, todo encendido por defecto
-- ═════════════════════════════════════════════════════════════
-- La usan juegos_libro, _referencia_ovillos y los *_aula del profe: con
-- cambiarla aquí, todos pasan a ver lo mismo.
CREATE OR REPLACE FUNCTION public._juegos_aula_por_defecto()
RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT '{"mesa": true, "corazonadas": true, "mapa": true, "concurso": true, "desafio": true,
           "capsula": true, "hilo": true, "falsificador": true, "explicaselo": true}'::jsonb;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 2. Lo que llama el profe
-- ═════════════════════════════════════════════════════════════

-- Los juegos del aula. Devuelve:
--   { libro_id, es_ficcion,
--     disponibles: ['mesa', …]  (los que tienen contenido para el libro del aula),
--     juegos: {mesa: true, …}   (los 9, con lo que eligió el profe encima) }
-- Sin libro asignado: libro_id null y disponibles vacío.
CREATE OR REPLACE FUNCTION public.juegos_aula(p_aula uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_libro uuid;
BEGIN
  PERFORM _profe_de_aula(p_aula);
  SELECT libro_id INTO v_libro FROM _meta_aula(p_aula, 'UTC');

  RETURN jsonb_build_object(
    'libro_id', v_libro,
    'es_ficcion', coalesce((SELECT es_ficcion FROM libros WHERE id = v_libro), true),
    'disponibles', to_jsonb(array_remove(ARRAY[
      CASE WHEN EXISTS (SELECT 1 FROM anderson_contenido     WHERE libro_id = v_libro) THEN 'mesa' END,
      CASE WHEN EXISTS (SELECT 1 FROM corazonadas_contenido  WHERE libro_id = v_libro) THEN 'corazonadas' END,
      CASE WHEN EXISTS (SELECT 1 FROM mapa_contenido         WHERE libro_id = v_libro) THEN 'mapa' END,
      CASE WHEN EXISTS (SELECT 1 FROM concurso_contenido     WHERE libro_id = v_libro) THEN 'concurso' END,
      CASE WHEN EXISTS (SELECT 1 FROM desafio_contenido      WHERE libro_id = v_libro) THEN 'desafio' END,
      CASE WHEN EXISTS (SELECT 1 FROM capsula_contenido      WHERE libro_id = v_libro) THEN 'capsula' END,
      CASE WHEN EXISTS (SELECT 1 FROM hilo_contenido         WHERE libro_id = v_libro) THEN 'hilo' END,
      CASE WHEN EXISTS (SELECT 1 FROM falsificador_contenido WHERE libro_id = v_libro) THEN 'falsificador' END,
      CASE WHEN EXISTS (SELECT 1 FROM explicaselo_contenido  WHERE libro_id = v_libro) THEN 'explicaselo' END
    ], NULL)),
    'juegos', _juegos_mezclar(_juegos_aula_por_defecto(),
                              (SELECT juegos FROM comunidades WHERE id = p_aula)));
END;
$fn$;


-- El interruptor del Salón: un juego cada vez, sin pisar los demás.
CREATE OR REPLACE FUNCTION public.juegos_aula_guardar(p_aula uuid, p_juego text, p_encendido boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM _profe_de_aula(p_aula);
  IF NOT (_juegos_aula_por_defecto() ? p_juego) OR p_encendido IS NULL THEN
    RAISE EXCEPTION 'Ese juego no existe.';
  END IF;

  UPDATE comunidades
  SET juegos = juegos || jsonb_build_object(p_juego, p_encendido)
  WHERE id = p_aula;

  RETURN juegos_aula(p_aula);
END;
$fn$;


-- ═════════════════════════════════════════════════════════════
-- 3. Permisos
-- ═════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public._juegos_aula_por_defecto()                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.juegos_aula(uuid)                           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.juegos_aula_guardar(uuid, text, boolean)    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.juegos_aula(uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.juegos_aula_guardar(uuid, text, boolean) TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- Para comprobar (como el profe del aula)
--   1. SELECT juegos_aula('<aula>'); → los 9 en true, disponibles según el libro.
--   2. SELECT juegos_aula_guardar('<aula>', 'mapa', false); → mapa false, el resto igual.
--   3. Como alumno del aula: SELECT juegos_libro('<libro del aula>'); → mapa false, fuente 'aula'.
-- =============================================================
