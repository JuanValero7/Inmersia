// src/components/biblioteca/constants.js
// ─────────────────────────────────────────────────────────────
// Constantes compartidas de la Biblioteca (desktop + mobile).
// Antes estaban duplicadas en Biblioteca.jsx y BibliotecaMobile.jsx.
// ─────────────────────────────────────────────────────────────
import { MANUAL_LIBRO_ID } from '../../lib/constants.js'

// Re-exportado para que la Biblioteca (desktop + mobile) identifique al
// Manual del Explorador por su UUID real. Antes existía además un
// MANUAL_USUARIO sintético (id 'manual') que se inyectaba en la lista de
// libros; se eliminó porque duplicaba la fila real que ensureProfile ya
// crea en bibliotecas_usuarios (el usuario veía DOS manuales).
export { MANUAL_LIBRO_ID }

export const COLOR_DEFAULT = '#7a4a28'
export const COLOR_BOOK_FALLBACK2 = '#5a3d28'
export const SIN_CATEGORIA_ID = '__sin_categoria'
