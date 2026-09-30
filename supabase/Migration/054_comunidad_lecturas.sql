-- =============================================================
-- INMERSIA — Migración 054
-- Lecturas de la comunidad (con historial), encuentro, código
-- elegido por el creador y crear_comunidad() en un solo paso
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- MODELO
--   · comunidades.libro_id sigue siendo "el libro actual": lo usan el
--     buscador (053) y el camino (progreso_comunidad, 051), y es dato
--     público de una comunidad pública.
--   · comunidad_lecturas guarda cada lectura: libro, fecha meta y el
--     encuentro para comentarlo (lugar + fecha y hora). La actual es la
--     que tiene fin = NULL. Cuando el moderador cambia libro_id, un
--     trigger cierra la actual y abre la nueva: el historial se llena
--     solo.
--   · El encuentro vive en la lectura y NO en `comunidades` a propósito:
--     una comunidad pública la ve cualquiera con sesión, y una dirección
--     física solo deben verla sus miembros.
--
-- CÓDIGO DE INVITACIÓN
--   Ahora lo puede elegir el creador (una palabra que su grupo recuerde).
--   Formato: 6 a 20 letras o números, en mayúsculas. Los generados
--   automáticamente (8 hexadecimales) ya cumplen el formato.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. comunidad_lecturas
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.comunidad_lecturas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comunidad_id    uuid        NOT NULL REFERENCES public.comunidades(id) ON DELETE CASCADE,
  libro_id        uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  fecha_meta      date,
  encuentro_lugar text        CHECK (encuentro_lugar IS NULL OR char_length(btrim(encuentro_lugar)) BETWEEN 1 AND 200),
  encuentro_fecha timestamptz,
  inicio          timestamptz NOT NULL DEFAULT now(),
  fin             timestamptz
);

-- Una sola lectura abierta por comunidad.
CREATE UNIQUE INDEX IF NOT EXISTS idx_comunidad_lecturas_actual
  ON public.comunidad_lecturas (comunidad_id) WHERE fin IS NULL;

CREATE INDEX IF NOT EXISTS idx_comunidad_lecturas_historial
  ON public.comunidad_lecturas (comunidad_id, inicio DESC);

ALTER TABLE public.comunidad_lecturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comunidad_lecturas_select" ON public.comunidad_lecturas;
CREATE POLICY "comunidad_lecturas_select"
  ON public.comunidad_lecturas FOR SELECT TO authenticated
  USING (es_miembro(comunidad_id) OR es_superusuario());

-- El moderador edita la fecha meta y el encuentro. Las filas las crea y
-- las cierra solo el trigger de abajo: sin INSERT/DELETE para el cliente.
DROP POLICY IF EXISTS "comunidad_lecturas_update" ON public.comunidad_lecturas;
CREATE POLICY "comunidad_lecturas_update"
  ON public.comunidad_lecturas FOR UPDATE TO authenticated
  USING (es_moderador(comunidad_id))
  WITH CHECK (es_moderador(comunidad_id));

REVOKE INSERT, UPDATE, DELETE ON public.comunidad_lecturas FROM anon, authenticated;
GRANT UPDATE (fecha_meta, encuentro_lugar, encuentro_fecha) ON public.comunidad_lecturas TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- 2. Historial automático al cambiar el libro
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public._comunidad_cambio_libro()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.libro_id IS NOT DISTINCT FROM OLD.libro_id THEN
    RETURN NULL;
  END IF;

  UPDATE comunidad_lecturas SET fin = now()
  WHERE comunidad_id = NEW.id AND fin IS NULL;

  IF NEW.libro_id IS NOT NULL THEN
    INSERT INTO comunidad_lecturas (comunidad_id, libro_id) VALUES (NEW.id, NEW.libro_id);
  END IF;

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_comunidad_cambio_libro ON public.comunidades;
CREATE TRIGGER trg_comunidad_cambio_libro
  AFTER INSERT OR UPDATE OF libro_id ON public.comunidades
  FOR EACH ROW EXECUTE FUNCTION public._comunidad_cambio_libro();

REVOKE ALL ON FUNCTION public._comunidad_cambio_libro() FROM PUBLIC, anon, authenticated;

-- Comunidades creadas antes de esta migración con libro: abrir su lectura.
INSERT INTO public.comunidad_lecturas (comunidad_id, libro_id, inicio)
SELECT c.id, c.libro_id, c.created_at
FROM public.comunidades c
WHERE c.libro_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.comunidad_lecturas l WHERE l.comunidad_id = c.id AND l.fin IS NULL);


-- ═════════════════════════════════════════════════════════════
-- 3. Formato del código
-- ═════════════════════════════════════════════════════════════
ALTER TABLE public.comunidad_codigos
  DROP CONSTRAINT IF EXISTS comunidad_codigos_formato;
ALTER TABLE public.comunidad_codigos
  ADD CONSTRAINT comunidad_codigos_formato
  CHECK (codigo ~ '^[A-Z0-9]{6,20}$');


-- ═════════════════════════════════════════════════════════════
-- 4. crear_comunidad(): todo o nada
-- ═════════════════════════════════════════════════════════════
-- Crea la comunidad (los triggers de 051 meten al creador como
-- moderador y generan un código), pone el código elegido si es
-- privada, y completa la primera lectura con fecha meta y encuentro.
-- Si algo falla (código repetido, sin permiso, tope de 5), no queda
-- nada a medias.
--
-- Corre como el usuario (SECURITY INVOKER): el permiso de creador y el
-- tope los imponen las mismas políticas y triggers de siempre.
CREATE OR REPLACE FUNCTION public.crear_comunidad(
  p_nombre          text,
  p_descripcion     text        DEFAULT NULL,
  p_privada         boolean     DEFAULT false,
  p_codigo          text        DEFAULT NULL,
  p_libro_id        uuid        DEFAULT NULL,
  p_fecha_meta      date        DEFAULT NULL,
  p_encuentro_lugar text        DEFAULT NULL,
  p_encuentro_fecha timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  -- El id se genera aquí y NO con INSERT ... RETURNING: RETURNING obliga a
  -- que la fila nueva pase la política de LECTURA de comunidades, y una
  -- privada solo la leen sus miembros. El creador aún no lo es en ese
  -- instante (lo mete el trigger AFTER INSERT), así que crear una privada
  -- fallaría con "violates row-level security policy".
  v_id     uuid := gen_random_uuid();
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
BEGIN
  IF p_privada AND v_codigo !~ '^[A-Z0-9]{6,20}$' THEN
    RAISE EXCEPTION 'El código debe tener entre 6 y 20 letras o números.'
      USING ERRCODE = '22023', HINT = 'codigo_formato';
  END IF;

  INSERT INTO comunidades (id, nombre, descripcion, privada, libro_id, creador_id)
  VALUES (v_id, btrim(p_nombre), nullif(btrim(coalesce(p_descripcion, '')), ''), p_privada, p_libro_id, auth.uid());

  IF p_privada THEN
    BEGIN
      -- La fila de comunidad_codigos la creó el trigger 4a (051) y solo
      -- el moderador la ve: este UPDATE pasa porque ya lo somos. Va por
      -- una función aparte porque el cliente no tiene UPDATE sobre ella.
      PERFORM _comunidad_poner_codigo(v_id, v_codigo);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'Ese código ya lo usa otra comunidad. Prueba con otro.'
        USING ERRCODE = '23505', HINT = 'codigo_en_uso';
    END;
  END IF;

  IF p_libro_id IS NOT NULL THEN
    UPDATE comunidad_lecturas
    SET fecha_meta      = p_fecha_meta,
        encuentro_lugar = nullif(btrim(coalesce(p_encuentro_lugar, '')), ''),
        encuentro_fecha = p_encuentro_fecha
    WHERE comunidad_id = v_id AND fin IS NULL;
  END IF;

  RETURN v_id;
END;
$fn$;

-- Pone un código concreto. SECURITY DEFINER porque comunidad_codigos no
-- tiene UPDATE para el cliente; comprueba él mismo que quien llama modera.
CREATE OR REPLACE FUNCTION public._comunidad_poner_codigo(p_comunidad uuid, p_codigo text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT es_moderador(p_comunidad) THEN
    RAISE EXCEPTION 'Solo el moderador puede cambiar el código.' USING ERRCODE = '42501';
  END IF;
  UPDATE comunidad_codigos SET codigo = p_codigo WHERE comunidad_id = p_comunidad;
END;
$fn$;

REVOKE ALL ON FUNCTION public._comunidad_poner_codigo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._comunidad_poner_codigo(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.crear_comunidad(text, text, boolean, text, uuid, date, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_comunidad(text, text, boolean, text, uuid, date, text, timestamptz) TO authenticated;


-- =============================================================
-- COMPROBACIÓN (con tu usuario, que ya está en creadores_comunidad)
--   SELECT crear_comunidad('Prueba privada', NULL, true, 'jueves2026',
--          '<un libro_id>', '2026-10-31', 'Café Central', '2026-10-31 19:00+02');
--   → devuelve el id. Después:
--     SELECT codigo FROM comunidad_codigos WHERE comunidad_id = '<id>';   → JUEVES2026
--     SELECT * FROM comunidad_lecturas WHERE comunidad_id = '<id>';        → 1 fila, fin NULL
--   Repetir con el mismo código → 'Ese código ya lo usa otra comunidad.'
--   Cambiar el libro: UPDATE comunidades SET libro_id = '<otro>' WHERE id = '<id>';
--     → la lectura anterior queda con fin, y hay una nueva abierta.
-- =============================================================
