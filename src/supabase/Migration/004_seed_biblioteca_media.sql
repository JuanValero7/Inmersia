-- =============================================================
-- INMERSIA — Seed inicial de biblioteca_media
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Ejecutar DESPUES de 003_biblioteca_media.sql
--
-- 11 sonidos cargados manualmente al bucket "Biblioteca de Sonidos".
-- ON CONFLICT (slug) DO UPDATE permite re-correr el script sin error
-- si despues querés ajustar titulos/tags.
-- =============================================================

INSERT INTO biblioteca_media (slug, tipo, url, titulo, tags) VALUES
  (
    'reparacion',
    'audio',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Sonidos/SFX_Avion-Grupo_DV_260508.wav',
    'Reparacion infantil',
    ARRAY['mecanica','robots']
  ),
  (
    'cordero_1',
    'audio',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Sonidos/SFX_Baobabs_CorderoSonido_1_DV_260508.wav',
    'Cordero 1',
    ARRAY['animal','granja']
  ),
  (
    'cordero_2',
    'audio',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Sonidos/SFX_Baobabs_CorderoSonido_2_DV_260508.wav',
    'Cordero 2',
    ARRAY['animal','granja']
  ),
  (
    'cordero_3',
    'audio',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Sonidos/SFX_Baobabs_CorderoSonido_3_DV_260508.wav',
    'Cordero 3',
    ARRAY['animal','granja']
  ),
  (
    'desierto',
    'audio',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Sonidos/SFX_Desierto_DV_260508.wav',
    'Viento del desierto',
    ARRAY['desierto']
  ),
  (
    'dibujo_1',
    'audio',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Sonidos/SFX_Dibujo_1_DV_260508.wav',
    'Dibujo 1',
    ARRAY['arte','dibujo','papel']
  ),
  (
    'dibujo_2',
    'audio',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Sonidos/SFX_Dibujo_2_DV_260508.wav',
    'Dibujo 2',
    ARRAY['arte','dibujo','papel']
  ),
  (
    'dibujo_3',
    'audio',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Sonidos/SFX_Dibujo_3_DV_260508.wav',
    'Dibujo 3',
    ARRAY['arte','dibujo','papel']
  ),
  (
    'dibujo_4',
    'audio',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Sonidos/SFX_Dibujo_4_DV_260508.wav',
    'Dibujo 4',
    ARRAY['arte','dibujo','papel']
  ),
  (
    'chispa_magia',
    'audio',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Sonidos/SFX_DibujoCobraVida_DV_260508.wav',
    'Chispa Magia',
    ARRAY['magia','aparicion','infantil']
  ),
  (
    'magia_aparicion',
    'audio',
    'https://uptgjdbtwuxasetjtdrs.supabase.co/storage/v1/object/public/Biblioteca%20de%20Sonidos/SFX_Principito_DV_260508.wav',
    'Mago introduccion infantil',
    ARRAY['magia','aparicion','infantil']
  )
ON CONFLICT (slug) DO UPDATE SET
  tipo     = EXCLUDED.tipo,
  url      = EXCLUDED.url,
  titulo   = EXCLUDED.titulo,
  tags     = EXCLUDED.tags;

-- Verificacion: deberian aparecer 11 filas
SELECT slug, titulo, tags FROM biblioteca_media ORDER BY slug;
