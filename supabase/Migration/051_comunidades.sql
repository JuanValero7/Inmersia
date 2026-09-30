-- =============================================================
-- INMERSIA — Migración 051
-- Comunidades: grupos de lectura con libro activo, foro propio,
-- comentarios dentro del libro, mensajitos y denuncias
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- MODELO
--   · Solo quien esté en `creadores_comunidad` puede crear una. Es el
--     permiso binario que hace de "premium" mientras el premium no
--     exista; se da a mano desde el dashboard, igual que superusuarios.
--   · Quien crea la comunidad entra como moderador. El moderador elige
--     el libro activo, si es pública o privada, expulsa miembros y
--     modera el foro y los comentarios de la comunidad.
--   · Pública  → cualquiera con sesión la ve y se une directamente.
--     Privada  → solo la ven sus miembros; se entra con el código de
--     invitación, que solo ve el moderador (unirse_con_codigo()).
--   · Tope de 5 comunidades por persona (ver TOPE_COMUNIDADES abajo).
--   · Si el último moderador se va o borra su cuenta, hereda el
--     miembro más antiguo. Si no queda nadie, la comunidad se borra.
--
-- EDAD
--   Entrar a una comunidad no pide nada extra: la cuenta ya exige 14.
--   Los mensajitos son contacto directo entre dos personas, así que
--   siguen la regla del chat (16, src/lib/edad.js) — pero aquí se
--   comprueba EN LA BASE DE DATOS, para ambas partes, no en el cliente.
--   Igual que en edad.js, sin fecha de nacimiento se deja pasar.
--
-- SPOILERS
--   Los comentarios y mensajitos van anclados a un párrafo. Mostrar
--   solo los de párrafos ya leídos es tarea del cliente (misma regla de
--   revelado que la cartelera): no es un dato sensible, y hacerlo en la
--   RLS obligaría a ordenar capítulos y párrafos en cada fila.
--
-- ORDEN DE DESPLIEGUE
--   1. Esta migración.
--   2. Después, ForoComentarios.jsx debe filtrar el foro general con
--      .is('comunidad_id', null). Mientras nadie cree una comunidad no
--      cambia nada, así que no hay prisa entre un paso y otro.
--
-- RGPD
--   Todo cuelga de auth.users con ON DELETE CASCADE, así que
--   eliminar_mi_cuenta() (043) se lleva también lo de esta migración.
--   Pendiente fuera del SQL: política de privacidad y misDatos.js.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- 1. Permiso para crear comunidades
-- ═════════════════════════════════════════════════════════════
-- Tabla aparte y no una columna en `perfiles`: cada usuario puede
-- editar su propia fila de perfiles, así que podría dárselo solo.
-- Aquí no hay INSERT/UPDATE/DELETE para `authenticated`.
CREATE TABLE IF NOT EXISTS public.creadores_comunidad (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creadores_comunidad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creadores_comunidad_select_own" ON public.creadores_comunidad;
CREATE POLICY "creadores_comunidad_select_own"
  ON public.creadores_comunidad FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ═════════════════════════════════════════════════════════════
-- 2. Tablas
-- ═════════════════════════════════════════════════════════════

-- creador_id queda en NULL si el creador borra su cuenta: la comunidad
-- sigue viva con el heredero (ver trigger de la sección 4).
CREATE TABLE IF NOT EXISTS public.comunidades (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 60),
  descripcion text        CHECK (descripcion IS NULL OR char_length(descripcion) <= 500),
  privada     boolean     NOT NULL DEFAULT false,
  libro_id    uuid        REFERENCES public.libros(id) ON DELETE SET NULL,
  creador_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comunidad_miembros (
  comunidad_id uuid        NOT NULL REFERENCES public.comunidades(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol          text        NOT NULL DEFAULT 'miembro' CHECK (rol IN ('moderador', 'miembro')),
  unido_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comunidad_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comunidad_miembros_user
  ON public.comunidad_miembros (user_id);

-- El código vive en su propia tabla para que solo lo lea el moderador:
-- la RLS filtra filas, no columnas.
CREATE TABLE IF NOT EXISTS public.comunidad_codigos (
  comunidad_id uuid PRIMARY KEY REFERENCES public.comunidades(id) ON DELETE CASCADE,
  codigo       text NOT NULL UNIQUE
               DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
);

CREATE TABLE IF NOT EXISTS public.comentarios_lectura (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comunidad_id uuid        NOT NULL REFERENCES public.comunidades(id) ON DELETE CASCADE,
  libro_id     uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  parrafo_id   uuid        NOT NULL REFERENCES public.parrafos(id) ON DELETE CASCADE,
  autor_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contenido    text        NOT NULL CHECK (char_length(btrim(contenido)) BETWEEN 1 AND 500),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- El lector pide "los comentarios de mis comunidades en este libro".
CREATE INDEX IF NOT EXISTS idx_comentarios_lectura_libro
  ON public.comentarios_lectura (comunidad_id, libro_id, parrafo_id);

CREATE TABLE IF NOT EXISTS public.mensajitos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comunidad_id uuid        NOT NULL REFERENCES public.comunidades(id) ON DELETE CASCADE,
  libro_id     uuid        NOT NULL REFERENCES public.libros(id) ON DELETE CASCADE,
  parrafo_id   uuid        NOT NULL REFERENCES public.parrafos(id) ON DELETE CASCADE,
  de_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  para_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contenido    text        NOT NULL CHECK (char_length(btrim(contenido)) BETWEEN 1 AND 300),
  leido_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (de_id <> para_id)
);

-- El lector pide "las notas que me dejaron en este libro".
CREATE INDEX IF NOT EXISTS idx_mensajitos_para_libro
  ON public.mensajitos (para_id, libro_id);
CREATE INDEX IF NOT EXISTS idx_mensajitos_de
  ON public.mensajitos (de_id);

-- contenido_denunciado: copia del texto en el momento de la denuncia,
-- para poder revisarla aunque el autor lo borre después. La rellena el
-- trigger de la sección 4, nunca el cliente.
CREATE TABLE IF NOT EXISTS public.denuncias (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  denunciante_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo                 text        NOT NULL CHECK (tipo IN ('foro', 'comentario_lectura', 'mensajito', 'comunidad')),
  objeto_id            uuid        NOT NULL,
  comunidad_id         uuid        REFERENCES public.comunidades(id) ON DELETE SET NULL,
  motivo               text        CHECK (motivo IS NULL OR char_length(motivo) <= 1000),
  contenido_denunciado text,
  estado               text        NOT NULL DEFAULT 'pendiente'
                                   CHECK (estado IN ('pendiente', 'revisada', 'descartada')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (denunciante_id, tipo, objeto_id)
);

CREATE INDEX IF NOT EXISTS idx_denuncias_pendientes
  ON public.denuncias (created_at) WHERE estado = 'pendiente';

-- Foro de comunidad = el mismo foro del libro con comunidad_id.
-- NULL = foro general (todas las filas existentes).
ALTER TABLE public.foros_comentarios
  ADD COLUMN IF NOT EXISTS comunidad_id uuid REFERENCES public.comunidades(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_foros_comentarios_comunidad
  ON public.foros_comentarios (comunidad_id, foro_id, created_at DESC)
  WHERE comunidad_id IS NOT NULL;


-- ═════════════════════════════════════════════════════════════
-- 3. Funciones auxiliares para la RLS
-- ═════════════════════════════════════════════════════════════
-- SECURITY DEFINER a propósito: las políticas de comunidad_miembros
-- necesitan preguntar "¿es miembro?" sobre la propia tabla, y hacerlo
-- con una subconsulta normal entraría en recursión infinita de RLS.
-- Ninguna recibe el usuario como parámetro: siempre es auth.uid().

CREATE OR REPLACE FUNCTION public.es_miembro(c uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM comunidad_miembros
    WHERE comunidad_id = c AND user_id = auth.uid()
  );
$fn$;

CREATE OR REPLACE FUNCTION public.es_moderador(c uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM comunidad_miembros
    WHERE comunidad_id = c AND user_id = auth.uid() AND rol = 'moderador'
  );
$fn$;

CREATE OR REPLACE FUNCTION public.es_superusuario()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (SELECT 1 FROM superusuarios WHERE user_id = auth.uid());
$fn$;

-- ¿Puede esta persona recibir o mandar contacto directo? Misma regla
-- que puedeUsarChat() en src/lib/edad.js: 16 años, y sin fecha se deja
-- pasar. Esta sí recibe el uid, porque hay que comprobar también al
-- destinatario; solo devuelve un booleano, nunca la fecha.
CREATE OR REPLACE FUNCTION public.edad_permite_contacto(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(
    (SELECT extract(year FROM age(current_date, p.fecha_nacimiento)) >= 16
     FROM perfiles p WHERE p.id = uid),
    true
  );
$fn$;

REVOKE ALL ON FUNCTION public.es_miembro(uuid)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.es_moderador(uuid)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.es_superusuario()             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.edad_permite_contacto(uuid)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_miembro(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_moderador(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_superusuario()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.edad_permite_contacto(uuid) TO authenticated;


-- ═════════════════════════════════════════════════════════════
-- 4. Triggers
-- ═════════════════════════════════════════════════════════════

-- ── 4a. Al crear una comunidad: el creador entra como moderador y se
--        genera el código de invitación.
CREATE OR REPLACE FUNCTION public._comunidad_al_crear()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO comunidad_miembros (comunidad_id, user_id, rol)
  VALUES (NEW.id, NEW.creador_id, 'moderador');

  INSERT INTO comunidad_codigos (comunidad_id) VALUES (NEW.id);
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_comunidad_al_crear ON public.comunidades;
CREATE TRIGGER trg_comunidad_al_crear
  AFTER INSERT ON public.comunidades
  FOR EACH ROW EXECUTE FUNCTION public._comunidad_al_crear();

-- ── 4b. Tope de comunidades por persona. Cuenta también la que uno
--        crea (el creador entra como miembro), así que crear la sexta
--        falla entera, sin dejar una comunidad sin moderador.
CREATE OR REPLACE FUNCTION public._comunidad_tope_miembro()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  TOPE_COMUNIDADES CONSTANT int := 5;
BEGIN
  IF (SELECT count(*) FROM comunidad_miembros WHERE user_id = NEW.user_id) >= TOPE_COMUNIDADES THEN
    RAISE EXCEPTION 'Ya estás en % comunidades, el máximo permitido.', TOPE_COMUNIDADES
      USING ERRCODE = 'P0001', HINT = 'tope_comunidades';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_comunidad_tope_miembro ON public.comunidad_miembros;
CREATE TRIGGER trg_comunidad_tope_miembro
  BEFORE INSERT ON public.comunidad_miembros
  FOR EACH ROW EXECUTE FUNCTION public._comunidad_tope_miembro();

-- ── 4c. Cuando alguien sale (se va, lo expulsan o borra su cuenta):
--        si era el último moderador, hereda el miembro más antiguo; si
--        no queda nadie, se borra la comunidad.
--        El primer IF evita actuar cuando la baja viene del CASCADE de
--        borrar la propia comunidad.
CREATE OR REPLACE FUNCTION public._comunidad_tras_baja()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  heredero uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM comunidades WHERE id = OLD.comunidad_id) THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM comunidad_miembros WHERE comunidad_id = OLD.comunidad_id) THEN
    DELETE FROM comunidades WHERE id = OLD.comunidad_id;
    RETURN NULL;
  END IF;

  IF OLD.rol = 'moderador' AND NOT EXISTS (
    SELECT 1 FROM comunidad_miembros
    WHERE comunidad_id = OLD.comunidad_id AND rol = 'moderador'
  ) THEN
    SELECT user_id INTO heredero
    FROM comunidad_miembros
    WHERE comunidad_id = OLD.comunidad_id
    ORDER BY unido_at, user_id
    LIMIT 1;

    UPDATE comunidad_miembros SET rol = 'moderador'
    WHERE comunidad_id = OLD.comunidad_id AND user_id = heredero;
  END IF;

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_comunidad_tras_baja ON public.comunidad_miembros;
CREATE TRIGGER trg_comunidad_tras_baja
  AFTER DELETE ON public.comunidad_miembros
  FOR EACH ROW EXECUTE FUNCTION public._comunidad_tras_baja();

-- ── 4d. Denuncias: comprobar que quien denuncia puede ver lo que
--        denuncia (si no, el trigger serviría para leer mensajitos
--        ajenos a través de la copia) y guardar la copia del texto.
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
    SELECT contenido, comunidad_id INTO v_texto, v_comunidad
    FROM comentarios_lectura
    WHERE id = NEW.objeto_id AND es_miembro(comunidad_id);

  ELSIF NEW.tipo = 'mensajito' THEN
    SELECT contenido, comunidad_id INTO v_texto, v_comunidad
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

DROP TRIGGER IF EXISTS trg_denuncia_copiar_contenido ON public.denuncias;
CREATE TRIGGER trg_denuncia_copiar_contenido
  BEFORE INSERT ON public.denuncias
  FOR EACH ROW EXECUTE FUNCTION public._denuncia_copiar_contenido();


-- ═════════════════════════════════════════════════════════════
-- 5. RLS
-- ═════════════════════════════════════════════════════════════
ALTER TABLE public.comunidades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidad_miembros  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidad_codigos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios_lectura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajitos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias           ENABLE ROW LEVEL SECURITY;

-- ── comunidades ──────────────────────────────────────────────
DROP POLICY IF EXISTS "comunidades_select" ON public.comunidades;
CREATE POLICY "comunidades_select"
  ON public.comunidades FOR SELECT TO authenticated
  USING (NOT privada OR es_miembro(id) OR es_superusuario());

DROP POLICY IF EXISTS "comunidades_insert" ON public.comunidades;
CREATE POLICY "comunidades_insert"
  ON public.comunidades FOR INSERT TO authenticated
  WITH CHECK (
    creador_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.creadores_comunidad cc WHERE cc.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "comunidades_update" ON public.comunidades;
CREATE POLICY "comunidades_update"
  ON public.comunidades FOR UPDATE TO authenticated
  USING (es_moderador(id))
  WITH CHECK (es_moderador(id));

DROP POLICY IF EXISTS "comunidades_delete" ON public.comunidades;
CREATE POLICY "comunidades_delete"
  ON public.comunidades FOR DELETE TO authenticated
  USING (es_moderador(id) OR es_superusuario());

-- El moderador solo edita estas cuatro columnas (nunca creador_id).
REVOKE UPDATE ON public.comunidades FROM anon, authenticated;
GRANT UPDATE (nombre, descripcion, privada, libro_id) ON public.comunidades TO authenticated;

-- ── comunidad_miembros ──────────────────────────────────────
-- Sin UPDATE para el cliente: el rol solo lo cambia el trigger 4c.
DROP POLICY IF EXISTS "comunidad_miembros_select" ON public.comunidad_miembros;
CREATE POLICY "comunidad_miembros_select"
  ON public.comunidad_miembros FOR SELECT TO authenticated
  USING (es_miembro(comunidad_id) OR es_superusuario());

-- Unirse directamente: solo a públicas y solo como miembro. A las
-- privadas se entra con unirse_con_codigo().
DROP POLICY IF EXISTS "comunidad_miembros_insert" ON public.comunidad_miembros;
CREATE POLICY "comunidad_miembros_insert"
  ON public.comunidad_miembros FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND rol = 'miembro'
    AND EXISTS (SELECT 1 FROM public.comunidades c WHERE c.id = comunidad_id AND NOT c.privada)
  );

-- Salirse (la fila propia) o expulsar (moderador).
DROP POLICY IF EXISTS "comunidad_miembros_delete" ON public.comunidad_miembros;
CREATE POLICY "comunidad_miembros_delete"
  ON public.comunidad_miembros FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR es_moderador(comunidad_id) OR es_superusuario());

-- ── comunidad_codigos ───────────────────────────────────────
-- Solo lectura para el moderador; se regenera con regenerar_codigo().
DROP POLICY IF EXISTS "comunidad_codigos_select" ON public.comunidad_codigos;
CREATE POLICY "comunidad_codigos_select"
  ON public.comunidad_codigos FOR SELECT TO authenticated
  USING (es_moderador(comunidad_id));

-- ── comentarios_lectura ─────────────────────────────────────
DROP POLICY IF EXISTS "comentarios_lectura_select" ON public.comentarios_lectura;
CREATE POLICY "comentarios_lectura_select"
  ON public.comentarios_lectura FOR SELECT TO authenticated
  USING (es_miembro(comunidad_id) OR es_superusuario());

-- El párrafo tiene que ser de ese libro y visible para quien comenta
-- (la subconsulta pasa por parrafos_select, migración 037: solo se
-- comenta un libro que uno tiene).
DROP POLICY IF EXISTS "comentarios_lectura_insert" ON public.comentarios_lectura;
CREATE POLICY "comentarios_lectura_insert"
  ON public.comentarios_lectura FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = (SELECT auth.uid())
    AND es_miembro(comunidad_id)
    AND EXISTS (SELECT 1 FROM public.parrafos p WHERE p.id = parrafo_id AND p.libro_id = comentarios_lectura.libro_id)
  );

DROP POLICY IF EXISTS "comentarios_lectura_delete" ON public.comentarios_lectura;
CREATE POLICY "comentarios_lectura_delete"
  ON public.comentarios_lectura FOR DELETE TO authenticated
  USING (autor_id = (SELECT auth.uid()) OR es_moderador(comunidad_id) OR es_superusuario());

-- ── mensajitos ──────────────────────────────────────────────
-- Privados entre dos personas: ni el moderador los lee. Si algo va
-- mal, el destinatario denuncia y la copia queda en `denuncias`.
DROP POLICY IF EXISTS "mensajitos_select" ON public.mensajitos;
CREATE POLICY "mensajitos_select"
  ON public.mensajitos FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (de_id, para_id));

DROP POLICY IF EXISTS "mensajitos_insert" ON public.mensajitos;
CREATE POLICY "mensajitos_insert"
  ON public.mensajitos FOR INSERT TO authenticated
  WITH CHECK (
    de_id = (SELECT auth.uid())
    AND es_miembro(comunidad_id)
    AND EXISTS (
      SELECT 1 FROM public.comunidad_miembros m
      WHERE m.comunidad_id = mensajitos.comunidad_id AND m.user_id = para_id
    )
    AND edad_permite_contacto(de_id)
    AND edad_permite_contacto(para_id)
    AND EXISTS (SELECT 1 FROM public.parrafos p WHERE p.id = parrafo_id AND p.libro_id = mensajitos.libro_id)
  );

-- El destinatario solo puede marcarlo como leído.
DROP POLICY IF EXISTS "mensajitos_update" ON public.mensajitos;
CREATE POLICY "mensajitos_update"
  ON public.mensajitos FOR UPDATE TO authenticated
  USING (para_id = (SELECT auth.uid()))
  WITH CHECK (para_id = (SELECT auth.uid()));

REVOKE UPDATE ON public.mensajitos FROM anon, authenticated;
GRANT UPDATE (leido_at) ON public.mensajitos TO authenticated;

DROP POLICY IF EXISTS "mensajitos_delete" ON public.mensajitos;
CREATE POLICY "mensajitos_delete"
  ON public.mensajitos FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IN (de_id, para_id));

-- ── denuncias ───────────────────────────────────────────────
DROP POLICY IF EXISTS "denuncias_select" ON public.denuncias;
CREATE POLICY "denuncias_select"
  ON public.denuncias FOR SELECT TO authenticated
  USING (denunciante_id = (SELECT auth.uid()) OR es_superusuario());

DROP POLICY IF EXISTS "denuncias_insert" ON public.denuncias;
CREATE POLICY "denuncias_insert"
  ON public.denuncias FOR INSERT TO authenticated
  WITH CHECK (denunciante_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "denuncias_update" ON public.denuncias;
CREATE POLICY "denuncias_update"
  ON public.denuncias FOR UPDATE TO authenticated
  USING (es_superusuario())
  WITH CHECK (es_superusuario());

-- ── foros_comentarios: foro general + foros de comunidad ────
-- Reemplaza las políticas de 000_politicas_actuales.sql:
--   select: antes USING (true) → ahora el general + el de mis comunidades.
--   insert: además, solo en comunidades propias, y las respuestas en el
--           mismo foro que el comentario al que responden.
DROP POLICY IF EXISTS "foros_comentarios_select" ON public.foros_comentarios;
CREATE POLICY "foros_comentarios_select"
  ON public.foros_comentarios FOR SELECT TO authenticated
  USING (comunidad_id IS NULL OR es_miembro(comunidad_id) OR es_superusuario());

DROP POLICY IF EXISTS "foros_comentarios_insert" ON public.foros_comentarios;
CREATE POLICY "foros_comentarios_insert"
  ON public.foros_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = (SELECT auth.uid())
    AND (comunidad_id IS NULL OR es_miembro(comunidad_id))
    AND (
      parent_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.foros_comentarios padre
        -- calificado: `padre` también tiene parent_id y lo taparía
        WHERE padre.id = foros_comentarios.parent_id
          AND padre.comunidad_id IS NOT DISTINCT FROM foros_comentarios.comunidad_id
      )
    )
  );

-- Aparte de foros_comentarios_delete (autor) y de
-- superusuario_comentarios_delete (039): se suman con OR.
DROP POLICY IF EXISTS "moderador_comentarios_delete" ON public.foros_comentarios;
CREATE POLICY "moderador_comentarios_delete"
  ON public.foros_comentarios FOR DELETE TO authenticated
  USING (comunidad_id IS NOT NULL AND es_moderador(comunidad_id));


-- ═════════════════════════════════════════════════════════════
-- 6. Funciones que llama la app
-- ═════════════════════════════════════════════════════════════

-- ── 6a. Entrar a una comunidad privada con su código.
--        Devuelve el id de la comunidad. Si ya eras miembro, no falla.
CREATE OR REPLACE FUNCTION public.unirse_con_codigo(p_codigo text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid uuid := auth.uid();
  v_comunidad uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión.';
  END IF;

  SELECT comunidad_id INTO v_comunidad
  FROM comunidad_codigos
  WHERE codigo = upper(btrim(p_codigo));

  IF v_comunidad IS NULL THEN
    RAISE EXCEPTION 'El código no es válido.' USING ERRCODE = 'P0002', HINT = 'codigo_invalido';
  END IF;

  -- Antes del INSERT: si ya estaba dentro, el trigger del tope no debe
  -- saltar por una comunidad que ya cuenta.
  IF NOT EXISTS (SELECT 1 FROM comunidad_miembros WHERE comunidad_id = v_comunidad AND user_id = uid) THEN
    INSERT INTO comunidad_miembros (comunidad_id, user_id, rol)
    VALUES (v_comunidad, uid, 'miembro');
  END IF;

  RETURN v_comunidad;
END;
$fn$;

-- ── 6b. Código nuevo (p. ej. si el anterior circuló de más).
--        El viejo deja de servir; quien ya entró sigue dentro.
CREATE OR REPLACE FUNCTION public.regenerar_codigo(p_comunidad uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_codigo text;
BEGIN
  IF NOT es_moderador(p_comunidad) THEN
    RAISE EXCEPTION 'Solo el moderador puede cambiar el código.' USING ERRCODE = '42501';
  END IF;

  UPDATE comunidad_codigos
  SET codigo = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  WHERE comunidad_id = p_comunidad
  RETURNING codigo INTO v_codigo;

  RETURN v_codigo;
END;
$fn$;

-- ── 6c. El "camino": avance de cada miembro.
--        progreso_lectura sigue cerrada a la fila propia (000); esta
--        función abre SOLO lo necesario y SOLO a otros miembros:
--          · porcentaje en el libro de la comunidad
--          · cuándo leyó por última vez (cualquier libro)
--          · si lo último que leyó es OTRO libro, cuál
--        Nunca el párrafo exacto ni el resto de su biblioteca.
CREATE OR REPLACE FUNCTION public.progreso_comunidad(p_comunidad uuid)
RETURNS TABLE (
  user_id          uuid,
  nombre           text,
  apellido         text,
  rol              text,
  porcentaje       smallint,
  ultima_lectura   timestamptz,
  otro_libro_id    uuid,
  otro_libro_titulo text,
  otro_libro_portada text,
  otro_porcentaje  smallint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT es_miembro(p_comunidad) THEN
    RAISE EXCEPTION 'Solo los miembros ven el avance de la comunidad.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    pf.nombre::text,
    pf.apellido::text,
    m.rol,
    pc.porcentaje,
    ult.updated_at,
    CASE WHEN ult.libro_id IS DISTINCT FROM c.libro_id THEN ult.libro_id END,
    CASE WHEN ult.libro_id IS DISTINCT FROM c.libro_id THEN l.titulo::text END,
    CASE WHEN ult.libro_id IS DISTINCT FROM c.libro_id THEN l.portada_url::text END,
    CASE WHEN ult.libro_id IS DISTINCT FROM c.libro_id THEN ult.porcentaje END
  FROM comunidad_miembros m
  JOIN comunidades c        ON c.id = m.comunidad_id
  LEFT JOIN perfiles pf     ON pf.id = m.user_id
  LEFT JOIN progreso_lectura pc
         ON pc.user_id = m.user_id AND pc.libro_id = c.libro_id
  LEFT JOIN LATERAL (
    SELECT pl.libro_id, pl.porcentaje, pl.updated_at
    FROM progreso_lectura pl
    WHERE pl.user_id = m.user_id
    ORDER BY pl.updated_at DESC
    LIMIT 1
  ) ult ON true
  LEFT JOIN libros l ON l.id = ult.libro_id
  WHERE m.comunidad_id = p_comunidad
  ORDER BY pc.porcentaje DESC NULLS LAST, m.unido_at;
END;
$fn$;

REVOKE ALL ON FUNCTION public.unirse_con_codigo(text)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerar_codigo(uuid)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.progreso_comunidad(uuid)    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unirse_con_codigo(text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerar_codigo(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.progreso_comunidad(uuid) TO authenticated;

-- Los triggers no se llaman desde la API.
REVOKE ALL ON FUNCTION public._comunidad_al_crear()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._comunidad_tope_miembro()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._comunidad_tras_baja()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._denuncia_copiar_contenido() FROM PUBLIC, anon, authenticated;


-- =============================================================
-- COMPROBACIÓN (con tu usuario, desde la app o con "Run as user")
--
--   0. Darte el permiso (dashboard, como postgres):
--        INSERT INTO creadores_comunidad (user_id) VALUES ('<tu uid>');
--
--   1. Crear: INSERT INTO comunidades (nombre, creador_id)
--             VALUES ('Prueba', auth.uid()) RETURNING id;
--      Esperado: una fila en comunidad_miembros con rol 'moderador'
--      y una en comunidad_codigos.
--
--   2. Sin permiso (otro usuario): el mismo INSERT
--      Esperado: new row violates row-level security policy
--
--   3. Tope: unirse a una sexta comunidad
--      Esperado: 'Ya estás en 5 comunidades, el máximo permitido.'
--
--   4. Herencia: con dos miembros, borrar la fila del moderador
--      Esperado: el otro pasa a 'moderador'. Borrar también la suya
--      → la comunidad desaparece.
--
--   5. Foro general intacto: SELECT count(*) FROM foros_comentarios
--      WHERE comunidad_id IS NULL;  → mismo número que antes.
--
--   6. Menor de 16: insertar un mensajito a alguien con fecha de
--      nacimiento de hace 15 años
--      Esperado: new row violates row-level security policy
--
--   7. Denunciar un mensajito ajeno por su id
--      Esperado: 'No se encontró lo que quieres denunciar.'
-- =============================================================
