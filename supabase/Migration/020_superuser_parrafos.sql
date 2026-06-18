-- ─────────────────────────────────────────────────────────────
-- 020: Superusuario puede eliminar párrafos permanentemente
--
-- progreso_lectura.ultimo_parrafo_id no tiene ON DELETE CASCADE,
-- así que un DELETE directo fallaría con FK violation si algún
-- usuario apunta a ese párrafo.  La función RPC resuelve esto
-- actualizando primero el progreso al párrafo anterior más cercano.
-- ─────────────────────────────────────────────────────────────

-- RLS: superusuario puede DELETE directamente en parrafos
DROP POLICY IF EXISTS "superusuario_parrafos_delete" ON parrafos;
CREATE POLICY "superusuario_parrafos_delete"
  ON parrafos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM superusuarios WHERE user_id = auth.uid()));

-- Función SECURITY DEFINER para borrar un párrafo de forma segura.
-- 1. Verifica que el llamante sea superusuario.
-- 2. Actualiza progreso_lectura de todos los usuarios que estaban
--    en ese párrafo, moviéndolos al anterior más próximo del mismo capítulo.
-- 3. Elimina el párrafo (CASCADE elimina elementos_interactivos;
--    SET NULL ya maneja subrayados_usuario).
CREATE OR REPLACE FUNCTION delete_parrafo_superuser(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION delete_parrafo_superuser(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_parrafo_superuser(UUID) TO authenticated;
