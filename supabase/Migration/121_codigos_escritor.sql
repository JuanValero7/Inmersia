-- ═════════════════════════════════════════════════════════════
-- 121 · Códigos de escritor (como los de colegios)
-- ═════════════════════════════════════════════════════════════
-- El modo escritor se da con un código, igual que un colegio:
--
--   1. Ver quién lo pidió desde la landing (/escritores):
--        SELECT nombre, correo, creado FROM solicitudes_escritor
--        WHERE atendida IS NULL ORDER BY creado;
--
--   2. Crear el código (SOLO Juan, desde el SQL Editor). Un solo uso,
--      caduca a los 30 días. Saldo de cupón: 35 $ si no se dice otro.
--        SELECT crear_codigo_escritor();
--        SELECT crear_codigo_escritor(50, 'Ana Pérez');   -- otro saldo y una nota
--
--   3. Mandárselo por correo. Con su cuenta de Inmersia lo canjea en
--      «Tengo una invitación» (canjear_codigo, el mismo campo de los
--      colegios) → queda con el modo escritor y la app lo lleva a su estudio.
--
-- 35 $ alcanzan para: análisis de cartelera (5) + análisis de imágenes (5)
-- + 10 ilustraciones (5) + análisis de sonidos (5) + 100 sonidos (15).
-- La portada es gratis.
--
-- Reemplaza la activación por terminal de la 120 (activar_escritor y
-- `npm run escritor`, que se borran).
-- ═════════════════════════════════════════════════════════════

-- ── Saldo por defecto del cupón: de 50 a 35 $ ─────────────────
ALTER TABLE public.escritores ALTER COLUMN saldo_cupon SET DEFAULT 35;


-- ── Códigos ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escritor_codigos (
  codigo     text          PRIMARY KEY CHECK (codigo ~ '^ESCR-[A-Z0-9]{8}$'),
  saldo      numeric(8,2)  NOT NULL DEFAULT 35 CHECK (saldo >= 0),
  nota       text          CHECK (nota IS NULL OR char_length(nota) <= 200),
  creado     timestamptz   NOT NULL DEFAULT now(),
  expira_at  timestamptz   NOT NULL DEFAULT now() + interval '30 days'
);

ALTER TABLE public.escritor_codigos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.escritor_codigos FROM anon, authenticated;


-- ── Crear un código (SOLO Juan, desde el SQL Editor) ──────────
CREATE OR REPLACE FUNCTION public.crear_codigo_escritor(p_saldo numeric DEFAULT 35, p_nota text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_codigo text := _codigo_colegio('ESCR');
BEGIN
  INSERT INTO escritor_codigos (codigo, saldo, nota)
  VALUES (v_codigo, coalesce(p_saldo, 35), nullif(btrim(p_nota), ''));
  RETURN v_codigo;
END;
$fn$;

REVOKE ALL ON FUNCTION public.crear_codigo_escritor(numeric, text) FROM PUBLIC, anon, authenticated;


-- ── Canjear: el de la 085 + los códigos ESCR-… ─────────────────
-- Ya escritor: el saldo del código se SUMA al que tiene.
CREATE OR REPLACE FUNCTION public.canjear_codigo(p_codigo text, p_nombre_en_aula text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  uid         uuid := auth.uid();
  v_codigo    text := upper(btrim(p_codigo));
  v_nombre    text := nullif(btrim(regexp_replace(coalesce(p_nombre_en_aula, ''), '\s+', ' ', 'g')), '');
  r           colegio_codigos%ROWTYPE;
  e           escritor_codigos%ROWTYPE;
  v_comunidad uuid;
  v_colegio   uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.';
  END IF;

  -- Código de escritor.
  IF v_codigo LIKE 'ESCR-%' THEN
    DELETE FROM escritor_codigos                      -- un solo uso
    WHERE codigo = v_codigo AND expira_at > now()
    RETURNING * INTO e;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El código no es válido.' USING ERRCODE = 'P0002', HINT = 'codigo_invalido';
    END IF;

    INSERT INTO escritores (user_id, saldo_cupon) VALUES (uid, e.saldo)
    ON CONFLICT (user_id) DO UPDATE SET saldo_cupon = escritores.saldo_cupon + EXCLUDED.saldo_cupon;

    UPDATE solicitudes_escritor SET atendida = now()
    WHERE atendida IS NULL
      AND lower(correo) = (SELECT lower(email) FROM auth.users WHERE id = uid);

    RETURN jsonb_build_object('tipo', 'escritor', 'colegio_id', NULL, 'comunidad_id', NULL);
  END IF;

  -- Códigos del colegio (llevan guion).
  IF position('-' IN v_codigo) > 0 THEN
    SELECT * INTO r FROM colegio_codigos
    WHERE codigo = v_codigo AND (expira_at IS NULL OR expira_at > now());

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El código no es válido.' USING ERRCODE = 'P0002', HINT = 'codigo_invalido';
    END IF;

    IF r.tipo = 'admin' THEN
      INSERT INTO colegio_admins (colegio_id, user_id) VALUES (r.colegio_id, uid)
      ON CONFLICT DO NOTHING;
      DELETE FROM colegio_codigos WHERE codigo = v_codigo;   -- un solo uso
      RETURN jsonb_build_object('tipo', 'admin', 'colegio_id', r.colegio_id);
    END IF;

    -- Profesor: si ya estaba en el aula como alumno, pasa a moderador.
    INSERT INTO comunidad_miembros (comunidad_id, user_id, rol)
    VALUES (r.comunidad_id, uid, 'moderador')
    ON CONFLICT (comunidad_id, user_id) DO UPDATE SET rol = 'moderador';
    PERFORM _dar_libro_aula(r.comunidad_id, uid);

    RETURN jsonb_build_object('tipo', 'profesor', 'colegio_id', r.colegio_id, 'comunidad_id', r.comunidad_id);
  END IF;

  -- ¿Aula o comunidad normal?
  SELECT cc.comunidad_id, co.colegio_id INTO v_comunidad, v_colegio
  FROM comunidad_codigos cc JOIN comunidades co ON co.id = cc.comunidad_id
  WHERE cc.codigo = v_codigo;

  IF v_comunidad IS NULL THEN
    RAISE EXCEPTION 'El código no es válido.' USING ERRCODE = 'P0002', HINT = 'codigo_invalido';
  END IF;

  IF v_colegio IS NULL THEN
    PERFORM unirse_con_codigo(v_codigo);
    RETURN jsonb_build_object('tipo', 'comunidad', 'colegio_id', NULL, 'comunidad_id', v_comunidad);
  END IF;

  -- Aula. La app avisa con el HINT y muestra los campos de nombre.
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'Para entrar a un aula hacen falta tu nombre y apellido.'
      USING ERRCODE = 'P0001', HINT = 'falta_nombre_aula';
  END IF;

  -- Si ya estaba (alumno o profe), solo se corrige el nombre; el rol no cambia.
  INSERT INTO comunidad_miembros (comunidad_id, user_id, rol, nombre_en_aula)
  VALUES (v_comunidad, uid, 'miembro', v_nombre)
  ON CONFLICT (comunidad_id, user_id) DO UPDATE SET nombre_en_aula = EXCLUDED.nombre_en_aula;
  PERFORM _dar_libro_aula(v_comunidad, uid);

  RETURN jsonb_build_object('tipo', 'alumno', 'colegio_id', v_colegio, 'comunidad_id', v_comunidad);
END;
$fn$;

REVOKE ALL ON FUNCTION public.canjear_codigo(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canjear_codigo(text, text) TO authenticated;


-- ── Fuera la activación por terminal de la 120 ────────────────
DROP FUNCTION IF EXISTS public.activar_escritor(text);
