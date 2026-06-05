-- =============================================================
-- INMERSIA — Seed de imagenes (Biblioteca de Imagenes)
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Ejecutar DESPUES de 008_cartelera_imagenes.sql
--
-- 14 imagenes cargadas manualmente al bucket "Biblioteca de Imagenes".
-- Mismo patron que 004_seed_biblioteca_media.sql (sonidos):
-- ON CONFLICT (slug) DO UPDATE permite re-correr el script.
-- =============================================================

INSERT INTO biblioteca_media (slug, tipo, url, titulo, tags) VALUES
  (
    'b612',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/B612.jpg',
    'B612',
    ARRAY['principito']
  ),
  (
    'bebedor',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/BebedorP.jpg',
    'Bebedor',
    ARRAY['principito']
  ),
  (
    'faro',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/FaroP.jpg',
    'Farolero',
    ARRAY['principito']
  ),
  (
    'geo',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/GeoP.jpg',
    'Geografo',
    ARRAY['principito']
  ),
  (
    'jdr',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/JdRP.jpg',
    'Jardin de Rosas',
    ARRAY['principito']
  ),
  (
    'nego',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/NegoP.jpg',
    'Hombre de Negocios',
    ARRAY['principito']
  ),
  (
    'principito',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/Principito.jpg',
    'Principito',
    ARRAY['principito']
  ),
  (
    'rey',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/ReyP.jpg',
    'Rey',
    ARRAY['principito']
  ),
  (
    'rosa',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/RosaP.jpg',
    'Rosa',
    ARRAY['principito']
  ),
  (
    'sahara',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/SaharaP.jpg',
    'Sahara',
    ARRAY['principito']
  ),
  (
    'ser',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/SerP.jpg',
    'Serpiente',
    ARRAY['principito']
  ),
  (
    'tierra',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/TierraP.jpg',
    'Tierra',
    ARRAY['principito']
  ),
  (
    'vani',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/VaniP.jpg',
    'Vanidoso',
    ARRAY['principito']
  ),
  (
    'zorro',
    'imagen',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Imagenes/zorro.jpg',
    'Zorro',
    ARRAY['principito']
  )
ON CONFLICT (slug) DO UPDATE SET
  tipo   = EXCLUDED.tipo,
  url    = EXCLUDED.url,
  titulo = EXCLUDED.titulo,
  tags   = EXCLUDED.tags;

-- Verificacion: deberian aparecer 14 filas tipo='imagen'
SELECT slug, titulo, tags
FROM biblioteca_media
WHERE tipo = 'imagen'
ORDER BY slug;
