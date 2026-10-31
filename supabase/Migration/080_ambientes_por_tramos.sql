-- =============================================================
-- INMERSIA — Migración 080
-- Sonido de ambiente por tramos de párrafos (ficción)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- CONTEXTO
-- Cada capítulo de ficción puede llevar sus tramos de ambiente: qué suena de
-- fondo del párrafo x al y (decidido con Juan el 31 oct 2026). El lector mira
-- el primer párrafo de la página que se ve y pone el ambiente de su tramo; al
-- cambiar de tramo hace un fundido.
--
--   ambientes = [{"desde": 1, "hasta": 14, "ambiente": "casa_silencio"},
--                {"desde": 15, "hasta": 40, "ambiente": "lluvia_ventana"}]
--
-- "ambiente" es un slug del catálogo de la app (src/lib/ambientes.js) o
-- "ninguno". NULL = el capítulo no tiene ambiente y el lector no muestra el
-- control de sonido. Los tramos los calcula scripts ficcion/asignar_ambientes.py
-- y los carga scripts ficcion/cargar_ambientes.py.
--
-- Va en `capitulos` y no en una tabla aparte porque el lector ya trae los
-- capítulos al abrir el libro: los tramos llegan sin ninguna consulta más.
-- `capitulos` ya se lee con las políticas de siempre; no cambia nada de RLS.
-- =============================================================

alter table public.capitulos
  add column if not exists ambientes jsonb;

comment on column public.capitulos.ambientes is
  'Tramos de sonido de ambiente: [{desde, hasta, ambiente}] por número de párrafo. NULL = sin ambiente.';
