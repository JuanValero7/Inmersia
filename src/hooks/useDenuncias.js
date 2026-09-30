// src/hooks/useDenuncias.js
// ─────────────────────────────────────────────────────────────
// Denuncias: la revisión (Perfil → Denuncias, solo superusuario) y
// denunciar una comunidad (buscador y panel "Ver comunidad").
// Denunciar comentarios y mensajitos vive en useCapaComunidad.js.
//
// Esquema: migraciones 051 (tabla y trigger que copia el texto), 059
// (purga a los 6 meses) y 060 (contexto, denuncias_para_revisar,
// resolver_denuncia). Las dos funciones rechazan a quien no es superusuario.
// ─────────────────────────────────────────────────────────────
import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'

export const MOTIVOS_COMUNIDAD = [
  'El nombre o la descripción son ofensivos',
  'Es spam o publicidad',
  'No es apropiada para menores',
  'El moderador abusa',
  'Otro',
]

// ── Revisión ────────────────────────────────────────────────
export function useDenunciasQuery(pendientes, habilitado) {
  return useQuery({
    queryKey: queryKeys.denuncias(pendientes),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('denuncias_para_revisar', { p_pendientes: pendientes })
      if (error) throw error
      return data || []
    },
    enabled: !!habilitado,
    staleTime: 30_000,
  })
}

// accion: 'descartar' | 'borrar' | 'sacar' | 'renombrar' | 'cerrar' | 'deshacer'
export function useResolverDenuncia() {
  const queryClient = useQueryClient()
  const [ocupada, setOcupada] = useState(null)   // id de la denuncia en curso

  const resolver = useCallback(async (id, accion) => {
    setOcupada(id)
    const { error } = await supabase.rpc('resolver_denuncia', { p_id: id, p_accion: accion })
    setOcupada(null)
    // Pendientes y resueltas cambian a la vez; y si se borró o renombró
    // algo, lo que muestran las comunidades también.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.denuncias(true) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.denuncias(false) }),
    ])
    if (!error) return null
    if (error.hint === 'ya_resuelta') return 'Esa denuncia ya estaba resuelta. La lista se actualizó.'
    if (error.hint === 'sin_denunciado') return 'No podemos sacar a nadie: la persona o la comunidad ya no existen.'
    return 'No se pudo aplicar. Revisa tu conexión e inténtalo de nuevo.'
  }, [queryClient])

  return { resolver, ocupada }
}

// ── Denunciar una comunidad ─────────────────────────────────
// Devuelve null si fue bien, o un mensaje de error. Denunciar dos veces
// la misma choca con el UNIQUE de la tabla: para quien denuncia es igual.
export async function denunciarComunidad(userId, comunidadId, motivo, detalle) {
  const texto = [motivo, detalle?.trim()].filter(Boolean).join(' — ').slice(0, 1000)
  const { error } = await supabase.from('denuncias')
    .insert({ denunciante_id: userId, tipo: 'comunidad', objeto_id: comunidadId, motivo: texto })
  if (!error || error.code === '23505') return null
  return 'No pudimos enviar la denuncia. Revisa tu conexión e inténtalo de nuevo.'
}
