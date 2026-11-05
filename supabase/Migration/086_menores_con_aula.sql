-- =============================================================
-- INMERSIA — Migración 086
-- 12 y 13 años: solo con el código de un aula
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la 081–085.
--
-- DECISIÓN (Juan, 3 nov 2026)
--   Inmersia para colegios es desde 1.º de secundaria (12–13 años). El
--   registro libre sigue siendo de 14 en adelante. Con 12 o 13 solo se
--   entra con el código de un aula: el colegio es el responsable de esos
--   datos y garantiza la autorización de los padres (acuerdo de datos con
--   el colegio). El alumno marca además que sus padres o tutores están
--   informados; ese check es un complemento, no la base legal.
--
-- QUÉ HACE
--   1. codigo_aula_valido(): la app lo pregunta ANTES de crear la cuenta
--      (también sin sesión), para avisar si el código está mal escrito.
--   2. Alta con correo (trigger de la 073): con 12–13 años, sin un código de
--      aula válido, nombre y el check, la cuenta no se crea. Con todo, entra
--      al aula en el mismo momento (y recibe su libro, 085). Menos de 12:
--      no se crea.
--   3. perfiles.fecha_nacimiento: no se puede guardar una fecha de 12–13
--      años si la persona no está en un aula (cubre «Continuar con Google»,
--      que pone la fecha después), ni una de menos de 12.
--   4. Un menor de 14 no puede salirse solo de su única aula. El colegio sí
--      puede sacarlo.
--   El chat privado y los mensajitos siguen pidiendo 16 (051).
--
-- Idempotente. Después: npm run esquema y commit del volcado.
-- =============================================================


-- ── 0. Edad en años cumplidos (uso interno) ──────────────────
CREATE OR REPLACE FUNCTION public._edad(p_fecha date)
RETURNS int
LANGUAGE sql STABLE
AS $fn$
  SELECT CASE WHEN p_fecha IS NULL THEN NULL
              ELSE extract(year FROM age(current_date, p_fecha))::int END;
$fn$;


-- ── 1. ¿Es el código de un aula? (sin sesión también) ────────
CREATE OR REPLACE FUNCTION public.codigo_aula_valido(p_codigo text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM comunidad_codigos cc JOIN comunidades co ON co.id = cc.comunidad_id
    WHERE cc.codigo = upper(btrim(p_codigo)) AND co.colegio_id IS NOT NULL
  );
$fn$;

REVOKE ALL ON FUNCTION public.codigo_aula_valido(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.codigo_aula_valido(text) TO anon, authenticated;


-- ── 2. Meter a alguien en un aula por su código (uso interno) ─
CREATE OR REPLACE FUNCTION public._alta_en_aula(p_user uuid, p_codigo text, p_nombre text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_aula   uuid;
  v_nombre text := nullif(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), '');
BEGIN
  SELECT cc.comunidad_id INTO v_aula
  FROM comunidad_codigos cc JOIN comunidades co ON co.id = cc.comunidad_id
  WHERE cc.codigo = upper(btrim(p_codigo)) AND co.colegio_id IS NOT NULL;

  IF v_aula IS NULL OR v_nombre IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO comunidad_miembros (comunidad_id, user_id, rol, nombre_en_aula)
  VALUES (v_aula, p_user, 'miembro', v_nombre)
  ON CONFLICT (comunidad_id, user_id) DO UPDATE SET nombre_en_aula = EXCLUDED.nombre_en_aula;
  PERFORM _dar_libro_aula(v_aula, p_user);
  RETURN v_aula;
END;
$fn$;

REVOKE ALL ON FUNCTION public._alta_en_aula(uuid, text, text) FROM PUBLIC, anon, authenticated;


-- ── 3. Alta con correo (reemplaza el trigger de la 073) ──────
-- Lo nuevo es el bloque de la edad. Si falla, la cuenta no se crea: la app
-- ya comprobó el código con codigo_aula_valido(), así que aquí solo llega
-- quien se saltó la app.
CREATE OR REPLACE FUNCTION public._trg_perfil_al_registrarse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta  jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_fecha date;
  v_edad  int;
BEGIN
  BEGIN
    v_fecha := nullif(v_meta->>'fecha_nacimiento', '')::date;
  EXCEPTION WHEN others THEN
    v_fecha := NULL;
  END;
  v_edad := _edad(v_fecha);

  IF v_edad IS NOT NULL AND v_edad < 12 THEN
    RAISE EXCEPTION 'Inmersia es para alumnos desde los 12 años.' USING ERRCODE = '42501', HINT = 'menor_de_12';
  END IF;

  IF v_edad IS NOT NULL AND v_edad < 14 THEN
    IF coalesce(v_meta->>'consentimiento_padres', '') <> 'true'
       OR _alta_en_aula(NEW.id, v_meta->>'codigo_aula', v_meta->>'nombre_en_aula') IS NULL THEN
      RAISE EXCEPTION 'Con 12 o 13 años hace falta el código de tu aula.' USING ERRCODE = '42501', HINT = 'menor_sin_aula';
    END IF;
  END IF;

  BEGIN
    PERFORM _crear_perfil(NEW.id, v_meta);
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

REVOKE EXECUTE ON FUNCTION public._trg_perfil_al_registrarse() FROM PUBLIC, anon, authenticated;


-- ── 4. La fecha de nacimiento de un perfil ───────────────────
-- Menos de 12: nunca. 12–13: solo si ya está en un aula como alumno.
-- (La 074 sigue impidiendo cambiarla una vez puesta.)
CREATE OR REPLACE FUNCTION public._trg_fecha_menor_con_aula()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_edad int := _edad(NEW.fecha_nacimiento);
BEGIN
  IF v_edad IS NULL OR v_edad >= 14 THEN
    RETURN NEW;
  END IF;
  IF v_edad < 12 THEN
    RAISE EXCEPTION 'Inmersia es para alumnos desde los 12 años.' USING ERRCODE = '42501', HINT = 'menor_de_12';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM comunidad_miembros m JOIN comunidades co ON co.id = m.comunidad_id
    WHERE m.user_id = NEW.id AND m.rol = 'miembro' AND co.colegio_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Con 12 o 13 años hace falta el código de tu aula.' USING ERRCODE = '42501', HINT = 'menor_sin_aula';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public._trg_fecha_menor_con_aula() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_fecha_menor_con_aula ON public.perfiles;
CREATE TRIGGER trg_fecha_menor_con_aula
  BEFORE INSERT OR UPDATE OF fecha_nacimiento ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public._trg_fecha_menor_con_aula();


-- ── 5. Un menor de 14 no se sale solo de su única aula ───────
-- Solo cuando se va él mismo (auth.uid() = el que sale). El colegio y el
-- profe pueden sacarlo; borrar la cuenta tampoco se frena (ya no existe
-- en auth.users cuando llega el CASCADE).
CREATE OR REPLACE FUNCTION public._trg_menor_no_sale_del_aula()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF OLD.rol = 'miembro'
     AND auth.uid() = OLD.user_id
     AND EXISTS (SELECT 1 FROM comunidades WHERE id = OLD.comunidad_id AND colegio_id IS NOT NULL)
     AND EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id)
     AND (SELECT _edad(fecha_nacimiento) FROM perfiles WHERE id = OLD.user_id) < 14
     AND NOT EXISTS (
       SELECT 1 FROM comunidad_miembros m JOIN comunidades co ON co.id = m.comunidad_id
       WHERE m.user_id = OLD.user_id AND m.comunidad_id <> OLD.comunidad_id
         AND m.rol = 'miembro' AND co.colegio_id IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Para salir de tu aula, habla con tu profesor.' USING ERRCODE = '42501', HINT = 'menor_unica_aula';
  END IF;
  RETURN OLD;
END;
$fn$;

REVOKE ALL ON FUNCTION public._trg_menor_no_sale_del_aula() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_menor_no_sale_del_aula ON public.comunidad_miembros;
CREATE TRIGGER trg_menor_no_sale_del_aula
  BEFORE DELETE ON public.comunidad_miembros
  FOR EACH ROW EXECUTE FUNCTION public._trg_menor_no_sale_del_aula();


-- ── 6. Cada uno ve sus capítulos terminados (084) ────────────
-- Para «Descargar mis datos» (src/lib/misDatos.js): es dato suyo.
DROP POLICY IF EXISTS "progreso_capitulos_log_select_own" ON public.progreso_capitulos_log;
CREATE POLICY "progreso_capitulos_log_select_own"
  ON public.progreso_capitulos_log FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- =============================================================
-- COMPROBACIÓN
--   1. Sin sesión: SELECT codigo_aula_valido('<código de aula>');  → true
--                  SELECT codigo_aula_valido('<código de club>');  → false
--   2. Registro con fecha de 13 años sin código → la cuenta no se crea.
--      Con código, nombre y check → entra al aula y tiene el libro.
--   3. Registro con fecha de 11 años → no se crea.
--   4. Ese alumno de 13 intenta salir de su aula → 'Para salir de tu aula…'.
--      El profe lo saca → sí.
-- =============================================================
