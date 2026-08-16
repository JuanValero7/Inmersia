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
import { usePerfilQuery, useCatalogoLibrosQuery, useBibliotecaUsuarioQuery, useInvalidateBibliotecaUsuario } from '../lib/queries.js'
import { MANUAL_LIBRO_ID, COLOR_BOOK_FALLBACK2 } from '../components/biblioteca/constants.js'

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
  const [categories, setCategories] = useState([])
  const [progresos, setProgresos] = useState([])

  // Perfil, catálogo (Novedades/Recomendaciones) y libros del usuario:
  // queries compartidas via React Query con Tienda/Álbum/Perfil, ver
  // src/lib/queries.js — un solo fetch cacheado en vez de uno por hook.
  const perfilQuery = usePerfilQuery(user.id)
  const catalogoQuery = useCatalogoLibrosQuery()
  const bibliotecaQuery = useBibliotecaUsuarioQuery(user.id)
  const invalidateBiblioteca = useInvalidateBibliotecaUsuario(user.id)

  const perfil = perfilQuery.data ?? null
  const catalogo = useMemo(() => catalogoQuery.data ?? [], [catalogoQuery.data])
  const loadingBooks = bibliotecaQuery.isLoading

  // Categorías (propias de este hook, sin redundancia con otros)
  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categorias_usuario')
      .select('id, nombre, color, orden').eq('user_id', user.id)
      .order('orden', { ascending: true }).order('nombre', { ascending: true })
    setCategories(data || [])
  }, [user.id])
  useEffect(() => { fetchCategories() }, [fetchCategories])

  // Progreso de lectura: se pide una sola vez por mount (no cambia con
  // compras/categorías, solo con la lectura real — ver useLectorData).
  useEffect(() => {
    let activo = true
    ;(async () => {
      const { data } = await supabase.from('progreso_lectura')
        .select('libro_id, porcentaje').eq('user_id', user.id)
      if (activo) setProgresos(data || [])
    })()
    return () => { activo = false }
  }, [user.id])

  // fetchUserBooks: se mantiene el nombre por compatibilidad con los
  // callers (Biblioteca.jsx/BibliotecaMobile.jsx tras comprar/borrar
  // categoría) — ahora invalida la query compartida en vez de refetchear
  // localmente, así Tienda/Álbum ven el cambio también.
  const fetchUserBooks = useCallback(() => invalidateBiblioteca(), [invalidateBiblioteca])

  const rawBooks = useMemo(() => {
    const progMap = {}
    progresos.forEach(p => { progMap[p.libro_id] = p.porcentaje })
    // Filtra filas cuyo libro fue borrado o no es accesible por RLS
    // (Supabase devuelve libros: null y reventaría el .map).
    const mapped = (bibliotecaQuery.data || []).filter(r => r.libros).map(r => ({
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
      heroUrl: r.libros.metadata?.hero_url || null,
      heroUrlMobile: r.libros.metadata?.hero_url_mobile || null,
      es_ficcion: r.libros.es_ficcion ?? true,
      progress: typeof progMap[r.libros.id] === 'number' ? progMap[r.libros.id] / 100 : null,
    }))
    // El Manual del Explorador ya viene aquí como fila real de la BD
    // (ensureProfile lo inserta con MANUAL_LIBRO_ID). No inyectamos ninguno
    // sintético para no duplicarlo.
    return mapped
  }, [bibliotecaQuery.data, progresos])

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
    if (catalogoLibroId === MANUAL_LIBRO_ID) return
    const { error } = await supabase.from('bibliotecas_usuarios').update({ categoria_id })
      .eq('user_id', user.id).eq('libro_id', catalogoLibroId)
    if (error) { console.error('assignCategoriaToBook:', error.message); return }
    await fetchUserBooks()
  }

  // ── Memos derivados de datos (independientes del estado de UI) ──
  const categoriasMap = useMemo(() => {
    const m = {}; categories.forEach(c => { m[c.id] = c; }); return m
  }, [categories])

  const books = useMemo(() => rawBooks.map(b => {
    const cat = b.categoria_id ? categoriasMap[b.categoria_id] : null
    // El color de la categoría es solo para sus chips/etiquetas (ver cat.color
    // en FlatShelves/BibCategoryBrowserMobile/filtros); el libro conserva su color.
    return { ...b, color: b._baseColor || COLOR_BOOK_FALLBACK2, categoryName: cat?.nombre || '' }
  }), [rawBooks, categoriasMap])

  const featured = useMemo(() => {
    const nonManual = books.filter(b => b.id !== MANUAL_LIBRO_ID)
    if (lastOpenedBookIds?.length) {
      const last = nonManual.find(b => b.id === lastOpenedBookIds[0])
      if (last) return last
    }
    // Usuario nuevo: su único libro es el Manual del Explorador → que sea él
    // quien ocupe el hero "Seguir leyendo" (antes quedaba vacío).
    return nonManual[0] || books.find(b => b.id === MANUAL_LIBRO_ID) || null
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
