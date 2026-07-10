-- =============================================================
-- INMERSIA — Preferencia de gato de compañía
-- Color del gato que acompaña al usuario en el detalle de libro
-- (negro / blanco / naranja). Vive en preferencias_usuario junto
-- con el resto de preferencias de usuario.
-- =============================================================

ALTER TABLE preferencias_usuario
  ADD COLUMN IF NOT EXISTS gato_color TEXT NOT NULL DEFAULT 'negro'
    CHECK (gato_color IN ('negro', 'blanco', 'naranja'));
