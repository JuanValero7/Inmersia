// Crea el perfil y el Manual del Explorador de un usuario si todavía no existen.
// Desde la migración 073 los crea la base al registrarse (trigger en auth.users), así
// que esto es la RED DE SEGURIDAD: repara la cuenta si el trigger falló (deja un
// WARNING en los logs y no bloquea el registro). Se invoca en cada evento SIGNED_IN
// (ver App.jsx). Las dos lógicas de nombres (aquí y _crear_perfil) van a la par.
//
// MEMOIZADO por user.id: devuelve SIEMPRE la misma promesa mientras esté en vuelo o
// resuelta. Dos motivos:
//   · idempotencia — App (SIGNED_IN) y el controlador de onboarding lo llaman por
//     separado y no queremos duplicar las consultas;
//   · orden — el onboarding necesita ESPERAR a que la fila de `perfiles` exista antes
//     de leer `onboarding_completado`, o lee null y concluye que no hay tutorial.
//     Llamando a ensureProfile() y esperando su promesa, el orden queda garantizado
//     sin importar quién de los dos llegue primero.
// Si falla se borra del registro para que un intento posterior lo reintente.
import { supabase } from './supabase.js'
import { MANUAL_LIBRO_ID } from './constants.js'

const enVuelo = new Map() // user.id → Promise<void>

export function ensureProfile(user) {
  if (!user?.id) return Promise.resolve()
  const cacheada = enVuelo.get(user.id)
  if (cacheada) return cacheada
  const promesa = crearPerfilYManual(user)
    .catch((err) => { console.error('ensureProfile:', err); enVuelo.delete(user.id) })
  enVuelo.set(user.id, promesa)
  return promesa
}

async function crearPerfilYManual(user) {
  // 1) Perfil: crearlo si aún no existe.
  const { data: perfil, error: selectError } = await supabase
    .from('perfiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (selectError) { console.error('No se pudo verificar el perfil:', selectError); return }

  if (!perfil) {
    const meta = user.user_metadata || {}
    // Registro con correo: `nombre` (el apellido ya no se pide; se añade en el
    // Perfil). Google: given_name / family_name, o full_name partido.
    const [nombreGoogle = '', ...restoGoogle] = (meta.full_name || meta.name || '').trim().split(/\s+/)
    const { error: perfilError } = await supabase.from('perfiles').insert({
      id: user.id,
      nombre: meta.nombre || meta.given_name || nombreGoogle,
      apellido: meta.apellido || meta.family_name || restoGoogle.join(' '),
      // Con Google llega vacía: la pide CompletarCuenta y la escribe aquí.
      fecha_nacimiento: meta.fecha_nacimiento || null,
      // `perfiles.genero` (migración 043) ya no se pide desde octubre de 2026;
      // solo queda en las cuentas antiguas.
      genero: meta.genero || null,
    })
    if (perfilError) { console.error('No se pudo crear el perfil:', perfilError); return }
  }

  // 2) Manual del Explorador: asegúralo SIEMPRE (idempotente), no solo al crear
  // el perfil. Así también repara a usuarios antiguos que no tengan la fila —
  // importante ahora que la Biblioteca ya no inyecta un manual sintético.
  // adquirir_libro (migración 076) no hace nada si ya lo tiene, y el Manual
  // no cuenta para el límite de pendientes.
  const { error: manualError } = await supabase.rpc('adquirir_libro', { p_libro_id: MANUAL_LIBRO_ID })
  if (manualError) console.error('No se pudo asignar el Manual del Explorador:', manualError)
}
