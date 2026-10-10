// src/lib/libros.js
// ─────────────────────────────────────────────────────────────
// Una fila de `libros` (columnas en español) → el libro que usa la pantalla.
//
// Antes esta traducción estaba escrita en siete sitios, cada uno con sus
// propios valores por defecto (tres colores distintos) y algunos a medias
// (`color` sin `_baseColor`, sin autor por defecto). Si cambia una columna de
// `libros`, se cambia AQUÍ.
//
// Cada pantalla añade encima lo suyo (leido, categoria_id, progreso…).
// ─────────────────────────────────────────────────────────────

export const COLOR_LIBRO_DEFECTO = '#F2792A'

/**
 * @param {{ id: string, slug?: string, titulo: string, autor?: string, paginas?: number,
 *   color?: string, descripcion?: string, portada_url?: string, es_ficcion?: boolean,
 *   metadata?: { hero_url?: string, hero_url_mobile?: string } }} fila
 */
export function mapLibro(fila) {
  // `color` lo lee la portada (BookCover); `_baseColor`, el resto. Mismo valor.
  const color = fila.color || COLOR_LIBRO_DEFECTO
  return {
    id: fila.id,
    libro_id: fila.id,
    slug: fila.slug ?? null,
    title: fila.titulo,
    author: fila.autor || 'Desconocido',
    // Casi ningún libro tiene páginas cargadas: 200 da un lomo de grosor medio.
    pages: fila.paginas || 200,
    _baseColor: color,
    color,
    summary: fila.descripcion || '',
    cover: fila.portada_url || null,
    heroUrl: fila.metadata?.hero_url || null,
    heroUrlMobile: fila.metadata?.hero_url_mobile || null,
    es_ficcion: fila.es_ficcion ?? true,
  }
}
