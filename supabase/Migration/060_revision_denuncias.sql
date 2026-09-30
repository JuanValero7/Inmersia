-- =============================================================
-- INMERSIA — Migración 060
-- Revisión de denuncias (Perfil → Denuncias, solo superusuario)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- Las denuncias (051) guardaban qué se denunció y una copia del texto,
-- pero no QUIÉN lo escribió. Si el autor lo borra, o es un mensajito
-- que se borra al leerlo, ya no hay forma de saberlo, ni de ver si esa
-- persona reincide. Esta migración:
--
--   1. denuncias gana contexto que el trigger rellena al denunciar:
--        denunciado_id  quien escribió lo denunciado; en una comunidad,
--                       quien la moderaba en ese momento
--        libro_id       el libro donde pasó
--        parrafo_id     el párrafo (comentarios y mensajitos)
--      y el resultado de la revisión:
--        resolucion     descartada | borrado | sacado | renombrada | cerrada
--        resuelta_at
--
--   2. denuncias_para_revisar(p_pendientes): la lista con nombres,
--      comunidad, libro, reincidencias y si el original sigue vivo.
--
--   3. resolver_denuncia(p_id, p_accion): aplica la acción y marca la
--      denuncia en un solo paso. Acciones:
--        descartar  → nada más
--        borrar     → borra el comentario / mensajito / comentario de foro
--        sacar      → saca a denunciado_id de la comunidad (si era el
--                     moderador, la moderación pasa al siguiente: 051)
--        renombrar  → la comunidad pasa a "Comunidad sin nombre", sin
--                     descripción
--        cerrar     → borra la comunidad entera (CASCADE)
--        deshacer   → la denuncia vuelve a pendiente (lo borrado no vuelve)
--
-- Las dos funciones exigen superusuario (es_superusuario, 051).
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================


-- ── 1. Columnas nuevas ───────────────────────────────────────
ALTER TABLE public.denuncias
  ADD COLUMN IF NOT EXISTS denunciado_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS libro_id      uuid REFERENCES public.libros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parrafo_id    uuid REFERENCES public.parrafos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolucion    text,
  ADD COLUMN IF NOT EXISTS resuelta_at   timestamptz;

ALTER TABLE public.denuncias DROP CONSTRAINT IF EXISTS denuncias_resolucion_check;
ALTER TABLE public.denuncias ADD CONSTRAINT denuncias_resolucion_check
  CHECK (resolucion IS NULL OR resolucion IN ('descartada', 'borrado', 'sacado', 'renombrada', 'cerrada'));

-- Para contar reincidencias sin recorrer la tabla entera.
CREATE INDEX IF NOT EXISTS idx_denuncias_denunciado ON public.denuncias (denunciado_id, created_at);


-- ── 2. El trigger de 051, ahora también con el contexto ──────
CREATE OR REPLACE FUNCTION public._denuncia_copiar_contenido()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_texto      text;
  v_comunidad  uuid;
  v_autor      uuid;
  v_libro      uuid;
  v_parrafo    uuid;
  v_ok         boolean := false;
BEGIN
  IF NEW.tipo = 'foro' THEN
    SELECT contenido, comunidad_id, autor_id INTO v_texto, v_comunidad, v_autor
    FROM foros_comentarios
    WHERE id = NEW.objeto_id AND (comunidad_id IS NULL OR es_miembro(comunidad_id));
    v_ok := FOUND;

  ELSIF NEW.tipo = 'comentario_lectura' THEN
    SELECT contenido, comunidad_id, autor_id, libro_id, parrafo_id
      INTO v_texto, v_comunidad, v_autor, v_libro, v_parrafo
    FROM comentarios_lectura
    WHERE id = NEW.objeto_id AND es_miembro(comunidad_id);
    v_ok := FOUND;

  ELSIF NEW.tipo = 'mensajito' THEN
    SELECT contenido, comunidad_id, de_id, libro_id, parrafo_id
      INTO v_texto, v_comunidad, v_autor, v_libro, v_parrafo
    FROM mensajitos
    WHERE id = NEW.objeto_id AND auth.uid() IN (de_id, para_id);
    v_ok := FOUND;

  ELSIF NEW.tipo = 'comunidad' THEN
    SELECT nombre || coalesce(E'\n\n' || descripcion, ''), id, libro_id
      INTO v_texto, v_comunidad, v_libro
    FROM comunidades
    WHERE id = NEW.objeto_id AND (NOT privada OR es_miembro(id));
    v_ok := FOUND;
    IF v_ok THEN
      -- "Quién la escribió" = quien la modera ahora (el más antiguo si hay varios)
      SELECT user_id INTO v_autor
      FROM comunidad_miembros
      WHERE comunidad_id = NEW.objeto_id AND rol = 'moderador'
      ORDER BY unido_at LIMIT 1;
    END IF;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'No se encontró lo que quieres denunciar.' USING ERRCODE = 'P0002';
  END IF;

  NEW.contenido_denunciado := v_texto;
  NEW.comunidad_id         := v_comunidad;
  NEW.denunciado_id        := v_autor;
  NEW.libro_id             := v_libro;
  NEW.parrafo_id           := v_parrafo;
  NEW.estado               := 'pendiente';
  NEW.resolucion           := NULL;
  NEW.resuelta_at          := NULL;
  RETURN NEW;
END;
$fn$;
-- (el trigger trg_denuncia_copiar_contenido de 051 ya apunta a esta función)


-- ── 3. La lista para revisar ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.denuncias_para_revisar(p_pendientes boolean DEFAULT true)
RETURNS TABLE (
  id                 uuid,
  tipo               text,
  objeto_id          uuid,
  estado             text,
  resolucion         text,
  resuelta_at        timestamptz,
  motivo             text,
  contenido          text,
  created_at         timestamptz,
  comunidad_id       uuid,
  comunidad_nombre   text,
  comunidad_privada  boolean,
  comunidad_miembros integer,
  libro_titulo       text,
  parrafo_texto      text,
  denunciante_nombre text,
  denunciado_id      uuid,
  denunciado_nombre  text,
  reincidencias      integer,
  original_existe    boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT es_superusuario() THEN
    RAISE EXCEPTION 'Solo el superusuario revisa denuncias.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    d.id, d.tipo, d.objeto_id, d.estado, d.resolucion, d.resuelta_at, d.motivo,
    d.contenido_denunciado, d.created_at,
    d.comunidad_id, c.nombre::text, c.privada,
    (SELECT count(*)::int FROM comunidad_miembros cm WHERE cm.comunidad_id = d.comunidad_id),
    l.titulo::text,
    p.contenido::text,
    nullif(btrim(coalesce(pa.nombre, '') || ' ' || coalesce(pa.apellido, '')), ''),
    d.denunciado_id,
    nullif(btrim(coalesce(pb.nombre, '') || ' ' || coalesce(pb.apellido, '')), ''),
    -- Reincidencia: denuncias anteriores a la misma persona que no se descartaron
    (SELECT count(*)::int FROM denuncias d2
      WHERE d2.denunciado_id = d.denunciado_id AND d2.id <> d.id
        AND d2.created_at < d.created_at AND d2.estado <> 'descartada'),
    CASE d.tipo
      WHEN 'comentario_lectura' THEN EXISTS (SELECT 1 FROM comentarios_lectura x WHERE x.id = d.objeto_id)
      WHEN 'mensajito'          THEN EXISTS (SELECT 1 FROM mensajitos x WHERE x.id = d.objeto_id)
      WHEN 'foro'               THEN EXISTS (SELECT 1 FROM foros_comentarios x WHERE x.id = d.objeto_id)
      WHEN 'comunidad'          THEN EXISTS (SELECT 1 FROM comunidades x WHERE x.id = d.objeto_id)
    END
  FROM denuncias d
  LEFT JOIN comunidades c ON c.id = d.comunidad_id
  LEFT JOIN libros l      ON l.id = d.libro_id
  LEFT JOIN parrafos p    ON p.id = d.parrafo_id
  LEFT JOIN perfiles pa   ON pa.id = d.denunciante_id
  LEFT JOIN perfiles pb   ON pb.id = d.denunciado_id
  WHERE (p_pendientes AND d.estado = 'pendiente') OR (NOT p_pendientes AND d.estado <> 'pendiente')
  ORDER BY CASE WHEN p_pendientes THEN d.created_at END ASC,
           CASE WHEN NOT p_pendientes THEN d.resuelta_at END DESC NULLS LAST;
END;
$fn$;

REVOKE ALL ON FUNCTION public.denuncias_para_revisar(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.denuncias_para_revisar(boolean) TO authenticated;


-- ── 4. Resolver ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolver_denuncia(p_id uuid, p_accion text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d denuncias%ROWTYPE;
  v_resolucion text;
BEGIN
  IF NOT es_superusuario() THEN
    RAISE EXCEPTION 'Solo el superusuario resuelve denuncias.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO d FROM denuncias WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa denuncia ya no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF p_accion = 'deshacer' THEN
    UPDATE denuncias SET estado = 'pendiente', resolucion = NULL, resuelta_at = NULL WHERE id = p_id;
    RETURN;
  END IF;

  IF d.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Esa denuncia ya está resuelta.' USING ERRCODE = 'P0001', HINT = 'ya_resuelta';
  END IF;

  IF p_accion = 'descartar' THEN
    v_resolucion := 'descartada';

  ELSIF p_accion = 'borrar' THEN
    IF d.tipo = 'comentario_lectura' THEN DELETE FROM comentarios_lectura WHERE id = d.objeto_id;
    ELSIF d.tipo = 'mensajito'       THEN DELETE FROM mensajitos WHERE id = d.objeto_id;
    ELSIF d.tipo = 'foro'            THEN DELETE FROM foros_comentarios WHERE id = d.objeto_id;
    ELSE RAISE EXCEPTION 'Para una comunidad usa renombrar o cerrar.' USING ERRCODE = '22023';
    END IF;
    v_resolucion := 'borrado';

  ELSIF p_accion = 'sacar' THEN
    IF d.denunciado_id IS NULL OR d.comunidad_id IS NULL THEN
      RAISE EXCEPTION 'No sabemos a quién sacar: la persona o la comunidad ya no existen.' USING ERRCODE = 'P0002', HINT = 'sin_denunciado';
    END IF;
    DELETE FROM comunidad_miembros WHERE comunidad_id = d.comunidad_id AND user_id = d.denunciado_id;
    v_resolucion := 'sacado';

  ELSIF p_accion = 'renombrar' THEN
    IF d.tipo <> 'comunidad' THEN
      RAISE EXCEPTION 'Solo se renombra una comunidad denunciada.' USING ERRCODE = '22023';
    END IF;
    UPDATE comunidades SET nombre = 'Comunidad sin nombre', descripcion = NULL WHERE id = d.objeto_id;
    v_resolucion := 'renombrada';

  ELSIF p_accion = 'cerrar' THEN
    IF d.tipo <> 'comunidad' THEN
      RAISE EXCEPTION 'Solo se cierra una comunidad denunciada.' USING ERRCODE = '22023';
    END IF;
    DELETE FROM comunidades WHERE id = d.objeto_id;
    v_resolucion := 'cerrada';

  ELSE
    RAISE EXCEPTION 'Acción desconocida: %', p_accion USING ERRCODE = '22023';
  END IF;

  UPDATE denuncias
  SET estado = CASE WHEN v_resolucion = 'descartada' THEN 'descartada' ELSE 'revisada' END,
      resolucion = v_resolucion,
      resuelta_at = now()
  WHERE id = p_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.resolver_denuncia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_denuncia(uuid, text) TO authenticated;


-- ── 5. La purga de 059 cuenta desde que se resolvió ─────────
-- Antes contaba desde la denuncia; con resuelta_at se cumple mejor lo
-- que dice la política ("6 meses una vez resueltas").
CREATE OR REPLACE FUNCTION public.purgar_denuncias_resueltas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  borradas integer;
BEGIN
  DELETE FROM public.denuncias
   WHERE estado <> 'pendiente'
     AND coalesce(resuelta_at, created_at) < now() - interval '6 months';
  GET DIAGNOSTICS borradas = ROW_COUNT;
  RETURN borradas;
END;
$fn$;


-- =============================================================
-- COMPROBACIÓN (desde la app, con la cuenta de superusuario:
-- en el SQL Editor auth.uid() es NULL y las funciones lo rechazan)
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'denuncias' ORDER BY ordinal_position;   -- + 5 columnas
--   SELECT proname FROM pg_proc
--   WHERE proname IN ('denuncias_para_revisar', 'resolver_denuncia');  -- 2 filas
-- =============================================================
