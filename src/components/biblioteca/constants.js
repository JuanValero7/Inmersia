// src/components/biblioteca/constants.js
// ─────────────────────────────────────────────────────────────
// Constantes compartidas de la Biblioteca (desktop + mobile).
// Antes estaban duplicadas en Biblioteca.jsx y BibliotecaMobile.jsx.
// ─────────────────────────────────────────────────────────────
import { MANUAL_LIBRO_ID } from '../../lib/constants.js'

export const COLOR_DEFAULT = '#7a4a28'
export const COLOR_BOOK_FALLBACK2 = '#5a3d28'
export const SIN_CATEGORIA_ID = '__sin_categoria'

export const MANUAL_USUARIO = {
  id: 'manual', libro_id: MANUAL_LIBRO_ID, categoria_id: null,
  title: 'Manual del Explorador', author: 'Biblioteca Virtual',
  pages: 8, _baseColor: '#5a7a4a', cover: null, progress: null,
  summary: 'Tu guía de bienvenida a Inmersia. Descubre cómo leer, anotar, investigar y conectar con otros lectores.',
}
