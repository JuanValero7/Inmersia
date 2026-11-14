-- ═════════════════════════════════════════════════════════════
-- 120 · Solicitudes para ser escritor
-- ═════════════════════════════════════════════════════════════
-- La landing de escritores (/escritores) tiene un pop-up «Quiero ser
-- escritor» con nombre y correo. Por ahora NO se manda ningún correo
-- (sin Resend todavía): la solicitud queda en esta tabla y Juan la ve con
--
--   npm run escritor                 → lista las pendientes
--   npm run escritor -- correo@x.com → crea/invita la cuenta y activa el modo escritor
--
-- Nadie lee ni escribe la tabla desde el navegador: solo la función
-- solicitar_escritor() (anon y authenticated), con validación y topes
-- contra el spam. activar_escritor() solo la llama el script (service_role).
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.solicitudes_escritor (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre    text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  correo    text NOT NULL CHECK (char_length(correo) BETWEEN 3 AND 254),
  user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- si la pidió con sesión iniciada
  creado    timestamptz NOT NULL DEFAULT now(),
  atendida  timestamptz                                           -- cuándo se activó el modo escritor
);

CREATE INDEX IF NOT EXISTS solicitudes_escritor_pendientes
  ON public.solicitudes_escritor (creado) WHERE atendida IS NULL;
CREATE INDEX IF NOT EXISTS solicitudes_escritor_correo
  ON public.solicitudes_escritor (lower(correo));

ALTER TABLE public.solicitudes_escritor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.solicitudes_escritor FROM anon, authenticated;


-- ── Pedirlo (desde la landing) ───────────────────────────────
-- Devuelve 'ok' también si ya estaba pedida (no le decimos a nadie qué
-- correos están en la tabla). Topes: el mismo correo una vez al día; en
-- total, 30 por hora (si alguien la llena de basura, la tabla no crece sin fin).
CREATE OR REPLACE FUNCTION public.solicitar_escritor(p_nombre text, p_correo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_correo text := lower(btrim(coalesce(p_correo, '')));
BEGIN
  IF char_length(v_nombre) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'nombre_invalido' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_correo) > 254 OR v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'correo_invalido' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM solicitudes_escritor
             WHERE lower(correo) = v_correo AND creado > now() - interval '1 day') THEN
    RETURN 'ok';
  END IF;
  IF (SELECT count(*) FROM solicitudes_escritor WHERE creado > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'demasiadas_solicitudes' USING ERRCODE = '54000';
  END IF;

  INSERT INTO solicitudes_escritor (nombre, correo, user_id)
  VALUES (v_nombre, v_correo, auth.uid());
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.solicitar_escritor(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.solicitar_escritor(text, text) TO anon, authenticated;


-- ── Activarlo (solo el script de Juan, con service_role) ─────
-- Busca la cuenta por correo. Si existe: le da el modo escritor (fila en
-- escritores) y marca sus solicitudes como atendidas.
-- Devuelve 'activado' | 'ya_era' | 'sin_cuenta' (el script entonces la invita
-- y vuelve a llamar).
CREATE OR REPLACE FUNCTION public.activar_escritor(p_correo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correo text := lower(btrim(coalesce(p_correo, '')));
  v_uid    uuid;
  v_nuevo  boolean;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = v_correo LIMIT 1;
  IF v_uid IS NULL THEN
    RETURN 'sin_cuenta';
  END IF;

  INSERT INTO escritores (user_id) VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;
  v_nuevo := FOUND;

  UPDATE solicitudes_escritor SET atendida = now()
  WHERE lower(correo) = v_correo AND atendida IS NULL;

  RETURN CASE WHEN v_nuevo THEN 'activado' ELSE 'ya_era' END;
END;
$$;

REVOKE ALL ON FUNCTION public.activar_escritor(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activar_escritor(text) TO service_role;
