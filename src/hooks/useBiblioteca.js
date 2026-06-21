// src/hooks/useBiblioteca.js
// ─────────────────────────────────────────────────────────────
// Lógica de datos compartida del home de Biblioteca.
// La consumen Biblioteca.jsx (desktop) y BibliotecaMobile.jsx, que
// aportan su propio chrome y derivados de UI.
//
// Va aquí (datos): perfil, categorías + CRUD, libros, asignar
// categoría, y los memos que NO dependen del estado de UI
// (categoriasMap, books, featured) + displayName/inicial.
//
// Se queda en cada componente (depende de su UI): búsqueda y
// searchedBooks, groups (el filtro por categoría difiere), counts,
// portadas/últimos, la categoría activa y el libro seleccionado.
//
// Las dos funciones acopladas a la UI (deleteCategoria que limpia la
// categoría activa, assignCategoriaToBook que sincroniza el libro
// seleccionado) se exponen aquí como PRIMITIVAS puras; cada componente
// las envuelve para tocar su propio estado de UI. Refactor puro:
// comportamiento idéntico al previo.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { MANUAL_USUARIO, COLOR_BOOK_FALLBACK2 } from '../components/biblioteca/constants.js'

export function useBiblioteca(user, lastOpenedBookIds) {
  const [rawBooks, setRawBooks] = useState([MANUAL_USUARIO])
  const [loadingBooks, setLoadingBooks] = useState(true)
  const [perfil, setPerfil] = useState(null)
  const [categories, setCategories] = useState([])

  // Perfil (nombre)
  useEffect(() => {
    let activo = true
    ;(async () => {
      const { data } = await supabase.from('perfiles').select('nombre, apellido').eq('id', user.id).maybeSingle()
      if (activo && data) setPerfil(data)
    })()
    return () => { activo = false }
  }, [user.id])

  // Categorías
  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categorias_usuario')
      .select('id, nombre, color, orden').eq('user_id', user.id)
      .order('orden', { ascending: true }).order('nombre', { ascending: true })
    setCategories(data || [])
  }, [user.id])
  useEffect(() => { fetchCategories() }, [fetchCategories])

  // Libros + progreso de lectura en paralelo
  const fetchUserBooks = useCallback(async () => {
    setLoadingBooks(true)
    const [{ data }, { data: progresos }] = await Promise.all([
      supabase.from('bibliotecas_usuarios')
        .select('leido, categoria_id, libros(id, slug, titulo, autor, paginas, descripcion, color, portada_url, metadata, es_ficcion)')
        .eq('user_id', user.id),
      supabase.from('progreso_lectura')
        .select('libro_id, porcentaje')
        .eq('user_id', user.id),
    ])
    const progMap = {}
    ;(progresos || []).forEach(p => { progMap[p.libro_id] = p.porcentaje })
    // Filtra filas cuyo libro fue borrado o no es accesible por RLS
    // (Supabase devuelve libros: null y reventaría el .map).
    const mapped = (data || []).filter(r => r.libros).map(r => ({
      id: r.libros.id,
      libro_id: r.libros.id,
      slug: r.libros.slug,
      categoria_id: r.categoria_id,
      title: r.libros.titulo,
      author: r.libros.autor || 'Desconocido',
      pages: r.libros.paginas || 200,
      _baseColor: r.libros.color || COLOR_BOOK_FALLBACK2,
      summary: r.libros.descripcion || '',
      leido: r.leido,
      cover: r.libros.portada_url || null,
      es_ficcion: r.libros.es_ficcion ?? true,
      progress: typeof progMap[r.libros.id] === 'number' ? progMap[r.libros.id] / 100 : null,
    }))
    setRawBooks([MANUAL_USUARIO, ...mapped])
    setLoadingBooks(false)
  }, [user.id])
  useEffect(() => { fetchUserBooks() }, [fetchUserBooks])

  // ── CRUD categorías ──
  async function createCategoria(nombre, color) {
    const { error } = await supabase.from('categorias_usuario').insert({ user_id: user.id, nombre, color })
    if (error) return error.message.includes('duplicate') ? `Ya tenés una categoría llamada "${nombre}".` : error.message
    await fetchCategories()
    return null
  }
  async function updateCategoria(id, fields) {
    const { error } = await supabase.from('categorias_usuario').update(fields).eq('id', id)
    if (error) return error.message
    await fetchCategories()
    return null
  }
  // Primitiva pura: borra + recarga. NO limpia la categoría activa
  // (eso es UI; cada componente lo hace en su wrapper).
  async function deleteCategoria(id) {
    const { error } = await supabase.from('categorias_usuario').delete().eq('id', id)
    if (error) return error.message
    await Promise.all([fetchCategories(), fetchUserBooks()])
    return null
  }
  // Primitiva pura: reasigna + recarga. NO sincroniza el libro
  // seleccionado (eso es UI; cada componente lo hace en su wrapper).
  async function assignCategoriaToBook(catalogoLibroId, categoria_id) {
    if (catalogoLibroId === 'manual') return
    await supabase.from('bibliotecas_usuarios').update({ categoria_id })
      .eq('user_id', user.id).eq('libro_id', catalogoLibroId)
    await fetchUserBooks()
  }

  // ── Memos derivados de datos (independientes del estado de UI) ──
  const categoriasMap = useMemo(() => {
    const m = {}; categories.forEach(c => { m[c.id] = c; }); return m
  }, [categories])

  const books = useMemo(() => rawBooks.map(b => {
    const cat = b.categoria_id ? categoriasMap[b.categoria_id] : null
    return { ...b, color: cat?.color || b._baseColor || COLOR_BOOK_FALLBACK2, categoryName: cat?.nombre || '' }
  }), [rawBooks, categoriasMap])

  const featured = useMemo(() => {
    const nonManual = books.filter(b => b.id !== 'manual')
    if (lastOpenedBookIds?.length) {
      const last = nonManual.find(b => b.id === lastOpenedBookIds[0])
      if (last) return last
    }
    return nonManual[0] || null
  }, [books, lastOpenedBookIds])

  const displayName = perfil?.nombre ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : (user?.email?.split('@')[0] || 'Lector')
  const inicial = displayName.charAt(0).toUpperCase()

  return {
    rawBooks, loadingBooks, perfil, categories,
    categoriasMap, books, featured,
    displayName, inicial,
    fetchCategories, fetchUserBooks,
    createCategoria, updateCategoria, deleteCategoria, assignCategoriaToBook,
  }
}
