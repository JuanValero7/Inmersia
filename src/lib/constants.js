// IDs fijos para el Manual del Explorador.
// Este UUID corresponde al libro creado en supabase/Migration/016_manual_explorador.sql.
// Cualquier cambio aquí debe hacerse también en ese archivo SQL.
export const MANUAL_LIBRO_ID = '00000000-0000-4000-8000-000000000001'

// Capítulos que se pueden leer sin tener el libro en la biblioteca.
// Es el mismo número que aplican las políticas RLS al rol `anon`; acá se usa
// para aplicar el mismo tope a un usuario AUTENTICADO que abre por URL un
// libro que no adquirió (para `authenticated` la RLS no lo limita).
export const CAPITULOS_MUESTRA = 2

// Versión de los documentos legales, igual a la fecha de "Última actualización"
// de Documentation/terminos-y-condiciones.md y politica-de-privacidad.md.
// Se guarda en el metadata del usuario al registrarse (ver Auth.jsx) para poder
// demostrar QUÉ versión aceptó cada quien. Al publicar un cambio significativo,
// actualizar esta constante junto con la fecha de los dos documentos.
export const LEGAL_VERSION = '2026-08-31'
