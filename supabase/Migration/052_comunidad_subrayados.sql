-- =============================================================
-- INMERSIA — Migración 052
-- Comentarios de comunidad: también subrayados
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- comentarios_lectura (051) solo admitía un comentario sobre un
-- párrafo. La idea es que un miembro pueda dejarle a su comunidad:
--   · solo un comentario   ("esto lo discutimos en la próxima reunión")
--   · solo un subrayado    (una frase marcada para todos)
--   · las dos cosas        (la frase marcada + una nota debajo)
-- El subrayado se guarda igual que los personales de
-- subrayados_usuario (011): el párrafo + el texto marcado tal cual.
--
-- Los mensajitos (1 a 1) se quedan como estaban; solo ganan también
-- el texto citado opcional ("mira esta frase"). Ahí el contenido
-- sigue siendo obligatorio: una nota a alguien sin texto no dice nada.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================


-- ── 1. comentarios_lectura: texto citado + contenido opcional ──
ALTER TABLE public.comentarios_lectura
  ADD COLUMN IF NOT EXISTS texto_citado text;

ALTER TABLE public.comentarios_lectura
  ALTER COLUMN contenido DROP NOT NULL;

-- El CHECK de 051 era inline, así que Postgres le puso este nombre.
ALTER TABLE public.comentarios_lectura
  DROP CONSTRAINT IF EXISTS comentarios_lectura_contenido_check;
ALTER TABLE public.comentarios_lectura
  DROP CONSTRAINT IF EXISTS comentarios_lectura_contenido_max;
ALTER TABLE public.comentarios_lectura
  DROP CONSTRAINT IF EXISTS comentarios_lectura_texto_citado_max;
ALTER TABLE public.comentarios_lectura
  DROP CONSTRAINT IF EXISTS comentarios_lectura_algo_que_mostrar;

ALTER TABLE public.comentarios_lectura
  ADD CONSTRAINT comentarios_lectura_contenido_max
  CHECK (contenido IS NULL OR char_length(btrim(contenido)) BETWEEN 1 AND 500);

-- Tope holgado: un subrayado puede ocupar un párrafo largo entero.
ALTER TABLE public.comentarios_lectura
  ADD CONSTRAINT comentarios_lectura_texto_citado_max
  CHECK (texto_citado IS NULL OR char_length(btrim(texto_citado)) BETWEEN 1 AND 2000);

-- Una fila vacía no pinta nada en el libro.
ALTER TABLE public.comentarios_lectura
  ADD CONSTRAINT comentarios_lectura_algo_que_mostrar
  CHECK (contenido IS NOT NULL OR texto_citado IS NOT NULL);


-- ── 2. mensajitos: texto citado opcional ─────────────────────
ALTER TABLE public.mensajitos
  ADD COLUMN IF NOT EXISTS texto_citado text;

ALTER TABLE public.mensajitos
  DROP CONSTRAINT IF EXISTS mensajitos_texto_citado_max;
ALTER TABLE public.mensajitos
  ADD CONSTRAINT mensajitos_texto_citado_max
  CHECK (texto_citado IS NULL OR char_length(btrim(texto_citado)) BETWEEN 1 AND 2000);


-- ── 3. Denuncias: la copia incluye la frase citada ───────────
-- Un subrayado sin comentario tiene contenido NULL: sin esto la
-- denuncia llegaría vacía.
CREATE OR REPLACE FUNCTION public._denuncia_copiar_contenido()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_texto     text;
  v_comunidad uuid;
BEGIN
  IF NEW.tipo = 'foro' THEN
    SELECT contenido, comunidad_id INTO v_texto, v_comunidad
    FROM foros_comentarios
    WHERE id = NEW.objeto_id AND (comunidad_id IS NULL OR es_miembro(comunidad_id));

  ELSIF NEW.tipo = 'comentario_lectura' THEN
    SELECT concat_ws(E'\n— ', '«' || texto_citado || '»', contenido), comunidad_id
      INTO v_texto, v_comunidad
    FROM comentarios_lectura
    WHERE id = NEW.objeto_id AND es_miembro(comunidad_id);

  ELSIF NEW.tipo = 'mensajito' THEN
    SELECT concat_ws(E'\n— ', '«' || texto_citado || '»', contenido), comunidad_id
      INTO v_texto, v_comunidad
    FROM mensajitos
    WHERE id = NEW.objeto_id AND auth.uid() IN (de_id, para_id);

  ELSIF NEW.tipo = 'comunidad' THEN
    SELECT nombre || coalesce(' — ' || descripcion, ''), id INTO v_texto, v_comunidad
    FROM comunidades
    WHERE id = NEW.objeto_id AND (NOT privada OR es_miembro(id));
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró lo que quieres denunciar.' USING ERRCODE = 'P0002';
  END IF;

  NEW.contenido_denunciado := v_texto;
  NEW.comunidad_id         := v_comunidad;
  NEW.estado               := 'pendiente';
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public._denuncia_copiar_contenido() FROM PUBLIC, anon, authenticated;


-- =============================================================
-- COMPROBACIÓN
--   · Solo subrayado (debe entrar):
--       INSERT INTO comentarios_lectura (comunidad_id, libro_id, parrafo_id, autor_id, texto_citado)
--       VALUES ('<comunidad>', '<libro>', '<parrafo>', auth.uid(), 'una frase');
--   · Vacío (debe fallar con comentarios_lectura_algo_que_mostrar):
--       mismo INSERT sin texto_citado
-- =============================================================
