// IDs fijos para el Manual del Explorador.
// Este UUID corresponde al libro creado en supabase/Migration/016_manual_explorador.sql.
// Cualquier cambio aquí debe hacerse también en ese archivo SQL.
export const MANUAL_LIBRO_ID = '00000000-0000-4000-8000-000000000001'

// Minutos de lectura de la muestra (invitados, y libros que no están en tu
// biblioteca). La muestra son los primeros párrafos hasta 2300 palabras =
// MINUTOS_MUESTRA × PALABRAS_POR_MINUTO (utils/formato.js). Quien decide qué
// párrafos entran es la base de datos (parrafos.en_muestra, migración 071),
// que aplica la RLS; acá solo se usa para los textos.
export const MINUTOS_MUESTRA = 10

// Versión de los documentos legales, igual a la fecha de "Última actualización"
// de Documentation/terminos-y-condiciones.md y politica-de-privacidad.md.
// Se guarda en el metadata del usuario al registrarse (ver Auth.jsx) para poder
// demostrar QUÉ versión aceptó cada quien. Al publicar un cambio significativo,
// actualizar esta constante junto con la fecha de los dos documentos.
export const LEGAL_VERSION = '2026-10-01'
