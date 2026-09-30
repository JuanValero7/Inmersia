-- =============================================================
-- INMERSIA — Migración 053
-- buscar_comunidades(): el buscador de comunidades públicas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PROBLEMA
-- El buscador (panel ＋ en escritorio, "Buscar comunidades" en móvil)
-- muestra cuántos miembros tiene cada comunidad pública. Pero la RLS
-- de comunidad_miembros (051) solo deja ver los miembros de las
-- comunidades propias: quien busca todavía no es miembro, así que un
-- count normal le devolvería 0 en todas.
--
-- SOLUCIÓN
-- Una función SECURITY DEFINER que devuelve SOLO públicas y SOLO el
-- número de miembros (nunca quiénes son). Busca por nombre de la
-- comunidad o por título de su libro. Sin texto, devuelve las más
-- concurridas: sirve de "explorar".
--
-- Se usa position() y no ILIKE para que un % o un _ tecleado por el
-- usuario se busque tal cual y no como comodín.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================

CREATE OR REPLACE FUNCTION public.buscar_comunidades(p_texto text DEFAULT '')
RETURNS TABLE (
  id            uuid,
  nombre        text,
  descripcion   text,
  libro_titulo  text,
  libro_portada text,
  libro_color   text,
  miembros      int,
  soy_miembro   boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH q AS (SELECT lower(btrim(coalesce(p_texto, ''))) AS t)
  SELECT
    c.id,
    c.nombre,
    c.descripcion,
    l.titulo::text,
    l.portada_url::text,
    l.color::text,
    (SELECT count(*)::int FROM comunidad_miembros m WHERE m.comunidad_id = c.id),
    EXISTS (SELECT 1 FROM comunidad_miembros m WHERE m.comunidad_id = c.id AND m.user_id = auth.uid())
  FROM comunidades c
  LEFT JOIN libros l ON l.id = c.libro_id
  CROSS JOIN q
  WHERE NOT c.privada
    AND (
      q.t = ''
      OR position(q.t IN lower(c.nombre)) > 0
      OR position(q.t IN lower(coalesce(l.titulo, ''))) > 0
    )
  ORDER BY 7 DESC, c.created_at DESC
  LIMIT 20;
$fn$;

REVOKE ALL ON FUNCTION public.buscar_comunidades(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_comunidades(text) TO authenticated;

-- =============================================================
-- COMPROBACIÓN
--   SELECT * FROM buscar_comunidades('');          → hasta 20 públicas
--   SELECT * FROM buscar_comunidades('principito'); → por nombre o libro
--   Una privada nunca aparece, aunque su nombre coincida.
-- =============================================================
