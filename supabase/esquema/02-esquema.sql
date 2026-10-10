-- =============================================================
-- INMERSIA — Esquema public (tablas, funciones, RLS, políticas, permisos)
-- Volcado de producción del 2026-10-10 con `npm run esquema`.
-- NO SE EDITA A MANO: se regenera. Cómo restaurarlo:
-- Documentation/base-de-datos/respaldo-estructura.md
-- =============================================================

--
-- PostgreSQL database dump
--

\restrict inmersia

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: _asignar_manual(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._asignar_manual(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO bibliotecas_usuarios (user_id, libro_id, leido)
  VALUES (p_user_id, '00000000-0000-4000-8000-000000000001', false)
  ON CONFLICT (user_id, libro_id) DO NOTHING;
END;
$$;


--
-- Name: _check_usuario_sin_sesion_activa(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._check_usuario_sin_sesion_activa() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM chat_sesiones
    WHERE usuario_a = NEW.usuario_a
       OR usuario_b = NEW.usuario_a
       OR usuario_a = NEW.usuario_b
       OR usuario_b = NEW.usuario_b
  ) THEN
    RAISE EXCEPTION 'El usuario ya tiene una sesión de chat activa';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: _comunidad_al_crear(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._comunidad_al_crear() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO comunidad_miembros (comunidad_id, user_id, rol)
  VALUES (NEW.id, NEW.creador_id, 'moderador');

  INSERT INTO comunidad_codigos (comunidad_id) VALUES (NEW.id);
  RETURN NULL;
END;
$$;


--
-- Name: _comunidad_cambio_libro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._comunidad_cambio_libro() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: _comunidad_poner_codigo(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._comunidad_poner_codigo(p_comunidad uuid, p_codigo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT es_moderador(p_comunidad) THEN
    RAISE EXCEPTION 'Solo el moderador puede cambiar el código.' USING ERRCODE = '42501';
  END IF;
  UPDATE comunidad_codigos SET codigo = p_codigo WHERE comunidad_id = p_comunidad;
END;
$$;


--
-- Name: _comunidad_tope_miembro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._comunidad_tope_miembro() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  TOPE_COMUNIDADES CONSTANT int := 5;
BEGIN
  IF (SELECT count(*) FROM comunidad_miembros WHERE user_id = NEW.user_id) >= TOPE_COMUNIDADES THEN
    RAISE EXCEPTION 'Ya estás en % comunidades, el máximo permitido.', TOPE_COMUNIDADES
      USING ERRCODE = 'P0001', HINT = 'tope_comunidades';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: _comunidad_tras_baja(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._comunidad_tras_baja() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: _crear_foro_para_libro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._crear_foro_para_libro() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO foros (libro_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;


--
-- Name: _crear_perfil(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._crear_perfil(p_user_id uuid, p_meta jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_completo text   := btrim(coalesce(nullif(p_meta->>'full_name', ''), p_meta->>'name', ''));
  v_partes   text[] := regexp_split_to_array(v_completo, '\s+');
  v_fecha    date;
  v_genero   text   := p_meta->>'genero';
BEGIN
  BEGIN
    v_fecha := nullif(p_meta->>'fecha_nacimiento', '')::date;
  EXCEPTION WHEN others THEN
    v_fecha := NULL;
  END;

  IF v_genero NOT IN ('masculino', 'femenino', 'diverso') THEN
    v_genero := NULL;
  END IF;

  INSERT INTO perfiles (id, nombre, apellido, fecha_nacimiento, genero)
  VALUES (
    p_user_id,
    coalesce(nullif(p_meta->>'nombre', ''), nullif(p_meta->>'given_name', ''), v_partes[1], ''),
    coalesce(nullif(p_meta->>'apellido', ''), nullif(p_meta->>'family_name', ''),
             array_to_string(v_partes[2:], ' ')),
    v_fecha,
    v_genero
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;


--
-- Name: _denuncia_copiar_contenido(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._denuncia_copiar_contenido() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: _trg_fecha_nacimiento_fija(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._trg_fecha_nacimiento_fija() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.fecha_nacimiento IS NOT NULL
     AND NEW.fecha_nacimiento IS DISTINCT FROM OLD.fecha_nacimiento
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'La fecha de nacimiento no se puede cambiar.'
      USING ERRCODE = '42501', HINT = 'fecha_fija';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: _trg_perfil_al_registrarse(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._trg_perfil_al_registrarse() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  BEGIN
    PERFORM _crear_perfil(NEW.id, coalesce(NEW.raw_user_meta_data, '{}'::jsonb));
  EXCEPTION WHEN others THEN
    RAISE WARNING '_crear_perfil(%): % %', NEW.id, SQLSTATE, SQLERRM;
  END;

  BEGIN
    PERFORM _asignar_manual(NEW.id);
  EXCEPTION WHEN others THEN
    RAISE WARNING '_asignar_manual(%): % %', NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;


--
-- Name: adquirir_libro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adquirir_libro(p_libro_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_manual constant uuid := '00000000-0000-4000-8000-000000000001';  -- MANUAL_LIBRO_ID
  -- LIMITE_PENDIENTES de src/hooks/useCompraLibro.js: si cambia uno, cambiar los dos.
  v_limite constant int := 5;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta una sesión.' USING ERRCODE = '42501', HINT = 'sin_sesion';
  END IF;

  -- Dos peticiones a la vez del mismo usuario no se cuelan las dos.
  PERFORM pg_advisory_xact_lock(hashtext('adquirir_libro:' || v_uid));

  IF EXISTS (SELECT 1 FROM bibliotecas_usuarios WHERE user_id = v_uid AND libro_id = p_libro_id) THEN
    RETURN false;
  END IF;

  IF p_libro_id <> v_manual
     AND NOT EXISTS (SELECT 1 FROM superusuarios WHERE user_id = v_uid)
     AND (SELECT count(*) FROM bibliotecas_usuarios
          WHERE user_id = v_uid AND libro_id <> v_manual AND NOT coalesce(leido, false)) >= v_limite
  THEN
    RAISE EXCEPTION 'Ya tienes % lecturas pendientes.', v_limite
      USING ERRCODE = '42501', HINT = 'limite_pendientes';
  END IF;

  INSERT INTO bibliotecas_usuarios (user_id, libro_id, leido)
  VALUES (v_uid, p_libro_id, false);
  RETURN true;
END;
$$;


--
-- Name: buscar_comunidades(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buscar_comunidades(p_texto text DEFAULT ''::text) RETURNS TABLE(id uuid, nombre text, descripcion text, libro_titulo text, libro_portada text, libro_color text, miembros integer, soy_miembro boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: contar_palabras(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.contar_palabras(texto text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE WHEN btrim(coalesce(texto, '')) = '' THEN 0
              ELSE array_length(regexp_split_to_array(btrim(texto), '\s+'), 1) END
$$;


--
-- Name: crear_comunidad(text, text, boolean, text, uuid, date, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_comunidad(p_nombre text, p_descripcion text DEFAULT NULL::text, p_privada boolean DEFAULT false, p_codigo text DEFAULT NULL::text, p_libro_id uuid DEFAULT NULL::uuid, p_fecha_meta date DEFAULT NULL::date, p_encuentro_lugar text DEFAULT NULL::text, p_encuentro_fecha timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  uid      uuid := auth.uid();
  v_id     uuid := gen_random_uuid();
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Hace falta iniciar sesión para crear una comunidad.'
      USING ERRCODE = '42501', HINT = 'sin_sesion';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM creadores_comunidad WHERE user_id = uid) THEN
    RAISE EXCEPTION 'Tu cuenta no tiene permiso para crear comunidades.'
      USING ERRCODE = '42501', HINT = 'sin_permiso_creador';
  END IF;

  IF p_privada AND v_codigo !~ '^[A-Z0-9]{6,20}$' THEN
    RAISE EXCEPTION 'El código debe tener entre 6 y 20 letras o números.'
      USING ERRCODE = '22023', HINT = 'codigo_formato';
  END IF;

  -- Los triggers de 051/054 hacen el resto: meter al creador como
  -- moderador, generar un código, abrir la primera lectura y el tope.
  INSERT INTO comunidades (id, nombre, descripcion, privada, libro_id, creador_id)
  VALUES (v_id, btrim(p_nombre), nullif(btrim(coalesce(p_descripcion, '')), ''), p_privada, p_libro_id, uid);

  IF p_privada THEN
    BEGIN
      UPDATE comunidad_codigos SET codigo = v_codigo WHERE comunidad_id = v_id;
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
$_$;


--
-- Name: delete_parrafo_superuser(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_parrafo_superuser(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_capitulo_id UUID;
  v_numero      INTEGER;
  v_prev_id     UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superusuarios WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado: se requiere superusuario';
  END IF;

  SELECT capitulo_id, numero INTO v_capitulo_id, v_numero
  FROM parrafos WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Párrafo no encontrado: %', p_id;
  END IF;

  -- Párrafo anterior en el mismo capítulo (NULL si es el primero)
  SELECT id INTO v_prev_id
  FROM parrafos
  WHERE capitulo_id = v_capitulo_id AND numero < v_numero
  ORDER BY numero DESC
  LIMIT 1;

  -- Redirigir progreso de cualquier usuario que estuviera aquí
  UPDATE progreso_lectura
  SET ultimo_parrafo_id = v_prev_id
  WHERE ultimo_parrafo_id = p_id;

  -- Borrar párrafo (CASCADE + SET NULL manejan el resto de FKs)
  DELETE FROM parrafos WHERE id = p_id;
END;
$$;


--
-- Name: denuncias_para_revisar(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.denuncias_para_revisar(p_pendientes boolean DEFAULT true) RETURNS TABLE(id uuid, tipo text, objeto_id uuid, estado text, resolucion text, resuelta_at timestamp with time zone, motivo text, contenido text, created_at timestamp with time zone, comunidad_id uuid, comunidad_nombre text, comunidad_privada boolean, comunidad_miembros integer, libro_titulo text, parrafo_texto text, denunciante_nombre text, denunciado_id uuid, denunciado_nombre text, reincidencias integer, original_existe boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: edad_permite_contacto(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edad_permite_contacto(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT extract(year FROM age(current_date, p.fecha_nacimiento)) >= 16
     FROM perfiles p WHERE p.id = uid),
    true
  );
$$;


--
-- Name: eliminar_mi_cuenta(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eliminar_mi_cuenta() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa: eliminar_mi_cuenta() solo se puede llamar desde la app, autenticado.';
  END IF;

  -- El CASCADE de auth.users se lleva todo lo demás.
  DELETE FROM auth.users WHERE id = uid;
END;
$$;


--
-- Name: FUNCTION eliminar_mi_cuenta(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.eliminar_mi_cuenta() IS 'Borra la cuenta de quien la llama (auth.uid()) y, por CASCADE, todos sus datos. Derecho de supresión, art. 17 RGPD. La usa el botón de Perfil → Legal.';


--
-- Name: es_miembro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_miembro(c uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM comunidad_miembros
    WHERE comunidad_id = c AND user_id = auth.uid()
  );
$$;


--
-- Name: es_moderador(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_moderador(c uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM comunidad_miembros
    WHERE comunidad_id = c AND user_id = auth.uid() AND rol = 'moderador'
  );
$$;


--
-- Name: es_superusuario(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_superusuario() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM superusuarios WHERE user_id = auth.uid());
$$;


--
-- Name: foro_recortar_tags(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.foro_recortar_tags() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- coalesce es imprescindible: unnest('{}') no devuelve filas y array_agg
  -- daría NULL, pero la columna es NOT NULL. El caso corriente son justamente
  -- las respuestas, que se insertan con tags = '{}'.
  SELECT coalesce(array_agg(left(t, 40)), '{}')
    INTO NEW.tags
    FROM unnest(coalesce(NEW.tags, '{}')) AS t;
  RETURN NEW;
END;
$$;


--
-- Name: progreso_comunidad(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.progreso_comunidad(p_comunidad uuid) RETURNS TABLE(user_id uuid, nombre text, apellido text, rol text, porcentaje smallint, ultima_lectura timestamp with time zone, otro_libro_id uuid, otro_libro_titulo text, otro_libro_portada text, otro_porcentaje smallint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: puede_recibir_mensajitos(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puede_recibir_mensajitos(p_comunidad uuid) RETURNS TABLE(user_id uuid)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT es_miembro(p_comunidad) THEN
    RAISE EXCEPTION 'Solo los miembros dejan mensajitos.' USING ERRCODE = '42501';
  END IF;

  -- Menor de 16: ni envía ni recibe. Vacío, sin explicar por qué.
  IF NOT edad_permite_contacto(auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.user_id
  FROM comunidad_miembros m
  WHERE m.comunidad_id = p_comunidad
    AND m.user_id <> auth.uid()
    AND edad_permite_contacto(m.user_id);
END;
$$;


--
-- Name: purgar_chat_antiguo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purgar_chat_antiguo() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  borrados integer;
BEGIN
  DELETE FROM public.chat_mensajes
   WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS borrados = ROW_COUNT;

  -- Sesiones vacías y viejas: sin mensajes ya no representan nada.
  -- (Una sesión activa nunca llega a 90 días: se borra al cerrar el chat.)
  DELETE FROM public.chat_sesiones s
   WHERE s.created_at < now() - interval '90 days'
     AND NOT EXISTS (
       SELECT 1 FROM public.chat_mensajes m WHERE m.sesion_id = s.id
     );

  -- El historial de «con quién hablaste» es igual de personal.
  DELETE FROM public.chat_historial
   WHERE created_at < now() - interval '90 days';

  RETURN borrados;
END;
$$;


--
-- Name: FUNCTION purgar_chat_antiguo(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.purgar_chat_antiguo() IS 'Borra mensajes, sesiones vacías e historial de chat de más de 90 días. Retención declarada en la Política de Privacidad, sección 4.';


--
-- Name: purgar_denuncias_resueltas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purgar_denuncias_resueltas() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  borradas integer;
BEGIN
  DELETE FROM public.denuncias
   WHERE estado <> 'pendiente'
     AND coalesce(resuelta_at, created_at) < now() - interval '6 months';
  GET DIAGNOSTICS borradas = ROW_COUNT;
  RETURN borradas;
END;
$$;


--
-- Name: FUNCTION purgar_denuncias_resueltas(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.purgar_denuncias_resueltas() IS 'Borra las denuncias revisadas o descartadas de más de 6 meses. Retención declarada en la Política de Privacidad, sección 4.';


--
-- Name: recalcular_muestra(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalcular_muestra(libro_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  tope CONSTANT INTEGER := 2300;  -- 10 min × 230 palabras/min
BEGIN
  WITH orden AS (
    SELECT p.id,
           sum(CASE WHEN p.tipo = 'separador' THEN 0 ELSE contar_palabras(p.contenido) END)
             OVER (PARTITION BY p.libro_id ORDER BY c.numero, p.numero, p.id
                   ROWS UNBOUNDED PRECEDING) AS acumulado,
           row_number() OVER (PARTITION BY p.libro_id ORDER BY c.numero, p.numero, p.id) AS fila
    FROM parrafos p
    JOIN capitulos c ON c.id = p.capitulo_id
    WHERE p.libro_id = ANY(libro_ids)
  )
  UPDATE parrafos p
  SET en_muestra = (o.acumulado <= tope OR o.fila = 1)
  FROM orden o
  WHERE p.id = o.id
    AND p.en_muestra IS DISTINCT FROM (o.acumulado <= tope OR o.fila = 1);

  UPDATE capitulos c
  SET en_muestra = EXISTS (SELECT 1 FROM parrafos p WHERE p.capitulo_id = c.id AND p.en_muestra)
  WHERE c.libro_id = ANY(libro_ids)
    AND c.en_muestra IS DISTINCT FROM
        EXISTS (SELECT 1 FROM parrafos p WHERE p.capitulo_id = c.id AND p.en_muestra);
END $$;


--
-- Name: recalcular_palabras_capitulos(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalcular_palabras_capitulos(ids uuid[]) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE capitulos c
  SET palabras = coalesce((
    SELECT sum(contar_palabras(p.contenido))
    FROM parrafos p
    WHERE p.capitulo_id = c.id AND p.tipo <> 'separador'
  ), 0)
  WHERE c.id = ANY(ids);
$$;


--
-- Name: regenerar_codigo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.regenerar_codigo(p_comunidad uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: resolver_denuncia(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolver_denuncia(p_id uuid, p_accion text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: trg_muestra_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_muestra_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  PERFORM recalcular_muestra(ARRAY(SELECT DISTINCT libro_id FROM viejos));
  RETURN NULL;
END $$;


--
-- Name: trg_muestra_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_muestra_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  PERFORM recalcular_muestra(ARRAY(SELECT DISTINCT libro_id FROM nuevos));
  RETURN NULL;
END $$;


--
-- Name: trg_muestra_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_muestra_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  PERFORM recalcular_muestra(ARRAY(
    SELECT libro_id FROM nuevos UNION SELECT libro_id FROM viejos));
  RETURN NULL;
END $$;


--
-- Name: trg_palabras_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_palabras_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM recalcular_palabras_capitulos(ARRAY(SELECT DISTINCT capitulo_id FROM viejos));
  RETURN NULL;
END $$;


--
-- Name: trg_palabras_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_palabras_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM recalcular_palabras_capitulos(ARRAY(SELECT DISTINCT capitulo_id FROM nuevos));
  RETURN NULL;
END $$;


--
-- Name: trg_palabras_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_palabras_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM recalcular_palabras_capitulos(ARRAY(
    SELECT capitulo_id FROM nuevos UNION SELECT capitulo_id FROM viejos));
  RETURN NULL;
END $$;


--
-- Name: unirse_con_codigo(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unirse_con_codigo(p_codigo text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: album_barajitas_pegadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.album_barajitas_pegadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    seccion text NOT NULL,
    item_key text NOT NULL,
    pegada_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: biblioteca_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.biblioteca_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    tipo text NOT NULL,
    url text NOT NULL,
    titulo text,
    descripcion text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    destacado boolean DEFAULT false NOT NULL,
    CONSTRAINT biblioteca_media_tipo_check CHECK ((tipo = ANY (ARRAY['audio'::text, 'imagen'::text, 'video'::text])))
);


--
-- Name: capitulos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capitulos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    numero integer NOT NULL,
    titulo text,
    palabras integer,
    en_muestra boolean DEFAULT false NOT NULL
);


--
-- Name: elementos_interactivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.elementos_interactivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parrafo_id uuid NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    media_id uuid NOT NULL
);


--
-- Name: parrafos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parrafos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    capitulo_id uuid NOT NULL,
    numero integer NOT NULL,
    contenido text NOT NULL,
    tipo text DEFAULT 'texto'::text NOT NULL,
    tiene_interactivo boolean DEFAULT false NOT NULL,
    escena_tags text[] DEFAULT '{}'::text[] NOT NULL,
    en_muestra boolean DEFAULT false NOT NULL,
    CONSTRAINT parrafos_tipo_check CHECK ((tipo = ANY (ARRAY['texto'::text, 'dialogo'::text, 'nota_marginal'::text, 'separador'::text])))
);


--
-- Name: album_imagenes; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.album_imagenes AS
 SELECT DISTINCT ON (c.libro_id, bm.id) c.libro_id,
    c.numero AS capitulo_numero,
    bm.id AS media_id,
    bm.url,
    bm.titulo,
    bm.slug
   FROM (((public.elementos_interactivos ei
     JOIN public.parrafos p ON ((p.id = ei.parrafo_id)))
     JOIN public.capitulos c ON ((c.id = p.capitulo_id)))
     JOIN public.biblioteca_media bm ON ((bm.id = ei.media_id)))
  WHERE (bm.tipo = 'imagen'::text)
  ORDER BY c.libro_id, bm.id, c.numero;


--
-- Name: anotaciones_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anotaciones_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    capitulo_num integer NOT NULL,
    contenido text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bibliotecas_usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bibliotecas_usuarios (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid,
    es_manual boolean DEFAULT false,
    leido boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    capitulo_actual integer DEFAULT 1,
    pagina_actual integer DEFAULT 0,
    categoria_id uuid
);


--
-- Name: bibliotecas_usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bibliotecas_usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bibliotecas_usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bibliotecas_usuarios_id_seq OWNED BY public.bibliotecas_usuarios.id;


--
-- Name: cartelera_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cartelera_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    capitulo_numero integer NOT NULL,
    seccion text NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    imagen_media_id uuid,
    CONSTRAINT cartelera_items_seccion_check CHECK ((seccion = ANY (ARRAY['personajes'::text, 'lugares'::text, 'hechos'::text, 'datos'::text, 'notas'::text, 'glosario'::text, 'referencias'::text, 'resumen'::text])))
);


--
-- Name: cartelera_principal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cartelera_principal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    seccion text NOT NULL,
    imagen_media_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    video_media_id uuid,
    CONSTRAINT cartelera_principal_seccion_check CHECK ((seccion = ANY (ARRAY['personajes'::text, 'lugares'::text, 'hechos'::text, 'datos'::text])))
);


--
-- Name: categorias_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nombre text NOT NULL,
    color text DEFAULT '#7a4a28'::text NOT NULL,
    orden integer DEFAULT 0 NOT NULL
);


--
-- Name: chat_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_historial (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    foro_id uuid NOT NULL,
    partner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_mensajes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_mensajes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sesion_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    contenido text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_mensajes_contenido_check CHECK ((char_length(contenido) > 0))
);


--
-- Name: chat_sesiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sesiones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    usuario_a uuid NOT NULL,
    usuario_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_sesiones_distintos CHECK ((usuario_a <> usuario_b))
);


--
-- Name: comentarios_lectura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comentarios_lectura (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comunidad_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    parrafo_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    contenido text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    texto_citado text,
    CONSTRAINT comentarios_lectura_algo_que_mostrar CHECK (((contenido IS NOT NULL) OR (texto_citado IS NOT NULL))),
    CONSTRAINT comentarios_lectura_contenido_max CHECK (((contenido IS NULL) OR ((char_length(btrim(contenido)) >= 1) AND (char_length(btrim(contenido)) <= 500)))),
    CONSTRAINT comentarios_lectura_texto_citado_max CHECK (((texto_citado IS NULL) OR ((char_length(btrim(texto_citado)) >= 1) AND (char_length(btrim(texto_citado)) <= 2000))))
);


--
-- Name: comunidad_codigos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comunidad_codigos (
    comunidad_id uuid NOT NULL,
    codigo text DEFAULT upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8)) NOT NULL,
    CONSTRAINT comunidad_codigos_formato CHECK ((codigo ~ '^[A-Z0-9]{6,20}$'::text))
);


--
-- Name: comunidad_lecturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comunidad_lecturas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comunidad_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    fecha_meta date,
    encuentro_lugar text,
    encuentro_fecha timestamp with time zone,
    inicio timestamp with time zone DEFAULT now() NOT NULL,
    fin timestamp with time zone,
    CONSTRAINT comunidad_lecturas_encuentro_lugar_check CHECK (((encuentro_lugar IS NULL) OR ((char_length(btrim(encuentro_lugar)) >= 1) AND (char_length(btrim(encuentro_lugar)) <= 200))))
);


--
-- Name: comunidad_miembros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comunidad_miembros (
    comunidad_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rol text DEFAULT 'miembro'::text NOT NULL,
    unido_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comunidad_miembros_rol_check CHECK ((rol = ANY (ARRAY['moderador'::text, 'miembro'::text])))
);


--
-- Name: comunidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comunidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    privada boolean DEFAULT false NOT NULL,
    libro_id uuid,
    creador_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comunidades_descripcion_check CHECK (((descripcion IS NULL) OR (char_length(descripcion) <= 500))),
    CONSTRAINT comunidades_nombre_check CHECK (((char_length(btrim(nombre)) >= 1) AND (char_length(btrim(nombre)) <= 60)))
);


--
-- Name: creadores_comunidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creadores_comunidad (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: denuncias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.denuncias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    denunciante_id uuid NOT NULL,
    tipo text NOT NULL,
    objeto_id uuid NOT NULL,
    comunidad_id uuid,
    motivo text,
    contenido_denunciado text,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    denunciado_id uuid,
    libro_id uuid,
    parrafo_id uuid,
    resolucion text,
    resuelta_at timestamp with time zone,
    CONSTRAINT denuncias_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'revisada'::text, 'descartada'::text]))),
    CONSTRAINT denuncias_motivo_check CHECK (((motivo IS NULL) OR (char_length(motivo) <= 1000))),
    CONSTRAINT denuncias_resolucion_check CHECK (((resolucion IS NULL) OR (resolucion = ANY (ARRAY['descartada'::text, 'borrado'::text, 'sacado'::text, 'renombrada'::text, 'cerrada'::text])))),
    CONSTRAINT denuncias_tipo_check CHECK ((tipo = ANY (ARRAY['foro'::text, 'comentario_lectura'::text, 'mensajito'::text, 'comunidad'::text])))
);


--
-- Name: libros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.libros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    autor text NOT NULL,
    descripcion text,
    portada_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    color text,
    paginas integer,
    anio integer,
    categorias text[] DEFAULT '{}'::text[] NOT NULL,
    moods text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    es_ficcion boolean DEFAULT true NOT NULL,
    slug text,
    visible boolean DEFAULT true NOT NULL,
    orden integer,
    anio_texto text,
    primera_linea text
);


--
-- Name: COLUMN libros.orden; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.libros.orden IS 'Orden curado del catalogo (menor = mas arriba). Numerado de 10 en 10 para poder intercalar sin renumerar. NULL = sin puesto asignado, va al final.';


--
-- Name: elementos_con_contexto; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.elementos_con_contexto WITH (security_invoker='on') AS
 SELECT ei.id,
    bm.slug,
    bm.tipo,
    bm.url,
    bm.titulo,
    bm.descripcion,
    bm.metadata,
    p.id AS parrafo_id,
    p.numero AS parrafo_numero,
    p.contenido AS parrafo_contenido,
    c.id AS capitulo_id,
    c.numero AS capitulo_numero,
    c.titulo AS capitulo_titulo,
    l.id AS libro_id,
    l.titulo AS libro_titulo
   FROM ((((public.elementos_interactivos ei
     JOIN public.biblioteca_media bm ON ((bm.id = ei.media_id)))
     JOIN public.parrafos p ON ((p.id = ei.parrafo_id)))
     JOIN public.capitulos c ON ((c.id = p.capitulo_id)))
     JOIN public.libros l ON ((l.id = c.libro_id)));


--
-- Name: foros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: foros_comentarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foros_comentarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    foro_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    contenido text NOT NULL,
    parent_id uuid,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    es_spoiler boolean DEFAULT false NOT NULL,
    comunidad_id uuid,
    CONSTRAINT foros_comentarios_contenido_check CHECK ((char_length(contenido) > 0)),
    CONSTRAINT foros_comentarios_contenido_max CHECK ((char_length(contenido) <= 2000)),
    CONSTRAINT foros_comentarios_tags_max CHECK ((COALESCE(array_length(tags, 1), 0) <= 5))
);


--
-- Name: libro_reels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.libro_reels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libro_id uuid NOT NULL,
    orden smallint NOT NULL,
    imagen_url text,
    audio_url text,
    titulo text,
    subtexto text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: media_por_parrafo; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.media_por_parrafo AS
 SELECT DISTINCT ON (libro_id, capitulo_id, parrafo_id, media_id) parrafo_id,
    capitulo_id,
    libro_id,
    media_id,
    slug,
    tipo,
    url,
    titulo,
    descripcion,
    metadata,
    origen
   FROM ( SELECT p.id AS parrafo_id,
            p.capitulo_id,
            p.libro_id,
            bm.id AS media_id,
            bm.slug,
            bm.tipo,
            bm.url,
            bm.titulo,
            bm.descripcion,
            (bm.metadata || ei.metadata) AS metadata,
            'explicito'::text AS origen,
            1 AS prio
           FROM ((public.elementos_interactivos ei
             JOIN public.parrafos p ON ((p.id = ei.parrafo_id)))
             JOIN public.biblioteca_media bm ON ((bm.id = ei.media_id)))
        UNION ALL
         SELECT p.id AS parrafo_id,
            p.capitulo_id,
            p.libro_id,
            bm.id AS media_id,
            bm.slug,
            bm.tipo,
            bm.url,
            bm.titulo,
            bm.descripcion,
            bm.metadata,
            'tag'::text AS origen,
            2 AS prio
           FROM (public.parrafos p
             JOIN public.biblioteca_media bm ON ((bm.tags && p.escena_tags)))
          WHERE (array_length(p.escena_tags, 1) > 0)) fuentes
  ORDER BY libro_id, capitulo_id, parrafo_id, media_id, prio;


--
-- Name: libros_resumen; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.libros_resumen WITH (security_invoker='false') AS
 SELECT id AS libro_id,
    (( SELECT count(*) AS count
           FROM public.capitulos c
          WHERE (c.libro_id = l.id)))::integer AS capitulos,
    (( SELECT COALESCE(sum(c.palabras), (0)::bigint) AS "coalesce"
           FROM public.capitulos c
          WHERE (c.libro_id = l.id)))::integer AS palabras,
    (( SELECT count(DISTINCT m.media_id) AS count
           FROM public.media_por_parrafo m
          WHERE ((m.libro_id = l.id) AND (m.tipo = 'imagen'::text))))::integer AS ilustraciones,
    (( SELECT count(DISTINCT ROW(m.parrafo_id, m.media_id)) AS count
           FROM public.media_por_parrafo m
          WHERE ((m.libro_id = l.id) AND (m.tipo = 'audio'::text) AND (m.origen = 'explicito'::text))))::integer AS sonidos,
    (( SELECT count(DISTINCT ROW(ci.seccion, lower(btrim(ci.nombre)))) AS count
           FROM public.cartelera_items ci
          WHERE ((ci.libro_id = l.id) AND ((l.es_ficcion = false) OR (ci.seccion = ANY (ARRAY['personajes'::text, 'lugares'::text]))))))::integer AS fichas,
    COALESCE(primera_linea, ( SELECT p.contenido
           FROM (public.capitulos c
             JOIN public.parrafos p ON ((p.capitulo_id = c.id)))
          WHERE ((c.libro_id = l.id) AND (c.numero = 1) AND (p.tipo = ANY (ARRAY['texto'::text, 'dialogo'::text])) AND (char_length(p.contenido) >= 90))
          ORDER BY p.numero
         LIMIT 1)) AS primera_linea
   FROM public.libros l
  WHERE visible;


--
-- Name: mensajitos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensajitos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comunidad_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    parrafo_id uuid NOT NULL,
    de_id uuid NOT NULL,
    para_id uuid NOT NULL,
    contenido text NOT NULL,
    leido_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    texto_citado text,
    efimero boolean DEFAULT false NOT NULL,
    CONSTRAINT mensajitos_check CHECK ((de_id <> para_id)),
    CONSTRAINT mensajitos_contenido_check CHECK (((char_length(btrim(contenido)) >= 1) AND (char_length(btrim(contenido)) <= 300))),
    CONSTRAINT mensajitos_texto_citado_max CHECK (((texto_citado IS NULL) OR ((char_length(btrim(texto_citado)) >= 1) AND (char_length(btrim(texto_citado)) <= 2000))))
);


--
-- Name: COLUMN mensajitos.efimero; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mensajitos.efimero IS 'Se borra cuando lo lea: el cliente del destinatario lo borra al cerrarlo. Ver migración 058.';


--
-- Name: perfiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perfiles (
    id uuid NOT NULL,
    nombre text NOT NULL,
    apellido text,
    fecha_nacimiento date,
    onboarding_completado boolean DEFAULT false NOT NULL,
    genero text
);


--
-- Name: COLUMN perfiles.genero; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.perfiles.genero IS 'Género declarado en el registro. Base legal: interés legítimo (art. 6.1.f), análisis y recomendaciones. Ver Política de Privacidad, secciones 2 y 3.';


--
-- Name: perfiles_publicos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.perfiles_publicos WITH (security_invoker='false') AS
 SELECT id,
    nombre,
    NULL::text AS apellido
   FROM public.perfiles;


--
-- Name: VIEW perfiles_publicos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.perfiles_publicos IS 'Nombre público de cada usuario para Foro, reseñas y chat. Solo id/nombre; apellido siempre NULL desde la 074 (la columna queda por compatibilidad). El resto de perfiles sigue siendo privado. Ver migraciones 038 y 074.';


--
-- Name: predicciones_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.predicciones_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    capitulo_num integer NOT NULL,
    contenido text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: preferencias_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preferencias_usuario (
    user_id uuid NOT NULL,
    ultimos_libros uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    gato_color text DEFAULT 'negro'::text NOT NULL,
    tutorial_visto jsonb DEFAULT '{}'::jsonb NOT NULL,
    comunidad_activa uuid,
    pistas_vistas text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT preferencias_usuario_gato_color_check CHECK ((gato_color = ANY (ARRAY['negro'::text, 'blanco'::text, 'naranja'::text])))
);


--
-- Name: COLUMN preferencias_usuario.comunidad_activa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preferencias_usuario.comunidad_activa IS 'Comunidad con la que lee el usuario ("Leer como"). NULL = solo yo. Ver migración 057.';


--
-- Name: progreso_lectura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progreso_lectura (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    ultimo_parrafo_id uuid,
    porcentaje smallint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_parrafo_offset integer DEFAULT 0 NOT NULL,
    capitulos_completados integer DEFAULT 0 NOT NULL,
    CONSTRAINT progreso_lectura_capitulos_completados_check CHECK ((capitulos_completados >= 0)),
    CONSTRAINT progreso_lectura_porcentaje_check CHECK (((porcentaje >= 0) AND (porcentaje <= 100)))
);


--
-- Name: COLUMN progreso_lectura.porcentaje; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.progreso_lectura.porcentaje IS '% del libro por palabras, para mostrar. Lo que desbloquea contenido es capitulos_completados. Ver migración 075.';


--
-- Name: COLUMN progreso_lectura.ultimo_parrafo_offset; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.progreso_lectura.ultimo_parrafo_offset IS 'Offset en caracteres dentro de ultimo_parrafo_id donde empieza la última página vista (para párrafos largos divididos en varias páginas).';


--
-- Name: COLUMN progreso_lectura.capitulos_completados; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.progreso_lectura.capitulos_completados IS 'Capítulos terminados. Desbloquea la Cartelera, el Álbum y el repaso. El % que ve el usuario es `porcentaje` (por palabras). Ver migración 075.';


--
-- Name: resenas_libros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resenas_libros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    rating smallint NOT NULL,
    texto text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resenas_libros_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT resenas_libros_texto_max CHECK (((texto IS NULL) OR (char_length(texto) <= 1000)))
);


--
-- Name: sala_libros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sala_libros (
    sala_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    orden integer DEFAULT 0 NOT NULL
);


--
-- Name: salas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    nombre text NOT NULL,
    linea text,
    color text DEFAULT '#8b4d2a'::text NOT NULL,
    tipo text DEFAULT 'sala'::text NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    visible boolean DEFAULT true NOT NULL,
    desde date,
    hasta date,
    imagen_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    genero text,
    CONSTRAINT salas_check CHECK (((desde IS NULL) OR (hasta IS NULL) OR (desde <= hasta))),
    CONSTRAINT salas_color_check CHECK ((color ~ '^#[0-9a-fA-F]{6}$'::text)),
    CONSTRAINT salas_slug_check CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (slug <> 'catalogo'::text))),
    CONSTRAINT salas_tipo_check CHECK ((tipo = ANY (ARRAY['sala'::text, 'temporada'::text, 'carril'::text])))
);


--
-- Name: sesiones_lectura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sesiones_lectura (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    segundos_activos integer
);


--
-- Name: subrayados_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subrayados_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    libro_id uuid NOT NULL,
    capitulo_num integer NOT NULL,
    texto_original text NOT NULL,
    parrafo_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subrayados_populares; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.subrayados_populares WITH (security_invoker='false') AS
 SELECT libro_id,
    parrafo_id,
    (array_agg(texto_original ORDER BY (length(texto_original)) DESC, texto_original))[1] AS texto,
    count(DISTINCT user_id) AS total
   FROM public.subrayados_usuario
  WHERE (parrafo_id IS NOT NULL)
  GROUP BY libro_id, parrafo_id;


--
-- Name: VIEW subrayados_populares; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.subrayados_populares IS 'Frases más subrayadas por libro para la ficha de Tienda. Agregado anónimo: nunca expone user_id. La tabla subrayados_usuario es privada por fila. Ver migración 040.';


--
-- Name: superusuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.superusuarios (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bibliotecas_usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios ALTER COLUMN id SET DEFAULT nextval('public.bibliotecas_usuarios_id_seq'::regclass);


--
-- Name: album_barajitas_pegadas album_barajitas_pegadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_barajitas_pegadas
    ADD CONSTRAINT album_barajitas_pegadas_pkey PRIMARY KEY (id);


--
-- Name: album_barajitas_pegadas album_barajitas_pegadas_user_id_libro_id_seccion_item_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_barajitas_pegadas
    ADD CONSTRAINT album_barajitas_pegadas_user_id_libro_id_seccion_item_key_key UNIQUE (user_id, libro_id, seccion, item_key);


--
-- Name: anotaciones_usuario anotaciones_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anotaciones_usuario
    ADD CONSTRAINT anotaciones_usuario_pkey PRIMARY KEY (id);


--
-- Name: biblioteca_media biblioteca_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biblioteca_media
    ADD CONSTRAINT biblioteca_media_pkey PRIMARY KEY (id);


--
-- Name: biblioteca_media biblioteca_media_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biblioteca_media
    ADD CONSTRAINT biblioteca_media_slug_key UNIQUE (slug);


--
-- Name: bibliotecas_usuarios bibliotecas_usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios
    ADD CONSTRAINT bibliotecas_usuarios_pkey PRIMARY KEY (id);


--
-- Name: bibliotecas_usuarios bibliotecas_usuarios_user_libro_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios
    ADD CONSTRAINT bibliotecas_usuarios_user_libro_unique UNIQUE (user_id, libro_id);


--
-- Name: capitulos capitulos_id_libro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos
    ADD CONSTRAINT capitulos_id_libro_id_key UNIQUE (id, libro_id);


--
-- Name: capitulos capitulos_libro_id_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos
    ADD CONSTRAINT capitulos_libro_id_numero_key UNIQUE (libro_id, numero);


--
-- Name: capitulos capitulos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos
    ADD CONSTRAINT capitulos_pkey PRIMARY KEY (id);


--
-- Name: cartelera_items cartelera_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_items
    ADD CONSTRAINT cartelera_items_pkey PRIMARY KEY (id);


--
-- Name: cartelera_principal cartelera_principal_libro_id_seccion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_principal
    ADD CONSTRAINT cartelera_principal_libro_id_seccion_key UNIQUE (libro_id, seccion);


--
-- Name: cartelera_principal cartelera_principal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_principal
    ADD CONSTRAINT cartelera_principal_pkey PRIMARY KEY (id);


--
-- Name: categorias_usuario categorias_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_usuario
    ADD CONSTRAINT categorias_usuario_pkey PRIMARY KEY (id);


--
-- Name: categorias_usuario categorias_usuario_user_id_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_usuario
    ADD CONSTRAINT categorias_usuario_user_id_nombre_key UNIQUE (user_id, nombre);


--
-- Name: chat_historial chat_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_historial
    ADD CONSTRAINT chat_historial_pkey PRIMARY KEY (id);


--
-- Name: chat_mensajes chat_mensajes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_mensajes
    ADD CONSTRAINT chat_mensajes_pkey PRIMARY KEY (id);


--
-- Name: chat_sesiones chat_sesiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sesiones
    ADD CONSTRAINT chat_sesiones_pkey PRIMARY KEY (id);


--
-- Name: comentarios_lectura comentarios_lectura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_lectura
    ADD CONSTRAINT comentarios_lectura_pkey PRIMARY KEY (id);


--
-- Name: comunidad_codigos comunidad_codigos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_codigos
    ADD CONSTRAINT comunidad_codigos_codigo_key UNIQUE (codigo);


--
-- Name: comunidad_codigos comunidad_codigos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_codigos
    ADD CONSTRAINT comunidad_codigos_pkey PRIMARY KEY (comunidad_id);


--
-- Name: comunidad_lecturas comunidad_lecturas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_lecturas
    ADD CONSTRAINT comunidad_lecturas_pkey PRIMARY KEY (id);


--
-- Name: comunidad_miembros comunidad_miembros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_miembros
    ADD CONSTRAINT comunidad_miembros_pkey PRIMARY KEY (comunidad_id, user_id);


--
-- Name: comunidades comunidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidades
    ADD CONSTRAINT comunidades_pkey PRIMARY KEY (id);


--
-- Name: creadores_comunidad creadores_comunidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creadores_comunidad
    ADD CONSTRAINT creadores_comunidad_pkey PRIMARY KEY (user_id);


--
-- Name: denuncias denuncias_denunciante_id_tipo_objeto_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_denunciante_id_tipo_objeto_id_key UNIQUE (denunciante_id, tipo, objeto_id);


--
-- Name: denuncias denuncias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_pkey PRIMARY KEY (id);


--
-- Name: elementos_interactivos elementos_interactivos_parrafo_media_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elementos_interactivos
    ADD CONSTRAINT elementos_interactivos_parrafo_media_unique UNIQUE (parrafo_id, media_id);


--
-- Name: elementos_interactivos elementos_interactivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elementos_interactivos
    ADD CONSTRAINT elementos_interactivos_pkey PRIMARY KEY (id);


--
-- Name: foros_comentarios foros_comentarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros_comentarios
    ADD CONSTRAINT foros_comentarios_pkey PRIMARY KEY (id);


--
-- Name: foros foros_libro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros
    ADD CONSTRAINT foros_libro_id_key UNIQUE (libro_id);


--
-- Name: foros foros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros
    ADD CONSTRAINT foros_pkey PRIMARY KEY (id);


--
-- Name: libro_reels libro_reels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libro_reels
    ADD CONSTRAINT libro_reels_pkey PRIMARY KEY (id);


--
-- Name: libros libros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libros
    ADD CONSTRAINT libros_pkey PRIMARY KEY (id);


--
-- Name: mensajitos mensajitos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_pkey PRIMARY KEY (id);


--
-- Name: parrafos parrafos_capitulo_id_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parrafos
    ADD CONSTRAINT parrafos_capitulo_id_numero_key UNIQUE (capitulo_id, numero);


--
-- Name: parrafos parrafos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parrafos
    ADD CONSTRAINT parrafos_pkey PRIMARY KEY (id);


--
-- Name: perfiles perfiles_genero_valido; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.perfiles
    ADD CONSTRAINT perfiles_genero_valido CHECK (((genero IS NULL) OR (genero = ANY (ARRAY['masculino'::text, 'femenino'::text, 'diverso'::text])))) NOT VALID;


--
-- Name: perfiles perfiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles
    ADD CONSTRAINT perfiles_pkey PRIMARY KEY (id);


--
-- Name: predicciones_usuario predicciones_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predicciones_usuario
    ADD CONSTRAINT predicciones_usuario_pkey PRIMARY KEY (id);


--
-- Name: predicciones_usuario predicciones_usuario_user_id_libro_id_capitulo_num_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predicciones_usuario
    ADD CONSTRAINT predicciones_usuario_user_id_libro_id_capitulo_num_key UNIQUE (user_id, libro_id, capitulo_num);


--
-- Name: preferencias_usuario preferencias_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_pkey PRIMARY KEY (user_id);


--
-- Name: progreso_lectura progreso_lectura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_lectura
    ADD CONSTRAINT progreso_lectura_pkey PRIMARY KEY (id);


--
-- Name: progreso_lectura progreso_lectura_user_id_libro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_lectura
    ADD CONSTRAINT progreso_lectura_user_id_libro_id_key UNIQUE (user_id, libro_id);


--
-- Name: resenas_libros resenas_libros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas_libros
    ADD CONSTRAINT resenas_libros_pkey PRIMARY KEY (id);


--
-- Name: resenas_libros resenas_libros_user_id_libro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas_libros
    ADD CONSTRAINT resenas_libros_user_id_libro_id_key UNIQUE (user_id, libro_id);


--
-- Name: sala_libros sala_libros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_libros
    ADD CONSTRAINT sala_libros_pkey PRIMARY KEY (sala_id, libro_id);


--
-- Name: salas salas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_pkey PRIMARY KEY (id);


--
-- Name: salas salas_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_slug_key UNIQUE (slug);


--
-- Name: sesiones_lectura sesiones_lectura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_lectura
    ADD CONSTRAINT sesiones_lectura_pkey PRIMARY KEY (id);


--
-- Name: subrayados_usuario subrayados_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subrayados_usuario
    ADD CONSTRAINT subrayados_usuario_pkey PRIMARY KEY (id);


--
-- Name: superusuarios superusuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.superusuarios
    ADD CONSTRAINT superusuarios_pkey PRIMARY KEY (user_id);


--
-- Name: chat_historial_user_foro_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_historial_user_foro_partner ON public.chat_historial USING btree (user_id, foro_id, partner_id);


--
-- Name: chat_historial_user_id_foro_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_historial_user_id_foro_id_created_at_idx ON public.chat_historial USING btree (user_id, foro_id, created_at DESC);


--
-- Name: chat_sesiones_libro_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_sesiones_libro_id_idx ON public.chat_sesiones USING btree (libro_id);


--
-- Name: foros_comentarios_foro_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foros_comentarios_foro_id_created_at_idx ON public.foros_comentarios USING btree (foro_id, created_at DESC);


--
-- Name: foros_comentarios_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foros_comentarios_parent_id_idx ON public.foros_comentarios USING btree (parent_id);


--
-- Name: foros_comentarios_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foros_comentarios_tags_idx ON public.foros_comentarios USING gin (tags);


--
-- Name: idx_anotaciones_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anotaciones_user_libro ON public.anotaciones_usuario USING btree (user_id, libro_id);


--
-- Name: idx_biblioteca_media_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_biblioteca_media_slug ON public.biblioteca_media USING btree (slug);


--
-- Name: idx_biblioteca_media_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_biblioteca_media_tags ON public.biblioteca_media USING gin (tags);


--
-- Name: idx_bibliotecas_usuarios_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bibliotecas_usuarios_user ON public.bibliotecas_usuarios USING btree (user_id);


--
-- Name: idx_bibliotecas_usuarios_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bibliotecas_usuarios_user_libro ON public.bibliotecas_usuarios USING btree (user_id, libro_id);


--
-- Name: idx_capitulos_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capitulos_libro ON public.capitulos USING btree (libro_id, numero);


--
-- Name: idx_cartelera_items_imagen_media; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cartelera_items_imagen_media ON public.cartelera_items USING btree (imagen_media_id);


--
-- Name: idx_cartelera_items_libro_cap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cartelera_items_libro_cap ON public.cartelera_items USING btree (libro_id, capitulo_numero);


--
-- Name: idx_cartelera_items_libro_con_imagen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cartelera_items_libro_con_imagen ON public.cartelera_items USING btree (libro_id) WHERE (imagen_media_id IS NOT NULL);


--
-- Name: idx_cartelera_principal_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cartelera_principal_libro ON public.cartelera_principal USING btree (libro_id);


--
-- Name: idx_cartelera_principal_media; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cartelera_principal_media ON public.cartelera_principal USING btree (imagen_media_id);


--
-- Name: idx_categorias_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categorias_user ON public.categorias_usuario USING btree (user_id, orden);


--
-- Name: idx_categorias_usuario_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categorias_usuario_user ON public.categorias_usuario USING btree (user_id, orden, nombre);


--
-- Name: idx_chat_mensajes_sesion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_mensajes_sesion ON public.chat_mensajes USING btree (sesion_id, created_at);


--
-- Name: idx_chat_sesiones_usuario_a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sesiones_usuario_a ON public.chat_sesiones USING btree (usuario_a, libro_id);


--
-- Name: idx_chat_sesiones_usuario_b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sesiones_usuario_b ON public.chat_sesiones USING btree (usuario_b, libro_id);


--
-- Name: idx_comentarios_lectura_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comentarios_lectura_libro ON public.comentarios_lectura USING btree (comunidad_id, libro_id, parrafo_id);


--
-- Name: idx_comunidad_lecturas_actual; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_comunidad_lecturas_actual ON public.comunidad_lecturas USING btree (comunidad_id) WHERE (fin IS NULL);


--
-- Name: idx_comunidad_lecturas_historial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comunidad_lecturas_historial ON public.comunidad_lecturas USING btree (comunidad_id, inicio DESC);


--
-- Name: idx_comunidad_miembros_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comunidad_miembros_user ON public.comunidad_miembros USING btree (user_id);


--
-- Name: idx_denuncias_denunciado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_denuncias_denunciado ON public.denuncias USING btree (denunciado_id, created_at);


--
-- Name: idx_denuncias_pendientes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_denuncias_pendientes ON public.denuncias USING btree (created_at) WHERE (estado = 'pendiente'::text);


--
-- Name: idx_elementos_interactivos_parrafo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_elementos_interactivos_parrafo ON public.elementos_interactivos USING btree (parrafo_id);


--
-- Name: idx_foros_comentarios_comunidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_foros_comentarios_comunidad ON public.foros_comentarios USING btree (comunidad_id, foro_id, created_at DESC) WHERE (comunidad_id IS NOT NULL);


--
-- Name: idx_foros_comentarios_foro_parent_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_foros_comentarios_foro_parent_fecha ON public.foros_comentarios USING btree (foro_id, parent_id, created_at DESC);


--
-- Name: idx_interactivos_media; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactivos_media ON public.elementos_interactivos USING btree (media_id);


--
-- Name: idx_libros_categorias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_libros_categorias ON public.libros USING gin (categorias);


--
-- Name: idx_libros_moods; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_libros_moods ON public.libros USING gin (moods);


--
-- Name: idx_libros_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_libros_slug ON public.libros USING btree (slug);


--
-- Name: idx_libros_visible_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_libros_visible_created ON public.libros USING btree (created_at DESC) WHERE (visible = true);


--
-- Name: idx_mensajitos_de; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensajitos_de ON public.mensajitos USING btree (de_id);


--
-- Name: idx_mensajitos_para_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensajitos_para_libro ON public.mensajitos USING btree (para_id, libro_id);


--
-- Name: idx_parrafos_capitulo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parrafos_capitulo ON public.parrafos USING btree (capitulo_id, numero);


--
-- Name: idx_parrafos_escena_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parrafos_escena_tags ON public.parrafos USING gin (escena_tags);


--
-- Name: idx_predicciones_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_predicciones_user_libro ON public.predicciones_usuario USING btree (user_id, libro_id);


--
-- Name: idx_predicciones_user_libro_cap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_predicciones_user_libro_cap ON public.predicciones_usuario USING btree (user_id, libro_id, capitulo_num);


--
-- Name: idx_progreso_lectura_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progreso_lectura_user_libro ON public.progreso_lectura USING btree (user_id, libro_id);


--
-- Name: idx_resenas_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resenas_libro ON public.resenas_libros USING btree (libro_id);


--
-- Name: idx_resenas_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resenas_user_libro ON public.resenas_libros USING btree (user_id, libro_id);


--
-- Name: idx_sala_libros_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sala_libros_libro ON public.sala_libros USING btree (libro_id);


--
-- Name: idx_sesiones_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sesiones_user_libro ON public.sesiones_lectura USING btree (user_id, libro_id);


--
-- Name: idx_subrayados_libro_con_parrafo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subrayados_libro_con_parrafo ON public.subrayados_usuario USING btree (libro_id) WHERE (parrafo_id IS NOT NULL);


--
-- Name: idx_subrayados_user_libro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subrayados_user_libro ON public.subrayados_usuario USING btree (user_id, libro_id);


--
-- Name: libro_reels_libro_orden_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX libro_reels_libro_orden_idx ON public.libro_reels USING btree (libro_id, orden);


--
-- Name: chat_sesiones trg_chat_sesion_unica; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_chat_sesion_unica BEFORE INSERT ON public.chat_sesiones FOR EACH ROW EXECUTE FUNCTION public._check_usuario_sin_sesion_activa();


--
-- Name: comunidades trg_comunidad_al_crear; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comunidad_al_crear AFTER INSERT ON public.comunidades FOR EACH ROW EXECUTE FUNCTION public._comunidad_al_crear();


--
-- Name: comunidades trg_comunidad_cambio_libro; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comunidad_cambio_libro AFTER INSERT OR UPDATE OF libro_id ON public.comunidades FOR EACH ROW EXECUTE FUNCTION public._comunidad_cambio_libro();


--
-- Name: comunidad_miembros trg_comunidad_tope_miembro; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comunidad_tope_miembro BEFORE INSERT ON public.comunidad_miembros FOR EACH ROW EXECUTE FUNCTION public._comunidad_tope_miembro();


--
-- Name: comunidad_miembros trg_comunidad_tras_baja; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comunidad_tras_baja AFTER DELETE ON public.comunidad_miembros FOR EACH ROW EXECUTE FUNCTION public._comunidad_tras_baja();


--
-- Name: denuncias trg_denuncia_copiar_contenido; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_denuncia_copiar_contenido BEFORE INSERT ON public.denuncias FOR EACH ROW EXECUTE FUNCTION public._denuncia_copiar_contenido();


--
-- Name: perfiles trg_fecha_nacimiento_fija; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fecha_nacimiento_fija BEFORE UPDATE OF fecha_nacimiento ON public.perfiles FOR EACH ROW EXECUTE FUNCTION public._trg_fecha_nacimiento_fija();


--
-- Name: libros trg_foro_nuevo_libro; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_foro_nuevo_libro AFTER INSERT ON public.libros FOR EACH ROW EXECUTE FUNCTION public._crear_foro_para_libro();


--
-- Name: foros_comentarios trg_foro_recortar_tags; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_foro_recortar_tags BEFORE INSERT OR UPDATE ON public.foros_comentarios FOR EACH ROW EXECUTE FUNCTION public.foro_recortar_tags();


--
-- Name: parrafos trg_parrafos_muestra_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_muestra_del AFTER DELETE ON public.parrafos REFERENCING OLD TABLE AS viejos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_muestra_delete();


--
-- Name: parrafos trg_parrafos_muestra_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_muestra_ins AFTER INSERT ON public.parrafos REFERENCING NEW TABLE AS nuevos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_muestra_insert();


--
-- Name: parrafos trg_parrafos_muestra_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_muestra_upd AFTER UPDATE ON public.parrafos REFERENCING OLD TABLE AS viejos NEW TABLE AS nuevos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_muestra_update();


--
-- Name: parrafos trg_parrafos_palabras_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_palabras_del AFTER DELETE ON public.parrafos REFERENCING OLD TABLE AS viejos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_palabras_delete();


--
-- Name: parrafos trg_parrafos_palabras_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_palabras_ins AFTER INSERT ON public.parrafos REFERENCING NEW TABLE AS nuevos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_palabras_insert();


--
-- Name: parrafos trg_parrafos_palabras_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parrafos_palabras_upd AFTER UPDATE ON public.parrafos REFERENCING OLD TABLE AS viejos NEW TABLE AS nuevos FOR EACH STATEMENT EXECUTE FUNCTION public.trg_palabras_update();


--
-- Name: album_barajitas_pegadas album_barajitas_pegadas_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_barajitas_pegadas
    ADD CONSTRAINT album_barajitas_pegadas_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: album_barajitas_pegadas album_barajitas_pegadas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_barajitas_pegadas
    ADD CONSTRAINT album_barajitas_pegadas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: anotaciones_usuario anotaciones_usuario_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anotaciones_usuario
    ADD CONSTRAINT anotaciones_usuario_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: anotaciones_usuario anotaciones_usuario_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anotaciones_usuario
    ADD CONSTRAINT anotaciones_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bibliotecas_usuarios bibliotecas_usuarios_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios
    ADD CONSTRAINT bibliotecas_usuarios_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_usuario(id) ON DELETE SET NULL;


--
-- Name: bibliotecas_usuarios bibliotecas_usuarios_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios
    ADD CONSTRAINT bibliotecas_usuarios_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: bibliotecas_usuarios bibliotecas_usuarios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bibliotecas_usuarios
    ADD CONSTRAINT bibliotecas_usuarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: capitulos capitulos_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos
    ADD CONSTRAINT capitulos_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: cartelera_items cartelera_items_imagen_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_items
    ADD CONSTRAINT cartelera_items_imagen_media_id_fkey FOREIGN KEY (imagen_media_id) REFERENCES public.biblioteca_media(id) ON DELETE SET NULL;


--
-- Name: cartelera_items cartelera_items_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_items
    ADD CONSTRAINT cartelera_items_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: cartelera_principal cartelera_principal_imagen_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_principal
    ADD CONSTRAINT cartelera_principal_imagen_media_id_fkey FOREIGN KEY (imagen_media_id) REFERENCES public.biblioteca_media(id) ON DELETE SET NULL;


--
-- Name: cartelera_principal cartelera_principal_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_principal
    ADD CONSTRAINT cartelera_principal_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: cartelera_principal cartelera_principal_video_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartelera_principal
    ADD CONSTRAINT cartelera_principal_video_media_id_fkey FOREIGN KEY (video_media_id) REFERENCES public.biblioteca_media(id) ON DELETE SET NULL;


--
-- Name: categorias_usuario categorias_usuario_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_usuario
    ADD CONSTRAINT categorias_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_historial chat_historial_foro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_historial
    ADD CONSTRAINT chat_historial_foro_id_fkey FOREIGN KEY (foro_id) REFERENCES public.foros(id) ON DELETE CASCADE;


--
-- Name: chat_historial chat_historial_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_historial
    ADD CONSTRAINT chat_historial_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_historial chat_historial_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_historial
    ADD CONSTRAINT chat_historial_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_mensajes chat_mensajes_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_mensajes
    ADD CONSTRAINT chat_mensajes_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_mensajes chat_mensajes_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_mensajes
    ADD CONSTRAINT chat_mensajes_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.chat_sesiones(id) ON DELETE CASCADE;


--
-- Name: chat_sesiones chat_sesiones_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sesiones
    ADD CONSTRAINT chat_sesiones_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: chat_sesiones chat_sesiones_usuario_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sesiones
    ADD CONSTRAINT chat_sesiones_usuario_a_fkey FOREIGN KEY (usuario_a) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_sesiones chat_sesiones_usuario_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sesiones
    ADD CONSTRAINT chat_sesiones_usuario_b_fkey FOREIGN KEY (usuario_b) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: comentarios_lectura comentarios_lectura_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_lectura
    ADD CONSTRAINT comentarios_lectura_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: comentarios_lectura comentarios_lectura_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_lectura
    ADD CONSTRAINT comentarios_lectura_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: comentarios_lectura comentarios_lectura_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_lectura
    ADD CONSTRAINT comentarios_lectura_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: comentarios_lectura comentarios_lectura_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_lectura
    ADD CONSTRAINT comentarios_lectura_parrafo_id_fkey FOREIGN KEY (parrafo_id) REFERENCES public.parrafos(id) ON DELETE CASCADE;


--
-- Name: comunidad_codigos comunidad_codigos_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_codigos
    ADD CONSTRAINT comunidad_codigos_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: comunidad_lecturas comunidad_lecturas_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_lecturas
    ADD CONSTRAINT comunidad_lecturas_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: comunidad_lecturas comunidad_lecturas_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_lecturas
    ADD CONSTRAINT comunidad_lecturas_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: comunidad_miembros comunidad_miembros_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_miembros
    ADD CONSTRAINT comunidad_miembros_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: comunidad_miembros comunidad_miembros_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidad_miembros
    ADD CONSTRAINT comunidad_miembros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: comunidades comunidades_creador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidades
    ADD CONSTRAINT comunidades_creador_id_fkey FOREIGN KEY (creador_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: comunidades comunidades_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunidades
    ADD CONSTRAINT comunidades_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE SET NULL;


--
-- Name: creadores_comunidad creadores_comunidad_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creadores_comunidad
    ADD CONSTRAINT creadores_comunidad_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: denuncias denuncias_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE SET NULL;


--
-- Name: denuncias denuncias_denunciado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_denunciado_id_fkey FOREIGN KEY (denunciado_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: denuncias denuncias_denunciante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_denunciante_id_fkey FOREIGN KEY (denunciante_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: denuncias denuncias_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE SET NULL;


--
-- Name: denuncias denuncias_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denuncias
    ADD CONSTRAINT denuncias_parrafo_id_fkey FOREIGN KEY (parrafo_id) REFERENCES public.parrafos(id) ON DELETE SET NULL;


--
-- Name: elementos_interactivos elementos_interactivos_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elementos_interactivos
    ADD CONSTRAINT elementos_interactivos_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.biblioteca_media(id) ON DELETE CASCADE;


--
-- Name: elementos_interactivos elementos_interactivos_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elementos_interactivos
    ADD CONSTRAINT elementos_interactivos_parrafo_id_fkey FOREIGN KEY (parrafo_id) REFERENCES public.parrafos(id) ON DELETE CASCADE;


--
-- Name: parrafos fk_parrafo_capitulo_libro; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parrafos
    ADD CONSTRAINT fk_parrafo_capitulo_libro FOREIGN KEY (capitulo_id, libro_id) REFERENCES public.capitulos(id, libro_id) ON DELETE CASCADE;


--
-- Name: foros_comentarios foros_comentarios_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros_comentarios
    ADD CONSTRAINT foros_comentarios_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: foros_comentarios foros_comentarios_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros_comentarios
    ADD CONSTRAINT foros_comentarios_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: foros_comentarios foros_comentarios_foro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros_comentarios
    ADD CONSTRAINT foros_comentarios_foro_id_fkey FOREIGN KEY (foro_id) REFERENCES public.foros(id) ON DELETE CASCADE;


--
-- Name: foros_comentarios foros_comentarios_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros_comentarios
    ADD CONSTRAINT foros_comentarios_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.foros_comentarios(id) ON DELETE CASCADE;


--
-- Name: foros foros_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foros
    ADD CONSTRAINT foros_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: libro_reels libro_reels_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libro_reels
    ADD CONSTRAINT libro_reels_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: mensajitos mensajitos_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: mensajitos mensajitos_de_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_de_id_fkey FOREIGN KEY (de_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mensajitos mensajitos_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: mensajitos mensajitos_para_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_para_id_fkey FOREIGN KEY (para_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mensajitos mensajitos_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajitos
    ADD CONSTRAINT mensajitos_parrafo_id_fkey FOREIGN KEY (parrafo_id) REFERENCES public.parrafos(id) ON DELETE CASCADE;


--
-- Name: parrafos parrafos_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parrafos
    ADD CONSTRAINT parrafos_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: perfiles perfiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles
    ADD CONSTRAINT perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: predicciones_usuario predicciones_usuario_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predicciones_usuario
    ADD CONSTRAINT predicciones_usuario_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: predicciones_usuario predicciones_usuario_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predicciones_usuario
    ADD CONSTRAINT predicciones_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: preferencias_usuario preferencias_usuario_comunidad_activa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_comunidad_activa_fkey FOREIGN KEY (comunidad_activa) REFERENCES public.comunidades(id) ON DELETE SET NULL;


--
-- Name: preferencias_usuario preferencias_usuario_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: progreso_lectura progreso_lectura_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_lectura
    ADD CONSTRAINT progreso_lectura_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: progreso_lectura progreso_lectura_ultimo_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_lectura
    ADD CONSTRAINT progreso_lectura_ultimo_parrafo_id_fkey FOREIGN KEY (ultimo_parrafo_id) REFERENCES public.parrafos(id);


--
-- Name: progreso_lectura progreso_lectura_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_lectura
    ADD CONSTRAINT progreso_lectura_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: resenas_libros resenas_libros_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas_libros
    ADD CONSTRAINT resenas_libros_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: resenas_libros resenas_libros_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resenas_libros
    ADD CONSTRAINT resenas_libros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sala_libros sala_libros_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_libros
    ADD CONSTRAINT sala_libros_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: sala_libros sala_libros_sala_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_libros
    ADD CONSTRAINT sala_libros_sala_id_fkey FOREIGN KEY (sala_id) REFERENCES public.salas(id) ON DELETE CASCADE;


--
-- Name: sesiones_lectura sesiones_lectura_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_lectura
    ADD CONSTRAINT sesiones_lectura_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: sesiones_lectura sesiones_lectura_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_lectura
    ADD CONSTRAINT sesiones_lectura_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subrayados_usuario subrayados_usuario_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subrayados_usuario
    ADD CONSTRAINT subrayados_usuario_libro_id_fkey FOREIGN KEY (libro_id) REFERENCES public.libros(id) ON DELETE CASCADE;


--
-- Name: subrayados_usuario subrayados_usuario_parrafo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subrayados_usuario
    ADD CONSTRAINT subrayados_usuario_parrafo_id_fkey FOREIGN KEY (parrafo_id) REFERENCES public.parrafos(id) ON DELETE SET NULL;


--
-- Name: subrayados_usuario subrayados_usuario_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subrayados_usuario
    ADD CONSTRAINT subrayados_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: superusuarios superusuarios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.superusuarios
    ADD CONSTRAINT superusuarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: perfiles Perfiles visibles por dueño; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Perfiles visibles por dueño" ON public.perfiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: libro_reels Reels visibles para todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reels visibles para todos" ON public.libro_reels FOR SELECT USING (true);


--
-- Name: libro_reels Solo admin puede modificar reels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo admin puede modificar reels" ON public.libro_reels USING ((auth.role() = 'service_role'::text));


--
-- Name: bibliotecas_usuarios Usuarios actualizan su propia biblioteca; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios actualizan su propia biblioteca" ON public.bibliotecas_usuarios FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: bibliotecas_usuarios Usuarios ven su propia biblioteca; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios ven su propia biblioteca" ON public.bibliotecas_usuarios FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: album_barajitas_pegadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.album_barajitas_pegadas ENABLE ROW LEVEL SECURITY;

--
-- Name: album_barajitas_pegadas album_pegadas_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY album_pegadas_insert ON public.album_barajitas_pegadas FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: album_barajitas_pegadas album_pegadas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY album_pegadas_select ON public.album_barajitas_pegadas FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: anotaciones_usuario anotaciones_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anotaciones_delete ON public.anotaciones_usuario FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: anotaciones_usuario anotaciones_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anotaciones_insert ON public.anotaciones_usuario FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: anotaciones_usuario anotaciones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anotaciones_select ON public.anotaciones_usuario FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: anotaciones_usuario anotaciones_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anotaciones_update ON public.anotaciones_usuario FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: anotaciones_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anotaciones_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: biblioteca_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.biblioteca_media ENABLE ROW LEVEL SECURITY;

--
-- Name: biblioteca_media biblioteca_media_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY biblioteca_media_select ON public.biblioteca_media FOR SELECT TO authenticated USING (true);


--
-- Name: bibliotecas_usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bibliotecas_usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: capitulos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capitulos ENABLE ROW LEVEL SECURITY;

--
-- Name: capitulos capitulos_guest_preview; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capitulos_guest_preview ON public.capitulos FOR SELECT TO anon USING (en_muestra);


--
-- Name: capitulos capitulos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capitulos_select ON public.capitulos FOR SELECT TO authenticated USING ((en_muestra OR (EXISTS ( SELECT 1
   FROM public.bibliotecas_usuarios bu
  WHERE ((bu.user_id = ( SELECT auth.uid() AS uid)) AND (bu.libro_id = capitulos.libro_id)))) OR (EXISTS ( SELECT 1
   FROM public.superusuarios s
  WHERE (s.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: cartelera_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cartelera_items ENABLE ROW LEVEL SECURITY;

--
-- Name: cartelera_principal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cartelera_principal ENABLE ROW LEVEL SECURITY;

--
-- Name: cartelera_principal cartelera_principal_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cartelera_principal_select ON public.cartelera_principal FOR SELECT TO authenticated USING (true);


--
-- Name: cartelera_items cartelera_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cartelera_select ON public.cartelera_items FOR SELECT TO authenticated USING (true);


--
-- Name: categorias_usuario categorias_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categorias_delete ON public.categorias_usuario FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: categorias_usuario categorias_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categorias_insert ON public.categorias_usuario FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: categorias_usuario categorias_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categorias_select ON public.categorias_usuario FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: categorias_usuario categorias_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categorias_update ON public.categorias_usuario FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: categorias_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categorias_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_historial; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_historial ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_historial chat_historial_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_historial_insert ON public.chat_historial FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: chat_historial chat_historial_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_historial_select ON public.chat_historial FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: chat_historial chat_historial_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_historial_update ON public.chat_historial FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: chat_mensajes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_mensajes ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_mensajes chat_mensajes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_mensajes_insert ON public.chat_mensajes FOR INSERT TO authenticated WITH CHECK (((autor_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.chat_sesiones s
  WHERE ((s.id = chat_mensajes.sesion_id) AND ((s.usuario_a = auth.uid()) OR (s.usuario_b = auth.uid())))))));


--
-- Name: chat_mensajes chat_mensajes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_mensajes_select ON public.chat_mensajes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.chat_sesiones s
  WHERE ((s.id = chat_mensajes.sesion_id) AND ((s.usuario_a = auth.uid()) OR (s.usuario_b = auth.uid()))))));


--
-- Name: chat_sesiones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_sesiones ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sesiones chat_sesiones_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_sesiones_delete ON public.chat_sesiones FOR DELETE TO authenticated USING (((usuario_a = auth.uid()) OR (usuario_b = auth.uid())));


--
-- Name: chat_sesiones chat_sesiones_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_sesiones_insert ON public.chat_sesiones FOR INSERT TO authenticated WITH CHECK ((usuario_a = auth.uid()));


--
-- Name: chat_sesiones chat_sesiones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_sesiones_select ON public.chat_sesiones FOR SELECT TO authenticated USING (((usuario_a = auth.uid()) OR (usuario_b = auth.uid())));


--
-- Name: comentarios_lectura; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comentarios_lectura ENABLE ROW LEVEL SECURITY;

--
-- Name: comentarios_lectura comentarios_lectura_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comentarios_lectura_delete ON public.comentarios_lectura FOR DELETE TO authenticated USING (((autor_id = ( SELECT auth.uid() AS uid)) OR public.es_moderador(comunidad_id) OR public.es_superusuario()));


--
-- Name: comentarios_lectura comentarios_lectura_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comentarios_lectura_insert ON public.comentarios_lectura FOR INSERT TO authenticated WITH CHECK (((autor_id = ( SELECT auth.uid() AS uid)) AND public.es_miembro(comunidad_id) AND (EXISTS ( SELECT 1
   FROM public.parrafos p
  WHERE ((p.id = comentarios_lectura.parrafo_id) AND (p.libro_id = comentarios_lectura.libro_id))))));


--
-- Name: comentarios_lectura comentarios_lectura_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comentarios_lectura_select ON public.comentarios_lectura FOR SELECT TO authenticated USING ((public.es_miembro(comunidad_id) OR public.es_superusuario()));


--
-- Name: comunidad_codigos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comunidad_codigos ENABLE ROW LEVEL SECURITY;

--
-- Name: comunidad_codigos comunidad_codigos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_codigos_select ON public.comunidad_codigos FOR SELECT TO authenticated USING (public.es_moderador(comunidad_id));


--
-- Name: comunidad_lecturas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comunidad_lecturas ENABLE ROW LEVEL SECURITY;

--
-- Name: comunidad_lecturas comunidad_lecturas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_lecturas_select ON public.comunidad_lecturas FOR SELECT TO authenticated USING ((public.es_miembro(comunidad_id) OR public.es_superusuario()));


--
-- Name: comunidad_lecturas comunidad_lecturas_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_lecturas_update ON public.comunidad_lecturas FOR UPDATE TO authenticated USING (public.es_moderador(comunidad_id)) WITH CHECK (public.es_moderador(comunidad_id));


--
-- Name: comunidad_miembros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comunidad_miembros ENABLE ROW LEVEL SECURITY;

--
-- Name: comunidad_miembros comunidad_miembros_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_miembros_delete ON public.comunidad_miembros FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.es_moderador(comunidad_id) OR public.es_superusuario()));


--
-- Name: comunidad_miembros comunidad_miembros_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_miembros_insert ON public.comunidad_miembros FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (rol = 'miembro'::text) AND (EXISTS ( SELECT 1
   FROM public.comunidades c
  WHERE ((c.id = comunidad_miembros.comunidad_id) AND (NOT c.privada))))));


--
-- Name: comunidad_miembros comunidad_miembros_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidad_miembros_select ON public.comunidad_miembros FOR SELECT TO authenticated USING ((public.es_miembro(comunidad_id) OR public.es_superusuario()));


--
-- Name: comunidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comunidades ENABLE ROW LEVEL SECURITY;

--
-- Name: comunidades comunidades_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_delete ON public.comunidades FOR DELETE TO authenticated USING ((public.es_moderador(id) OR public.es_superusuario()));


--
-- Name: comunidades comunidades_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_insert ON public.comunidades FOR INSERT TO authenticated WITH CHECK (((creador_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.creadores_comunidad cc
  WHERE (cc.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: comunidades comunidades_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_select ON public.comunidades FOR SELECT TO authenticated USING (((NOT privada) OR public.es_miembro(id) OR public.es_superusuario()));


--
-- Name: comunidades comunidades_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_update ON public.comunidades FOR UPDATE TO authenticated USING (public.es_moderador(id)) WITH CHECK (public.es_moderador(id));


--
-- Name: creadores_comunidad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.creadores_comunidad ENABLE ROW LEVEL SECURITY;

--
-- Name: creadores_comunidad creadores_comunidad_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY creadores_comunidad_select_own ON public.creadores_comunidad FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: denuncias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;

--
-- Name: denuncias denuncias_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY denuncias_insert ON public.denuncias FOR INSERT TO authenticated WITH CHECK ((denunciante_id = ( SELECT auth.uid() AS uid)));


--
-- Name: denuncias denuncias_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY denuncias_select ON public.denuncias FOR SELECT TO authenticated USING (((denunciante_id = ( SELECT auth.uid() AS uid)) OR public.es_superusuario()));


--
-- Name: denuncias denuncias_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY denuncias_update ON public.denuncias FOR UPDATE TO authenticated USING (public.es_superusuario()) WITH CHECK (public.es_superusuario());


--
-- Name: elementos_interactivos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.elementos_interactivos ENABLE ROW LEVEL SECURITY;

--
-- Name: foros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foros ENABLE ROW LEVEL SECURITY;

--
-- Name: foros_comentarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foros_comentarios ENABLE ROW LEVEL SECURITY;

--
-- Name: foros_comentarios foros_comentarios_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY foros_comentarios_delete ON public.foros_comentarios FOR DELETE TO authenticated USING ((autor_id = auth.uid()));


--
-- Name: foros_comentarios foros_comentarios_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY foros_comentarios_insert ON public.foros_comentarios FOR INSERT TO authenticated WITH CHECK (((autor_id = ( SELECT auth.uid() AS uid)) AND ((comunidad_id IS NULL) OR public.es_miembro(comunidad_id)) AND ((parent_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.foros_comentarios padre
  WHERE ((padre.id = foros_comentarios.parent_id) AND (NOT (padre.comunidad_id IS DISTINCT FROM foros_comentarios.comunidad_id))))))));


--
-- Name: foros_comentarios foros_comentarios_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY foros_comentarios_select ON public.foros_comentarios FOR SELECT TO authenticated USING (((comunidad_id IS NULL) OR public.es_miembro(comunidad_id) OR public.es_superusuario()));


--
-- Name: foros foros_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY foros_select ON public.foros FOR SELECT TO authenticated USING (true);


--
-- Name: elementos_interactivos interactivos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interactivos_select ON public.elementos_interactivos FOR SELECT TO authenticated USING (true);


--
-- Name: libro_reels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.libro_reels ENABLE ROW LEVEL SECURITY;

--
-- Name: libros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.libros ENABLE ROW LEVEL SECURITY;

--
-- Name: libros libros_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY libros_public_read ON public.libros FOR SELECT TO anon USING (true);


--
-- Name: libros libros_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY libros_select ON public.libros FOR SELECT TO authenticated USING (true);


--
-- Name: mensajitos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mensajitos ENABLE ROW LEVEL SECURITY;

--
-- Name: mensajitos mensajitos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajitos_delete ON public.mensajitos FOR DELETE TO authenticated USING (((para_id = ( SELECT auth.uid() AS uid)) OR public.es_superusuario()));


--
-- Name: mensajitos mensajitos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajitos_insert ON public.mensajitos FOR INSERT TO authenticated WITH CHECK (((de_id = ( SELECT auth.uid() AS uid)) AND public.es_miembro(comunidad_id) AND (EXISTS ( SELECT 1
   FROM public.comunidad_miembros m
  WHERE ((m.comunidad_id = mensajitos.comunidad_id) AND (m.user_id = mensajitos.para_id)))) AND public.edad_permite_contacto(de_id) AND public.edad_permite_contacto(para_id) AND (EXISTS ( SELECT 1
   FROM public.parrafos p
  WHERE ((p.id = mensajitos.parrafo_id) AND (p.libro_id = mensajitos.libro_id))))));


--
-- Name: mensajitos mensajitos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajitos_select ON public.mensajitos FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = de_id) OR (( SELECT auth.uid() AS uid) = para_id)));


--
-- Name: mensajitos mensajitos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajitos_update ON public.mensajitos FOR UPDATE TO authenticated USING ((para_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((para_id = ( SELECT auth.uid() AS uid)));


--
-- Name: foros_comentarios moderador_comentarios_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY moderador_comentarios_delete ON public.foros_comentarios FOR DELETE TO authenticated USING (((comunidad_id IS NOT NULL) AND public.es_moderador(comunidad_id)));


--
-- Name: parrafos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parrafos ENABLE ROW LEVEL SECURITY;

--
-- Name: parrafos parrafos_guest_preview; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parrafos_guest_preview ON public.parrafos FOR SELECT TO anon USING (en_muestra);


--
-- Name: parrafos parrafos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parrafos_select ON public.parrafos FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.bibliotecas_usuarios bu
  WHERE ((bu.user_id = ( SELECT auth.uid() AS uid)) AND (bu.libro_id = parrafos.libro_id)))) OR (EXISTS ( SELECT 1
   FROM public.superusuarios s
  WHERE (s.user_id = ( SELECT auth.uid() AS uid)))) OR en_muestra));


--
-- Name: perfiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

--
-- Name: perfiles perfiles_insert_propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perfiles_insert_propio ON public.perfiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: perfiles perfiles_update_propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perfiles_update_propio ON public.perfiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: predicciones_usuario predicciones_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY predicciones_delete ON public.predicciones_usuario FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: predicciones_usuario predicciones_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY predicciones_insert ON public.predicciones_usuario FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: predicciones_usuario predicciones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY predicciones_select ON public.predicciones_usuario FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: predicciones_usuario predicciones_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY predicciones_update ON public.predicciones_usuario FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: predicciones_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.predicciones_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: preferencias_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preferencias_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: preferencias_usuario prefs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prefs_insert ON public.preferencias_usuario FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: preferencias_usuario prefs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prefs_select ON public.preferencias_usuario FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: preferencias_usuario prefs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prefs_update ON public.preferencias_usuario FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: progreso_lectura progreso_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progreso_insert ON public.progreso_lectura FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: progreso_lectura; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.progreso_lectura ENABLE ROW LEVEL SECURITY;

--
-- Name: progreso_lectura progreso_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progreso_select ON public.progreso_lectura FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: progreso_lectura progreso_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progreso_update ON public.progreso_lectura FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: resenas_libros resenas_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resenas_delete ON public.resenas_libros FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: resenas_libros resenas_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resenas_insert ON public.resenas_libros FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: resenas_libros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resenas_libros ENABLE ROW LEVEL SECURITY;

--
-- Name: resenas_libros resenas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resenas_select ON public.resenas_libros FOR SELECT TO authenticated USING (true);


--
-- Name: resenas_libros resenas_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resenas_update ON public.resenas_libros FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: sala_libros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sala_libros ENABLE ROW LEVEL SECURITY;

--
-- Name: sala_libros sala_libros_select_visibles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sala_libros_select_visibles ON public.sala_libros FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.salas s
  WHERE ((s.id = sala_libros.sala_id) AND s.visible))));


--
-- Name: sala_libros sala_libros_superusuario; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sala_libros_superusuario ON public.sala_libros TO authenticated USING (public.es_superusuario()) WITH CHECK (public.es_superusuario());


--
-- Name: salas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;

--
-- Name: salas salas_select_visibles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY salas_select_visibles ON public.salas FOR SELECT TO authenticated, anon USING (visible);


--
-- Name: salas salas_superusuario; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY salas_superusuario ON public.salas TO authenticated USING (public.es_superusuario()) WITH CHECK (public.es_superusuario());


--
-- Name: sesiones_lectura sesiones_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sesiones_insert ON public.sesiones_lectura FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: sesiones_lectura; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sesiones_lectura ENABLE ROW LEVEL SECURITY;

--
-- Name: sesiones_lectura sesiones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sesiones_select ON public.sesiones_lectura FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: sesiones_lectura sesiones_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sesiones_update ON public.sesiones_lectura FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: subrayados_usuario subrayados_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subrayados_delete ON public.subrayados_usuario FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: subrayados_usuario subrayados_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subrayados_insert ON public.subrayados_usuario FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: subrayados_usuario subrayados_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subrayados_select ON public.subrayados_usuario FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: subrayados_usuario subrayados_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subrayados_update ON public.subrayados_usuario FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: subrayados_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subrayados_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: foros_comentarios superusuario_comentarios_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuario_comentarios_delete ON public.foros_comentarios FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.superusuarios s
  WHERE (s.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: elementos_interactivos superusuario_ei_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuario_ei_delete ON public.elementos_interactivos FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.superusuarios
  WHERE (superusuarios.user_id = auth.uid()))));


--
-- Name: elementos_interactivos superusuario_ei_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuario_ei_insert ON public.elementos_interactivos FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.superusuarios
  WHERE (superusuarios.user_id = auth.uid()))));


--
-- Name: biblioteca_media superusuario_media_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuario_media_update ON public.biblioteca_media FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.superusuarios
  WHERE (superusuarios.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.superusuarios
  WHERE (superusuarios.user_id = auth.uid()))));


--
-- Name: parrafos superusuario_parrafos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuario_parrafos_delete ON public.parrafos FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.superusuarios
  WHERE (superusuarios.user_id = auth.uid()))));


--
-- Name: superusuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.superusuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: superusuarios superusuarios_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superusuarios_select_own ON public.superusuarios FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION _asignar_manual(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._asignar_manual(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._asignar_manual(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION _check_usuario_sin_sesion_activa(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._check_usuario_sin_sesion_activa() TO anon;
GRANT ALL ON FUNCTION public._check_usuario_sin_sesion_activa() TO authenticated;
GRANT ALL ON FUNCTION public._check_usuario_sin_sesion_activa() TO service_role;


--
-- Name: FUNCTION _comunidad_al_crear(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._comunidad_al_crear() FROM PUBLIC;
GRANT ALL ON FUNCTION public._comunidad_al_crear() TO service_role;


--
-- Name: FUNCTION _comunidad_cambio_libro(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._comunidad_cambio_libro() FROM PUBLIC;
GRANT ALL ON FUNCTION public._comunidad_cambio_libro() TO service_role;


--
-- Name: FUNCTION _comunidad_poner_codigo(p_comunidad uuid, p_codigo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._comunidad_poner_codigo(p_comunidad uuid, p_codigo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._comunidad_poner_codigo(p_comunidad uuid, p_codigo text) TO authenticated;
GRANT ALL ON FUNCTION public._comunidad_poner_codigo(p_comunidad uuid, p_codigo text) TO service_role;


--
-- Name: FUNCTION _comunidad_tope_miembro(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._comunidad_tope_miembro() FROM PUBLIC;
GRANT ALL ON FUNCTION public._comunidad_tope_miembro() TO service_role;


--
-- Name: FUNCTION _comunidad_tras_baja(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._comunidad_tras_baja() FROM PUBLIC;
GRANT ALL ON FUNCTION public._comunidad_tras_baja() TO service_role;


--
-- Name: FUNCTION _crear_foro_para_libro(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._crear_foro_para_libro() FROM PUBLIC;
GRANT ALL ON FUNCTION public._crear_foro_para_libro() TO service_role;


--
-- Name: FUNCTION _crear_perfil(p_user_id uuid, p_meta jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._crear_perfil(p_user_id uuid, p_meta jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public._crear_perfil(p_user_id uuid, p_meta jsonb) TO service_role;


--
-- Name: FUNCTION _denuncia_copiar_contenido(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._denuncia_copiar_contenido() FROM PUBLIC;
GRANT ALL ON FUNCTION public._denuncia_copiar_contenido() TO service_role;


--
-- Name: FUNCTION _trg_fecha_nacimiento_fija(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._trg_fecha_nacimiento_fija() FROM PUBLIC;
GRANT ALL ON FUNCTION public._trg_fecha_nacimiento_fija() TO service_role;


--
-- Name: FUNCTION _trg_perfil_al_registrarse(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._trg_perfil_al_registrarse() FROM PUBLIC;
GRANT ALL ON FUNCTION public._trg_perfil_al_registrarse() TO service_role;


--
-- Name: FUNCTION adquirir_libro(p_libro_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.adquirir_libro(p_libro_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.adquirir_libro(p_libro_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.adquirir_libro(p_libro_id uuid) TO service_role;


--
-- Name: FUNCTION buscar_comunidades(p_texto text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.buscar_comunidades(p_texto text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.buscar_comunidades(p_texto text) TO authenticated;
GRANT ALL ON FUNCTION public.buscar_comunidades(p_texto text) TO service_role;


--
-- Name: FUNCTION contar_palabras(texto text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.contar_palabras(texto text) TO anon;
GRANT ALL ON FUNCTION public.contar_palabras(texto text) TO authenticated;
GRANT ALL ON FUNCTION public.contar_palabras(texto text) TO service_role;


--
-- Name: FUNCTION crear_comunidad(p_nombre text, p_descripcion text, p_privada boolean, p_codigo text, p_libro_id uuid, p_fecha_meta date, p_encuentro_lugar text, p_encuentro_fecha timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crear_comunidad(p_nombre text, p_descripcion text, p_privada boolean, p_codigo text, p_libro_id uuid, p_fecha_meta date, p_encuentro_lugar text, p_encuentro_fecha timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.crear_comunidad(p_nombre text, p_descripcion text, p_privada boolean, p_codigo text, p_libro_id uuid, p_fecha_meta date, p_encuentro_lugar text, p_encuentro_fecha timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.crear_comunidad(p_nombre text, p_descripcion text, p_privada boolean, p_codigo text, p_libro_id uuid, p_fecha_meta date, p_encuentro_lugar text, p_encuentro_fecha timestamp with time zone) TO service_role;


--
-- Name: FUNCTION delete_parrafo_superuser(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_parrafo_superuser(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_parrafo_superuser(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_parrafo_superuser(p_id uuid) TO service_role;


--
-- Name: FUNCTION denuncias_para_revisar(p_pendientes boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.denuncias_para_revisar(p_pendientes boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.denuncias_para_revisar(p_pendientes boolean) TO authenticated;
GRANT ALL ON FUNCTION public.denuncias_para_revisar(p_pendientes boolean) TO service_role;


--
-- Name: FUNCTION edad_permite_contacto(uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.edad_permite_contacto(uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edad_permite_contacto(uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.edad_permite_contacto(uid uuid) TO service_role;


--
-- Name: FUNCTION eliminar_mi_cuenta(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.eliminar_mi_cuenta() FROM PUBLIC;
GRANT ALL ON FUNCTION public.eliminar_mi_cuenta() TO authenticated;
GRANT ALL ON FUNCTION public.eliminar_mi_cuenta() TO service_role;


--
-- Name: FUNCTION es_miembro(c uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.es_miembro(c uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.es_miembro(c uuid) TO authenticated;
GRANT ALL ON FUNCTION public.es_miembro(c uuid) TO service_role;


--
-- Name: FUNCTION es_moderador(c uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.es_moderador(c uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.es_moderador(c uuid) TO authenticated;
GRANT ALL ON FUNCTION public.es_moderador(c uuid) TO service_role;


--
-- Name: FUNCTION es_superusuario(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.es_superusuario() FROM PUBLIC;
GRANT ALL ON FUNCTION public.es_superusuario() TO authenticated;
GRANT ALL ON FUNCTION public.es_superusuario() TO service_role;


--
-- Name: FUNCTION foro_recortar_tags(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.foro_recortar_tags() TO anon;
GRANT ALL ON FUNCTION public.foro_recortar_tags() TO authenticated;
GRANT ALL ON FUNCTION public.foro_recortar_tags() TO service_role;


--
-- Name: FUNCTION progreso_comunidad(p_comunidad uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.progreso_comunidad(p_comunidad uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.progreso_comunidad(p_comunidad uuid) TO authenticated;
GRANT ALL ON FUNCTION public.progreso_comunidad(p_comunidad uuid) TO service_role;


--
-- Name: FUNCTION puede_recibir_mensajitos(p_comunidad uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.puede_recibir_mensajitos(p_comunidad uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.puede_recibir_mensajitos(p_comunidad uuid) TO authenticated;
GRANT ALL ON FUNCTION public.puede_recibir_mensajitos(p_comunidad uuid) TO service_role;


--
-- Name: FUNCTION purgar_chat_antiguo(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purgar_chat_antiguo() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purgar_chat_antiguo() TO service_role;


--
-- Name: FUNCTION purgar_denuncias_resueltas(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purgar_denuncias_resueltas() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purgar_denuncias_resueltas() TO service_role;


--
-- Name: FUNCTION recalcular_muestra(libro_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recalcular_muestra(libro_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recalcular_muestra(libro_ids uuid[]) TO service_role;


--
-- Name: FUNCTION recalcular_palabras_capitulos(ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recalcular_palabras_capitulos(ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recalcular_palabras_capitulos(ids uuid[]) TO service_role;


--
-- Name: FUNCTION regenerar_codigo(p_comunidad uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regenerar_codigo(p_comunidad uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.regenerar_codigo(p_comunidad uuid) TO authenticated;
GRANT ALL ON FUNCTION public.regenerar_codigo(p_comunidad uuid) TO service_role;


--
-- Name: FUNCTION resolver_denuncia(p_id uuid, p_accion text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolver_denuncia(p_id uuid, p_accion text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolver_denuncia(p_id uuid, p_accion text) TO authenticated;
GRANT ALL ON FUNCTION public.resolver_denuncia(p_id uuid, p_accion text) TO service_role;


--
-- Name: FUNCTION trg_muestra_delete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_muestra_delete() TO anon;
GRANT ALL ON FUNCTION public.trg_muestra_delete() TO authenticated;
GRANT ALL ON FUNCTION public.trg_muestra_delete() TO service_role;


--
-- Name: FUNCTION trg_muestra_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_muestra_insert() TO anon;
GRANT ALL ON FUNCTION public.trg_muestra_insert() TO authenticated;
GRANT ALL ON FUNCTION public.trg_muestra_insert() TO service_role;


--
-- Name: FUNCTION trg_muestra_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_muestra_update() TO anon;
GRANT ALL ON FUNCTION public.trg_muestra_update() TO authenticated;
GRANT ALL ON FUNCTION public.trg_muestra_update() TO service_role;


--
-- Name: FUNCTION trg_palabras_delete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_palabras_delete() TO anon;
GRANT ALL ON FUNCTION public.trg_palabras_delete() TO authenticated;
GRANT ALL ON FUNCTION public.trg_palabras_delete() TO service_role;


--
-- Name: FUNCTION trg_palabras_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_palabras_insert() TO anon;
GRANT ALL ON FUNCTION public.trg_palabras_insert() TO authenticated;
GRANT ALL ON FUNCTION public.trg_palabras_insert() TO service_role;


--
-- Name: FUNCTION trg_palabras_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_palabras_update() TO anon;
GRANT ALL ON FUNCTION public.trg_palabras_update() TO authenticated;
GRANT ALL ON FUNCTION public.trg_palabras_update() TO service_role;


--
-- Name: FUNCTION unirse_con_codigo(p_codigo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.unirse_con_codigo(p_codigo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.unirse_con_codigo(p_codigo text) TO authenticated;
GRANT ALL ON FUNCTION public.unirse_con_codigo(p_codigo text) TO service_role;


--
-- Name: TABLE album_barajitas_pegadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.album_barajitas_pegadas TO anon;
GRANT ALL ON TABLE public.album_barajitas_pegadas TO authenticated;
GRANT ALL ON TABLE public.album_barajitas_pegadas TO service_role;


--
-- Name: TABLE biblioteca_media; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.biblioteca_media TO anon;
GRANT ALL ON TABLE public.biblioteca_media TO authenticated;
GRANT ALL ON TABLE public.biblioteca_media TO service_role;


--
-- Name: TABLE capitulos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.capitulos TO anon;
GRANT ALL ON TABLE public.capitulos TO authenticated;
GRANT ALL ON TABLE public.capitulos TO service_role;


--
-- Name: TABLE elementos_interactivos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.elementos_interactivos TO anon;
GRANT ALL ON TABLE public.elementos_interactivos TO authenticated;
GRANT ALL ON TABLE public.elementos_interactivos TO service_role;


--
-- Name: TABLE parrafos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.parrafos TO anon;
GRANT ALL ON TABLE public.parrafos TO authenticated;
GRANT ALL ON TABLE public.parrafos TO service_role;


--
-- Name: TABLE album_imagenes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.album_imagenes TO anon;
GRANT ALL ON TABLE public.album_imagenes TO authenticated;
GRANT ALL ON TABLE public.album_imagenes TO service_role;


--
-- Name: TABLE anotaciones_usuario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.anotaciones_usuario TO anon;
GRANT ALL ON TABLE public.anotaciones_usuario TO authenticated;
GRANT ALL ON TABLE public.anotaciones_usuario TO service_role;


--
-- Name: TABLE bibliotecas_usuarios; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bibliotecas_usuarios TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bibliotecas_usuarios TO authenticated;
GRANT ALL ON TABLE public.bibliotecas_usuarios TO service_role;


--
-- Name: COLUMN bibliotecas_usuarios.leido; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(leido) ON TABLE public.bibliotecas_usuarios TO authenticated;


--
-- Name: COLUMN bibliotecas_usuarios.categoria_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(categoria_id) ON TABLE public.bibliotecas_usuarios TO authenticated;


--
-- Name: SEQUENCE bibliotecas_usuarios_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.bibliotecas_usuarios_id_seq TO anon;
GRANT ALL ON SEQUENCE public.bibliotecas_usuarios_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bibliotecas_usuarios_id_seq TO service_role;


--
-- Name: TABLE cartelera_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cartelera_items TO anon;
GRANT ALL ON TABLE public.cartelera_items TO authenticated;
GRANT ALL ON TABLE public.cartelera_items TO service_role;


--
-- Name: TABLE cartelera_principal; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cartelera_principal TO anon;
GRANT ALL ON TABLE public.cartelera_principal TO authenticated;
GRANT ALL ON TABLE public.cartelera_principal TO service_role;


--
-- Name: TABLE categorias_usuario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.categorias_usuario TO anon;
GRANT ALL ON TABLE public.categorias_usuario TO authenticated;
GRANT ALL ON TABLE public.categorias_usuario TO service_role;


--
-- Name: TABLE chat_historial; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_historial TO anon;
GRANT ALL ON TABLE public.chat_historial TO authenticated;
GRANT ALL ON TABLE public.chat_historial TO service_role;


--
-- Name: TABLE chat_mensajes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_mensajes TO anon;
GRANT ALL ON TABLE public.chat_mensajes TO authenticated;
GRANT ALL ON TABLE public.chat_mensajes TO service_role;


--
-- Name: TABLE chat_sesiones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_sesiones TO anon;
GRANT ALL ON TABLE public.chat_sesiones TO authenticated;
GRANT ALL ON TABLE public.chat_sesiones TO service_role;


--
-- Name: TABLE comentarios_lectura; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.comentarios_lectura TO anon;
GRANT ALL ON TABLE public.comentarios_lectura TO authenticated;
GRANT ALL ON TABLE public.comentarios_lectura TO service_role;


--
-- Name: TABLE comunidad_codigos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.comunidad_codigos TO anon;
GRANT ALL ON TABLE public.comunidad_codigos TO authenticated;
GRANT ALL ON TABLE public.comunidad_codigos TO service_role;


--
-- Name: TABLE comunidad_lecturas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.comunidad_lecturas TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.comunidad_lecturas TO authenticated;
GRANT ALL ON TABLE public.comunidad_lecturas TO service_role;


--
-- Name: COLUMN comunidad_lecturas.fecha_meta; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(fecha_meta) ON TABLE public.comunidad_lecturas TO authenticated;


--
-- Name: COLUMN comunidad_lecturas.encuentro_lugar; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(encuentro_lugar) ON TABLE public.comunidad_lecturas TO authenticated;


--
-- Name: COLUMN comunidad_lecturas.encuentro_fecha; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(encuentro_fecha) ON TABLE public.comunidad_lecturas TO authenticated;


--
-- Name: TABLE comunidad_miembros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.comunidad_miembros TO anon;
GRANT ALL ON TABLE public.comunidad_miembros TO authenticated;
GRANT ALL ON TABLE public.comunidad_miembros TO service_role;


--
-- Name: TABLE comunidades; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.comunidades TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.comunidades TO authenticated;
GRANT ALL ON TABLE public.comunidades TO service_role;


--
-- Name: COLUMN comunidades.nombre; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(nombre) ON TABLE public.comunidades TO authenticated;


--
-- Name: COLUMN comunidades.descripcion; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(descripcion) ON TABLE public.comunidades TO authenticated;


--
-- Name: COLUMN comunidades.privada; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(privada) ON TABLE public.comunidades TO authenticated;


--
-- Name: COLUMN comunidades.libro_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(libro_id) ON TABLE public.comunidades TO authenticated;


--
-- Name: TABLE creadores_comunidad; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.creadores_comunidad TO anon;
GRANT ALL ON TABLE public.creadores_comunidad TO authenticated;
GRANT ALL ON TABLE public.creadores_comunidad TO service_role;


--
-- Name: TABLE denuncias; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.denuncias TO anon;
GRANT ALL ON TABLE public.denuncias TO authenticated;
GRANT ALL ON TABLE public.denuncias TO service_role;


--
-- Name: TABLE libros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.libros TO anon;
GRANT ALL ON TABLE public.libros TO authenticated;
GRANT ALL ON TABLE public.libros TO service_role;


--
-- Name: TABLE elementos_con_contexto; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.elementos_con_contexto TO anon;
GRANT ALL ON TABLE public.elementos_con_contexto TO authenticated;
GRANT ALL ON TABLE public.elementos_con_contexto TO service_role;


--
-- Name: TABLE foros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.foros TO anon;
GRANT ALL ON TABLE public.foros TO authenticated;
GRANT ALL ON TABLE public.foros TO service_role;


--
-- Name: TABLE foros_comentarios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.foros_comentarios TO anon;
GRANT ALL ON TABLE public.foros_comentarios TO authenticated;
GRANT ALL ON TABLE public.foros_comentarios TO service_role;


--
-- Name: TABLE libro_reels; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.libro_reels TO anon;
GRANT ALL ON TABLE public.libro_reels TO authenticated;
GRANT ALL ON TABLE public.libro_reels TO service_role;


--
-- Name: TABLE media_por_parrafo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.media_por_parrafo TO anon;
GRANT ALL ON TABLE public.media_por_parrafo TO authenticated;
GRANT ALL ON TABLE public.media_por_parrafo TO service_role;


--
-- Name: TABLE libros_resumen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.libros_resumen TO anon;
GRANT ALL ON TABLE public.libros_resumen TO authenticated;
GRANT ALL ON TABLE public.libros_resumen TO service_role;


--
-- Name: TABLE mensajitos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.mensajitos TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.mensajitos TO authenticated;
GRANT ALL ON TABLE public.mensajitos TO service_role;


--
-- Name: COLUMN mensajitos.leido_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(leido_at) ON TABLE public.mensajitos TO authenticated;


--
-- Name: TABLE perfiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.perfiles TO anon;
GRANT ALL ON TABLE public.perfiles TO authenticated;
GRANT ALL ON TABLE public.perfiles TO service_role;


--
-- Name: TABLE perfiles_publicos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.perfiles_publicos TO authenticated;
GRANT ALL ON TABLE public.perfiles_publicos TO service_role;


--
-- Name: TABLE predicciones_usuario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.predicciones_usuario TO anon;
GRANT ALL ON TABLE public.predicciones_usuario TO authenticated;
GRANT ALL ON TABLE public.predicciones_usuario TO service_role;


--
-- Name: TABLE preferencias_usuario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.preferencias_usuario TO anon;
GRANT ALL ON TABLE public.preferencias_usuario TO authenticated;
GRANT ALL ON TABLE public.preferencias_usuario TO service_role;


--
-- Name: TABLE progreso_lectura; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.progreso_lectura TO anon;
GRANT ALL ON TABLE public.progreso_lectura TO authenticated;
GRANT ALL ON TABLE public.progreso_lectura TO service_role;


--
-- Name: TABLE resenas_libros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.resenas_libros TO anon;
GRANT ALL ON TABLE public.resenas_libros TO authenticated;
GRANT ALL ON TABLE public.resenas_libros TO service_role;


--
-- Name: TABLE sala_libros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sala_libros TO anon;
GRANT ALL ON TABLE public.sala_libros TO authenticated;
GRANT ALL ON TABLE public.sala_libros TO service_role;


--
-- Name: TABLE salas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.salas TO anon;
GRANT ALL ON TABLE public.salas TO authenticated;
GRANT ALL ON TABLE public.salas TO service_role;


--
-- Name: TABLE sesiones_lectura; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sesiones_lectura TO anon;
GRANT ALL ON TABLE public.sesiones_lectura TO authenticated;
GRANT ALL ON TABLE public.sesiones_lectura TO service_role;


--
-- Name: TABLE subrayados_usuario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subrayados_usuario TO anon;
GRANT ALL ON TABLE public.subrayados_usuario TO authenticated;
GRANT ALL ON TABLE public.subrayados_usuario TO service_role;


--
-- Name: TABLE subrayados_populares; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subrayados_populares TO authenticated;
GRANT ALL ON TABLE public.subrayados_populares TO service_role;


--
-- Name: TABLE superusuarios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.superusuarios TO anon;
GRANT ALL ON TABLE public.superusuarios TO authenticated;
GRANT ALL ON TABLE public.superusuarios TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict inmersia

