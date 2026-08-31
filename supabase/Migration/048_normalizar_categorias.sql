-- =============================================================
-- INMERSIA — Normalizar las categorías del catálogo
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- EL PROBLEMA
--   `libros.categorias` se fue llenando a mano libro por libro y quedó con:
--     · erratas y variantes del mismo género:
--         'Filosfía', 'Filosofia', 'Filosofía'  → tres etiquetas distintas
--         'Romantico', 'Romanticismo'           → mal acentuada / mal aplicada
--         'Ciencia Ficción'                     → mayúscula intermedia
--     · etiquetas de una sola aparición que ensucian el filtro de la Tienda
--       ('Nihilismo', 'Intriga', 'Crimen', 'Sátira', 'Mitología', 'Historia')
--     · géneros mal asignados: De profundis (una carta de cárcel) como
--       'Romantico', La bolsa de huesos (novela policial) como 'Ciencia Ficción',
--       El cupón falso (parábola moral) como 'Intriga'.
--
--   `useCatalogoFiltro` construye los chips del filtro con
--   `[...new Set(catalogo.flatMap(b => b.categorias))]`, así que CADA variante
--   aparecía como un chip propio: el lector veía "Filosfía", "Filosofia" y
--   "Filosofía" como tres géneros diferentes.
--
-- EL VOCABULARIO NUEVO (12 categorías, alineado con la división
-- Ficción / No ficción que ya hace `es_ficcion`):
--
--   FICCIÓN     Aventura · Fantasía · Ciencia ficción · Misterio · Terror ·
--               Romance · Drama · Cuentos · Novela histórica
--   NO FICCIÓN  Filosofía · Ensayo · Economía
--
--   Se elimina 'Clásicos': estaba en 12 de 51 libros de forma arbitraria y el
--   catálogo ENTERO es dominio público anterior a 1940, así que como filtro no
--   separa nada. (Si prefieres conservarla, comenta el bloque ③.)
--   'Horror' pasa a 'Terror', la etiqueta habitual del género en español.
--
-- Idempotente: se puede correr las veces que sea.
-- El Manual del Explorador (visible = false) se queda con categorias = '{}'.
-- =============================================================

BEGIN;

-- ① Asignación libro por libro. La lista es el catálogo completo (50 libros
--    visibles); cualquier libro nuevo que no esté aquí conserva sus categorías.
UPDATE libros AS l
   SET categorias = v.cats
  FROM (VALUES
    -- ── Ficción ────────────────────────────────────────────────
    ('fbc33746-d169-4dad-b96a-38bbf85f2569'::uuid, ARRAY['Fantasía','Aventura']),          -- El Principito
    ('d5b546c2-f72a-4540-8981-d8e115375251'::uuid, ARRAY['Fantasía','Aventura']),          -- Alicia en el país de las Maravillas
    ('3ed3be8c-8c9b-4590-9620-5fcd568635c2'::uuid, ARRAY['Aventura']),                     -- Robinson Crusoe
    ('2ce26535-6dd6-4200-a3f8-0c1930ffcd0c'::uuid, ARRAY['Aventura']),                     -- Bambi, una vida en el bosque
    ('05a01682-7109-4de7-886b-fcfdc8e835f0'::uuid, ARRAY['Aventura']),                     -- Capitanes Intrépidos
    ('23914e81-7111-44e1-a018-8cd92f39c467'::uuid, ARRAY['Aventura']),                     -- El Corsario Negro
    ('37873a6b-6e70-4740-98cf-d7b3d27b8825'::uuid, ARRAY['Aventura','Fantasía']),          -- Horizontes perdidos
    ('bc7587a4-eea4-4075-9d07-cf7b911c46ab'::uuid, ARRAY['Ciencia ficción','Aventura']),   -- Una princesa de Marte
    ('2315f13c-0182-4a45-957d-256fc6917011'::uuid, ARRAY['Terror','Ciencia ficción']),     -- En las montañas de la locura
    ('6db631af-7f0e-40ce-b075-011cb220383a'::uuid, ARRAY['Terror','Misterio']),            -- El extraño caso del Dr. Jekyll y Mr. Hyde
    ('2a3170f9-f3a2-4a02-8564-7aa3fa413c57'::uuid, ARRAY['Fantasía','Terror']),            -- El fantasma de Canterville
    ('c832c2c2-768d-45c3-a0ce-a378c477435a'::uuid, ARRAY['Terror','Cuentos']),             -- El entierro de las ratas
    ('4cc88fcc-ee48-45e8-820c-6677bc5c7dbd'::uuid, ARRAY['Misterio','Cuentos']),           -- Los crímenes de la calle Morgue
    ('25280162-64fc-48e3-a7aa-7ede46e112f0'::uuid, ARRAY['Misterio','Aventura']),          -- El signo de los cuatro
    ('85f39d63-e66c-4c7d-840f-d7070d15b396'::uuid, ARRAY['Misterio','Cuentos']),           -- La gota de sangre y un destripador de antaño
    ('f1f4aa90-919f-46f9-b1bd-c608a0887a13'::uuid, ARRAY['Misterio','Terror']),            -- La bolsa de huesos
    ('3a5e683d-c547-4236-875f-ecdfe64dd221'::uuid, ARRAY['Romance','Drama']),              -- Noches Blancas
    ('beb0389d-d5a0-42d0-932b-9d72f0a27319'::uuid, ARRAY['Romance','Drama']),              -- Primer amor
    ('ecea977c-a9c4-49b7-8a6e-98655f344370'::uuid, ARRAY['Drama']),                        -- La muerte en Venecia
    ('0a4c4857-8e13-43ab-ad3e-30a49f65ebc6'::uuid, ARRAY['Drama']),                        -- Novela de ajedrez
    ('90f8102f-c069-49e3-83fe-8f7180a6c650'::uuid, ARRAY['Drama']),                        -- La busca
    ('19b002d0-a3df-4eb9-bb41-cb4ce59ac04d'::uuid, ARRAY['Drama']),                        -- Largo viaje hacia la noche
    ('d291b3d3-1d94-41bf-9481-51cdbaf4cc14'::uuid, ARRAY['Drama']),                        -- El cupón falso
    ('fbf581e1-65bf-45ba-8310-36e74bde17cc'::uuid, ARRAY['Cuentos','Drama']),              -- La sala número seis
    ('663082c9-9349-41df-b626-6f51c7d21ec6'::uuid, ARRAY['Cuentos','Drama']),              -- Santiago Damour
    ('76287579-68b0-40b8-b60b-f3cdba2ccf9c'::uuid, ARRAY['Cuentos']),                      -- Tres cuentos
    ('61de717d-a536-42b0-ab11-f1ff6875e13e'::uuid, ARRAY['Fantasía','Cuentos']),           -- Cuando la tierra era niña
    ('c25969a2-05f0-422d-b0c1-15d9b3c3ce1e'::uuid, ARRAY['Fantasía','Cuentos']),           -- El donador de almas y el diablo desinteresado
    ('1e960dc7-48b4-41cd-abaf-6114504c0f7b'::uuid, ARRAY['Novela histórica','Drama']),     -- El rojo emblema del valor
    ('e05c3604-ff46-461e-bdbc-fd8ccf1a897b'::uuid, ARRAY['Novela histórica','Aventura']),  -- Hacia el reino de los Sciris

    -- ── No ficción ─────────────────────────────────────────────
    ('1d1fb28e-4cd3-4440-b172-365d99e3f707'::uuid, ARRAY['Filosofía']),                    -- El Arte de la Guerra
    ('e35eb32f-4dee-47a0-b320-51e15b696013'::uuid, ARRAY['Filosofía']),                    -- Meditaciones
    ('0cc2e544-fcca-4fc1-8f5c-04fbf2516353'::uuid, ARRAY['Filosofía']),                    -- El banquete, o del amor
    ('6c546b35-9c9d-40b9-9c04-567210f6dbcc'::uuid, ARRAY['Filosofía']),                    -- Discurso del método
    ('a9dd19c0-ad42-49d2-86e9-c6acf41e37e5'::uuid, ARRAY['Filosofía']),                    -- Aforismos sobre la sabiduría de la vida
    ('605af381-f657-40b9-9416-e76001cb6f5c'::uuid, ARRAY['Filosofía']),                    -- El ocaso de los ídolos
    ('ff5abec2-53cf-4a5e-9b0a-db340d70ce2a'::uuid, ARRAY['Filosofía']),                    -- Fundamentación de la metafísica
    ('025d5dbc-9021-4ff7-a81a-fd75a1ece9e8'::uuid, ARRAY['Filosofía']),                    -- Del sentimiento trágico de la vida
    ('acf467ac-f187-413a-809a-b399afae1411'::uuid, ARRAY['Filosofía']),                    -- La enfermedad mortal
    ('fd7ea40d-561e-4cf2-99c5-7f9009e4002f'::uuid, ARRAY['Filosofía']),                    -- Introducción a la estética
    ('7aa1398a-8dbf-4a7e-9eee-cebcdf2a86d1'::uuid, ARRAY['Filosofía']),                    -- El Pragmatismo
    ('b12df8c1-9550-462c-b9cc-3e3d261ba188'::uuid, ARRAY['Filosofía','Ensayo']),           -- Tratado sobre la tolerancia
    ('f505c6fe-0d7a-4d21-8a7f-aa0fd4099a1e'::uuid, ARRAY['Filosofía','Ensayo']),           -- El hombre y la gente
    ('092ec0dc-e5a7-4138-aca5-72deb471700b'::uuid, ARRAY['Ensayo','Filosofía']),           -- Una vindicación de los derechos de la mujer
    ('85256945-39d1-4b6e-a867-96d6a98024de'::uuid, ARRAY['Ensayo','Filosofía']),           -- El libro del té
    ('dd8f5770-4179-4bfb-8224-1a1bc44a8b80'::uuid, ARRAY['Ensayo','Filosofía']),           -- Una vida sin principios
    ('7e64bf17-0066-46e3-8a33-ef1db5ee9cd5'::uuid, ARRAY['Ensayo','Filosofía']),           -- Ensayos, Primera serie
    ('91092b42-ee0b-4324-9b68-b46f4ea9c697'::uuid, ARRAY['Ensayo','Filosofía']),           -- Lo personal y lo sagrado
    ('158ea9f2-38a6-4b5d-9727-5be30a952589'::uuid, ARRAY['Ensayo']),                       -- De profundis
    ('18f1b6f8-5d2a-4425-8c72-66e1b6e31014'::uuid, ARRAY['Economía','Ensayo'])             -- Del origen del dinero
  ) AS v(id, cats)
 WHERE l.id = v.id
   AND l.categorias IS DISTINCT FROM v.cats;

-- ② Red de seguridad para libros futuros que no estén en la lista de arriba:
--    reescribe las variantes conocidas al vocabulario nuevo, sin tocar nada más.
UPDATE libros
   SET categorias = ARRAY(
     SELECT DISTINCT ON (c) c
       FROM (
         SELECT CASE cat
                  WHEN 'Filosfía'        THEN 'Filosofía'
                  WHEN 'Filosofia'       THEN 'Filosofía'
                  WHEN 'Filosófico'      THEN 'Filosofía'
                  WHEN 'Nihilismo'       THEN 'Filosofía'
                  WHEN 'Horror'          THEN 'Terror'
                  WHEN 'Ciencia Ficción' THEN 'Ciencia ficción'
                  WHEN 'Romantico'       THEN 'Romance'
                  WHEN 'Romanticismo'    THEN 'Romance'
                  WHEN 'Realismo'        THEN 'Drama'
                  WHEN 'Intriga'         THEN 'Misterio'
                  WHEN 'Crimen'          THEN 'Misterio'
                  WHEN 'Sátira'          THEN 'Fantasía'
                  WHEN 'Mitología'       THEN 'Fantasía'
                  WHEN 'Fábula'          THEN 'Fantasía'
                  WHEN 'Historia'        THEN 'Novela histórica'
                  ELSE cat
                END AS c,
                ord
           FROM unnest(categorias) WITH ORDINALITY AS t(cat, ord)
       ) s
      ORDER BY c, ord
   )
 WHERE categorias && ARRAY['Filosfía','Filosofia','Filosófico','Nihilismo','Horror',
                           'Ciencia Ficción','Romantico','Romanticismo','Realismo',
                           'Intriga','Crimen','Sátira','Mitología','Fábula','Historia'];

-- ③ Quitar 'Clásicos' de donde haya quedado (ver la nota de la cabecera).
--    Si prefieres conservar la etiqueta, comenta este UPDATE.
UPDATE libros
   SET categorias = array_remove(categorias, 'Clásicos')
 WHERE 'Clásicos' = ANY(categorias);

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN — el vocabulario final y cuántos libros tiene cada categoría.
-- Deben salir exactamente 12 filas.
-- ─────────────────────────────────────────────────────────────
SELECT cat AS categoria, COUNT(*) AS libros
  FROM libros, unnest(categorias) AS cat
 WHERE visible IS DISTINCT FROM false
 GROUP BY cat
 ORDER BY libros DESC, cat;

-- Libros que quedaron SIN categoría (debería salir solo el Manual, o nada):
SELECT titulo, autor, es_ficcion
  FROM libros
 WHERE cardinality(categorias) = 0
 ORDER BY titulo;
