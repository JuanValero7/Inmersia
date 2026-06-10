-- =============================================================
-- INMERSIA — Consolidar catalogo_libros → libros
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =============================================================

-- 1. Agregar columnas faltantes a libros
ALTER TABLE libros
  ADD COLUMN IF NOT EXISTS color   TEXT,
  ADD COLUMN IF NOT EXISTS paginas INT;

-- 2. Limpiar bibliotecas_usuarios (todos apuntan a mock data)
TRUNCATE TABLE bibliotecas_usuarios;

-- 3. Eliminar FK viejo de bibliotecas_usuarios → catalogo_libros
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM   pg_constraint
  WHERE  conrelid = 'bibliotecas_usuarios'::regclass
    AND  contype  = 'f'
    AND  conname  LIKE '%libro_id%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE bibliotecas_usuarios DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

-- 4. Eliminar catalogo_libros
DROP TABLE IF EXISTS catalogo_libros CASCADE;

-- 5. Cambiar tipo de libro_id de integer → uuid
--    (catalogo_libros usaba IDs enteros; libros usa uuid)
ALTER TABLE bibliotecas_usuarios
  ALTER COLUMN libro_id TYPE uuid USING NULL;

-- 6. Nuevo FK: bibliotecas_usuarios.libro_id → libros.id
ALTER TABLE bibliotecas_usuarios
  ADD CONSTRAINT bibliotecas_usuarios_libro_id_fkey
  FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE CASCADE;

-- VERIFICACIÓN
SELECT id, titulo, autor, paginas, color, descripcion, portada_url
FROM   libros
ORDER  BY titulo;
