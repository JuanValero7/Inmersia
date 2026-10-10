// src/components/biblioteca/miBiblioteca.js
// ─────────────────────────────────────────────────────────────
// Lo que la Biblioteca de escritorio (Biblioteca.jsx) y la de móvil
// (BibliotecaMobile.jsx) calculan IGUAL sobre los libros del usuario.
// Antes estaba copiado en las dos; ahora un arreglo vale para ambas.
//
// Funciones puras (probadas en miBiblioteca.test.js) y un hook para comprar
// desde la ficha de Novedades / Recomendaciones.
// ─────────────────────────────────────────────────────────────
import { useMemo } from 'react'
import { useCompraLibro, LIMITE_PENDIENTES } from '../../hooks/useCompraLibro.js'
import { SIN_CATEGORIA_ID, COLOR_DEFAULT, MANUAL_LIBRO_ID } from './constants.js'

/** Libros cuyo título o autor contienen `texto` (sin distinguir mayúsculas). */
export function filtrarPorBusqueda(libros, texto) {
  const q = (texto || '').toLowerCase()
  if (!q) return libros
  return libros.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
}

/**
 * Estantes: una por categoría con libros, y "Sin categoría" al final.
 * Con `categoriaActiva`, solo esa.
 */
export function agruparEnEstantes(categorias, libros, categoriaActiva = null) {
  const out = categorias.map(c => ({
    cat: { id: c.id, nombre: c.nombre, color: c.color },
    books: libros.filter(b => b.categoria_id === c.id),
  }))
  const sinCat = libros.filter(b => !b.categoria_id)
  if (sinCat.length) out.push({ cat: { id: SIN_CATEGORIA_ID, nombre: 'Sin categoría', color: COLOR_DEFAULT }, books: sinCat })
  return out.filter(g => g.books.length && (!categoriaActiva || g.cat.id === categoriaActiva))
}

/**
 * "Últimos abiertos": en el orden en que se abrieron, sin el Manual ni el
 * libro que ya ocupa "Seguir leyendo". Sin historial, los primeros de la lista.
 */
export function ultimosAbiertos(libros, idsRecientes, destacado, max) {
  const candidatos = libros.filter(b => b.id !== MANUAL_LIBRO_ID && b.id !== destacado?.id)
  if (!idsRecientes?.length) return candidatos.slice(0, max)
  return idsRecientes.filter(id => id !== destacado?.id)
    .map(id => candidatos.find(b => b.id === id)).filter(Boolean).slice(0, max)
}

/** Lecturas pendientes: sin terminar y sin contar el Manual (es el límite de 5). */
export function contarPendientes(libros) {
  return libros.filter(b => b.id !== MANUAL_LIBRO_ID && !b.leido).length
}

/**
 * Comprar o empezar a leer un libro desde la ficha in-place de la Biblioteca,
 * con las mismas primitivas y el mismo límite que la Tienda (useCompraLibro).
 *
 * @param {object} p
 * @param {object[]} p.books
 * @param {object} p.user
 * @param {boolean} p.isSuperuser
 * @param {(libro: object) => void} p.onOpenBook
 * @param {() => Promise<void>|void} p.alAdquirir  refrescar y cerrar la ficha
 */
export function useCompraEnBiblioteca({ books, user, isSuperuser, onOpenBook, alAdquirir }) {
  const pendientes = useMemo(() => contarPendientes(books), [books])
  const { comprar, comprarYLeer } = useCompraLibro(user, isSuperuser, onOpenBook)
  return {
    pendientes,
    bloqueado: !isSuperuser && pendientes >= LIMITE_PENDIENTES,
    comprar: async (libro) => {
      const { error } = await comprar(libro, { pendientes })
      if (!error) await alAdquirir()
    },
    empezarALeer: async (libro) => {
      const { error } = await comprarYLeer(libro, { pendientes, tieneLibro: () => false })
      if (!error) await alAdquirir()
    },
  }
}
