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

const CATALOGO_COLS = 'id, slug, titulo, autor, paginas, descripcion, color, portada_url, anio, categorias, moods, es_ficcion, created_at'
const NOVEDADES_COUNT = 5
const RECOMENDACIONES_COUNT = 5

// PRNG determinístico (mulberry32) — misma seed siempre da el mismo orden,
// así "Recomendaciones" no salta en cada render pero cambia día a día.
function seededShuffle(arr, seedStr) {
  let h = 0
  for (let i = 0; i < seedStr.length; i++) h = (Math.imul(31, h) + seedStr.charCodeAt(i)) | 0
  let a = h
  const rand = () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function useBiblioteca(user, lastOpenedBookIds) {
  const [rawBooks, setRawBooks] = useState([MANUAL_USUARIO])
  const [loadingBooks, setLoadingBooks] = useState(true)
  const [perfil, setPerfil] = useState(null)
  const [categories, setCategories] = useState([])
  const [catalogo, setCatalogo] = useState([])

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

  // Catálogo de la Tienda, para Novedades/Recomendaciones (ver memos abajo).
  // Se pide una sola vez; ordenado por created_at desc para que Novedades
  // no necesite un sort aparte.
  useEffect(() => {
    let activo = true
    ;(async () => {
      const { data } = await supabase.from('libros')
        .select(CATALOGO_COLS).eq('visible', true)
        .order('created_at', { ascending: false })
      if (activo) setCatalogo(data || [])
    })()
    return () => { activo = false }
  }, [])

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
    // El color de la categoría es solo para sus chips/etiquetas (ver cat.color
    // en FlatShelves/BibShelvesMobile/filtros); el libro conserva su propio color.
    return { ...b, color: b._baseColor || COLOR_BOOK_FALLBACK2, categoryName: cat?.nombre || '' }
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

  // Novedades / Recomendaciones: libros de la Tienda que el usuario NO tiene
  // todavía. "Novedades" ya viene ordenado por created_at desc (ver fetch del
  // catálogo); "Recomendaciones" usa un shuffle con seed del día + user.id,
  // así no cambia en cada render pero sí de un día a otro.
  const elegiblesTienda = useMemo(() => {
    const ownedIds = new Set(rawBooks.map(b => b.id))
    return catalogo.filter(l => !ownedIds.has(l.id))
  }, [catalogo, rawBooks])

  const novedades = useMemo(() => elegiblesTienda.slice(0, NOVEDADES_COUNT), [elegiblesTienda])

  const recomendaciones = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10)
    return seededShuffle(elegiblesTienda, `${hoy}-${user.id}`).slice(0, RECOMENDACIONES_COUNT)
  }, [elegiblesTienda, user.id])

  return {
    rawBooks, loadingBooks, perfil, categories,
    categoriasMap, books, featured,
    novedades, recomendaciones,
    displayName, inicial,
    fetchCategories, fetchUserBooks,
    createCategoria, updateCategoria, deleteCategoria, assignCategoriaToBook,
  }
}
