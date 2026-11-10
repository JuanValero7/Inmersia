// src/hooks/useColegio.js
// ─────────────────────────────────────────────────────────────
// Datos del panel del colegio (/colegio). El esquema vive en las
// migraciones 081–083. Lo que importa aquí:
//   · mis_colegios(): de qué colegios soy administrador o profesor. Decide
//     si se ve el botón «Mi colegio» y qué secciones tiene el panel.
//   · lista_colegio(): aulas con sus códigos, profesores y alumnos. La
//     función ya filtra: el profesor recibe solo sus aulas y sin el código
//     de profesor. Solo nombres y cantidades, nada de lo que escriben.
//   · salon_aula() y resumen_colegio(): los datos de lectura. Solo el libro
//     del aula, solo cantidades; los subrayados, por párrafo y con 3+.
//   · comprension_aula() (094): los juegos del libro del aula. Del concurso
//     solo el resultado; del desafío la charla, que el alumno sabe que lee el profe.
//   · Un aula es una comunidad con colegio_id: quitar a alguien es borrar
//     su fila de comunidad_miembros (la RLS deja al administrador y al
//     profesor de esa aula).
// ─────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'
import { evento } from '../lib/analytics.js'

const STALE_TIME = 60_000

function mensajeError(error, generico) {
  if (error?.hint === 'aula_repetida') return error.message
  if (error?.hint === 'libro_invalido') return 'Ese libro ya no está en el catálogo. Elige otro.'
  if (error?.hint === 'ultimo_admin') return 'El colegio tiene que quedar con al menos un administrador. Invita a otra persona antes de irte.'
  return generico
}

/** @returns {import('@tanstack/react-query').UseQueryResult<{ colegio_id: string, nombre: string, rol: 'admin'|'profesor' }[]>} */
export function useMisColegiosQuery(userId) {
  return useQuery({
    queryKey: queryKeys.misColegios(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mis_colegios')
      if (error) throw error
      return data || []
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })
}

export function useListaColegioQuery(colegioId) {
  return useQuery({
    queryKey: queryKeys.listaColegio(colegioId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('lista_colegio', { p_colegio: colegioId })
      if (error) throw error
      return data || []
    },
    enabled: !!colegioId,
    staleTime: STALE_TIME,
  })
}

// Zona horaria de quien mira: «hoy» y los días de la semana son los suyos.
const zona = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' } }

// Salón: un aula, sobre su lectura actual (salon_aula, 083). Ver la
// migración para las reglas de «al día» y «muy rápido».
export function useSalonQuery(aulaId) {
  return useQuery({
    queryKey: queryKeys.salonAula(aulaId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('salon_aula', { p_aula: aulaId, p_zona: zona() })
      if (error) throw error
      return data
    },
    enabled: !!aulaId,
    staleTime: STALE_TIME,
  })
}

// Comprensión: los 5 juegos del libro del aula, alumno por alumno
// (comprension_aula, 094). Las cuentas, en utils/comprension.js.
export function useComprensionQuery(aulaId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.comprensionAula(aulaId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('comprension_aula', { p_aula: aulaId, p_zona: zona() })
      if (error) throw error
      return data
    },
    enabled: !!aulaId && enabled,
    staleTime: STALE_TIME,
  })
}

// Cápsula del tiempo (no ficción, migración 098): lo que respondió cada alumno
// al empezar y al terminar el libro. Solo para leer. Sin la 098, null.
export function useCapsulaAulaQuery(aulaId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.capsulaAula(aulaId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('capsula_aula', { p_aula: aulaId })
      if (error) return null
      return data
    },
    enabled: !!aulaId && enabled,
    staleTime: STALE_TIME,
  })
}

// El falsificador (no ficción, migración 099): qué respondió cada alumno en
// cada párrafo sospechoso. Sin la 099, null.
export function useFalsificadorAulaQuery(aulaId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.falsificadorAula(aulaId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('falsificador_aula', { p_aula: aulaId })
      if (error) return null
      return data
    },
    enabled: !!aulaId && enabled,
    staleTime: STALE_TIME,
  })
}

// La charla entera de un alumno en el desafío: solo al tocar «Ver la charla».
export function useCharlaAulaQuery(aulaId, userId, momento, enabled) {
  return useQuery({
    queryKey: queryKeys.charlaAula(aulaId, userId, momento),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('desafio_charla_aula', { p_aula: aulaId, p_user: userId, p_momento: momento })
      if (error) throw error
      return data
    },
    enabled: !!aulaId && !!userId && enabled,
    staleTime: STALE_TIME,
  })
}

// Nota (0–20) y comentario del profe en un desafío. El alumno los ve en su Cuaderno.
export function useCalificarDesafio(aulaId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, momento, nota, comentario }) => {
      const { data, error } = await supabase.rpc('desafio_calificar', {
        p_aula: aulaId, p_user: userId, p_momento: momento, p_nota: nota, p_comentario: comentario,
      })
      if (error) throw error
      return data
    },
    onSuccess: (_, { userId, momento }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comprensionAula(aulaId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.charlaAula(aulaId, userId, momento) })
      evento('desafio_calificado')
    },
  })
}

// Colegio: todas las aulas sumadas + minutos de las últimas 8 semanas
// (resumen_colegio, 083). Solo administración.
export function useResumenColegioQuery(colegioId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.resumenColegio(colegioId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('resumen_colegio', { p_colegio: colegioId, p_zona: zona() })
      if (error) throw error
      return data
    },
    enabled: !!colegioId && enabled,
    staleTime: STALE_TIME,
  })
}

export function useAdminsColegioQuery(colegioId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminsColegio(colegioId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admins_colegio', { p_colegio: colegioId })
      if (error) throw error
      return data || []
    },
    enabled: !!colegioId && enabled,
    staleTime: STALE_TIME,
  })
}

// Acciones de la Lista. Cada una devuelve { ok: true, valor? } o
// { error: 'mensaje para el usuario' }. `ocupado` dice cuál está en curso
// (nombre + id) para desactivar solo ese botón.
export function useGestionColegio(colegioId, userId) {
  const queryClient = useQueryClient()
  const [ocupado, setOcupado] = useState(null)

  // conFilas: un DELETE que la RLS no deja no da error, solo no borra nada.
  const correr = useCallback(async (clave, fn, generico, conFilas = false) => {
    setOcupado(clave)
    try {
      const { data, error } = await fn()
      if (error) {
        console.error(`colegio/${clave}:`, error.code, error.message, error.hint)
        return { error: mensajeError(error, generico) }
      }
      if (conFilas && !data?.length) return { error: 'No tienes permiso para hacer esto.' }
      queryClient.invalidateQueries({ queryKey: queryKeys.listaColegio(colegioId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminsColegio(colegioId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resumenColegio(colegioId) })
      queryClient.invalidateQueries({ queryKey: ['salonAula'] })
      return { ok: true, valor: data }
    } finally {
      setOcupado(null)
    }
  }, [queryClient, colegioId])

  const crearAula = (grado, seccion) => correr('crear',
    () => supabase.rpc('crear_aula', { p_colegio: colegioId, p_grado: grado.trim(), p_seccion: seccion.trim() || null }),
    'No pudimos crear el aula. Revisa tu conexión e inténtalo de nuevo.')
    .then(r => { if (r.ok) evento('aula_creada'); return r })

  const borrarAula = (aulaId) => correr(`borrar:${aulaId}`,
    () => supabase.from('comunidades').delete().eq('id', aulaId).select('id'),
    'No pudimos borrar el aula.', true)

  const cambiarCodigoAlumnos = (aulaId) => correr(`alumnos:${aulaId}`,
    () => supabase.rpc('regenerar_codigo', { p_comunidad: aulaId }),
    'No pudimos cambiar el código.')

  const cambiarCodigoProfesor = (aulaId) => correr(`profesor:${aulaId}`,
    () => supabase.rpc('regenerar_codigo_profesor', { p_aula: aulaId }),
    'No pudimos cambiar el código.')

  const quitarDelAula = (aulaId, miembroId) => correr(`quitar:${aulaId}:${miembroId}`,
    () => supabase.from('comunidad_miembros').delete().eq('comunidad_id', aulaId).eq('user_id', miembroId).select('user_id'),
    'No pudimos quitar a esa persona.', true)

  // Libro y fecha meta del aula (asignar_lectura, 085). El libro llega solo
  // a la biblioteca de todos los del aula.
  const asignarLectura = (aulaId, libroId, fechaMeta) => correr(`lectura:${aulaId}`,
    () => supabase.rpc('asignar_lectura', { p_aula: aulaId, p_libro: libroId, p_fecha_meta: fechaMeta || null }),
    'No pudimos guardar la lectura. Revisa tu conexión e inténtalo de nuevo.')
    .then(r => {
      if (r.ok) {
        evento('aula_lectura_asignada', { con_fecha: !!fechaMeta })
        queryClient.invalidateQueries({ queryKey: queryKeys.bibliotecaUsuario(userId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.comunidad(aulaId) })
      }
      return r
    })

  const invitarAdmin = () => correr('invitar',
    () => supabase.rpc('invitar_admin', { p_colegio: colegioId }),
    'No pudimos generar la invitación.')

  // Quitarse a uno mismo también vale: el panel deja de verse.
  const quitarAdmin = (adminId) => correr(`admin:${adminId}`,
    () => supabase.from('colegio_admins').delete().eq('colegio_id', colegioId).eq('user_id', adminId).select('user_id'),
    'No pudimos quitar a ese administrador.', true)
    .then(r => {
      if (r.ok && adminId === userId) queryClient.invalidateQueries({ queryKey: queryKeys.misColegios(userId) })
      return r
    })

  return { crearAula, borrarAula, cambiarCodigoAlumnos, cambiarCodigoProfesor, quitarDelAula, asignarLectura, invitarAdmin, quitarAdmin, ocupado }
}
