// src/hooks/useComunidades.js
// ─────────────────────────────────────────────────────────────
// Datos de Comunidades para el menú "Leer como" de la Biblioteca, el
// panel "Ver comunidad" (ComunidadPanel) y la pantalla /comunidades.
//
// El esquema vive en las migraciones 051–057. Lo que importa aquí:
//   · "Mis comunidades" sale de comunidad_miembros (RLS: solo las mías).
//   · El buscador usa buscar_comunidades(): solo públicas, y es lo único
//     que puede contar miembros de una comunidad a la que no pertenezco.
//   · Unirse a una privada pasa por unirse_con_codigo().
//   · El tope de 5 lo impone un trigger en la base; TOPE_COMUNIDADES es
//     solo para que la UI desactive "Unirme" antes de intentarlo.
//   · La comunidad activa ("Leer como") vive en
//     preferencias_usuario.comunidad_activa (057). NULL = solo yo.
//
// Queries sobre React Query con las claves de src/lib/queries.js, como
// el resto de la app.
// ─────────────────────────────────────────────────────────────
import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'
import { evento } from '../lib/analytics.js'

// Debe coincidir con TOPE_COMUNIDADES de _comunidad_tope_miembro() (051).
export const TOPE_COMUNIDADES = 5

const STALE_TIME = 60_000

// Mensaje para el usuario a partir del error de Supabase. Los HINT los
// ponen las funciones de la 051 justo para poder distinguirlos aquí.
function mensajeError(error, generico = 'No pudimos unirte. Revisa tu conexión e inténtalo de nuevo.') {
  if (!error) return null
  if (error.hint === 'tope_comunidades') return `Ya estás en ${TOPE_COMUNIDADES} comunidades, el máximo.`
  if (error.hint === 'codigo_invalido') return 'Ese código no existe. Revisa que esté bien escrito.'
  if (error.hint === 'codigo_en_uso') return 'Ese código ya lo usa otra comunidad. Prueba con otro.'
  if (error.hint === 'codigo_formato') return 'El código debe tener entre 6 y 20 letras o números, sin espacios.'
  if (error.hint === 'sin_permiso_creador') return 'Tu cuenta no tiene permiso para crear comunidades.'
  if (error.hint === 'sin_sesion') return 'Tu sesión caducó. Vuelve a iniciar sesión e inténtalo de nuevo.'
  return generico
}

// Formato del código de invitación (mismo CHECK que comunidad_codigos, 054).
export const CODIGO_RE = /^[A-Z0-9]{6,20}$/
export const normalizarCodigo = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20)

// Forma común de una comunidad en la UI (lista y buscador).
function aFila(c, extra = {}) {
  return {
    id: c.id,
    nombre: c.nombre,
    privada: !!c.privada,
    libroTitulo: c.libros?.titulo || null,
    libroPortada: c.libros?.portada_url || null,
    libroColor: c.libros?.color || null,
    miembros: c.comunidad_miembros?.[0]?.count ?? 0,
    ...extra,
  }
}

// Comunidades a las que pertenezco, en el orden en que entré.
export function useMisComunidadesQuery(userId) {
  return useQuery({
    queryKey: queryKeys.misComunidades(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comunidad_miembros')
        .select('rol, unido_at, comunidades(id, nombre, privada, libros(titulo, portada_url, color), comunidad_miembros(count))')
        .eq('user_id', userId)
        .order('unido_at', { ascending: true })
      if (error) throw error
      return (data || [])
        .filter(r => r.comunidades)
        .map(r => aFila(r.comunidades, { rol: r.rol }))
    },
    enabled: !!userId,
    staleTime: STALE_TIME,
  })
}

// Comunidades públicas que coinciden con `texto` (nombre o libro), máx. 20.
// Sin texto devuelve las más concurridas. `texto` ya debe venir con el
// debounce aplicado por quien llama.
export function useBuscarComunidadesQuery(texto, enabled = true) {
  const t = (texto || '').trim()
  return useQuery({
    queryKey: queryKeys.buscarComunidades(t),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_comunidades', { p_texto: t })
      if (error) throw error
      return (data || []).map(c => ({
        id: c.id,
        nombre: c.nombre,
        privada: false,
        libroTitulo: c.libro_titulo,
        libroPortada: c.libro_portada,
        libroColor: c.libro_color,
        miembros: c.miembros,
        soyMiembro: c.soy_miembro,
      }))
    },
    enabled,
    staleTime: 30_000,
  })
}

// ¿Tiene el permiso para crear comunidades? Solo para la UI: la política
// comunidades_insert lo comprueba de verdad.
export function usePuedeCrearComunidadQuery(userId) {
  return useQuery({
    queryKey: queryKeys.puedeCrearComunidad(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('creadores_comunidad')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (error) throw error
      return (count ?? 0) > 0
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })
}

// Una comunidad (la RLS ya decide si puedo verla), con:
//   · lectura: la actual (fecha meta + encuentro). Solo miembros (054).
//   · codigo:  solo si soy moderador (la RLS de comunidad_codigos).
//   · rol:     el mío, o null si no soy miembro.
export function useComunidadQuery(id, userId) {
  return useQuery({
    queryKey: queryKeys.comunidad(id),
    queryFn: async () => {
      const [comRes, lecRes, codRes, rolRes] = await Promise.all([
        supabase.from('comunidades')
          .select('id, nombre, descripcion, privada, libro_id, libros(titulo, autor, portada_url, color, metadata), comunidad_miembros(count)')
          .eq('id', id).maybeSingle(),
        supabase.from('comunidad_lecturas')
          .select('fecha_meta, encuentro_lugar, encuentro_fecha')
          .eq('comunidad_id', id).is('fin', null).maybeSingle(),
        supabase.from('comunidad_codigos').select('codigo').eq('comunidad_id', id).maybeSingle(),
        supabase.from('comunidad_miembros').select('rol').eq('comunidad_id', id).eq('user_id', userId).maybeSingle(),
      ])
      if (comRes.error) throw comRes.error
      const data = comRes.data
      if (!data) return null
      return {
        ...aFila(data, { rol: rolRes.data?.rol || null }),
        descripcion: data.descripcion,
        libroId: data.libro_id,
        libroAutor: data.libros?.autor || null,
        heroUrl: data.libros?.metadata?.hero_url || null,
        lectura: lecRes.data || null,
        codigo: codRes.data?.codigo || null,
      }
    },
    enabled: !!id && !!userId,
    staleTime: STALE_TIME,
  })
}

// Crear una comunidad en un solo paso (crear_comunidad, 054): comunidad,
// código elegido si es privada y primera lectura con fecha y encuentro.
// Devuelve { id, codigo } o { error: 'mensaje para el usuario' }.
export function useCrearComunidad(userId) {
  const queryClient = useQueryClient()
  const [creando, setCreando] = useState(false)

  const crear = useCallback(async (f) => {
    setCreando(true)
    const { data, error } = await supabase.rpc('crear_comunidad', {
      p_nombre: f.nombre,
      p_descripcion: f.descripcion || null,
      p_privada: f.privada,
      p_codigo: f.privada ? f.codigo : null,
      p_libro_id: f.libro?.id || null,
      p_fecha_meta: f.libro && f.fechaMeta ? f.fechaMeta : null,
      p_encuentro_lugar: f.libro && f.encuentroLugar ? f.encuentroLugar : null,
      // datetime-local no trae zona: new Date() la interpreta en la hora
      // local del navegador, que es la del creador.
      p_encuentro_fecha: f.libro && f.encuentroFecha ? new Date(f.encuentroFecha).toISOString() : null,
    })
    setCreando(false)
    if (error) {
      console.error('crear_comunidad:', error.code, error.message, error.details, error.hint)
      return { error: mensajeError(error, 'No pudimos crear la comunidad. Revisa tu conexión e inténtalo de nuevo.') }
    }
    evento('comunidad_creada', { privada: f.privada, con_libro: !!f.libro, con_encuentro: !!(f.libro && f.encuentroFecha) })
    queryClient.invalidateQueries({ queryKey: queryKeys.misComunidades(userId) })
    queryClient.invalidateQueries({ queryKey: ['buscarComunidades'] })
    return { id: data, codigo: f.privada ? f.codigo : null }
  }, [queryClient, userId])

  return { crear, creando }
}

// Acciones para entrar a una comunidad. Cada una devuelve
// { id } si salió bien o { error: 'mensaje para el usuario' }.
export function useUnirseComunidad(userId) {
  const queryClient = useQueryClient()
  const [pendiente, setPendiente] = useState(null) // id de comunidad o 'codigo'

  const refrescar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.misComunidades(userId) })
    queryClient.invalidateQueries({ queryKey: ['buscarComunidades'] })
  }, [queryClient, userId])

  const unirse = useCallback(async (comunidadId) => {
    setPendiente(comunidadId)
    const { error } = await supabase
      .from('comunidad_miembros')
      .insert({ comunidad_id: comunidadId, user_id: userId })
    setPendiente(null)
    // 23505 = ya era miembro: para el usuario es lo mismo que haber entrado.
    if (error && error.code !== '23505') return { error: mensajeError(error) }
    evento('comunidad_unida', { via: 'busqueda' })
    refrescar()
    return { id: comunidadId }
  }, [userId, refrescar])

  const unirseConCodigo = useCallback(async (codigo) => {
    const limpio = normalizarCodigo(codigo)
    if (!limpio) return { error: 'Escribe el código de la invitación.' }
    setPendiente('codigo')
    const { data, error } = await supabase.rpc('unirse_con_codigo', { p_codigo: limpio })
    setPendiente(null)
    if (error) return { error: mensajeError(error) }
    evento('comunidad_unida', { via: 'codigo' })
    refrescar()
    return { id: data }
  }, [refrescar])

  return { unirse, unirseConCodigo, pendiente }
}

// ── Comunidad activa ("Leer como") ─────────────────────────
// Una sola fuente: la caché de React Query. La usan el menú de escritorio,
// la hoja móvil y la pantalla /comunidades; todos leen y escriben la misma
// clave. Si la guardada ya no es mía (salí, me expulsaron), se trata como
// "Solo yo".
export function useComunidadActiva(userId) {
  const queryClient = useQueryClient()
  const { data: mias = [], isLoading: cargandoMias } = useMisComunidadesQuery(userId)
  const { data: guardada = null, isLoading: cargandoPref } = useQuery({
    queryKey: queryKeys.comunidadActiva(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preferencias_usuario').select('comunidad_activa').eq('user_id', userId).maybeSingle()
      if (error) throw error
      return data?.comunidad_activa || null
    },
    enabled: !!userId,
    staleTime: STALE_TIME,
  })

  const activa = useMemo(() => mias.find(c => c.id === guardada) || null, [mias, guardada])

  const setActiva = useCallback(async (id) => {
    const key = queryKeys.comunidadActiva(userId)
    const anterior = queryClient.getQueryData(key) ?? null
    queryClient.setQueryData(key, id || null)
    const { error } = await supabase.from('preferencias_usuario')
      .upsert({ user_id: userId, comunidad_activa: id || null, updated_at: new Date().toISOString() })
    if (error) {
      console.error('comunidad_activa:', error.message)
      queryClient.setQueryData(key, anterior)
    }
  }, [queryClient, userId])

  return { activa, activaId: activa?.id || null, setActiva, mias, cargando: cargandoMias || cargandoPref }
}

// ── Panel "Ver comunidad" ──────────────────────────────────

// El camino: avance de cada miembro (progreso_comunidad, 051). Solo
// miembros; nunca el párrafo exacto.
export function useProgresoComunidadQuery(id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.progresoComunidad(id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('progreso_comunidad', { p_comunidad: id })
      if (error) throw error
      return data || []
    },
    enabled: !!id && enabled,
    staleTime: STALE_TIME,
  })
}

// Lecturas terminadas, de la más reciente a la más antigua (054).
export function useLecturasAnterioresQuery(id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.lecturasAnteriores(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comunidad_lecturas')
        .select('id, inicio, fin, libro_id, libros(titulo, portada_url, color)')
        .eq('comunidad_id', id).not('fin', 'is', null)
        .order('inicio', { ascending: false })
      if (error) throw error
      return (data || []).map(l => ({
        id: l.id, inicio: l.inicio, fin: l.fin, libroId: l.libro_id,
        libroTitulo: l.libros?.titulo || null, libroPortada: l.libros?.portada_url || null, libroColor: l.libros?.color || null,
      }))
    },
    enabled: !!id && enabled,
    staleTime: STALE_TIME,
  })
}

// datetime-local ↔ timestamptz. El input no lleva zona: se interpreta y
// se muestra en la hora local del navegador.
export const aISO = (local) => (local ? new Date(local).toISOString() : null)
export function aLocal(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// Acciones del moderador y "Salir". Cada una devuelve { ok: true } o
// { error: 'mensaje para el usuario' }.
//
// Los UPDATE piden .select('id'): con RLS, un UPDATE sin permiso no da
// error, simplemente no toca ninguna fila. Contarlas es la única forma
// de enterarse.
export function useGestionComunidad(id, userId) {
  const queryClient = useQueryClient()
  const [ocupado, setOcupado] = useState(null)

  const refrescar = useCallback(() => {
    for (const key of [queryKeys.comunidad(id), queryKeys.misComunidades(userId), queryKeys.progresoComunidad(id), queryKeys.lecturasAnteriores(id)]) {
      queryClient.invalidateQueries({ queryKey: key })
    }
    queryClient.invalidateQueries({ queryKey: ['buscarComunidades'] })
  }, [queryClient, id, userId])

  const correr = useCallback(async (nombre, fn, generico) => {
    setOcupado(nombre)
    try {
      const r = await fn()
      if (r?.error) {
        console.error(`comunidad/${nombre}:`, r.error.code, r.error.message, r.error.hint)
        return { error: mensajeError(r.error, generico) }
      }
      if (r?.sinFilas) return { error: 'No tienes permiso para hacer esto en la comunidad.' }
      refrescar()
      return { ok: true, valor: r?.valor }
    } finally {
      setOcupado(null)
    }
  }, [refrescar])

  const conFilas = (res) => (res.error ? res : { sinFilas: !res.data?.length })

  const editar = (f) => correr('editar', async () => conFilas(await supabase.from('comunidades')
    .update({ nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null, privada: f.privada })
    .eq('id', id).select('id')), 'No pudimos guardar los cambios.')

  const datosLectura = (f) => ({
    fecha_meta: f.fechaMeta || null,
    encuentro_lugar: f.encuentroLugar.trim() || null,
    encuentro_fecha: aISO(f.encuentroFecha),
  })

  // Cambiar libro: el trigger de 054 cierra la lectura actual y abre la
  // nueva; después se completan su fecha meta y encuentro.
  const cambiarLibro = (f) => correr('libro', async () => {
    const r1 = conFilas(await supabase.from('comunidades').update({ libro_id: f.libro.id }).eq('id', id).select('id'))
    if (r1.error || r1.sinFilas) return r1
    return conFilas(await supabase.from('comunidad_lecturas')
      .update(datosLectura(f)).eq('comunidad_id', id).is('fin', null).select('id'))
  }, 'No pudimos cambiar el libro.')

  const editarLectura = (f) => correr('encuentro', async () => conFilas(await supabase.from('comunidad_lecturas')
    .update(datosLectura(f)).eq('comunidad_id', id).is('fin', null).select('id')), 'No pudimos guardar el encuentro.')

  const ponerCodigo = (codigo) => correr('codigo', async () => {
    const limpio = normalizarCodigo(codigo)
    if (!CODIGO_RE.test(limpio)) return { error: { hint: 'codigo_formato' } }
    const { error } = await supabase.rpc('_comunidad_poner_codigo', { p_comunidad: id, p_codigo: limpio })
    if (error?.code === '23505') return { error: { hint: 'codigo_en_uso' } }
    return error ? { error } : { valor: limpio }
  }, 'No pudimos cambiar el código.')

  const regenerarCodigo = () => correr('codigo', async () => {
    const { data, error } = await supabase.rpc('regenerar_codigo', { p_comunidad: id })
    return error ? { error } : { valor: data }
  }, 'No pudimos generar un código nuevo.')

  const expulsar = (miembroId) => correr('expulsar', async () => conFilas(await supabase.from('comunidad_miembros')
    .delete().eq('comunidad_id', id).eq('user_id', miembroId).select('user_id')), 'No pudimos quitar a ese miembro.')

  // Salir: sin .select() porque, una vez fuera, la fila ya no es visible
  // para quien sale. La herencia de la moderación la hace el trigger (051).
  const salir = () => correr('salir', async () => {
    const { error } = await supabase.from('comunidad_miembros').delete().eq('comunidad_id', id).eq('user_id', userId)
    return error ? { error } : {}
  }, 'No pudimos sacarte de la comunidad.')

  return { editar, cambiarLibro, editarLectura, ponerCodigo, regenerarCodigo, expulsar, salir, ocupado }
}
