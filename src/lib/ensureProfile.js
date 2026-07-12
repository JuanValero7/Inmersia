// Crea el perfil y el Manual del Explorador de un usuario si todavía no existen.
// Se invoca en cada evento SIGNED_IN (ver App.jsx): cubre tanto el registro con sesión
// inmediata como el primer login tras confirmar el email, cuando signUp() no devolvió
// sesión y los inserts del registro no pudieron correr (bloqueados por RLS).
import { supabase } from './supabase.js'
import { MANUAL_LIBRO_ID } from './constants.js'

export async function ensureProfile(user) {
  if (!user) return

  const { data: perfil, error: selectError } = await supabase
    .from('perfiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (selectError) { console.error('No se pudo verificar el perfil:', selectError); return }
  if (perfil) return

  const meta = user.user_metadata || {}
  const { error: perfilError } = await supabase.from('perfiles').insert({
    id: user.id,
    nombre: meta.nombre || '',
    apellido: meta.apellido || '',
    fecha_nacimiento: meta.fecha_nacimiento || null,
  })
  if (perfilError) { console.error('No se pudo crear el perfil:', perfilError); return }

  const { error: manualError } = await supabase.from('bibliotecas_usuarios').insert({
    user_id: user.id,
    libro_id: MANUAL_LIBRO_ID,
    leido: false,
  })
  if (manualError) console.error('No se pudo asignar el Manual del Explorador:', manualError)
}
