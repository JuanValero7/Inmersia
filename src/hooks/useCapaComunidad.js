// src/hooks/useCapaComunidad.js
// ─────────────────────────────────────────────────────────────
// Datos de la capa de comunidad DENTRO del lector (escritorio y móvil):
// comentarios por párrafo para toda la comunidad y mensajitos 1 a 1.
//
// Lo que importa (migraciones 051, 052, 054, 058):
//   · La capa solo existe si alguna de MIS comunidades leyó o está
//     leyendo el libro (comunidad_lecturas incluye la lectura actual).
//     Si es la "Leer como" de la Biblioteca, arranca encendida; si no,
//     se elige la de más miembros y arranca apagada.
//   · Comentarios: se piden por capítulo (join con parrafos). Los borra
//     su autor o un moderador (RLS).
//   · Mensajitos: se piden una vez por libro, los míos (de o para mí).
//     Solo los borra quien los recibe (058). Los "efímeros" los borra
//     el cliente del destinatario al CERRARLOS, para que dé tiempo a
//     denunciarlos (la denuncia copia el texto, trigger de la 051).
//   · A quién le puedo dejar uno: puede_recibir_mensajitos (058), que no
//     expone edades.
//   · Nombres: perfiles_publicos (038), solo nombre y apellido.
//
// Bajo RLS un DELETE/UPDATE sin permiso no da error: afecta 0 filas. Por
// eso las mutaciones piden .select('id') y cuentan.
// ─────────────────────────────────────────────────────────────
import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'
import { useComunidadActiva } from './useComunidades.js'

const STALE_TIME = 30_000

// Colores de las caritas: saturados, para que la inicial en blanco se lea.
const COLORES_PERSONA = ['#d56a52', '#2F4A6B', '#BE6173', '#5f8a4a', '#b8812e', '#4f78a3', '#85589b', '#3f8a86']

export function colorPersona(id) {
  let h = 0
  for (const ch of id || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORES_PERSONA[h % COLORES_PERSONA.length]
}

function persona(id, p) {
  const nombre = [p?.nombre, p?.apellido].filter(Boolean).join(' ').trim()
  return {
    id,
    nombre: nombre || 'Alguien',
    corto: p?.nombre?.trim() || nombre || 'Alguien',
    inicial: (p?.nombre || nombre || '?').trim().charAt(0).toUpperCase(),
    color: colorPersona(id),
  }
}

async function nombresDe(ids) {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (!unicos.length) return {}
  const { data, error } = await supabase.from('perfiles_publicos').select('id, nombre, apellido').in('id', unicos)
  if (error) throw error
  const porId = Object.fromEntries((data || []).map(p => [p.id, p]))
  return Object.fromEntries(unicos.map(id => [id, persona(id, porId[id])]))
}

// "Hace 2 h", "ayer", "12 de marzo". Corto, como en el mockup.
export function haceCuanto(iso) {
  const d = new Date(iso); const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'ahora'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  if (s < 2 * 86400) return 'ayer'
  if (s < 7 * 86400) return `hace ${Math.floor(s / 86400)} d`
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long' })
}

// ── ¿Con qué comunidad se lee este libro? ──────────────────
// null si ninguna de mis comunidades lo leyó.
export function useComunidadDelLibro(userId, libroId, habilitado = true) {
  const { activaId, mias, cargando } = useComunidadActiva(habilitado ? userId : null)
  const ids = useMemo(() => mias.map(c => c.id).sort(), [mias])

  const { data: leidas = [], isLoading } = useQuery({
    queryKey: queryKeys.comunidadesDelLibro(userId, libroId, ids.join(',')),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comunidad_lecturas').select('comunidad_id')
        .eq('libro_id', libroId).in('comunidad_id', ids)
      if (error) throw error
      return [...new Set((data || []).map(r => r.comunidad_id))]
    },
    enabled: habilitado && !!userId && !!libroId && ids.length > 0,
    staleTime: STALE_TIME,
  })

  return useMemo(() => {
    if (!habilitado || cargando || isLoading) return { comunidad: null, listo: false }
    const candidatas = mias.filter(c => leidas.includes(c.id))
    if (!candidatas.length) return { comunidad: null, listo: true }
    const activa = candidatas.find(c => c.id === activaId)
    if (activa) return { comunidad: activa, elegidaPorTi: false, listo: true }
    // Varias: la de más miembros. En empate, la primera que venga.
    const masGrande = candidatas.reduce((a, b) => (b.miembros > a.miembros ? b : a))
    return { comunidad: masGrande, elegidaPorTi: true, listo: true }
  }, [habilitado, cargando, isLoading, mias, leidas, activaId])
}

// ── La capa: lecturas y acciones ────────────────────────────
export function useCapaComunidad({ userId, comunidadId, libroId, capituloId }) {
  const queryClient = useQueryClient()
  const habilitada = !!userId && !!comunidadId && !!libroId

  // Miembros + mi rol + a quién le puedo dejar un mensajito
  const { data: miembros } = useQuery({
    queryKey: queryKeys.miembrosCapa(comunidadId),
    queryFn: async () => {
      const [{ data: filas, error: e1 }, { data: destinos, error: e2 }] = await Promise.all([
        supabase.from('comunidad_miembros').select('user_id, rol').eq('comunidad_id', comunidadId),
        supabase.rpc('puede_recibir_mensajitos', { p_comunidad: comunidadId }),
      ])
      if (e1) throw e1
      if (e2) throw e2
      const personas = await nombresDe((filas || []).map(f => f.user_id))
      const receptores = new Set((destinos || []).map(d => d.user_id))
      return {
        personas,
        soyModerador: (filas || []).some(f => f.user_id === userId && f.rol === 'moderador'),
        destinatarios: (filas || []).filter(f => receptores.has(f.user_id)).map(f => personas[f.user_id]),
      }
    },
    enabled: habilitada,
    staleTime: STALE_TIME,
  })

  // Comentarios del capítulo, agrupados por párrafo y en orden de llegada
  const { data: comentarios } = useQuery({
    queryKey: queryKeys.comentariosCapa(comunidadId, capituloId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comentarios_lectura')
        .select('id, parrafo_id, autor_id, contenido, created_at, parrafos!inner(capitulo_id)')
        .eq('comunidad_id', comunidadId).eq('libro_id', libroId)
        .eq('parrafos.capitulo_id', capituloId)
        .not('contenido', 'is', null)
        .order('created_at', { ascending: true })
      if (error) throw error
      const personas = await nombresDe((data || []).map(c => c.autor_id))
      const porParrafo = {}
      for (const c of data || []) {
        (porParrafo[c.parrafo_id] ||= []).push({
          id: c.id, parrafoId: c.parrafo_id, autor: personas[c.autor_id],
          contenido: c.contenido, createdAt: c.created_at,
        })
      }
      return porParrafo
    },
    enabled: habilitada && !!capituloId,
    staleTime: STALE_TIME,
  })

  // Mensajitos del libro que me dejaron o que dejé
  const { data: mensajitos } = useQuery({
    queryKey: queryKeys.mensajitosCapa(comunidadId, libroId, userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mensajitos')
        .select('id, parrafo_id, de_id, para_id, contenido, efimero, leido_at, created_at, parrafos(capitulo_id)')
        .eq('comunidad_id', comunidadId).eq('libro_id', libroId)
        .or(`de_id.eq.${userId},para_id.eq.${userId}`)
        .order('created_at', { ascending: false })
      if (error) throw error
      const personas = await nombresDe((data || []).flatMap(m => [m.de_id, m.para_id]))
      return (data || []).map(m => ({
        id: m.id, parrafoId: m.parrafo_id, capituloId: m.parrafos?.capitulo_id || null,
        mio: m.de_id === userId,
        otra: personas[m.de_id === userId ? m.para_id : m.de_id],
        contenido: m.contenido, efimero: m.efimero,
        sinLeer: m.para_id === userId && !m.leido_at,
        createdAt: m.created_at,
      }))
    },
    enabled: habilitada,
    staleTime: STALE_TIME,
  })

  // Espera al refetch: quien llama puede abrir el hilo justo después y
  // necesita ver ya el comentario nuevo.
  const invalidar = useCallback((...claves) => Promise.all(
    claves.map(k => queryClient.invalidateQueries({ queryKey: k })),
  ), [queryClient])
  const kComentarios = useMemo(() => queryKeys.comentariosCapa(comunidadId, capituloId), [comunidadId, capituloId])
  const kMensajitos = useMemo(() => queryKeys.mensajitosCapa(comunidadId, libroId, userId), [comunidadId, libroId, userId])

  const comentar = useCallback(async (parrafoId, contenido) => {
    const { data, error } = await supabase.from('comentarios_lectura')
      .insert({ comunidad_id: comunidadId, libro_id: libroId, parrafo_id: parrafoId, autor_id: userId, contenido: contenido.trim() })
      .select('id')
    if (error || !data?.length) throw new Error('No pudimos guardar tu comentario. Revisa tu conexión e inténtalo de nuevo.')
    await invalidar(kComentarios)
  }, [comunidadId, libroId, userId, invalidar, kComentarios])

  const borrarComentario = useCallback(async (id) => {
    const { data, error } = await supabase.from('comentarios_lectura').delete().eq('id', id).select('id')
    if (error || !data?.length) throw new Error('No pudimos borrar el comentario.')
    invalidar(kComentarios)
  }, [invalidar, kComentarios])

  const dejarMensajito = useCallback(async ({ paraId, parrafoId, contenido, efimero }) => {
    const { data, error } = await supabase.from('mensajitos')
      .insert({ comunidad_id: comunidadId, libro_id: libroId, parrafo_id: parrafoId, de_id: userId, para_id: paraId, contenido: contenido.trim(), efimero: !!efimero })
      .select('id')
    if (error || !data?.length) throw new Error('No pudimos dejar el mensajito. Revisa tu conexión e inténtalo de nuevo.')
    await invalidar(kMensajitos)
  }, [comunidadId, libroId, userId, invalidar, kMensajitos])

  // Optimista: el puntito y el latido se apagan al instante.
  const marcarLeido = useCallback(async (id) => {
    queryClient.setQueryData(kMensajitos, prev => prev?.map(m => (m.id === id ? { ...m, sinLeer: false } : m)))
    const { error } = await supabase.from('mensajitos').update({ leido_at: new Date().toISOString() }).eq('id', id)
    if (error) console.error('mensajito leído:', error.message)
  }, [queryClient, kMensajitos])

  const borrarMensajito = useCallback(async (id) => {
    queryClient.setQueryData(kMensajitos, prev => prev?.filter(m => m.id !== id))
    const { data, error } = await supabase.from('mensajitos').delete().eq('id', id).select('id')
    if (error || !data?.length) {
      invalidar(kMensajitos)
      throw new Error('No pudimos borrar el mensajito.')
    }
  }, [queryClient, invalidar, kMensajitos])

  // tipo: 'comentario_lectura' | 'mensajito'. Denunciar dos veces lo mismo
  // choca con el UNIQUE de la tabla: para el usuario es igual de válido.
  const denunciar = useCallback(async (tipo, objetoId) => {
    const { error } = await supabase.from('denuncias').insert({ denunciante_id: userId, tipo, objeto_id: objetoId })
    if (error && error.code !== '23505') throw new Error('No pudimos enviar la denuncia. Inténtalo de nuevo.')
  }, [userId])

  return {
    personas: miembros?.personas || {},
    destinatarios: miembros?.destinatarios || [],
    soyModerador: !!miembros?.soyModerador,
    comentariosPorParrafo: comentarios || EMPTY,
    mensajitos: mensajitos || EMPTY_LIST,
    comentar, borrarComentario, dejarMensajito, marcarLeido, borrarMensajito, denunciar,
  }
}

const EMPTY = {}
const EMPTY_LIST = []
