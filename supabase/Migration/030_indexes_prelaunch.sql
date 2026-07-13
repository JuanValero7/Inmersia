-- =============================================================
-- INMERSIA — Índices pre-lanzamiento v1
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Contexto: auditoría de indexing/cache/async del 2026-07-13 antes
-- del lanzamiento público. Cubre columnas que se agregaron a mano
-- en Studio (slug, visible en libros; bibliotecas_usuarios;
-- categorias_usuario; cartelera_principal) y que nunca tuvieron
-- migración ni índice — y un caso donde el índice existente no
-- sirve para el patrón de query real (subrayados_usuario).
--
-- Todo usa IF NOT EXISTS: idempotente, seguro de re-correr.
-- =============================================================

-- libros.slug: lookup directo en useBookBySlug.js (Lector/Investigación/
-- Foro por URL /:slug) y en LectorRoute. Se espera un valor por libro.
CREATE UNIQUE INDEX IF NOT EXISTS idx_libros_slug
  ON libros (slug);

-- libros visibles ordenados por fecha: Tienda (useTiendaData.js) y
-- Biblioteca (useBiblioteca.js) piden `WHERE visible = true
-- ORDER BY created_at DESC` en cada carga. Parcial: no indexa libros
-- ocultos/borradores, que no participan de esta query.
CREATE INDEX IF NOT EXISTS idx_libros_visible_created
  ON libros (created_at DESC)
  WHERE visible = true;

-- bibliotecas_usuarios: "¿el usuario X tiene el libro Y?" — la query
-- más repetida de la app (useBiblioteca, useTiendaData, useAlbum,
-- useCompraLibro, useLectorData, Lector/LectorMobile al completar).
CREATE INDEX IF NOT EXISTS idx_bibliotecas_usuarios_user_libro
  ON bibliotecas_usuarios (user_id, libro_id);

-- categorias_usuario: useBiblioteca.js pide
-- `WHERE user_id = X ORDER BY orden, nombre` en cada carga de Biblioteca.
CREATE INDEX IF NOT EXISTS idx_categorias_usuario_user
  ON categorias_usuario (user_id, orden, nombre);

-- cartelera_principal: imagen/video hero por libro. useCartelera.js
-- filtra por un libro_id; useAlbum.js con IN (libroIds) para varios.
CREATE INDEX IF NOT EXISTS idx_cartelera_principal_libro
  ON cartelera_principal (libro_id);

-- subrayados_usuario: el único índice existente (idx_subrayados_user_libro,
-- migración 011) lidera con user_id, así que no sirve para el scan de
-- PanelLibro.jsx (reseñas de un libro) que filtra SOLO por libro_id con
-- parrafo_id IS NOT NULL. Parcial: excluye subrayados sin parrafo_id,
-- que ese filtro tampoco usa.
CREATE INDEX IF NOT EXISTS idx_subrayados_libro_con_parrafo
  ON subrayados_usuario (libro_id)
  WHERE parrafo_id IS NOT NULL;

-- =============================================================
-- NOTA — no incluido arriba, requiere revisión manual antes de aplicar:
--
-- bibliotecas_usuarios podría no tener UNIQUE(user_id, libro_id).
-- Sin eso, comprar() (useCompraLibro.js) podría insertar filas
-- duplicadas de "el usuario compró este libro". Antes de agregar la
-- constraint, correr esto para confirmar que no hay duplicados ya:
--
--   SELECT user_id, libro_id, COUNT(*)
--   FROM bibliotecas_usuarios
--   GROUP BY user_id, libro_id
--   HAVING COUNT(*) > 1;
--
-- Si devuelve 0 filas:
--   ALTER TABLE bibliotecas_usuarios
--     ADD CONSTRAINT bibliotecas_usuarios_user_libro_unique
--     UNIQUE (user_id, libro_id);
-- =============================================================
